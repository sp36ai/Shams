/**
 * Location copy must never imply that location is needed for a reading.
 *
 * Readings never use location: the Digital Watch Oracle's frame is watch-
 * derived and askWatchOracle's input has no coordinates. Location only drives
 * the on-device sky display. The permission screen is Google Play's prominent
 * disclosure, so a false "the app cannot function without it" is a policy
 * problem as well as a wrong one (owner decision 2026-10-22).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { en } from '../strings/en';
import { ur } from '../strings/ur';
import { hi } from '../strings/hi';

type Table = typeof en;

function locationCopy(t: Table): string[] {
  return [
    t.oracle.locationOptional,
    t.permission.locationTitle,
    t.permission.locationRationale,
    t.permission.deniedTitle,
    t.permission.deniedBody,
    t.permission.privacyNote,
  ];
}

/** Words that would claim location is required, per language. */
const NECESSITY: Record<'en' | 'ur' | 'hi', RegExp> = {
  en: /\b(require[sd]?|need(s|ed)?|must|cannot|can't|essential)\b|\bjudg|\bcast\b/i,
  ur: /درکار|ضروری|لازم|نہیں بن سکت|فیصلہ/,
  hi: /आवश्यक|ज़रूरी|जरूरी|अनिवार्य|नहीं बन सकत|निर्णय/,
};

/**
 * Each language says readings work without location, or as usual. Either
 * word order: Urdu and Hindi put "without" before "reading".
 */
const READINGS_WITHOUT: Record<'en' | 'ur' | 'hi', RegExp> = {
  en: /Readings (work|do not use)/,
  ur: /^(?=.*زائچ[ہے])(?=.*(بغیر|معمول))/,
  hi: /^(?=.*रीडिंग)(?=.*(बिना|पहले की तरह))/,
};

const LOCALES = { en, ur, hi } as const;

describe.each(Object.entries(LOCALES) as Array<[keyof typeof LOCALES, Table]>)(
  'location copy (%s)',
  (lang, table) => {
    it('never says location is required', () => {
      for (const line of locationCopy(table)) {
        expect(line).not.toMatch(NECESSITY[lang]);
      }
    });

    it('says readings work without location, on the chip and the permission screen', () => {
      expect(table.oracle.locationOptional).toMatch(READINGS_WITHOUT[lang]);
      expect(table.permission.locationRationale).toMatch(READINGS_WITHOUT[lang]);
      expect(table.permission.deniedBody).toMatch(READINGS_WITHOUT[lang]);
    });
  },
);

describe('location screens', () => {
  const read = (p: string): string => readFileSync(join(__dirname, '../..', p), 'utf8');

  it('the permission screen shows only translated text, no hard-coded disclosure', () => {
    const src = read('screens/LocationPermissionScreen.tsx');
    expect(src).toContain("t('permission.locationTitle')");
    expect(src).toContain("t('permission.locationRationale')");
    expect(src).toContain("t('permission.privacyNote')");
    expect(src).not.toMatch(/cannot function|Location Required|captured at the moment/i);
  });

  it('Home shows a missing location as information, not a red warning', () => {
    const src = read('screens/OracleScreen.tsx');
    expect(src).toContain("t('oracle.locationOptional')");
    expect(src).not.toMatch(/lastLocation === null[^\n]*colors\.negative/);
  });
});
