/**
 * RKP significator helpers.
 *
 * Implements the 4-Level Significator Rule used in the RKP judgment engine:
 *   Level A — planets whose nakshatra lord = target planet → add their house
 *   Level B — house the target planet itself occupies
 *   Level C — houses whose cusp sign lord has target planet as nakshatra lord
 *   Level D — houses whose cusp sign lord = target planet
 *
 * Also provides houseOfPlanet / houseOfLongitude for direct house lookups.
 */

import { PLANETS } from '../../types/chart';
import type { Chart, Planet, HouseIndex, SignIndex } from '../../types/chart';
import { houseForLongitude } from '../../primitives/chartBuilder';

function cuspLongitudes(chart: Chart): readonly number[] {
  return chart.cusps.map(c => c.siderealLongitude);
}

/**
 * Returns which house (1–12) a planet occupies, based on sidereal longitude
 * vs. Placidus cusp boundaries.
 */
export function houseOfPlanet(planet: Planet, chart: Chart): HouseIndex {
  return houseForLongitude(chart.planets[planet].siderealLongitude, cuspLongitudes(chart));
}

/**
 * Returns which house a raw sidereal longitude falls in.
 */
export function houseOfLongitude(siderealLon: number, chart: Chart): HouseIndex {
  return houseForLongitude(siderealLon, cuspLongitudes(chart));
}

// ── Sign lord table ───────────────────────────────────────────────────────────

/** Classical Vedic sign lords for signs 1 (Aries) through 12 (Pisces). */
export const SIGN_LORDS: readonly Planet[] = Object.freeze([
  'Mars',     // 1  Aries
  'Venus',    // 2  Taurus
  'Mercury',  // 3  Gemini
  'Moon',     // 4  Cancer
  'Sun',      // 5  Leo
  'Mercury',  // 6  Virgo
  'Venus',    // 7  Libra
  'Mars',     // 8  Scorpio
  'Jupiter',  // 9  Sagittarius
  'Saturn',   // 10 Capricorn
  'Saturn',   // 11 Aquarius
  'Jupiter',  // 12 Pisces
] as const);

/** Returns the classical sign lord of the given sign index (1-based). */
export function signLordOf(sign: SignIndex): Planet {
  return SIGN_LORDS[sign - 1] as Planet;
}

// ── 4-Level Significator Scan ─────────────────────────────────────────────────

/**
 * Returns all houses signified by `planet` via the 4-level RKP scan.
 * Result is sorted 1–12, duplicates removed.
 *
 *   A: Houses occupied by planets whose nakshatraLord = planet
 *   B: House planet itself occupies
 *   C: Houses whose cusp sign lord has planet as its nakshatraLord
 *   D: Houses whose cusp sign lord = planet
 */
export function getSignifiedHouses(planet: Planet, chart: Chart): HouseIndex[] {
  const result = new Set<HouseIndex>();

  // Level B: planet's own occupied house
  result.add(houseOfPlanet(planet, chart));

  // Level A: planets whose nakshatraLord = planet → their occupied houses
  for (const p of PLANETS) {
    if (chart.planets[p].nakshatraLord === planet) {
      result.add(houseOfPlanet(p, chart));
    }
  }

  for (let i = 0; i < 12; i++) {
    const cusp = chart.cusps[i];
    if (cusp === undefined) {
      continue;
    }
    const cuspSignLord = signLordOf(cusp.sign);

    // Level D: this house's sign lord = planet
    if (cuspSignLord === planet) {
      result.add(cusp.house);
    }

    // Level C: this house's sign lord's nakshatraLord = planet
    if (chart.planets[cuspSignLord].nakshatraLord === planet) {
      result.add(cusp.house);
    }
  }

  return ([...result] as HouseIndex[]).sort((a, b) => a - b);
}
