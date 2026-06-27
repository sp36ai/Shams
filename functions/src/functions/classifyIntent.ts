import { onCall } from 'firebase-functions/v2/https';
import { FUNCTION_OPTS, ANTHROPIC_API_KEY } from '../config';
import { verifyAuth } from '../middleware/auth';

type IntentClass =
  | 'TIMING'
  | 'REMEDY'
  | 'CLARIFY'
  | 'REFORMAT'
  | 'NEW_QUESTION'
  | 'UNKNOWN';

export interface IntentResult {
  class: IntentClass;
  confidence: 'HIGH' | 'LOW';
  reason: string;
}

const VALID_INTENT_CLASSES: IntentClass[] = [
  'TIMING',
  'REMEDY',
  'CLARIFY',
  'REFORMAT',
  'NEW_QUESTION',
  'UNKNOWN',
];

export const classifyIntent = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request): Promise<IntentResult> => {
    verifyAuth(request);

    const d = request.data as {
      userMessage?: unknown;
      lockedQuestion?: unknown;
      verdictDirection?: unknown;
      recentMessages?: unknown;
    } | null;

    const userMessage =
      typeof d?.userMessage === 'string' ? d.userMessage.slice(0, 500) : '';
    const lockedQuestion =
      typeof d?.lockedQuestion === 'string' ? d.lockedQuestion.slice(0, 500) : '';
    const verdictDirection =
      typeof d?.verdictDirection === 'string' ? d.verdictDirection : '';
    const recentMessages = Array.isArray(d?.recentMessages)
      ? (d.recentMessages as unknown[])
          .slice(0, 3)
          .filter((m): m is string => typeof m === 'string')
      : [];

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      return { class: 'UNKNOWN', confidence: 'LOW', reason: 'no api key' };
    }

    const verdictBinary =
      verdictDirection === 'YES' || verdictDirection === 'CONDITIONAL'
        ? 'CONFIRMED'
        : 'DENIED';

    const systemPrompt = `You are an intent classifier for a horary oracle app.
A user has received a verdict for a specific horary question.
They are now sending a follow-up message in the same thread.

Your job: classify whether this message is a follow-up about the SAME reading,
or a NEW horary question that requires a fresh chart.

The locked question is: "${lockedQuestion}"
The verdict was: ${verdictBinary}
Recent thread (last 3 messages): ${recentMessages.join(' | ')}

Classify the user message into exactly one of:
- TIMING: asking when, how long, what timeframe
- REMEDY: asking what to do, spiritual practice, dua, remedy
- CLARIFY: asking why, explain, what does this mean
- REFORMAT: asking to rephrase, translate, simplify
- NEW_QUESTION: a genuinely different horary question needing a new chart
- UNKNOWN: cannot determine, treat as elaboration

Rules:
- If the message introduces a new subject, person, or life domain not in the locked question → NEW_QUESTION
- If the message is short and contextually tied to the verdict → ELABORATION type
- Multilingual: user may write in English, Urdu, Hindi, or mixed
- When in doubt → UNKNOWN, never force NEW_QUESTION

Respond with raw JSON only:
{"class": "TIMING", "confidence": "HIGH", "reason": "user asked kitne din"}`;

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
          max_tokens: 60,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        return { class: 'UNKNOWN', confidence: 'LOW', reason: 'classifier HTTP error' };
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.find(b => b.type === 'text')?.text ?? '{}';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as {
        class?: string;
        confidence?: string;
        reason?: string;
      };

      const cls = VALID_INTENT_CLASSES.includes(parsed.class as IntentClass)
        ? (parsed.class as IntentClass)
        : 'UNKNOWN';

      return {
        class: cls,
        confidence: parsed.confidence === 'HIGH' ? 'HIGH' : 'LOW',
        reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      };
    } catch {
      clearTimeout(timer);
      return { class: 'UNKNOWN', confidence: 'LOW', reason: 'classifier failed' };
    }
  },
);
