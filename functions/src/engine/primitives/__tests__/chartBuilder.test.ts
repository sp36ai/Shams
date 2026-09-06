import { describe, it, expect } from 'vitest';

import { buildChart } from '../chartBuilder';

/**
 * Regression tests for buildChart — the single function every reading in
 * this app passes through (askOracle.ts:420, askWatchOracle.ts's watch
 * counterpart uses the same primitives layer).
 *
 * IMPORTANT — what these tests do and do not prove:
 *   The expected values below are CHARACTERIZATION values: the actual
 *   output of this implementation for these exact inputs, captured and
 *   pinned deliberately, not independently cross-checked against an
 *   external ephemeris (Swiss Ephemeris, JPL Horizons, etc.) in this
 *   session. What they DO prove and enforce going forward:
 *     1. buildChart is deterministic — same (timestamp, lat, lon) always
 *        produces the same chart, to the bit. See the "determinism" test
 *        below, which is the concrete version of the guarantee judgeHorary.ts
 *        states in its own module docstring ("no Date.now(), no Math.random()").
 *     2. A future change to the engine (ephemeris constants, ayanamsa,
 *        sub-lord tables, house-cusp math) cannot silently drift these
 *        outputs — CI fails immediately, and the diff shows exactly which
 *        field moved and by how much, rather than the change reaching
 *        production readings unnoticed.
 *   Independently verifying the pinned values against an external ephemeris
 *   is real, separate follow-up work — see PRODUCTION_AUDIT_2026-08-23.md
 *   §6 / §16. Until that's done, these tests answer "did anything change?",
 *   not "is the astronomy correct?" — both matter, this covers the first.
 */

describe('buildChart — determinism', () => {
  it('produces byte-identical output for identical input, called twice', () => {
    const a = buildChart('2026-08-15T10:30:00.000Z', 34.0837, 74.7973);
    const b = buildChart('2026-08-15T10:30:00.000Z', 34.0837, 74.7973);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('buildChart — characterization: ordinary date, northern hemisphere', () => {
  // 2026-08-15T10:30:00Z, Srinagar (34.0837°N, 74.7973°E).
  const chart = buildChart('2026-08-15T10:30:00.000Z', 34.0837, 74.7973);

  it('places the ascendant and Sun/Moon at the currently-known values', () => {
    expect(chart.cusps[0]!.siderealLongitude).toBeCloseTo(244.94159433881939, 9);
    expect(chart.planets.Sun!.siderealLongitude).toBeCloseTo(118.40455081861973, 9);
    expect(chart.planets.Moon!.siderealLongitude).toBeCloseTo(153.62179175085933, 9);
    expect(chart.planets.Saturn!.siderealLongitude).toBeCloseTo(349.8949765870239, 9);
  });

  it('assigns the currently-known nakshatra/sub-lord chain for Sun and Moon', () => {
    expect(chart.planets.Sun!.nakshatraLord).toBe('Mercury');
    expect(chart.planets.Sun!.subLord).toBe('Saturn');
    expect(chart.planets.Moon!.nakshatraLord).toBe('Sun');
    expect(chart.planets.Moon!.subLord).toBe('Saturn');
  });
});

describe('buildChart — characterization: leap day, southern hemisphere, negative longitude', () => {
  // 2028-02-29T23:59:00Z (leap day, near UTC midnight), Buenos Aires
  // (-34.6037, -58.3816) — exercises the Feb-29 calendar path and negative
  // lat/lon simultaneously, neither of which the northern-hemisphere case
  // above touches.
  const chart = buildChart('2028-02-29T23:59:00.000Z', -34.6037, -58.3816);

  it('builds without throwing and places bodies at the currently-known values', () => {
    expect(chart.cusps[0]!.siderealLongitude).toBeCloseTo(172.22956337511152, 9);
    expect(chart.planets.Sun!.siderealLongitude).toBeCloseTo(316.68307530702884, 9);
    expect(chart.planets.Moon!.siderealLongitude).toBeCloseTo(6.921746664089596, 9);
    expect(chart.planets.Saturn!.siderealLongitude).toBeCloseTo(0.5162959546738257, 9);
  });
});

describe('buildChart — characterization: UTC-midnight boundary, equator/prime meridian', () => {
  // 2026-01-01T00:00:30Z, (0, 0) — the moment closest to a "date rollover at
  // the reference meridian" this engine's UTC-only input can express (see
  // julianDay.ts's dateToJD: buildChart takes UTC-anchored input only, so
  // there is no local-timezone/DST ambiguity to test at this layer — that
  // concern lives in utils/localTime.ts, already covered by
  // localTime.test.ts's midnight-rollover cases).
  const chart = buildChart('2026-01-01T00:00:30.000Z', 0, 0);

  it('builds without throwing at the year/day boundary', () => {
    expect(chart.cusps[0]!.siderealLongitude).toBeCloseTo(167.51381313248143, 9);
    expect(chart.planets.Sun!.siderealLongitude).toBeCloseTo(256.3546082816904, 9);
    expect(chart.planets.Moon!.siderealLongitude).toBeCloseTo(42.501655371404155, 9);
  });
});
