/**
 * contracts.ts — PHASE 5C real-contract pool.
 * --------------------------------------------------------------------------
 * Every contract here is produced by the actual, live Watch engine chain —
 * classifyQuestion → buildWatchChart → judgeWatchChart → diagnose →
 * selectRemedyProtocol → buildReadingContract — the exact same call order
 * askWatchOracle.ts uses. No fabricated/hand-typed ReadingContract objects.
 *
 * Inputs (question/utcInstant/utcOffsetMinutes) were selected from the
 * existing 111-case golden corpus specifically for diversity across verdict
 * state, timing posture, diagnosis pattern, obstructing agent, and
 * intervention requirement — confirmed by inspecting each candidate case's
 * recorded output before selecting it (see docs/audit/PHASE_5C_REPORT.md
 * §Contract pool for the inspection table). This is NOT an attempt to
 * enumerate every possible engine configuration — it is a materially
 * diverse sample, per the Phase 5C brief's instruction #2.
 */

import { buildWatchChart } from '../../src/engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../../src/engine/rkp/watchJudgment';
import { diagnose } from '../../src/engine/rkp/diagnosis';
import { classifyQuestion } from '../../src/engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../../src/oracle/remedySelection';
import { toBoundaryPlanetName } from '../../src/utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../../src/oracle/readingContract';

export interface ContractProfile {
  readonly id: string;
  readonly label: string;
  readonly contract: ReadingContract;
}

interface CaseSeed {
  readonly id: string;
  readonly question: string;
  readonly utcInstant: string;
  readonly utcOffsetMinutes: number;
}

// Selected from docs/audit/golden-corpus/cases/*.json for materially
// different verdict/timing/diagnosis/remedy/celestial configurations.
const SEEDS: readonly CaseSeed[] = [
  { id: 'employment-001', question: 'Will I get the job I interviewed for?', utcInstant: '2026-08-15T07:00:00.000Z', utcOffsetMinutes: 240 },
  { id: 'business-007', question: 'Should I close my failing business?', utcInstant: '2026-08-15T06:37:00.000Z', utcOffsetMinutes: 300 },
  { id: 'finance-002', question: 'Should I invest my savings in this fund?', utcInstant: '2026-08-15T08:07:00.000Z', utcOffsetMinutes: 0 },
  { id: 'family-002', question: 'Will my family conflict be resolved?', utcInstant: '2026-08-15T12:07:00.000Z', utcOffsetMinutes: 300 },
  { id: 'business-002', question: 'Should I take on a business partner?', utcInstant: '2026-08-15T06:07:00.000Z', utcOffsetMinutes: 300 },
  { id: 'business-005', question: 'Will my startup get funded?', utcInstant: '2026-08-15T06:25:00.000Z', utcOffsetMinutes: 300 },
  { id: 'ambiguous-002', question: 'Should I do it or not?', utcInstant: '2026-08-15T15:19:00.000Z', utcOffsetMinutes: -300 },
  { id: 'business-004', question: 'Should I expand my business to a new city?', utcInstant: '2026-08-15T06:19:00.000Z', utcOffsetMinutes: 300 },
  { id: 'education-003', question: 'Should I pursue a higher degree abroad?', utcInstant: '2026-08-15T11:13:00.000Z', utcOffsetMinutes: 330 },
  { id: 'general-001', question: 'What does my future hold?', utcInstant: '2026-08-15T15:00:00.000Z', utcOffsetMinutes: -300 },
];

function buildFromSeed(seed: CaseSeed): ReadingContract {
  const instant = new Date(seed.utcInstant);
  // localIsoFromOffset is intentionally not imported here to avoid a second
  // dependency edge — the golden-corpus generator's own `derived.localMoment`
  // is reproduced by the same math inline, matching functions/src/utils/localTime.ts.
  const shifted = new Date(instant.getTime() + seed.utcOffsetMinutes * 60_000);
  const pad = (n: number, w = 2): string => String(Math.abs(n)).padStart(w, '0');
  const date = `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  const time = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
  const sign = seed.utcOffsetMinutes < 0 ? '-' : '+';
  const offset = `${sign}${pad(Math.trunc(seed.utcOffsetMinutes / 60))}:${pad(seed.utcOffsetMinutes % 60)}`;
  const localMoment = `${date}T${time}${offset}`;

  const chart = buildWatchChart(localMoment);
  const qType = classifyQuestion(seed.question);
  const rawVerdict = judgeWatchChart(chart, qType);
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  const protocol = selectRemedyProtocol(diagnosis);
  return buildReadingContract({
    readingId: `r-adversarial-5c-${seed.id}`,
    computedAt: new Date('2026-08-15T00:00:00.000Z'),
    question: seed.question,
    verdict,
    diagnosis,
    protocol,
  });
}

/**
 * The 10 real, engine-produced contracts, plus one synthetic no-intervention
 * variant. The variant is a legitimate, deterministic transformation of a
 * real contract (removing remedy steps and marking intervention
 * unnecessary) — the identical technique narrationValidator.test.ts's own
 * `noIntervention` fixture already uses — not a fabricated new contract, and
 * is needed because zero cases in the current 111-case golden corpus have
 * interventionRequired: false (confirmed by inspection; every golden case
 * needed an intervention), so this is the only way to exercise the
 * "remedy claimed where none is required" mutation category against a real
 * decision configuration.
 */
export function buildContractPool(): readonly ContractProfile[] {
  const real = SEEDS.map(seed => ({
    id: seed.id,
    label: seed.id,
    contract: buildFromSeed(seed),
  }));

  const base = real.find(c => c.id === 'business-005')!.contract;
  const noIntervention: ReadingContract = {
    ...base,
    remedy: { ...base.remedy, interventionRequired: false, steps: [] },
  };

  return [
    ...real,
    { id: 'business-005-no-intervention', label: 'business-005 (synthetic: no intervention required)', contract: noIntervention },
  ];
}
