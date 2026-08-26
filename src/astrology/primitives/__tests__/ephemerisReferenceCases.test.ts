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
 *   4. Mercury's three published 2026 retrograde windows — its geocentric
 *      longitude must move backward inside each and forward outside all
 *      of them.
 *
 *   5. Venus at inferior conjunction, 2025-03-23 01:00 UTC (earthsky.org /
 *      in-the-sky.org) — Venus sits between Earth and the Sun, so its
 *      geocentric longitude coincides with the Sun's, by definition.
 *
 *   6. Mars at opposition, 2025-01-16 ~01:00-01:17 UTC (multiple sources,
 *      averaged to 01:10 UTC) — Earth sits between Mars and the Sun, so
 *      Mars's geocentric longitude is the Sun's + 180°, by definition.
 *
 *   7. Jupiter at opposition, 2026-01-10 08:00 UTC (earthsky.org /
 *      in-the-sky.org / Fiske Planetarium) — same definition as Mars.
 *
 *   8. Saturn at opposition, 2025-09-21 06:00 UTC (earthsky.org /
 *      in-the-sky.org) — same definition again, closing out all seven
 *      classical bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn)
 *      against real, independently published events. Rahu/Ketu are pure
 *      geometric constructs (the Moon's own orbital nodes) rather than an
 *      observable body with an independently published position, so they
 *      have no analogous external reference case; their formula is a
 *      direct transcription of Meeus 47.7 and is exercised throughout
 *      Pass 2's structural tests instead.
 *
 * CASES 5 AND 6 FOUND A REAL ACCURACY LIMIT, AND THE FIRST FIX FOR IT
 * DIDN'T CLOSE IT — READ BOTH CASES' COMMENTS BEFORE TOUCHING EITHER.
 * Jupiter and Saturn (cases 7-8) land within arcminutes of their published
 * opposition instants. Venus and Mars (cases 5-6) do not — they land several
 * degrees off at the exact moment they're supposed to align with the Sun to
 * within a fraction of a degree. The original hypothesis was that
 * planets.ts's flat 2D geocentric conversion (latitude forced to 0) caused
 * this by amplifying a small heliocentric error through a short
 * vector-subtraction "baseline" near conjunction/opposition. venusPosition()
 * and marsPosition() were switched to full 3D vector subtraction on that
 * basis (see planets.ts header) — a genuine correctness improvement (both
 * now report real ecliptic latitude), but measured directly, it barely
 * moved the longitude error (~3.75°→~3.67° for Venus, ~1.17°→~1.19° for
 * Mars). The real cause, confirmed by comparing each planet's own computed
 * heliocentric longitude against Earth's at these exact published instants:
 * the amplification is structural to vector subtraction near conjunction/
 * opposition regardless of dimensionality, and what gets amplified is the
 * low-precision heliocentric longitude series' own truncation error
 * (Venus carries no Meeus Table 33.b periodic perturbation terms in this
 * module at all). This directly threatens Mercury/Venus combustion
 * detection specifically, since combustion is evaluated exactly when a
 * planet is near the Sun — the same geometry this measures. Closing this
 * needs a more accurate heliocentric series, verified with the same rigor
 * as this file's reference dates, not fixed here — Pass 3's job is to
 * establish ground truth, not rewrite the engine on a hypothesis alone.
 *
 * Opposition/conjunction/retrograde dates are exact, deterministic orbital
 * mechanics computed by observatories years in advance — not predictions in
 * the colloquial, uncertain sense — so a case landing after this file's
 * authorship date (e.g. part of case 4's third window) is exactly as
 * permanent a fact as one safely in the past.
 *
 * A failure here means the ephemeris itself has drifted from reality — a
 * different and more serious class of problem than a Pass 1/2 finding,
 * since every downstream sign/house/judgment computation inherits it.
 */
import { isoToJD, jdutToJdtt } from '@astrology/primitives/julianDay';
import { sunPosition } from '@astrology/primitives/moshier/sun';
import { moonPosition } from '@astrology/primitives/moshier/moon';
import {
  mercuryPosition,
  venusPosition,
  marsPosition,
  jupiterPosition,
  saturnPosition,
} from '@astrology/primitives/moshier/planets';
import { lahiriAyanamsa } from '@astrology/primitives/ayanamsa';
import { angularDistance, signedSeparation, normalize360 } from '@astrology/primitives/angles';

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

describe('reference case 5: Venus at inferior conjunction, 2025-03-23 01:00 UTC', () => {
  it('still lands several degrees from true conjunction after the 3D fix — a different root cause than 2D-vs-3D', () => {
    // FINDING (Pass 3, updated after the 3D geocentric-conversion fix):
    // switching venusPosition() to full 3D vector subtraction (see
    // planets.ts header) was the right fix to make on its own merits —
    // Venus now reports real, non-zero ecliptic latitude instead of a
    // flat 0 — but measured directly, it barely moved this number: ~3.75°
    // before, ~3.67° after. That is expected, not a failed fix: the 2D→3D
    // correction to the in-plane (x, y) components is itself tiny (a
    // cos(inclination) factor, ≈0.998 for Venus's 3.4°), so it was never
    // going to close a several-degree gap.
    //
    // The actual cause, confirmed by comparing this module's own computed
    // Venus heliocentric longitude against Earth's at this exact published
    // conjunction instant: they disagree by ~1.4°, which is the low-
    // precision heliocentric series' own truncation error (Venus has no
    // Meeus Table 33.b periodic perturbation terms in this module, unlike
    // Mars/Jupiter/Saturn below). Near conjunction, Venus's and Earth's
    // heliocentric vectors nearly cancel in the subtraction regardless of
    // 2D or 3D, so that ~1.4° error dominates and gets amplified into the
    // ~3.67° measured here — the same amplification mechanism that makes
    // Jupiter/Saturn's opposition checks land within arcminutes: their
    // own solar distance is 5-9x Earth's, so the same absolute
    // heliocentric error barely rotates the resultant vector.
    //
    // This is not academic: Venus's combustion threshold is 10°
    // (8° retrograde) — see constants.ts COMBUSTION_THRESHOLD_DEG — and
    // Venus is combust-relevant PRECISELY when it is near the Sun in the
    // sky, i.e. near this same conjunction geometry. A multi-degree
    // position error here is a meaningful fraction of that threshold, so a
    // borderline combustion call near conjunction carries real risk of
    // landing on the wrong side. Closing THIS gap needs a more accurate
    // heliocentric longitude series (more VSOP87 terms, or the missing
    // Table 33.b perturbations), verified with the same rigor as this
    // file's reference dates — not attempted here; filed as a distinct
    // follow-up rather than guessed at.
    const jdtt = jdttFromUtc('2025-03-23T01:00:00Z');
    const sunLon = sunPosition(jdtt).longitude;
    const venusLon = venusPosition(jdtt).longitude;
    const error = angularDistance(sunLon, venusLon);
    // Lower bound: proves the module header's "< 1' for all classical
    // planets" claim does not hold in this configuration — if this ever
    // drops below 0.1°, the heliocentric series was likely improved and
    // this whole comment block, and the combustion-risk follow-up, should
    // be revisited.
    expect(error).toBeGreaterThan(0.1);
    // Upper bound: still a sanity ceiling — catches a wrong orbital
    // element or a heliocentric/geocentric mixup, well beyond the ~3.67°
    // actually measured here.
    expect(error).toBeLessThan(6);
  });
});

describe('reference case 6: Mars at opposition, 2025-01-16 ~01:10 UTC', () => {
  it('still lands over a degree from true opposition after the 3D fix — same cause as case 5, milder', () => {
    // Same mechanism as case 5, and the same result from the 3D fix: ~1.17°
    // before, ~1.19° after — statistically unchanged, because (as in case 5)
    // the 2D→3D correction to Mars's in-plane (x, y) is itself tiny
    // (cos(1.85°) ≈ 0.9995). Mars's own heliocentric longitude agrees with
    // Earth's to ~0.46° at this exact instant (a smaller residual than
    // Venus's — Mars's low-precision series already includes 2 periodic
    // correction terms, Venus has none), but Mars's own solar distance
    // (~1.5 AU) is still close enough to Earth's (1 AU) for the vector-
    // subtraction baseline to amplify that residual into the ~1.19°
    // measured below. Milder than Venus's ~3.67° (Mars sits farther from
    // Earth than Venus ever does), same root cause (the heliocentric
    // series' own truncation error, not the flat-latitude omission this
    // file's Pass 3 originally suspected — see case 5's comment), and
    // comfortably inside Mars's own combustion threshold margin (17°), so
    // lower-risk for Mars than for Venus/Mercury — noted for completeness,
    // not urgency.
    // Published times for this event range from 01:00 to 02:32 UTC
    // depending on source; 01:10 is a reasonable midpoint, and the ~1.5
    // hour spread moves Mars against the Sun by well under a tenth of a
    // degree, so it does not explain the gap measured below.
    const jdtt = jdttFromUtc('2025-01-16T01:10:00Z');
    const sunLon = sunPosition(jdtt).longitude;
    const marsLon = marsPosition(jdtt).longitude;
    const error = angularDistance(marsLon, normalize360(sunLon + 180));
    expect(error).toBeGreaterThan(0.1); // same "claim doesn't hold here" marker as case 5
    expect(error).toBeLessThan(3); // sanity ceiling, ~2.5x the ~1.19° actually measured
  });
});

describe('reference case 7: Jupiter at opposition, 2026-01-10 08:00 UTC', () => {
  it('sits opposite the Sun — Earth is directly between Jupiter and the Sun', () => {
    const jdtt = jdttFromUtc('2026-01-10T08:00:00Z');
    const sunLon = sunPosition(jdtt).longitude;
    const jupiterLon = jupiterPosition(jdtt).longitude;
    expect(angularDistance(jupiterLon, normalize360(sunLon + 180))).toBeLessThan(0.5);
  });
});

describe('reference case 8: Saturn at opposition, 2025-09-21 06:00 UTC', () => {
  it('sits opposite the Sun — Earth is directly between Saturn and the Sun', () => {
    const jdtt = jdttFromUtc('2025-09-21T06:00:00Z');
    const sunLon = sunPosition(jdtt).longitude;
    const saturnLon = saturnPosition(jdtt).longitude;
    expect(angularDistance(saturnLon, normalize360(sunLon + 180))).toBeLessThan(0.5);
  });
});
