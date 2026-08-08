/**
 * rkpTriad — RKP's "Verdict Triad" predictive protocol.
 * --------------------------------------------------------------------------
 * Source (RKP material, "CORE PREDICTIVE PROTOCOL — THE VERDICT TRIAD"):
 *
 *   "To deliver a definitive Yes or No to any query, you must track the
 *    relationship between three vital points:
 *      1. The 1st House (Lagna): the querent's current energy and capacity.
 *      2. The Target House (The Query).
 *      3. The 11th House (Fulfillment): dictates whether the desire will
 *         materialize.
 *
 *    The Logic Engine for Outcomes:
 *      - Positive: the rulers of the 1st and Target houses are friendly,
 *        strong, or linked by a beneficial aspect from Jupiter, and the 11th
 *        house is unpolluted by malefics.
 *      - Delayed: the target house ruler is weak, retrograde, or under the
 *        aspect of Saturn. It will happen, but only after strict corrections.
 *      - Negative/Blocked: the target house or 11th house is heavily
 *        afflicted by Rahu, Ketu or Mars, with zero supportive aspects from
 *        benefics."
 *
 * and, from the worked loan example:
 *
 *   "Check the Benefics: if Jupiter or Venus are currently transiting
 *    through your 6th House or 11th House on the clock face, the loan will
 *    be approved despite the delay. Check the Malefics: if Rahu, Ketu or
 *    Mars are sitting in or aspecting your 6th house, it indicates
 *    structural fraud, hidden complications, or eventual rejection unless
 *    corrections are made."
 *
 * WHAT THIS MODULE ADDS: the engine previously judged the target house alone.
 * The triad protocol makes the verdict a three-point relationship, and adds
 * the ruler friendship/enmity clash (planetaryRelations.ts) and the actor
 * polarity profile the material calls for.
 *
 * PRECEDENCE: the material lists three outcome conditions but not their
 * order, and a chart can satisfy more than one. This module resolves them
 * most-severe-first — blocked, then delayed, then positive, then mixed —
 * which is the reading consistent with the material's own worked example
 * (a chart with BOTH a Sun/Saturn ruler clash AND benefic support is
 * reported as a delay, not a denial). Each rung is labelled in the code.
 *
 * Determinism: pure function of (chart, watch, targetHouse). No clocks, no
 * randomness.
 */

import type { Chart, HouseIndex, Planet } from '@astrology/types/chart';
import type { HouseLordAnalysis } from '@astrology/types/watchVerdict';
import {
  polarityOfSign,
  type SignPolarity,
  type WatchChart,
} from '@astrology/primitives/watchChart';
import { relationBetween, type PlanetaryRelation } from '@astrology/primitives/planetaryRelations';
import {
  houseLordAnalysis,
  occupantsOfHouse,
  touchingHouse,
  BENEFICS,
  BLOCKING_MALEFICS,
  RESCUING_BENEFICS,
} from './classicalToolkit';

/** The 11th house is the fixed house of fulfilment for every question. */
export const FULFILMENT_HOUSE: HouseIndex = 11;

export type TriadOutcome = 'positive' | 'delayed' | 'blocked' | 'mixed';

/** Malefic pressure / benefic rescue on one house of the triad. */
export interface HousePressure {
  readonly house: HouseIndex;
  /** Rahu / Ketu / Mars sitting in or aspecting this house. */
  readonly blockingMalefics: readonly Planet[];
  /** The subset of those actually OCCUPYING the house (as opposed to aspecting it). */
  readonly occupyingMalefics: readonly Planet[];
  /** Jupiter / Venus sitting in or aspecting this house — the material's named rescuers. */
  readonly rescuingBenefics: readonly Planet[];
  /** Every natural benefic touching this house (adds Mercury and the Moon). */
  readonly supportingBenefics: readonly Planet[];
  /** Saturn sitting in or aspecting this house — the material's delay signature. */
  readonly saturnPressure: boolean;
  /**
   * "HEAVILY afflicted by Rahu, Ketu or Mars" — read as a malefic actually
   * occupying the house, or two or more of them bearing on it. A single
   * distant aspect is pressure, not heavy affliction; without this
   * qualifier Mars alone (which aspects three houses) would deny most
   * charts outright.
   */
  readonly heavilyAfflicted: boolean;
  /** "heavily afflicted ... with zero supportive aspects from benefics". */
  readonly afflicted: boolean;
}

export interface TriadAnalysis {
  readonly lagna: HouseLordAnalysis;
  readonly target: HouseLordAnalysis;
  readonly fulfilment: HouseLordAnalysis;

  /** Mutual friendship/enmity of the 1st-house ruler and the target-house ruler. */
  readonly rulerRelation: PlanetaryRelation;

  readonly targetPressure: HousePressure;
  readonly fulfilmentPressure: HousePressure;

  /** Querent's own energy, from the Lagna sign's polarity. */
  readonly querentPolarity: SignPolarity;
  /** Whoever controls the matter, from the target house sign's polarity. */
  readonly controllerPolarity: SignPolarity;

  readonly outcome: TriadOutcome;
  /** Which rung of the precedence ladder fired — for the reasoning trace. */
  readonly outcomeReason: string;
}

/**
 * Malefic pressure on one house.
 *
 * ⚠ INTERPRETIVE DECISION — the house's OWN LORD is never counted as one of
 * its blocking malefics. The RKP material's affliction rule ("if Rahu, Ketu
 * or Mars are sitting in or aspecting your 6th house") is written about
 * foreign bodies intruding on a house; its worked example has a
 * Saturn-ruled 6th house with Mars as an outsider. Taken literally the rule
 * would make every Mars-ruled house (Aries, Scorpio) self-afflicting the
 * moment Mars sits in its own sign — which classically is the opposite,
 * a lord in its own domain is at its strongest. The lord's condition is
 * already fully judged by houseLordAnalysis(); this test is only about
 * intruders. Flagged for owner confirmation.
 */
function housePressure(
  chart: Chart,
  watch: WatchChart,
  house: HouseIndex,
  ownLord: Planet,
): HousePressure {
  const touching = touchingHouse(chart, watch, house);
  const occupants = occupantsOfHouse(chart, watch, house);
  const blockingMalefics = touching.filter(p => p !== ownLord && BLOCKING_MALEFICS.has(p));
  const occupyingMalefics = blockingMalefics.filter(p => occupants.includes(p));
  const rescuingBenefics = touching.filter(p => RESCUING_BENEFICS.has(p));
  // The denial clause says "zero supportive aspects from BENEFICS", not
  // "from Jupiter or Venus" — so every natural benefic can hold the house
  // out of denial, while only the two the material names by role
  // ("natural helper planets like Jupiter or Venus") count as the rescue
  // that carries a matter through despite delay.
  const supportingBenefics = touching.filter(p => BENEFICS.has(p));
  const heavilyAfflicted = occupyingMalefics.length > 0 || blockingMalefics.length >= 2;
  return {
    house,
    blockingMalefics: Object.freeze(blockingMalefics),
    occupyingMalefics: Object.freeze(occupyingMalefics),
    rescuingBenefics: Object.freeze(rescuingBenefics),
    supportingBenefics: Object.freeze(supportingBenefics),
    saturnPressure: touching.includes('Saturn'),
    heavilyAfflicted,
    afflicted: heavilyAfflicted && supportingBenefics.length === 0,
  };
}

/**
 * Run the triad protocol for a question whose target house is `targetHouse`.
 */
export function analyseTriad(
  chart: Chart,
  watch: WatchChart,
  targetHouse: HouseIndex,
): TriadAnalysis {
  const lagna = houseLordAnalysis(chart, watch, 1);
  const target = houseLordAnalysis(chart, watch, targetHouse);
  const fulfilment = houseLordAnalysis(chart, watch, FULFILMENT_HOUSE);

  const rulerRelation = relationBetween(lagna.lord, target.lord);
  const targetPressure = housePressure(chart, watch, targetHouse, target.lord);
  const fulfilmentPressure = housePressure(chart, watch, FULFILMENT_HOUSE, fulfilment.lord);

  const { outcome, outcomeReason } = resolveOutcome({
    target,
    rulerRelation,
    targetPressure,
    fulfilmentPressure,
  });

  return {
    lagna,
    target,
    fulfilment,
    rulerRelation,
    targetPressure,
    fulfilmentPressure,
    querentPolarity: polarityOfSign(watch.lagnaSign),
    controllerPolarity: polarityOfSign(target.sign),
    outcome,
    outcomeReason,
  };
}

/**
 * The Logic Engine, most-severe-first. Each branch quotes the source line it
 * implements.
 */
function resolveOutcome(args: {
  target: HouseLordAnalysis;
  rulerRelation: PlanetaryRelation;
  targetPressure: HousePressure;
  fulfilmentPressure: HousePressure;
}): { outcome: TriadOutcome; outcomeReason: string } {
  const { target, rulerRelation, targetPressure, fulfilmentPressure } = args;

  // 1. BLOCKED — "the target house or 11th house is heavily afflicted by
  //    Rahu, Ketu or Mars, with zero supportive aspects from benefics".
  if (targetPressure.afflicted) {
    return {
      outcome: 'blocked',
      outcomeReason: `target house ${targetPressure.house} afflicted by [${targetPressure.blockingMalefics.join(',')}] with no benefic support`,
    };
  }
  if (fulfilmentPressure.afflicted) {
    return {
      outcome: 'blocked',
      outcomeReason: `fulfilment house 11 afflicted by [${fulfilmentPressure.blockingMalefics.join(',')}] with no benefic support`,
    };
  }
  // NOTE: denial is reached ONLY through the two clauses above. An
  // obstructed or broken target ruler is NOT a denial in this material —
  // it is explicitly the DELAY condition ("the target house ruler is weak
  // ... it will happen, but only after strict corrections"), handled below.

  // 2. DELAYED — "the target house ruler is weak, retrograde, or under the
  //    aspect of Saturn. It will happen, but only after strict corrections."
  //    Weak = debilitated, combust, or a net-obstructed condition tally;
  //    Saturn pressure = Saturn occupying or aspecting the target house.
  if (target.retrograde) {
    return { outcome: 'delayed', outcomeReason: `target lord ${target.lord} is retrograde` };
  }
  if (target.dignity === 'debilitated') {
    return { outcome: 'delayed', outcomeReason: `target lord ${target.lord} is debilitated` };
  }
  if (target.combust) {
    return { outcome: 'delayed', outcomeReason: `target lord ${target.lord} is combust` };
  }
  if (target.verdict === 'obstructed') {
    return {
      outcome: 'delayed',
      outcomeReason: `target lord ${target.lord} weak (condition tally ${target.supportScore})`,
    };
  }
  if (targetPressure.saturnPressure) {
    return {
      outcome: 'delayed',
      outcomeReason: `Saturn sits in or aspects target house ${targetPressure.house}`,
    };
  }
  // The ruler clash the material names as its signature delay: "Enemy
  // Relationship (e.g. Sun vs. Saturn): hard bureaucratic delay, rigid
  // rules, refusal to adjust."
  if (rulerRelation === 'enemy') {
    return {
      outcome: 'delayed',
      outcomeReason: `ruler clash: Lagna lord and target lord ${target.lord} are natural enemies`,
    };
  }

  // 3. POSITIVE — "the rulers of the 1st and Target houses are friendly,
  //    strong, or linked by a beneficial aspect from Jupiter, AND the 11th
  //    house is unpolluted by malefics".
  const eleventhClean = !fulfilmentPressure.heavilyAfflicted;
  const targetOpen =
    rulerRelation === 'friend' ||
    target.verdict === 'supported' ||
    target.dignity === 'exalted' ||
    target.dignity === 'own' ||
    targetPressure.rescuingBenefics.includes('Jupiter');
  if (targetOpen && eleventhClean) {
    return {
      outcome: 'positive',
      outcomeReason: `ruler relation=${rulerRelation}, target lord ${target.lord} ${target.verdict}/${target.dignity}, house 11 clear of malefics`,
    };
  }

  // 4. MIXED — the material gives no fourth state; anything that satisfies
  //    none of the three named conditions is reported as unresolved rather
  //    than forced into one of them.
  return {
    outcome: 'mixed',
    outcomeReason: `no triad condition fully met (relation=${rulerRelation}, target=${target.verdict}, house 11 malefics=[${fulfilmentPressure.blockingMalefics.join(',')}])`,
  };
}
