/**
 * RKP watch chart — real planets placed into the watch-selected house frame.
 * --------------------------------------------------------------------------
 * Assembles the Digital Watch Oracle chart:
 *
 *   1. The watch minute selects the 1st Ghar        → watchGrid.ts
 *   2. The twelve signs rotate through the Ghars    → watchGrid.ts
 *   3. REAL sidereal planet positions are computed  → primitives/chartBuilder
 *   4. Each planet drops into the Ghar its real sign occupies
 *   5. Dignity and aspects are read off the tables  → rules.ts
 *
 * Step 3 is the point worth protecting: the planets are not simulated. They
 * come from the same Meeus/VSOP87 ephemeris the sky-frame chart builder uses,
 * with
 * genuine sidereal longitudes, retrograde motion and combustion. Only the
 * HOUSE FRAME is watch-derived (see the header of watchGrid.ts).
 *
 * LOCATION IS OPTIONAL, AND THAT IS EXACT — NOT AN APPROXIMATION
 *   `buildChart` takes lat/lon, but they feed only the house-cusp computation.
 *   Planetary positions derive from `jdtt` alone: they are apparent geocentric
 *   longitudes, identical for every observer on Earth at a given instant to
 *   well within this ephemeris's arc-minute accuracy. Since the watch frame
 *   replaces the cusps entirely, this mode needs no location at all — which is
 *   what lets a reading run the instant the app opens, with nothing asked of
 *   the querent. The default coordinates below are inert: they are consumed
 *   only by cusps we discard.
 */

import { buildChart } from '@astrology/primitives/chartBuilder';
import type { Planet, PlanetPosition, SignIndex } from '@astrology/types/chart';
import { PLANETS } from '@astrology/types/chart';

import {
  HOUSE_NUMBERS,
  PLANET_NAME,
  SIGN_META,
  type Direction,
  type HouseNumber,
  type Polarity,
} from './nomenclature';
import { dignityOf, housesAspectedBy, type Dignity } from './rules';
import { signOfHouse, watchWindowFromIso, type WatchWindow } from './watchGrid';

/** Coordinates used only to satisfy the cusp computation we then discard. */
const INERT_LOCATION = Object.freeze({ lat: 0, lon: 0 });

export interface WatchPlanet {
  readonly planet: Planet;
  /** Classical Arabic/Urdu name, e.g. "Zuhal". */
  readonly name: string;
  /** Real sidereal sign occupied. */
  readonly sign: SignIndex;
  /** Real degrees within that sign, [0, 30). */
  readonly degreeInSign: number;
  /** The Ghar this planet falls in, under the watch frame. */
  readonly house: HouseNumber;
  readonly isRetrograde: boolean;
  readonly isCombust: boolean;
  readonly dignity: Dignity;
  /** Ghars this planet casts an aspect on. */
  readonly aspects: readonly HouseNumber[];
}

export interface WatchHouse {
  readonly house: HouseNumber;
  readonly sign: SignIndex;
  /** Display form, e.g. "Burj Jadi". */
  readonly signName: string;
  /** Domicile ruler of the sign on this Ghar. */
  readonly ruler: Planet;
  readonly rulerName: string;
  readonly direction: Direction;
  readonly polarity: Polarity;
  /** Planets sitting in this Ghar. */
  readonly occupants: readonly Planet[];
  /** Planets aspecting this Ghar from elsewhere. */
  readonly aspectedBy: readonly Planet[];
}

export interface WatchChart {
  /** The moment as supplied, preserved verbatim for traceability. */
  readonly moment: string;
  readonly window: WatchWindow;
  readonly lagnaSign: SignIndex;
  readonly lagnaSignName: string;
  readonly lagnaRuler: Planet;
  /** Twelve Ghars, index 0 = 1st Ghar. */
  readonly houses: readonly WatchHouse[];
  readonly planets: Readonly<Record<Planet, WatchPlanet>>;
}

/**
 * Build the watch chart for a moment.
 *
 * @param iso8601  Moment of asking, ISO 8601. MUST carry the querent's local
 *                 offset (e.g. `2026-08-08T11:13:00+05:30`) — the watch minute
 *                 is read from the literal minute field. See watchGrid.ts.
 * @param location Optional. Does not affect the result; accepted so callers
 *                 that already hold a location can pass it through without a
 *                 special case.
 */
export function buildWatchChart(
  iso8601: string,
  location: { readonly lat: number; readonly lon: number } = INERT_LOCATION,
): WatchChart {
  const window = watchWindowFromIso(iso8601);
  const lagnaSign = window.lagnaSign;

  // Real ephemeris. Only `.planets` is consumed — the horizon-derived cusps
  // are discarded and replaced here by the watch frame.
  const { planets: realPlanets } = buildChart(iso8601, location.lat, location.lon);

  // Place each planet into the Ghar whose sign it really occupies.
  const placed = {} as Record<Planet, WatchPlanet>;
  for (const planet of PLANETS) {
    const real: PlanetPosition = realPlanets[planet];
    const house = (((real.sign - lagnaSign + 12) % 12) + 1) as HouseNumber;
    placed[planet] = {
      planet,
      name: PLANET_NAME[planet],
      sign: real.sign,
      degreeInSign: real.degreeInSign,
      house,
      isRetrograde: real.isRetrograde,
      isCombust: real.isCombust,
      dignity: dignityOf(planet, real.sign),
      aspects: housesAspectedBy(planet, house),
    };
  }

  const houses: WatchHouse[] = HOUSE_NUMBERS.map(house => {
    const sign = signOfHouse(lagnaSign, house);
    const meta = SIGN_META[sign];
    return {
      house,
      sign,
      signName: `Burj ${meta.name}`,
      ruler: meta.ruler,
      rulerName: PLANET_NAME[meta.ruler],
      direction: meta.direction,
      polarity: meta.polarity,
      occupants: Object.freeze(PLANETS.filter(p => placed[p].house === house)),
      aspectedBy: Object.freeze(PLANETS.filter(p => placed[p].aspects.includes(house))),
    };
  });

  return {
    moment: iso8601,
    window,
    lagnaSign,
    lagnaSignName: `Burj ${SIGN_META[lagnaSign].name}`,
    lagnaRuler: SIGN_META[lagnaSign].ruler,
    houses: Object.freeze(houses),
    planets: Object.freeze(placed),
  };
}

/** Convenience accessor — the Ghar record for a house number. */
export function houseOf(chart: WatchChart, house: HouseNumber): WatchHouse {
  const found = chart.houses[house - 1];
  if (found === undefined) {
    throw new RangeError(`[rkp] Chart has no ${house}th Ghar — chart is malformed.`);
  }
  return found;
}

/**
 * A single body's position, in the same (sign, degree-within-sign) terms
 * the rest of this file already speaks, plus a flattened 0-360 longitude
 * for callers (e.g. a UI rotation transform) that just want one number.
 */
export interface TransitPosition {
  readonly sign: SignIndex;
  /** Degrees within the sign, [0, 30). */
  readonly degreeInSign: number;
  /** (sign - 1) * 30 + degreeInSign, in [0, 360). */
  readonly longitude: number;
}

/**
 * Sun, Moon and Lagna position for this chart, for display/animation only —
 * never consumed by judgment (`watchJudgment.ts` never imports this).
 *
 * IMPORTANT — Lagna carries no `degreeInSign`. This is a whole-sign (Ghar)
 * system: the 1st Ghar begins exactly at the sign boundary, not at a
 * continuous Placidus ascendant degree. `lagna.longitude` is therefore
 * exactly `(lagnaSign - 1) * 30` — the true start of the sign, not an
 * approximation of a degree this system doesn't compute. Do not treat it
 * as ascendant-degree precision.
 */
export interface TransitCoordinates {
  readonly sun: TransitPosition;
  readonly moon: TransitPosition;
  readonly lagna: Omit<TransitPosition, 'degreeInSign'>;
}

function toLongitude(sign: SignIndex, degreeInSign: number): number {
  return (sign - 1) * 30 + degreeInSign;
}

/** Derive display/animation coordinates from an already-built chart. */
export function transitCoordinatesOf(chart: WatchChart): TransitCoordinates {
  const sun = chart.planets.Sun;
  const moon = chart.planets.Moon;
  return {
    sun: {
      sign: sun.sign,
      degreeInSign: sun.degreeInSign,
      longitude: toLongitude(sun.sign, sun.degreeInSign),
    },
    moon: {
      sign: moon.sign,
      degreeInSign: moon.degreeInSign,
      longitude: toLongitude(moon.sign, moon.degreeInSign),
    },
    lagna: { sign: chart.lagnaSign, longitude: toLongitude(chart.lagnaSign, 0) },
  };
}
