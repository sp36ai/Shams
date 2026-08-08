import {
  aspectsHouse,
  debilitationSign,
  dignityOf,
  dignityRank,
  exaltationSign,
  houseDistance,
  housesAspectedBy,
  isBenefic,
  isMalefic,
  relationBetween,
} from '@astrology/rkp/rules';
import type { HouseNumber } from '@astrology/rkp/nomenclature';
import { PLANETS, type Planet } from '@astrology/types/chart';

describe('dignity', () => {
  it('places the classical exaltations', () => {
    expect(exaltationSign('Sun')).toBe(1); // Hamal
    expect(exaltationSign('Moon')).toBe(2); // Saur
    expect(exaltationSign('Mars')).toBe(10); // Jadi
    expect(exaltationSign('Mercury')).toBe(6); // Sunbula
    expect(exaltationSign('Jupiter')).toBe(4); // Sartan
    expect(exaltationSign('Venus')).toBe(12); // Hoot
    expect(exaltationSign('Saturn')).toBe(7); // Meezan
  });

  it('debilitation is always opposite exaltation', () => {
    for (const planet of PLANETS) {
      const diff = Math.abs(exaltationSign(planet) - debilitationSign(planet));
      expect(diff).toBe(6);
    }
  });

  it('reads exalted, debilitated and own placements', () => {
    expect(dignityOf('Sun', 1)).toBe('Exalted');
    expect(dignityOf('Sun', 7)).toBe('Debilitated');
    expect(dignityOf('Sun', 5)).toBe('OwnSign'); // Asad
    expect(dignityOf('Saturn', 11)).toBe('OwnSign'); // Dalw
    expect(dignityOf('Jupiter', 10)).toBe('Debilitated'); // Jadi
  });

  it('falls back to the relationship with the sign ruler', () => {
    // Zuhal in Sunbula: not exalted/debilitated/own; Sunbula is ruled by
    // Utarid, whom Zuhal counts a friend.
    expect(relationBetween('Saturn', 'Mercury')).toBe('Friend');
    expect(dignityOf('Saturn', 6)).toBe('FriendlySign');

    // Zuhal in Sartan: ruled by Qamar, whom Zuhal counts an enemy.
    expect(relationBetween('Saturn', 'Moon')).toBe('Enemy');
    expect(dignityOf('Saturn', 4)).toBe('EnemySign');
  });

  it('ranks dignities monotonically', () => {
    expect(dignityRank('Exalted')).toBeGreaterThan(dignityRank('OwnSign'));
    expect(dignityRank('OwnSign')).toBeGreaterThan(dignityRank('FriendlySign'));
    expect(dignityRank('FriendlySign')).toBeGreaterThan(dignityRank('NeutralSign'));
    expect(dignityRank('NeutralSign')).toBeGreaterThan(dignityRank('EnemySign'));
    expect(dignityRank('EnemySign')).toBeGreaterThan(dignityRank('Debilitated'));
  });

  it('assigns a dignity to every planet in every sign', () => {
    for (const planet of PLANETS) {
      for (let sign = 1; sign <= 12; sign += 1) {
        expect(dignityOf(planet, sign as 1)).toBeTruthy();
      }
    }
  });
});

describe('friendship', () => {
  it('is asymmetric where the classical table is asymmetric', () => {
    // Qamar counts Utarid a friend; Utarid does not reciprocate.
    expect(relationBetween('Moon', 'Mercury')).toBe('Friend');
    expect(relationBetween('Mercury', 'Moon')).toBe('Enemy');
  });

  it('gives every ordered pair a relation', () => {
    for (const a of PLANETS) {
      for (const b of PLANETS) {
        expect(['Friend', 'Neutral', 'Enemy']).toContain(relationBetween(a, b));
      }
    }
  });
});

describe('aspect', () => {
  it('counts house distance inclusively', () => {
    expect(houseDistance(1, 1)).toBe(1);
    expect(houseDistance(1, 7)).toBe(7);
    expect(houseDistance(10, 4)).toBe(7); // wraps
    expect(houseDistance(12, 1)).toBe(2);
  });

  it('gives every planet the seventh aspect', () => {
    for (const planet of PLANETS) {
      expect(aspectsHouse(planet, 1, 7)).toBe(true);
    }
  });

  it('gives Zuhal the 3rd, 7th and 10th', () => {
    expect(housesAspectedBy('Saturn', 1)).toEqual([3, 7, 10]);
    expect(aspectsHouse('Saturn', 1, 3)).toBe(true);
    expect(aspectsHouse('Saturn', 1, 10)).toBe(true);
    expect(aspectsHouse('Saturn', 1, 5)).toBe(false);
  });

  it('gives Mirrikh the 4th, 7th and 8th', () => {
    expect(housesAspectedBy('Mars', 1)).toEqual([4, 7, 8]);
  });

  it('gives Mushtari the 5th, 7th and 9th', () => {
    expect(housesAspectedBy('Jupiter', 1)).toEqual([5, 7, 9]);
  });

  it('wraps aspects around the wheel', () => {
    // Zuhal in the 11th aspects 1st (3rd from it), 5th, and 8th.
    expect(housesAspectedBy('Saturn', 11)).toEqual([1, 5, 8]);
  });

  it('keeps every aspected house in range', () => {
    for (const planet of PLANETS) {
      for (let house = 1; house <= 12; house += 1) {
        for (const aspected of housesAspectedBy(planet, house as HouseNumber)) {
          expect(aspected).toBeGreaterThanOrEqual(1);
          expect(aspected).toBeLessThanOrEqual(12);
        }
      }
    }
  });
});

describe('benefic and malefic classification', () => {
  it('splits the malefics from the benefics', () => {
    const malefics: Planet[] = ['Saturn', 'Mars', 'Rahu', 'Ketu'];
    for (const planet of malefics) {
      expect(isMalefic(planet)).toBe(true);
      expect(isBenefic(planet)).toBe(false);
    }
    expect(isBenefic('Jupiter')).toBe(true);
    expect(isBenefic('Venus')).toBe(true);
  });
});
