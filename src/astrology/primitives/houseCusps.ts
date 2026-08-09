/**
 * House cusp calculation — Placidus + Porphyry fallback.
 * --------------------------------------------------------------------------
 * Placidus is the standard system in KP/RKP horary. It divides the ecliptic
 * into houses by trisecting the semi-arc of diurnal and nocturnal motion.
 *
 * When |latitude| > 66.5°, Placidus breaks down (planets circumpolar, semi-arc
 * undefined). We fall back to Porphyry, which divides each quadrant equally.
 *
 * Inputs:
 *   - RAMC (Right Ascension of MC) in degrees — from siderealTime.ts
 *   - obliquity ε in degrees — from obliquity.ts or constant
 *   - geographic latitude φ in degrees
 *
 * Outputs:
 *   - Array of 12 house cusps, each in degrees [0°, 360°), tropical ecliptic.
 *   - Index 0 = Ascendant (cusp 1), index 9 = MC (cusp 10).
 *   - Cusps are numbered 1–12 but returned 0-indexed.
 *
 * Method — Placidus (Meeus Ch.40 / Michelsen):
 *   MC = RAMC converted to ecliptic longitude
 *   ASC derived from RAMC, ε, φ
 *   Intermediate cusps (11, 12, 2, 3) via iterative semi-arc trisection
 *   Opposite cusps = cusp[i] + 180°
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch.14 & 40      [MEEUS]
 *   - Michelsen, *Tables of Houses* (Placidus derivation)        [MICH]
 *   - Alvey, *Placidus House Cusps* algorithm (1993)             [ALVEY]
 */

import { normalize360 } from './angles';
import { DEG_TO_RAD, RAD_TO_DEG, PLACIDUS_LATITUDE_LIMIT_DEG } from './constants';

// ────────────────────────────────────────────────────────────────────────────
// MC and ASC from RAMC (Meeus Ch.14)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Medium Coeli (MC) ecliptic longitude from RAMC.
 * MC is where the equator's hour angle = RAMC intersects the ecliptic.
 *
 * @param ramcDeg     RAMC in degrees
 * @param obliquityDeg  Mean obliquity of ecliptic in degrees
 * @returns           MC ecliptic longitude in degrees [0°, 360°)
 */
export function mcFromRamc(ramcDeg: number, obliquityDeg: number): number {
  const ramcRad = ramcDeg * DEG_TO_RAD;
  const epsRad = obliquityDeg * DEG_TO_RAD;
  // tan(MC) = tan(RAMC) / cos(ε) — Meeus 14.3
  const tanMC = Math.tan(ramcRad) / Math.cos(epsRad);
  let mc = Math.atan(tanMC) * RAD_TO_DEG;
  // Resolve quadrant: MC must be within 90° of RAMC
  mc = normalize360(mc);
  if (Math.abs(normalize360(mc - ramcDeg) - 180) < 90) {
    mc = normalize360(mc + 180);
  }
  return mc;
}

/**
 * Ascendant ecliptic longitude.
 *
 * @param ramcDeg       RAMC in degrees
 * @param obliquityDeg  Obliquity of ecliptic in degrees
 * @param latDeg        Geographic latitude in degrees (North positive)
 * @returns             Ascendant longitude in degrees [0°, 360°)
 */
export function ascendant(ramcDeg: number, obliquityDeg: number, latDeg: number): number {
  const ramcRad = ramcDeg * DEG_TO_RAD;
  const epsRad = obliquityDeg * DEG_TO_RAD;
  const latRad = latDeg * DEG_TO_RAD;

  // Meeus 14.4 — Asc = atan2(cos(RAMC), -(sin(RAMC)·cos(ε) + tan(φ)·sin(ε)))
  const y = Math.cos(ramcRad);
  const x = -(Math.sin(ramcRad) * Math.cos(epsRad) + Math.tan(latRad) * Math.sin(epsRad));
  const asc = Math.atan2(y, x) * RAD_TO_DEG;
  return normalize360(asc);
}

// ────────────────────────────────────────────────────────────────────────────
// Placidus intermediate cusp solver
// ────────────────────────────────────────────────────────────────────────────

/**
 * Solve one Placidus cusp (houses 11, 12, 2, 3) by iterative semi-arc trisection.
 *
 * The Placidus method trisects the diurnal semi-arc for above-horizon cusps
 * and the nocturnal semi-arc for below-horizon cusps.
 *
 * @param ramcDeg      RAMC in degrees
 * @param obliquityDeg Obliquity in degrees
 * @param latDeg       Geographic latitude in degrees
 * @param fraction     1/3 for cusps 11 and 2; 2/3 for cusps 12 and 3
 * @param upper        true = diurnal (above horizon) arc; false = nocturnal
 * @returns            Cusp longitude in degrees [0°, 360°)
 */
function placidusIntermediateCusp(
  ramcDeg: number,
  obliquityDeg: number,
  latDeg: number,
  fraction: number,
  upper: boolean,
): number {
  const epsRad = obliquityDeg * DEG_TO_RAD;
  const latRad = latDeg * DEG_TO_RAD;

  // Semi-arc sign: upper arc (day houses) are added; nocturnal are subtracted
  const sign = upper ? 1 : -1;

  // Initial guess: interpolate between MC and ASC/DESC
  let lon = upper
    ? mcFromRamc(ramcDeg, obliquityDeg)
    : normalize360(mcFromRamc(ramcDeg, obliquityDeg) + 180);
  lon += sign * 30 * fraction * 3;

  // Iterate: Newton-style convergence, < 10 iterations typically
  for (let iter = 0; iter < 30; iter++) {
    const lonRad = lon * DEG_TO_RAD;
    // Declination of the point
    const decRad = Math.asin(Math.sin(epsRad) * Math.sin(lonRad));
    // Semi-arc: acos(−tan(φ)·tan(dec)) in degrees
    const tanProd = -Math.tan(latRad) * Math.tan(decRad);
    if (Math.abs(tanProd) > 1) {
      // Circumpolar — this shouldn't happen at latitudes we handle
      break;
    }
    const semiArcRad = Math.acos(tanProd);

    // Target RAMC for this cusp:
    // Cusp RAMC = RAMC(MC) ± semiArc * fraction
    const semiArc = semiArcRad * RAD_TO_DEG;
    const targetRA = ramcDeg + sign * semiArc * fraction;

    // We need lon such that its oblique ascension = targetRA
    // Oblique ascension: OA = atan2(sin(lon)*cos(ε), cos(lon)) in longitude space
    const targetRad = normalize360(targetRA) * DEG_TO_RAD;
    const newLon = normalize360(
      Math.atan2(
        Math.sin(targetRad),
        Math.cos(targetRad) * Math.cos(epsRad) + Math.tan(decRad) * Math.sin(epsRad),
      ) * RAD_TO_DEG,
    );

    const delta = Math.abs(normalize360(newLon - lon + 180) - 180);
    lon = newLon;
    if (delta < 1e-6) {
      break;
    }
  }

  return normalize360(lon);
}

// ────────────────────────────────────────────────────────────────────────────
// Porphyry fallback
// ────────────────────────────────────────────────────────────────────────────

/**
 * Porphyry house cusps.
 * Each quadrant (ASC→IC, IC→DSC, DSC→MC, MC→ASC) is divided into 3 equal parts.
 *
 * @returns 12 cusp longitudes, 0-indexed, 0 = cusp 1 (ASC)
 */
function porphyryCusps(mcLon: number, ascLon: number): number[] {
  const ic = normalize360(mcLon + 180);
  const dsc = normalize360(ascLon + 180);

  function trisect(from: number, to: number, n: 1 | 2): number {
    let span = normalize360(to - from);
    if (span === 0) {
      span = 360;
    }
    return normalize360(from + (span * n) / 3);
  }

  return [
    ascLon, // 1 ASC
    trisect(ascLon, ic, 1), // 2
    trisect(ascLon, ic, 2), // 3
    ic, // 4 IC
    trisect(ic, dsc, 1), // 5
    trisect(ic, dsc, 2), // 6
    dsc, // 7 DSC
    trisect(dsc, mcLon, 1), // 8
    trisect(dsc, mcLon, 2), // 9
    mcLon, // 10 MC
    trisect(mcLon, ascLon, 1), // 11
    trisect(mcLon, ascLon, 2), // 12
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export interface HouseCuspResult {
  /** 12 cusp longitudes (tropical), degrees [0°, 360°). Index 0 = cusp 1 (ASC). */
  cusps: readonly number[];
  /** Ascendant longitude in degrees */
  asc: number;
  /** MC longitude in degrees */
  mc: number;
  /** House system actually used */
  system: 'Placidus' | 'Porphyry';
}

/**
 * Compute 12 house cusps for a given time and place.
 *
 * @param ramcDeg      RAMC (= LMST) in degrees — from siderealTime.ramc()
 * @param obliquityDeg Obliquity of ecliptic in degrees
 * @param latDeg       Geographic latitude (North positive)
 * @returns            House cusp result with system used flag
 */
export function computeHouseCusps(
  ramcDeg: number,
  obliquityDeg: number,
  latDeg: number,
): HouseCuspResult {
  const usePorphyry = Math.abs(latDeg) >= PLACIDUS_LATITUDE_LIMIT_DEG;

  const mc = mcFromRamc(ramcDeg, obliquityDeg);
  const asc = ascendant(ramcDeg, obliquityDeg, latDeg);

  if (usePorphyry) {
    const cusps = porphyryCusps(mc, asc);
    return { cusps, asc, mc, system: 'Porphyry' };
  }

  // Placidus: compute 6 cusps, derive opposites
  const c11 = placidusIntermediateCusp(ramcDeg, obliquityDeg, latDeg, 1 / 3, true);
  const c12 = placidusIntermediateCusp(ramcDeg, obliquityDeg, latDeg, 2 / 3, true);
  const c02 = placidusIntermediateCusp(ramcDeg, obliquityDeg, latDeg, 1 / 3, false);
  const c03 = placidusIntermediateCusp(ramcDeg, obliquityDeg, latDeg, 2 / 3, false);

  const ic = normalize360(mc + 180);
  const dsc = normalize360(asc + 180);
  const c05 = normalize360(c11 + 180);
  const c06 = normalize360(c12 + 180);
  const c08 = normalize360(c02 + 180);
  const c09 = normalize360(c03 + 180);

  const cusps: number[] = [
    asc, // 1
    c02, // 2
    c03, // 3
    ic, // 4
    c05, // 5
    c06, // 6
    dsc, // 7
    c08, // 8
    c09, // 9
    mc, // 10
    c11, // 11
    c12, // 12
  ];

  return { cusps, asc, mc, system: 'Placidus' };
}
