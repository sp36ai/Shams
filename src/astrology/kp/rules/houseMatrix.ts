/**
 * ════════════════════════════════════════════════════════════════════
 * RKP House Matrix — Question Type → Favorable / Denial Houses
 * ════════════════════════════════════════════════════════════════════
 *
 * Source of truth: docs/RKP_RULES_FROM_SARFARAZ.md §1
 * Provided by: Astro Sarfaraz (project owner) during Phase 1 intake.
 *
 * USED BY:  Phase 3 engine — src/astrology/kp/judgment/judgeHorary.ts
 *
 * EDIT POLICY:
 *   This file is a faithful transcription of the owner-provided rules.
 *   DO NOT modify values without owner sign-off. Any change here changes
 *   the verdict for every reading the engine produces.
 *
 * ════════════════════════════════════════════════════════════════════
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

export interface HouseMatrixEntry {
  /** Houses whose involvement strengthens the YES verdict. */
  readonly favorable: readonly number[];
  /** Houses whose involvement strengthens the NO verdict. */
  readonly denial: readonly number[];
  /** The single reference house for the matter — kept for context and traceability. */
  readonly primary: number;
  /** Supporting houses that reinforce the matter context. */
  readonly secondary: readonly number[];
}

export const HOUSE_MATRIX: Readonly<Record<QuestionType, HouseMatrixEntry>> = Object.freeze({
  career: { favorable: [6, 10, 11], denial: [5, 8, 12], primary: 10, secondary: [6, 11] },
  marriage: { favorable: [7, 11, 2], denial: [6, 8, 12], primary: 7, secondary: [2, 11] },
  finance: { favorable: [2, 6, 11], denial: [8, 12], primary: 2, secondary: [6, 11] },
  health: { favorable: [1, 5, 11], denial: [6, 8, 12], primary: 1, secondary: [5, 11] },
  property: { favorable: [4, 11, 2], denial: [8, 12], primary: 4, secondary: [11, 2] },
  travel: { favorable: [3, 9, 12], denial: [], primary: 9, secondary: [3, 12] },
  legal: { favorable: [6, 11], denial: [8, 12], primary: 6, secondary: [11] },
  education: { favorable: [4, 9, 11], denial: [8, 12], primary: 4, secondary: [9, 11] },
  business: { favorable: [7, 10, 11], denial: [6, 8, 12], primary: 7, secondary: [10, 11] },
  children: { favorable: [2, 5, 11], denial: [1, 4, 10], primary: 5, secondary: [2, 11] },
  lostitem: { favorable: [2, 4, 11], denial: [8, 12], primary: 2, secondary: [4, 11] },
  enemies: { favorable: [6, 11], denial: [8, 12], primary: 6, secondary: [11] },
  spiritual: { favorable: [5, 9, 12], denial: [6, 8], primary: 9, secondary: [5, 12] },
  general: { favorable: [1, 11], denial: [8, 12], primary: 1, secondary: [11] },
}) as Readonly<Record<QuestionType, HouseMatrixEntry>>;

/** All 14 supported question types, in declaration order. */
export const ALL_QUESTION_TYPES: readonly QuestionType[] = Object.keys(
  HOUSE_MATRIX,
) as QuestionType[];

/**
 * Type guard — narrows an arbitrary string to QuestionType if valid.
 */
export function isQuestionType(value: string): value is QuestionType {
  return value in HOUSE_MATRIX;
}
