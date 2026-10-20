/**
 * rkp-verdict-distribution.ts — how verdicts spread across question types.
 * --------------------------------------------------------------------------
 * Scaffolding only (not bundled, imported nowhere). Calls the same
 * buildWatchChart / judgeWatchChart as askWatchOracle over a fixed grid of
 * moments across 2026 and prints the share of each state per question type.
 * Run before and after a rule change to see what the change did to the spread;
 * it shows distribution, not correctness.
 *
 * Run with: npx vite-node scripts/rkp-verdict-distribution.ts   (from functions/)
 */

import { buildWatchChart } from '../src/engine/rkp/watchChart';
import { judgeWatchChart } from '../src/engine/rkp/watchJudgment';
import { ALL_QUESTION_TYPES } from '../src/engine/kp/rules/houseMatrix';

const STATES = ['FULFILLED', 'MOVING', 'DELAYED', 'UNFORMED', 'REVERSING', 'BLOCKED'] as const;
const base = Date.UTC(2026, 0, 1);

const rows: string[] = [];
for (const qType of ALL_QUESTION_TYPES) {
  const counts: Record<string, number> = {};
  let n = 0;
  for (let d = 0; d < 365; d += 3) {
    for (const h of [3, 8, 13, 19]) {
      for (const m of [4, 22, 41, 57]) {
        const t = new Date(base + d * 864e5);
        const iso = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        const state = judgeWatchChart(buildWatchChart(iso), qType).state;
        counts[state] = (counts[state] ?? 0) + 1;
        n += 1;
      }
    }
  }
  const pct = (s: string): string => (((counts[s] ?? 0) / n) * 100).toFixed(0).padStart(3) + '%';
  rows.push(`${qType.padEnd(10)} ${STATES.map(s => `${s} ${pct(s)}`).join('  ')}`);
}
console.log(rows.join('\n'));
