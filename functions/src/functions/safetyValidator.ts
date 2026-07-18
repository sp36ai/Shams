/**
 * safetyValidator — post-processing safety gate for oracle prose fields.
 *
 * Runs after Opus synthesis, before the response reaches the client.
 * Four fields validated: hidden_influence, spiritual_layer, timing, warning.
 * A SINGLE Haiku call validates all present fields at once (previously one
 * call per field — 4× the requests and cost). Failures are fail-open: the
 * original text passes through and the gap is logged to Firestore.
 *
 * This is a second defence — tone guardrails in the system prompt are the
 * first. Haiku instability causing blocked readings is a worse outcome than
 * unvalidated-but-already-guardrailed prose reaching the user.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { OracleResponse } from '../types';

type OracleVoice = NonNullable<OracleResponse['oracle']>;

export interface ValidationResult {
  status: 'approved' | 'modified' | 'validator_failed';
  issues: string[];
  fieldsModified: string[];
}

const FIELDS_TO_VALIDATE = ['hidden_influence', 'spiritual_layer', 'timing', 'warning'] as const;

type ValidatedField = (typeof FIELDS_TO_VALIDATE)[number];

interface FieldVerdict {
  status?: string;
  final_text?: string;
  issues?: string[];
}

const VALIDATOR_PROMPT = (fields: Record<string, string>): string =>
  `
You are a safety validator for an Islamic spiritual oracle.

Review EACH field below and identify any violations:

1. Medical claims (diagnoses, treatment instructions, healing guarantees)
2. Financial claims (investment advice, wealth promises)
3. Legal claims (legal conclusions, legal strategies)
4. Dangerous instructions (self-harm, harmful rituals)
5. Certainty claims ("will happen", "guaranteed", "certain outcome")
   → Replace with: "may", "could", "suggests", "indicates"
6. Dependency risk ("only the oracle knows", "return daily for protection")
7. Fear amplification (doom predictions, catastrophic certainty)
8. Authority overreach (overrides medical, legal, financial advice)

Fields to review (JSON object, key = field name, value = text):
${JSON.stringify(fields)}

Return ONLY valid JSON in exactly this shape, with one entry per input field:
{"results":{"<field_name>":{"status":"approved"|"modified","final_text":"<text>","issues":["describe violation"]}}}

If a field is safe, use status "approved" and return final_text unchanged with an empty issues array.
If a field has violations, use status "modified" and return the corrected final_text.
Return only valid JSON. No explanation. No markdown.
`.trim();

function logValidationResult(
  readingId: string,
  result: Omit<ValidationResult, 'fieldsModified'> & { fieldsModified: string[] },
): Promise<void> {
  const db = getFirestore();
  return db
    .collection('readings')
    .doc(readingId)
    .collection('validationLog')
    .add({ ...result, timestamp: FieldValue.serverTimestamp() })
    .then(() => undefined)
    .catch(() => undefined); // non-critical — silently discard secondary failures
}

export async function runSafetyValidator(
  oracle: OracleVoice,
  readingId: string,
  apiKey: string,
): Promise<OracleVoice> {
  // Collect the present, non-empty fields to validate.
  const present: Partial<Record<ValidatedField, string>> = {};
  for (const field of FIELDS_TO_VALIDATE) {
    const value = oracle[field];
    if (typeof value === 'string' && value.length > 0) {
      present[field] = value;
    }
  }
  if (Object.keys(present).length === 0) {
    return oracle; // nothing to validate
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: VALIDATOR_PROMPT(present as Record<string, string>) }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`haiku http ${res.status}`);
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const raw = (data.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('')
      .trim();

    const parsed = JSON.parse(raw) as { results?: Record<string, FieldVerdict> };
    const results = parsed.results ?? {};

    const updated: Partial<OracleVoice> = {};
    const fieldsModified: string[] = [];
    const allIssues: string[] = [];

    for (const field of FIELDS_TO_VALIDATE) {
      const original = present[field];
      if (original === undefined) {
        continue;
      }
      const verdict = results[field];
      const finalText =
        verdict && typeof verdict.final_text === 'string' ? verdict.final_text : original;
      (updated as Record<string, unknown>)[field] = finalText;
      if (verdict?.status === 'modified') {
        fieldsModified.push(field);
        if (Array.isArray(verdict.issues)) {
          allIssues.push(...verdict.issues);
        }
      }
    }

    if (fieldsModified.length > 0 || allIssues.length > 0) {
      void logValidationResult(readingId, {
        status: fieldsModified.length > 0 ? 'modified' : 'approved',
        issues: allIssues,
        fieldsModified,
      });
    }

    return { ...oracle, ...updated };
  } catch (err) {
    clearTimeout(timer);
    // Fail-open: log the gap, return the oracle unchanged.
    void logValidationResult(readingId, {
      status: 'validator_failed',
      issues: [`Haiku validation failed — ${String(err)}`],
      fieldsModified: [],
    });
    return oracle;
  }
}
