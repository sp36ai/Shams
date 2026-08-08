/**
 * KPVerdict types — Shams al-Asrār
 * --------------------------------------------------------------------------
 * The OUTPUT contract of the CLASSICAL KP judgment layer (judgeKP.ts).
 *
 * This is intentionally a SEPARATE shape from `Verdict` (verdict.ts, the RKP
 * output contract). KP and RKP are two different judgment systems living
 * side by side in this engine — see docs/RKP_KP_FORENSIC_AUDIT.md — and they
 * must not be collapsed into one "verdict" type just because they both judge
 * the same chart. Notable differences from RKP's `Verdict`:
 *
 *   - No numeric `confidence` percentage. Classical KP does not score;
 *     `strength` is a qualitative read of the significator majority.
 *   - No `remedy` or `narration` — those are RKP/product-layer additions.
 *   - No `horaryNumber` / `horarySubLord` witness — RKP-only addition.
 *   - Only 5 classical ruling-planet witnesses (Hora Lord excluded — it is
 *     the RKP engine's 6th "confirmatory" witness per
 *     docs/RKP_RULES_FROM_SARFARAZ.md §4, not part of classical KP).
 */

import type { Chart, HouseIndex, Planet } from './chart';
import type { ClassifiedQuestion, QuestionType } from './question';
import type { SignificatorSets } from '../kp/judgment/significators';
import type { ReasoningStep, VerdictTiming } from './verdict';

/**
 * Classical KP has no "UNCLEAR" or "DELAYED-by-scoring-threshold" states —
 * those are RKP/product concepts. DENIED is the hard promise-layer stop;
 * DELAYED is the one retrograde modifier classical KP does recognize.
 */
export type KPVerdictKind = 'YES' | 'NO' | 'CONDITIONAL' | 'DELAYED' | 'DENIED';

/**
 * Qualitative read of the significator majority. NOT a numeric confidence
 * score — see module docstring. `none` only occurs on DENIED (promise
 * layer failed before fructification ran).
 */
export type KPStrength = 'strong' | 'moderate' | 'mixed' | 'none';

/** Layer 2 — Promise check result for the question's primary house. */
export interface KPPromiseCheck {
  readonly house: HouseIndex;
  readonly cuspSubLord: Planet;
  readonly cuspSubLordHouse: HouseIndex;
  /** True iff the cusp sub-lord is itself a favorable significator. */
  readonly promised: boolean;
}

/**
 * The 5 classical KP ruling-planet witnesses (Hora Lord deliberately
 * excluded — see module docstring).
 */
export interface KPRulingPlanets {
  readonly dayLord: Planet;
  readonly ascSignLord: Planet;
  readonly ascStarLord: Planet;
  readonly moonSignLord: Planet;
  readonly moonStarLord: Planet;
}

export interface KPVerdict {
  readonly id: string;
  readonly computedAt: string;
  readonly question: ClassifiedQuestion;
  readonly qType: QuestionType;
  readonly chart: Chart;

  readonly favorableHouses: readonly HouseIndex[];
  readonly denialHouses: readonly HouseIndex[];

  readonly promise: KPPromiseCheck;

  /** 4-tier KP significator sets for the question (favorable/denial/neutral). */
  readonly significators: SignificatorSets;

  readonly rulingPlanets: KPRulingPlanets;

  /** Favorable significators confirmed by a ruling-planet witness. */
  readonly confirmedSignificators: readonly Planet[];

  /** Denial significators confirmed by a ruling-planet witness. */
  readonly deniedSignificators: readonly Planet[];

  readonly verdict: KPVerdictKind;
  readonly strength: KPStrength;

  readonly stage: 'promise_failed' | 'fructification';

  readonly reasoning: readonly ReasoningStep[];

  /** Absent for DENIED — timing is meaningless before promise is established. */
  readonly timing?: VerdictTiming;

  readonly retrogradeFlags: readonly Planet[];
  readonly combustFlags: readonly Planet[];

  readonly engineVersion: string;
}
