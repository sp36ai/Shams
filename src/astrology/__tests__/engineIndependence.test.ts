/**
 * Architectural guard: the two engines must stay independent.
 *
 * Shams runs two separate calculation systems:
 *   RKP (src/astrology/rkp/) — primary. Watch-selected house frame.
 *   KP  (src/astrology/kp/)  — secondary. True Ascendant from the horizon.
 *
 * A reading comes from one system or the other, never a blend. If these two
 * ever import each other, a "hybrid" has been created by accident — the exact
 * thing this product forbids. That is easy to do with one careless import and
 * invisible in review, so it is asserted here instead.
 *
 * Sharing questions/topics.ts is allowed and is not a blend: it is the app's
 * subject vocabulary — a word list with no houses, planets or judgment in it.
 */

import fs from 'fs';
import path from 'path';

const ASTROLOGY_ROOT = path.resolve(__dirname, '..');

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue;
      }
      out.push(...sourceFilesUnder(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Every module path imported by a file, in any import/require form. */
function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m = re.exec(src);
    while (m !== null) {
      if (m[1] !== undefined) {
        specifiers.push(m[1]);
      }
      m = re.exec(src);
    }
  }
  return specifiers;
}

/** Resolve an import to the engine folder it belongs to, if any. */
function engineOf(specifier: string, fromFile: string): 'rkp' | 'kp' | null {
  let target = specifier;
  if (specifier.startsWith('.')) {
    target = path.resolve(path.dirname(fromFile), specifier);
    target = path.relative(ASTROLOGY_ROOT, target).replace(/\\/g, '/');
  } else if (specifier.startsWith('@astrology/')) {
    target = specifier.slice('@astrology/'.length);
  } else {
    return null;
  }
  if (target === 'rkp' || target.startsWith('rkp/')) {
    return 'rkp';
  }
  if (target === 'kp' || target.startsWith('kp/')) {
    return 'kp';
  }
  return null;
}

describe('engine independence', () => {
  it('RKP never imports from the KP engine', () => {
    const offenders: string[] = [];
    for (const file of sourceFilesUnder(path.join(ASTROLOGY_ROOT, 'rkp'))) {
      for (const spec of importsOf(file)) {
        if (engineOf(spec, file) === 'kp') {
          offenders.push(`${path.relative(ASTROLOGY_ROOT, file)} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('KP never imports from the RKP engine', () => {
    const offenders: string[] = [];
    for (const file of sourceFilesUnder(path.join(ASTROLOGY_ROOT, 'kp'))) {
      for (const spec of importsOf(file)) {
        if (engineOf(spec, file) === 'rkp') {
          offenders.push(`${path.relative(ASTROLOGY_ROOT, file)} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('each engine owns its house rules', () => {
    // Both tables exist and are distinct modules. Neither engine may reach for
    // the other's — that is what a hybrid reading would look like in code.
    expect(fs.existsSync(path.join(ASTROLOGY_ROOT, 'rkp/houseRouting.ts'))).toBe(true);
    expect(fs.existsSync(path.join(ASTROLOGY_ROOT, 'kp/rules/houseMatrix.ts'))).toBe(true);
  });

  it('the shared vocabulary carries no astrology', () => {
    const raw = fs.readFileSync(path.join(ASTROLOGY_ROOT, 'questions/topics.ts'), 'utf8');
    // Strip comments first: the file's own header discusses houses precisely to
    // explain that it holds none, and asserting against prose would be theatre.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bhouse\b|\bghar\b|\bplanet\b|favorable|denial/i);
    // And it really is just the word list.
    expect(code).toContain('QuestionType');
  });
});
