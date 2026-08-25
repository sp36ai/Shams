/**
 * useQuestionGate — Layer 1 pre-submission classifier.
 *
 * Fires BEFORE consumeOne(). Classifies the user's raw input into:
 *   VALID_HORARY   — sincere question → proceed to engine
 *   CONVERSATIONAL — greetings / test / small talk → soft redirect, no quota burn
 *   AMBIGUOUS      — genuine intent but too vague → prompt to elaborate, no quota burn
 *
 * Edge cases:
 *   - Cloud Function failure / timeout → VALID_HORARY (never block a real question)
 *   - 500+ char input                 → VALID_HORARY (no one writes 500 chars to test)
 *
 * This runs before sendMessage() ever sets `sending` true or adds the user's
 * message bubble — so a hang here (not a rejection; the native callable call
 * itself never settling, the same class of bug withTimeout() exists for) is
 * the worst kind: no spinner, no bubble, no error, Send silently dead for the
 * rest of the sitting. `try/catch` alone only guards the reject case; the
 * call itself must be raced against a timer.
 */

import { regionalFunctions } from '../firebase/functionsRegion';
import { withTimeout } from '../utils/withTimeout';

export type QuestionClass = 'VALID_HORARY' | 'CONVERSATIONAL' | 'AMBIGUOUS';

const VALID_CLASSES: readonly QuestionClass[] = ['VALID_HORARY', 'CONVERSATIONAL', 'AMBIGUOUS'];

/** Generous relative to typical Haiku-classifier latency (a few seconds),
 *  well under the Cloud Function's own 60s server-side cap — this only
 *  exists to catch a native call that never settles at all. */
const CLASSIFY_TIMEOUT_MS = 20000;

export async function classifyQuestion(text: string): Promise<QuestionClass> {
  // 500+ chars → skip classification, genuine question
  if (text.length > 500) {
    return 'VALID_HORARY';
  }

  try {
    const fn = regionalFunctions().httpsCallable<{ text: string }, { class: QuestionClass }>(
      'classifyQuestion',
    );

    const result = await withTimeout(fn({ text }), CLASSIFY_TIMEOUT_MS);
    const cls = result?.data?.class;

    return cls !== undefined && VALID_CLASSES.includes(cls) ? cls : 'VALID_HORARY';
  } catch {
    return 'VALID_HORARY';
  }
}
