/**
 * RKP rule tables — dignity, planetary friendship, and aspect (Nazar).
 * --------------------------------------------------------------------------
 * Pure lookup logic over the classical tables. No astronomy, no time handling:
 * every function here takes already-computed positions and answers a rule
 * question about them. Kept separate from watchChart.ts so the tables can be
 * unit-tested directly.
 */

import type { Planet, SignIndex } from '@astrology/types/chart';
import { SIGN_META, type HouseNumber } from './nomenclature';

/* -------------------------------------------------------------------------- */
/*  Dignity                                                                   */
/* -------------------------------------------------------------------------- */

export type Dignity =
  | 'Exalted'
  | 'OwnSign'
  | 'FriendlySign'
  | 'NeutralSign'
  | 'EnemySign'
  | 'Debilitated';

/** Exaltation sign per planet. Debilitation is always the opposite sign. */
const EXALTATION: Readonly<Record<Planet, SignIndex>> = Object.freeze({
  Sun: 1, // Hamal
  Moon: 2, // Saur
  Mars: 10, // Jadi
  Mercury: 6, // Sunbula
  Jupiter: 4, // Sartan
  Venus: 12, // Hoot
  Saturn: 7, // Meezan
  // The nodes have no domicile; their exaltation is a school-dependent
  // convention. We follow the common assignment: Ras exalts in Saur,
  // Dhanab in Aqrab (each debilitating in the opposite sign).
  Rahu: 2,
  Ketu: 8,
});

/** Domicile (own) signs. The nodes rule no sign. */
const DOMICILE: Readonly<Record<Planet, readonly SignIndex[]>> = Object.freeze({
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11],
  Rahu: [],
  Ketu: [],
});

/** Sign opposite a given sign (180° away). */
function oppositeSign(sign: SignIndex): SignIndex {
  return (((sign + 5) % 12) + 1) as SignIndex;
}

export function exaltationSign(planet: Planet): SignIndex {
  return EXALTATION[planet];
}

export function debilitationSign(planet: Planet): SignIndex {
  return oppositeSign(EXALTATION[planet]);
}

/* -------------------------------------------------------------------------- */
/*  Natural friendship                                                        */
/* -------------------------------------------------------------------------- */

export type Relation = 'Friend' | 'Neutral' | 'Enemy';

/**
 * Classical natural-friendship table. Read as: FRIENDSHIP[a][b] is how planet
 * `a` regards planet `b`. The table is intentionally NOT symmetric — Qamar
 * counts Utarid a friend while Utarid counts Qamar an enemy, which is the
 * classical position and a meaningful asymmetry in judgment.
 */
const FRIENDSHIP: Readonly<Record<Planet, Readonly<Record<Planet, Relation>>>> = Object.freeze({
  Sun: {
    Sun: 'Friend',
    Moon: 'Friend',
    Mars: 'Friend',
    Mercury: 'Neutral',
    Jupiter: 'Friend',
    Venus: 'Enemy',
    Saturn: 'Enemy',
    Rahu: 'Enemy',
    Ketu: 'Enemy',
  },
  Moon: {
    Sun: 'Friend',
    Moon: 'Friend',
    Mars: 'Neutral',
    Mercury: 'Friend',
    Jupiter: 'Neutral',
    Venus: 'Neutral',
    Saturn: 'Neutral',
    Rahu: 'Enemy',
    Ketu: 'Enemy',
  },
  Mars: {
    Sun: 'Friend',
    Moon: 'Friend',
    Mars: 'Friend',
    Mercury: 'Enemy',
    Jupiter: 'Friend',
    Venus: 'Neutral',
    Saturn: 'Neutral',
    Rahu: 'Enemy',
    Ketu: 'Neutral',
  },
  Mercury: {
    Sun: 'Friend',
    Moon: 'Enemy',
    Mars: 'Neutral',
    Mercury: 'Friend',
    Jupiter: 'Neutral',
    Venus: 'Friend',
    Saturn: 'Neutral',
    Rahu: 'Friend',
    Ketu: 'Friend',
  },
  Jupiter: {
    Sun: 'Friend',
    Moon: 'Friend',
    Mars: 'Friend',
    Mercury: 'Enemy',
    Jupiter: 'Friend',
    Venus: 'Enemy',
    Saturn: 'Neutral',
    Rahu: 'Neutral',
    Ketu: 'Neutral',
  },
  Venus: {
    Sun: 'Enemy',
    Moon: 'Enemy',
    Mars: 'Neutral',
    Mercury: 'Friend',
    Jupiter: 'Neutral',
    Venus: 'Friend',
    Saturn: 'Friend',
    Rahu: 'Friend',
    Ketu: 'Friend',
  },
  Saturn: {
    Sun: 'Enemy',
    Moon: 'Enemy',
    Mars: 'Enemy',
    Mercury: 'Friend',
    Jupiter: 'Neutral',
    Venus: 'Friend',
    Saturn: 'Friend',
    Rahu: 'Friend',
    Ketu: 'Friend',
  },
  Rahu: {
    Sun: 'Enemy',
    Moon: 'Enemy',
    Mars: 'Enemy',
    Mercury: 'Friend',
    Jupiter: 'Neutral',
    Venus: 'Friend',
    Saturn: 'Friend',
    Rahu: 'Friend',
    Ketu: 'Neutral',
  },
  Ketu: {
    Sun: 'Enemy',
    Moon: 'Enemy',
    Mars: 'Friend',
    Mercury: 'Neutral',
    Jupiter: 'Neutral',
    Venus: 'Friend',
    Saturn: 'Friend',
    Rahu: 'Neutral',
    Ketu: 'Friend',
  },
});

/** How `subject` regards `other`. Asymmetric by design — see FRIENDSHIP. */
export function relationBetween(subject: Planet, other: Planet): Relation {
  return FRIENDSHIP[subject][other];
}

/**
 * Dignity of a planet sitting in a sign.
 *
 * Precedence: exaltation and debilitation are absolute placements and are
 * checked first; domicile next; otherwise dignity follows how the planet
 * regards the sign's ruler.
 */
export function dignityOf(planet: Planet, sign: SignIndex): Dignity {
  if (sign === exaltationSign(planet)) {
    return 'Exalted';
  }
  if (sign === debilitationSign(planet)) {
    return 'Debilitated';
  }
  if (DOMICILE[planet].includes(sign)) {
    return 'OwnSign';
  }
  const ruler = SIGN_META[sign].ruler;
  if (ruler === planet) {
    return 'OwnSign';
  }
  switch (relationBetween(planet, ruler)) {
    case 'Friend':
      return 'FriendlySign';
    case 'Enemy':
      return 'EnemySign';
    default:
      return 'NeutralSign';
  }
}

/**
 * Coarse strength ordering, for comparing two placements and for confidence
 * banding. Higher is stronger. Not a Shadbala score — a rank.
 */
export function dignityRank(dignity: Dignity): number {
  switch (dignity) {
    case 'Exalted':
      return 5;
    case 'OwnSign':
      return 4;
    case 'FriendlySign':
      return 3;
    case 'NeutralSign':
      return 2;
    case 'EnemySign':
      return 1;
    case 'Debilitated':
      return 0;
  }
}

/** Whether a placement is strong enough to carry a matter on its own. */
export function isStrong(dignity: Dignity): boolean {
  return dignityRank(dignity) >= 4;
}

/** Whether a placement is too weak to deliver without help. */
export function isWeak(dignity: Dignity): boolean {
  return dignityRank(dignity) <= 1;
}

/* -------------------------------------------------------------------------- */
/*  Aspect (Nazar / Drishti)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Special aspects by house-distance. Every planet aspects the 7th (the house
 * directly opposite). The malefics and Mushtari carry additional aspects.
 *
 * Distance is counted inclusively in the classical manner: the planet's own
 * house is 1, the next is 2, the opposite house is 7.
 */
const SPECIAL_ASPECT_DISTANCES: Readonly<Record<Planet, readonly number[]>> = Object.freeze({
  Sun: [7],
  Moon: [7],
  Mars: [4, 7, 8],
  Mercury: [7],
  Jupiter: [5, 7, 9],
  Venus: [7],
  Saturn: [3, 7, 10],
  // The nodes are given Mushtari's pattern, the common convention for shadow
  // points in this system.
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9],
});

/**
 * Inclusive house-distance from one house to another, counted forward.
 * Same house → 1, opposite house → 7. Always in [1, 12].
 */
export function houseDistance(from: HouseNumber, to: HouseNumber): number {
  return ((to - from + 12) % 12) + 1;
}

/** Whether `planet`, sitting in `planetHouse`, casts an aspect on `targetHouse`. */
export function aspectsHouse(
  planet: Planet,
  planetHouse: HouseNumber,
  targetHouse: HouseNumber,
): boolean {
  return SPECIAL_ASPECT_DISTANCES[planet].includes(houseDistance(planetHouse, targetHouse));
}

/** Every house a planet in `planetHouse` aspects. */
export function housesAspectedBy(planet: Planet, planetHouse: HouseNumber): readonly HouseNumber[] {
  return Object.freeze(
    SPECIAL_ASPECT_DISTANCES[planet].map(
      distance => (((planetHouse - 1 + distance - 1) % 12) + 1) as HouseNumber,
    ),
  );
}

/** Natural malefics — the planets that obstruct when they fall on a matter. */
export const MALEFICS: readonly Planet[] = Object.freeze(['Saturn', 'Mars', 'Rahu', 'Ketu']);

/** Natural benefics — the planets that protect and open a matter. */
export const BENEFICS: readonly Planet[] = Object.freeze(['Jupiter', 'Venus']);

export function isMalefic(planet: Planet): boolean {
  return MALEFICS.includes(planet);
}

export function isBenefic(planet: Planet): boolean {
  return BENEFICS.includes(planet);
}
