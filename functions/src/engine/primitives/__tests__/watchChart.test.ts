/**
 * watchChart — unit tests.
 *
 * Verified against the user-supplied worked example: a question at 10:51 PM
 * (minute 51) puts Aquarius in house 1, and houses 2-12 cascade forward in
 * natural zodiacal order — confirmed against every house named in that
 * example (Taurus/4th, Leo/7th, Scorpio/10th, Cancer/6th, Virgo/8th,
 * Sagittarius/11th).
 */

import {
  computeWatchChart,
  clockHouseOfSign,
  signLordOf,
  directionOfSign,
  directionOfHouse,
  houseDirections,
} from '../watchChart';
import type { HouseIndex, SignIndex } from '../../types/chart';

const ARIES = 1,
  TAURUS = 2,
  GEMINI = 3,
  CANCER = 4,
  LEO = 5,
  VIRGO = 6,
  LIBRA = 7,
  SCORPIO = 8,
  SAGITTARIUS = 9,
  CAPRICORN = 10,
  AQUARIUS = 11,
  PISCES = 12;

describe('computeWatchChart', () => {
  test('minute 51 (10:51 PM example) -> Aquarius Lagna, houses cascade as worked', () => {
    const watch = computeWatchChart(51);
    expect(watch.bucketIndex).toBe(10); // 50-55 bucket
    expect(watch.lagnaSign).toBe(AQUARIUS);
    expect(watch.houseSigns).toEqual([
      AQUARIUS, // 1st
      PISCES, // 2nd
      ARIES, // 3rd
      TAURUS, // 4th
      GEMINI, // 5th
      CANCER, // 6th
      LEO, // 7th
      VIRGO, // 8th
      LIBRA, // 9th
      SCORPIO, // 10th
      SAGITTARIUS, // 11th
      CAPRICORN, // 12th
    ]);
  });

  test('minute 43 -> Sagittarius Lagna (41-45 example, using consistent 5-min boundaries)', () => {
    const watch = computeWatchChart(43);
    expect(watch.lagnaSign).toBe(SAGITTARIUS);
  });

  test.each([
    [0, ARIES],
    [4, ARIES],
    [5, TAURUS],
    [14, GEMINI],
    [15, CANCER],
    [29, VIRGO],
    [30, LIBRA],
    [59, PISCES],
  ])('minute %i -> sign %i', (minute, expectedSign) => {
    expect(computeWatchChart(minute).lagnaSign).toBe(expectedSign);
  });

  test('house wheel always has exactly the 12 signs, each once', () => {
    const watch = computeWatchChart(27);
    const sorted = [...watch.houseSigns].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('clockHouseOfSign', () => {
  test('finds the house for a given sign on the wheel', () => {
    const watch = computeWatchChart(51); // Aquarius Lagna
    expect(clockHouseOfSign(AQUARIUS as SignIndex, watch)).toBe(1);
    expect(clockHouseOfSign(TAURUS as SignIndex, watch)).toBe(4);
    expect(clockHouseOfSign(SCORPIO as SignIndex, watch)).toBe(10);
  });
});

describe('signLordOf', () => {
  test('classical sign lords', () => {
    expect(signLordOf(ARIES as SignIndex)).toBe('Mars');
    expect(signLordOf(AQUARIUS as SignIndex)).toBe('Saturn');
    expect(signLordOf(CANCER as SignIndex)).toBe('Moon');
    expect(signLordOf(PISCES as SignIndex)).toBe('Jupiter');
  });
});

describe('directionOfSign / directionOfHouse — Vastu mapping', () => {
  // Verified against 10 of the 12 rows in the user's worked Aquarius-Lagna
  // example table (the other 2 — Pisces/2nd and Taurus/4th — used 8-point
  // directions in that table, NE/SE, which this 4-cardinal implementation
  // reconciles to North/South respectively; see watchChart.ts's
  // SIGN_DIRECTIONS docstring for the full note).
  test('matches the worked 10:51 PM example on every unambiguous house', () => {
    const watch = computeWatchChart(51); // Aquarius Lagna
    const expected: Array<[HouseIndex, ReturnType<typeof directionOfSign>]> = [
      [1, 'West'], // Aquarius
      [3, 'East'], // Aries
      [5, 'West'], // Gemini
      [6, 'North'], // Cancer
      [7, 'East'], // Leo
      [8, 'South'], // Virgo
      [9, 'West'], // Libra
      [10, 'North'], // Scorpio
      [11, 'East'], // Sagittarius
      [12, 'South'], // Capricorn
    ];
    for (const [house, direction] of expected) {
      expect(directionOfHouse(house as HouseIndex, watch)).toBe(direction);
    }
  });

  test('direction follows classical element: fire=East, earth=South, air=West, water=North', () => {
    expect(directionOfSign(ARIES as SignIndex)).toBe('East');
    expect(directionOfSign(LEO as SignIndex)).toBe('East');
    expect(directionOfSign(SAGITTARIUS as SignIndex)).toBe('East');
    expect(directionOfSign(TAURUS as SignIndex)).toBe('South');
    expect(directionOfSign(VIRGO as SignIndex)).toBe('South');
    expect(directionOfSign(CAPRICORN as SignIndex)).toBe('South');
    expect(directionOfSign(GEMINI as SignIndex)).toBe('West');
    expect(directionOfSign(LIBRA as SignIndex)).toBe('West');
    expect(directionOfSign(AQUARIUS as SignIndex)).toBe('West');
    expect(directionOfSign(CANCER as SignIndex)).toBe('North');
    expect(directionOfSign(SCORPIO as SignIndex)).toBe('North');
    expect(directionOfSign(PISCES as SignIndex)).toBe('North');
  });

  test('houseDirections returns all 12 in house order', () => {
    const watch = computeWatchChart(51);
    const dirs = houseDirections(watch);
    expect(dirs).toHaveLength(12);
    expect(dirs[0]).toBe(directionOfHouse(1 as HouseIndex, watch));
    expect(dirs[9]).toBe(directionOfHouse(10 as HouseIndex, watch));
  });
});
