/**
 * Guard against shipping a retired or non-existent Anthropic model id.
 *
 * This has broken production twice already, both times silently: the call
 * 404s, the catch-all logs a warning, and the caller returns its canned
 * fallback — so readings keep being served, just without the synthesis the
 * user actually paid for. Nothing in typecheck, lint, or the unit suite
 * notices, because a model id is just a string.
 *
 * Known history:
 *   - 'claude-opus-4-7'            — never a valid public model id
 *   - 'claude-opus-4-1-20250805'   — valid, then reached retirement 2026-08-05
 *
 * Keep ACTIVE_MODEL_IDS in sync with Anthropic's model list, and re-check it
 * before a release. A model that is merely *deprecated* still works; one past
 * its retirement date does not.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** Model ids this codebase is allowed to call. Update deliberately. */
const ACTIVE_MODEL_IDS: ReadonlySet<string> = new Set([
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
]);

/** Ids known to be retired — called out separately for a clearer failure. */
const RETIRED_MODEL_IDS: ReadonlySet<string> = new Set([
  'claude-opus-4-1',
  'claude-opus-4-1-20250805',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
]);

const SRC_ROOT = join(__dirname, '..');

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') {
        continue;
      }
      collectSourceFiles(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Matches a model id in an API request body: `model: 'claude-...'`. */
const MODEL_FIELD_RE = /\bmodel:\s*['"]([^'"]+)['"]/g;

describe('Anthropic model ids', () => {
  const files = collectSourceFiles(SRC_ROOT);

  const found: Array<{ file: string; id: string }> = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(MODEL_FIELD_RE)) {
      const id = match[1];
      if (id !== undefined) {
        found.push({ file: file.slice(SRC_ROOT.length + 1), id });
      }
    }
  }

  it('finds the model ids actually used (guard is wired up)', () => {
    // If this drops to zero the regex has drifted and the guard below is
    // vacuously passing — fail loudly rather than protect nothing.
    expect(found.length).toBeGreaterThan(0);
  });

  it('never references a retired model id', () => {
    const retired = found.filter(f => RETIRED_MODEL_IDS.has(f.id));
    expect(
      retired,
      `Retired Anthropic model id(s) in use — these 404 at runtime and silently ` +
        `degrade to fallback text:\n` +
        retired.map(r => `  ${r.file}: ${r.id}`).join('\n'),
    ).toEqual([]);
  });

  it('only references model ids on the active allowlist', () => {
    const unknown = found.filter(f => !ACTIVE_MODEL_IDS.has(f.id));
    expect(
      unknown,
      `Unrecognised Anthropic model id(s). If these are genuinely current, add ` +
        `them to ACTIVE_MODEL_IDS; otherwise they will 404 at runtime:\n` +
        unknown.map(u => `  ${u.file}: ${u.id}`).join('\n'),
    ).toEqual([]);
  });
});
