/**
 * computeConvergenceTiming — unit tests, focused on the transit-trigger
 * lead-time bug fix (lead time must scale with the window unit, not a
 * fixed constant).
 */

import { computeConvergenceTiming } from '../timing';
import type { Chart, Planet } from '../../../types/chart';

const MOMENT = '2026-08-08T12:00:00.000Z';
const DAY_MS = 86_400_000;

// computeConvergenceTiming only reads chart.momentUtc and
// chart.planets.Moon.siderealLongitude/nakshatraLord — everything else on
// Chart is irrelevant to this function, so a minimal cast is intentional
// here rather than building a full chart fixture.
function makeChart(moonLon: number): Chart {
  return {
    momentUtc: MOMENT,
    planets: {
      Moon: { siderealLongitude: moonLon, nakshatraLord: 'Ketu' },
    },
  } as unknown as Chart;
}

// Moon at 5° — within Ashwini (Ketu's nakshatra), near the start, so MD
// balance is long regardless; MD/AD/PD identity isn't what these tests
// check — the significator overlap (which drives the `window` selection)
// is controlled directly via `confirmedSignificators`.
const chart = makeChart(5);

describe('computeConvergenceTiming — transit trigger lead time', () => {
  test('days window: trigger lands within days, not weeks', () => {
    // MD/AD/PD all significators → 'days' window, range.min = 1
    const { activeDasha, activeAntardasha, activePratyantardasha } = computeConvergenceTiming(
      chart,
      [],
    );
    const allThree = [activeDasha, activeAntardasha, activePratyantardasha] as Planet[];
    const timing = computeConvergenceTiming(chart, allThree);

    expect(timing.window).toBe('days');
    const leadMs = new Date(timing.transitTriggers[0]!.date).getTime() - new Date(MOMENT).getTime();
    expect(leadMs).toBe(1 * DAY_MS); // range.min (1) × 1 day/unit
    expect(timing.transitTriggers[0]!.planet).toBe('Sun');
  });

  test('years window: trigger lands roughly a year out, uses Jupiter, not ~15 days', () => {
    // No confirmed significators at all → 'years' window, range.min = 1
    const timing = computeConvergenceTiming(chart, []);

    expect(timing.window).toBe('years');
    const leadDays =
      (new Date(timing.transitTriggers[0]!.date).getTime() - new Date(MOMENT).getTime()) / DAY_MS;
    // Must be close to a real year (365.25), not the old fixed ~15/30 day bug.
    expect(leadDays).toBeCloseTo(365.25, 1);
    expect(timing.transitTriggers[0]!.planet).toBe('Jupiter');
  });

  test('lead time is always shorter for a "days" window than a "years" window', () => {
    const daysWindow = computeConvergenceTiming(chart, [
      computeConvergenceTiming(chart, []).activeDasha,
      computeConvergenceTiming(chart, []).activeAntardasha,
      computeConvergenceTiming(chart, []).activePratyantardasha,
    ] as Planet[]);
    const yearsWindow = computeConvergenceTiming(chart, []);

    const daysLead = new Date(daysWindow.transitTriggers[0]!.date).getTime();
    const yearsLead = new Date(yearsWindow.transitTriggers[0]!.date).getTime();
    expect(daysLead).toBeLessThan(yearsLead);
  });
});
