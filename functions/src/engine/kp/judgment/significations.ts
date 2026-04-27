/**
 * RKP house-placement helpers.
 *
 * The ONLY question the RKP engine asks about a planet is:
 *   "Which Placidus house does this planet occupy?"
 *
 * That is it. No 4-level CSL chain. No classic-KP significator weighting.
 * No pratyantar aggregation. Those belong to classic KP, not RKP.
 *
 * `houseOfPlanet` is used by judgeHorary to check:
 *   - Which house Moon's Sub-Lord occupies (primary signal)
 *   - Which house each Ruling Planet occupies (RP verification)
 */

import type { Chart, Planet, HouseIndex } from '../../types/chart';
import { houseForLongitude } from '../../primitives/chartBuilder';

function cuspLongitudes(chart: Chart): readonly number[] {
  return chart.cusps.map(c => c.siderealLongitude);
}

/**
 * Returns which house (1–12) a planet occupies, based on sidereal longitude
 * vs. Placidus cusp boundaries. This is the core lookup used throughout the
 * RKP judgment engine.
 */
export function houseOfPlanet(planet: Planet, chart: Chart): HouseIndex {
  return houseForLongitude(chart.planets[planet].siderealLongitude, cuspLongitudes(chart));
}

/**
 * Returns which house a raw sidereal longitude falls in.
 * Convenience wrapper for non-planet lookups (e.g. checking a cusp degree).
 */
export function houseOfLongitude(siderealLon: number, chart: Chart): HouseIndex {
  return houseForLongitude(siderealLon, cuspLongitudes(chart));
}
