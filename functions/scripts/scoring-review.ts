/**
 * scoring-review.ts — Scoring Integrity Review (owner decision 2026-10-14).
 * --------------------------------------------------------------------------
 * READ-ONLY DIAGNOSTIC. Same status as generate-golden-corpus.ts: not part
 * of the deployed bundle, not imported by anything under src/, not run by
 * CI. It changes nothing about how askWatchOracle judges. The engine's rules,
 * weights, aspect conventions, thresholds and precedence are FROZEN except
 * for the one rule the owner approved after this review (2026-10-14): Ras and
 * Dhanab count as one axis, once per judged Ghar. The script now checks the
 * replica against the engine under that rule (CURRENT) and keeps the earlier
 * rule (BEFORE_AXIS_RULE) for comparison.
 *
 * What it does, on the identical set of readings (4 questions × every 5
 * minutes of October 2026, IST = 34,560 readings) plus the 111-case golden
 * corpus:
 *
 *   1. Contribution audit — recomputes every score step by step from the
 *      chart data alone (not from factor text), and checks that the replica
 *      reproduces the engine's score, state and confidence on EVERY reading.
 *   2. Contact-level audit — occupancy vs aspect per planet, and every way
 *      one planet (or the node axis) can contribute more than once.
 *   3. Counterfactual replay — current rules vs two labelled node-axis
 *      variants; full verdict transition matrices and boundary crossings.
 *   4. Breakdown by question type, hour, ascendant sign and node-axis
 *      position.
 *   5. Sky-variation check — the October set holds only 264 distinct charts
 *      (the watch minute fixes the ascendant; the real sky moved through 22
 *      planet configurations), so the same rules are also replayed across
 *      24 months (each day at 12:00–12:55, one reading per ascendant slot)
 *      to separate a structural lean from that month's sky.
 *
 * Rule sets:
 *   BEFORE_AXIS_RULE    the rules up to 2026-10-14: each node scored on its
 *                       own, every contact −2.
 *   CURRENT             the approved rule: within one judged house, Ras and
 *                       Dhanab together count at most once (one −2).
 *   AXIS_PER_JUDGMENT   illustration only, NOT a rule: across the whole
 *                       judgment (target + 11th), the pair counts once.
 *
 * Run with:  npx vite-node scripts/scoring-review.ts   (from functions/)
 * Output:    docs/audit/scoring-review/results.json
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWatchChart, houseOf, type WatchChart } from '../src/engine/rkp/watchChart';
import {
  judgeWatchChart,
  type Confidence,
  type WatchState,
} from '../src/engine/rkp/watchJudgment';
import {
  isBenefic,
  isMalefic,
  isStrong,
  isWeak,
  relationBetween,
} from '../src/engine/rkp/rules';
import { classifyQuestion } from '../src/engine/kp/rules/questionKeywords';
import { HOUSE_MATRIX, type QuestionType } from '../src/engine/kp/rules/houseMatrix';
import { localIsoFromOffset } from '../src/utils/localTime';
import type { Planet } from '../src/engine/types/chart';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const OUT_DIR = resolve(REPO, 'docs/audit/scoring-review');

type Variant = 'BEFORE_AXIS_RULE' | 'CURRENT' | 'AXIS_PER_JUDGMENT';
const VARIANTS: readonly Variant[] = ['BEFORE_AXIS_RULE', 'CURRENT', 'AXIS_PER_JUDGMENT'];
const STATES: readonly WatchState[] = [
  'FULFILLED',
  'MOVING',
  'DELAYED',
  'BLOCKED',
  'REVERSING',
  'UNFORMED',
];
const STEPS = [
  'ruler_dignity',
  'ruler_relation',
  'target_witnesses',
  'fulfilment_witnesses',
  'ruler_placement',
  'combustion',
] as const;
type Step = (typeof STEPS)[number];
const NODES: readonly Planet[] = ['Rahu', 'Ketu'];
const isNode = (p: Planet): boolean => NODES.includes(p);

/* ── Independent replica of judgeWatchChart's scoring ─────────────────────── */

interface Contact {
  planet: Planet;
  role: 'target' | 'fulfilment';
  kind: 'occupies' | 'aspects';
  points: number; // +2 benefic, −2 malefic, 0 neutral (as the engine scores it)
}

interface Replica {
  steps: Record<Step, number>;
  contacts: Contact[];
  score: Record<Variant, number>;
  state: Record<Variant, WatchState>;
  confidence: Record<Variant, Confidence>;
}

function contactsOn(chart: WatchChart, house: number, role: Contact['role']): Contact[] {
  const h = houseOf(chart, house as never);
  const pts = (p: Planet): number => (isBenefic(p) ? 2 : isMalefic(p) ? -2 : 0);
  return [
    ...h.occupants.map(p => ({ planet: p, role, kind: 'occupies' as const, points: pts(p) })),
    ...h.aspectedBy.map(p => ({ planet: p, role, kind: 'aspects' as const, points: pts(p) })),
  ];
}

/** Witness points under a variant (steps 3 + 4 only; everything else is identical). */
function witnessPoints(contacts: Contact[], variant: Variant): number {
  const sum = (cs: Contact[]): number => cs.reduce((a, c) => a + c.points, 0);
  const nonNode = contacts.filter(c => !isNode(c.planet));
  const node = contacts.filter(c => isNode(c.planet));
  if (variant === 'BEFORE_AXIS_RULE') {
    return sum(contacts);
  }
  if (variant === 'CURRENT') {
    let total = sum(nonNode);
    for (const role of ['target', 'fulfilment'] as const) {
      if (node.some(c => c.role === role)) {
        total -= 2;
      }
    }
    return total;
  }
  return sum(nonNode) + (node.length > 0 ? -2 : 0);
}

function firstObstruction(chart: WatchChart, targetHouse: number): Planet | 'MoonDisagreement' | 'None' {
  const target = houseOf(chart, targetHouse as never);
  const order: readonly Planet[] = ['Saturn', 'Mars', 'Rahu', 'Ketu'];
  for (const p of order) if (target.occupants.includes(p)) return p;
  for (const p of order) if (target.aspectedBy.includes(p)) return p;
  const moonHouse = chart.planets.Moon.house;
  return moonHouse === 8 || moonHouse === 12 ? 'MoonDisagreement' : 'None';
}

/** Verbatim replica of resolveState / bandConfidence / downgrade (frozen rules). */
function resolveState(score: number, retro: boolean, obstruction: string, rulerWeak: boolean): WatchState {
  if (score <= -5) return 'BLOCKED';
  if (retro) return 'REVERSING';
  if (score >= 5) return 'FULFILLED';
  if (obstruction === 'Saturn' || rulerWeak) return 'DELAYED';
  if (score >= 2) return 'MOVING';
  return 'UNFORMED';
}
function bandConfidence(score: number): Confidence {
  const m = Math.abs(score);
  if (m >= 6) return 'VERY_HIGH';
  if (m >= 4) return 'HIGH';
  if (m >= 2) return 'MODERATE';
  if (m >= 1) return 'LOW';
  return 'UNCERTAIN';
}
function downgrade(c: Confidence): Confidence {
  return c === 'VERY_HIGH' ? 'HIGH' : c === 'HIGH' ? 'MODERATE' : c === 'MODERATE' ? 'LOW' : 'UNCERTAIN';
}

function replicate(chart: WatchChart, qType: QuestionType): Replica {
  const matrix = HOUSE_MATRIX[qType];
  const targetHouse = matrix.primary;
  const target = houseOf(chart, targetHouse as never);
  const ruler = target.ruler;
  const rp = chart.planets[ruler];
  const lagnaRuler = chart.lagnaRuler;

  const steps: Record<Step, number> = {
    ruler_dignity: isStrong(rp.dignity) ? 2 : isWeak(rp.dignity) ? -2 : 0,
    ruler_relation: 0,
    target_witnesses: 0,
    fulfilment_witnesses: 0,
    ruler_placement: matrix.favorable.includes(rp.house)
      ? 1
      : matrix.denial.includes(rp.house)
        ? -1
        : 0,
    combustion: rp.isCombust ? -1 : 0,
  };
  if (lagnaRuler !== ruler) {
    const rel = relationBetween(lagnaRuler, ruler);
    steps.ruler_relation = rel === 'Friend' ? 2 : rel === 'Enemy' ? -2 : 0;
  }
  const contacts = [
    ...contactsOn(chart, targetHouse, 'target'),
    ...contactsOn(chart, 11, 'fulfilment'),
  ];
  steps.target_witnesses = contacts.filter(c => c.role === 'target').reduce((a, c) => a + c.points, 0);
  steps.fulfilment_witnesses = contacts
    .filter(c => c.role === 'fulfilment')
    .reduce((a, c) => a + c.points, 0);

  const nonWitness =
    steps.ruler_dignity + steps.ruler_relation + steps.ruler_placement + steps.combustion;
  const obstruction = firstObstruction(chart, targetHouse);
  const targetContacts = contacts.filter(c => c.role === 'target');
  const sawBenefic = targetContacts.some(c => c.points > 0);
  const sawMalefic = targetContacts.some(c => c.points < 0);

  const score = {} as Record<Variant, number>;
  const state = {} as Record<Variant, WatchState>;
  const confidence = {} as Record<Variant, Confidence>;
  for (const v of VARIANTS) {
    score[v] = nonWitness + witnessPoints(contacts, v);
    state[v] = resolveState(score[v], rp.isRetrograde, obstruction, isWeak(rp.dignity));
    let c = bandConfidence(score[v]);
    if (sawBenefic && sawMalefic) c = downgrade(c);
    if (obstruction === 'MoonDisagreement') c = downgrade(c);
    confidence[v] = c;
  }
  return { steps, contacts, score, state, confidence };
}

/* ── Accumulators ─────────────────────────────────────────────────────────── */

const pct = (x: number, n: number): number => Math.round((10000 * x) / n) / 100;
const blank = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;

class Group {
  n = 0;
  scoreSum: Record<Variant, number> = blank(VARIANTS);
  states: Record<Variant, Record<WatchState, number>> = {
    BEFORE_AXIS_RULE: blank(STATES),
    CURRENT: blank(STATES),
    AXIS_PER_JUDGMENT: blank(STATES),
  };
  add(r: Replica): void {
    this.n++;
    for (const v of VARIANTS) {
      this.scoreSum[v] += r.score[v];
      this.states[v][r.state[v]]++;
    }
  }
  summary(): unknown {
    return {
      n: this.n,
      meanScore: Object.fromEntries(
        VARIANTS.map(v => [v, Math.round((100 * this.scoreSum[v]) / this.n) / 100]),
      ),
      statePct: Object.fromEntries(
        VARIANTS.map(v => [
          v,
          Object.fromEntries(STATES.map(s => [s, pct(this.states[v][s], this.n)])),
        ]),
      ),
    };
  }
}

/* ── The identical reading set ─────────────────────────────────────────────── */

const QUESTIONS = [
  'Xfghbf',
  'Will I get the new job?',
  'Will I marry her?',
  'Will my money come back?',
] as const;
const IST = 330;

function* readings(): Generator<{ question: string; iso: string; hour: number }> {
  for (const question of QUESTIONS) {
    for (let day = 1; day <= 30; day++) {
      for (let min = 0; min < 1440; min += 5) {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mm = String(min % 60).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        yield { question, iso: `2026-10-${dd}T${hh}:${mm}:00+05:30`, hour: Math.floor(min / 60) };
      }
    }
  }
}

function main(): void {
  let n = 0;
  const mismatches: string[] = [];
  const distinctCharts = new Set<string>();
  const stepSum = blank(STEPS);
  const stepNeg = blank(STEPS);
  const stepPos = blank(STEPS);

  // contact-level
  const contactStats: Record<string, { occupies: number; aspects: number; points: number }> = {};
  let samePlanetBothHouses = 0;
  let samePlanetBothHousesNonZero = 0;
  let witnessIsAlsoRuler = 0;
  let axisSameHouseBoth = 0;
  const nodeContactsHist: Record<number, number> = {};

  // replay
  const transitions: Record<string, Record<string, Record<string, number>>> = {
    CURRENT: {},
    AXIS_PER_JUDGMENT: {},
  };
  const boundary: Record<string, Record<string, number>> = {
    CURRENT: {},
    AXIS_PER_JUDGMENT: {},
  };
  const histogram: Record<Variant, Record<number, number>> = {
    BEFORE_AXIS_RULE: {},
    CURRENT: {},
    AXIS_PER_JUDGMENT: {},
  };

  const all = new Group();
  const byQuestion: Record<string, Group> = {};
  const byHour: Record<number, Group> = {};
  const byLagna: Record<string, Group> = {};
  const byAxisOffset: Record<string, Group> = {};

  for (const { question, iso, hour } of readings()) {
    const qType = classifyQuestion(question);
    const chart = buildWatchChart(iso);
    const v = judgeWatchChart(chart, qType);
    const r = replicate(chart, qType);
    n++;
    distinctCharts.add(
      `${chart.lagnaSign}|${Object.entries(chart.planets)
        .map(([p, x]) => `${p}${x.sign}${x.isRetrograde ? 'R' : ''}${x.isCombust ? 'C' : ''}`)
        .join(',')}`,
    );

    // 1. contribution audit — replica must equal the engine exactly
    // The steps are the pre-axis-rule contributions, so they sum to the
    // BEFORE_AXIS_RULE score; the engine itself now runs the CURRENT rule.
    const total = STEPS.reduce((a, s) => a + r.steps[s], 0);
    if (
      total !== r.score.BEFORE_AXIS_RULE ||
      r.score.CURRENT !== v.score ||
      r.state.CURRENT !== v.state ||
      r.confidence.CURRENT !== v.confidence
    ) {
      if (mismatches.length < 20) {
        mismatches.push(
          `${iso} ${qType}: engine ${v.score}/${v.state}/${v.confidence}, replica ${r.score.CURRENT}/${r.state.CURRENT}/${r.confidence.CURRENT}`,
        );
      }
    }
    for (const s of STEPS) {
      stepSum[s] += r.steps[s];
      if (r.steps[s] < 0) stepNeg[s]++;
      if (r.steps[s] > 0) stepPos[s]++;
    }

    // 2. contact-level
    for (const c of r.contacts) {
      const key = `${c.planet}|${c.role}`;
      contactStats[key] = contactStats[key] ?? { occupies: 0, aspects: 0, points: 0 };
      contactStats[key][c.kind]++;
      contactStats[key].points += c.points;
    }
    const inTarget = new Set(r.contacts.filter(c => c.role === 'target').map(c => c.planet));
    const inFulfil = new Set(r.contacts.filter(c => c.role === 'fulfilment').map(c => c.planet));
    const both = [...inTarget].filter(p => inFulfil.has(p));
    if (both.length > 0) samePlanetBothHouses++;
    if (both.some(p => isBenefic(p) || isMalefic(p))) samePlanetBothHousesNonZero++;
    const ruler = houseOf(chart, HOUSE_MATRIX[qType].primary as never).ruler;
    if (r.steps.ruler_dignity !== 0 && r.contacts.some(c => c.planet === ruler && c.points !== 0)) {
      witnessIsAlsoRuler++;
    }
    for (const role of ['target', 'fulfilment'] as const) {
      const nodesHere = new Set(r.contacts.filter(c => c.role === role && isNode(c.planet)).map(c => c.planet));
      if (nodesHere.size === 2) axisSameHouseBoth++;
    }
    const nodeContacts = r.contacts.filter(c => isNode(c.planet)).length;
    nodeContactsHist[nodeContacts] = (nodeContactsHist[nodeContacts] ?? 0) + 1;

    // 3. replay
    for (const alt of ['CURRENT', 'AXIS_PER_JUDGMENT'] as const) {
      const from = r.state.BEFORE_AXIS_RULE;
      const to = r.state[alt];
      transitions[alt][from] = transitions[alt][from] ?? {};
      transitions[alt][from][to] = (transitions[alt][from][to] ?? 0) + 1;
      const crossed =
        (r.score.BEFORE_AXIS_RULE <= -5) !== (r.score[alt] <= -5)
          ? 'crossesBlocked(-5)'
          : (r.score.BEFORE_AXIS_RULE >= 5) !== (r.score[alt] >= 5)
            ? 'crossesFulfilled(+5)'
            : (r.score.BEFORE_AXIS_RULE >= 2) !== (r.score[alt] >= 2)
              ? 'crossesMoving(+2)'
              : 'noThresholdCrossed';
      boundary[alt][crossed] = (boundary[alt][crossed] ?? 0) + 1;
    }
    for (const vv of VARIANTS) histogram[vv][r.score[vv]] = (histogram[vv][r.score[vv]] ?? 0) + 1;

    // 4. breakdowns
    all.add(r);
    (byQuestion[`${question} (${qType})`] ??= new Group()).add(r);
    (byHour[hour] ??= new Group()).add(r);
    (byLagna[chart.lagnaSignName] ??= new Group()).add(r);
    const target = HOUSE_MATRIX[qType].primary;
    const rahuOffset = ((chart.planets.Rahu.house - target + 12) % 12) + 1;
    (byAxisOffset[`Rahu in house ${rahuOffset} counted from the target`] ??= new Group()).add(r);
  }

  // 5. Sky-variation check across 24 months
  const byMonth: Record<string, Group> = {};
  const byMonthQuestion: Record<string, Record<string, Group>> = {};
  let skyMismatch = 0;
  for (let y = 2026; y <= 2027; y++) {
    for (let mo = 1; mo <= 12; mo++) {
      const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const key = `${y}-${String(mo).padStart(2, '0')}`;
      for (let d = 1; d <= days; d++) {
        for (let slot = 0; slot < 60; slot += 5) {
          const iso = `${key}-${String(d).padStart(2, '0')}T12:${String(slot).padStart(2, '0')}:00+05:30`;
          const chart = buildWatchChart(iso);
          for (const question of QUESTIONS) {
            const qType = classifyQuestion(question);
            const r = replicate(chart, qType);
            if (r.score.CURRENT !== judgeWatchChart(chart, qType).score) skyMismatch++;
            (byMonth[key] ??= new Group()).add(r);
            ((byMonthQuestion[qType] ??= {})[key] ??= new Group()).add(r);
          }
        }
      }
    }
  }
  const twoYears = new Group();
  for (const g of Object.values(byMonth)) {
    twoYears.n += g.n;
    for (const v of VARIANTS) {
      twoYears.scoreSum[v] += g.scoreSum[v];
      for (const st of STATES) twoYears.states[v][st] += g.states[v][st];
    }
  }

  // Golden corpus replay
  const casesDir = resolve(REPO, 'docs/audit/golden-corpus/cases');
  const golden = { cases: 0, currentMatchesStored: 0, storedMismatch: [] as string[], changed: {} as Record<string, string[]> };
  for (const alt of ['CURRENT', 'AXIS_PER_JUDGMENT']) golden.changed[alt] = [];
  for (const file of readdirSync(casesDir).filter(f => f.endsWith('.json')).sort()) {
    const c = JSON.parse(readFileSync(resolve(casesDir, file), 'utf8')) as {
      id: string;
      input: { question: string; utcInstant: string; utcOffsetMinutes: number };
      verdict: { state: WatchState; score: number };
    };
    const qType = classifyQuestion(c.input.question);
    const chart = buildWatchChart(localIsoFromOffset(new Date(c.input.utcInstant), c.input.utcOffsetMinutes));
    const r = replicate(chart, qType);
    golden.cases++;
    if (r.score.BEFORE_AXIS_RULE === c.verdict.score && r.state.BEFORE_AXIS_RULE === c.verdict.state) {
      golden.currentMatchesStored++;
    } else {
      golden.storedMismatch.push(c.id);
    }
    for (const alt of ['CURRENT', 'AXIS_PER_JUDGMENT'] as const) {
      if (r.state[alt] !== r.state.BEFORE_AXIS_RULE) {
        golden.changed[alt].push(`${c.id}: ${r.state.BEFORE_AXIS_RULE} (${r.score.BEFORE_AXIS_RULE}) → ${r.state[alt]} (${r.score[alt]})`);
      }
    }
  }

  const contactTable = Object.entries(contactStats)
    .map(([k, s]) => {
      const [planet, role] = k.split('|');
      return {
        planet,
        role,
        occupiesPerReading: Math.round((1000 * s.occupies) / n) / 1000,
        aspectsPerReading: Math.round((1000 * s.aspects) / n) / 1000,
        meanPointsPerReading: Math.round((1000 * s.points) / n) / 1000,
      };
    })
    .sort((a, b) => a.meanPointsPerReading - b.meanPointsPerReading);

  const results = {
    generatedBy: 'functions/scripts/scoring-review.ts',
    readingSet: `${QUESTIONS.length} questions × every 5 minutes of 2026-10-01..30, UTC offset +${IST} min`,
    readings: n,
    distinctChartsInReadingSet: distinctCharts.size,
    audit1_contribution: {
      replicaMatchesEngineOnEveryReading: mismatches.length === 0,
      mismatches,
      meanByStep: Object.fromEntries(STEPS.map(s => [s, Math.round((1000 * stepSum[s]) / n) / 1000])),
      sumOfStepMeans: Math.round((1000 * STEPS.reduce((a, s) => a + stepSum[s], 0)) / n) / 1000,
      negativePct: Object.fromEntries(STEPS.map(s => [s, pct(stepNeg[s], n)])),
      positivePct: Object.fromEntries(STEPS.map(s => [s, pct(stepPos[s], n)])),
    },
    audit2_contacts: {
      table: contactTable,
      samePlanetWitnessesBothHousesPct: pct(samePlanetBothHouses, n),
      samePlanetScoredInBothHousesPct: pct(samePlanetBothHousesNonZero, n),
      matterRulerAlsoScoredAsWitnessPct: pct(witnessIsAlsoRuler, n),
      bothNodesOnSameHouse_perJudgedHousePct: pct(axisSameHouseBoth, 2 * n),
      nodeContactsPerJudgmentPct: Object.fromEntries(
        Object.entries(nodeContactsHist).map(([k, c]) => [k, pct(c, n)]),
      ),
    },
    audit3_replay: {
      overall: all.summary(),
      transitions,
      boundaryCrossings: boundary,
      scoreHistogram: histogram,
    },
    audit4_breakdown: {
      byQuestion: Object.fromEntries(Object.entries(byQuestion).map(([k, g]) => [k, g.summary()])),
      byHour: Object.fromEntries(Object.entries(byHour).map(([k, g]) => [k, g.summary()])),
      byAscendant: Object.fromEntries(Object.entries(byLagna).map(([k, g]) => [k, g.summary()])),
      byNodeAxisPosition: Object.fromEntries(
        Object.entries(byAxisOffset)
          .sort(([a], [b]) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))
          .map(([k, g]) => [k, g.summary()]),
      ),
    },
    audit5_skyVariation: {
      replicaMismatches: skyMismatch,
      twoYearsOverall: twoYears.summary(),
      byMonth: Object.fromEntries(Object.entries(byMonth).map(([k, g]) => [k, g.summary()])),
      byQuestionTypeByMonth: Object.fromEntries(
        Object.entries(byMonthQuestion).map(([q, months]) => [
          q,
          Object.fromEntries(Object.entries(months).map(([k, g]) => [k, g.summary()])),
        ]),
      ),
    },
    goldenCorpus: golden,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`readings ${n}; replica matches engine: ${mismatches.length === 0}; golden ${golden.currentMatchesStored}/${golden.cases}`);
}

main();
