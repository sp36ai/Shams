/**
 * sync-engine.mjs — copies src/astrology/ into functions/src/engine/
 *
 * Run via: npm run sync-engine (in functions/)
 * Also runs automatically as part of predeploy (via `npm run build`).
 *
 * Transform applied: every `from '@astrology/X'` import is rewritten to
 * the correct relative path from the destination file to functions/src/engine/X.
 * Relative imports (./foo, ../foo) are left untouched.
 *
 * PHASE 5B-R — CHECK MODE
 * ---------------------------------------------------------------------------
 * `node scripts/sync-engine.mjs --check` performs the identical walk but
 * writes nothing: it reports any file that a real sync would create,
 * overwrite, or prune, and exits 1 if the committed mirror in
 * functions/src/engine/ does not already match what src/astrology/ would
 * currently produce. Exits 0 when the mirror is already in sync.
 *
 * This exists because a stale committed mirror is otherwise invisible: a
 * plain `npx vitest run` or `npx tsc --noEmit` inside functions/ happily
 * runs against whatever is on disk, with no signal that it differs from
 * the canonical src/astrology/ source `npm run build` would produce right
 * before every real deploy. See docs/audit/PHASE_5B_REMEDIATION.md §A-D
 * for the incident this closes and functions/vitest.config.ts's
 * `globalSetup` for where this check is actually enforced on every test
 * run (not just when someone remembers to run it by hand).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../src/astrology');
const DEST = path.resolve(__dirname, '../src/engine');

const CHECK_ONLY = process.argv.includes('--check');

let copied = 0;
let skipped = 0;
/** @type {string[]} Paths (relative to DEST) that differ, in --check mode. */
const drift = [];

function relativeToEngine(destFilePath) {
  const rel = path.relative(path.dirname(destFilePath), DEST);
  return (rel === '' ? '.' : rel).replace(/\\/g, '/');
}

// Relative path from the synced file to functions/src/shims/
function relativeToShims(destFilePath) {
  const shimsDir = path.resolve(__dirname, '../src/shims');
  const rel = path.relative(path.dirname(destFilePath), shimsDir);
  return (rel === '' ? '.' : rel).replace(/\\/g, '/');
}

function transformContent(raw, destFilePath) {
  const engineRoot = relativeToEngine(destFilePath);
  const shimsRoot = relativeToShims(destFilePath);
  return (
    raw
      // @astrology/ → relative path inside engine/
      .replace(/'@astrology\/([^']+)'/g, `'${engineRoot}/$1'`)
      .replace(/"@astrology\/([^"]+)"/g, `"${engineRoot}/$1"`)
      // @i18n/types → local shim (only exports LangCode which is 'en'|'ur'|'hi')
      .replace(/'@i18n\/types'/g, `'${shimsRoot}/i18nTypes'`)
      .replace(/"@i18n\/types"/g, `"${shimsRoot}/i18nTypes"`)
  );
}

function syncDir(src, dest) {
  if (!CHECK_ONLY) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.existsSync(src) ? fs.readdirSync(src, { withFileTypes: true }) : [];

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Test directories stay in src/. They are jest suites run by the app's
      // own runner; the functions package uses vitest, never compiles them
      // (nothing imports them), and copying them only leaves an untracked
      // tree behind after every build.
      if (entry.name === '__tests__') {
        skipped++;
        continue;
      }
      syncDir(srcPath, destPath);
      continue;
    }

    if (!entry.name.endsWith('.ts')) {
      skipped++;
      continue;
    }

    const raw = fs.readFileSync(srcPath, 'utf8');
    const transformed = transformContent(raw, destPath);

    const upToDate = fs.existsSync(destPath) && fs.readFileSync(destPath, 'utf8') === transformed;

    if (upToDate) {
      skipped++;
      continue;
    }

    if (CHECK_ONLY) {
      drift.push(path.relative(DEST, destPath));
      continue;
    }

    fs.writeFileSync(destPath, transformed, 'utf8');
    copied++;
  }
}

/**
 * Recursively removes files in dest that do not exist in src.
 *
 * PHASE 5B-R: `__tests__` directories are explicitly skipped here, matching
 * syncDir()'s own skip above — they are never copied INTO dest, so they
 * must never be pruned FROM dest either. Before this fix, pruneDir()
 * carried no such exemption and treated any hand-authored file placed
 * directly under a generated-mirror `__tests__` directory (with no
 * src/astrology counterpart at all) as "stale," silently deleting it on
 * every build. That is exactly what happened to
 * functions/src/engine/primitives/__tests__/{chartBuilder,julianDay}.test.ts
 * — 17 regression tests added specifically because there was previously
 * zero coverage directly under engine/ (commit 585ccd5) — until this fix.
 * See docs/audit/PHASE_5B_REMEDIATION.md §F-H for the full incident.
 *
 * The invariant this function now upholds: sync/prune may remove stale
 * GENERATED files, but must never delete a hand-authored test.
 */
function pruneDir(src, dest) {
  if (!fs.existsSync(dest)) {
    return;
  }
  for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        // Never managed by sync in either direction — see this function's
        // own doc comment above.
        continue;
      }
      pruneDir(srcPath, destPath);
      // Remove empty directories
      if (!CHECK_ONLY && fs.existsSync(destPath) && fs.readdirSync(destPath).length === 0) {
        fs.rmdirSync(destPath);
      }
    } else if (!fs.existsSync(srcPath)) {
      if (CHECK_ONLY) {
        drift.push(`${path.relative(DEST, destPath)} (stale — no longer present in src/astrology)`);
        continue;
      }
      fs.unlinkSync(destPath);
      console.log(`[sync-engine] Pruned stale file: ${entry.name}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SRC)) {
  console.error(`[sync-engine] ERROR: source not found at ${SRC}`);
  process.exit(1);
}

if (CHECK_ONLY) {
  console.log(`[sync-engine] Checking ${SRC} → ${DEST} (no files will be written) ...`);
} else {
  console.log(`[sync-engine] Syncing ${SRC} → ${DEST} ...`);
}
syncDir(SRC, DEST);
pruneDir(SRC, DEST);

if (CHECK_ONLY) {
  if (drift.length > 0) {
    console.error(
      `[sync-engine] DRIFT DETECTED — functions/src/engine/ does not match src/astrology/.\n` +
        `The following ${drift.length} path(s) would change on a real \`npm run build\`:\n` +
        drift.map(p => `  - ${p}`).join('\n') +
        `\n\nRun \`npm run sync-engine\` (in functions/) and commit the result.`,
    );
    process.exit(1);
  }
  console.log('[sync-engine] Check passed — functions/src/engine/ matches src/astrology/.');
  process.exit(0);
}

console.log(`[sync-engine] Done. copied=${copied} skipped=${skipped}`);
