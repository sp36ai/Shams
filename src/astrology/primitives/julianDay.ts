/**
 * Julian Day conversions — Shams al-Asrār Phase 2 primitives
 * --------------------------------------------------------------------------
 * All Julian Day conversions in the engine route through this file. Engine
 * callers supply UTC-anchored inputs (ISO 8601 strings or epoch milliseconds);
 * outputs are Julian Day Numbers in UT and, when requested, TT.
 *
 * Key distinctions (read once, remember forever):
 *   - JD     : Julian Day in UT (Universal Time, close to civil UTC for our era)
 *   - JDE    : Julian Ephemeris Day = JD + ΔT/86400  (uses Terrestrial Time)
 *   - Delta-T: TT − UT, in SECONDS. Varies with time. ~69s in year 2000, ~74s
 *              in 2025. Engine uses Espenak-Meeus long-period polynomials.
 *
 * VSOP87, ELP2000, Swiss Ephemeris ALL expect JDE (TT-based) internally.
 * Sidereal time (GMST) is computed from JD (UT-based).
 * Mixing these is the single most common bug in astronomy software — we keep
 * them type-distinct at the type level.
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch. 7 & 10          [MEEUS]
 *   - Espenak & Meeus, "Polynomial Expressions for Delta T" (2007)  [EM2007]
 *   - IERS Bulletin A (for post-1973 tabulated ΔT)                  [IERSA]
 */

import { SECONDS_PER_DAY, JD_J2000, JULIAN_CENTURY_DAYS } from './constants';

// ────────────────────────────────────────────────────────────────────────────
// Branded types — make UT and TT Julian Days incompatible at the type level
// ────────────────────────────────────────────────────────────────────────────

/** Julian Day in Universal Time. Use for sidereal time, civil timestamps. */
export type JDut = number & { readonly __brand: 'JDut' };

/** Julian Ephemeris Day in Terrestrial Time. Use for VSOP87, ELP2000, Swiss. */
export type JDtt = number & { readonly __brand: 'JDtt' };

/** Construct a JDut from a raw number (internal use only) */
function asJDut(n: number): JDut {
  return n as JDut;
}

/** Construct a JDtt from a raw number (internal use only) */
function asJDtt(n: number): JDtt {
  return n as JDtt;
}

// ────────────────────────────────────────────────────────────────────────────
// Calendar date ↔ Julian Day (Meeus 7.1)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert a Gregorian or Julian calendar date to Julian Day Number.
 *
 * Auto-selects calendar:
 *   - dates on or after 1582-10-15 → Gregorian
 *   - dates on or before 1582-10-04 → Julian
 *   - dates in the 10-day gap (1582-10-05 ... 1582-10-14) do not exist and
 *     are mapped by continuous proleptic Gregorian extension (same as JPL)
 *
 * Input fields are in UT; output is JDut.
 *
 * Example: gregorianToJD(2000, 1, 1.5) === 2451545.0 (J2000.0)
 *
 * @param year   Gregorian year (can be negative for BCE; year 0 is 1 BCE)
 * @param month  1..12
 * @param day    Day of month with fractional part (e.g. 1.5 = noon of day 1)
 */
export function gregorianToJD(year: number, month: number, day: number): JDut {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new RangeError('gregorianToJD: non-finite input');
  }
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const inGregorian = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));

  let b = 0;
  if (inGregorian) {
    const a = Math.floor(y / 100);
    b = 2 - a + Math.floor(a / 4);
  }

  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;

  return asJDut(jd);
}

/**
 * Convert a Julian Day (UT) back to Gregorian calendar components.
 * Inverse of gregorianToJD for all dates on/after 1582-10-15.
 */
export interface CalendarDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31 + fractional
}

export function jdToGregorian(jd: JDut): CalendarDate {
  const jdPlus = jd + 0.5;
  const z = Math.floor(jdPlus);
  const f = jdPlus - z;

  let a: number;
  if (z < 2299161) {
    // Julian calendar
    a = z;
  } else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }

  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  return { year, month, day };
}

// ────────────────────────────────────────────────────────────────────────────
// ISO 8601 / JS Date ↔ Julian Day
// ────────────────────────────────────────────────────────────────────────────

/**
 * JavaScript Date → JDut.
 * Uses the Date's UTC components, NOT local time. This is the safe path for
 * engine inputs from React Native where device TZ may be wrong.
 */
export function dateToJD(date: Date): JDut {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new RangeError('dateToJD: invalid Date');
  }
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / (24 * 60) +
    date.getUTCSeconds() / SECONDS_PER_DAY +
    date.getUTCMilliseconds() / (SECONDS_PER_DAY * 1000);
  return gregorianToJD(y, m, d);
}

/**
 * JDut → JavaScript Date (UTC-anchored).
 */
export function jdToDate(jd: JDut): Date {
  const { year, month, day } = jdToGregorian(jd);
  const wholeDay = Math.floor(day);
  const fractionalDay = day - wholeDay;
  const totalMs = fractionalDay * SECONDS_PER_DAY * 1000;
  const hours = Math.floor(totalMs / 3_600_000);
  const minutesFloat = (totalMs - hours * 3_600_000) / 60_000;
  const minutes = Math.floor(minutesFloat);
  const secondsFloat = (minutesFloat - minutes) * 60;
  const seconds = Math.floor(secondsFloat);
  const ms = Math.round((secondsFloat - seconds) * 1000);
  return new Date(Date.UTC(year, month - 1, wholeDay, hours, minutes, seconds, ms));
}

/**
 * ISO 8601 UTC string → JDut.
 * Accepts any string JS `new Date(str)` parses to a valid moment.
 *
 * IMPORTANT: the input string MUST be UTC (trailing `Z` or explicit `+00:00`).
 * If the caller provides a local-time string without TZ, results will be wrong.
 */
export function isoToJD(iso: string): JDut {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new RangeError(`isoToJD: cannot parse "${iso}"`);
  }
  return dateToJD(d);
}

/**
 * Unix epoch milliseconds → JDut.
 */
export function epochMsToJD(ms: number): JDut {
  if (!Number.isFinite(ms)) {
    throw new RangeError(`epochMsToJD: non-finite input ${ms}`);
  }
  // JD at Unix epoch = 2440587.5
  return asJDut(2440587.5 + ms / (SECONDS_PER_DAY * 1000));
}

// ────────────────────────────────────────────────────────────────────────────
// Delta-T (TT − UT) — Espenak & Meeus 2007 polynomial expressions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Delta-T in seconds for a given Gregorian year (may include fractional part).
 *
 * Source: Fred Espenak & Jean Meeus, "Polynomial Expressions for Delta T"
 * NASA Eclipse Website, 2007.  https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html
 *
 * Valid from -1999 to +3000 CE. Outside that range we extrapolate with the
 * nearest polynomial — fine for astrology use cases (all real app traffic is
 * within ±100 years of now).
 *
 * Key values this function produces (for validation):
 *   deltaT(1900.0) ≈ −2.79 s  (actual historical value)
 *   deltaT(2000.0) ≈ 63.87 s
 *   deltaT(2025.0) ≈ 72–75 s  (projected; IERS Bulletin A refines annually)
 */
export function deltaTSeconds(year: number): number {
  const y = year;
  let u: number;
  let t: number;

  if (y < -500) {
    u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 500) {
    u = y / 100;
    return (
      10583.6 +
      u *
        (-1014.41 +
          u *
            (33.78311 + u * (-5.952053 + u * (-0.1798452 + u * (0.022174192 + u * 0.0090316521)))))
    );
  }
  if (y < 1600) {
    u = (y - 1000) / 100;
    return (
      1574.2 +
      u *
        (-556.01 +
          u *
            (71.23472 + u * (0.319781 + u * (-0.8503463 + u * (-0.005050998 + u * 0.0083572073)))))
    );
  }
  if (y < 1700) {
    t = y - 1600;
    return 120 + t * (-0.9808 + t * (-0.01532 + t / 7129));
  }
  if (y < 1800) {
    t = y - 1700;
    return 8.83 + t * (0.1603 + t * (-0.0059285 + t * (0.00013336 + t / -1174000)));
  }
  if (y < 1860) {
    t = y - 1800;
    return (
      13.72 +
      t *
        (-0.332447 +
          t *
            (0.0068612 +
              t *
                (0.0041116 +
                  t *
                    (-0.00037436 + t * (0.0000121272 + t * (-0.0000001699 + t * 0.000000000875))))))
    );
  }
  if (y < 1900) {
    t = y - 1860;
    return (
      7.62 + t * (0.5737 + t * (-0.251754 + t * (0.01680668 + t * (-0.0004473624 + t / 233174))))
    );
  }
  if (y < 1920) {
    t = y - 1900;
    return -2.79 + t * (1.494119 + t * (-0.0598939 + t * (0.0061966 + t * -0.000197)));
  }
  if (y < 1941) {
    t = y - 1920;
    return 21.2 + t * (0.84493 + t * (-0.0761 + t * 0.0020936));
  }
  if (y < 1961) {
    t = y - 1950;
    return 29.07 + t * (0.407 + t * (-1 / 233 + t / 2547));
  }
  if (y < 1986) {
    t = y - 1975;
    return 45.45 + t * (1.067 + t * (-1 / 260 + t / -718));
  }
  if (y < 2005) {
    t = y - 2000;
    return (
      63.86 +
      t * (0.3345 + t * (-0.060374 + t * (0.0017275 + t * (0.000651814 + t * 0.00002373599))))
    );
  }
  if (y < 2050) {
    t = y - 2000;
    return 62.92 + t * (0.32217 + t * 0.005589);
  }
  if (y < 2150) {
    u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  // y >= 2150
  u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/**
 * Delta-T as a fraction of a day.
 */
export function deltaTDays(year: number): number {
  return deltaTSeconds(year) / SECONDS_PER_DAY;
}

// ────────────────────────────────────────────────────────────────────────────
// UT ↔ TT conversions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert JD (UT) to JDE (TT).
 * JDE = JD + ΔT/86400
 */
export function jdutToJdtt(jd: JDut): JDtt {
  // Derive year from JD for ΔT lookup
  const { year, month, day } = jdToGregorian(jd);
  const fractionalYear = year + (month - 1) / 12 + (day - 1) / 365.25;
  return asJDtt(jd + deltaTDays(fractionalYear));
}

/**
 * Convert JDE (TT) back to JD (UT). Exact inverse of jdutToJdtt to float precision.
 */
export function jdttToJdut(jde: JDtt): JDut {
  // First pass: approximate ΔT using JDE directly (error < 1 ms)
  const approx = asJDut(jde);
  const { year, month, day } = jdToGregorian(approx);
  const fractionalYear = year + (month - 1) / 12 + (day - 1) / 365.25;
  return asJDut(jde - deltaTDays(fractionalYear));
}

// ────────────────────────────────────────────────────────────────────────────
// T: Julian centuries since J2000
// ────────────────────────────────────────────────────────────────────────────

/**
 * Julian centuries since J2000.0, based on JDE (TT).
 * T = (JDE − 2451545) / 36525
 *
 * Primary time variable for Meeus formulae. Dimensionless.
 */
export function julianCenturiesTT(jde: JDtt): number {
  return (jde - JD_J2000) / JULIAN_CENTURY_DAYS;
}

/**
 * Julian centuries since J2000.0, based on JD (UT).
 * Used for GMST and sidereal-time calculations where UT is the correct scale.
 */
export function julianCenturiesUT(jd: JDut): number {
  return (jd - JD_J2000) / JULIAN_CENTURY_DAYS;
}

// ────────────────────────────────────────────────────────────────────────────
// Convenience: ISO 8601 → (JDut, JDtt, T_TT) in one shot
// ────────────────────────────────────────────────────────────────────────────

export interface TimeScales {
  jdut: JDut;
  jdtt: JDtt;
  /** T = centuries since J2000 (TT) — primary input to Meeus formulae */
  T: number;
}

/**
 * Convert an ISO 8601 UTC string to all time scales the engine consumes.
 * Canonical entry point for every chart construction.
 */
export function resolveTimeScales(iso: string): TimeScales {
  const jdut = isoToJD(iso);
  const jdtt = jdutToJdtt(jdut);
  const T = julianCenturiesTT(jdtt);
  return { jdut, jdtt, T };
}
