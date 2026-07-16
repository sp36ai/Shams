#!/usr/bin/env node
/**
 * download-fonts.mjs — Shams al-Asrār (cross-platform)
 * ----------------------------------------------------------------------------
 * Fetches the exact font files referenced by src/theme/typography.ts so the
 * app links real fonts into the APK/AAB. Runs on Linux/macOS/Windows (Node 18+),
 * which is why CI uses THIS script rather than the PowerShell one — the release
 * runner is ubuntu-latest and cannot execute .ps1.
 *
 * SOURCE OF TRUTH: the font *families* are whatever typography.ts references:
 *     Latin      : Cinzel (display) + Spectral (body)
 *     Arabic     : Amiri
 *     Devanagari : Noto Sans Devanagari
 * If typography.ts changes a family, update the MANIFEST below to match. The two
 * MUST stay in lockstep — a family in code with no file here ships as the system
 * default font (silent brand regression); a file here with no code reference is
 * dead weight in the APK.
 *
 * Filenames matter: React Native on Android resolves `fontFamily: 'X'` to the
 * bundled asset `assets/fonts/X.ttf` by FILENAME, so each file is saved under
 * the exact PostScript name the code asks for.
 *
 * Idempotent: existing files at/above their min size are skipped unless --force.
 *
 * Usage:
 *   node scripts/download-fonts.mjs            # download missing
 *   node scripts/download-fonts.mjs --force    # re-download all
 */

import { mkdir, stat, writeFile, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const FONTS_DIR = join(REPO_ROOT, 'assets', 'fonts');
// Fonts must physically live under android/app/src/main/assets/fonts/ for the
// Android Gradle Plugin to bundle them into the APK/AAB — RN's Android font
// loader resolves `fontFamily: 'X'` to the bundled asset `fonts/X.ttf`. The
// react-native.config.js `assets` entry only matters if `react-native-asset`
// is run, which nothing in this repo does, so we mirror the files here directly.
const ANDROID_FONTS_DIR = join(REPO_ROOT, 'android', 'app', 'src', 'main', 'assets', 'fonts');
const RAW_BASE = 'https://raw.githubusercontent.com/google/fonts/main';

// filename (== PostScript name used in typography.ts) → { url, minSize }
// Variable fonts (Cinzel, Noto Sans Devanagari) are saved under each weighted
// filename the code references; RN keys on the filename, and the variable file's
// default instance renders — acceptable, and matches the prior provisioning.
const MANIFEST = [
  { name: 'Cinzel-SemiBold.ttf', url: `${RAW_BASE}/ofl/cinzel/Cinzel%5Bwght%5D.ttf`, minSize: 50_000 },
  { name: 'Cinzel-Bold.ttf', url: `${RAW_BASE}/ofl/cinzel/Cinzel%5Bwght%5D.ttf`, minSize: 50_000 },

  { name: 'Spectral-Regular.ttf', url: `${RAW_BASE}/ofl/spectral/Spectral-Regular.ttf`, minSize: 60_000 },
  { name: 'Spectral-Medium.ttf', url: `${RAW_BASE}/ofl/spectral/Spectral-Medium.ttf`, minSize: 60_000 },
  { name: 'Spectral-SemiBold.ttf', url: `${RAW_BASE}/ofl/spectral/Spectral-SemiBold.ttf`, minSize: 60_000 },
  { name: 'Spectral-Italic.ttf', url: `${RAW_BASE}/ofl/spectral/Spectral-Italic.ttf`, minSize: 60_000 },

  { name: 'Amiri-Regular.ttf', url: `${RAW_BASE}/ofl/amiri/Amiri-Regular.ttf`, minSize: 300_000 },
  { name: 'Amiri-Bold.ttf', url: `${RAW_BASE}/ofl/amiri/Amiri-Bold.ttf`, minSize: 300_000 },

  {
    name: 'NotoSansDevanagari-Regular.ttf',
    url: `${RAW_BASE}/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`,
    minSize: 150_000,
  },
  {
    name: 'NotoSansDevanagari-Medium.ttf',
    url: `${RAW_BASE}/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`,
    minSize: 150_000,
  },
  {
    name: 'NotoSansDevanagari-SemiBold.ttf',
    url: `${RAW_BASE}/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`,
    minSize: 150_000,
  },
  {
    name: 'NotoSansDevanagari-Bold.ttf',
    url: `${RAW_BASE}/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth,wght%5D.ttf`,
    minSize: 150_000,
  },
];

const VALID_TTF_MAGIC = new Set(['00010000', '4f54544f', '74727565', '74797031']);

const force = process.argv.includes('--force');

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function fileAtLeast(path, minSize) {
  try {
    const s = await stat(path);
    return s.isFile() && s.size >= minSize;
  } catch {
    return false;
  }
}

async function download(entry) {
  const dest = join(FONTS_DIR, entry.name);
  const androidDest = join(ANDROID_FONTS_DIR, entry.name);

  if (
    !force &&
    (await fileAtLeast(dest, entry.minSize)) &&
    (await fileAtLeast(androidDest, entry.minSize))
  ) {
    log(`  SKIP  ${entry.name} (already present)`);
    return 'skip';
  }

  if (!force && (await fileAtLeast(dest, entry.minSize))) {
    // Source present but not mirrored into the Android build tree yet.
    await copyFile(dest, androidDest);
    log(`  LINK  ${entry.name} (already downloaded)`);
    return 'skip';
  }

  const res = await fetch(entry.url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${entry.url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  if (buf.length < entry.minSize) {
    throw new Error(`${entry.name} is ${buf.length} bytes, expected >= ${entry.minSize}`);
  }
  const magic = buf.subarray(0, 4).toString('hex');
  if (!VALID_TTF_MAGIC.has(magic)) {
    throw new Error(`${entry.name} has invalid font magic 0x${magic}`);
  }

  await writeFile(dest, buf);
  await copyFile(dest, androidDest);
  log(`  OK    ${entry.name} (${Math.round(buf.length / 1024)} KB)`);
  return 'ok';
}

async function main() {
  await mkdir(FONTS_DIR, { recursive: true });
  await mkdir(ANDROID_FONTS_DIR, { recursive: true });
  log(`[Shams][fonts] Source:  ${FONTS_DIR}`);
  log(`[Shams][fonts] Android: ${ANDROID_FONTS_DIR}`);
  log(`[Shams][fonts] Downloading ${MANIFEST.length} fonts${force ? ' (--force)' : ''}...`);

  let ok = 0;
  let skip = 0;
  const failed = [];

  for (const entry of MANIFEST) {
    try {
      const result = await download(entry);
      if (result === 'ok') ok++;
      else skip++;
    } catch (err) {
      failed.push(entry.name);
      log(`  FAIL  ${entry.name}: ${err.message}`);
      await rm(join(FONTS_DIR, entry.name), { force: true });
    }
  }

  log(`[Shams][fonts] Summary: ${ok} downloaded, ${skip} skipped, ${failed.length} failed`);

  if (failed.length > 0) {
    log(`[Shams][fonts] Failed: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch(err => {
  log(`[Shams][fonts] Fatal: ${err.message}`);
  process.exit(1);
});
