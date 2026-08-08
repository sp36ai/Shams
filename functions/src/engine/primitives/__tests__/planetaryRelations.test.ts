/**
 * planetaryRelations — the natural friendship/enmity table behind RKP's
 * ruler-clash test.
 */

import { relationBetween, relationFrom } from '../planetaryRelations';
import { PLANETS } from '../../types/chart';

describe('relationBetween — the two examples the RKP material gives', () => {
  test('Sun and Saturn are natural enemies (the loan example)', () => {
    expect(relationBetween('Sun', 'Saturn')).toBe('enemy');
    expect(relationBetween('Saturn', 'Sun')).toBe('enemy');
  });

  test('Moon and Jupiter are friendly, despite the table being one-sided', () => {
    // Jupiter counts the Moon a friend; the Moon counts Jupiter neutral.
    expect(relationFrom('Jupiter', 'Moon')).toBe('friend');
    expect(relationFrom('Moon', 'Jupiter')).toBe('neutral');
    // The mutual verdict the material asks for is 'friendly'.
    expect(relationBetween('Moon', 'Jupiter')).toBe('friend');
  });
});

describe('relationBetween — combination rule', () => {
  test('is symmetric for every pair of grahas', () => {
    for (const a of PLANETS) {
      for (const b of PLANETS) {
        expect(relationBetween(a, b)).toBe(relationBetween(b, a));
      }
    }
  });

  test('enmity from either side dominates a one-sided friendship', () => {
    // Mars counts Mercury an enemy; Mercury counts Mars neutral.
    expect(relationFrom('Mars', 'Mercury')).toBe('enemy');
    expect(relationFrom('Mercury', 'Mars')).toBe('neutral');
    expect(relationBetween('Mars', 'Mercury')).toBe('enemy');
  });

  test('a planet ruling both ends of the matter is not a clash', () => {
    expect(relationBetween('Mercury', 'Mercury')).toBe('friend');
    expect(relationBetween('Rahu', 'Rahu')).toBe('friend');
  });

  test('Venus and Saturn are friends; Venus and the Sun are enemies', () => {
    expect(relationBetween('Venus', 'Saturn')).toBe('friend');
    expect(relationBetween('Venus', 'Sun')).toBe('enemy');
  });

  test('Rahu and Ketu are neutral to everything — no invented relationships', () => {
    for (const p of PLANETS) {
      if (p !== 'Rahu') {
        expect(relationBetween('Rahu', p)).toBe(relationFrom(p, 'Rahu'));
      }
    }
    expect(relationBetween('Rahu', 'Saturn')).toBe('neutral');
    expect(relationBetween('Ketu', 'Jupiter')).toBe('neutral');
    expect(relationBetween('Rahu', 'Ketu')).toBe('neutral');
  });
});
