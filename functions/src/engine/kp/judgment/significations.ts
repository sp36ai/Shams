/**
 * Shared house-placement helper — used by BOTH judgment engines.
 *
 * The single question this module answers about a planet (or a raw
 * longitude) is: "Which Placidus house does this occupy?" That lookup is
 * pure astronomy, not judgment logic, so both judgeHorary.ts (RKP) and
 * judgeKP.ts (classical KP) depend on it identically. See
 * docs/RKP_VS_KP_SEPARATION.md for what each engine builds on top of it:
 *
 *   - judgeHorary (RKP): uses `houseOfPlanet` directly on Moon's Sub-Lord
 *     and each Ruling Planet for its house-placement scoring.
 *   - judgeKP (classical KP): uses `houseOfPlanet` inside the significator
 *     computation (significators.ts) and the Kotamraju filter.
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
