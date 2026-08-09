/**
 * rkpConditionState — the six conditions a matter can settle into.
 * --------------------------------------------------------------------------
 * Source (RKP material, "VERDICT: nativeState (The Six Real States)"):
 *
 *   "In horary systems like RKP, a matter must settle into one of six
 *    definitive conditions:
 *      - Fully Resolved (Siddhi): clean connectivity between the 1st,
 *        target, and 11th houses.
 *      - Structurally Blocked (Stambhana): heavy malefic or Saturn
 *        intervention.
 *      - In-Progress/Moving (Gati): active friendly transits.
 *      - Reversing/Rework Required (Vakra): triggered by retrograde planets.
 *      - Decaying/Failing (Kshaya): severe debilitation or Rahu/Ketu
 *        eclipse points.
 *      - Unformed/Premature (Bija): the question is genuine, but the cosmic
 *        timing hasn't matured yet."
 *
 * and the reference implementation's own precedence, which is explicit:
 *
 *   if   obstruction == Saturn        -> Stambhana
 *   elif obstruction in (Mars, Rahu)  -> Kshaya
 *   elif target ruler exalted         -> Siddhi
 *   else                              -> Gati
 *
 * ── HOW THIS RELATES TO `nativeState` ──────────────────────────────────────
 * This is a SECOND, PARALLEL classification, not a replacement. The two
 * answer different questions:
 *
 *   nativeState    — what to TELL the seeker (YES_STRONG … INCONCLUSIVE).
 *                    Drives the UI, the share text, and the oracle's
 *                    "unveiling" heading. A seeker is never shown "Stambhana".
 *   conditionState — what MECHANISM the matter is in. Diagnostic; feeds the
 *                    reasoning trace and gives the presentation layer a
 *                    sharper handle on *why* than the verdict alone.
 *
 * Collapsing to one set is an open question — see docs/RKP_OPEN_QUESTIONS.md.
 *
 * Determinism: pure function of the triad. No clocks, no randomness.
 */

import type { TriadAnalysis } from './rkpTriad';

export type RKPConditionState =
  /** Fully resolved — clean connectivity between the 1st, target and 11th. */
  | 'Siddhi'
  /** Structurally blocked — heavy malefic or Saturn intervention. */
  | 'Stambhana'
  /** In progress, moving — active friendly transits. */
  | 'Gati'
  /** Reversing, rework required — a retrograde ruler. */
  | 'Vakra'
  /** Decaying, failing — severe debilitation or a Rahu/Ketu eclipse point. */
  | 'Kshaya'
  /** Unformed, premature — a genuine question whose timing has not matured. */
  | 'Bija';

export interface ConditionReading {
  readonly state: RKPConditionState;
  /** Which rung fired, for the reasoning trace. */
  readonly reason: string;
}

/**
 * Classify the matter's condition.
 *
 * PRECEDENCE follows the reference implementation exactly where it is
 * explicit (Saturn before Mars/Rahu before exaltation), and the prose
 * definitions for the two states that implementation never reaches
 * (Vakra and Bija). Vakra sits after the two obstruction rungs because
 * the reference checks obstruction first; Bija is the terminal case,
 * matching its definition as "the question is genuine, but the cosmic
 * timing hasn't matured yet".
 */
export function classifyCondition(triad: TriadAnalysis): ConditionReading {
  const { target, targetPressure, fulfilmentPressure, lagna, fulfilment } = triad;

  // 1. STAMBHANA — Saturn first, exactly as the reference implementation
  //    orders it ("if obstruction == Saturn -> Stambhana", checked before
  //    Mars/Rahu).
  if (targetPressure.saturnPressure) {
    return {
      state: 'Stambhana',
      reason: `Saturn bears on the house of the matter (house ${targetPressure.house})`,
    };
  }

  // 2. KSHAYA — "severe debilitation or Rahu/Ketu eclipse points", and the
  //    reference's "elif obstruction in (Mars, Rahu) -> Kshaya". These sit
  //    ABOVE the generic blocked check below: when a block is CAUSED by an
  //    eclipse point or by Mars, the material names it decay, not blockage.
  const eclipsePoints = targetPressure.blockingMalefics.filter(p => p === 'Rahu' || p === 'Ketu');
  if (eclipsePoints.length > 0) {
    return {
      state: 'Kshaya',
      reason: `eclipse point(s) [${eclipsePoints.join(',')}] on the house of the matter`,
    };
  }
  if (targetPressure.blockingMalefics.includes('Mars')) {
    return { state: 'Kshaya', reason: 'Mars bears on the house of the matter' };
  }
  if (target.dignity === 'debilitated') {
    return { state: 'Kshaya', reason: `the ruler of the matter (${target.lord}) is debilitated` };
  }

  // 3. STAMBHANA (residual) — blocked by something other than the named
  //    planets above, e.g. affliction of the 11th rather than the target.
  if (triad.outcome === 'blocked') {
    return { state: 'Stambhana', reason: `the triad is blocked — ${triad.outcomeReason}` };
  }

  // 4. VAKRA — "triggered by retrograde planets". Any of the three triad
  //    rulers turning back is enough to make the matter one of rework.
  const retrogradeRulers = [lagna, target, fulfilment].filter(h => h.retrograde).map(h => h.lord);
  if (retrogradeRulers.length > 0) {
    return {
      state: 'Vakra',
      reason: `retrograde ruler(s) [${[...new Set(retrogradeRulers)].join(',')}]`,
    };
  }

  // 5. SIDDHI — "clean connectivity between the 1st, target and 11th
  //    houses". Read as: the triad resolved positive, the ruler of the
  //    matter is dignified, and neither the target nor the 11th carries a
  //    blocking malefic at all.
  const cleanConnectivity =
    triad.outcome === 'positive' &&
    targetPressure.blockingMalefics.length === 0 &&
    fulfilmentPressure.blockingMalefics.length === 0;
  if (cleanConnectivity && (target.dignity === 'exalted' || target.dignity === 'own')) {
    return {
      state: 'Siddhi',
      reason: `clean 1st/${target.house}th/11th connectivity with ${target.lord} ${target.dignity}`,
    };
  }

  // 6. GATI — "active friendly transits". The matter is moving, without
  //    the unbroken connectivity Siddhi requires.
  if (triad.outcome === 'positive' || triad.outcome === 'delayed') {
    return { state: 'Gati', reason: `the matter is in motion (triad ${triad.outcome})` };
  }

  // 7. BIJA — terminal: genuine question, timing not yet matured.
  return { state: 'Bija', reason: `no condition has formed yet (triad ${triad.outcome})` };
}
