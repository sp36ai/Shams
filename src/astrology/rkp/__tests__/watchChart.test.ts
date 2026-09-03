import { buildWatchChart, houseOf, transitCoordinatesOf } from '@astrology/rkp/watchChart';
import { judgeWatchChart } from '@astrology/rkp/watchJudgment';
import { ALL_QUESTION_TYPES } from '@astrology/kp/rules/houseMatrix';
import { PLANETS } from '@astrology/types/chart';
import { SIGN_META, type HouseNumber } from '@astrology/rkp/nomenclature';

const MOMENT = '2026-08-08T11:13:00+05:30';

describe('watch chart assembly', () => {
  it('takes its lagna from the watch minute', () => {
    const chart = buildWatchChart(MOMENT);
    expect(chart.window.minute).toBe(13);
    expect(chart.lagnaSign).toBe(3);
    expect(chart.lagnaSignName).toBe('Burj Jauza');
    expect(chart.lagnaRuler).toBe('Mercury');
  });

  it('rotates twelve distinct signs through the twelve Ghars', () => {
    const chart = buildWatchChart(MOMENT);
    expect(chart.houses).toHaveLength(12);
    expect(new Set(chart.houses.map(h => h.sign)).size).toBe(12);
    expect(chart.houses[0].sign).toBe(chart.lagnaSign);
  });

  it('places every planet in exactly one Ghar', () => {
    const chart = buildWatchChart(MOMENT);
    for (const planet of PLANETS) {
      const house = chart.planets[planet].house;
      expect(house).toBeGreaterThanOrEqual(1);
      expect(house).toBeLessThanOrEqual(12);
      expect(houseOf(chart, house).occupants).toContain(planet);
    }
  });

  it('places each planet in the Ghar carrying its real sign', () => {
    const chart = buildWatchChart(MOMENT);
    for (const planet of PLANETS) {
      const p = chart.planets[planet];
      expect(houseOf(chart, p.house).sign).toBe(p.sign);
    }
  });

  it('keeps occupancy and aspect records mutually consistent', () => {
    const chart = buildWatchChart(MOMENT);
    for (let house = 1; house <= 12; house += 1) {
      for (const planet of houseOf(chart, house as HouseNumber).aspectedBy) {
        expect(chart.planets[planet].aspects).toContain(house);
      }
    }
  });
});

describe('what the watch frame does and does not depend on', () => {
  it('holds the lagna fixed for the same minute — the frame is watch-derived', () => {
    const january = buildWatchChart('2026-01-01T09:13:00+05:30');
    const august = buildWatchChart('2026-08-08T23:13:00+05:30');
    expect(january.lagnaSign).toBe(august.lagnaSign);
  });

  it('still moves the planets with the real sky — positions are not simulated', () => {
    const january = buildWatchChart('2026-01-01T09:13:00+05:30');
    const august = buildWatchChart('2026-08-08T23:13:00+05:30');

    // Shams traverses the zodiac over seven months; a simulated sky would not.
    expect(january.planets.Sun.sign).not.toBe(august.planets.Sun.sign);

    // And the real degree within the sign differs too.
    expect(january.planets.Jupiter.degreeInSign).not.toBeCloseTo(
      august.planets.Jupiter.degreeInSign,
      3,
    );
  });

  it('is location-independent, so a reading needs nothing from the querent', () => {
    const srinagar = buildWatchChart(MOMENT, { lat: 34.08, lon: 74.8 });
    const jakarta = buildWatchChart(MOMENT, { lat: -6.21, lon: 106.85 });
    const omitted = buildWatchChart(MOMENT);

    for (const planet of PLANETS) {
      expect(srinagar.planets[planet].sign).toBe(jakarta.planets[planet].sign);
      expect(srinagar.planets[planet].sign).toBe(omitted.planets[planet].sign);
    }
    expect(srinagar.lagnaSign).toBe(jakarta.lagnaSign);
  });

  it('is deterministic for a given moment', () => {
    expect(buildWatchChart(MOMENT)).toEqual(buildWatchChart(MOMENT));
  });

  it('advances the lagna by one sign per bracket', () => {
    const a = buildWatchChart('2026-08-08T11:13:00+05:30').lagnaSign;
    const b = buildWatchChart('2026-08-08T11:18:00+05:30').lagnaSign;
    expect(b).toBe(a + 1);
  });
});

describe('judgment', () => {
  it('returns a coherent verdict for every question type', () => {
    const chart = buildWatchChart(MOMENT);
    for (const qType of ALL_QUESTION_TYPES) {
      const verdict = judgeWatchChart(chart, qType);

      expect(['FULFILLED', 'MOVING', 'DELAYED', 'BLOCKED', 'REVERSING', 'UNFORMED']).toContain(
        verdict.state,
      );
      expect(['VERY_HIGH', 'HIGH', 'MODERATE', 'LOW', 'UNCERTAIN']).toContain(verdict.confidence);
      expect(['East', 'South', 'West', 'North']).toContain(verdict.direction);
      expect(verdict.targetHouse).toBeGreaterThanOrEqual(1);
      expect(verdict.targetHouse).toBeLessThanOrEqual(12);
      expect(verdict.factors.length).toBeGreaterThan(0);
    }
  });

  it('reports the direction of the Ghar it actually judged', () => {
    const chart = buildWatchChart(MOMENT);
    const verdict = judgeWatchChart(chart, 'legal'); // primary house 6
    expect(verdict.targetHouse).toBe(6);
    expect(verdict.direction).toBe(houseOf(chart, 6).direction);
    expect(verdict.targetRuler).toBe(houseOf(chart, 6).ruler);
  });

  it('flags reversal exactly when a ruling planet is retrograde', () => {
    const chart = buildWatchChart(MOMENT);
    const verdict = judgeWatchChart(chart, 'career');
    const retro =
      chart.planets[verdict.targetRuler].isRetrograde ||
      chart.planets[chart.lagnaRuler].isRetrograde;
    expect(verdict.reversal).toBe(retro ? 'POSSIBLE' : 'NONE');
  });

  it('gives a timing window whenever the chart has settled', () => {
    const chart = buildWatchChart(MOMENT);
    for (const qType of ALL_QUESTION_TYPES) {
      const verdict = judgeWatchChart(chart, qType);
      if (verdict.state === 'UNFORMED') {
        expect(verdict.timing).toBeNull();
      } else {
        expect(verdict.timing).not.toBeNull();
        expect(verdict.timing!.maxDays).toBeGreaterThanOrEqual(verdict.timing!.minDays);
        expect(verdict.timing!.minDays).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic', () => {
    const chart = buildWatchChart(MOMENT);
    expect(judgeWatchChart(chart, 'finance')).toEqual(judgeWatchChart(chart, 'finance'));
  });

  it('uses no Sanskrit vocabulary in its narration factors', () => {
    const banned = /\b(lagna|rashi|bhava|graha|drishti|dasha|stambhana|gati|siddhi|kshaya)\b/i;
    const chart = buildWatchChart(MOMENT);
    for (const qType of ALL_QUESTION_TYPES) {
      for (const factor of judgeWatchChart(chart, qType).factors) {
        expect(factor).not.toMatch(banned);
      }
    }
  });
});

describe('transitCoordinatesOf — display/animation coordinates', () => {
  it('mirrors the chart’s own Sun and Moon sign/degree, not invented values', () => {
    const chart = buildWatchChart(MOMENT);
    const coords = transitCoordinatesOf(chart);
    expect(coords.sun.sign).toBe(chart.planets.Sun.sign);
    expect(coords.sun.degreeInSign).toBe(chart.planets.Sun.degreeInSign);
    expect(coords.moon.sign).toBe(chart.planets.Moon.sign);
    expect(coords.moon.degreeInSign).toBe(chart.planets.Moon.degreeInSign);
  });

  it('pre-formats signName the same way the rest of the chart does — display components never recompute it', () => {
    const chart = buildWatchChart(MOMENT);
    const coords = transitCoordinatesOf(chart);
    expect(coords.sun.signName).toBe(`Burj ${SIGN_META[coords.sun.sign].name}`);
    expect(coords.moon.signName).toBe(`Burj ${SIGN_META[coords.moon.sign].name}`);
    // Lagna reuses the chart's own lagnaSignName verbatim rather than reformatting it.
    expect(coords.lagna.signName).toBe(chart.lagnaSignName);
  });

  it('flattens sign/degree into a single 0-360 longitude', () => {
    const chart = buildWatchChart(MOMENT);
    const coords = transitCoordinatesOf(chart);
    expect(coords.sun.longitude).toBe(
      (chart.planets.Sun.sign - 1) * 30 + chart.planets.Sun.degreeInSign,
    );
    expect(coords.sun.longitude).toBeGreaterThanOrEqual(0);
    expect(coords.sun.longitude).toBeLessThan(360);
  });

  it('gives Lagna only the start-of-sign longitude, never a fabricated sub-degree', () => {
    const chart = buildWatchChart(MOMENT);
    const coords = transitCoordinatesOf(chart);
    expect(coords.lagna.sign).toBe(chart.lagnaSign);
    expect(coords.lagna.longitude).toBe((chart.lagnaSign - 1) * 30);
    expect(coords.lagna).not.toHaveProperty('degreeInSign');
  });

  it('moves with the real sky across different moments, like the chart itself', () => {
    const january = transitCoordinatesOf(buildWatchChart('2026-01-01T09:13:00+05:30'));
    const august = transitCoordinatesOf(buildWatchChart('2026-08-08T23:13:00+05:30'));
    expect(january.sun.longitude).not.toBeCloseTo(august.sun.longitude, 3);
  });
});
