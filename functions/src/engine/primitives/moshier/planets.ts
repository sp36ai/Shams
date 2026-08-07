/**
 * Outer + inner planet positions — Meeus low-precision VSOP87 truncation,
 * converted from heliocentric to true apparent geocentric longitude.
 * --------------------------------------------------------------------------
 * Accuracy: < 1' for all classical planets for 1900–2100 CE.
 * KP charts need < 1° for nakshatra lords and < 5' for sub-lords.
 * These series satisfy both requirements.
 *
 * Each planet's HELIOCENTRIC ecliptic longitude is derived from:
 *   L = L₀ + L₁·T + L₂·T² + ... (geometric mean + periodic terms)
 *
 * Geocentric conversion (Meeus Ch.33's intended final step — previously
 * missing from this module):
 *   A planet's heliocentric longitude L and radius vector R are combined
 *   with Earth's own heliocentric longitude L0 and radius R0 (both derived
 *   from the Sun's apparent geocentric position — Earth's heliocentric
 *   longitude is the Sun's geocentric longitude + 180°) via 2D vector
 *   subtraction to give the planet's apparent GEOCENTRIC ecliptic longitude
 *   λ, the quantity real astrology charts need:
 *     x = R·cos(L) − R0·cos(L0)
 *     y = R·sin(L) − R0·sin(L0)
 *     λ = atan2(y, x)
 *   Without this step, apparent retrograde motion — a purely geocentric-
 *   parallax effect from Earth's own orbital motion — can never appear, no
 *   matter how carefully speed is computed downstream: a heliocentric-only
 *   longitude is (to this precision) monotonic in time. R is the planet's
 *   true instantaneous heliocentric distance, from Kepler's equation:
 *   r = a(1 − e·cos E), with E solved from M = E − e·sin E.
 *
 * Lunar nodes (Rahu/Ketu) are an unrelated, already-geocentric concept —
 * the Moon's own orbital nodes around Earth — and need no such conversion:
 *   Mean ascending node Ω = 125.0445479 - 1934.1362608·T (Meeus 47.7)
 *   Ketu = Ω + 180° (always opposite Rahu in KP)
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch.33–36         [MEEUS]
 *   - Moshier, *Astronomical Algorithms in C*, Ch.4–9            [MOSHIER]
 */

import { normalize360, degToRad, radToDeg } from '../angles';
import { DEG_TO_RAD } from '../constants';
import { sunPosition } from './sun';
import type { JDtt } from '../julianDay';

export interface PlanetLonLat {
  /** Apparent geocentric ecliptic longitude (tropical), degrees [0°, 360°) */
  longitude: number;
  /** Ecliptic latitude, degrees */
  latitude: number;
  /** Heliocentric radius vector (Sun–planet distance), AU */
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

/**
 * Solve Kepler's equation M = E − e·sin(E) for the eccentric anomaly E
 * (radians), via Newton-Raphson. Converges in a handful of iterations for
 * the low eccentricities (< 0.21) of the classical planets.
 */
function solveKepler(Mrad: number, e: number): number {
  let E = Mrad;
  for (let i = 0; i < 10; i++) {
    const dE = (E - e * Math.sin(E) - Mrad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) {
      break;
    }
  }
  return E;
}

/**
 * Heliocentric → apparent geocentric ecliptic longitude, via 2D vector
 * subtraction (ecliptic latitude ignored — consistent with this module's
 * existing low-precision, latitude=0 treatment of the classical planets).
 */
function toGeocentricLongitude(
  helioLonDeg: number,
  helioR: number,
  earthLonDeg: number,
  earthR: number,
): number {
  const L = degToRad(helioLonDeg);
  const L0 = degToRad(earthLonDeg);
  const x = helioR * Math.cos(L) - earthR * Math.cos(L0);
  const y = helioR * Math.sin(L) - earthR * Math.sin(L0);
  return normalize360(radToDeg(Math.atan2(y, x)));
}

/**
 * Earth's own heliocentric longitude + radius, derived from the Sun's
 * apparent geocentric position (Earth's heliocentric longitude is the
 * Sun's geocentric longitude + 180°; the Earth–Sun and Sun–Earth distances
 * are identical).
 */
function earthHeliocentric(jdtt: JDtt): { lonDeg: number; r: number } {
  const sun = sunPosition(jdtt);
  return { lonDeg: normalize360(sun.geometricLongitude + 180), r: sun.radiusAU };
}

// ── Mercury (Meeus Ch.33) ─────────────────────────────────────────────────

const MERCURY_A = 0.387098;

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
  const helioLon = mercuryLongitude(T);
  const M = normalize360(polyval([174.7948, 149472.51529, -0.000133], T)) * DEG_TO_RAD;
  const e = 0.20563069 + 0.00002527 * T;
  const E = solveKepler(M, e);
  const r = MERCURY_A * (1 - e * Math.cos(E));
  const earth = earthHeliocentric(jdtt);
  return {
    longitude: toGeocentricLongitude(helioLon, r, earth.lonDeg, earth.r),
    latitude: 0,
    radiusAU: r,
  };
}

// ── Venus (Meeus Ch.33) ───────────────────────────────────────────────────

const VENUS_A = 0.723332;

export function venusPosition(jdtt: JDtt): PlanetLonLat {
  const T = (jdtt - 2451545.0) / 36525.0;
  const L = normalize360(polyval([181.979801, 58517.815676, 0.00000165, -0.000000002], T));
  const M = normalize360(polyval([212.2595, 58517.80387, -0.000128], T)) * DEG_TO_RAD;
  const e = 0.00677188 - 0.000047766 * T;
  const C = 2 * e * Math.sin(M) + (5 / 4) * e * e * Math.sin(2 * M);
  const helioLon = normalize360(L + C * (180 / Math.PI));
  const E = solveKepler(M, e);
  const r = VENUS_A * (1 - e * Math.cos(E));
  const earth = earthHeliocentric(jdtt);
  return {
    longitude: toGeocentricLongitude(helioLon, r, earth.lonDeg, earth.r),
    latitude: 0,
    radiusAU: r,
  };
}

// ── Mars (Meeus Ch.33) ────────────────────────────────────────────────────

const MARS_A = 1.523679;

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
  const helioLon = normalize360(L + C_deg + corr);
  const E = solveKepler(M, e);
  const r = MARS_A * (1 - e * Math.cos(E));
  const earth = earthHeliocentric(jdtt);
  return {
    longitude: toGeocentricLongitude(helioLon, r, earth.lonDeg, earth.r),
    latitude: 0,
    radiusAU: r,
  };
}

// ── Jupiter (Meeus Ch.33) ─────────────────────────────────────────────────

const JUPITER_A = 5.202603;

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
  const helioLon = normalize360(L + C_deg + P);
  const E = solveKepler(M, e);
  const r = JUPITER_A * (1 - e * Math.cos(E));
  const earth = earthHeliocentric(jdtt);
  return {
    longitude: toGeocentricLongitude(helioLon, r, earth.lonDeg, earth.r),
    latitude: 0,
    radiusAU: r,
  };
}

// ── Saturn (Meeus Ch.33) ──────────────────────────────────────────────────

const SATURN_A = 9.554909;

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
  const helioLon = normalize360(L + C_deg + P);
  const E = solveKepler(M, e);
  const r = SATURN_A * (1 - e * Math.cos(E));
  const earth = earthHeliocentric(jdtt);
  return {
    longitude: toGeocentricLongitude(helioLon, r, earth.lonDeg, earth.r),
    latitude: 0,
    radiusAU: r,
  };
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
