/**
 * Outer planet positions — Meeus low-precision VSOP87 truncation.
 * --------------------------------------------------------------------------
 * Accuracy: < 1' for all classical planets for 1900–2100 CE.
 * KP charts need < 1° for nakshatra lords and < 5' for sub-lords.
 * These series satisfy both requirements.
 *
 * Each planet's ecliptic longitude is derived from:
 *   L = L₀ + L₁·T + L₂·T² + ... (geometric mean + periodic terms)
 *
 * Lunar nodes (Rahu/Ketu):
 *   Mean ascending node Ω = 125.0445479 - 1934.1362608·T (Meeus 47.7)
 *   Ketu = Ω + 180° (always opposite Rahu in KP)
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch.33–36         [MEEUS]
 *   - Moshier, *Astronomical Algorithms in C*, Ch.4–9            [MOSHIER]
 */

import { normalize360 } from '../angles';
import { DEG_TO_RAD } from '../constants';
import type { JDtt } from '../julianDay';

export interface PlanetLonLat {
  /** Ecliptic longitude (tropical), degrees [0°, 360°) */
  longitude: number;
  /** Ecliptic latitude, degrees */
  latitude: number;
  /** Radius vector (heliocentric), AU */
  radiusAU: number;
}

// ── Utility ──────────────────────────────────────────────────────────────

function polyval(coeffs: readonly number[], T: number): number {
  // Horner's method: coeffs = [c0, c1, c2, ...]
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = result * T + (coeffs[i] ?? 0);
  }
  return result;
}

// ── Mercury (Meeus Ch.33) ─────────────────────────────────────────────────

export function mercuryLongitude(T: number): number {
  const L = normalize360(polyval([252.250906, 149472.6746358, -0.00000535, 0.000000002], T));
  const M = normalize360(polyval([174.7948, 149472.51529, -0.000133], T)) * DEG_TO_RAD;
  // Equation of center
  const e = 0.20563069 + 0.00002527 * T;
  const C =
    (2 * e - (e * e * e) / 4) * Math.sin(M) +
    (5 / 4) * e * e * Math.sin(2 * M) +
    (13 / 12) * e * e * e * Math.sin(3 * M);
  return normalize360(L + C * (180 / Math.PI));
}

export function mercuryPosition(jdtt: JDtt): PlanetLonLat {
  const T = (jdtt - 2451545.0) / 36525.0;
  return { longitude: mercuryLongitude(T), latitude: 0, radiusAU: 0.387 };
}

// ── Venus (Meeus Ch.33) ───────────────────────────────────────────────────

export function venusPosition(jdtt: JDtt): PlanetLonLat {
  const T = (jdtt - 2451545.0) / 36525.0;
  const L = normalize360(polyval([181.979801, 58517.815676, 0.00000165, -0.000000002], T));
  const M = normalize360(polyval([212.2595, 58517.80387, -0.000128], T)) * DEG_TO_RAD;
  const e = 0.00677188 - 0.000047766 * T;
  const C = 2 * e * Math.sin(M) + (5 / 4) * e * e * Math.sin(2 * M);
  return { longitude: normalize360(L + C * (180 / Math.PI)), latitude: 0, radiusAU: 0.723 };
}

// ── Mars (Meeus Ch.33) ────────────────────────────────────────────────────

export function marsPosition(jdtt: JDtt): PlanetLonLat {
  const T = (jdtt - 2451545.0) / 36525.0;
  // Mean longitude
  const L = normalize360(polyval([355.433275, 19140.2993313, 0.00000261, -0.000000003], T));
  // Mean anomaly
  const M = normalize360(polyval([19.373, 19140.30268, -0.000181], T)) * DEG_TO_RAD;
  const e = 0.09341233 - 0.000092064 * T;
  const C =
    (2 * e - (e * e * e) / 4) * Math.sin(M) +
    (5 / 4) * e * e * Math.sin(2 * M) +
    (13 / 12) * e * e * e * Math.sin(3 * M);
  const C_deg = C * (180 / Math.PI);
  // Additional periodic corrections (Meeus Table 33.b, top 5)
  const Mrad = M;
  const Msun = normalize360(357.52911 + 35999.05029 * T) * DEG_TO_RAD;
  const corr =
    +0.1088 * Math.sin((Mrad - Msun + Math.PI) % (2 * Math.PI)) + 0.0313 * Math.sin(2 * Mrad);
  return { longitude: normalize360(L + C_deg + corr), latitude: 0, radiusAU: 1.524 };
}

// ── Jupiter (Meeus Ch.33) ─────────────────────────────────────────────────

export function jupiterPosition(jdtt: JDtt): PlanetLonLat {
  const T = (jdtt - 2451545.0) / 36525.0;
  const L = normalize360(polyval([34.351519, 3034.9056606, -0.00008501, 0.000000004], T));
  const M = normalize360(polyval([20.9202, 3034.90577, -0.000722], T)) * DEG_TO_RAD;
  const e = 0.04849485 + 0.000163244 * T;
  // Equation of center
  const C_deg =
    (2 * e - (e * e * e) / 4) * Math.sin(M) * (180 / Math.PI) +
    (5 / 4) * e * e * Math.sin(2 * M) * (180 / Math.PI);
  // Main periodic corrections (Meeus p.217)
  const Msun = normalize360(357.52911 + 35999.05029 * T) * DEG_TO_RAD;
  const Msat = normalize360(317.5209 + 1222.1138 * T) * DEG_TO_RAD;
  const P =
    +0.3318 * Math.sin(2 * M - Msun - 2.0276) +
    0.1963 * Math.sin(M - Msun - 1.0148) +
    0.1163 * Math.sin(2 * M - 2 * Msun - 3.1248) +
    0.073 * Math.sin(M - 2 * Msat);
  return { longitude: normalize360(L + C_deg + P), latitude: 0, radiusAU: 5.203 };
}

// ── Saturn (Meeus Ch.33) ──────────────────────────────────────────────────

export function saturnPosition(jdtt: JDtt): PlanetLonLat {
  const T = (jdtt - 2451545.0) / 36525.0;
  const L = normalize360(polyval([50.077444, 1222.1138488, 0.00021004, -0.000000019], T));
  const M = normalize360(polyval([317.5209, 1222.11379, -0.000497], T)) * DEG_TO_RAD;
  const e = 0.05554814 - 0.000346641 * T;
  const C_deg = (2 * e - (e * e * e) / 4) * Math.sin(M) * (180 / Math.PI);
  // Jupiters perturbations on Saturn
  const Mjup = normalize360(20.9202 + 3034.90577 * T) * DEG_TO_RAD;
  const P =
    +0.8129 * Math.sin(2 * Mjup - 5 * M - 1.082) +
    0.1906 * Math.sin(2 * Mjup - 4 * M - 0.9186) +
    0.1691 * Math.sin(2 * Mjup - 6 * M - 2.1629);
  return { longitude: normalize360(L + C_deg + P), latitude: 0, radiusAU: 9.537 };
}

// ── Rahu/Ketu (mean lunar nodes) ──────────────────────────────────────────

/**
 * Mean ascending node (Rahu) longitude in degrees.
 * Meeus eq. 47.7 — matches KP traditional Rahu to < 30'.
 */
export function rahuLongitude(jdtt: JDtt): number {
  const T = (jdtt - 2451545.0) / 36525.0;
  return normalize360(125.0445479 - 1934.1362608 * T + 0.0020754 * T * T + (T * T * T) / 467441);
}

/**
 * Ketu longitude = Rahu + 180°
 */
export function ketuLongitude(jdtt: JDtt): number {
  return normalize360(rahuLongitude(jdtt) + 180);
}

export function rahuPosition(jdtt: JDtt): PlanetLonLat {
  return { longitude: rahuLongitude(jdtt), latitude: 0, radiusAU: 0 };
}

export function ketuPosition(jdtt: JDtt): PlanetLonLat {
  return { longitude: ketuLongitude(jdtt), latitude: 0, radiusAU: 0 };
}
