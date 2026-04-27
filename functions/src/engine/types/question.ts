/**
 * Question types — Shams al-Asrār
 * --------------------------------------------------------------------------
 * The user types a free-form question; the question classifier maps it to
 * a `QuestionType` defined in src/astrology/kp/rules/houseMatrix.ts. The
 * intermediate shape and inputs to the engine live here.
 */

import type { GeoLocation } from './chart';
import type { LangCode } from '../../shims/i18nTypes';

/**
 * Re-export of the canonical QuestionType from the rules module. Defined
 * there because rules tables key on it; re-exported here so consumers
 * outside the rules module don't reach across module boundaries.
 *
 * The 14 RKP-supported categories (see houseMatrix.ts for the full table):
 *   marriage, love, child, education, career, job, business, finance,
 *   property, vehicle, health, travel, litigation, foreign
 */
export type { QuestionType } from '../kp/rules/houseMatrix';

import type { QuestionType } from '../kp/rules/houseMatrix';

/** What the user types into the Oracle screen — pre-classification. */
export interface RawQuestion {
  /** The exact text typed by the user. Stored verbatim for audit. */
  readonly text: string;

  /** Language the question was typed in (used by classifier and narration). */
  readonly lang: LangCode;
}

/**
 * Question after classification — engine input.
 *
 * The classifier may produce a SINGLE deterministic type or DECLINE to
 * classify (returns null). The engine refuses ambiguous classifications;
 * the UI surfaces a "please rephrase" prompt rather than guessing.
 */
export interface ClassifiedQuestion extends RawQuestion {
  readonly qType: QuestionType;

  /**
   * Confidence of the classification, [0, 1]. Below 0.6 the engine declines
   * to judge and asks the user to rephrase. RKP rule: never judge a question
   * whose category is uncertain.
   */
  readonly confidence: number;

  /**
   * Keywords from the user's text that drove the classification. Used in
   * the verdict's reasoning trace so the user can see WHY the engine chose
   * that category (and rephrase if it picked wrong).
   */
  readonly matchedKeywords: readonly string[];
}

/**
 * Complete engine input — what `judge(...)` accepts.
 *
 * Three inputs combine to produce a deterministic verdict:
 *   1. The classified question (matter category)
 *   2. The exact moment of asking (sets the chart)
 *   3. The geographic location of asking (sets cusps)
 *
 * Same triple → same chart → same verdict. Always.
 */
export interface EngineInput {
  readonly question: ClassifiedQuestion;

  /** ISO 8601 UTC timestamp of the moment the user pressed "Ask". */
  readonly momentUtc: string;

  /** Location of the questioner. */
  readonly location: GeoLocation;
}
