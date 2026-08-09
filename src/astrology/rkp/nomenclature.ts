/**
 * RKP nomenclature — classical Arabic/Urdu cosmic markers.
 * --------------------------------------------------------------------------
 * The app's interface language is English. Cosmic markers (signs, planets,
 * houses) are rendered with their classical Arabic/Persian/Urdu names, which
 * is the vocabulary of Ilm-e-Najoom and matches the product's identity.
 *
 * This module is PRESENTATION + RULE METADATA only. It holds no astronomy;
 * real positions come from `src/astrology/primitives/`.
 *
 * A note on element names: the classical Arabic element terms are
 *   Naari  (ناری)  = fire   — from nar, fire
 *   Khaki  (خاکی)  = earth  — from khak, dust
 *   Hawai  (ہوائی) = air    — from hawa, air
 *   Aabi   (آبی)   = water  — from aab, water
 * These are used as written above. (An earlier spec draft paired "Aabi" with
 * the air signs and "Khaki" with the water signs; that mapping is corrected
 * here, since aab is water and khak is earth.)
 */

import type { Planet, SignIndex } from '@astrology/types/chart';

/* -------------------------------------------------------------------------- */
/*  Planets                                                                   */
/* -------------------------------------------------------------------------- */

/** Classical Arabic/Urdu planet name, keyed by the engine's canonical Planet. */
export const PLANET_NAME: Readonly<Record<Planet, string>> = Object.freeze({
  Sun: 'Shams',
  Moon: 'Qamar',
  Mars: 'Mirrikh',
  Mercury: 'Utarid',
  Jupiter: 'Mushtari',
  Venus: 'Zuhrah',
  Saturn: 'Zuhal',
  // The lunar nodes — the Dragon's Head and Tail (al-Jawzahr). Shadow points
  // (Kawakib-e-Saaya), not bodies: the eclipse intersections of the Moon's
  // orbit with the ecliptic.
  Rahu: 'Ras al-Tinnin',
  Ketu: 'Dhanab al-Tinnin',
});

/** Short form for dense UI (chips, table cells) where the full node name is long. */
export const PLANET_NAME_SHORT: Readonly<Record<Planet, string>> = Object.freeze({
  Sun: 'Shams',
  Moon: 'Qamar',
  Mars: 'Mirrikh',
  Mercury: 'Utarid',
  Jupiter: 'Mushtari',
  Venus: 'Zuhrah',
  Saturn: 'Zuhal',
  Rahu: 'Ras',
  Ketu: 'Dhanab',
});

/** One-word archetype, used for narration tone. */
export const PLANET_ARCHETYPE: Readonly<Record<Planet, string>> = Object.freeze({
  Sun: 'Authority',
  Moon: 'Mind',
  Mars: 'Drive',
  Mercury: 'Logic',
  Jupiter: 'Wisdom',
  Venus: 'Finance',
  Saturn: 'Delay',
  Rahu: 'Illusion',
  Ketu: 'Separation',
});

/* -------------------------------------------------------------------------- */
/*  Signs (Burj)                                                              */
/* -------------------------------------------------------------------------- */

export type Element = 'Naari' | 'Khaki' | 'Hawai' | 'Aabi';
export type Direction = 'East' | 'South' | 'West' | 'North';

/**
 * Sign polarity. Odd signs read as active/assertive, even signs as
 * receptive/defensive — used to characterise the party controlling a matter.
 */
export type Polarity = 'Odd' | 'Even';

export interface SignMeta {
  readonly index: SignIndex;
  /** Classical Arabic/Urdu name, without the "Burj" prefix. */
  readonly name: string;
  /** English name — kept for accessibility labels and analytics only. */
  readonly englishName: string;
  readonly element: Element;
  /**
   * Compass direction of the sign, by element. This is the bridge from the
   * chart to the querent's physical space.
   */
  readonly direction: Direction;
  readonly polarity: Polarity;
  /** Domicile ruler (classical, 7-planet scheme — nodes rule no sign). */
  readonly ruler: Planet;
}

/** 1-based, matching SignIndex (1 = Hamal/Aries .. 12 = Hoot/Pisces). */
export const SIGN_META: Readonly<Record<SignIndex, SignMeta>> = Object.freeze({
  1: {
    index: 1,
    name: 'Hamal',
    englishName: 'Aries',
    element: 'Naari',
    direction: 'East',
    polarity: 'Odd',
    ruler: 'Mars',
  },
  2: {
    index: 2,
    name: 'Saur',
    englishName: 'Taurus',
    element: 'Khaki',
    direction: 'South',
    polarity: 'Even',
    ruler: 'Venus',
  },
  3: {
    index: 3,
    name: 'Jauza',
    englishName: 'Gemini',
    element: 'Hawai',
    direction: 'West',
    polarity: 'Odd',
    ruler: 'Mercury',
  },
  4: {
    index: 4,
    name: 'Sartan',
    englishName: 'Cancer',
    element: 'Aabi',
    direction: 'North',
    polarity: 'Even',
    ruler: 'Moon',
  },
  5: {
    index: 5,
    name: 'Asad',
    englishName: 'Leo',
    element: 'Naari',
    direction: 'East',
    polarity: 'Odd',
    ruler: 'Sun',
  },
  6: {
    index: 6,
    name: 'Sunbula',
    englishName: 'Virgo',
    element: 'Khaki',
    direction: 'South',
    polarity: 'Even',
    ruler: 'Mercury',
  },
  7: {
    index: 7,
    name: 'Meezan',
    englishName: 'Libra',
    element: 'Hawai',
    direction: 'West',
    polarity: 'Odd',
    ruler: 'Venus',
  },
  8: {
    index: 8,
    name: 'Aqrab',
    englishName: 'Scorpio',
    element: 'Aabi',
    direction: 'North',
    polarity: 'Even',
    ruler: 'Mars',
  },
  9: {
    index: 9,
    name: 'Qaus',
    englishName: 'Sagittarius',
    element: 'Naari',
    direction: 'East',
    polarity: 'Odd',
    ruler: 'Jupiter',
  },
  10: {
    index: 10,
    name: 'Jadi',
    englishName: 'Capricorn',
    element: 'Khaki',
    direction: 'South',
    polarity: 'Even',
    ruler: 'Saturn',
  },
  11: {
    index: 11,
    name: 'Dalw',
    englishName: 'Aquarius',
    element: 'Hawai',
    direction: 'West',
    polarity: 'Odd',
    ruler: 'Saturn',
  },
  12: {
    index: 12,
    name: 'Hoot',
    englishName: 'Pisces',
    element: 'Aabi',
    direction: 'North',
    polarity: 'Even',
    ruler: 'Jupiter',
  },
});

/** Display form with the classical prefix, e.g. "Burj Hamal". */
export function burjName(sign: SignIndex): string {
  return `Burj ${SIGN_META[sign].name}`;
}

/* -------------------------------------------------------------------------- */
/*  Houses (Ghar / Bait)                                                      */
/* -------------------------------------------------------------------------- */

export type HouseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const HOUSE_NUMBERS: readonly HouseNumber[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const);

/**
 * Classical house names. `bait` is the Arabic term; `domain` is the plain
 * English gloss shown alongside it, since the app narrates in English.
 */
export const HOUSE_META: Readonly<Record<HouseNumber, { bait: string; domain: string }>> =
  Object.freeze({
    1: { bait: 'Bait-ul-Nafs', domain: 'Self, body, vitality' },
    2: { bait: 'Bait-ul-Maal', domain: 'Wealth, family, speech' },
    3: { bait: 'Bait-ul-Aqriba', domain: 'Effort, siblings, short travel' },
    4: { bait: 'Bait-ul-Arz', domain: 'Property, mother, peace of home' },
    5: { bait: 'Bait-ul-Awlad', domain: 'Children, intellect, speculation' },
    6: { bait: 'Bait-ul-Marz', domain: 'Debt, disease, disputes, enemies' },
    7: { bait: 'Bait-ul-Zaujah', domain: 'Partner, marriage, clients' },
    8: { bait: 'Bait-ul-Maut', domain: 'Inheritance, secrets, upheaval' },
    9: { bait: 'Bait-ul-Safar', domain: 'Fortune, long journeys, wisdom' },
    10: { bait: 'Bait-ul-Izzat', domain: 'Career, honour, standing' },
    11: { bait: 'Bait-ul-Raja', domain: 'Gains, fulfilment of desire' },
    12: { bait: 'Bait-ul-Khauf', domain: 'Loss, expense, isolation, exile' },
  });

/** Ordinal label, e.g. "6th Ghar". */
export function gharLabel(house: HouseNumber): string {
  const suffix = house === 1 ? 'st' : house === 2 ? 'nd' : house === 3 ? 'rd' : 'th';
  return `${house}${suffix} Ghar`;
}
