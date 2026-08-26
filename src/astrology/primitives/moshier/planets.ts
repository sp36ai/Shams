/**
 * Outer + inner planet positions — heliocentric to true apparent geocentric
 * ecliptic longitude.
 * --------------------------------------------------------------------------
 * Mercury/Jupiter/Saturn: Meeus/Van Flandern-Pulkkinen low-precision
 * mean-longitude + equation-of-center series (< 1' claimed accuracy,
 * 1900-2100 CE), converted to geocentric via a flat 2D vector subtraction
 * (ecliptic latitude forced to 0 — see toGeocentricLongitude below).
 *
 * Venus/Mars: the actual VSOP87 planetary theory (vsop87Geocentric.ts,
 * vsop87VenusMarsData.ts — 30-50x more terms than the low-precision
 * formulas above), converted to geocentric via full 3D vector subtraction
 * (toGeocentric3D below), verified against an independent implementation
 * (Astronomy Engine) to ~1 arcsecond. This is the end state of the RKP
 * audit Pass 3 investigation into a real, measured accuracy problem — kept
 * here because the path to it is worth knowing before touching either
 * planet's code again:
 *
 *   1. Both planets landed several degrees from the Sun at their own
 *      published conjunction/opposition instants (Venus ~3.75° off,
 *      Mars ~1.17°) — should be within a fraction of a degree by
 *      definition of what those events are.
 *   2. First hypothesis: the flat 2D form (still used by Mercury/Jupiter/
 *      Saturn above) was amplifying a heliocentric error by discarding
 *      latitude near conjunction/opposition, where the planet's and
 *      Earth's heliocentric vectors nearly cancel in the subtraction.
 *      Switching to 3D vector subtraction using each planet's real
 *      orbital inclination barely moved the numbers (~3.75°→~3.67°,
 *      ~1.17°→~1.19°) — the 2D→3D correction to the in-plane components
 *      is itself tiny (a cos(inclination) factor, ≈0.998 for Venus).
 *      Wrong hypothesis, but the vector-subtraction amplification
 *      mechanism itself was real and is why Jupiter/Saturn (5-9x Earth's
 *      solar distance) never show this problem regardless of form.
 *   3. Second hypothesis: missing Meeus Table 33.b periodic perturbation
 *      terms (Venus had none in the low-precision formula, Mars had 2).
 *      Reading the actual primary source (Van Flandern & Pulkkinen 1979)
 *      disproved this: Venus's own periodic terms there total under 0.1°
 *      even fully applied — an order of magnitude too small.
 *   4. The actual finding, for Venus: cross-checking each planet's
 *      L(J2000.0) − M(J2000.0) against its published longitude of
 *      perihelion (ϖ = Ω + ω) — Mercury/Mars/Jupiter/Saturn matched to
 *      0.001°, Venus was off by ~162°. Its mean-anomaly epoch constant
 *      had been transcribed wrong — a genuine, isolated bug, not a
 *      precision limit. Fixing it (still visible in git history) closed
 *      Venus's conjunction-instant error to ~0.94°. Mars had no such bug
 *      (checked the same way) — its ~1.19° really was this formula
 *      family's truncation floor.
 *   5. Rather than patch the low-precision formula further for either
 *      planet, both were switched to the real VSOP87 series (this file's
 *      current state), closing the remaining residual to ~1 arcsecond —
 *      verified directly against Astronomy Engine's own computed output,
 *      not assumed from the term count alone.
 *
 * Without a geocentric step at all, apparent retrograde motion — a purely
 * geocentric-parallax effect from Earth's own orbital motion — could never
 * appear, no matter how carefully speed is computed downstream: a
 * heliocentric-only longitude is (to this precision) monotonic in time.
 *
 * Lunar nodes (Rahu/Ketu) are an unrelated, already-geocentric concept —
 * the Moon's own orbital nodes around Earth — and need no such conversion:
 *   Mean ascending node Ω = 125.0445479 - 1934.1362608·T (Meeus 47.7)
 *   Ketu = Ω + 180° (always opposite Rahu in KP)
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch.33–36         [MEEUS]
 *   - Moshier, *Astronomical Algorithms in C*, Ch.4–9            [MOSHIER]
 *   - Van Flandern, T. C., and Pulkkinen, K. F., "Low-Precision
 *     Formulae for Planetary Positions," ApJS 41:391-411, 1979 —
 *     source of Mercury/Jupiter/Saturn's L/M/e constants below
 *     (confirmed by directly reading the paper during the RKP
 *     audit, not assumed from citation alone).
 *   - VSOP87 (Bureau des Longitudes) — source of Venus/Mars's term
 *     series; see vsop87Geocentric.ts and vsop87VenusMarsData.ts
 *     for the full derivation and verification.
 */

import { normalize360, degToRad, radToDeg } from '../angles';
import { DEG_TO_RAD } from '../constants';
import { sunPosition } from './sun';
import type { JDtt } from '../julianDay';
import {
  venusHeliocentricEclipticOfDate,
  marsHeliocentricEclipticOfDate,
  type HeliocentricSpherical,
} from './vsop87Geocentric';

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

/**
 * Earth's own heliocentric position in rectangular ecliptic coordinates.
 * Earth's orbital inclination is 0 by definition of the ecliptic (the
 * ecliptic IS Earth's orbital plane), so z = 0 always — this needs no
 * separate orbital-element treatment the way Venus/Mars's z does.
 */
function earthHeliocentricXYZ(jdtt: JDtt): { x: number; y: number; z: number } {
  const earth = earthHeliocentric(jdtt);
  const lon = degToRad(earth.lonDeg);
  return { x: earth.r * Math.cos(lon), y: earth.r * Math.sin(lon), z: 0 };
}

/**
 * Heliocentric ecliptic-of-date spherical position (as vsop87Geocentric.ts
 * produces for Venus/Mars) → apparent geocentric ecliptic longitude AND
 * latitude, via full 3D vector subtraction against Earth's own
 * heliocentric position. See the file header for why Venus/Mars use this
 * instead of the flat 2D form (toGeocentricLongitude) that Mercury/
 * Jupiter/Saturn still use below.
 */
function toGeocentric3D(
  helio: HeliocentricSpherical,
  jdtt: JDtt,
): { longitude: number; latitude: number } {
  const helioLonRad = degToRad(helio.lonDeg);
  const helioLatRad = degToRad(helio.latDeg);
  const rCosLat = helio.r * Math.cos(helioLatRad);
  const helioX = rCosLat * Math.cos(helioLonRad);
  const helioY = rCosLat * Math.sin(helioLonRad);
  const helioZ = helio.r * Math.sin(helioLatRad);

  const earth = earthHeliocentricXYZ(jdtt);
  const x = helioX - earth.x;
  const y = helioY - earth.y;
  const z = helioZ - earth.z;
  return {
    longitude: normalize360(radToDeg(Math.atan2(y, x))),
    latitude: radToDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
  };
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

// ── Venus (VSOP87 — see vsop87Geocentric.ts) ───────────────────────────────

/**
 * RKP audit Pass 3, final fix: this used to be a Meeus-style mean-longitude
 * + equation-of-center formula (Van Flandern & Pulkkinen 1979), the same
 * family Mercury/Jupiter/Saturn below still use. Two real problems with it
 * for Venus specifically were found and fixed in that order — a wrong
 * mean-anomaly epoch constant (a genuine bug, see git history), and, once
 * that no longer explained the remaining ~0.94° conjunction-instant error,
 * the formula's own truncation floor (Venus's series here had zero Table
 * 33.b periodic perturbation terms). Rather than patch a low-precision
 * formula further, Venus now uses the actual VSOP87 planetary theory
 * (30-50x more terms) via vsop87Geocentric.ts, verified there to agree
 * with an independent, widely-used implementation (Astronomy Engine) to
 * about 1 arcsecond — three orders of magnitude better than what this
 * replaced.
 */
export function venusPosition(jdtt: JDtt): PlanetLonLat {
  const helio = venusHeliocentricEclipticOfDate(jdtt);
  const { longitude, latitude } = toGeocentric3D(helio, jdtt);
  return { longitude, latitude, radiusAU: helio.r };
}

// ── Mars (VSOP87 — see vsop87Geocentric.ts) ────────────────────────────────

/** See the comment on venusPosition() above — same fix, same reasoning. */
export function marsPosition(jdtt: JDtt): PlanetLonLat {
  const helio = marsHeliocentricEclipticOfDate(jdtt);
  const { longitude, latitude } = toGeocentric3D(helio, jdtt);
  return { longitude, latitude, radiusAU: helio.r };
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
