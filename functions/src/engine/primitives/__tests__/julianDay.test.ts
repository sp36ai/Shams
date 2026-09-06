import { describe, it, expect } from 'vitest';

import {
  gregorianToJD,
  jdToGregorian,
  dateToJD,
  isoToJD,
  epochMsToJD,
  deltaTSeconds,
  jdutToJdtt,
  jdttToJdut,
} from '../julianDay';

/**
 * Golden-value regression tests for the time-scale layer every chart in this
 * app is built on (see julianDay.ts's own docstring: "Mixing [JD/JDE] is the
 * single most common bug in astronomy software").
 *
 * These pin published, independently-checkable reference values — not just
 * "whatever the code currently returns" — so a future edit that silently
 * breaks the UT/TT distinction, the Gregorian/Julian calendar switchover, or
 * the ΔT polynomial fails CI instead of shipping into every reading.
 *
 * References for the pinned values:
 *   - J2000.0 = JD 2451545.0 exactly, by definition (Meeus, Astronomical
 *     Algorithms 2nd ed., Ch. 7) — the epoch every modern ephemeris anchors to.
 *   - ΔT(2000.0) ≈ 63.87s and ΔT(1900.0) ≈ -2.79s are the values Espenak &
 *     Meeus's own published table gives for those years (the same source
 *     julianDay.ts cites and implements) — this is checking the
 *     implementation against its cited source, not against itself.
 */
describe('gregorianToJD — Gregorian calendar to Julian Day', () => {
  it('resolves J2000.0 exactly', () => {
    // Noon UT, 2000-01-01 — the standard astronomical epoch.
    expect(gregorianToJD(2000, 1, 1.5)).toBe(2451545.0);
  });

  it('resolves the Unix epoch', () => {
    // 1970-01-01T00:00:00 UTC = JD 2440587.5 (also checked independently via
    // epochMsToJD below — two different code paths, same answer).
    expect(gregorianToJD(1970, 1, 1.0)).toBe(2440587.5);
  });

  it('handles the Julian/Gregorian calendar switchover boundary correctly', () => {
    // 1582-10-04 (Julian) was immediately followed by 1582-10-15 (Gregorian) —
    // the ten days in between do not exist. gregorianToJD's docstring commits
    // to proleptic Gregorian extension through that gap; this pins the two
    // boundary dates one JD apart, exactly as a real calendar day should be.
    const lastJulianDay = gregorianToJD(1582, 10, 4);
    const firstGregorianDay = gregorianToJD(1582, 10, 15);
    expect(firstGregorianDay - lastJulianDay).toBe(1);
  });

  it('round-trips through jdToGregorian for a modern date', () => {
    const jd = gregorianToJD(2026, 8, 15.5);
    const back = jdToGregorian(jd);
    expect(back.year).toBe(2026);
    expect(back.month).toBe(8);
    expect(back.day).toBeCloseTo(15.5, 9);
  });
});

describe('dateToJD / isoToJD — UTC-anchored, never local time', () => {
  it('agrees with gregorianToJD for the same UTC instant', () => {
    expect(isoToJD('2000-01-01T12:00:00Z')).toBe(2451545.0);
    expect(dateToJD(new Date('2000-01-01T12:00:00Z'))).toBe(2451545.0);
  });

  it('reads UTC components regardless of stated offset', () => {
    // 06:00+05:30 and 00:30Z are the same instant. If this ever read local
    // wall-clock fields instead of UTC ones, these would silently diverge —
    // exactly the device-timezone bug julianDay.ts's dateToJD docstring
    // calls out.
    expect(isoToJD('2026-08-15T06:00:00+05:30')).toBe(isoToJD('2026-08-15T00:30:00Z'));
  });
});

describe('epochMsToJD', () => {
  it('resolves the Unix epoch to JD 2440587.5', () => {
    expect(epochMsToJD(0)).toBe(2440587.5);
  });

  it('agrees with the ISO-string path for the same instant', () => {
    const ms = Date.parse('2026-08-15T10:30:00.000Z');
    expect(epochMsToJD(ms)).toBeCloseTo(isoToJD('2026-08-15T10:30:00.000Z'), 9);
  });
});

describe('deltaTSeconds — Espenak & Meeus (2007) polynomial', () => {
  it('matches the published reference values the code itself cites', () => {
    // These are the exact figures in julianDay.ts's own docstring
    // ("Key values this function produces (for validation)") — pinning them
    // turns a comment into an enforced invariant.
    expect(deltaTSeconds(1900.0)).toBeCloseTo(-2.79, 2);
    expect(deltaTSeconds(2000.0)).toBeCloseTo(63.87, 1);
  });

  it('is continuous across the piecewise-polynomial segment boundaries', () => {
    // A discontinuity at a segment edge (e.g. an off-by-one in a `< y`
    // comparison) would put a step-function jump into every chart built for
    // a date near that boundary. None of these are exact — check they don't
    // jump by more than a fraction of a second across the seam.
    const boundaries = [500, 1600, 1700, 1800, 1860, 1900, 1920, 1941, 1961, 1986, 2005, 2050, 2150];
    for (const y of boundaries) {
      const just_before = deltaTSeconds(y - 0.001);
      const just_after = deltaTSeconds(y + 0.001);
      expect(Math.abs(just_after - just_before)).toBeLessThan(0.5);
    }
  });
});

describe('UT ↔ TT round trip', () => {
  it('jdttToJdut inverts jdutToJdtt to sub-millisecond precision', () => {
    const jdut = isoToJD('2026-08-15T10:30:00.000Z');
    const jdtt = jdutToJdtt(jdut);
    const back = jdttToJdut(jdtt);
    // Tolerance: 1e-9 days ≈ 0.0864 ms.
    expect(back).toBeCloseTo(jdut, 9);
  });

  it('produces a strictly later JDE than JDut for any modern date (ΔT > 0 since 1972)', () => {
    const jdut = isoToJD('2026-08-15T10:30:00.000Z');
    const jdtt = jdutToJdtt(jdut);
    expect(jdtt).toBeGreaterThan(jdut);
  });
});
