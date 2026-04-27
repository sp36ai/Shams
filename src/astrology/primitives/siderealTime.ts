/**
 * Sidereal time — GMST and LMST calculation.
 * --------------------------------------------------------------------------
 * Greenwich Mean Sidereal Time (GMST) is the hour angle of the vernal
 * equinox at the Greenwich meridian. It is needed to:
 *   (a) convert RA/Dec (equatorial) to ecliptic longitude, and
 *   (b) compute the Midheaven (MC) and Ascendant for house cusps.
 *
 * Key points:
 *   - GMST is computed from JD(UT) — NOT JDE(TT). Mixing is a classic bug.
 *   - The IAU 1982 formula (Meeus Ch.12) is used for GMST in degrees.
 *   - Local Mean Sidereal Time (LMST) = GMST + observer_longitude.
 *   - Results are normalized to [0°, 360°) = [0h, 24h) for compatibility
 *     with the house cusp code that expects RAMC in degrees.
 *
 * Note on GAST:
 *   Greenwich APPARENT Sidereal Time (GAST) = GMST + equation of the
 *   equinoxes (nutation correction). For KP horary purposes the difference
 *   is < 1.2 arcsec (< 0.08s in time), negligible for chart accuracy.
 *   We use GMST throughout. The house cusp module can upgrade to GAST when
 *   the nutation module ships.
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch. 12          [MEEUS]
 *   - IAU 1982 System of Astronomical Constants                  [IAU1982]
 */

import { normalize360 } from './angles';
import { JD_J2000, JULIAN_CENTURY_DAYS } from './constants';
import type { JDut } from './julianDay';

// ────────────────────────────────────────────────────────────────────────────
// GMST coefficients — Meeus (1998) eq. 12.4 in degrees
// ────────────────────────────────────────────────────────────────────────────

// GMST at 0h UT on the Julian Day (degrees):
//   θ₀ = 100.4606184 + 36000.77004 · T₀ + 0.000387933 · T₀² − T₀³/38710000
// where T₀ = Julian centuries since J2000.0 for 0h UT of the day.
//
// Then add the diurnal rotation for the UT hours:
//   GMST = θ₀ + 360.98564724 · UT_fraction_of_day
//
// Full combined form (Meeus 12.4):
//   GMST = 280.46061837 + 360.98564736629 · (JD − J2000) + 0.000387933 · T² − T³/38710000
// where T is in Julian centuries from J2000.0 (UT scale).

const GMST_CONST = 280.46061837; // degrees at J2000.0 0h UT
const GMST_D1 = 360.98564736629; // degrees per Julian day (diurnal)
const GMST_T2 = 0.000387933; // degrees per century²
const GMST_T3_DIV = 38710000.0; // T³ denominator

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Greenwich Mean Sidereal Time for a given Julian Day (UT).
 *
 * @param jdut  Julian Day in Universal Time
 * @returns     GMST in degrees, normalized to [0°, 360°)
 */
export function gmstDegrees(jdut: JDut): number {
  const D = jdut - JD_J2000; // days since J2000.0
  const T = D / JULIAN_CENTURY_DAYS; // Julian centuries (UT)
  const gmst = GMST_CONST + GMST_D1 * D + GMST_T2 * T * T - (T * T * T) / GMST_T3_DIV;
  return normalize360(gmst);
}

/**
 * Local Mean Sidereal Time for an observer at the given geographic longitude.
 *
 * @param jdut       Julian Day in Universal Time
 * @param lonDeg     Observer's geographic longitude in degrees (East positive)
 * @returns          LMST in degrees, normalized to [0°, 360°)
 */
export function lmstDegrees(jdut: JDut, lonDeg: number): number {
  return normalize360(gmstDegrees(jdut) + lonDeg);
}

/**
 * GMST as decimal hours [0, 24).
 */
export function gmstHours(jdut: JDut): number {
  return gmstDegrees(jdut) / 15;
}

/**
 * LMST as decimal hours [0, 24).
 */
export function lmstHours(jdut: JDut, lonDeg: number): number {
  return lmstDegrees(jdut, lonDeg) / 15;
}

/**
 * Right Ascension of the Medium Coeli (RAMC) — the degree of the ecliptic
 * that culminates (crosses the meridian), in degrees [0°, 360°).
 *
 * For the purposes of house system calculation, RAMC = LMST in degrees.
 * This is the standard definition: the hour angle of the equinox at the
 * local meridian equals the local sidereal time.
 *
 * @param jdut    Julian Day (UT)
 * @param lonDeg  Observer geographic longitude (East positive, degrees)
 * @returns       RAMC in degrees [0°, 360°)
 */
export function ramc(jdut: JDut, lonDeg: number): number {
  return lmstDegrees(jdut, lonDeg);
}
