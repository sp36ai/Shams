/**
 * Every translation key a screen asks for must exist.
 *
 * t() throws on a key that is missing from `en` — but only when __DEV__ is
 * true, which is to say only in a debug build. A key that no language defines
 * therefore renders its own path in the Play build and CRASHES the screen in
 * the debug APK people actually sideload for testing. That is the worst
 * possible failure mode: invisible to the release build, fatal to the one used
 * to check the release build.
 *
 * Missing from `ur`/`hi` is not an error — those fall back to English by
 * design (`hi` is frozen and deliberately not backfilled), and the provider
 * only warns. Missing from `en` is the fatal case, so that is what fails here.
 *
 * This scans the source for literal t('…') keys. Keys built dynamically are
 * out of reach of any static check; the codebase uses typed literals
 * everywhere, and TranslationKey makes that the path of least resistance.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { en } from '../strings/en';
import { ur } from '../strings/ur';
import { hi } from '../strings/hi';

const SRC_ROOT = join(__dirname, '..', '..');

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Matches `t('some.key')` and `t("some.key")`, the only forms in use. */
const T_CALL_RE = /\bt\(\s*['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]/g;

function lookup(table: unknown, key: string): string | undefined {
  let cursor: unknown = table;
  for (const segment of key.split('.')) {
    if (cursor !== null && typeof cursor === 'object' && segment in (cursor as object)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

const files = collectSourceFiles(SRC_ROOT);
const used: Array<{ file: string; key: string }> = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(T_CALL_RE)) {
    const key = match[1];
    if (key !== undefined) {
      used.push({ file: file.slice(SRC_ROOT.length + 1), key });
    }
  }
}

describe('translation keys', () => {
  it('finds the keys actually used (the guard is wired up)', () => {
    // If this drops to zero the regex has drifted and everything below is
    // vacuously passing.
    expect(used.length).toBeGreaterThan(50);
  });

  it('every key used in the app exists in en', () => {
    const missing = used.filter(u => lookup(en, u.key) === undefined);
    // Jest's expect takes no message argument, so the diagnostic goes in the
    // compared value: a failure then prints the offending keys directly.
    expect(
      missing.map(m => `${m.file}: ${m.key} — no English string; throws in a debug build`),
    ).toEqual([]);
  });

  it('reports which keys fall back to English, without failing on them', () => {
    // Informational: ur is meant to be complete, hi is frozen. A key missing
    // from ur is a translation debt, not a crash, so it must not fail CI —
    // but it should be visible rather than silently degrading the Urdu UI.
    const missingUr = used.filter(u => lookup(ur, u.key) === undefined).map(u => u.key);
    const missingHi = used.filter(u => lookup(hi, u.key) === undefined).map(u => u.key);
    if (missingUr.length > 0) {
      console.warn(`[i18n] ${missingUr.length} key(s) fall back to English in ur`);
    }
    expect(Array.isArray(missingHi)).toBe(true);
  });
});
