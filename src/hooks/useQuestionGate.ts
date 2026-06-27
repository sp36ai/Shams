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
 */

import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';

type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};

export type QuestionClass = 'VALID_HORARY' | 'CONVERSATIONAL' | 'AMBIGUOUS';

const VALID_CLASSES: readonly QuestionClass[] = ['VALID_HORARY', 'CONVERSATIONAL', 'AMBIGUOUS'];

export async function classifyQuestion(text: string): Promise<QuestionClass> {
  // 500+ chars → skip classification, genuine question
  if (text.length > 500) {
    return 'VALID_HORARY';
  }

  try {
    const fn = (functions() as FunctionsWithRegion)
      .region('asia-south1')
      .httpsCallable<{ text: string }, { class: QuestionClass }>('classifyQuestion');

    const result = await fn({ text });
    const cls = result.data?.class;

    return VALID_CLASSES.includes(cls) ? cls : 'VALID_HORARY';
  } catch {
    return 'VALID_HORARY';
  }
}
