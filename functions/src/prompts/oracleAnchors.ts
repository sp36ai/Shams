/**
 * oracleAnchors — translates a WatchVerdict into the structured factual
 * anchors the oracle-synthesis prompt (oracleSynthesisPrompt.ts) turns into
 * language. This is the "hidden calculation layer -> structured facts" step:
 *
 *   RKP calculates. Shams al-Asrār interprets. Astro Sarfaraz presents.
 *
 * The language model NEVER recalculates and NEVER sees the raw engine
 * (no house numbers, no scores, no sub-lord chains) — only these anchors.
 * Keeping this translation in its own pure, testable function (rather than
 * inline in askOracle.ts) means the boundary between "what the engine knows"
 * and "what the language model is told" is one small, auditable place.
 */

import type { WatchVerdict } from '../engine/types/watchVerdict';

export type ConfidenceBand = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNCERTAIN';

/** Source: RKP Knowledge Base §13.3 / Authentic Engine Specification §24 confidence bands. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 75) {
    return 'VERY_HIGH';
  }
  if (confidence >= 50) {
    return 'HIGH';
  }
  if (confidence >= 25) {
    return 'MODERATE';
  }
  if (confidence >= 10) {
    return 'LOW';
  }
  return 'UNCERTAIN';
}

export interface OracleAnchors {
  /** The native 6-state verdict — YES_STRONG | YES_CONDITIONAL | DELAY | WAIT | NO_DENIED | INCONCLUSIVE. */
  readonly verdict: string;
  readonly confidence: ConfidenceBand;
  /** What is promised or blocked, in one word/phrase — never a raw score. */
  readonly primaryTheme: string;
  /** The planet or force obstructing the matter, or NONE. Real planet name (e.g. "Saturn") — the prompt translates it to Arabic. */
  readonly obstruction: string;
  /** A secondary complicating factor, or NONE. */
  readonly secondaryTheme: string;
  /** A window string (e.g. "1-6 months") or UNCLEAR. */
  readonly timing: string;
  /** Physical/Vastu direction of the activated house (North/South/East/West). */
  readonly direction: string;
  /** Whether the decisive planet is retrograde — POSSIBLE or NONE. */
  readonly reversal: 'POSSIBLE' | 'NONE';
  /**
   * Whether the querent's own ruler and the matter's ruler are natural
   * enemies — the RKP material's signature "rigidity, refusal to adjust,
   * administrative block" signal. CLASH | ALIGNED | NEUTRAL.
   */
  readonly rulerClash: 'CLASH' | 'ALIGNED' | 'NEUTRAL';
  /**
   * How whoever controls the matter operates, from the target house sign's
   * polarity: DIRECT_ASSERTIVE (odd sign) or CAUTIOUS_ADMINISTRATIVE (even).
   *
   * ⚠ The source material states this in terms of the gender of a real
   * person ("indicates ... male individuals dominating the situation" /
   * "female individuals controlling the outcome"). Only the BEHAVIOURAL half
   * of that claim is passed to the presentation layer. Telling a seeker that
   * a person of a specific gender is blocking them is an unfalsifiable claim
   * about a real third party, and the tone guardrails already forbid naming
   * people. Flagged for owner review.
   */
  readonly controllerStyle: 'DIRECT_ASSERTIVE' | 'CAUTIOUS_ADMINISTRATIVE';
}

/**
 * Pure translation function: WatchVerdict -> OracleAnchors. No I/O, no LLM
 * call — just reading fields already computed by judgeRKPWatch().
 */
export function deriveOracleAnchors(verdict: WatchVerdict): OracleAnchors {
  const hl = verdict.houseLord;

  const primaryTheme = (() => {
    switch (verdict.nativeState) {
      case 'NO_DENIED':
        return hl.dignity === 'debilitated' ? 'STRUCTURAL_BLOCKAGE' : 'OBSTRUCTION';
      case 'DELAY':
        return 'DELAY';
      case 'WAIT':
        return 'AMBIGUITY';
      case 'INCONCLUSIVE':
        return 'UNCLEAR_SIGNAL';
      default:
        return hl.dignity === 'exalted' || hl.dignity === 'own' ? 'STRONG_OPENING' : 'OPENING';
    }
  })();

  const obstruction = (() => {
    // A malefic actually bearing on the house of the matter outranks one
    // that merely troubles its lord — it is what the triad protocol denies on.
    const onTheHouse = verdict.triad.targetPressure.blockingMalefics;
    if (onTheHouse.length > 0) {
      return onTheHouse[0] as string;
    }
    const blockers = [...hl.conjunctObstruction, ...hl.aspectObstruction];
    if (blockers.length > 0) {
      return blockers[0] as string;
    }
    if (verdict.moonConfirmation.agreement === 'disagrees') {
      return 'INNER_HESITATION';
    }
    if (verdict.rulingConfirmation.denialWitnesses.length > 0) {
      return verdict.rulingConfirmation.denialWitnesses[0] as string;
    }
    return 'NONE';
  })();

  const secondaryTheme = (() => {
    if (verdict.vastu.afflictedDirections.includes(hl.direction)) {
      return 'ENVIRONMENTAL_FRICTION';
    }
    if (verdict.moonConfirmation.agreement === 'disagrees') {
      return 'INNER_CONFLICT';
    }
    return 'NONE';
  })();

  const timing = verdict.timing
    ? `${verdict.timing.range.min}-${verdict.timing.range.max} ${verdict.timing.window}`
    : 'UNCLEAR';

  return {
    verdict: verdict.nativeState,
    confidence: confidenceBand(verdict.confidence),
    primaryTheme,
    obstruction,
    secondaryTheme,
    timing,
    direction: hl.direction,
    reversal: hl.retrograde ? 'POSSIBLE' : 'NONE',
    rulerClash:
      verdict.triad.rulerRelation === 'enemy'
        ? 'CLASH'
        : verdict.triad.rulerRelation === 'friend'
          ? 'ALIGNED'
          : 'NEUTRAL',
    controllerStyle:
      verdict.triad.controllerPolarity === 'masculine'
        ? 'DIRECT_ASSERTIVE'
        : 'CAUTIOUS_ADMINISTRATIVE',
  };
}
