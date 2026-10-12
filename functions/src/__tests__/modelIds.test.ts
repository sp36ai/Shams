/**
 * Guard against shipping a retired, deprecated or non-existent model id.
 *
 * This has broken production twice already, both times silently: the call
 * fails, the catch-all logs a warning, and the caller returns its canned
 * fallback — so readings keep being served, just without the synthesis the
 * user actually paid for. Nothing in typecheck, lint, or the unit suite
 * notices, because a model id is just a string.
 *
 * Known history (previous provider, Anthropic):
 *   - 'claude-opus-4-7'            — never a valid public model id
 *   - 'claude-opus-4-1-20250805'   — valid, then reached retirement 2026-08-05
 *
 * Since the OpenAI migration every id lives in config.ts OPENAI_MODELS.
 * Keep ACTIVE_MODEL_IDS in sync with OpenAI's model pages and its
 * deprecations list (https://developers.openai.com/api/docs/deprecations),
 * and re-check both before a release. A deprecated model still works until
 * its shutdown date, but is not allowed here: it is a scheduled outage.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { OPENAI_MODELS } from '../config';

/** Model ids this codebase is allowed to call. Checked 2026-10-12. Update deliberately. */
const ACTIVE_MODEL_IDS: ReadonlySet<string> = new Set([
  'gpt-5.4-mini',
  'gpt-5.4-mini-2026-03-17',
  'gpt-6-luna',
]);

/** Deprecated or shut down per OpenAI's deprecations page (2026-10-12). */
const DEPRECATED_MODEL_IDS: ReadonlySet<string> = new Set([
  'gpt-5.4-nano', // deprecated 2026-10-01, shutdown 2027-04-01 → gpt-6-luna
  'gpt-5.4-nano-2026-03-17',
  'gpt-5.1', // shutdown 2027-04-01
  'gpt-5-mini-2025-08-07', // shutdown 2026-12-11
  'gpt-5-nano-2025-08-07',
  'gpt-4.1-nano',
  'gpt-4.1-nano-2025-04-14',
  'gpt-3.5-turbo',
  'gpt-4-turbo',
  'o4-mini',
  'o3-mini',
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

/** A model id written straight into a request body: `model: '...'`. */
const MODEL_FIELD_RE = /\bmodel:\s*['"]([^'"]+)['"]/g;
/** Any Anthropic model id string left in runtime code. */
const CLAUDE_ID_RE = /['"`](claude-[a-z0-9.-]+)['"`]/g;

describe('OpenAI model ids', () => {
  const configured = Object.entries(OPENAI_MODELS);
  const files = collectSourceFiles(SRC_ROOT);

  it('configures a model for every call site (guard is wired up)', () => {
    expect(Object.keys(OPENAI_MODELS).sort()).toEqual(
      ['classification', 'discussion', 'narration', 'profileInference'].sort(),
    );
  });

  it('only configures model ids on the active allowlist', () => {
    const unknown = configured.filter(([, id]) => !ACTIVE_MODEL_IDS.has(id));
    expect(
      unknown,
      `Unrecognised model id(s) in OPENAI_MODELS. If genuinely current, add them to ` +
        `ACTIVE_MODEL_IDS after checking OpenAI's model page:\n` +
        unknown.map(([use, id]) => `  ${use}: ${id}`).join('\n'),
    ).toEqual([]);
  });

  it('never configures a deprecated or retired model id', () => {
    const deprecated = configured.filter(([, id]) => DEPRECATED_MODEL_IDS.has(id));
    expect(deprecated).toEqual([]);
  });

  it('names no model id outside config.ts', () => {
    const literals: string[] = [];
    for (const file of files) {
      for (const m of readFileSync(file, 'utf8').matchAll(MODEL_FIELD_RE)) {
        literals.push(`${file.slice(SRC_ROOT.length + 1)}: ${m[1] ?? ''}`);
      }
    }
    expect(literals, 'pass OPENAI_MODELS.<use> instead of a literal').toEqual([]);
  });

  it('leaves no Anthropic model id in runtime code', () => {
    const left: string[] = [];
    for (const file of files) {
      for (const m of readFileSync(file, 'utf8').matchAll(CLAUDE_ID_RE)) {
        left.push(`${file.slice(SRC_ROOT.length + 1)}: ${m[1] ?? ''}`);
      }
    }
    expect(left).toEqual([]);
  });
});
