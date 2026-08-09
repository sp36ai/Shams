/**
 * Question topics — the app's shared subject vocabulary.
 * --------------------------------------------------------------------------
 * NEUTRAL GROUND, ON PURPOSE.
 *
 * This is the list of subjects a seeker can ask about. It is not astrology:
 * it carries no houses, no planets and no judgment. It is the vocabulary the
 * app files readings under, and it is shared by every part of the product —
 * the RKP engine, the KP engine, the readings store and history filters.
 *
 * It lives outside both engine folders so that neither engine has to import
 * the other to know what a question is about. The two engines are independent
 * calculation systems and must stay that way; sharing a word list is not a
 * combination of engines, but sharing house rules would be — those belong to
 * each engine separately (see rkp/houseRouting.ts and kp/rules/houseMatrix.ts).
 */

export type QuestionType =
  | 'career'
  | 'marriage'
  | 'finance'
  | 'health'
  | 'property'
  | 'travel'
  | 'legal'
  | 'education'
  | 'business'
  | 'children'
  | 'lostitem'
  | 'enemies'
  | 'spiritual'
  | 'general';

/** All 14 topics, in declaration order. */
export const ALL_QUESTION_TYPES: readonly QuestionType[] = Object.freeze([
  'career',
  'marriage',
  'finance',
  'health',
  'property',
  'travel',
  'legal',
  'education',
  'business',
  'children',
  'lostitem',
  'enemies',
  'spiritual',
  'general',
] as const);

/** Type guard — narrows an arbitrary string to a QuestionType. */
export function isQuestionType(value: string): value is QuestionType {
  return (ALL_QUESTION_TYPES as readonly string[]).includes(value);
}
