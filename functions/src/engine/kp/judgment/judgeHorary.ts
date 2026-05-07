import type { Chart, PlanetName } from '../../types/chart';
import type { ClassifiedQuestion } from '../../types/question';
import type { Verdict, VerdictKind, ReasoningStep } from '../../types/verdict';
import { HOUSE_MATRIX, REMEDY_DATA } from '../rules/houseMatrix';
import { DASHA_YEARS } from '../rules/vimshottari';
import { hashText } from '../../../utils/logger';
import { getSignifiedHouses } from './significations';
import { ChartSchema, ClassifiedQuestionSchema, VerdictSchema } from './schemas';
import { calculateDasha } from '../primitives/dasha';
import { getSubLords } from '../primitives/subLord';

function applyKotamrajuFilter(
  significators: PlanetName[],
  favorable: readonly number[],
  denial: readonly number[],
  chart: Chart
): PlanetName[] {
  void favorable;
  return significators.filter(planet => {
    const planetData = chart.planets[planet];
    if (!planetData) return false;
    const subLord = getSubLords(planetData.longitude).subLord;
    const subLordHouses = getSignifiedHouses(subLord as any, chart);
    return !subLordHouses.some(h => denial.includes(h));
  });
}

/**
 * judgeHorary — Main RKP Judgment Engine
 */
export function judgeHorary(chart: Chart, question: ClassifiedQuestion): Verdict {
  // Step 0: Validate high-fidelity inputs
  ChartSchema.parse(chart);
  ClassifiedQuestionSchema.parse(question);

  const reasoning: ReasoningStep[] = [];
  let score = 0;

  // Step 1: Moon's Sub-Lord
  const moonSL = chart.planets.Moon.subLord as PlanetName;
  reasoning.push({ ruleId: 'STEP_1', weight: 0, description: `Moon Sub-Lord is ${moonSL}` });

  // Step 2: House Matrix
  const matrix = HOUSE_MATRIX[question.qType] || HOUSE_MATRIX.general;
  
  // Step 3: Moon SL House
  const kotamrajuMoon = applyKotamrajuFilter(
    [moonSL],
    matrix.favorable,
    matrix.denial,
    chart
  );
  if (kotamrajuMoon.length === 0) {
    score -= 2;
    reasoning.push({
      ruleId: 'STEP_3_KOT',
      weight: -2,
      description: `Kotamraju filter rejected Moon SL ${moonSL} due to denial-house sub-lord linkage`,
    });
  }

  const moonSignifications = getSignifiedHouses(moonSL as any, chart);
  const favorableHits = moonSignifications.filter(h => matrix.favorable.includes(h));
  const denialHits = moonSignifications.filter(h => matrix.denial.includes(h));

  if (favorableHits.includes(matrix.primary)) {
    score += 3;
    reasoning.push({ ruleId: 'STEP_3_PRI', weight: 3, description: `Moon SL signifies Primary house ${matrix.primary}` });
  } else if (favorableHits.length > 0) {
    score += 2;
    reasoning.push({ ruleId: 'STEP_3_SEC', weight: 2, description: `Moon SL signifies Favorable houses: ${favorableHits.join(', ')}` });
  } else if (denialHits.length > 0) {
    score -= 2;
    reasoning.push({ ruleId: 'STEP_3_DEN', weight: -2, description: `Moon SL signifies Denial houses: ${denialHits.join(', ')}` });
  } else {
    reasoning.push({ ruleId: 'STEP_3', weight: 0, description: `Moon SL significations are neutral for ${question.qType}` });
  }

  // Step 4: Ruling Planets (3 RP)
  const filteredRulingPlanets = applyKotamrajuFilter(
    chart.rulingPlanets as PlanetName[],
    matrix.favorable,
    matrix.denial,
    chart
  );
  chart.rulingPlanets.forEach(rp => {
    if (!filteredRulingPlanets.includes(rp as PlanetName)) {
      reasoning.push({
        ruleId: 'STEP_4_KOT',
        weight: 0,
        description: `Kotamraju filter removed RP ${rp} (sub-lord linked to denial houses)`,
      });
      return;
    }
    const rpSignifications = getSignifiedHouses(rp as any, chart);
    const rpFavorable = rpSignifications.some(h => matrix.favorable.includes(h));
    const rpDenial = rpSignifications.some(h => matrix.denial.includes(h));

    if (rpFavorable) {
      score += 1;
      reasoning.push({ ruleId: 'STEP_4_POS', weight: 1, description: `Ruling Planet ${rp} supports favorable houses` });
    } else if (rpDenial) {
      score -= 1;
      reasoning.push({ ruleId: 'STEP_4_NEG', weight: -1, description: `Ruling Planet ${rp} supports denial houses` });
    }
  });

  // Step 5: Verdict & Confidence
  let verdictKind: VerdictKind = 'CONDITIONAL';
  if (score >= 3) verdictKind = 'YES';
  else if (score <= -2) verdictKind = 'NO';
  else if (score < 1 && score > -1) verdictKind = 'UNCLEAR';

  // Retrograde Modifier
  const isRetro = chart.planets[moonSL].isRetrograde || chart.planets.Jupiter.isRetrograde || chart.planets.Venus.isRetrograde;
  if (verdictKind === 'YES' && isRetro) {
    verdictKind = 'DELAYED';
    reasoning.push({ ruleId: 'STEP_RETRO', weight: 0, description: 'Retrograde planets detected: Modified to DELAYED' });
  }

  const confidence = Math.min(95, Math.max(20, 50 + (score * 10)));

  // Reading ID (Deterministic)
  const readingId = generateReadingId(chart.momentUtc + question.text);

  // Timing & Real Dasha Calculation
  const momentMs = new Date(chart.momentUtc).getTime();
  const dasha = calculateDasha(chart.planets.Moon.longitude, momentMs);
 
  // Calculate timingValue based on the remaining dasha balance in current Antardasha (AD)
  const msRemaining = dasha.currentAntardasha.end.getTime() - momentMs;
  const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
 
  const timingWindow = daysRemaining > 365 ? 'years' : 
                       daysRemaining > 30 ? 'months' : 
                       daysRemaining > 7 ? 'weeks' : 'days';
 
  const timingValue = timingWindow === 'years' ? Math.ceil(daysRemaining / 365.25) :
                      timingWindow === 'months' ? Math.ceil(daysRemaining / 30.44) :
                      timingWindow === 'weeks' ? Math.ceil(daysRemaining / 7) : daysRemaining;

  const finalVerdict: Verdict = {
    readingId,
    verdict: verdictKind,
    confidence,
    category: question.qType,
    narration: generateNarrations(
      verdictKind,
      question.qType,
      moonSL,
      moonSignifications as number[],
      favorableHits,
      denialHits
    ),
    reasoning,
    timing: {
      window: timingWindow,
      range: { min: timingValue, max: timingValue + 1 },
      activeDasha: dasha.mahadasha,
      activeAntardasha: dasha.antardasha,
      activePratyantardasha: dasha.pratyantardasha,
    },
    remedy: {
      planet: moonSL,
      ...REMEDY_DATA[moonSL],
    },
    computedAt: new Date().toISOString(),
  };

  return VerdictSchema.parse(finalVerdict);
}

/** Helpers */
function getHouseOfPlanet(planet: PlanetName, chart: Chart): number {
  const longitude = chart.planets[planet].longitude;
  const cusps = [...chart.cusps].sort((a, b) => a.number - b.number);
  for (let i = 0; i < 12; i++) {
    const curr = cusps[i].longitude;
    const next = cusps[(i + 1) % 12].longitude;
    if (curr < next) {
      if (longitude >= curr && longitude < next) return cusps[i].number;
    } else if (longitude >= curr || longitude < next) {
      return cusps[i].number;
    }
  }
  return 1;
}

function generateReadingId(seed: string): string {
  const h = hashText(seed);
  const h2 = hashText(seed + "v2");
  const full = (h + h2 + h + h2).padEnd(32, '0');
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-4${full.slice(13, 16)}-a${full.slice(17, 20)}-${full.slice(20, 32)}`;
}

function generateNarrations(
  kind: VerdictKind,
  cat: string,
  planet: PlanetName,
  sigs: number[],
  favs: number[],
  dens: number[]
) {
  const sigStr = sigs.join(', ');
  let detailEn = `Moon's Sub-Lord ${planet} signifies houses ${sigStr}.`;
  let detailUr = `چاند کا ذیلی حاکم ${planet} ان گھروں (${sigStr}) کی نشاندہی کرتا ہے۔`;
  let detailHi = `चंद्रमा का उप-स्वामी ${planet} इन घरों (${sigStr}) का संकेत देता है।`;

  if (favs.length > 0) {
    detailEn += ` It supports favorable houses (${favs.join(', ')}).`;
    detailUr += ` یہ سازگار گھروں (${favs.join(', ')}) کی حمایت کرتا ہے۔`;
    detailHi += ` यह अनुकूल घरों (${favs.join(', ')}) का समर्थन करता है।`;
  }
  if (dens.length > 0) {
    detailEn += ` It indicates denial via houses (${dens.join(', ')}).`;
    detailUr += ` یہ انکار کے گھروں (${dens.join(', ')}) کی نشاندہی کرتا ہے۔`;
    detailHi += ` यह नकारात्मक घरों (${dens.join(', ')}) का संकेत देता है।`;
  }

  return {
    en: `Judgment for ${cat}: The stars indicate a ${kind} outcome. ${detailEn}`,
    ur: `${cat} کے لیے فیصلہ: ستاروں کی چال ایک ${kind} نتیجہ ظاہر کرتی ہے۔ ${detailUr}`,
    hi: `${cat} के लिए निर्णय: सितारों की स्थिति एक ${kind} परिणाम दर्शाती है। ${detailHi}`,
  };
}
