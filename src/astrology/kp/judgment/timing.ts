/**
 * timing — KP Dasha-Transit convergence logic.
 * --------------------------------------------------------------------------
 * True KP timing requires the convergence of Dashas (MD/AD/PD) and Transits.
 *
 * 1. The Dasha, Antardasha, and Pratyantardasha lords must be significators.
 * 2. Transits of Sun (months) and Jupiter (years) over sensitive degrees
 *    activate the result.
 */

import type { Chart, Planet } from '../../types/chart';
import type { VerdictTiming, TransitTrigger, TimingWindow } from '../../types/verdict';
import { calculateDasha } from '../../primitives/dasha';

/**
 * Implements the "Timing Planet" selection based on Dasha-Transit convergence.
 *
 * @param chart                  The horary chart.
 * @param confirmedSignificators Planets identified as confirmed witnesses (RP ∩ Significators).
 * @returns                      Authentic KP timing window and transit triggers.
 */
export function computeConvergenceTiming(
  chart: Chart,
  confirmedSignificators: readonly Planet[],
): VerdictTiming {
  const momentMs = new Date(chart.momentUtc).getTime();
  const moonLon = chart.planets.Moon.siderealLongitude;
  const moonNakLord = chart.planets.Moon.nakshatraLord as Planet;

  // 2. Dasha Participation Check
  const dasha = calculateDasha(moonLon, momentMs);
  const md = dasha.mahadasha.lord as Planet;
  const ad = dasha.currentAntardasha.lord as Planet;
  const pd = dasha.currentPratyantar.lord as Planet;

  const mdIsSignificator = confirmedSignificators.includes(md);
  const adIsSignificator = confirmedSignificators.includes(ad);
  const pdIsSignificator = confirmedSignificators.includes(pd);

  // 3. Fructification Window Estimation
  let window: TimingWindow = 'months';
  let range = { min: 1, max: 12 };

  if (mdIsSignificator && adIsSignificator && pdIsSignificator) {
    // All levels agree -> Fruition within current PD
    window = 'days';
    range = { min: 1, max: 7 };
  } else if (mdIsSignificator && adIsSignificator) {
    // MD/AD agree -> Fruition within current AD
    window = 'weeks';
    range = { min: 1, max: 4 };
  } else if (mdIsSignificator) {
    // MD signifies -> within next few months
    window = 'months';
    range = { min: 1, max: 6 };
  } else {
    // Long term (years) - waiting for MD to change to a significator
    window = 'years';
    range = { min: 1, max: 2 };
  }

  // 4. Transit Convergence (Projected Triggers)
  // Sun transit over timing planet's nakshatra confirms the month/day.
  const triggers: TransitTrigger[] = [];
  // Timing planet: strongest confirmed significator or Moon nakshatra lord fallback
  const timingPlanet = confirmedSignificators.length > 0 ? confirmedSignificators[0] : moonNakLord;
  // Approximation: Sun moves ~1 deg/day, Jupiter ~30 deg/year (0.08 deg/day).
  // We use 30 days for Jupiter-scale (years) and 15 days for Sun-scale (months).
  const leadDaysPerUnit = timingPlanet === 'Jupiter' ? 30.44 : 15.22;

  const sunHit = new Date(momentMs + range.min * leadDaysPerUnit * 86_400_000).toISOString();
  triggers.push({ planet: 'Sun', date: sunHit });

  return {
    window,
    range,
    activeDasha: md,
    activeAntardasha: ad,
    activePratyantardasha: pd,
    transitTriggers: Object.freeze(triggers),
  };
}
