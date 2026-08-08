/**
 * judgeKP — classical Krishnamurti Paddhati (KP) judgment engine.
 * --------------------------------------------------------------------------
 * Implements textbook classical KP horary judgment, independent of and
 * running alongside RKP's own scoring engine (judgeHorary.ts). Full
 * doctrine reference: docs/KP_RULES_CLASSICAL.md. Cross-checked against
 * this repo's own prior analysis in RKP_KP_FORENSIC_AUDIT.md.
 *
 * THE ALGORITHM:
 *
 *  KP STEP 0  Promise Layer (shared with RKP, ./promise.ts): the sub-lord
 *             of the PRIMARY cusp must NOT occupy a denial house. If it
 *             does, the chart cannot deliver an answer — return DENIED
 *             before any witness analysis.
 *
 *  KP STEP 1  Moon's Sub-Lord: computed and surfaced for display/timing
 *             ONLY. Unlike RKP, classical KP does NOT score this as a
 *             numeric contributor — see docs/KP_RULES_CLASSICAL.md §3.
 *
 *  KP STEP 2  Significators (shared with RKP, ./significators.ts): the
 *             classical 4-tier occupation-before-ownership ranking, for
 *             both the favorable and denial house groups.
 *
 *  KP STEP 3  5 Classical Witnesses (Day Lord, Asc Sign Lord, Asc Star
 *             Lord, Moon Sign Lord, Moon Star Lord — NO Hora Lord, which
 *             is RKP's confirmatory 6th addition), Kotamraju-filtered
 *             (shared, ./kotamraju.ts).
 *
 *  KP STEP 4  Fructification: a MAJORITY COUNT of witnesses that are also
 *             favorable vs. denial significators — NOT a weighted score.
 *             See docs/KP_RULES_CLASSICAL.md §5 / RKP_KP_FORENSIC_AUDIT.md
 *             §F for the exact pseudocode this mirrors:
 *               confirmedCount > deniedCount → YES
 *               deniedCount > confirmedCount → NO
 *               tie (including 0/0)          → CONDITIONAL
 *             No thresholds like RKP's "≥3"/"≤−2" exist anywhere here.
 *
 *  KP STEP 5  DELAYED modifier (shared with RKP, ./retrogradeModifier.ts):
 *             a YES becomes DELAYED when Moon's sub-lord, Jupiter, or
 *             Venus is retrograde.
 *
 *  KP STEP 6  Timing: reused as-is from RKP (./timing.ts) — engine-agnostic,
 *             takes any confirmed-significator list.
 *
 *  Confidence: a presentation-layer convenience ONLY — classical KP has no
 *  native numeric confidence (docs/KP_RULES_CLASSICAL.md §8). Computed as
 *  the witness-agreement ratio, a formula deliberately distinct from RKP's.
 *
 *  No remedy: docs/KP_RULES_CLASSICAL.md §9 — remedy is an RKP/product
 *  addition, never a KP output. This function simply never sets
 *  `Verdict.remedy` (the field is optional); enforced by unit test rather
 *  than a type-level fork, to avoid rippling a KP-only type through every
 *  downstream consumer of `Verdict`.
 *
 *  No horary-number witness: that witness is explicitly RKP-only (see
 *  judgeHorary.ts's own module docstring) — judgeKP has no such parameter.
 *
 * Determinism guarantee: same (chart, question) → identical Verdict. No
 * Date.now(), no Math.random(). Uses the same deterministic-id machinery
 * as RKP but with a 'KP' engine tag, so the two engines' verdicts for one
 * reading never collide (see ./verdictSnapshots.ts).
 */

import type { Chart, Planet, HouseIndex } from '@astrology/types/chart';
import type { ClassifiedQuestion } from '@astrology/types/question';
import type {
  Verdict,
  VerdictKind,
  RulingPlanetsSnapshot,
  VerdictNarration,
  ReasoningStep,
} from '@astrology/types/verdict';
import { HOUSE_MATRIX } from '@astrology/kp/rules/houseMatrix';
import { classicalWitnesses } from '@astrology/primitives/rulingPlanets';
import { houseOfPlanet } from './significations';
import { computeSignificatorSets } from './significators';
import { computeConvergenceTiming } from './timing';
import { ENGINE_VERSION } from '@astrology/primitives/chartBuilder';
import { checkPromise } from './promise';
import { applyKotamrajuFilter } from './kotamraju';
import { applyRetrogradeDelay } from './retrogradeModifier';
import {
  deterministicId,
  buildQuestionCuspDetail,
  buildMoonSubLordSnapshot,
} from './verdictSnapshots';

// ── Reasoning trace ───────────────────────────────────────────────────────────

function step(n: number, msg: string, weight = 0): ReasoningStep {
  return { ruleId: `KP_STEP_${n}`, description: `[KP STEP ${n}] ${msg}`, weight };
}

// ── Ruling-planet witness snapshot (5 witnesses, no Hora Lord) ────────────────

function buildKpWitnessSnapshot(chart: Chart, agreementScore: number): RulingPlanetsSnapshot {
  const rps = chart.rulingPlanets;
  return {
    dayLord: rps[0] as Planet,
    // horaLord intentionally omitted — RKP-only 6th witness, see module docstring.
    ascSignLord: rps[2] as Planet,
    ascStarLord: rps[3] as Planet,
    moonSignLord: rps[4] as Planet,
    moonStarLord: rps[5] as Planet,
    agreementScore,
  };
}

// ── Narration ─────────────────────────────────────────────────────────────────
// Analytical register, distinct from RKP's mystical voice — but, matching the
// house style RKP's narration is held to (see judgeHorary.test.ts's "oracle
// narration language" test), free of raw KP/Vedic jargon in the prose itself.

function buildKpEn(
  verdict: VerdictKind,
  qType: string,
  confirmedCount: number,
  deniedCount: number,
): string {
  switch (verdict) {
    case 'YES':
      return `The classical witnesses for your ${qType} matter converge in agreement — ${confirmedCount} confirm against ${deniedCount} in denial. The outcome is favorable.`;
    case 'NO':
      return `The classical witnesses for your ${qType} matter converge against a favorable outcome — ${deniedCount} deny against ${confirmedCount} confirming. Patience and redirection are counseled.`;
    case 'CONDITIONAL':
      return `The classical witnesses for your ${qType} matter are evenly divided — ${confirmedCount} confirm, ${deniedCount} deny. The outcome depends on conditions not yet settled.`;
    case 'DELAYED':
      return `The classical witnesses favor your ${qType} matter, but a retrograde influence delays its arrival. The outcome is promised; the timing is not yet.`;
    case 'UNCLEAR':
      return `The classical witnesses for your ${qType} matter have not reached clear agreement at this hour. Ask again once the sky has moved.`;
    case 'DENIED':
      return `This chart holds no promise for your ${qType} question at this moment, regardless of the witnesses. Ask again at a different hour.`;
  }
}

function buildKpUr(verdict: VerdictKind, qType: string): string {
  switch (verdict) {
    case 'YES':
      return `آپ کے ${qType} کے معاملے میں کلاسیکی گواہ متفق ہیں۔ نتیجہ موافق ہے۔`;
    case 'NO':
      return `آپ کے ${qType} کے معاملے میں کلاسیکی گواہ ساز گار نہیں ہیں۔ صبر کی رہنمائی ہے۔`;
    case 'CONDITIONAL':
      return `آپ کے ${qType} کے معاملے میں گواہ برابر تقسیم ہیں۔ نتیجہ ابھی غیر طے شدہ حالات پر منحصر ہے۔`;
    case 'DELAYED':
      return `آپ کے ${qType} کے معاملے میں گواہ موافق ہیں، لیکن آمد میں تاخیر ہے۔`;
    case 'UNCLEAR':
      return `اس وقت کلاسیکی گواہی واضح نہیں ہے۔ دوبارہ سوال کریں۔`;
    case 'DENIED':
      return `اس وقت زائچہ آپ کے ${qType} کے سوال کا جواب دینے کی صلاحیت نہیں رکھتا۔ کسی مناسب وقت پر دوبارہ رجوع کریں۔`;
  }
}

function buildKpHi(verdict: VerdictKind, qType: string): string {
  // Interface-only Hindi per project convention (see README) — mirrors buildKpUr.
  return buildKpUr(verdict, qType);
}

function buildKpNarration(
  verdict: VerdictKind,
  qType: string,
  confirmedCount: number,
  deniedCount: number,
): VerdictNarration {
  return {
    en: buildKpEn(verdict, qType, confirmedCount, deniedCount),
    ur: buildKpUr(verdict, qType),
    hi: buildKpHi(verdict, qType),
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Judge a classical KP horary chart.
 *
 * @param chart    Fully populated Chart from buildChart() — the SAME chart
 *                  RKP's judgeHorary() uses; no second chart is built.
 * @param question Pre-classified question
 * @returns        Complete Verdict, engine: 'KP', ready to persist and render
 *                  alongside (not instead of) the RKP verdict.
 */
export function judgeKP(chart: Chart, question: ClassifiedQuestion): Verdict {
  const reasoning: ReasoningStep[] = [];

  // ── KP STEP 1: Moon's Sub-Lord — informational/timing only, not scored ────
  const moonPos = chart.planets.Moon;
  const moonSubLord = moonPos.subLord;

  reasoning.push(
    step(
      1,
      `Moon at ${moonPos.siderealLongitude.toFixed(2)}° sidereal` +
        ` (manzil lord: ${moonPos.nakshatraLord}, sub-lord: ${moonSubLord}) — informational, not scored`,
    ),
  );

  const qType = question.qType;
  const matrix = HOUSE_MATRIX[qType];
  const { favorable, denial, primary } = matrix;

  // ── KP STEP 0: Promise Layer — fires before any witness analysis ─────────
  const promise = checkPromise(chart, denial, primary as number);
  if (promise.denied) {
    const deniedReasoning: ReasoningStep[] = [
      step(
        0,
        `Question: '${qType}' | favorable=[${favorable.join(',')}] denial=[${denial.join(',')}]`,
      ),
      step(
        0,
        `Promise FAILED: cusp ${promise.cuspHouse} sub-lord = ${promise.cuspSubLord}` +
          ` occupies house ${promise.cuspSubLordHouse} ∈ denial [${denial.join(',')}] → DENIED`,
        -1,
      ),
    ];
    const deniedNarration = buildKpNarration('DENIED', qType, 0, 0);
    const moonSubLordForDenied = moonPos.subLord as Planet;
    const moonSubLordHouseForDenied = houseOfPlanet(moonSubLordForDenied, chart);
    return Object.freeze({
      id: deterministicId(chart, question, 'KP'),
      computedAt: chart.momentUtc,
      question,
      qType,
      chart,
      favorableHouses: favorable as HouseIndex[],
      denialHouses: denial as HouseIndex[],
      questionCusp: buildQuestionCuspDetail(primary as HouseIndex, chart),
      moonSubLord: buildMoonSubLordSnapshot(
        moonSubLordForDenied,
        moonSubLordHouseForDenied,
        [],
        [],
        chart,
      ),
      rulingPlanets: buildKpWitnessSnapshot(chart, 0),
      verdict: 'DENIED' as VerdictKind,
      confidence: 0,
      stage: 'promise_failed' as const,
      reasoning: Object.freeze(deniedReasoning),
      narration: deniedNarration,
      retrogradeFlags: Object.freeze([] as Planet[]),
      combustFlags: Object.freeze([] as Planet[]),
      engineVersion: ENGINE_VERSION,
      engine: 'KP',
    } satisfies Verdict);
  }

  reasoning.push(
    step(
      0,
      `Question: '${qType}' | favorable houses=[${favorable.join(',')}] denial=[${denial.join(',')}]`,
    ),
  );

  // ── KP STEP 2: Significators (shared 4-tier ranking) ──────────────────────
  const significators = computeSignificatorSets(chart, favorable, denial);
  const moonSubLordHouse = houseOfPlanet(moonSubLord, chart);

  // ── KP STEP 3: 5 Classical Witnesses + Kotamraju filter ───────────────────
  const witnesses = classicalWitnesses(chart.rulingPlanets).filter(Boolean);
  const filteredWitnesses = applyKotamrajuFilter(witnesses, favorable, denial, chart);
  const filteredSet = new Set<Planet>(filteredWitnesses);

  for (const rp of witnesses) {
    if (!filteredSet.has(rp)) {
      reasoning.push(step(3, `${rp} removed by Kotamraju filter (sub-lord in denial)`, 0));
    }
  }

  const confirmedSignificators = significators.favorable.filter(p => filteredSet.has(p));
  const deniedSignificators = significators.denial.filter(p => filteredSet.has(p));

  for (const p of confirmedSignificators) {
    reasoning.push(step(3, `${p}: favorable significator ∩ witness → confirms`, 1));
  }
  for (const p of deniedSignificators) {
    reasoning.push(step(3, `${p}: denial significator ∩ witness → denies`, -1));
  }
  for (const rp of filteredWitnesses) {
    if (!confirmedSignificators.includes(rp) && !deniedSignificators.includes(rp)) {
      reasoning.push(step(3, `${rp}: witness but not a question significator → neutral`, 0));
    }
  }

  // ── KP STEP 4: Fructification — majority count, NOT a weighted score ─────
  // See docs/KP_RULES_CLASSICAL.md §5 / RKP_KP_FORENSIC_AUDIT.md §F.
  const confirmedCount = confirmedSignificators.length;
  const deniedCount = deniedSignificators.length;

  let verdict: VerdictKind;
  if (confirmedCount > deniedCount) {
    verdict = 'YES';
  } else if (deniedCount > confirmedCount) {
    verdict = 'NO';
  } else {
    verdict = 'CONDITIONAL';
  }

  reasoning.push(
    step(
      4,
      `Witnesses: ${confirmedCount} confirm, ${deniedCount} deny → verdict = ${verdict}` +
        ` (majority count, no weighted score)`,
      confirmedCount - deniedCount,
    ),
  );

  // ── KP STEP 5: Retrograde → DELAYED modifier (shared doctrine) ────────────
  const retro = applyRetrogradeDelay(verdict, chart, moonSubLord);
  verdict = retro.verdict;
  if (retro.retrogradeWitnesses.length > 0 && retro.note !== undefined) {
    reasoning.push(step(5, `YES → DELAYED: ${retro.note}`, 0));
  }

  // ── Confidence — presentation layer only, NOT KP doctrine (see docstring) ─
  const totalWitnesses = confirmedCount + deniedCount;
  const confidence =
    totalWitnesses === 0
      ? 50
      : Math.round((Math.max(confirmedCount, deniedCount) / totalWitnesses) * 100);

  // ── KP STEP 6: Timing — reused as-is, engine-agnostic ──────────────────────
  const timing = computeConvergenceTiming(chart, confirmedSignificators as Planet[]);
  reasoning.push(
    step(
      6,
      `Timing: convergence on MD=${timing.activeDasha} AD=${timing.activeAntardasha} → ${timing.window}`,
    ),
  );

  // ── Retrograde / combust flags ─────────────────────────────────────────────
  const retrogradeFlags: Planet[] = [];
  const combustFlags: Planet[] = [];
  for (const [p, pos] of Object.entries(chart.planets) as [
    Planet,
    (typeof chart.planets)[Planet],
  ][]) {
    if (pos.isRetrograde) {
      retrogradeFlags.push(p);
    }
    if (pos.isCombust) {
      combustFlags.push(p);
    }
  }

  // ── Assemble sub-objects ────────────────────────────────────────────────────
  const favHits = ([moonSubLordHouse] as HouseIndex[]).filter(h =>
    (favorable as number[]).includes(h),
  );
  const denHits = ([moonSubLordHouse] as HouseIndex[]).filter(h =>
    (denial as number[]).includes(h),
  );

  const moonSubLordSnapshot = buildMoonSubLordSnapshot(
    moonSubLord,
    moonSubLordHouse,
    favHits,
    denHits,
    chart,
  );
  const rpSnapshot = buildKpWitnessSnapshot(chart, confirmedCount - deniedCount);
  const questionCuspDetail = buildQuestionCuspDetail(primary as HouseIndex, chart);
  const narration = buildKpNarration(verdict, qType, confirmedCount, deniedCount);

  // ── Final Verdict — no remedy, ever (see module docstring) ─────────────────
  return Object.freeze({
    id: deterministicId(chart, question, 'KP'),
    computedAt: chart.momentUtc,
    question,
    qType,
    chart,
    favorableHouses: favorable as HouseIndex[],
    denialHouses: denial as HouseIndex[],
    questionCusp: questionCuspDetail,
    moonSubLord: moonSubLordSnapshot,
    rulingPlanets: rpSnapshot,
    verdict,
    confidence,
    stage: 'fructification' as const,
    reasoning: Object.freeze(reasoning),
    significators,
    confirmedSignificators: Object.freeze(confirmedSignificators as Planet[]),
    deniedSignificators: Object.freeze(deniedSignificators as Planet[]),
    timing,
    narration,
    retrogradeFlags: Object.freeze(retrogradeFlags),
    combustFlags: Object.freeze(combustFlags),
    engineVersion: ENGINE_VERSION,
    engine: 'KP',
  } satisfies Verdict);
}
