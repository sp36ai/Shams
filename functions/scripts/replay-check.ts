/**
 * replay-check.ts — Phase 1 determinism verification, in-process.
 * --------------------------------------------------------------------------
 * Scaffolding only, same status as generate-golden-corpus.ts (see that
 * file's header) — not part of the deployed bundle, not imported anywhere.
 *
 * generate-golden-corpus.ts's own two-process run already proved the full
 * 111-case corpus is byte-identical across separate process invocations
 * (see PHASE_1_ARCHITECTURE_MAP.md §G). This script adds a stricter,
 * same-process check on top of that: it calls the deterministic pipeline
 * TWICE, back-to-back, in the same process, for a fixed subset of >=20
 * cases, and diffs JSON.stringify output byte-for-byte. This rules out a
 * class of bug two-process runs cannot: state leaking between calls within
 * one warm process (e.g. a module-level cache, a mutated shared object, Set
 * iteration order sensitive to prior insertions in the same process).
 *
 * Run with: npx vite-node scripts/replay-check.ts (from functions/)
 */

import { buildWatchChart } from '../src/engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../src/engine/rkp/watchJudgment';
import { diagnose } from '../src/engine/rkp/diagnosis';
import { selectRemedyProtocol } from '../src/oracle/remedySelection';
import { classifyQuestion } from '../src/engine/kp/rules/questionKeywords';
import { toBoundaryPlanetName } from '../src/utils/planetBoundaryName';
import { localIsoFromOffset } from '../src/utils/localTime';

interface ReplayCase {
  readonly id: string;
  readonly question: string;
  readonly utcInstant: string;
  readonly utcOffsetMinutes: number;
}

// 24 cases — a superset of the "at least 20" requirement — spanning every
// question type in HOUSE_MATRIX at least once, plus repeats of the exact
// same (question, instant, offset) triple to catch same-input drift.
const REPLAY_CASES: ReplayCase[] = [
  { id: 'r-marriage', question: 'Will I marry the person I love?', utcInstant: '2026-08-15T05:00:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-marriage-repeat', question: 'Will I marry the person I love?', utcInstant: '2026-08-15T05:00:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-business', question: 'Will my new business succeed?', utcInstant: '2026-08-15T06:00:00.000Z', utcOffsetMinutes: 300 },
  { id: 'r-career', question: 'Will I get the job I interviewed for?', utcInstant: '2026-08-15T07:00:00.000Z', utcOffsetMinutes: 240 },
  { id: 'r-finance', question: 'Will I recover the money I lent?', utcInstant: '2026-08-15T08:00:00.000Z', utcOffsetMinutes: 0 },
  { id: 'r-health', question: 'Will my illness be cured soon?', utcInstant: '2026-08-15T14:00:00.000Z', utcOffsetMinutes: 0 },
  { id: 'r-property', question: 'Will I be able to buy this house?', utcInstant: '2026-08-15T09:00:00.000Z', utcOffsetMinutes: -300 },
  { id: 'r-travel', question: 'Will my visa be approved for the trip?', utcInstant: '2026-08-15T10:00:00.000Z', utcOffsetMinutes: 540 },
  { id: 'r-legal', question: 'Will I win my court case?', utcInstant: '2026-08-15T13:00:00.000Z', utcOffsetMinutes: 240 },
  { id: 'r-education', question: 'Will I pass my upcoming exam?', utcInstant: '2026-08-15T11:00:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-business-2', question: 'Should I take on a business partner?', utcInstant: '2026-08-15T06:07:00.000Z', utcOffsetMinutes: 300 },
  { id: 'r-children', question: 'Will I be blessed with a child soon?', utcInstant: '2026-08-15T12:00:00.000Z', utcOffsetMinutes: 300 },
  { id: 'r-lostitem', question: 'Will I recover my lost ring?', utcInstant: '2026-08-15T14:25:00.000Z', utcOffsetMinutes: 0 },
  { id: 'r-enemies', question: 'Is my business rival trying to sabotage me?', utcInstant: '2026-08-15T13:07:00.000Z', utcOffsetMinutes: 240 },
  { id: 'r-spiritual', question: 'Am I under the effect of black magic?', utcInstant: '2026-08-15T14:13:00.000Z', utcOffsetMinutes: 0 },
  { id: 'r-general', question: 'What does my future hold?', utcInstant: '2026-08-15T15:00:00.000Z', utcOffsetMinutes: -300 },
  { id: 'r-ambiguous', question: 'Will it work out?', utcInstant: '2026-08-15T15:13:00.000Z', utcOffsetMinutes: -300 },
  { id: 'r-multiintent', question: 'Will I get the job and also be able to marry my partner this year?', utcInstant: '2026-08-15T15:31:00.000Z', utcOffsetMinutes: -300 },
  { id: 'r-timing-a', question: 'Will I get the job I interviewed for?', utcInstant: '2026-08-15T16:00:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-timing-b', question: 'Will I get the job I interviewed for?', utcInstant: '2026-08-15T16:05:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-timing-c', question: 'Will I get the job I interviewed for?', utcInstant: '2026-08-15T16:29:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-timing-d', question: 'Will I get the job I interviewed for?', utcInstant: '2026-08-15T16:59:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-education-2', question: 'Will I get admission to this university?', utcInstant: '2026-08-15T11:07:00.000Z', utcOffsetMinutes: 330 },
  { id: 'r-property-2', question: 'Should I sell my land now or wait?', utcInstant: '2026-08-15T09:07:00.000Z', utcOffsetMinutes: -300 },
];

function run(def: ReplayCase): string {
  const instant = new Date(def.utcInstant);
  const localMoment = localIsoFromOffset(instant, def.utcOffsetMinutes);
  const chart = buildWatchChart(localMoment);
  const qType = classifyQuestion(def.question);
  const verdict = judgeWatchChart(chart, qType);
  const publicVerdict: DisplayWatchVerdict = {
    ...verdict,
    obstruction: toBoundaryPlanetName(verdict.obstruction),
    targetRuler: toBoundaryPlanetName(verdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(verdict.lagnaRuler),
  };
  const diagnosis = diagnose(publicVerdict);
  const protocol = selectRemedyProtocol(diagnosis);
  return JSON.stringify({ chart, verdict: publicVerdict, diagnosis, protocol });
}

let mismatches = 0;
const results: Array<{ id: string; identical: boolean }> = [];

for (const def of REPLAY_CASES) {
  const first = run(def);
  const second = run(def);
  const identical = first === second;
  if (!identical) mismatches++;
  results.push({ id: def.id, identical });
}

// eslint-disable-next-line no-console
console.log(`Replayed ${REPLAY_CASES.length} cases (>= 20 required), each computed twice in-process.`);
// eslint-disable-next-line no-console
console.log(JSON.stringify(results, null, 2));
if (mismatches > 0) {
  // eslint-disable-next-line no-console
  console.error(`NONDETERMINISM DETECTED in ${mismatches} case(s).`);
  process.exitCode = 1;
} else {
  // eslint-disable-next-line no-console
  console.log('All cases byte-identical across two in-process invocations. No nondeterminism detected.');
}
