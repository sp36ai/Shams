/**
 * WatchVerdict types — the "RKP Watch of Currents" output contract.
 * --------------------------------------------------------------------------
 * Output of judgeRKPWatch.ts — the clock-based RKP engine. Distinct from
 * both `Verdict` (the older sub-lord-scoring RKP, verdict.ts) and
 * `KPVerdict` (classical KP, kpVerdict.ts): this engine's "activated house"
 * comes from the minute-of-hour watch chart, not from Placidus cusps.
 */

import type { Chart, HouseIndex, Planet, SignIndex } from './chart';
import type { ClassifiedQuestion, QuestionType } from './question';
import type {
  ReasoningStep,
  VerdictKind,
  VerdictTiming,
  VerdictNarration,
  VerdictRemedy,
} from './verdict';
import type { VastuDirection, WatchChart } from '../primitives/watchChart';
import type { TriadAnalysis } from '../kp/judgment/rkpTriad';
import type { RKPConditionState } from '../kp/judgment/rkpConditionState';
import type { RKPMaterialRemedy } from '../kp/judgment/rkpRemedy';

export type { VastuDirection };

/**
 * The richer native verdict states from the RKP watch-current source
 * material — collapsed onto the shared `VerdictKind` for interop
 * (see judgeRKPWatch.ts's NATIVE_TO_VERDICT_KIND mapping) but exposed here
 * in full for anything that wants the finer distinction.
 */
export type WatchVerdictState =
  | 'YES_STRONG'
  | 'YES_CONDITIONAL'
  | 'DELAY'
  | 'WAIT'
  | 'NO_DENIED'
  | 'INCONCLUSIVE';

export type SupportDirection = 'supported' | 'obstructed' | 'mixed';

export interface HouseLordAnalysis {
  readonly house: HouseIndex;
  readonly sign: SignIndex;
  /** Physical direction currently associated with this house — see watchChart.ts's SIGN_DIRECTIONS. */
  readonly direction: VastuDirection;
  readonly lord: Planet;
  /** Which clock-house the lord itself is currently placed in. */
  readonly lordHouse: HouseIndex;
  readonly dignity: 'exalted' | 'own' | 'debilitated' | 'neutral';
  readonly conjunctSupport: readonly Planet[];
  readonly conjunctObstruction: readonly Planet[];
  readonly aspectSupport: readonly Planet[];
  readonly aspectObstruction: readonly Planet[];
  readonly retrograde: boolean;
  readonly combust: boolean;
  /** Net tally behind `verdict` — positive supports, negative obstructs. */
  readonly supportScore: number;
  readonly verdict: SupportDirection;
}

export interface MoonConfirmation {
  readonly subLord: Planet;
  readonly subLordClockHouse: HouseIndex;
  readonly agreement: 'agrees' | 'disagrees' | 'neutral';
}

export interface RulingConfirmation {
  readonly dayLord: Planet;
  readonly ascSignLord: Planet;
  readonly moonSignLord: Planet;
  readonly moonStarLord: Planet;
  /** Ruling witnesses whose clock-house is favorable for the question. */
  readonly favorableWitnesses: readonly Planet[];
  /** Ruling witnesses whose clock-house is a denial house for the question. */
  readonly denialWitnesses: readonly Planet[];
}

/**
 * Household Vastu scan — where the 9 grahas currently sit, by physical
 * direction, independent of any specific question. Structured fact only
 * (no remedy text — that's the presentation layer's job, per the source
 * material's own separation rule).
 */
export interface VastuScan {
  /** Every planet currently transiting a sign mapped to each direction. */
  readonly occupantsByDirection: Readonly<Record<VastuDirection, readonly Planet[]>>;
  /** Directions currently holding at least one natural malefic (Sun/Mars/Saturn/Rahu/Ketu). */
  readonly afflictedDirections: readonly VastuDirection[];
}

/**
 * Confidence breakdown — the 5 factors of the source material's 7-factor,
 * 50-point-base confidence model this engine can currently support (Multi-
 * Cusp Agreement and Chart Cleanliness/Void-of-Course are part of the
 * documented model but not yet implemented here — see judgeRKPWatch.ts
 * module docstring — and score 0/neutral rather than being fabricated).
 */
export interface ConfidenceFactors {
  readonly subLordClarity: number;
  readonly moonAgreement: number;
  readonly rulingOverlap: number;
  readonly retrogradeAffliction: number;
  readonly timestampPrecision: number;
  /**
   * Penalty for a chart whose own parts disagree — "if the AI detects
   * conflicting aspects (e.g. Jupiter blessing a house, but Saturn
   * aspecting the ruler), it automatically downgrades the confidence
   * level, alerting the user to hidden variables" (source material).
   * -10 per conflict detected.
   */
  readonly triadConflict: number;
  /** Human-readable list of the conflicts behind `triadConflict`. */
  readonly conflictNotes: readonly string[];
}

export interface WatchVerdict {
  readonly id: string;
  readonly computedAt: string;
  readonly question: ClassifiedQuestion;
  readonly qType: QuestionType;
  readonly chart: Chart;

  readonly watch: WatchChart;
  readonly favorableHouses: readonly HouseIndex[];
  readonly denialHouses: readonly HouseIndex[];
  readonly primaryHouse: HouseIndex;

  /**
   * The target house's lord condition. Identical to `triad.target` — kept as
   * a top-level field because it predates the triad protocol and the rest of
   * the app reads it.
   */
  readonly houseLord: HouseLordAnalysis;
  /**
   * The RKP Verdict Triad: 1st house (querent) / target house (the query) /
   * 11th house (fulfilment), plus the ruler friendship clash and the actor
   * polarity profiles. This is what now drives `nativeState`.
   */
  readonly triad: TriadAnalysis;
  readonly moonConfirmation: MoonConfirmation;
  readonly rulingConfirmation: RulingConfirmation;
  readonly vastu: VastuScan;
  /**
   * RKP's own material remedies (clock advance, corner clearance, planetary
   * action window). Structured facts only — see rkpRemedy.ts on how these
   * relate to the spiritual `remedy` field below.
   */
  readonly materialRemedy: RKPMaterialRemedy;

  readonly verdict: VerdictKind;
  /** What to TELL the seeker — drives the UI and the oracle's heading. */
  readonly nativeState: WatchVerdictState;
  /**
   * What MECHANISM the matter is in — Siddhi / Stambhana / Gati / Vakra /
   * Kshaya / Bija. A parallel diagnostic classification, not a replacement
   * for `nativeState`; see rkpConditionState.ts.
   */
  readonly conditionState: RKPConditionState;

  /** 0-100, base-50 model — see ConfidenceFactors docstring for what's supported. */
  readonly confidence: number;
  readonly confidenceFactors: ConfidenceFactors;
  readonly narration: VerdictNarration;
  /** Remedy planet = the activated house's lord (the decisive planet in this engine). */
  readonly remedy?: VerdictRemedy;

  readonly reasoning: readonly ReasoningStep[];
  readonly timing?: VerdictTiming;

  readonly retrogradeFlags: readonly Planet[];
  readonly combustFlags: readonly Planet[];
  readonly engineVersion: string;
}
