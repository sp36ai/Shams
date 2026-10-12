/**
 * checkScorecard.ts — refuse an audition scorecard with mandatory listening
 * fields left unfilled. Exit 1 if any remain.
 *
 *   npx vite-node scripts/voice-audition/checkScorecard.ts -- <path to scorecard.md>
 */

import { readFileSync } from 'node:fs';

import { checkScorecard } from './audition';

const path = process.argv.slice(2).find(a => !a.startsWith('-') && a !== '--');
if (!path) {
  throw new Error('usage: checkScorecard.ts -- <scorecard.md>');
}
const result = checkScorecard(readFileSync(path, 'utf8'));
for (const m of result.missing) {
  console.warn(`missing: ${m}`);
}
for (const i of result.invalid) {
  console.warn(`invalid: ${i}`);
}
console.warn(
  result.complete
    ? '[scorecard] all mandatory listening fields are filled'
    : `[scorecard] ${result.missing.length} missing, ${result.invalid.length} invalid — not ready for approval`,
);
if (!result.complete) {
  process.exitCode = 1;
}
