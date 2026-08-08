/**
 * classicalToolkit — dignity, benefic/malefic, drishti, and house-lord
 * condition analysis for the RKP watch engine.
 * --------------------------------------------------------------------------
 * Extracted from judgeRKPWatch.ts so the triad protocol (rkpTriad.ts) can
 * analyse the 1st, target and 11th houses with exactly the same machinery
 * the engine already used for the target house alone, without a circular
 * import.
 *
 * PROVENANCE: the RKP material specifies WHICH factors matter —
 *
 *   "Assess each planet using these 3 core metrics: A. Dignity and
 *    Functional Strength (Exalted / Own Sign / Debilitated / Retrograde)
 *    B. Planetary Aspects (Drishti Rules): Saturn aspects the 3rd, 7th and
 *    10th; Mars the 4th, 7th and 8th; Jupiter the 5th, 7th and 9th; all
 *    other planets aspect the 7th house directly opposite them."
 *
 * — and this module implements exactly that. The numeric WEIGHTS in
 * houseLordAnalysis()'s tally are not given by the RKP material; they are
 * the standard classical toolkit confirmed for this engine by the project
 * owner as a labelled default. See docs/RKP_WATCH_ENGINE.md.
 */

import type { Chart, HouseIndex, Planet, SignIndex } from '@astrology/types/chart';
import { PLANETS } from '@astrology/types/chart';
import type { HouseLordAnalysis, SupportDirection } from '@astrology/types/watchVerdict';
import {
  clockHouseOfPlanet,
  signLordOf,
  directionOfHouse,
  type WatchChart,
} from '@astrology/primitives/watchChart';

// ── Dignity tables (classical, undisputed) ─────────────────────────────────

const OWN_SIGNS: Readonly<Record<Planet, readonly SignIndex[]>> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11],
  Rahu: [],
  Ketu: [],
};

const EXALTED_SIGNS: Readonly<Record<Planet, readonly SignIndex[]>> = {
  Sun: [1],
  Moon: [2],
  Mars: [10],
  Mercury: [6],
  Jupiter: [4],
  Venus: [12],
  Saturn: [7],
  Rahu: [2, 3],
  Ketu: [8, 9],
};

const DEBILITATED_SIGNS: Readonly<Record<Planet, readonly SignIndex[]>> = {
  Sun: [7],
  Moon: [8],
  Mars: [4],
  Mercury: [12],
  Jupiter: [10],
  Venus: [6],
  Saturn: [1],
  Rahu: [8, 9],
  Ketu: [2, 3],
};

/**
 * Simplified natural benefic/malefic classification (Moon always benefic
 * here). Exhaustive over the 9 grahas: anything not in BENEFICS (i.e. Sun,
 * Mars, Saturn, Rahu, Ketu) is treated as malefic.
 */
export const BENEFICS: ReadonlySet<Planet> = new Set(['Jupiter', 'Venus', 'Mercury', 'Moon']);

/**
 * The three planets the RKP material names specifically as blockers:
 * "If Rahu, Ketu, or Mars are sitting in or aspecting your 6th house on the
 * clock face, it indicates structural fraud, hidden complications, or
 * eventual rejection unless corrections are made."
 */
export const BLOCKING_MALEFICS: ReadonlySet<Planet> = new Set(['Rahu', 'Ketu', 'Mars']);

/**
 * The two planets the RKP material names specifically as rescuers:
 * "If natural helper planets like Jupiter or Venus are currently transiting
 * through your 6th House or 11th House on the clock face, the loan will be
 * approved despite the delay."
 */
export const RESCUING_BENEFICS: ReadonlySet<Planet> = new Set(['Jupiter', 'Venus']);

export function dignityOf(
  planet: Planet,
  sign: SignIndex,
): 'exalted' | 'own' | 'debilitated' | 'neutral' {
  if (EXALTED_SIGNS[planet].includes(sign)) {
    return 'exalted';
  }
  if (OWN_SIGNS[planet].includes(sign)) {
    return 'own';
  }
  if (DEBILITATED_SIGNS[planet].includes(sign)) {
    return 'debilitated';
  }
  return 'neutral';
}

/**
 * Houses aspected (drishti) by a planet at `fromHouse`, exactly per the RKP
 * material's Drishti Rules: 7th for every planet, plus Mars' 4th/8th,
 * Jupiter's 5th/9th, Saturn's 3rd/10th.
 */
export function aspectedHousesFrom(planet: Planet, fromHouse: HouseIndex): HouseIndex[] {
  const offsets = [6]; // 7th-house aspect, universal
  if (planet === 'Mars') {
    offsets.push(3, 7); // 4th, 8th
  } else if (planet === 'Jupiter') {
    offsets.push(4, 8); // 5th, 9th
  } else if (planet === 'Saturn') {
    offsets.push(2, 9); // 3rd, 10th
  }
  return offsets.map(o => (((fromHouse - 1 + o) % 12) + 1) as HouseIndex);
}

/** Every planet currently occupying `house` on the clock wheel. */
export function occupantsOfHouse(chart: Chart, watch: WatchChart, house: HouseIndex): Planet[] {
  return PLANETS.filter(p => clockHouseOfPlanet(p, chart, watch) === house);
}

/** Every planet currently casting a drishti onto `house` on the clock wheel. */
export function aspectorsOfHouse(chart: Chart, watch: WatchChart, house: HouseIndex): Planet[] {
  return PLANETS.filter(p =>
    aspectedHousesFrom(p, clockHouseOfPlanet(p, chart, watch)).includes(house),
  );
}

/** Planets either occupying or aspecting `house` — the material's "sitting in or aspecting". */
export function touchingHouse(chart: Chart, watch: WatchChart, house: HouseIndex): Planet[] {
  const seen = new Set<Planet>([
    ...occupantsOfHouse(chart, watch, house),
    ...aspectorsOfHouse(chart, watch, house),
  ]);
  return PLANETS.filter(p => seen.has(p));
}

// ── House-lord support/obstruction analysis ────────────────────────────────

/**
 * Analyse the lord of `house` on the watch wheel: dignity, conjunction,
 * aspect (drishti), combustion, retrograde -> a net support tally.
 */
export function houseLordAnalysis(
  chart: Chart,
  watch: WatchChart,
  house: HouseIndex,
): HouseLordAnalysis {
  const sign = watch.houseSigns[house - 1] as SignIndex;
  const direction = directionOfHouse(house, watch);
  const lord = signLordOf(sign);
  const lordHouse = clockHouseOfPlanet(lord, chart, watch);
  const dignity = dignityOf(lord, chart.planets[lord].sign);

  const conjunctSupport: Planet[] = [];
  const conjunctObstruction: Planet[] = [];
  const aspectSupport: Planet[] = [];
  const aspectObstruction: Planet[] = [];

  for (const p of PLANETS) {
    if (p === lord) {
      continue;
    }
    const pHouse = clockHouseOfPlanet(p, chart, watch);
    if (pHouse === lordHouse) {
      (BENEFICS.has(p) ? conjunctSupport : conjunctObstruction).push(p);
    }
    if (aspectedHousesFrom(p, pHouse).includes(lordHouse)) {
      (BENEFICS.has(p) ? aspectSupport : aspectObstruction).push(p);
    }
  }

  const combust = chart.planets[lord].isCombust;
  const retrograde = chart.planets[lord].isRetrograde;

  const supportScore =
    (dignity === 'exalted' || dignity === 'own' ? 2 : 0) +
    (dignity === 'debilitated' ? -2 : 0) +
    conjunctSupport.length -
    conjunctObstruction.length +
    aspectSupport.length -
    aspectObstruction.length -
    (combust ? 1 : 0);

  const verdict: SupportDirection =
    supportScore > 0 ? 'supported' : supportScore < 0 ? 'obstructed' : 'mixed';

  return {
    house,
    sign,
    direction,
    lord,
    lordHouse,
    dignity,
    conjunctSupport: Object.freeze(conjunctSupport),
    conjunctObstruction: Object.freeze(conjunctObstruction),
    aspectSupport: Object.freeze(aspectSupport),
    aspectObstruction: Object.freeze(aspectObstruction),
    retrograde,
    combust,
    supportScore,
    verdict,
  };
}
