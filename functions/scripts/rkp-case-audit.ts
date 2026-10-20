/**
 * rkp-case-audit.ts — deterministic chart-factor extraction for rule audits.
 * --------------------------------------------------------------------------
 * Scaffolding only, same status as generate-golden-corpus.ts: not part of the
 * deployed bundle, imported nowhere, changes no engine behaviour.
 *
 * Calls the exact functions askWatchOracle.ts calls (buildWatchChart,
 * judgeWatchChart) and writes, for each case, the facts a rule review needs:
 * who occupies and who aspects the target Ghar and the 11th Ghar, the
 * querent's ruler and its condition, and the engine's own verdict and factor
 * list. Nothing here is recomputed or re-interpreted: every aspect list comes
 * from WatchChart.houses[].aspectedBy, i.e. the engine's own aspect table, so
 * a reviewer (human or AI) never has to reconstruct planetary factors.
 *
 * Run with: npx vite-node scripts/rkp-case-audit.ts   (from functions/)
 * Writes:   ../docs/rkp-audit/case_records.json and case_records.md
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildWatchChart, houseOf } from '../src/engine/rkp/watchChart';
import { judgeWatchChart } from '../src/engine/rkp/watchJudgment';
import { HOUSE_MATRIX } from '../src/engine/kp/rules/houseMatrix';
import { classifyQuestion } from '../src/engine/kp/rules/questionKeywords';
import { SIGN_META, gharLabel, type HouseNumber } from '../src/engine/rkp/nomenclature';

interface AuditCase {
  readonly id: string;
  readonly question: string;
  /** Local ISO with offset, exactly as askWatchOracle builds it. */
  readonly iso: string;
}

const CASES: readonly AuditCase[] = [
  { id: 'case-1', question: 'Will I get the job?', iso: '2026-10-20T07:28:00+05:30' },
  { id: 'case-2', question: 'Will I get the job?', iso: '2026-03-12T16:42:00+05:30' },
  { id: 'case-3', question: 'Will my marriage happen this year?', iso: '2026-06-05T11:13:00+05:30' },
  { id: 'case-4', question: 'Will my business grow?', iso: '2026-12-02T09:51:00+05:30' },
  { id: 'case-5', question: 'Will I recover from illness?', iso: '2026-08-17T20:07:00+05:30' },
];

/**
 * Which step of judgeWatchChart wrote a factor, inferred from the factor text
 * the engine itself produced. Annotation only — the engine records no step id.
 */
function stepOf(factor: string): string {
  if (/rules the .* and is .* in /.test(factor)) return 'S1 ruler strength';
  if (/\(your own ruler\) counts/.test(factor)) return 'S2 querent-vs-matter ruler';
  if (/the 11th Ghar/.test(factor)) return 'S4 fulfilment Ghar (11th)';
  if (/sits in the|casts its gaze on the/.test(factor)) return 'S3 on/aspecting target Ghar';
  if (/has landed in the/.test(factor)) return 'S5 ruler placement';
  if (/retrograde/.test(factor)) return 'S6 retrograde (no points)';
  if (/combust/.test(factor)) return 'S6 combust';
  if (/Qamar occupies a denying Ghar/.test(factor)) return 'S7 Moon disagreement';
  if (/Benefic and malefic witnesses/.test(factor)) return 'S9 confidence downgrade';
  return 'unclassified';
}

function record(c: AuditCase) {
  const qType = classifyQuestion(c.question);
  const chart = buildWatchChart(c.iso);
  const verdict = judgeWatchChart(chart, qType);
  const matrix = HOUSE_MATRIX[qType];
  const target = houseOf(chart, verdict.targetHouse);
  const fulfilment = houseOf(chart, 11);
  const querentRuler = chart.planets[chart.lagnaRuler];
  const targetRuler = chart.planets[verdict.targetRuler];

  const ghar = (h: ReturnType<typeof houseOf>) => ({
    ghar: h.house,
    label: gharLabel(h.house as HouseNumber),
    sign: h.signName,
    ruler: h.rulerName,
    occupants: h.occupants.map(p => chart.planets[p].name),
    aspectedBy: h.aspectedBy.map(p => chart.planets[p].name),
  });
  const cond = (p: typeof querentRuler) => ({
    planet: p.name,
    sign: `Burj ${SIGN_META[p.sign].name}`,
    degreeInSign: Number(p.degreeInSign.toFixed(2)),
    ghar: p.house,
    dignity: p.dignity,
    retrograde: p.isRetrograde,
    combust: p.isCombust,
  });

  return {
    id: c.id,
    question: c.question,
    localMoment: c.iso,
    questionType: qType,
    watchMinute: chart.window.minute,
    lagna: chart.lagnaSignName,
    houseMatrix: { primary: matrix.primary, favorable: matrix.favorable, denial: matrix.denial },
    targetGhar: ghar(target),
    fulfilmentGhar: ghar(fulfilment),
    querentRuler: cond(querentRuler),
    matterRuler: cond(targetRuler),
    rulerRelationAsRecorded: verdict.rulerRelation,
    planets: Object.values(chart.planets).map(p => ({
      ...cond(p),
      aspectsGhars: [...p.aspects],
    })),
    engineVerdict: {
      state: verdict.state,
      score: verdict.score,
      confidence: verdict.confidence,
      obstruction: verdict.obstruction,
      reversal: verdict.reversal,
      timing: verdict.timing,
    },
    factors: verdict.factors.map(text => ({ step: stepOf(text), text })),
  };
}

const records = CASES.map(record);

const outDir = resolve(__dirname, '../../docs/rkp-audit');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'case_records.json'), JSON.stringify(records, null, 2) + '\n');

const list = (xs: readonly string[]): string => (xs.length === 0 ? '—' : xs.join(', '));
const md: string[] = [
  '# RKP audit — engine-recorded chart factors',
  '',
  'Generated by `functions/scripts/rkp-case-audit.ts` from `buildWatchChart` and',
  '`judgeWatchChart`. Nothing is recomputed: aspect lists are the engine\'s own',
  '`WatchChart.houses[].aspectedBy`. This file records what the engine DID, not',
  'what RKP requires. See RKP_RULE_LEDGER.md for the status of each rule.',
  '',
];
for (const r of records) {
  md.push(
    `## ${r.id} — "${r.question}"`,
    '',
    `Local moment ${r.localMoment} · watch minute ${r.watchMinute} · 1st Ghar ${r.lagna} · type \`${r.questionType}\``,
    `House matrix: primary ${r.houseMatrix.primary}, favourable ${r.houseMatrix.favorable.join('/')}, denial ${r.houseMatrix.denial.join('/') || '—'}`,
    '',
    '| Ghar | Sign (ruler) | Occupants | Aspected by |',
    '|---|---|---|---|',
    `| Target ${r.targetGhar.ghar} | ${r.targetGhar.sign} (${r.targetGhar.ruler}) | ${list(r.targetGhar.occupants)} | ${list(r.targetGhar.aspectedBy)} |`,
    `| 11th | ${r.fulfilmentGhar.sign} (${r.fulfilmentGhar.ruler}) | ${list(r.fulfilmentGhar.occupants)} | ${list(r.fulfilmentGhar.aspectedBy)} |`,
    '',
    `Querent's ruler: ${r.querentRuler.planet}, ${r.querentRuler.sign} ${r.querentRuler.degreeInSign}°, Ghar ${r.querentRuler.ghar}, ${r.querentRuler.dignity}${r.querentRuler.retrograde ? ', retrograde' : ''}${r.querentRuler.combust ? ', combust' : ''}.`,
    `Matter's ruler: ${r.matterRuler.planet}, ${r.matterRuler.sign} ${r.matterRuler.degreeInSign}°, Ghar ${r.matterRuler.ghar}, ${r.matterRuler.dignity}${r.matterRuler.retrograde ? ', retrograde' : ''}${r.matterRuler.combust ? ', combust' : ''}. Querent→matter relation recorded: ${r.rulerRelationAsRecorded}.`,
    '',
    '| Planet | Sign | Ghar | Dignity | Flags | Aspects Ghars |',
    '|---|---|---|---|---|---|',
    ...r.planets.map(
      p =>
        `| ${p.planet} | ${p.sign} ${p.degreeInSign}° | ${p.ghar} | ${p.dignity} | ${[p.retrograde ? 'R' : '', p.combust ? 'C' : ''].filter(Boolean).join(' ') || '—'} | ${p.aspectsGhars.join(', ')} |`,
    ),
    '',
    `**Engine verdict:** ${r.engineVerdict.state}, score ${r.engineVerdict.score}, confidence ${r.engineVerdict.confidence}, obstruction ${r.engineVerdict.obstruction}, reversal ${r.engineVerdict.reversal}, timing ${r.engineVerdict.timing === null ? 'none' : `${r.engineVerdict.timing.minDays}–${r.engineVerdict.timing.maxDays} days`}.`,
    '',
    'Factors the engine applied, in order:',
    ...r.factors.map(f => `- [${f.step}] ${f.text}`),
    '',
  );
}
writeFileSync(resolve(outDir, 'case_records.md'), md.join('\n'));

// Blind sheet for the owner: the same chart facts, no engine verdict or factors,
// so a human judge is not anchored by the app's answer.
const blind: string[] = [
  '# RKP charts for the owner to judge (engine verdict withheld)',
  '',
  'Same chart facts as case_records.md. Aspect lists are the app\'s own table.',
  '',
];
for (const r of records) {
  blind.push(
    `## ${r.id} — "${r.question}"`,
    '',
    `Local moment ${r.localMoment} · 1st Ghar ${r.lagna}`,
    '',
    '| Ghar | Sign (ruler) | Occupants | Aspected by |',
    '|---|---|---|---|',
    `| Target ${r.targetGhar.ghar} | ${r.targetGhar.sign} (${r.targetGhar.ruler}) | ${list(r.targetGhar.occupants)} | ${list(r.targetGhar.aspectedBy)} |`,
    `| 11th | ${r.fulfilmentGhar.sign} (${r.fulfilmentGhar.ruler}) | ${list(r.fulfilmentGhar.occupants)} | ${list(r.fulfilmentGhar.aspectedBy)} |`,
    '',
    '| Planet | Sign | Ghar | Dignity | Flags |',
    '|---|---|---|---|---|',
    ...r.planets.map(
      p =>
        `| ${p.planet} | ${p.sign} ${p.degreeInSign}° | ${p.ghar} | ${p.dignity} | ${[p.retrograde ? 'R' : '', p.combust ? 'C' : ''].filter(Boolean).join(' ') || '—'} |`,
    ),
    '',
  );
}
writeFileSync(resolve(outDir, 'case_records_blind.md'), blind.join('\n'));
console.log(`wrote ${records.length} case records to ${outDir}`);
