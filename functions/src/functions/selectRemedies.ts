import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { FUNCTION_OPTS, ANTHROPIC_API_KEY } from '../config';
import { verifyAuth } from '../middleware/auth';

interface CandidateInput {
  id: string;
  title: string;
  category: string;
  effectDimension: string;
  intensity: string;
  themeTags: string[];
}

interface SelectRemediasRequest {
  oracleContext: {
    classification: string;
    spiritualState: string;
    severity: string;
    summary: string;
  };
  candidates: CandidateInput[];
  questionText: string;
  readingId: string;
}

interface SelectRemediesResponse {
  selectedIds: string[];
  selectionReason: string;
  descriptions: Record<string, string>;
}

const SELECTION_PROMPT = `You are the remedy selection layer of a sacred Islamic oracle.

You will receive oracle context and up to 8 candidate remedies.
Select 1 to 3 remedies that best serve this seeker's specific state.

Rules:
- Select a minimum of 1, maximum of 3 remedies
- Do not select two remedies from the same category
- Prefer variety across effectDimension
- The seeker must be able to act on your selection today

Return ONLY valid JSON in this exact structure:
{"selectedIds":["id_1","id_2"],"selectionReason":"One sentence explaining why these remedies serve this seeker's state."}

No markdown. No backticks. No preamble. Raw JSON only.`;

async function generateDescription(
  remedy: CandidateInput,
  ctx: {
    questionText: string;
    oracleClassification: string;
    spiritualState: string;
  },
  apiKey: string,
): Promise<string> {
  const prompt = `You are writing a 1–2 line sacred description for a spiritual remedy recommended to a seeker by an Islamic oracle.

The seeker asked: "${ctx.questionText}"
Oracle verdict: ${ctx.oracleClassification}
Seeker's state: ${ctx.spiritualState}
Remedy category: ${remedy.category}
Remedy title: ${remedy.title}
Effect: ${remedy.effectDimension}

Write exactly 1–2 lines of guidance in a sacred, compassionate register.
No bullet points. No headers. No Quranic citations (those appear elsewhere).
Begin directly with the practice, not with "This remedy" or "You should".
Maximum 30 words.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

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
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return '';
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('')
      .trim();

    return text.length >= 10 ? text : '';
  } catch {
    clearTimeout(timer);
    return '';
  }
}

export const selectRemedies = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request): Promise<SelectRemediesResponse> => {
    verifyAuth(request);

    const d = request.data as SelectRemediasRequest | null;
    const oracleContext = d?.oracleContext ?? {
      classification: 'NEUTRAL',
      spiritualState: 'uncertain',
      severity: 'moderate',
      summary: '',
    };
    const candidates: CandidateInput[] = Array.isArray(d?.candidates)
      ? (d.candidates as unknown[]).slice(0, 8).filter(
          (c): c is CandidateInput =>
            typeof (c as CandidateInput)?.id === 'string',
        )
      : [];
    const questionText =
      typeof d?.questionText === 'string' ? d.questionText.slice(0, 500) : '';
    const readingId =
      typeof d?.readingId === 'string' ? d.readingId : '';

    const apiKey = ANTHROPIC_API_KEY.value();

    if (!apiKey || candidates.length === 0) {
      return {
        selectedIds: candidates.slice(0, 3).map(c => c.id),
        selectionReason: 'fallback: no api key or no candidates',
        descriptions: {},
      };
    }

    const selectionPayload = {
      oracleContext,
      candidates: candidates.map(c => ({
        id: c.id,
        category: c.category,
        effectDimension: c.effectDimension,
        intensity: c.intensity,
        themeTags: c.themeTags,
      })),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    let selectedIds: string[] = [];
    let selectionReason = 'fallback: llm call failed';

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 120,
          system: SELECTION_PROMPT,
          messages: [
            { role: 'user', content: JSON.stringify(selectionPayload) },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text =
          data.content?.find(b => b.type === 'text')?.text ?? '{}';
        const parsed = JSON.parse(
          text.replace(/```json|```/g, '').trim(),
        ) as {
          selectedIds?: unknown;
          selectionReason?: unknown;
        };

        const candidateIds = new Set(candidates.map(c => c.id));
        const rawIds = Array.isArray(parsed.selectedIds)
          ? parsed.selectedIds
          : [];
        selectedIds = (rawIds as unknown[])
          .filter(
            (id): id is string =>
              typeof id === 'string' && candidateIds.has(id),
          )
          .slice(0, 3);

        if (typeof parsed.selectionReason === 'string') {
          selectionReason = parsed.selectionReason;
        }
      }
    } catch {
      clearTimeout(timer);
    }

    if (selectedIds.length === 0) {
      selectedIds = candidates.slice(0, 3).map(c => c.id);
      selectionReason = `fallback: llm returned no valid ids`;
    }

    // Enrich selected remedies with Haiku descriptions (all in parallel)
    const selectedCandidates = selectedIds
      .map(id => candidates.find(c => c.id === id))
      .filter((c): c is CandidateInput => c !== undefined);

    const descriptionEntries = await Promise.all(
      selectedCandidates.map(async remedy => {
        const desc = await generateDescription(
          remedy,
          {
            questionText,
            oracleClassification: oracleContext.classification,
            spiritualState: oracleContext.spiritualState,
          },
          apiKey,
        );
        return [remedy.id, desc] as [string, string];
      }),
    );

    const descriptions = Object.fromEntries(
      descriptionEntries.filter(([, desc]) => desc.length > 0),
    );

    // Fire-and-forget: log selection reason to the reading doc
    if (readingId) {
      db.collection('readings')
        .doc(readingId)
        .update({ selectionReason, selectionReasonUpdatedAt: FieldValue.serverTimestamp() })
        .catch(() => undefined);
    }

    return { selectedIds, selectionReason, descriptions };
  },
);
