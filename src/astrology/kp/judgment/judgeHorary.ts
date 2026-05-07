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
 *  STEP 3  Check which house Moon's Sub-Lord OCCUPIES.
 *          This is the primary RKP signal:
 *            In favorable house → +2 to score
 *            In denial house    → −2 to score
 *
 *  STEP 4  Verify with 3 Ruling Planets (Day Lord + Hora Lord + Minute Lord).
 *          For each RP, check which house it occupies:
 *            Favorable house → +1
 *            Denial house    → −1
 *
 *  STEP 5  Total score → verdict:
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

import type { Chart, Planet, HouseIndex } from '@astrology/types/chart';
import type { ClassifiedQuestion } from '@astrology/types/question';
import type {
  Verdict,
  VerdictKind,
  MoonSubLordSnapshot,
  QuestionCuspDetail,
  RulingPlanetsSnapshot,
  VerdictTiming,
  VerdictRemedy,
  VerdictNarration,
  ReasoningStep,
  TimingWindow,
} from '@astrology/types/verdict';
import { HOUSE_MATRIX } from '@astrology/kp/rules/houseMatrix';
import { DASHA_YEARS } from '@astrology/kp/rules/vimshottari';
import { calculateDasha } from '@astrology/primitives/dasha';
import { getSubLords } from '@astrology/primitives/subLord';
import { houseOfPlanet } from './significations';
import { ENGINE_VERSION } from '@astrology/primitives/chartBuilder';

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

/**
 * Convert raw days-remaining to a TimingWindow and a range.
 */
function daysToWindow(daysRemaining: number): {
  window: TimingWindow;
  range: { min: number; max: number };
} {
  if (daysRemaining < 30) {
    const d = Math.max(1, Math.ceil(daysRemaining));
    return { window: 'days', range: { min: 1, max: d } };
  }
  if (daysRemaining < 90) {
    const w = Math.max(1, Math.ceil(daysRemaining / 7));
    return { window: 'weeks', range: { min: 1, max: w } };
  }
  if (daysRemaining < 730) {
    const m = Math.max(1, Math.ceil(daysRemaining / 30.44));
    return { window: 'months', range: { min: 1, max: m } };
  }
  const y = Math.max(1, Math.ceil(daysRemaining / 365.25));
  return { window: 'years', range: { min: 1, max: y } };
}

/**
 * RKP timing formula (from RKP_RULES_FROM_SARFARAZ.md):
 *   Timing planet = nakshatra lord of Moon's Sub-Lord
 *   Months = DASHA_YEARS[timingPlanet] × 12 × (positiveScore / maxScore)
 *
 * We convert the computed months to the natural window unit (days/weeks/months/years).
 */
function buildTiming(
  chart: Chart,
  moonSubLord: Planet,
  positiveScore: number,
  maxScore: number,
  reasoning: ReasoningStep[],
): VerdictTiming {
  // Timing planet = nakshatra lord of Moon's Sub-Lord
  const timingPlanet = chart.planets[moonSubLord].nakshatraLord as Planet;
  const dashaYears = DASHA_YEARS[timingPlanet] ?? 7;
  const ratio = maxScore > 0 ? Math.max(0, Math.min(1, positiveScore / maxScore)) : 0;
  const timingMonths = dashaYears * 12 * ratio;
  const timingDays = timingMonths * 30.44;

  const { window, range } = daysToWindow(timingDays);

  // Also get active dasha periods for the trace
  const momentMs = new Date(chart.momentUtc).getTime();
  const moonLon = chart.planets.Moon.siderealLongitude;
  const dasha = calculateDasha(moonLon, momentMs);

  const md = dasha.mahadasha.lord as Planet;
  const ad = dasha.currentAntardasha.lord as Planet;
  const pd = dasha.currentPratyantar.lord as Planet;

  reasoning.push(
    step(
      5,
      `Timing planet = ${timingPlanet} (nakshatra lord of Moon's Sub-Lord ${moonSubLord})` +
        ` → ${dashaYears}y × 12 × ${ratio.toFixed(2)} = ${timingMonths.toFixed(1)} months → ${window} (${range.max})` +
        ` | Active dasha: MD=${md} AD=${ad} PD=${pd}`,
      0,
    ),
  );

  return {
    window,
    range,
    activeDasha: md,
    activeAntardasha: ad,
    activePratyantardasha: pd,
    transitTriggers: [],
  };
}

// ── Remedy ────────────────────────────────────────────────────────────────────

const REMEDY_TABLE: Readonly<
  Record<Planet, { action: string; avoid: string; mantra?: string; charity?: string }>
> = {
  Sun: {
    action: 'Offer water to the rising Sun for 7 days',
    avoid: 'Avoid conflicts on Sunday',
    mantra: 'Om Hraam Hreem Hraum Sah Suryaya Namah',
    charity: 'Donate wheat or copper on Sunday',
  },
  Moon: {
    action: 'Offer milk to Shiva on Monday',
    avoid: 'Avoid starting new ventures on Monday night',
    mantra: 'Om Shraam Shreem Shraum Sah Chandraya Namah',
    charity: 'Donate rice or white cloth on Monday',
  },
  Mars: {
    action: 'Light a red lamp on Tuesday',
    avoid: 'Avoid anger on Tuesday',
    mantra: 'Om Kraam Kreem Kraum Sah Bhaumaya Namah',
    charity: 'Donate red lentils on Tuesday',
  },
  Mercury: {
    action: 'Feed green fodder to cows on Wednesday',
    avoid: 'Avoid dishonesty in communication',
    mantra: 'Om Braam Breem Braum Sah Budhaya Namah',
    charity: 'Donate green vegetables on Wednesday',
  },
  Jupiter: {
    action: 'Offer turmeric to Lord Vishnu on Thursday',
    avoid: 'Avoid disrespecting elders and teachers',
    mantra: 'Om Graam Greem Graum Sah Guruve Namah',
    charity: 'Donate yellow items on Thursday',
  },
  Venus: {
    action: 'Offer white flowers to the deity on Friday',
    avoid: 'Avoid excess on Fridays',
    mantra: 'Om Draam Dreem Draum Sah Shukraya Namah',
    charity: 'Donate white sweets on Friday',
  },
  Saturn: {
    action: 'Light a sesame oil lamp on Saturday',
    avoid: 'Avoid cutting trees or harming elderly',
    mantra: 'Om Praam Preem Praum Sah Shanaischaraya Namah',
    charity: 'Donate black sesame on Saturday',
  },
  Rahu: {
    action: 'Offer blue flowers to Durga on Saturday',
    avoid: 'Avoid impulsive decisions and travel at night',
    mantra: 'Om Bhraam Bhreem Bhraum Sah Rahave Namah',
    charity: 'Donate coal or blue cloth on Saturday',
  },
  Ketu: {
    action: 'Offer flowers at a Ganesh temple on Tuesday',
    avoid: 'Avoid starting long journeys on Tuesday',
    mantra: 'Om Sraam Sreem Sraum Sah Ketave Namah',
    charity: 'Donate mixed grain on Tuesday',
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

function buildEn(
  verdict: VerdictKind,
  qType: string,
  moonSubLord: Planet,
  moonSubLordHouse: HouseIndex,
  score: number,
): string {
  switch (verdict) {
    case 'YES':
      return `The heavens are favorable for your ${qType} matter. Moon's Sub-Lord ${moonSubLord} occupies house ${moonSubLordHouse} — a favorable house. Score: +${score}. The stars indicate success.`;
    case 'NO':
      return `The planetary testimony does not support your ${qType} matter at this time. Moon's Sub-Lord ${moonSubLord} occupies house ${moonSubLordHouse} — a denial house. Score: ${score}.`;
    case 'CONDITIONAL':
      return `Your ${qType} matter shows mixed signals. Moon's Sub-Lord ${moonSubLord} occupies house ${moonSubLordHouse}. Score: ${score}. Success depends on addressing the planetary conditions.`;
    case 'DELAYED':
      return `Your ${qType} matter will be fulfilled but with delay. Moon's Sub-Lord ${moonSubLord} is retrograde or afflicted. The result is positive but postponed.`;
    case 'UNCLEAR':
      return `The planetary testimony for your ${qType} matter is unclear at this moment. Please rephrase your question or ask at a different time.`;
  }
}

function buildUr(verdict: VerdictKind, qType: string): string {
  switch (verdict) {
    case 'YES':
      return `آپ کے ${qType} کے معاملے میں ستاروں کی گواہی موافق ہے۔ کامیابی کے آثار نظر آ رہے ہیں۔`;
    case 'NO':
      return `آپ کے ${qType} کے معاملے میں ابھی سیاروں کی حمایت حاصل نہیں ہے۔`;
    case 'CONDITIONAL':
      return `آپ کے ${qType} کے معاملے کا نتیجہ مشروط ہے۔ اقدامات کی ضرورت ہے۔`;
    case 'DELAYED':
      return `آپ کے ${qType} کے معاملے میں تاخیر ہو سکتی ہے لیکن نتیجہ موافق ہوگا۔`;
    case 'UNCLEAR':
      return `ابھی سیاروں کی گواہی واضح نہیں ہے۔ سوال دوبارہ پوچھیں۔`;
  }
}

function buildHi(verdict: VerdictKind, qType: string): string {
  switch (verdict) {
    case 'YES':
      return `आपके ${qType} विषय में ग्रहों की गवाही अनुकूल है। सफलता के संकेत हैं।`;
    case 'NO':
      return `आपके ${qType} विषय में अभी ग्रहों की अनुकूलता नहीं है।`;
    case 'CONDITIONAL':
      return `आपके ${qType} विषय का परिणाम सशर्त है। उपाय आवश्यक हैं।`;
    case 'DELAYED':
      return `आपके ${qType} विषय में विलंब संभव है, परंतु परिणाम अनुकूल होगा।`;
    case 'UNCLEAR':
      return `अभी ग्रहों की गवाही स्पष्ट नहीं है। कृपया प्रश्न पुनः पूछें।`;
  }
}

// ── PrimaryCuspDetail (for the Moon's Sub-Lord cusp context) ─────────────────

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

// ── SignificatorChain (Moon's Sub-Lord chain) ────────────────────────────────

function buildMoonSubLordSnapshot(
  moonSubLord: Planet,
  moonSubLordHouse: HouseIndex,
  favHits: readonly HouseIndex[],
  denHits: readonly HouseIndex[],
  chart: Chart,
): MoonSubLordSnapshot {
  const nakshatraLord = chart.planets[moonSubLord].nakshatraLord as Planet;
  return {
    planet: moonSubLord,
    nakshatraLord,
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
    ascSignLord: rps[1] as Planet,
    ascStarLord: rps[2] as Planet,
    moonSignLord: rps[3] as Planet,
    moonStarLord: rps[4] as Planet,
    horaLord: chart.horaLord,
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
    const subLord = getSubLords(planetData.siderealLongitude).subLord as Planet;
    const subLordHouse = houseOfPlanet(subLord, chart);
    return !denial.includes(subLordHouse);
  });
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
        ` (nakshatra lord: ${moonPos.nakshatraLord}, sub-lord: ${moonSubLord})`,
    ),
  );

  // ── STEP 2: House matrix for question type ────────────────────────────────
  const qType = question.qType;
  const matrix = HOUSE_MATRIX[qType];
  const { favorable, denial, primary } = matrix;
  const kotamrajuMoon = applyKotamrajuFilter([moonSubLord], favorable, denial, chart);
  if (kotamrajuMoon.length === 0) {
    score -= 2;
    reasoning.push(
      step(
        3,
        `Kotamraju filter rejected Moon's Sub-Lord ${moonSubLord} (sub-lord linked to denial houses) -> -2`,
        -2,
      ),
    );
  }

  reasoning.push(
    step(
      2,
      `Question: '${qType}' | favorable houses=[${favorable.join(',')}] denial=[${denial.join(',')}]`,
    ),
  );

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

  // ── STEP 4: Ruling Planets verification ───────────────────────────────────
  const rpNames = ['Day Lord', 'Hora Lord', 'Minute Lord'];
  let rpScore = 0;
  const filteredRulingPlanets = applyKotamrajuFilter(
    chart.rulingPlanets as Planet[],
    favorable,
    denial,
    chart,
  );

  for (let i = 0; i < chart.rulingPlanets.length; i++) {
    const rp = chart.rulingPlanets[i] as Planet;
    if (!filteredRulingPlanets.includes(rp)) {
      reasoning.push(step(4, `${rpNames[i] ?? `RP${i}`} = ${rp} removed by Kotamraju filter`, 0));
      continue;
    }
    const rpHouse = houseOfPlanet(rp, chart);
    const rpName = rpNames[i] ?? `RP${i}`;
    let contribution = 0;
    let signal = 'neutral';

    if ((favorable as number[]).includes(rpHouse)) {
      contribution = 1;
      signal = `favorable (house ${rpHouse}) → +1`;
    } else if ((denial as number[]).includes(rpHouse)) {
      contribution = -1;
      signal = `denial (house ${rpHouse}) → −1`;
    } else {
      signal = `neutral (house ${rpHouse}) → 0`;
    }

    score += contribution;
    rpScore += contribution;
    reasoning.push(
      step(4, `${rpName} = ${rp} occupies house ${rpHouse} → ${signal}`, contribution),
    );
  }

  // ── STEP 5: Verdict from total score ────────────────────────────────────
  let verdict: VerdictKind;
  if (score >= 3) {
    verdict = 'YES';
  } else if (score <= -2) {
    verdict = 'NO';
  } else {
    verdict = 'CONDITIONAL';
  }

  // DELAYED modifier: YES but Moon's Sub-Lord, Jupiter, or Venus is retrograde
  if (verdict === 'YES') {
    const mslRetro = chart.planets[moonSubLord].isRetrograde;
    const jupRetro = chart.planets.Jupiter.isRetrograde;
    const venRetro = chart.planets.Venus.isRetrograde;
    if (mslRetro || jupRetro || venRetro) {
      verdict = 'DELAYED';
      const who = [mslRetro && `${moonSubLord}(MSL)`, jupRetro && 'Jupiter', venRetro && 'Venus']
        .filter(Boolean)
        .join(', ');
      reasoning.push(step(5, `YES → DELAYED: retrograde planet(s): ${who}`, 0));
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
  // Max possible score = +5 (Moon's Sub-Lord +2, 3 RPs +1 each)
  const maxScore = 5;
  const confidence = Math.round(
    Math.min(100, Math.max(10, ((score + maxScore) / (2 * maxScore)) * 100)),
  );

  // ── Timing ────────────────────────────────────────────────────────────────
  const positiveScore = Math.max(0, score);
  const timing = buildTiming(chart, moonSubLord, positiveScore, maxScore, reasoning);

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
    reasoning: Object.freeze(reasoning),
    timing,
    remedy,
    narration,
    retrogradeFlags: Object.freeze(retrogradeFlags),
    combustFlags: Object.freeze(combustFlags),
    engineVersion: ENGINE_VERSION,
  } satisfies Verdict);
}
