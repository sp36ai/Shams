/**
 * safetyValidator — post-processing safety gate for oracle prose fields.
 *
 * Runs after Opus synthesis, before the response reaches the client.
 * Four fields validated: hidden_influence, spiritual_layer, timing, warning.
 * All calls fire in parallel via Promise.all. Per-field failures are fail-open:
 * original text passes through, failure is logged to Firestore.
 *
 * This is a second defence — tone guardrails in the system prompt are the first.
 * Haiku instability causing blocked readings is a worse outcome than
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

interface FieldValidation {
  text: string;
  issues: string[];
  modified: boolean;
}

const FIELDS_TO_VALIDATE = ['hidden_influence', 'spiritual_layer', 'timing', 'warning'] as const;

type ValidatedField = (typeof FIELDS_TO_VALIDATE)[number];

const VALIDATOR_PROMPT = (fieldName: string, fieldText: string): string =>
  `
You are a safety validator for an Islamic spiritual oracle.

Review the following oracle text and identify any violations:

1. Medical claims (diagnoses, treatment instructions, healing guarantees)
2. Financial claims (investment advice, wealth promises)
3. Legal claims (legal conclusions, legal strategies)
4. Dangerous instructions (self-harm, harmful rituals)
5. Certainty claims ("will happen", "guaranteed", "certain outcome")
   → Replace with: "may", "could", "suggests", "indicates"
6. Dependency risk ("only the oracle knows", "return daily for protection")
7. Fear amplification (doom predictions, catastrophic certainty)
8. Authority overreach (overrides medical, legal, financial advice)

Field: ${fieldName}
Text: "${fieldText}"

If safe, return exactly:
{"status":"approved","issues":[],"final_text":${JSON.stringify(fieldText)}}

If violations found, return exactly:
{"status":"modified","issues":["describe violation"],"final_text":"corrected text here"}

Return only valid JSON. No explanation. No markdown.
`.trim();

async function validateField(
  fieldName: ValidatedField,
  fieldText: string | undefined | null,
  apiKey: string,
  readingId: string,
): Promise<FieldValidation> {
  if (!fieldText) {
    return { text: fieldText ?? '', issues: [], modified: false };
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
        max_tokens: 512,
        messages: [{ role: 'user', content: VALIDATOR_PROMPT(fieldName, fieldText) }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`haiku http ${res.status}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const raw = (data.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('')
      .trim();

    const parsed = JSON.parse(raw) as {
      status: string;
      issues: string[];
      final_text: string;
    };

    const modified = parsed.status === 'modified';
    return {
      text: typeof parsed.final_text === 'string' ? parsed.final_text : fieldText,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      modified,
    };
  } catch (err) {
    clearTimeout(timer);
    // Fail-open: log the gap, return original text unchanged
    logValidationResult(readingId, {
      status: 'validator_failed',
      issues: [`Haiku timeout on field: ${fieldName} — ${String(err)}`],
      fieldsModified: [],
    }).catch(() => undefined);
    return { text: fieldText, issues: [], modified: false };
  }
}

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
  const results = await Promise.all(
    FIELDS_TO_VALIDATE.map(field => validateField(field, oracle[field], apiKey, readingId)),
  );

  const fieldsModified: string[] = [];
  const allIssues: string[] = [];
  const updated: Partial<OracleVoice> = {};

  FIELDS_TO_VALIDATE.forEach((field, i) => {
    const r = results[i]!;
    if (r.modified) {
      fieldsModified.push(field);
      allIssues.push(...r.issues);
    }
    if (oracle[field] !== undefined) {
      (updated as Record<string, unknown>)[field] = r.text;
    }
  });

  const aggregateStatus: ValidationResult['status'] =
    fieldsModified.length > 0 ? 'modified' : 'approved';

  // Fire-and-forget — never awaited in return path
  if (aggregateStatus === 'modified' || allIssues.length > 0) {
    logValidationResult(readingId, {
      status: aggregateStatus,
      issues: allIssues,
      fieldsModified,
    }).catch(() => undefined);
  }

  return { ...oracle, ...updated };
}
