/**
 * RKP watch judgment — the verdict layer over the watch chart.
 * --------------------------------------------------------------------------
 * Routing uses the owner's existing house matrix (`kp/rules/houseMatrix.ts`,
 * sourced from docs/RKP_RULES_FROM_SARFARAZ.md) rather than a parallel intent
 * table: that matrix already carries primary / favorable / denial houses per
 * question type, which is strictly richer than a flat intent→house map, and
 * keeping one copy means the owner's rules stay the single source of truth.
 *
 * The judgment is a deterministic weighted reading, not a black box. Every
 * contribution is recorded in `factors`, so narration speaks from actual chart
 * facts and a reading can be audited after the event.
 *
 * Deliberately free of Sanskrit vocabulary: verdict states are plain English,
 * and cosmic markers use the classical Arabic/Urdu names from nomenclature.ts.
 */

import { HOUSE_MATRIX, type QuestionType } from '@astrology/kp/rules/houseMatrix';
import type { Planet } from '@astrology/types/chart';

import { SIGN_META, type Direction, type HouseNumber } from './nomenclature';
import { isBenefic, isMalefic, isStrong, isWeak, relationBetween, type Relation } from './rules';
import { houseOf, type WatchChart } from './watchChart';

/* -------------------------------------------------------------------------- */
/*  Result types                                                              */
/* -------------------------------------------------------------------------- */

/** The six settled conditions a matter can be in. */
export type WatchState =
  /** Clean support across ruler, aspect and fulfilment. The matter completes. */
  | 'FULFILLED'
  /** Active progression, not yet complete. */
  | 'MOVING'
  /** It will happen, but the timeline is stretched — typically Zuhal's work. */
  | 'DELAYED'
  /** Structural block: malefic weight with no benefic relief. */
  | 'BLOCKED'
  /** A ruling planet is retrograde — expect rework, reversal, or an overturn. */
  | 'REVERSING'
  /** The question is genuine but the chart has not settled. */
  | 'UNFORMED';

export type Confidence = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNCERTAIN';

/** First obstructing agent, in strict precedence order. */
export type Obstruction = Planet | 'MoonDisagreement' | 'None';

export interface TimingWindow {
  readonly minDays: number;
  readonly maxDays: number;
}

export interface WatchVerdict {
  readonly qType: QuestionType;

  readonly targetHouse: HouseNumber;
  readonly targetSignName: string;
  readonly targetRuler: Planet;
  readonly targetRulerName: string;

  /** The 11th Ghar governs whether a desire actually materialises. */
  readonly fulfilmentHouse: HouseNumber;

  readonly lagnaRuler: Planet;
  /** How the querent's ruler regards the ruler of the matter. */
  readonly rulerRelation: Relation;

  readonly state: WatchState;
  readonly confidence: Confidence;
  /** Net weighted score. Positive favours the matter. Exposed for auditing. */
  readonly score: number;

  readonly obstruction: Obstruction;
  readonly reversal: 'POSSIBLE' | 'NONE';

  /** Null when the chart gives no usable timing signal. */
  readonly timing: TimingWindow | null;

  /** Compass direction of the target Ghar. */
  readonly direction: Direction;
  /** Direction carrying the obstruction, when there is one. */
  readonly afflictedDirection: Direction | null;

  /**
   * Polarity of the target sign. Odd reads as an assertive party controlling
   * the matter; even as a risk-averse, procedural one.
   */
  readonly controllerProfile: 'Assertive' | 'Receptive';

  /** Human-readable contributions, in the order they were applied. */
  readonly factors: readonly string[];
}

/**
 * WatchVerdict as it actually arrives over the wire from askWatchOracle.
 *
 * The server boundary-maps the shadow nodes before the response leaves it
 * (see functions/src/utils/planetBoundaryName.ts): `obstruction`,
 * `targetRuler` and `lagnaRuler` carry 'Ras'/'Dhanab' instead of the engine's
 * internal 'Rahu'/'Ketu' whenever a node is the answer. Every other field —
 * including the *Name companions, which already resolve through
 * nomenclature.ts — is unaffected. Client code that consumes a reading
 * received from the server (not one built locally via judgeWatchChart)
 * should type against this, not WatchVerdict.
 */
export type DisplayWatchVerdict = Omit<WatchVerdict, 'obstruction' | 'targetRuler' | 'lagnaRuler'> & {
  readonly obstruction: string;
  readonly targetRuler: string;
  readonly lagnaRuler: string;
};

/* -------------------------------------------------------------------------- */
/*  Timing baselines                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Baseline windows by ruling planet, reflecting classical speed: Qamar moves
 * a matter in days, Zuhal in months. Modulated by dignity and retrogression.
 */
const BASE_TIMING: Readonly<Record<Planet, TimingWindow>> = Object.freeze({
  Moon: { minDays: 3, maxDays: 7 },
  Mercury: { minDays: 7, maxDays: 14 },
  Venus: { minDays: 10, maxDays: 21 },
  Sun: { minDays: 14, maxDays: 30 },
  Mars: { minDays: 30, maxDays: 60 },
  Jupiter: { minDays: 60, maxDays: 90 },
  Saturn: { minDays: 90, maxDays: 150 },
  Rahu: { minDays: 45, maxDays: 90 },
  Ketu: { minDays: 45, maxDays: 90 },
});

const FULFILMENT_HOUSE: HouseNumber = 11;

/* -------------------------------------------------------------------------- */
/*  Judgment                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Judge a watch chart against a question type.
 *
 * @param chart  Built by `buildWatchChart`.
 * @param qType  Classified question type — the owner's taxonomy.
 */
export function judgeWatchChart(chart: WatchChart, qType: QuestionType): WatchVerdict {
  const matrix = HOUSE_MATRIX[qType];
  const targetHouse = matrix.primary as HouseNumber;
  const target = houseOf(chart, targetHouse);
  const fulfilment = houseOf(chart, FULFILMENT_HOUSE);

  const targetRuler = target.ruler;
  const rulerPos = chart.planets[targetRuler];
  const lagnaRuler = chart.lagnaRuler;
  const lagnaRulerPos = chart.planets[lagnaRuler];

  const factors: string[] = [];
  let score = 0;

  // ── 1. Strength of the planet that owns the matter ──────────────────────
  if (isStrong(rulerPos.dignity)) {
    score += 2;
    factors.push(
      `${rulerPos.name} rules the ${targetHouse}th Ghar and is ${rulerPos.dignity} in ${SIGN_META[rulerPos.sign].name} — it holds real control of the matter.`,
    );
  } else if (isWeak(rulerPos.dignity)) {
    score -= 2;
    factors.push(
      `${rulerPos.name} rules the ${targetHouse}th Ghar but is ${rulerPos.dignity} in ${SIGN_META[rulerPos.sign].name} — it cannot deliver unaided.`,
    );
  }

  // ── 2. Querent's ruler versus the matter's ruler ─────────────────────────
  const rulerRelation = relationBetween(lagnaRuler, targetRuler);
  if (rulerRelation === 'Friend') {
    score += 2;
    factors.push(
      `${lagnaRulerPos.name} (your own ruler) counts ${rulerPos.name} a friend — the matter is disposed to cooperate with you.`,
    );
  } else if (rulerRelation === 'Enemy') {
    score -= 2;
    factors.push(
      `${lagnaRulerPos.name} (your own ruler) counts ${rulerPos.name} an enemy — expect rigidity and refusal to adjust.`,
    );
  }

  // ── 3. Who sits on, and who looks at, the matter's Ghar ─────────────────
  const onTarget = [...target.occupants, ...target.aspectedBy];
  let sawBenefic = false;
  let sawMalefic = false;
  for (const planet of onTarget) {
    const pos = chart.planets[planet];
    const how = target.occupants.includes(planet) ? 'sits in' : 'casts its gaze on';
    if (isBenefic(planet)) {
      score += 2;
      sawBenefic = true;
      factors.push(`${pos.name} ${how} the ${targetHouse}th Ghar — protection and expansion.`);
    } else if (isMalefic(planet)) {
      score -= 2;
      sawMalefic = true;
      factors.push(`${pos.name} ${how} the ${targetHouse}th Ghar — friction on the matter.`);
    }
  }

  // ── 4. The Ghar of fulfilment ────────────────────────────────────────────
  const onFulfilment = [...fulfilment.occupants, ...fulfilment.aspectedBy];
  for (const planet of onFulfilment) {
    if (isBenefic(planet)) {
      score += 2;
      factors.push(
        `${chart.planets[planet].name} supports the 11th Ghar — the desire has room to materialise.`,
      );
    } else if (isMalefic(planet)) {
      score -= 2;
      factors.push(
        `${chart.planets[planet].name} weighs on the 11th Ghar — fulfilment itself is obstructed.`,
      );
    }
  }

  // ── 5. Where the matter's ruler has landed ───────────────────────────────
  if (matrix.favorable.includes(rulerPos.house)) {
    score += 1;
    factors.push(
      `${rulerPos.name} has landed in the ${rulerPos.house}th Ghar, a supporting house for this question.`,
    );
  } else if (matrix.denial.includes(rulerPos.house)) {
    score -= 1;
    factors.push(
      `${rulerPos.name} has landed in the ${rulerPos.house}th Ghar, a denying house for this question.`,
    );
  }

  // ── 6. Retrogression ─────────────────────────────────────────────────────
  const reversal: 'POSSIBLE' | 'NONE' =
    rulerPos.isRetrograde || lagnaRulerPos.isRetrograde ? 'POSSIBLE' : 'NONE';
  if (rulerPos.isRetrograde) {
    factors.push(
      `${rulerPos.name} is retrograde — decisions already taken on this matter are liable to be reopened.`,
    );
  }
  if (rulerPos.isCombust) {
    score -= 1;
    factors.push(
      `${rulerPos.name} is combust under Shams — the matter's own agent is obscured from view.`,
    );
  }

  // ── 7. Obstruction, in strict precedence ─────────────────────────────────
  const obstruction = firstObstruction(chart, targetHouse);
  const afflictedDirection =
    obstruction !== 'None' && obstruction !== 'MoonDisagreement'
      ? SIGN_META[chart.planets[obstruction].sign].direction
      : null;
  if (obstruction === 'MoonDisagreement') {
    factors.push(
      'Qamar occupies a denying Ghar for this question — the mind behind the question is not settled, which clouds the reading.',
    );
  }

  // ── 8. Settle the state ──────────────────────────────────────────────────
  const state = resolveState({
    score,
    retrograde: rulerPos.isRetrograde,
    obstruction,
    rulerWeak: isWeak(rulerPos.dignity),
  });

  // ── 9. Confidence, downgraded when the witnesses disagree ───────────────
  let confidence = bandConfidence(score);
  if (sawBenefic && sawMalefic) {
    confidence = downgrade(confidence);
    factors.push(
      'Benefic and malefic witnesses both fall on the matter — the reading carries genuine conflict.',
    );
  }
  if (obstruction === 'MoonDisagreement') {
    confidence = downgrade(confidence);
  }

  return {
    qType,
    targetHouse,
    targetSignName: target.signName,
    targetRuler,
    targetRulerName: rulerPos.name,
    fulfilmentHouse: FULFILMENT_HOUSE,
    lagnaRuler,
    rulerRelation,
    state,
    confidence,
    score,
    obstruction,
    reversal,
    timing: state === 'UNFORMED' ? null : computeTiming(chart, targetRuler),
    direction: target.direction,
    afflictedDirection,
    controllerProfile: target.polarity === 'Odd' ? 'Assertive' : 'Receptive',
    factors: Object.freeze(factors),
  };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Obstruction precedence: a malefic actually ON the matter outranks one merely
 * looking at it, and Zuhal outranks Mirrikh outranks the nodes. Only if no
 * malefic touches the Ghar do we fall back to Qamar's disagreement.
 */
function firstObstruction(chart: WatchChart, targetHouse: HouseNumber): Obstruction {
  const target = houseOf(chart, targetHouse);
  const order: readonly Planet[] = ['Saturn', 'Mars', 'Rahu', 'Ketu'];

  for (const planet of order) {
    if (target.occupants.includes(planet)) {
      return planet;
    }
  }
  for (const planet of order) {
    if (target.aspectedBy.includes(planet)) {
      return planet;
    }
  }

  // Qamar carries the querent's mind. Sitting in a denying Ghar for the
  // question, it reports a mind at odds with its own request.
  const moonHouse = chart.planets.Moon.house;
  if (moonHouse === 8 || moonHouse === 12) {
    return 'MoonDisagreement';
  }
  return 'None';
}

function resolveState(input: {
  score: number;
  retrograde: boolean;
  obstruction: Obstruction;
  rulerWeak: boolean;
}): WatchState {
  const { score, retrograde, obstruction, rulerWeak } = input;

  // A hard block outranks everything: there is nothing to reverse or delay.
  if (score <= -5) {
    return 'BLOCKED';
  }
  // Retrogression is its own condition — the matter turns back on itself.
  if (retrograde) {
    return 'REVERSING';
  }
  if (score >= 5) {
    return 'FULFILLED';
  }
  if (obstruction === 'Saturn' || rulerWeak) {
    return 'DELAYED';
  }
  if (score >= 2) {
    return 'MOVING';
  }
  return 'UNFORMED';
}

function bandConfidence(score: number): Confidence {
  const magnitude = Math.abs(score);
  if (magnitude >= 6) {
    return 'VERY_HIGH';
  }
  if (magnitude >= 4) {
    return 'HIGH';
  }
  if (magnitude >= 2) {
    return 'MODERATE';
  }
  if (magnitude >= 1) {
    return 'LOW';
  }
  return 'UNCERTAIN';
}

function downgrade(confidence: Confidence): Confidence {
  switch (confidence) {
    case 'VERY_HIGH':
      return 'HIGH';
    case 'HIGH':
      return 'MODERATE';
    case 'MODERATE':
      return 'LOW';
    default:
      return 'UNCERTAIN';
  }
}

/**
 * Timing from the matter's ruler: its classical speed, stretched when it is
 * weak or retrograde, shortened when exalted.
 */
function computeTiming(chart: WatchChart, ruler: Planet): TimingWindow {
  const base = BASE_TIMING[ruler];
  const pos = chart.planets[ruler];

  let factor = 1;
  if (pos.isRetrograde) {
    factor *= 1.5;
  }
  if (isWeak(pos.dignity)) {
    factor *= 1.5;
  }
  if (pos.dignity === 'Exalted') {
    factor *= 0.7;
  }

  return {
    minDays: Math.round(base.minDays * factor),
    maxDays: Math.round(base.maxDays * factor),
  };
}
