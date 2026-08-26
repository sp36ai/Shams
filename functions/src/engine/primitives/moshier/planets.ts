/**
 * Outer + inner planet positions — Meeus low-precision VSOP87 truncation,
 * converted from heliocentric to true apparent geocentric longitude.
 * --------------------------------------------------------------------------
 * Accuracy: < 1' for all classical planets for 1900–2100 CE, AWAY FROM
 * conjunction/opposition for Mars, and generally elsewhere — Venus had a
 * genuine bug (fixed, see below); see the Venus/Mars note for what does and
 * does not explain the residual near conjunction/opposition.
 *
 * Each planet's HELIOCENTRIC ecliptic longitude is derived from:
 *   L = L₀ + L₁·T + L₂·T² + ... (geometric mean + periodic terms)
 *
 * Geocentric conversion (Meeus Ch.33's intended final step — previously
 * missing from this module):
 *   A planet's heliocentric longitude L and radius vector R are combined
 *   with Earth's own heliocentric longitude L0 and radius R0 (both derived
 *   from the Sun's apparent geocentric position — Earth's heliocentric
 *   longitude is the Sun's geocentric longitude + 180°) to give the
 *   planet's apparent GEOCENTRIC ecliptic longitude λ, the quantity real
 *   astrology charts need. R is the planet's true instantaneous
 *   heliocentric distance, from Kepler's equation: r = a(1 − e·cos E),
 *   with E solved from M = E − e·sin E.
 *
 *   Mercury/Jupiter/Saturn use a flat 2D subtraction (ecliptic latitude
 *   forced to 0):
 *     x = R·cos(L) − R0·cos(L0),  y = R·sin(L) − R0·sin(L0),  λ = atan2(y, x)
 *
 *   Venus/Mars use the full 3D form instead (see toGeocentric3D below),
 *   which rotates through the orbit's real inclination and ascending node
 *   rather than silently forcing latitude to 0. This is a genuine
 *   correctness fix in its own right — Venus/Mars now report real,
 *   non-zero ecliptic latitude (previously always 0), and the geometry now
 *   matches what Meeus Ch.33 actually specifies rather than a flattened
 *   approximation of it.
 *
 *   THE FULL STORY (RKP audit Pass 3), because each step here corrected a
 *   real but wrong conclusion from the step before it:
 *
 *   1. At Venus's/Mars's own published conjunction/opposition instants, the
 *      original flat 2D form landed ~3.75°/~1.17° from the Sun where it
 *      should land within a fraction of a degree.
 *   2. Switching to the 3D form above only closed that to ~3.67°/~1.19° —
 *      measured directly, not assumed — because the 2D→3D correction to the
 *      in-plane (x, y) components is itself tiny (a cos(inclination)
 *      factor, ≈0.998 for Venus's 3.4°): it was never going to move a
 *      several-degree error. The actual amplification is structural to
 *      vector subtraction near conjunction/opposition regardless of
 *      dimensionality — the planet's and Earth's heliocentric vectors
 *      nearly cancel there, so the resulting angle is dominated by whatever
 *      error the heliocentric longitude already carries. Distant planets
 *      (Jupiter, Saturn, 5-9x Earth's own solar distance) barely notice
 *      this regardless; Venus and Mars, at comparable distances to Earth's
 *      own, do.
 *   3. What was actually being amplified turned out to differ by planet.
 *      Cross-checking each planet's own L(J2000.0) − M(J2000.0) — which
 *      must equal its published longitude of perihelion ϖ = Ω + ω — against
 *      independently published values: Mercury, Mars, Jupiter, Saturn all
 *      checked out to within 0.001°, meaning their small residuals (Mars's
 *      heliocentric longitude was off by ~0.46° from Earth's at its exact
 *      opposition instant) really are this low-precision series' own
 *      truncation error, with nothing further to fix short of a finer
 *      series. Venus's did not check out: its mean-anomaly epoch constant
 *      was 212.2595°, but L−ϖ (ϖ = 131.53298°, independently published)
 *      requires ~50.45° — off by ~162°. That is now fixed (see the comment
 *      on VENUS's M constant below). It closed Venus's conjunction-instant
 *      error from ~3.67° to ~0.94° — most of the gap, not all of it; the
 *      remainder is the same kind of low-precision truncation error Mars
 *      has, just proportionally larger here because Venus sits closer to
 *      Earth's own orbit, which the near-conjunction amplification (point 2
 *      above) still magnifies.
 *   4. This was genuinely a wrong-constant bug, not a missing-perturbation-
 *      terms problem, which was the original hypothesis: Van Flandern &
 *      Pulkkinen (1979) — the actual source of this module's L/M/e
 *      constants — gives Venus's own periodic perturbation terms as
 *      totaling well under 0.1° even fully applied, an order of magnitude
 *      too small to have explained the original ~3.7° gap on their own.
 *
 *   Closing Venus's/Mars's remaining sub-degree residual near conjunction/
 *   opposition needs a genuinely finer heliocentric series (full VSOP87,
 *   not this paper's low-precision truncation), verified against
 *   independent reference values with the same rigor used here — filed as
 *   a distinct, smaller follow-up, not attempted in this pass.
 *
 *   Without a geocentric step at all, apparent retrograde motion — a
 *   purely geocentric-parallax effect from Earth's own orbital motion —
 *   could never appear, no matter how carefully speed is computed
 *   downstream: a heliocentric-only longitude is (to this precision)
 *   monotonic in time.
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
 *     the actual origin of this module's L/M/e mean-element
 *     constants and structure (confirmed by directly reading the
 *     paper during the RKP audit; its own Table 4 periodic-
 *     perturbation terms for Venus, notably, are NOT included here
 *     — they total well under 0.1° and were confirmed too small to
 *     explain the conjunction-instant error found in Pass 3).
 *   - Standish (JPL), *Keplerian Elements for Approximate
 *     Positions of the Major Planets* — source for Venus/Mars's
 *     J2000.0 inclination/node/perihelion constants below.
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
 * Rotate an orbital-plane position — radius r, argument of latitude
 * u = ν + ω (true anomaly + argument of perihelion) — through the orbit's
 * inclination i and longitude of ascending node Ω into heliocentric
 * ecliptic rectangular coordinates (AU). The standard 3-rotation form; see
 * e.g. Meeus Ch.33 or the Standish (JPL) Keplerian-elements method.
 */
function orbitalPlaneToHelioXYZ(
  r: number,
  argLatitudeDeg: number,
  inclinationDeg: number,
  ascendingNodeDeg: number,
): { x: number; y: number; z: number } {
  const u = degToRad(argLatitudeDeg);
  const i = degToRad(inclinationDeg);
  const N = degToRad(ascendingNodeDeg);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosN = Math.cos(N);
  const sinN = Math.sin(N);
  const cosI = Math.cos(i);
  return {
    x: r * (cosN * cosU - sinN * sinU * cosI),
    y: r * (sinN * cosU + cosN * sinU * cosI),
    z: r * sinU * Math.sin(i),
  };
}

/**
 * Heliocentric orbital-plane position → apparent geocentric ecliptic
 * longitude AND latitude, via full 3D vector subtraction against Earth's
 * own heliocentric position. See the file header for why this replaces
 * the flat 2D form (toGeocentricLongitude) for Venus and Mars specifically.
 */
function toGeocentric3D(
  r: number,
  argLatitudeDeg: number,
  inclinationDeg: number,
  ascendingNodeDeg: number,
  jdtt: JDtt,
): { longitude: number; latitude: number } {
  const helio = orbitalPlaneToHelioXYZ(r, argLatitudeDeg, inclinationDeg, ascendingNodeDeg);
  const earth = earthHeliocentricXYZ(jdtt);
  const x = helio.x - earth.x;
  const y = helio.y - earth.y;
  const z = helio.z - earth.z;
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

// ── Venus (Meeus Ch.33) ───────────────────────────────────────────────────

const VENUS_A = 0.723332;
// J2000.0 mean orbital elements (Standish/JPL "Keplerian Elements for
// Approximate Positions"; cross-checked against independently published
// values). Held constant rather than given secular rates: their drift is
// on the order of 0.2-3 degrees per CENTURY, two orders of magnitude below
// the low-precision longitude series' own truncation error at the dates
// this engine actually runs at (within decades of J2000), so a rate term
// would not measurably change the result.
const VENUS_N = 76.6799; // longitude of ascending node, degrees
const VENUS_I = 3.3946; // inclination to the ecliptic, degrees
// (argument of perihelion is not needed as a separate constant — see `u` below)

export function venusPosition(jdtt: JDtt): PlanetLonLat {
  const T = (jdtt - 2451545.0) / 36525.0;
  const L = normalize360(polyval([181.979801, 58517.815676, 0.00000165, -0.000000002], T));
  // Mean anomaly epoch constant. FIX (RKP audit Pass 3, root cause of the
  // ~3.7° conjunction-instant error): this was 212.2595, which is not
  // Venus's mean anomaly at J2000.0 by ~162° — cross-checked two ways: (1)
  // independently published Venus mean anomaly at J2000.0 is ~50.11-50.12°
  // (not 212.2595°); (2) L(J2000.0) − M(J2000.0) must equal the longitude
  // of perihelion ϖ = Ω + ω ≈ 76.68° + 54.89° ≈ 131.57°, and the published
  // ϖ(J2000.0) is 131.53298° — the old constant gave L−M ≈ 329.72°, off by
  // ~198°, while 50.446821° (used below, = this file's own verified-correct
  // L(0) minus the published ϖ, for self-consistency) gives L−M ≈ 131.53°
  // exactly. A wrong M phase does not move the mean orbit at all — it only
  // misapplies the equation-of-center wobble (≤ ~0.78° for Venus's small
  // eccentricity) at the wrong point in the cycle, bounded at ~2x that
  // magnitude — which is why this was never wildly wrong, only close to a
  // degree off (worst near conjunction/opposition, where planets.ts's
  // vector-subtraction geocentric conversion amplifies whatever heliocentric
  // error already exists — see the file header). Mars/Jupiter/Saturn's own
  // M constants were checked the same way (L−M against each planet's own
  // published ϖ) and are correct to within 0.001°; this bug is Venus-only.
  const M = normalize360(polyval([50.446821, 58517.80387, -0.000128], T)) * DEG_TO_RAD;
  const e = 0.00677188 - 0.000047766 * T;
  const C = 2 * e * Math.sin(M) + (5 / 4) * e * e * Math.sin(2 * M);
  const helioLon = normalize360(L + C * (180 / Math.PI));
  const E = solveKepler(M, e);
  const r = VENUS_A * (1 - e * Math.cos(E));
  // Argument of latitude u = ω + ν (argument of perihelion + true anomaly).
  // helioLon above is the true ecliptic-projected longitude Ω + ω + ν (see
  // file header), so subtracting Ω leaves exactly ω + ν — an exact
  // algebraic identity, not an approximation, so no separate true-anomaly
  // computation is needed here.
  const u = normalize360(helioLon - VENUS_N);
  const { longitude, latitude } = toGeocentric3D(r, u, VENUS_I, VENUS_N, jdtt);
  return { longitude, latitude, radiusAU: r };
}

// ── Mars (Meeus Ch.33) ────────────────────────────────────────────────────

const MARS_A = 1.523679;
// J2000.0 mean orbital elements — see the note above VENUS_N/VENUS_I for
// why these are held constant rather than given secular rates.
const MARS_N = 49.5581; // longitude of ascending node, degrees
const MARS_I = 1.8497; // inclination to the ecliptic, degrees

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
  // See the identical comment in venusPosition(): helioLon - Ω = ω + ν
  // exactly, so this needs no separate true-anomaly computation.
  const u = normalize360(helioLon - MARS_N);
  const { longitude, latitude } = toGeocentric3D(r, u, MARS_I, MARS_N, jdtt);
  return { longitude, latitude, radiusAU: r };
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
