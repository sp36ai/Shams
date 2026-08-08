/**
 * watchChart — unit tests.
 *
 * Verified against the user-supplied worked example: a question at 10:51 PM
 * (minute 51) puts Aquarius in house 1, and houses 2-12 cascade forward in
 * natural zodiacal order — confirmed against every house named in that
 * example (Taurus/4th, Leo/7th, Scorpio/10th, Cancer/6th, Virgo/8th,
 * Sagittarius/11th).
 */

import { computeWatchChart, clockHouseOfSign, signLordOf } from '../watchChart';
import type { SignIndex } from '../../types/chart';

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
