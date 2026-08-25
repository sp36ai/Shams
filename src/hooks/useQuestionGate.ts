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
import { ensureAppCheckReady } from '../firebase/appCheck';

export type QuestionClass = 'VALID_HORARY' | 'CONVERSATIONAL' | 'AMBIGUOUS';

const VALID_CLASSES: readonly QuestionClass[] = ['VALID_HORARY', 'CONVERSATIONAL', 'AMBIGUOUS'];

/** Generous relative to typical Haiku-classifier latency (a few seconds),
 *  well under the Cloud Function's own 60s server-side cap — this only
 *  exists to catch a native call that never settles at all. */
const CLASSIFY_TIMEOUT_MS = 20000;

/**
 * This is the FIRST network call sendMessage() makes — on a fast cold start
 * into an already-authenticated session, it can fire before Play Integrity's
 * first App Check token exchange has completed (Auth's token is typically
 * already cached; App Check's is not). A confirmed real-device Crashlytics
 * trace showed exactly this: signedIn=true, idToken=ok, App Check
 * FAILED: empty/undefined — not a rejected token, an absent one. Give it a
 * bounded head start rather than assume a header is already attached; the
 * fallback below already treats any failure as VALID_HORARY, so this never
 * blocks a real question, it just narrows the window where App Check hasn't
 * caught up yet.
 */
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

export async function classifyQuestion(text: string): Promise<QuestionClass> {
  // 500+ chars → skip classification, genuine question
  if (text.length > 500) {
    return 'VALID_HORARY';
  }

  try {
    await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

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
