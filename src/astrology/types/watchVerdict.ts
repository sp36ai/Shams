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
import type { ReasoningStep, VerdictKind, VerdictTiming } from './verdict';
import type { VastuDirection, WatchChart } from '../primitives/watchChart';

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

  readonly houseLord: HouseLordAnalysis;
  readonly moonConfirmation: MoonConfirmation;
  readonly rulingConfirmation: RulingConfirmation;
  readonly vastu: VastuScan;

  readonly verdict: VerdictKind;
  readonly nativeState: WatchVerdictState;

  readonly reasoning: readonly ReasoningStep[];
  readonly timing?: VerdictTiming;

  readonly retrogradeFlags: readonly Planet[];
  readonly combustFlags: readonly Planet[];
  readonly engineVersion: string;
}
