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

/**
 * The closed obstruction enum the source material specifies. Note it names
 * only four planets — the Sun is a natural malefic in this engine's own
 * classification and can genuinely obstruct, but has no slot, so it falls
 * through to DENIAL_WITNESS or NONE. Flagged in docs/RKP_OPEN_QUESTIONS.md.
 */
export type ObstructionAnchor =
  | 'Saturn'
  | 'Mars'
  | 'Rahu'
  | 'Ketu'
  | 'MOON_DISAGREEMENT'
  | 'DENIAL_WITNESS'
  | 'NONE';

export type PrimaryThemeAnchor =
  | 'STRONG_OPENING'
  | 'RAPID_RESOLUTION'
  | 'OPENING'
  | 'DELAY'
  | 'AMBIGUITY'
  | 'OBSTRUCTION'
  | 'STRUCTURAL_BLOCKAGE'
  | 'UNCLEAR_SIGNAL';

export interface OracleAnchors {
  /** The native 6-state verdict — YES_STRONG | YES_CONDITIONAL | DELAY | WAIT | NO_DENIED | INCONCLUSIVE. */
  readonly verdict: string;
  readonly confidence: ConfidenceBand;
  /**
   * The mechanism the matter is in — Siddhi / Stambhana / Gati / Vakra /
   * Kshaya / Bija. Diagnostic only; the prompt must never print the word.
   */
  readonly condition: string;
  /** What is promised or blocked, in one word/phrase — never a raw score. */
  readonly primaryTheme: PrimaryThemeAnchor;
  /** The force obstructing the matter, from a closed set. Planet names are translated to Arabic by the prompt. */
  readonly obstruction: ObstructionAnchor;
  /** A secondary complicating factor, or NONE. */
  readonly secondaryTheme: string;
  /** A window string (e.g. "1-6 months") or UNCLEAR. */
  readonly timing: string;
  /** Physical/Vastu direction of the activated house (North/South/East/West). */
  readonly direction: string;
  /**
   * Whether the matter could still turn back on itself.
   * POSSIBLE   — one of the three triad rulers is retrograde.
   * IMPOSSIBLE — the matter is sealed: denied, with nothing in retrograde
   *              motion that could turn it back.
   * NONE       — no reversal indicated.
   *
   * ⚠ The source material supplies no rule separating IMPOSSIBLE from NONE;
   * the "sealed" reading above is this engine's, and is flagged in
   * docs/RKP_OPEN_QUESTIONS.md. The material is also internally
   * inconsistent about WHICH rulers to check (its schema says query or
   * fulfilment, its reference code says target or Lagna) — all three triad
   * rulers are checked here, which satisfies both readings.
   */
  readonly reversal: 'POSSIBLE' | 'IMPOSSIBLE' | 'NONE';
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

  const primaryTheme = ((): PrimaryThemeAnchor => {
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
        // "elif dignities.get(target_ruler) == 'Exalted': primary_theme =
        // 'RAPID_RESOLUTION'" (source material). Exaltation is the material's
        // own trigger for a matter that resolves fast; own-sign is strength
        // without that speed, and keeps STRONG_OPENING.
        if (hl.dignity === 'exalted') {
          return 'RAPID_RESOLUTION';
        }
        return hl.dignity === 'own' ? 'STRONG_OPENING' : 'OPENING';
    }
  })();

  const obstruction = ((): ObstructionAnchor => {
    // The material's explicit bottleneck hierarchy, in its own order:
    //   Saturn -> Mars -> Rahu -> Ketu, tested against the house of the
    //   matter (occupying OR aspecting), then the Moon, then the witnesses.
    // Saturn leads even though the triad treats it as a delay rather than a
    // block: this anchor names WHAT is in the way, not how severe it is.
    const tp = verdict.triad.targetPressure;
    if (tp.saturnPressure) {
      return 'Saturn';
    }
    for (const p of ['Mars', 'Rahu', 'Ketu'] as const) {
      if (tp.blockingMalefics.includes(p)) {
        return p;
      }
    }
    // Nothing on the house itself — fall back to what troubles its lord,
    // but only if it is one of the four the closed enum names.
    const blockers = [...hl.conjunctObstruction, ...hl.aspectObstruction];
    for (const p of ['Saturn', 'Mars', 'Rahu', 'Ketu'] as const) {
      if (blockers.includes(p)) {
        return p;
      }
    }
    if (verdict.moonConfirmation.agreement === 'disagrees') {
      return 'MOON_DISAGREEMENT';
    }
    if (verdict.rulingConfirmation.denialWitnesses.length > 0) {
      return 'DENIAL_WITNESS';
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
    condition: verdict.conditionState,
    direction: hl.direction,
    reversal: ((): 'POSSIBLE' | 'IMPOSSIBLE' | 'NONE' => {
      const anyRetrograde = [
        verdict.triad.lagna,
        verdict.triad.target,
        verdict.triad.fulfilment,
      ].some(h => h.retrograde);
      if (anyRetrograde) {
        return 'POSSIBLE';
      }
      // Sealed: denied, with nothing in retrograde motion to turn it back.
      return verdict.nativeState === 'NO_DENIED' ? 'IMPOSSIBLE' : 'NONE';
    })(),
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
