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
  // Lead time to the first projected transit hit, scaled to the WINDOW UNIT
  // itself — not a fixed constant — so the trigger date is actually
  // consistent with the stated fructification window (previously this used
  // a fixed ~15/30-day offset regardless of whether the window was "days"
  // or "years", producing a "years" prediction with a confirming transit
  // only two weeks away).
  const DAYS_PER_WINDOW_UNIT: Record<TimingWindow, number> = {
    days: 1,
    weeks: 7,
    months: 30.44, // average month length
    years: 365.25,
  };
  const leadDays = range.min * DAYS_PER_WINDOW_UNIT[window];

  // Sun's ~1 year cycle confirms near-term windows (days/weeks/months);
  // Jupiter's slower transit is the traditional confirming signal for a
  // years-scale window (see module docstring).
  const transitPlanet: Planet = window === 'years' ? 'Jupiter' : 'Sun';

  const triggers: TransitTrigger[] = [
    { planet: transitPlanet, date: new Date(momentMs + leadDays * 86_400_000).toISOString() },
  ];

  return {
    window,
    range,
    activeDasha: md,
    activeAntardasha: ad,
    activePratyantardasha: pd,
    transitTriggers: Object.freeze(triggers),
  };
}
