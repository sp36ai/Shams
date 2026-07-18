/**
 * Ruleset conformance — pins the engine's owner-critical constants to
 * docs/RKP_RULES_FROM_SARFARAZ.md (Astro Sarfaraz's source of truth).
 *
 * These values ARE the product's verdict logic. A silent transcription typo
 * here changes the answer for every reading, so this test asserts each table
 * against the documented ruleset rather than against the code's own values.
 */

import { HOUSE_MATRIX } from '@astrology/kp/rules/houseMatrix';
import { DASHA_SEQUENCE, DASHA_YEARS } from '@astrology/kp/rules/vimshottari';
import { DAY_LORDS, HORA_SEQUENCE } from '@astrology/primitives/rulingPlanets';

// Sets, so order is irrelevant — matches how favorable/denial are used.
const set = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

describe('House Matrix (§2) matches the owner ruleset', () => {
  // From docs/RKP_RULES_FROM_SARFARAZ.md §2 — favorable / denial / primary.
  const EXPECTED: Record<string, { fav: number[]; den: number[]; primary: number }> = {
    career: { fav: [6, 10, 11], den: [5, 8, 12], primary: 10 },
    marriage: { fav: [7, 11, 2], den: [6, 8, 12], primary: 7 },
    finance: { fav: [2, 6, 11], den: [8, 12], primary: 2 },
    health: { fav: [1, 5, 11], den: [6, 8, 12], primary: 1 },
    property: { fav: [4, 11, 2], den: [8, 12], primary: 4 },
    travel: { fav: [3, 9, 12], den: [], primary: 9 },
    business: { fav: [7, 10, 11], den: [6, 8, 12], primary: 7 },
    legal: { fav: [6, 11], den: [8, 12], primary: 6 },
    children: { fav: [5, 11, 2], den: [1, 4, 10], primary: 5 },
    education: { fav: [4, 9, 11], den: [8, 12], primary: 4 },
    lostitem: { fav: [2, 4, 11], den: [8, 12], primary: 2 },
  };

  for (const [qType, exp] of Object.entries(EXPECTED)) {
    it(`${qType}`, () => {
      const m = HOUSE_MATRIX[qType as keyof typeof HOUSE_MATRIX];
      expect(set(m.favorable)).toEqual(set(exp.fav));
      expect(set(m.denial)).toEqual(set(exp.den));
      expect(m.primary).toBe(exp.primary);
    });
  }
});

describe('Vimshottari (§3) matches the owner ruleset', () => {
  it('sequence starts at Ketu and follows the KP order', () => {
    expect(DASHA_SEQUENCE).toEqual([
      'Ketu',
      'Venus',
      'Sun',
      'Moon',
      'Mars',
      'Rahu',
      'Jupiter',
      'Saturn',
      'Mercury',
    ]);
  });

  it('mahadasha years are exact and total 120', () => {
    expect(DASHA_YEARS).toEqual({
      Ketu: 7,
      Venus: 20,
      Sun: 6,
      Moon: 10,
      Mars: 7,
      Rahu: 18,
      Jupiter: 16,
      Saturn: 19,
      Mercury: 17,
    });
    const total = Object.values(DASHA_YEARS).reduce((a, b) => a + b, 0);
    expect(total).toBe(120);
  });
});

describe('Ruling-planet tables (§4) match the owner ruleset', () => {
  it('day lords Sunday→Saturday', () => {
    expect(DAY_LORDS).toEqual([
      'Sun', // Sunday
      'Moon', // Monday
      'Mars', // Tuesday
      'Mercury', // Wednesday
      'Jupiter', // Thursday
      'Venus', // Friday
      'Saturn', // Saturday
    ]);
  });

  it('hora lords follow the Chaldean order', () => {
    expect(HORA_SEQUENCE).toEqual(['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars']);
  });
});
