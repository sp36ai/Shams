/**
 * useIntentClassifier — Claude Haiku pre-pass for follow-up intent detection.
 *
 * Replaces basic string matching with LLM classification to catch:
 * - New questions disguised as follow-ups (verdict integrity protection)
 * - Multilingual intent (Urdu/Hindi/English mixed)
 * - Contextual routing (TIMING/REMEDY/CLARIFY/REFORMAT)
 *
 * Uses Haiku for speed (~300ms) and cost efficiency.
 */

export type IntentClass =
  | 'TIMING' // "when", "kitne din", "how long"
  | 'REMEDY' // "kya karun", "what should I do", "remedy"
  | 'CLARIFY' // "why", "explain", "samjhao"
  | 'REFORMAT' // "say it differently", "in Urdu", "shorter"
  | 'NEW_QUESTION' // entirely new horary question
  | 'UNKNOWN'; // genuine ambiguity — treat as ELABORATION

export interface IntentResult {
  class: IntentClass;
  confidence: 'HIGH' | 'LOW';
  reason: string; // internal only, never shown to user
}

interface ClassifyParams {
  userMessage: string;
  lockedQuestion: string;
  verdictDirection: string;
  recentMessages: string[]; // last 3 messages for context
  apiKey: string;
}

export async function classifyIntent(params: ClassifyParams): Promise<IntentResult> {
  const { userMessage, lockedQuestion, verdictDirection, recentMessages, apiKey } = params;

  const verdictBinary =
    verdictDirection === 'YES' || verdictDirection === 'CONDITIONAL' ? 'CONFIRMED' : 'DENIED';

  const systemPrompt = `
You are an intent classifier for a horary oracle app.
A user has received a verdict for a specific horary question.
They are now sending a follow-up message in the same thread.

Your job: classify whether this message is a follow-up about the SAME reading,
or a NEW horary question that requires a fresh chart.

The locked question is: "${lockedQuestion}"
The verdict was: ${verdictBinary}
Recent thread (last 3 messages): ${recentMessages.slice(-3).join(' | ')}

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
{"class": "TIMING", "confidence": "HIGH", "reason": "user asked kitne din"}
  `.trim();

  const timeoutMs = 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // fast + cheap for classification
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

    const validClasses: IntentClass[] = [
      'TIMING',
      'REMEDY',
      'CLARIFY',
      'REFORMAT',
      'NEW_QUESTION',
      'UNKNOWN',
    ];
    const cls = validClasses.includes(parsed.class as IntentClass)
      ? (parsed.class as IntentClass)
      : 'UNKNOWN';

    return {
      class: cls,
      confidence: parsed.confidence === 'HIGH' ? 'HIGH' : 'LOW',
      reason: parsed.reason ?? '',
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      class: 'UNKNOWN',
      confidence: 'LOW',
      reason: `classifier failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
