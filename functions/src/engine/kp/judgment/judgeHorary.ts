/**
 * judgeHorary — Phase 3 RKP judgment engine.
 * --------------------------------------------------------------------------
 * Implements the exact 5-step RKP algorithm per docs/RKP_RULES_FROM_SARFARAZ.md.
 *
 * THE ALGORITHM (source: RKP_RULES_FROM_SARFARAZ.md):
 *
 *  STEP 1  Find Moon's nakshatra and Sub-Lord at the question moment.
 *          Moon's Sub-Lord = the planet ruling the proportional sub-division
 *          of the nakshatra at Moon's exact sidereal longitude.
 *          (Already computed by Phase 2 — chart.planets['Moon'].subLord)
 *
 *  STEP 2  Map question to house matrix (favorable + denial houses).
 *
 *  STEP 0  Promise Layer (Cusp Sub-Lord): The sub-lord of the PRIMARY cusp must NOT
 *          occupy a denial house. If it does, the chart itself cannot deliver an answer
 *          regardless of planetary positions — return DENIED before any scoring.
 *
 *  STEP 1  Moon's Sub-Lord: Check which house Moon's Sub-Lord OCCUPIES.
 *          This is the primary RKP signal:
 *            In favorable house → +2 to score
 *            In denial house    → −2 to score
 *
 *  STEP 2  Significator Verification (Phase B/D): Use 5 Classical Witnesses
 *          (Day Lord, Asc Sign Lord, Asc Star Lord, Moon Sign Lord, Moon Star Lord)
 *          plus the Hora Lord as a confirmatory signal. For each witness, if it is
 *          a favorable significator, +1 to score; if a denial significator, -1.
 *
 *  STEP 3  Total score → verdict:
 *            ≥ +3  → YES (favorable)
 *            ≤ −2  → NO (unfavorable)
 *            −1 to +2 → CONDITIONAL (mixed)
 *
 *  DELAYED modifier: if verdict is YES but Moon's Sub-Lord, Jupiter, or Venus
 *                    is retrograde → verdict becomes DELAYED.
 *
 *  TIMING: Timing planet = nakshatra lord of Moon's Sub-Lord.
 *          Months estimate = DASHA_YEARS[timingPlanet] × 12 × (score / maxScore)
 *
 * Determinism guarantee: same (chart, question) → identical Verdict.
 * No Date.now(), no Math.random(), no unordered Set iteration.
 */

import type { Chart, Planet, HouseIndex } from '../../types/chart';
import type { ClassifiedQuestion } from '../../types/question';
import type {
  Verdict,
  VerdictKind,
  MoonSubLordSnapshot,
  QuestionCuspDetail,
  RulingPlanetsSnapshot,
  VerdictRemedy,
  VerdictNarration,
  ReasoningStep,
} from '../../types/verdict';
import { HOUSE_MATRIX } from '../../kp/rules/houseMatrix';
import { houseOfPlanet } from './significations';
import { computeSignificatorSets } from './significators';
import { computeConvergenceTiming } from './timing';
import { ENGINE_VERSION } from '../../primitives/chartBuilder';

// ── Deterministic ID (no Math.random — determinism spec) ──────────────────────

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    // eslint-disable-next-line no-bitwise
    h ^= s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function deterministicId(chart: Chart, question: ClassifiedQuestion): string {
  const seed = `${chart.momentUtc}|${chart.location.latitude}|${chart.location.longitude}|${question.text}|${question.qType}`;
  const a = fnv1a(seed);
  const b = fnv1a(seed + 'b');
  const c = fnv1a(seed + 'c');
  const d = fnv1a(seed + 'd');
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-${c.slice(0, 4)}-${c.slice(4)}${d.slice(0, 8)}`;
}

// ── Reasoning trace ───────────────────────────────────────────────────────────

function step(n: number, msg: string, weight = 0): ReasoningStep {
  return { ruleId: `STEP_${n}`, description: `[STEP ${n}] ${msg}`, weight };
}

// ── Timing ────────────────────────────────────────────────────────────────────
// ── Remedy ────────────────────────────────────────────────────────────────────

const REMEDY_TABLE: Readonly<
  Record<Planet, { action: string; avoid: string; zikr?: string; charity?: string }>
> = {
  Sun: {
    action: 'Recite Surah Ad-Duha (93) after Fajr for 7 days',
    avoid: 'Avoid arrogance and heedlessness in speech',
    zikr: 'Ya Nur × 100 daily',
    charity: 'Give sadaqah to an orphan or the poor on Sunday',
  },
  Moon: {
    action: 'Recite Ayat al-Kursi (2:255) before sleeping',
    avoid: 'Avoid emotional decisions at night',
    zikr: 'Ya Quddus × 100 daily',
    charity: 'Offer food or water to someone in need',
  },
  Mars: {
    action: 'Recite Surah Al-Falaq (113) and Al-Nas (114) seven times',
    avoid: 'Avoid anger, haste, and confrontation',
    zikr: 'Ya Matin × 100 daily',
    charity: 'Give sadaqah to protect against harm',
  },
  Mercury: {
    action: 'Recite Surah Al-Qalam (68:1) for clarity of mind and speech',
    avoid: 'Avoid falsehood and idle talk',
    zikr: 'Ya Alim × 100 daily',
    charity: 'Donate books or support education',
  },
  Jupiter: {
    action: 'Recite Surah Al-Fath (48:1) after Fajr',
    avoid: 'Avoid disrespecting scholars and elders',
    zikr: 'Ya Fattah × 70 daily',
    charity: 'Give sadaqah to a student or one seeking knowledge',
  },
  Venus: {
    action: 'Recite Surah Al-Room (30:21) on Friday after Jumuah',
    avoid: 'Avoid excess and heedlessness on Fridays',
    zikr: 'Ya Wadud × 100 daily',
    charity: 'Offer food or gifts to the needy on Friday',
  },
  Saturn: {
    action: 'Recite Surah Al-Inshirah (94) with patience each morning',
    avoid: 'Avoid complaining and ingratitude',
    zikr: 'Ya Sabur × 100 daily',
    charity: 'Give sadaqah to the elderly or those in hardship',
  },
  Rahu: {
    action: 'Recite Surah Al-Ikhlas (112) forty times after Isha',
    avoid: 'Avoid confusion, deception, and impulsive decisions',
    zikr: 'Ya Ahad × 100 daily',
    charity: 'Give sadaqah in secret to purify intention',
  },
  Ketu: {
    action: 'Recite Surah Al-Kafirun (109) each morning for clarity of purpose',
    avoid: 'Avoid doubt and spiritual neglect',
    zikr: 'Ya Hadi × 100 daily',
    charity: 'Give sadaqah to a traveller or wayfarer',
  },
};

function buildRemedy(moonSubLord: Planet, reasoning: ReasoningStep[]): VerdictRemedy | undefined {
  const r = REMEDY_TABLE[moonSubLord];
  if (r === undefined) {
    return undefined;
  }
  reasoning.push(
    step(
      0,
      `Remedy planet = Moon's Sub-Lord ${moonSubLord} (PROVISIONAL — owner cultural text pending)`,
      0,
    ),
  );
  return { planet: moonSubLord, ...r };
}

// ── Narration ─────────────────────────────────────────────────────────────────

function buildNarration(
  verdict: VerdictKind,
  qType: string,
  moonSubLord: Planet,
  moonSubLordHouse: HouseIndex,
  score: number,
): VerdictNarration {
  const en = buildEn(verdict, qType, moonSubLord, moonSubLordHouse, score);
  const ur = buildUr(verdict, qType);
  const hi = buildHi(verdict, qType);
  return { en, ur, hi };
}

const ARABIC_PLANET: Readonly<Record<string, string>> = {
  Sun: 'Shams',
  Moon: 'al-Qamar',
  Mars: 'al-Mirrikh',
  Mercury: 'Utarid',
  Jupiter: 'Mushtari',
  Venus: 'Zuhra',
  Saturn: 'Zuhal',
  Rahu: "al-Ra's",
  Ketu: 'al-Dhanab',
};

function toArabic(planet: string): string {
  return ARABIC_PLANET[planet] ?? planet;
}

function buildEn(
  verdict: VerdictKind,
  qType: string,
  moonSubLord: Planet,
  _moonSubLordHouse: HouseIndex,
  _score: number,
): string {
  const witness = toArabic(moonSubLord);
  switch (verdict) {
    case 'YES':
      return `The celestial decree for your ${qType} matter is favorable. ${witness} stands as a confirming witness — the gate of the matter opens. The testimony of the heavens is clear.`;
    case 'NO':
      return `The celestial testimony does not favor your ${qType} matter at this hour. ${witness} stands in a position of denial. The oracle counsels patience and redirection.`;
    case 'CONDITIONAL':
      return `Your ${qType} matter carries a conditional opening. ${witness} witnesses the matter with mixed testimony — the path exists but requires alignment of conditions before it fully opens.`;
    case 'DELAYED':
      return `Your ${qType} matter will be granted but the timing is deferred. ${witness} carries the promise forward, though the arrival requires patience.`;
    case 'UNCLEAR':
      return `The celestial witnesses for your ${qType} matter have not reached agreement at this hour. Return when al-Qamar has moved through her current station.`;
    case 'DENIED':
      return `The zaaiche cannot address your ${qType} question at this moment — the celestial witness holds no connection to the houses of fulfillment. Ask again when the hour has ripened.`;
  }
}

function buildUr(verdict: VerdictKind, qType: string): string {
  switch (verdict) {
    case 'YES':
      return `آپ کے ${qType} کے معاملے میں آسمانی گواہی موافق ہے۔ فلکی شہادت کامیابی کی طرف اشارہ کر رہی ہے۔`;
    case 'NO':
      return `آپ کے ${qType} کے معاملے میں اس وقت آسمانی گواہی ساز گار نہیں ہے۔ صبر اور توجہ کی رہنمائی ہے۔`;
    case 'CONDITIONAL':
      return `آپ کے ${qType} کے معاملے میں مشروط روشنی ہے۔ راستہ موجود ہے لیکن کچھ شرائط پوری ہونا ضروری ہیں۔`;
    case 'DELAYED':
      return `آپ کے ${qType} کے معاملے میں تاخیر ہے، لیکن فلکی شہادت بالآخر موافق ہے۔`;
    case 'UNCLEAR':
      return `اس وقت فلکی گواہی واضح نہیں ہے۔ قمر کے اگلے منزل میں دوبارہ سوال کریں۔`;
    case 'DENIED':
      return `اس وقت زائچہ آپ کے ${qType} کے سوال کا جواب دینے سے قاصر ہے۔ فلکی شاہد کا تعلق بابِ تکمیل سے نہیں ہے۔ کسی مناسب وقت پر دوبارہ رجوع کریں۔`;
  }
}

function buildHi(verdict: VerdictKind, qType: string): string {
  switch (verdict) {
    case 'YES':
      return `آپ کے ${qType} کے معاملے میں آسمانی گواہی موافق ہے۔ کامیابی کے آثار روشن ہیں۔`;
    case 'NO':
      return `آپ کے ${qType} کے معاملے میں اس وقت آسمانی شہادت سازگار نہیں ہے۔`;
    case 'CONDITIONAL':
      return `آپ کے ${qType} کے معاملے میں مشروط رہنمائی ہے۔ کچھ شرائط درکار ہیں۔`;
    case 'DELAYED':
      return `آپ کے ${qType} کے معاملے میں تاخیر ممکن ہے، لیکن نتیجہ موافق ہوگا۔`;
    case 'UNCLEAR':
      return `اس وقت آسمانی گواہی واضح نہیں ہے۔ کسی اور وقت سوال کریں۔`;
    case 'DENIED':
      return `اس وقت زائچہ آپ کے ${qType} کے سوال کا جواب دینے کی صلاحیت نہیں رکھتا۔ مناسب وقت پر دوبارہ رجوع فرمائیں۔`;
  }
}

// ── PrimaryCuspDetail ─────────────────────────────────────────────────────────

function buildQuestionCuspDetail(primaryHouseIdx: HouseIndex, chart: Chart): QuestionCuspDetail {
  const cusp = chart.cusps[primaryHouseIdx - 1];
  if (cusp === undefined) {
    throw new RangeError(`[judgeHorary] cusp[${primaryHouseIdx - 1}] undefined`);
  }
  return {
    house: cusp.house,
    sign: cusp.sign,
    degreeInSign: cusp.degreeInSign,
    nakshatra: cusp.nakshatra,
    nakshatraLord: cusp.nakshatraLord,
    subLord: cusp.subLord,
    subSubLord: cusp.subSubLord,
    pada: 1,
  };
}

// ── MoonSubLordSnapshot ───────────────────────────────────────────────────────

function buildMoonSubLordSnapshot(
  moonSubLord: Planet,
  moonSubLordHouse: HouseIndex,
  favHits: readonly HouseIndex[],
  denHits: readonly HouseIndex[],
  chart: Chart,
): MoonSubLordSnapshot {
  const planetData = chart.planets[moonSubLord];
  return {
    planet: moonSubLord,
    nakshatraLord: planetData.nakshatraLord as Planet,
    subLord: planetData.subLord as Planet,
    subSubLord: planetData.subSubLord as Planet, // Precision Layer
    occupiedHouse: moonSubLordHouse,
    signifiedHouses: [moonSubLordHouse],
    favHits,
    denHits,
  };
}

// ── RulingPlanetsSnapshot ────────────────────────────────────────────────────

function buildRpSnapshot(chart: Chart, rpScore: number): RulingPlanetsSnapshot {
  const rps = chart.rulingPlanets;
  return {
    dayLord: rps[0] as Planet,
    horaLord: rps[1] as Planet,
    ascSignLord: rps[2] as Planet,
    ascStarLord: rps[3] as Planet,
    moonSignLord: rps[4] as Planet,
    moonStarLord: rps[5] as Planet,
    agreementScore: rpScore,
  };
}

function applyKotamrajuFilter(
  significators: Planet[],
  favorable: readonly number[],
  denial: readonly number[],
  chart: Chart,
): Planet[] {
  void favorable;
  return significators.filter(planet => {
    const planetData = chart.planets[planet];
    if (planetData === undefined) {
      return false;
    }
    // Read sub-lord from pre-computed chart data (not re-derived from ephemeris)
    const subLord = planetData.subLord as Planet;
    const subLordHouse = houseOfPlanet(subLord, chart);
    return !denial.includes(subLordHouse);
  });
}

// ── Promise check (KP Layer 1) ────────────────────────────────────────────────

/**
 * KP promise check: the sub-lord of the PRIMARY cusp must NOT occupy a denial
 * house. If it does, the chart itself cannot deliver an answer regardless of
 * planetary positions — return DENIED before any scoring.
 */
function checkPromise(
  chart: Chart,
  denial: readonly number[],
  primary: number,
):
  | { denied: false }
  | { denied: true; cuspHouse: number; cuspSubLord: Planet; cuspSubLordHouse: HouseIndex } {
  const primaryCusp = chart.cusps[primary - 1];
  if (primaryCusp === undefined) {
    return { denied: false };
  }

  const cuspSubLord = primaryCusp.subLord as Planet;
  const cuspSubLordHouse = houseOfPlanet(cuspSubLord, chart);

  if ((denial as number[]).includes(cuspSubLordHouse)) {
    return { denied: true, cuspHouse: primary, cuspSubLord, cuspSubLordHouse };
  }
  return { denied: false };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Judge a KP/RKP horary chart.
 *
 * @param chart     Fully populated Chart from Phase 2 buildChart()
 * @param question  Pre-classified question
 * @returns         Complete Verdict ready to persist and render
 */
export function judgeHorary(chart: Chart, question: ClassifiedQuestion): Verdict {
  const reasoning: ReasoningStep[] = [];
  let score = 0;

  // ── STEP 1: Moon's Sub-Lord ───────────────────────────────────────────────
  const moonPos = chart.planets.Moon;
  const moonSubLord = moonPos.subLord;

  reasoning.push(
    step(
      1,
      `Moon at ${moonPos.siderealLongitude.toFixed(2)}° sidereal` +
        ` (manzil lord: ${moonPos.nakshatraLord}, sub-lord: ${moonSubLord})`,
    ),
  );

  // ── STEP 2: House matrix for question type ────────────────────────────────
  const qType = question.qType; // Renamed from STEP 2 to STEP 0
  const matrix = HOUSE_MATRIX[qType];
  const { favorable, denial, primary } = matrix;

  // ── PROMISE CHECK — fires before Kotamraju, before any scoring ───────────
  const promise = checkPromise(chart, denial, primary as number);
  if (promise.denied) {
    const deniedReasoning: ReasoningStep[] = [
      step(
        0,
        `Question: '${qType}' | favorable=[${favorable.join(',')}] denial=[${denial.join(',')}]`,
      ),
      step(
        1,
        `Promise FAILED: cusp ${promise.cuspHouse} sub-lord = ${promise.cuspSubLord}` +
          ` occupies house ${promise.cuspSubLordHouse} ∈ denial [${denial.join(',')}] → DENIED`,
        -3,
      ),
    ];
    const deniedNarration = buildNarration(
      'DENIED',
      qType,
      promise.cuspSubLord,
      promise.cuspSubLordHouse,
      0,
    );
    const moonSubLordForDenied = moonPos.subLord as Planet;
    const moonSubLordHouseForDenied = houseOfPlanet(moonSubLordForDenied, chart);
    return Object.freeze({
      id: deterministicId(chart, question),
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
      rulingPlanets: buildRpSnapshot(chart, 0),
      verdict: 'DENIED' as VerdictKind,
      confidence: 0,
      stage: 'promise_failed' as const,
      reasoning: Object.freeze(deniedReasoning),
      narration: deniedNarration,
      retrogradeFlags: Object.freeze([] as Planet[]),
      combustFlags: Object.freeze([] as Planet[]),
      engineVersion: ENGINE_VERSION,
    } satisfies Verdict);
  }

  reasoning.push(
    step(
      2,
      `Question: '${qType}' | favorable houses=[${favorable.join(',')}] denial=[${denial.join(',')}]`,
    ),
  );

  // ── Phase B: KP significator sets ────────────────────────────────────────
  const significators = computeSignificatorSets(chart, favorable, denial);

  // ── STEP 3: Moon's Sub-Lord house placement — primary signal ──────────────
  const moonSubLordHouse = houseOfPlanet(moonSubLord, chart);
  let primarySignal = 'neutral';

  if ((favorable as number[]).includes(moonSubLordHouse)) {
    score += 2;
    primarySignal = `favorable (house ${moonSubLordHouse} ∈ [${favorable.join(',')}]) → +2`;
  } else if ((denial as number[]).includes(moonSubLordHouse)) {
    score -= 2;
    primarySignal = `denial (house ${moonSubLordHouse} ∈ [${denial.join(',')}]) → −2`;
  } else {
    primarySignal = `neutral (house ${moonSubLordHouse}) → 0`;
  }

  reasoning.push(
    step(
      3,
      `Moon's Sub-Lord ${moonSubLord} occupies house ${moonSubLordHouse} → ${primarySignal}`,
      score,
    ),
  );

  // ── STEP 4: Ruling Planets × Significator intersection (Phase D) ─────────
  // chart.rulingPlanets = [dayLord, horaLord, ascSignLord, ascStarLord, moonSignLord, moonStarLord]
  // horaLord is at index 1 — excluded from the 5-RP scoring set per RKP 5-RP rule
  const horaLord = chart.rulingPlanets[1] as Planet | undefined;
  const fiveRP = (chart.rulingPlanets as Planet[]).filter((_, i) => i !== 1).filter(Boolean);

  const filteredFiveRP = applyKotamrajuFilter(fiveRP, favorable, denial, chart);
  const filteredRPSet = new Set<Planet>(filteredFiveRP);

  for (const rp of fiveRP) {
    if (!filteredRPSet.has(rp)) {
      reasoning.push(step(4, `${rp} removed by Kotamraju filter (sub-lord in denial)`, 0));
    }
  }

  const confirmedSignificators = significators.favorable.filter(p => filteredRPSet.has(p));
  const deniedSignificators = significators.denial.filter(p => filteredRPSet.has(p));

  let rpScore = 0;
  for (const p of confirmedSignificators) {
    score += 1;
    rpScore += 1;
    reasoning.push(step(4, `${p}: Favorable Significator ∩ Ruling Planet witness → (+1)`, 1));
  }
  for (const p of deniedSignificators) {
    score -= 1;
    rpScore -= 1;
    reasoning.push(step(4, `${p}: Denial Significator ∩ Ruling Planet witness → (−1)`, -1));
  }

  for (const rp of filteredFiveRP) {
    if (!confirmedSignificators.includes(rp) && !deniedSignificators.includes(rp)) {
      reasoning.push(step(4, `${rp}: ruling planet but not a question significator → 0`, 0));
    }
  }

  // horaLord as extended witness — logged separately, does not affect score
  if (horaLord) {
    const horaFav = significators.favorable.includes(horaLord);
    const horaDen = significators.denial.includes(horaLord);
    const horaLabel = horaFav ? 'favorable extended witness' : horaDen ? 'denial extended witness' : 'neutral extended witness';
    reasoning.push(step(4, `${horaLord} (Hora Lord): ${horaLabel} — not scored`, 0));
  }

  // ── STEP 5: Verdict from total score ─────────────────────────────────────
  let verdict: VerdictKind;
  if (score >= 3) {
    verdict = 'YES';
  } else if (score <= -2) {
    verdict = 'NO';
  } else {
    verdict = 'CONDITIONAL';
  }

  // DELAYED modifier fires on YES or CONDITIONAL when key planets are retrograde
  if (verdict === 'YES' || verdict === 'CONDITIONAL') {
    const mslRetro = chart.planets[moonSubLord].isRetrograde;
    const jupRetro = chart.planets.Jupiter.isRetrograde;
    const venRetro = chart.planets.Venus.isRetrograde;
    if (mslRetro || jupRetro || venRetro) {
      verdict = 'DELAYED';
      const who = [mslRetro && `${moonSubLord}(MSL)`, jupRetro && 'Jupiter', venRetro && 'Venus']
        .filter(Boolean)
        .join(', ');
      reasoning.push(step(5, `${verdict} → DELAYED: retrograde planet(s): ${who}`, 0));
    }
  }

  reasoning.push(
    step(
      5,
      `Total score = ${score} → verdict = ${verdict}` + ` (≥3=YES, ≤−2=NO, else CONDITIONAL)`,
      score,
    ),
  );

  // ── Confidence ────────────────────────────────────────────────────────────
  // MSL Placement (2) + 5 Ruling Planet Witnesses (5) = 7
  const maxScore = 7;
  const confidence = Math.round(
    Math.min(100, Math.max(10, ((score + maxScore) / (2 * maxScore)) * 100)),
  );

  // ── Timing ────────────────────────────────────────────────────────────────
  const timing = computeConvergenceTiming(chart, confirmedSignificators as Planet[]);
  reasoning.push(
    step(
      5,
      `Timing: RP intersection (${timing.rpMatchCount ?? 0}/5 match) → ${timing.window} (${timing.range.min}–${timing.range.max})`,
    ),
  );

  // ── Retrograde / combust flags ────────────────────────────────────────────
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

  // ── Assemble sub-objects ──────────────────────────────────────────────────
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
  const rpSnapshot = buildRpSnapshot(chart, rpScore);
  const questionCuspDetail = buildQuestionCuspDetail(primary as HouseIndex, chart);
  const remedy = buildRemedy(moonSubLord, reasoning);
  const narration = buildNarration(verdict, qType, moonSubLord, moonSubLordHouse, score);

  // ── Final Verdict ─────────────────────────────────────────────────────────
  return Object.freeze({
    id: deterministicId(chart, question),
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
    remedy,
    narration,
    retrogradeFlags: Object.freeze(retrogradeFlags),
    combustFlags: Object.freeze(combustFlags),
    engineVersion: ENGINE_VERSION,
  } satisfies Verdict);
}
