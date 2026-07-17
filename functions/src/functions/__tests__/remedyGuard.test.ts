import { describe, it, expect } from 'vitest';

import {
  guardOracleRemedy,
  findForbiddenRemedyTerm,
  findForbiddenTermInText,
  ISLAMIC_FALLBACK_REMEDY,
} from '../remedyGuard';

type OracleRemedy = Parameters<typeof guardOracleRemedy>[0];

const cleanRemedy: OracleRemedy = {
  quran_verse: 'Ayat al-Kursi (2:255) — recite once at dawn.',
  asma: 'Ya Fattah — يا فتاح — The Opener. 70 times after Fajr.',
  dua: 'Rabbi ishrah li sadri — My Lord, expand for me my breast.',
  zikr: 'SubhanAllah 33 times after each prayer.',
  sadaqah: 'Give to someone seeking what you have been granted.',
};

describe('remedyGuard — clean Islamic remedies pass through', () => {
  it('returns the remedy untouched and not blocked', () => {
    const result = guardOracleRemedy(cleanRemedy);
    expect(result.blocked).toBe(false);
    expect(result.remedy).toBe(cleanRemedy);
  });

  it('finds no forbidden term in a clean remedy', () => {
    expect(findForbiddenRemedyTerm(cleanRemedy)).toBeNull();
  });

  it('treats undefined remedy as clean', () => {
    const result = guardOracleRemedy(undefined);
    expect(result.blocked).toBe(false);
    expect(result.remedy).toBeUndefined();
  });
});

describe('remedyGuard — non-Islamic remedies are replaced with the fallback', () => {
  const forbiddenCases: Array<[string, OracleRemedy]> = [
    ['gemstone', { ...cleanRemedy, sadaqah: 'Wear a yellow sapphire gemstone on Thursday.' }],
    ['ratna', { ...cleanRemedy, dua: 'Wear a navratna ring for planetary balance.' }],
    ['rudraksha', { ...cleanRemedy, zikr: 'Wear a 5-mukhi rudraksha bead.' }],
    ['yantra', { ...cleanRemedy, quran_verse: 'Install a Shri yantra at home.' }],
    ['mantra', { ...cleanRemedy, zikr: 'Chant the Gayatri mantra 108 times.' }],
    ['puja', { ...cleanRemedy, sadaqah: 'Perform a puja for Shani.' }],
    ['havan', { ...cleanRemedy, sadaqah: 'Arrange a havan to remove obstacles.' }],
    ['graha shanti', { ...cleanRemedy, dua: 'Do a graha shanti ritual.' }],
    ['dosha', { ...cleanRemedy, asma: 'This clears your mangal dosha.' }],
    ['chakra', { ...cleanRemedy, dua: 'Balance your heart chakra.' }],
    ['crystal', { ...cleanRemedy, sadaqah: 'Keep a rose crystal in your pocket.' }],
    ['tarot', { ...cleanRemedy, quran_verse: 'Draw a tarot card for guidance.' }],
    ['numerology', { ...cleanRemedy, dua: 'Your numerology number is 7.' }],
    ['deity', { ...cleanRemedy, sadaqah: 'Offer flowers to the deity.' }],
  ];

  it.each(forbiddenCases)('blocks a remedy containing %s', (_term, remedy) => {
    const result = guardOracleRemedy(remedy);
    expect(result.blocked).toBe(true);
    expect(result.matchedTerm).toBeTruthy();
    expect(result.remedy).toEqual(ISLAMIC_FALLBACK_REMEDY);
  });

  it('the fallback remedy is itself clean', () => {
    expect(findForbiddenRemedyTerm(ISLAMIC_FALLBACK_REMEDY)).toBeNull();
  });
});

describe('findForbiddenTermInText — string-level scanner (remedy descriptions)', () => {
  it('passes clean sacred guidance text', () => {
    expect(
      findForbiddenTermInText('Recite Surah Al-Fatiha at dawn and give quietly to the needy.'),
    ).toBeNull();
  });

  it('flags a description steered toward non-Islamic practice', () => {
    expect(findForbiddenTermInText('Wear a red coral gemstone to strengthen Mars.')).toBeTruthy();
    expect(findForbiddenTermInText('Perform a havan and chant the mantra 108 times.')).toBeTruthy();
    expect(findForbiddenTermInText('Balance your root chakra with a crystal.')).toBeTruthy();
  });

  it('handles empty / non-string input', () => {
    expect(findForbiddenTermInText('')).toBeNull();
    expect(findForbiddenTermInText(undefined)).toBeNull();
    expect(findForbiddenTermInText(null)).toBeNull();
  });
});
