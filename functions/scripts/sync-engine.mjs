/**
 * sync-engine.mjs — copies src/astrology/ into functions/src/engine/
 *
 * Run via: npm run sync-engine (in functions/)
 * Also runs automatically as part of predeploy.
 *
 * Transform applied: every `from '@astrology/X'` import is rewritten to
 * the correct relative path from the destination file to functions/src/engine/X.
 * Relative imports (./foo, ../foo) are left untouched.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.resolve(__dirname, '../../src/astrology');
const DEST = path.resolve(__dirname, '../src/engine');

let copied = 0;
let skipped = 0;

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
  const shimsRoot  = relativeToShims(destFilePath);
  return raw
    // @astrology/ → relative path inside engine/
    .replace(/'@astrology\/([^']+)'/g, `'${engineRoot}/$1'`)
    .replace(/"@astrology\/([^"]+)"/g, `"${engineRoot}/$1"`)
    // @i18n/types → local shim (only exports LangCode which is 'en'|'ur'|'hi')
    .replace(/'@i18n\/types'/g, `'${shimsRoot}/i18nTypes'`)
    .replace(/"@i18n\/types"/g, `"${shimsRoot}/i18nTypes"`);
}

function syncDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      syncDir(srcPath, destPath);
      continue;
    }

    if (!entry.name.endsWith('.ts')) {
      skipped++;
      continue;
    }

    const raw         = fs.readFileSync(srcPath, 'utf8');
    const transformed = transformContent(raw, destPath);

    // Skip write if content unchanged (avoids unnecessary tsc recompilation)
    if (fs.existsSync(destPath) && fs.readFileSync(destPath, 'utf8') === transformed) {
      skipped++;
      continue;
    }

    fs.writeFileSync(destPath, transformed, 'utf8');
    copied++;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SRC)) {
  console.error(`[sync-engine] ERROR: source not found at ${SRC}`);
  process.exit(1);
}

console.log(`[sync-engine] Syncing ${SRC} → ${DEST} ...`);
syncDir(SRC, DEST);
console.log(`[sync-engine] Done. copied=${copied} skipped=${skipped}`);
