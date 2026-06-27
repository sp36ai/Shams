/**
 * timing — RKP 3-condition Ruling Planet intersection timing.
 * --------------------------------------------------------------------------
 * Timing is derived from how many of the 5 classical Ruling Planets (RP)
 * are also confirmed significators for the question. More RP matches →
 * closer timing. This is the RKP method per Astro Sarfaraz's rules.
 *
 * 3 or more RPs match → days
 * 2 RPs match         → weeks
 * 1 RP matches        → months
 * 0 RPs match         → years
 *
 * horaLord is NOT included in the 5-RP set for scoring. It is appended
 * as an extended witness separately in judgeHorary.ts.
 *
 * NO Vimshottari Dasha (MD/AD/PD) — horary only per RKP rules.
 */

import type { Chart, Planet } from '../../types/chart';
import type { VerdictTiming, TransitTrigger, TimingWindow } from '../../types/verdict';

/**
 * Compute timing via 3-condition RP intersection.
 *
 * @param chart                  The horary chart.
 * @param confirmedSignificators Planets identified as confirmed witnesses (RP ∩ Significators).
 * @returns                      Timing window based on RP agreement count.
 */
export function computeConvergenceTiming(
  chart: Chart,
  confirmedSignificators: readonly Planet[],
): VerdictTiming {
  const momentMs = new Date(chart.momentUtc).getTime();

  // 5 classical RPs: [dayLord, horaLord, ascSignLord, ascStarLord, moonSignLord, moonStarLord]
  // horaLord is at index 1 — exclude from the 5-RP count
  const fiveRP = (chart.rulingPlanets as Planet[]).filter((_, i) => i !== 1).filter(Boolean);

  // Count how many of the 5 RPs are confirmed significators (3-condition RP intersection)
  const rpMatches = fiveRP.filter(p => confirmedSignificators.includes(p));
  const rpMatchCount = rpMatches.length;

  let window: TimingWindow;
  let range: { min: number; max: number };

  if (rpMatchCount >= 3) {
    window = 'days';
    range = { min: 3, max: 14 };
  } else if (rpMatchCount === 2) {
    window = 'weeks';
    range = { min: 2, max: 8 };
  } else if (rpMatchCount === 1) {
    window = 'months';
    range = { min: 1, max: 6 };
  } else {
    window = 'years';
    range = { min: 1, max: 2 };
  }

  // Transit trigger: project a Sun transit as a rough activation date
  const leadDays =
    window === 'days' ? range.min : window === 'weeks' ? range.min * 7 : window === 'months' ? range.min * 30 : 180;
  const sunHit = new Date(momentMs + leadDays * 86_400_000).toISOString();
  const triggers: readonly TransitTrigger[] = Object.freeze([{ planet: 'Sun' as Planet, date: sunHit }]);

  return {
    window,
    range,
    rpMatchCount,
    transitTriggers: triggers,
  };
}
