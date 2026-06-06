/**
 * useQuestionGate — Layer 1 pre-submission classifier.
 *
 * Fires BEFORE consumeOne(). Classifies the user's raw input into:
 *   VALID_HORARY   — sincere question → proceed to engine
 *   CONVERSATIONAL — greetings / test / small talk → soft redirect, no quota burn
 *   AMBIGUOUS      — genuine intent but too vague → prompt to elaborate, no quota burn
 *
 * Edge cases:
 *   - API failure / timeout → VALID_HORARY (never block a real question on a network hiccup)
 *   - 500+ char input       → VALID_HORARY (no one writes 500 chars to test)
 *   - No ANTHROPIC_API_KEY  → VALID_HORARY with console warning
 */

const GATE_SYSTEM_PROMPT = `You are a gate for a sacred Islamic horary oracle.
Classify the user's input into exactly one of three categories:
VALID_HORARY, CONVERSATIONAL, or AMBIGUOUS.

VALID_HORARY: A sincere question about a real life matter that has a yes/no or will/won't answer. Examples: travel, health, relationships, business decisions, property, marriage, employment.

CONVERSATIONAL: Greetings, test phrases, expressions of gratitude, questions about the app itself, small talk. Examples: "hello", "test", "thank you", "how does this work", "bismillah", "okay".

AMBIGUOUS: Has genuine intent but is too vague to cast a meaningful horary chart. Missing a subject, an outcome, or a timeframe. Examples: "should I?", "will it happen?", "is it good?"

Respond with ONLY the classification word. No explanation. No punctuation. No other text.`;

export type QuestionClass = 'VALID_HORARY' | 'CONVERSATIONAL' | 'AMBIGUOUS';

const VALID_CLASSES: readonly QuestionClass[] = ['VALID_HORARY', 'CONVERSATIONAL', 'AMBIGUOUS'];

export async function classifyQuestion(text: string): Promise<QuestionClass> {
  // 500+ chars → skip classification, genuine question
  if (text.length > 500) {
    return 'VALID_HORARY';
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    console.warn('[QuestionGate] ANTHROPIC_API_KEY absent — defaulting to VALID_HORARY');
    return 'VALID_HORARY';
  }

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
        max_tokens: 10,
        system: GATE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return 'VALID_HORARY';
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const raw = data.content?.find(b => b.type === 'text')?.text?.trim() ?? '';
    const cls = raw.toUpperCase() as QuestionClass;

    return VALID_CLASSES.includes(cls) ? cls : 'VALID_HORARY';
  } catch {
    clearTimeout(timer);
    return 'VALID_HORARY';
  }
}
