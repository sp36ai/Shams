/**
 * Ephemeris reference cases — RKP audit Pass 3.
 * --------------------------------------------------------------------------
 * Pass 1 (static/structural) and Pass 2 (deterministic behavioral) both
 * deliberately deferred the ephemeris itself: they audit what the judgment
 * layer does WITH a chart, not whether the chart's planetary longitudes are
 * astronomically correct. This file closes that gap, independently of the
 * judgment rules, using real astronomical events with independently
 * published, unambiguous ground truth — not a second implementation of the
 * same VSOP87/ELP2000 series, which would only catch a divergence between
 * two guesses, not an error common to both.
 *
 * Every instant below is a fixed historical fact (all in the past relative
 * to this file's authorship), so these are permanent regression cases, not
 * time-sensitive assertions that will go stale:
 *
 *   1. March equinox 2026 (2026-03-20T14:46Z, timeanddate.com /
 *      thesuntoday.org) — the Sun's apparent tropical longitude is 0° at
 *      this instant BY DEFINITION of what an equinox is. Nothing about KP,
 *      Lahiri, or this codebase's own conventions is assumed; this is
 *      independent of everything this engine is built to compute.
 *
 *   2. Lahiri ayanamsa at J2000.0 — widely published as 23°51'11" to
 *      23°51'12" depending on implementation (Swiss Ephemeris vs. the New
 *      International Ephemeris 1900-2050); cross-checked against the
 *      engine's own hardcoded base constant.
 *
 *   3. The August 12, 2026 total solar eclipse (New Moon at 2026-08-12
 *      17:37 UTC, timeanddate.com / starwalk.space) — a total solar eclipse
 *      can only happen when the Moon's ecliptic longitude coincides with
 *      the Sun's AND the Moon is near a node (ecliptic latitude close to
 *      0°). Both are checked independently.
 *
 * A failure here means the ephemeris itself has drifted from reality — a
 * different and more serious class of problem than a Pass 1/2 finding,
 * since every downstream sign/house/judgment computation inherits it.
 */
import { isoToJD, jdutToJdtt } from '@astrology/primitives/julianDay';
import { sunPosition } from '@astrology/primitives/moshier/sun';
import { moonPosition } from '@astrology/primitives/moshier/moon';
import { mercuryPosition } from '@astrology/primitives/moshier/planets';
import { lahiriAyanamsa } from '@astrology/primitives/ayanamsa';
import { angularDistance, signedSeparation } from '@astrology/primitives/angles';

function jdttFromUtc(iso: string) {
  return jdutToJdtt(isoToJD(iso));
}

describe('reference case 1: March equinox 2026', () => {
  const EQUINOX_UTC = '2026-03-20T14:46:00Z';

  it("puts the Sun's apparent tropical longitude at 0° at the published equinox instant", () => {
    const jdtt = jdttFromUtc(EQUINOX_UTC);
    const lon = sunPosition(jdtt).longitude;
    // Published time is accurate to the minute; the Sun moves ~0.00068°/min
    // at the equinox, and the low-precision formula itself is rated to
    // ~0.01°. 0.05° gives comfortable headroom over both error sources
    // while still being tight enough to catch a real defect (a degree-level
    // bug, a units mixup, a sign error) many times over.
    expect(angularDistance(lon, 0)).toBeLessThan(0.05);
  });

  it('crosses 0° moving forward (Sun longitude increasing) exactly at that instant', () => {
    // 30 minutes either side is well clear of publication-time rounding but
    // far too short for the equation-of-center to reverse direction, so this
    // isolates the crossing itself rather than any other solar motion.
    const before = sunPosition(jdttFromUtc('2026-03-20T14:16:00Z')).longitude;
    const after = sunPosition(jdttFromUtc('2026-03-20T15:16:00Z')).longitude;
    // before ≈ 359.97°, after ≈ 0.03° — both near the wrap, so compare via
    // signed offset from 360 rather than raw magnitude.
    const beforeSigned = before > 180 ? before - 360 : before;
    const afterSigned = after > 180 ? after - 360 : after;
    expect(beforeSigned).toBeLessThan(0);
    expect(afterSigned).toBeGreaterThan(0);
    expect(afterSigned).toBeGreaterThan(beforeSigned);
  });
});

describe('reference case 2: Lahiri ayanamsa at J2000.0', () => {
  it('matches the published J2000.0 value (23°51\'11" – 23°51\'12", implementation-dependent)', () => {
    const jdtt = jdttFromUtc('2000-01-01T12:00:00Z'); // the defining J2000.0 instant
    const value = lahiriAyanamsa(jdtt);
    // 23°51'11" = 23.85306°, 23°51'12" = 23.85333°. Center on 23.8532° with
    // a tolerance wide enough to cover both published variants plus the
    // cited 1-3 arcsecond cross-implementation spread, tight enough that a
    // wrong base constant (a transcribed arcminute/arcsecond error) fails.
    expect(value).toBeGreaterThan(23.85);
    expect(value).toBeLessThan(23.856);
  });
});

describe('reference case 3: the August 12, 2026 total solar eclipse', () => {
  const ECLIPSE_UTC = '2026-08-12T17:37:00Z';

  it('places the Sun and Moon at (nearly) the same apparent tropical longitude', () => {
    const jdtt = jdttFromUtc(ECLIPSE_UTC);
    const sunLon = sunPosition(jdtt).longitude;
    const moonLon = moonPosition(jdtt).longitude;
    // A solar eclipse requires exact syzygy; the published New Moon instant
    // is minute-precision, and the Moon moves ~0.55°/hour, so a fraction of
    // a degree of slop from publication rounding is expected. 1° is loose
    // enough to absorb that and tight enough to catch a real ephemeris bug
    // (a wrong node, a term transcribed with a flipped sign, a units bug).
    expect(angularDistance(sunLon, moonLon)).toBeLessThan(1);
  });

  it('places the Moon within eclipse range of a node (ecliptic latitude near 0°)', () => {
    // A solar eclipse is only geometrically possible near a lunar node.
    // Eclipse limits allow up to roughly ±1.5° of latitude for a partial
    // eclipse; this one is total, which requires closer alignment still.
    const jdtt = jdttFromUtc(ECLIPSE_UTC);
    const latitude = Math.abs(moonPosition(jdtt).latitude);
    expect(latitude).toBeLessThan(1.5);
  });
});

describe('reference case 4: Mercury retrograde stations, 2026', () => {
  // Published retrograde windows for 2026 (almanac sources, timezone-rounded
  // to the day): Feb 26 – Mar 20, Jun 29 – Jul 23, Oct 24 – Nov 13. Rather
  // than test near a station boundary (sensitive to exactly which timezone a
  // source rounded to), this checks a date deep inside a window against one
  // deep in direct motion — days of margin on both sides, so the assertion
  // is immune to any plausible rounding and isolates the actual direction of
  // motion, which is what `isRetrograde` (chartBuilder.ts: `speed < 0`) is
  // built on.
  function longitudeDeltaPerDay(iso: string): number {
    const before = mercuryPosition(jdttFromUtc(shiftDays(iso, -0.5))).longitude;
    const after = mercuryPosition(jdttFromUtc(shiftDays(iso, 0.5))).longitude;
    return signedSeparation(before, after); // positive = direct, negative = retrograde
  }

  function shiftDays(iso: string, days: number): string {
    return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
  }

  it('moves backward (retrograde) in the middle of the Feb 26 – Mar 20 window', () => {
    expect(longitudeDeltaPerDay('2026-03-10T00:00:00Z')).toBeLessThan(0);
  });

  it('moves backward (retrograde) in the middle of the Jun 29 – Jul 23 window', () => {
    expect(longitudeDeltaPerDay('2026-07-10T00:00:00Z')).toBeLessThan(0);
  });

  it('moves backward (retrograde) in the middle of the Oct 24 – Nov 13 window', () => {
    expect(longitudeDeltaPerDay('2026-11-02T00:00:00Z')).toBeLessThan(0);
  });

  it('moves forward (direct) well clear of any retrograde window', () => {
    expect(longitudeDeltaPerDay('2026-04-20T00:00:00Z')).toBeGreaterThan(0); // between window 1 and 2
    expect(longitudeDeltaPerDay('2026-09-01T00:00:00Z')).toBeGreaterThan(0); // between window 2 and 3
    expect(longitudeDeltaPerDay('2026-12-15T00:00:00Z')).toBeGreaterThan(0); // after window 3
  });
});
