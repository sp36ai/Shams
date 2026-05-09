/**
 * KP significator computation — Phase B.
 * --------------------------------------------------------------------------
 * Implements the classical KP 4-tier significator ranking for a Placidus house.
 *
 * KP RANKING (strongest to weakest):
 *   Tier 1: Planets whose nakshatra lord is an occupant of the house
 *   Tier 2: Planets directly occupying the house
 *   Tier 3: Planets whose nakshatra lord is the house lord (sign lord of cusp)
 *   Tier 4: The house lord itself
 *
 * Planet order within each tier follows the canonical PLANETS array so the
 * output is fully deterministic — no Set iteration ordering issues.
 */

import type { Chart, Planet, HouseIndex } from '@astrology/types/chart';
import { PLANETS } from '@astrology/types/chart';
import { houseOfPlanet } from './significations';
import { getSignLordByLongitude } from '@astrology/primitives/rulingPlanets';

// ── House occupants ───────────────────────────────────────────────────────────

/** Planets whose sidereal longitude falls within the given Placidus house. */
export function getHouseOccupants(chart: Chart, house: HouseIndex): readonly Planet[] {
  return PLANETS.filter(p => houseOfPlanet(p, chart) === house);
}

// ── 4-tier significator list for one house ────────────────────────────────────

/**
 * Returns the tier-ranked significator list for a single Placidus house.
 * Planets appear exactly once (first tier they qualify for wins).
 */
export function houseSignificators(chart: Chart, house: HouseIndex): readonly Planet[] {
  const occupants = getHouseOccupants(chart, house);

  const cusp = chart.cusps[house - 1];
  if (cusp === undefined) {
    return [];
  }
  const houseLord = getSignLordByLongitude(cusp.siderealLongitude);

  const result: Planet[] = [];
  const seen = new Set<Planet>();

  function addIfNew(p: Planet): void {
    if (!seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }

  // Tier 1: planets in nakshatra of any occupant
  for (const planet of PLANETS) {
    const nakLord = chart.planets[planet].nakshatraLord as Planet;
    if ((occupants as Planet[]).includes(nakLord)) {
      addIfNew(planet);
    }
  }

  // Tier 2: direct occupants
  for (const p of occupants) {
    addIfNew(p);
  }

  // Tier 3: planets in nakshatra of the house lord
  for (const planet of PLANETS) {
    const nakLord = chart.planets[planet].nakshatraLord as Planet;
    if (nakLord === houseLord) {
      addIfNew(planet);
    }
  }

  // Tier 4: house lord
  addIfNew(houseLord);

  return Object.freeze(result);
}

// ── Significator sets for a question ─────────────────────────────────────────

export interface SignificatorSets {
  /** Planets signifying the FAVORABLE houses (neutral witnesses removed). */
  readonly favorable: readonly Planet[];
  /** Planets signifying the DENIAL houses (neutral witnesses removed). */
  readonly denial: readonly Planet[];
  /** Planets signifying BOTH sides — excluded from scoring as contradictory. */
  readonly neutral: readonly Planet[];
}

/**
 * Compute the full significator picture for a question.
 *
 * 1. Union tier-ranked significators across all favorable houses → favorableSet.
 * 2. Union tier-ranked significators across all denial houses → denialSet.
 * 3. Intersection = neutral witnesses (signify both sides) → removed from both.
 * 4. Return three ordered, frozen arrays.
 */
export function computeSignificatorSets(
  chart: Chart,
  favorable: readonly number[],
  denial: readonly number[],
): SignificatorSets {
  const favorableSet = new Set<Planet>();
  const denialSet = new Set<Planet>();

  for (const h of favorable) {
    for (const p of houseSignificators(chart, h as HouseIndex)) {
      favorableSet.add(p);
    }
  }

  for (const h of denial) {
    for (const p of houseSignificators(chart, h as HouseIndex)) {
      denialSet.add(p);
    }
  }

  // Neutral witnesses: present in both sets — removed from scoring
  const neutralSet = new Set<Planet>();
  for (const p of favorableSet) {
    if (denialSet.has(p)) {
      neutralSet.add(p);
    }
  }
  for (const p of neutralSet) {
    favorableSet.delete(p);
    denialSet.delete(p);
  }

  // Re-order to canonical PLANETS array order for determinism
  return Object.freeze({
    favorable: Object.freeze(PLANETS.filter(p => favorableSet.has(p))),
    denial: Object.freeze(PLANETS.filter(p => denialSet.has(p))),
    neutral: Object.freeze(PLANETS.filter(p => neutralSet.has(p))),
  });
}
