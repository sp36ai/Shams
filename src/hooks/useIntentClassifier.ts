/**
 * useIntentClassifier — Claude Haiku pre-pass for follow-up intent detection.
 *
 * Replaces basic string matching with LLM classification to catch:
 * - New questions disguised as follow-ups (verdict integrity protection)
 * - Multilingual intent (Urdu/Hindi/English mixed)
 * - Contextual routing (TIMING/REMEDY/CLARIFY/REFORMAT)
 *
 * Classification runs server-side via the classifyIntent Cloud Function.
 *
 * The call is raced against a timeout, not just wrapped in try/catch: a
 * native callable invocation can hang instead of rejecting (same class of
 * bug withTimeout() exists for), and this runs inside sendMessage()'s
 * follow-up path before the guard/finally structure there gets a chance to
 * recover — an unbounded await here reproduces the exact silent Send-jam
 * bug fixed elsewhere in this app, just at a different call site.
 */

import { regionalFunctions } from '../firebase/functionsRegion';
import { withTimeout } from '../utils/withTimeout';
import { ensureAppCheckReady } from '../firebase/appCheck';

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
}

const VALID_INTENT_CLASSES: IntentClass[] = [
  'TIMING',
  'REMEDY',
  'CLARIFY',
  'REFORMAT',
  'NEW_QUESTION',
  'UNKNOWN',
];

/** See CLASSIFY_TIMEOUT_MS in useQuestionGate.ts — same reasoning. */
const CLASSIFY_INTENT_TIMEOUT_MS = 20000;

/** See the matching constant + comment in useQuestionGate.ts. Lower-risk
 *  here — a follow-up implies askWatchOracle already succeeded once this
 *  sitting, so App Check is normally already warm — but applied for the
 *  same defense-in-depth reasoning after a background/resume or deep link. */
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

export async function classifyIntent(params: ClassifyParams): Promise<IntentResult> {
  const { userMessage, lockedQuestion, verdictDirection, recentMessages } = params;

  try {
    await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

    const fn = regionalFunctions().httpsCallable<ClassifyParams, IntentResult>('classifyIntent');

    const result = await withTimeout(
      fn({
        userMessage,
        lockedQuestion,
        verdictDirection,
        recentMessages: recentMessages.slice(0, 3),
      }),
      CLASSIFY_INTENT_TIMEOUT_MS,
    );

    if (result === undefined) {
      return { class: 'UNKNOWN', confidence: 'LOW', reason: 'classifier timed out' };
    }

    const data = result.data;
    const cls = VALID_INTENT_CLASSES.includes(data?.class as IntentClass)
      ? (data.class as IntentClass)
      : 'UNKNOWN';

    return {
      class: cls,
      confidence: data?.confidence === 'HIGH' ? 'HIGH' : 'LOW',
      reason: typeof data?.reason === 'string' ? data.reason : '',
    };
  } catch (err) {
    return {
      class: 'UNKNOWN',
      confidence: 'LOW',
      reason: `classifier failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
