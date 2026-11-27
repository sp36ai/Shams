#!/usr/bin/env node
// Fails the build if the retired KP / Astronomical judgment engine comes back.
//
// That engine was deleted in #92 (see `git show 18232d7`): judgeHorary() and
// its kp/judgment/ helpers, the askOracle Cloud Function, its LLM prompt
// (oracleSynthesisPrompt) and its safety gate (safetyValidator). The RKP Watch
// Engine behind askWatchOracle is the only judgment path; nothing may import,
// call or fall back to the old one.
//
// Deliberately NOT banned: src/astrology/kp/rules/ (nakshatras, vimshottari,
// houseMatrix, questionKeywords) and the primitives that use them. Those are
// shared mathematical tables the RKP engine still depends on. Comments are
// also ignored, so provenance notes like "see git history for kp/judgment/"
// stay allowed — only real code (identifiers, import paths, strings) counts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Paths deleted with the engine. Any of them reappearing fails the check.
const RETIRED_PATHS = [
  'src/astrology/kp/judgment',
  'functions/src/engine/kp/judgment',
  'functions/src/functions/askOracle.ts',
  'functions/src/functions/safetyValidator.ts',
  'functions/src/prompts/oracleSynthesisPrompt.ts',
  'src/__tests__/judgeHorary.test.ts',
];

// Matched against identifier, string and template tokens — never comments.
// `askOracle` is matched as a whole token so `askWatchOracle` is unaffected.
const RETIRED_TOKENS = [
  { pattern: /kp\/judgment/, why: 'import of the deleted kp/judgment/ engine' },
  { pattern: /^judgeHorary$/, why: 'the deleted KP verdict algorithm' },
  { pattern: /^askOracle$/, why: 'the deleted askOracle callable (use askWatchOracle)' },
  { pattern: /^AskOracle(Schema|Input)$/, why: 'the deleted askOracle request schema' },
  { pattern: /oracleSynthesisPrompt/, why: 'the deleted KP LLM prompt' },
  { pattern: /safetyValidator/, why: 'the deleted askOracle safety gate' },
];

const SCAN_DIRS = ['src', 'functions/src', 'index.js'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'lib', 'build', 'dist', '.git']);

function* walk(target) {
  if (!existsSync(target)) return;
  if (statSync(target).isFile()) {
    yield target;
    return;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(target, entry.name));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield path.join(target, entry.name);
    }
  }
}

const CODE_TOKENS = new Set([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

export function findRetiredReferences(source, fileName = 'file.ts') {
  const variant = /\.(tsx|jsx)$/.test(fileName)
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, variant, source);
  const hits = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (!CODE_TOKENS.has(kind)) continue;
    const text = scanner.getTokenValue() || scanner.getTokenText();
    for (const { pattern, why } of RETIRED_TOKENS) {
      if (pattern.test(text)) {
        const line = source.slice(0, scanner.getTokenPos()).split('\n').length;
        hits.push({ line, text, why });
      }
    }
  }
  return hits;
}

function main() {
  const failures = [];

  for (const rel of RETIRED_PATHS) {
    if (existsSync(path.join(ROOT, rel))) failures.push(`${rel}: retired path has been re-added`);
  }

  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file);
      for (const { line, text, why } of findRetiredReferences(readFileSync(file, 'utf8'), file)) {
        failures.push(`${rel}:${line}: "${text}" — ${why}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Retired KP/Astronomical engine references found:\n');
    for (const f of failures) console.error(`  ${f}`);
    console.error(
      '\nThe RKP Watch Engine (askWatchOracle) is the only judgment path. See scripts/check-retired-kp.mjs.',
    );
    process.exit(1);
  }
  console.log('No retired KP/Astronomical engine references found.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
