/**
 * Shamsi Logic House Matrix — Horary Question Type Mappings
 * 
 * Distinguishes between similar but astrologically distinct inquiries:
 * - Employment (6th): "Will I get hired?" (service, subordination)
 * - Career (10th): "Will I get promoted?" (authority, public status)
 * etc.
 */

import type { HouseIndex } from '../types/chart';

export type ShamsiQuestionType = 
  | 'employment'
  | 'career'
  | 'lawsuit'
  | 'marriage'
  | 'property'
  | 'relocation';

export interface HouseMapping {
  primary: HouseIndex;
  secondary: readonly HouseIndex[];
  negating?: readonly HouseIndex[];
}

export const SHAMSI_HOUSE_MATRIX: Record<ShamsiQuestionType, HouseMapping> = {
  /**
   * Employment: "Will I get hired?", "Will I pass this interview?"
   * 6th house = service, subordination, daily work
   */
  employment: {
    primary: 6,
    secondary: [2, 10, 11],
    negating: [5], // 5th = compromise, rejection
  },

  /**
   * Career: "Will I get promoted?", "Will I achieve this milestone?"
   * 10th house = authority, public status, executive power
   */
  career: {
    primary: 10,
    secondary: [2, 6, 11],
    negating: [6], // 6th = service falls away, not ascension
  },

  /**
   * Lawsuit: "Will I win this case?"
   * 6th = legal matters, but 11th = gain/favorable judgment
   */
  lawsuit: {
    primary: 6,
    secondary: [11],
    negating: [5, 12], // 5 = compromise, 12 = loss/foreign judgment
  },

  /**
   * Marriage: "Will this marriage happen?"
   * 7th house = spouse, partnership
   */
  marriage: {
    primary: 7,
    secondary: [2, 11],
    negating: [1, 6, 10], // 1 = self separation, 6 = conflict, 10 = status obstacle
  },

  /**
   * Property: "Will I buy/sell this house?"
   * 4th house = real estate, home, immovables
   */
  property: {
    primary: 4,
    secondary: [11, 12],
    negating: [3], // 3 = short journey, leaving (opposite of settling)
  },

  /**
   * Relocation: "Will I settle abroad permanently?"
   * 12th house = foreign lands, distant places
   */
  relocation: {
    primary: 12,
    secondary: [3, 9],
    negating: [2, 4, 11], // 2 = financial ties to home, 4 = home itself, 11 = return of desires
  },
};

/**
 * Get house mapping for a question type.
 * Throws if question type is unrecognized.
 */
export function getShamsiHouseMapping(questionType: ShamsiQuestionType): HouseMapping {
  const mapping = SHAMSI_HOUSE_MATRIX[questionType];
  if (!mapping) {
    throw new Error(`shamsiHouseMatrix: unknown question type "${questionType}"`);
  }
  return mapping;
}

/**
 * Infer negating house if not explicitly defined.
 * Standard rule: N = P - 1 (wrapping 1 → 12)
 */
export function getNegatingHouse(primary: HouseIndex): HouseIndex {
  return (primary === 1 ? 12 : primary - 1) as HouseIndex;
}
