/**
 * useIntentClassifier — Claude Haiku pre-pass for follow-up intent detection.
 *
 * Replaces basic string matching with LLM classification to catch:
 * - New questions disguised as follow-ups (verdict integrity protection)
 * - Multilingual intent (Urdu/Hindi/English mixed)
 * - Contextual routing (TIMING/REMEDY/CLARIFY/REFORMAT)
 *
 * Classification runs server-side via the classifyIntent Cloud Function.
 */

import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';

type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};

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

export async function classifyIntent(params: ClassifyParams): Promise<IntentResult> {
  const { userMessage, lockedQuestion, verdictDirection, recentMessages } = params;

  try {
    const fn = (functions() as FunctionsWithRegion)
      .region('asia-south1')
      .httpsCallable<ClassifyParams, IntentResult>('classifyIntent');

    const result = await fn({
      userMessage,
      lockedQuestion,
      verdictDirection,
      recentMessages: recentMessages.slice(0, 3),
    });

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
