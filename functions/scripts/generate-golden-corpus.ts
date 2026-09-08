/**
 * generate-golden-corpus.ts — Phase 1 regression-foundation generator.
 * --------------------------------------------------------------------------
 * PHASE 1 SCAFFOLDING ONLY. Not part of the deployed function bundle, not
 * imported by anything under src/, and not run by `npm run build` or any CI
 * job. It exists solely to CAPTURE the current authoritative engine's output
 * for a fixed set of inputs, so Phase 2 can diff against it. It changes
 * nothing about how askWatchOracle behaves.
 *
 * It calls the exact same functions askWatchOracle.ts calls, in the exact
 * same order, for the deterministic portion of the pipeline only (no
 * network call, no AI narration — narration is explicitly out of scope for
 * a golden corpus because it is not deterministic by design):
 *
 *   classifyQuestion → buildWatchChart → judgeWatchChart →
 *   toBoundaryPlanetName (×3, matching the server boundary mapping) →
 *   diagnose → selectRemedyProtocol
 *
 * Run with:  npx vite-node scripts/generate-golden-corpus.ts
 * (from functions/; vite-node is already a transitive dependency of vitest,
 * already installed — no new dependency was added for this script.)
 *
 * Output: docs/audit/golden-corpus/cases/<id>.json  (one file per case)
 *         docs/audit/golden-corpus/index.json         (manifest)
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWatchChart } from '../src/engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../src/engine/rkp/watchJudgment';
import { diagnose } from '../src/engine/rkp/diagnosis';
import { selectRemedyProtocol } from '../src/oracle/remedySelection';
import { classifyQuestion } from '../src/engine/kp/rules/questionKeywords';
import { toBoundaryPlanetName } from '../src/utils/planetBoundaryName';
import { localIsoFromOffset } from '../src/utils/localTime';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = resolve(__dirname, '../../docs/audit/golden-corpus');
const OUT_CASES = resolve(OUT_ROOT, 'cases');

/* -------------------------------------------------------------------------- */
/*  Case definitions                                                          */
/* -------------------------------------------------------------------------- */

interface CaseDef {
  readonly id: string;
  readonly coverageLabel: string;
  readonly question: string;
  /** UTC instant — this is the server-authoritative "Date.now()" stand-in. */
  readonly utcInstant: string;
  /** Querent's offset from UTC in minutes, exactly as askWatchOracle receives it. */
  readonly utcOffsetMinutes: number;
}

// Offsets chosen to land in genuinely different 5-minute watch-window
// brackets (see watchGrid.ts) and different sign/lagna configurations, not
// picked to force any particular outcome — the engine decides the outcome.
const OFFSETS = {
  IST: 330, // +05:30 (Srinagar — the app's home timezone)
  PKT: 300, // +05:00
  GST: 240, // +04:00
  UTC: 0,
  EST: -300, // -05:00
  JST: 540, // +09:00
} as const;

const cases: CaseDef[] = [
  // ── relationship / marriage ──────────────────────────────────────────────
  { id: 'marriage-001', coverageLabel: 'marriage', question: 'Will I marry the person I love?', utcInstant: '2026-08-15T05:00:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'marriage-002', coverageLabel: 'marriage', question: 'When will my marriage proposal be accepted?', utcInstant: '2026-08-15T05:07:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'marriage-003', coverageLabel: 'marriage', question: 'Should I marry the person my family has chosen?', utcInstant: '2026-08-15T05:13:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'marriage-004', coverageLabel: 'marriage', question: 'Will my engagement survive?', utcInstant: '2026-08-15T05:19:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'marriage-005', coverageLabel: 'marriage', question: 'Is my spouse being faithful to me?', utcInstant: '2026-08-15T05:25:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'marriage-006', coverageLabel: 'marriage', question: 'Will my divorce be finalised soon?', utcInstant: '2026-08-15T05:31:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'marriage-007', coverageLabel: 'marriage', question: 'Should I reconcile with my ex-partner?', utcInstant: '2026-08-15T05:37:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'marriage-008', coverageLabel: 'marriage', question: 'Will my in-laws accept me?', utcInstant: '2026-08-15T05:43:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  // ── business ──────────────────────────────────────────────────────────────
  { id: 'business-001', coverageLabel: 'business', question: 'Will my new business succeed?', utcInstant: '2026-08-15T06:00:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'business-002', coverageLabel: 'business', question: 'Should I take on a business partner?', utcInstant: '2026-08-15T06:07:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'business-003', coverageLabel: 'business', question: 'Will my shop turn a profit this year?', utcInstant: '2026-08-15T06:13:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'business-004', coverageLabel: 'business', question: 'Should I expand my business to a new city?', utcInstant: '2026-08-15T06:19:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'business-005', coverageLabel: 'business', question: 'Will my startup get funded?', utcInstant: '2026-08-15T06:25:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'business-006', coverageLabel: 'business', question: 'Is my business partner trustworthy?', utcInstant: '2026-08-15T06:31:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'business-007', coverageLabel: 'business', question: 'Should I close my failing business?', utcInstant: '2026-08-15T06:37:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  // ── employment / career ──────────────────────────────────────────────────
  { id: 'employment-001', coverageLabel: 'employment', question: 'Will I get the job I interviewed for?', utcInstant: '2026-08-15T07:00:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'employment-002', coverageLabel: 'employment', question: 'Should I resign from my current job?', utcInstant: '2026-08-15T07:07:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'employment-003', coverageLabel: 'employment', question: 'Will I get promoted this year?', utcInstant: '2026-08-15T07:13:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'employment-004', coverageLabel: 'employment', question: 'Is my job at risk of layoffs?', utcInstant: '2026-08-15T07:19:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'employment-005', coverageLabel: 'employment', question: 'Should I switch careers entirely?', utcInstant: '2026-08-15T07:25:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'employment-006', coverageLabel: 'employment', question: 'Will my visa sponsorship for this job be approved?', utcInstant: '2026-08-15T07:31:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  // ── finance ───────────────────────────────────────────────────────────────
  { id: 'finance-001', coverageLabel: 'finance', question: 'Will I recover the money I lent?', utcInstant: '2026-08-15T08:00:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'finance-002', coverageLabel: 'finance', question: 'Should I invest my savings in this fund?', utcInstant: '2026-08-15T08:07:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'finance-003', coverageLabel: 'finance', question: 'Will I get out of debt this year?', utcInstant: '2026-08-15T08:13:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'finance-004', coverageLabel: 'finance', question: 'Will my loan application be approved?', utcInstant: '2026-08-15T08:19:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'finance-005', coverageLabel: 'finance', question: 'Is it safe to buy gold now?', utcInstant: '2026-08-15T08:25:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'finance-006', coverageLabel: 'finance', question: 'Will my inheritance dispute be resolved in my favour?', utcInstant: '2026-08-15T08:31:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  // ── property ──────────────────────────────────────────────────────────────
  { id: 'property-001', coverageLabel: 'property', question: 'Will I be able to buy this house?', utcInstant: '2026-08-15T09:00:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'property-002', coverageLabel: 'property', question: 'Should I sell my land now or wait?', utcInstant: '2026-08-15T09:07:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'property-003', coverageLabel: 'property', question: 'Will the property dispute with my neighbour end well?', utcInstant: '2026-08-15T09:13:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'property-004', coverageLabel: 'property', question: 'Will my rental agreement be renewed?', utcInstant: '2026-08-15T09:19:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'property-005', coverageLabel: 'property', question: 'Should I take a mortgage for this property?', utcInstant: '2026-08-15T09:25:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  // ── travel ────────────────────────────────────────────────────────────────
  { id: 'travel-001', coverageLabel: 'travel', question: 'Will my visa be approved for the trip?', utcInstant: '2026-08-15T10:00:00.000Z', utcOffsetMinutes: OFFSETS.JST },
  { id: 'travel-002', coverageLabel: 'travel', question: 'Should I travel abroad this month?', utcInstant: '2026-08-15T10:07:00.000Z', utcOffsetMinutes: OFFSETS.JST },
  { id: 'travel-003', coverageLabel: 'travel', question: 'Will my flight be delayed?', utcInstant: '2026-08-15T10:13:00.000Z', utcOffsetMinutes: OFFSETS.JST },
  { id: 'travel-004', coverageLabel: 'travel', question: 'Is it a good time to relocate to another country?', utcInstant: '2026-08-15T10:19:00.000Z', utcOffsetMinutes: OFFSETS.JST },
  { id: 'travel-005', coverageLabel: 'travel', question: 'Will my pilgrimage journey go smoothly?', utcInstant: '2026-08-15T10:25:00.000Z', utcOffsetMinutes: OFFSETS.JST },
  // ── education ─────────────────────────────────────────────────────────────
  { id: 'education-001', coverageLabel: 'education', question: 'Will I pass my upcoming exam?', utcInstant: '2026-08-15T11:00:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'education-002', coverageLabel: 'education', question: 'Will I get admission to this university?', utcInstant: '2026-08-15T11:07:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'education-003', coverageLabel: 'education', question: 'Should I pursue a higher degree abroad?', utcInstant: '2026-08-15T11:13:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'education-004', coverageLabel: 'education', question: 'Will I win the scholarship I applied for?', utcInstant: '2026-08-15T11:19:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  { id: 'education-005', coverageLabel: 'education', question: 'Should my child change schools?', utcInstant: '2026-08-15T11:25:00.000Z', utcOffsetMinutes: OFFSETS.IST },
  // ── family / children ─────────────────────────────────────────────────────
  { id: 'family-001', coverageLabel: 'family', question: 'Will I be blessed with a child soon?', utcInstant: '2026-08-15T12:00:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'family-002', coverageLabel: 'family', question: 'Will my family conflict be resolved?', utcInstant: '2026-08-15T12:07:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'family-003', coverageLabel: 'family', question: "Is my son's health going to improve?", utcInstant: '2026-08-15T12:13:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'family-004', coverageLabel: 'family', question: 'Will my parents reconcile?', utcInstant: '2026-08-15T12:19:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  { id: 'family-005', coverageLabel: 'family', question: "Will my daughter's custody case go in my favour?", utcInstant: '2026-08-15T12:25:00.000Z', utcOffsetMinutes: OFFSETS.PKT },
  // ── disputes / legal / enemies ────────────────────────────────────────────
  { id: 'disputes-001', coverageLabel: 'disputes', question: 'Will I win my court case?', utcInstant: '2026-08-15T13:00:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'disputes-002', coverageLabel: 'disputes', question: 'Is my business rival trying to sabotage me?', utcInstant: '2026-08-15T13:07:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'disputes-003', coverageLabel: 'disputes', question: 'Will the legal notice against me be withdrawn?', utcInstant: '2026-08-15T13:13:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'disputes-004', coverageLabel: 'disputes', question: 'Should I settle out of court?', utcInstant: '2026-08-15T13:19:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  { id: 'disputes-005', coverageLabel: 'disputes', question: 'Does my colleague mean me harm?', utcInstant: '2026-08-15T13:25:00.000Z', utcOffsetMinutes: OFFSETS.GST },
  // ── health / spiritual ────────────────────────────────────────────────────
  { id: 'health-001', coverageLabel: 'health', question: 'Will my illness be cured soon?', utcInstant: '2026-08-15T14:00:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'health-002', coverageLabel: 'health', question: 'Should I undergo the surgery my doctor recommends?', utcInstant: '2026-08-15T14:07:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'spiritual-001', coverageLabel: 'spiritual', question: 'Am I under the effect of black magic?', utcInstant: '2026-08-15T14:13:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'spiritual-002', coverageLabel: 'spiritual', question: 'Will my dua for guidance be answered?', utcInstant: '2026-08-15T14:19:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  { id: 'lostitem-001', coverageLabel: 'lostitem', question: 'Will I recover my lost ring?', utcInstant: '2026-08-15T14:25:00.000Z', utcOffsetMinutes: OFFSETS.UTC },
  // ── general / ambiguous / multi-intent ───────────────────────────────────
  { id: 'general-001', coverageLabel: 'general', question: 'What does my future hold?', utcInstant: '2026-08-15T15:00:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'general-002', coverageLabel: 'general', question: 'Is this a good time for me overall?', utcInstant: '2026-08-15T15:07:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'ambiguous-001', coverageLabel: 'ambiguous', question: 'Will it work out?', utcInstant: '2026-08-15T15:13:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'ambiguous-002', coverageLabel: 'ambiguous', question: 'Should I do it or not?', utcInstant: '2026-08-15T15:19:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'ambiguous-003', coverageLabel: 'ambiguous', question: 'What should I do?', utcInstant: '2026-08-15T15:25:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'multiintent-001', coverageLabel: 'multi-intent', question: 'Will I get the job and also be able to marry my partner this year?', utcInstant: '2026-08-15T15:31:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'multiintent-002', coverageLabel: 'multi-intent', question: 'Should I take the loan to start my business and move house at the same time?', utcInstant: '2026-08-15T15:37:00.000Z', utcOffsetMinutes: OFFSETS.EST },
  { id: 'multiintent-003', coverageLabel: 'multi-intent', question: 'Will my health improve and will I also win the court case?', utcInstant: '2026-08-15T15:43:00.000Z', utcOffsetMinutes: OFFSETS.EST },
];

// ── timing-sensitive: SAME question text, deliberately varied instants/offsets
// to test whether the window bracket (not the question) drives divergence.
const TIMING_SENSITIVE_QUESTION = 'Will I get the job I interviewed for?';
const timingSensitiveMinutes = [0, 1, 4, 5, 6, 9, 10, 14, 15, 19, 20, 24, 25, 29, 30, 44, 45, 59];
for (const m of timingSensitiveMinutes) {
  cases.push({
    id: `timing-${String(m).padStart(2, '0')}`,
    coverageLabel: 'timing-sensitive',
    question: TIMING_SENSITIVE_QUESTION,
    utcInstant: `2026-08-15T16:${String(m).padStart(2, '0')}:00.000Z`,
    utcOffsetMinutes: OFFSETS.IST,
  });
}

// ── additional coverage padding to clear the 100-case floor with genuinely
// distinct (question × instant × offset) triples, still hand-authored, not
// mechanically duplicated — different phrasing per qType, different minutes.
const paddingQuestions: Array<{ q: string; label: string }> = [
  { q: 'Will my relationship with my partner last?', label: 'relationship' },
  { q: 'Should I trust my partner right now?', label: 'relationship' },
  { q: 'Will my long-distance relationship survive?', label: 'relationship' },
  { q: 'Will my ex come back to me?', label: 'relationship' },
  { q: 'Will my business deal close this week?', label: 'business' },
  { q: 'Should I sign the new business contract?', label: 'business' },
  { q: 'Will my e-commerce store take off?', label: 'business' },
  { q: 'Will I be able to hire the right staff for my business?', label: 'business' },
  { q: 'Will my transfer request at work be approved?', label: 'employment' },
  { q: 'Will I clear my job probation period?', label: 'employment' },
  { q: 'Should I ask for a raise this quarter?', label: 'employment' },
  { q: 'Will I be able to pay off my credit card debt?', label: 'finance' },
  { q: 'Will the stock I bought recover?', label: 'finance' },
  { q: 'Will my salary increase this year?', label: 'finance' },
  { q: 'Will construction on my new house finish on time?', label: 'property' },
  { q: 'Should I buy agricultural land this season?', label: 'property' },
  { q: 'Will my visa interview go well?', label: 'travel' },
  { q: 'Is it safe for me to travel by road tomorrow?', label: 'travel' },
  { q: 'Will I clear my entrance test this attempt?', label: 'education' },
  { q: 'Should I choose engineering or medicine?', label: 'education' },
  { q: 'Will my grandmother recover from her illness?', label: 'family' },
  { q: 'Will my brother and I reconcile?', label: 'family' },
  { q: 'Will my neighbour drop the complaint against me?', label: 'disputes' },
  { q: 'Should I file a police report about this matter?', label: 'disputes' },
  { q: 'Will I overcome the evil eye affecting me?', label: 'spiritual' },
  { q: 'Will my missing phone be found?', label: 'lostitem' },
  { q: 'Is now a favourable time to start something new?', label: 'general' },
  { q: 'Will things improve for me soon?', label: 'general' },
];
paddingQuestions.forEach(({ q, label }, i) => {
  const minute = (i * 7 + 2) % 60;
  const offsetPool = Object.values(OFFSETS);
  cases.push({
    id: `pad-${label}-${String(i + 1).padStart(2, '0')}`,
    coverageLabel: label,
    question: q,
    utcInstant: `2026-08-16T${String(6 + (i % 12)).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`,
    utcOffsetMinutes: offsetPool[i % offsetPool.length],
  });
});

/* -------------------------------------------------------------------------- */
/*  Deterministic chart fingerprint                                           */
/* -------------------------------------------------------------------------- */

function fingerprintChart(chart: ReturnType<typeof buildWatchChart>): string {
  // Every field that fully determines downstream judgment/diagnosis, and
  // nothing else (no computed-but-unused fields) — a stable, minimal digest.
  const material = {
    lagnaSign: chart.lagnaSign,
    lagnaRuler: chart.lagnaRuler,
    window: chart.window,
    planets: Object.keys(chart.planets)
      .sort()
      .map(k => {
        const p = chart.planets[k as keyof typeof chart.planets];
        return {
          planet: p.planet,
          sign: p.sign,
          degreeInSign: Number(p.degreeInSign.toFixed(6)),
          house: p.house,
          isRetrograde: p.isRetrograde,
          isCombust: p.isCombust,
          dignity: p.dignity,
        };
      }),
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Pipeline (mirrors askWatchOracle.ts step-for-step, minus the network AI   */
/*  call, which is explicitly out of scope — see file header)                */
/* -------------------------------------------------------------------------- */

function runCase(def: CaseDef): Record<string, unknown> {
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

  return {
    id: def.id,
    coverageLabel: def.coverageLabel,
    input: {
      question: def.question,
      utcInstant: def.utcInstant,
      utcOffsetMinutes: def.utcOffsetMinutes,
      // The live askWatchOracle callable takes NO latitude/longitude — see
      // PHASE_0_BASELINE.md §B ("WHY THERE IS NO lat/lon"). buildWatchChart()
      // accepts an optional `location` param, but its own doc comment states
      // plainly: "Does not affect the result." This corpus therefore records
      // no lat/lon field rather than inventing one — recording an unused
      // input would misrepresent what actually determines the result.
      latLon: 'NOT APPLICABLE — watch-frame judgment does not consume location; see note above.',
    },
    derived: {
      localMoment,
      normalizedQuestionType: qType,
      chartFingerprint: fingerprintChart(chart),
    },
    verdict: publicVerdict,
    diagnosis,
    remedyProtocol: {
      interventionRequired: protocol.interventionRequired,
      guidance: protocol.guidance,
      rationale: protocol.rationale,
      stepIds: protocol.steps.map(s => s.remedy.id),
    },
    narration: null, // Deliberately excluded — see file header.
  };
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

mkdirSync(OUT_CASES, { recursive: true });

const seenIds = new Set<string>();
const manifest: Array<{ id: string; coverageLabel: string; question: string; file: string }> = [];

for (const def of cases) {
  if (seenIds.has(def.id)) {
    throw new Error(`Duplicate case id: ${def.id}`);
  }
  seenIds.add(def.id);

  const result = runCase(def);
  const file = `cases/${def.id}.json`;
  writeFileSync(resolve(OUT_ROOT, file), JSON.stringify(result, null, 2) + '\n', 'utf8');
  manifest.push({ id: def.id, coverageLabel: def.coverageLabel, question: def.question, file });
}

const byLabel: Record<string, number> = {};
for (const m of manifest) {
  byLabel[m.coverageLabel] = (byLabel[m.coverageLabel] ?? 0) + 1;
}

writeFileSync(
  resolve(OUT_ROOT, 'index.json'),
  JSON.stringify(
    {
      generatedBy: 'functions/scripts/generate-golden-corpus.ts',
      generatedAtNote:
        'Deterministic generator — rerun to regenerate; the file mtime is not meaningful, only diff-against-committed-output is.',
      engineVersionSource: 'functions/src/engine (synced from src/astrology by sync-engine.mjs)',
      totalCases: manifest.length,
      countsByCoverageLabel: byLabel,
      cases: manifest,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

// eslint-disable-next-line no-console
console.log(`Wrote ${manifest.length} golden cases to ${OUT_ROOT}`);
