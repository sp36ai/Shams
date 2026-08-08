/**
 * judgeRKPWatch — the clock-based "RKP Watch of Currents" judgment engine.
 * --------------------------------------------------------------------------
 * This is RKP as specified in the user-supplied elaboration: a time-activated
 * horary system with NO birth chart and NO Placidus cusps for house
 * determination. The exact local minute of the question selects a whole-sign
 * house wheel (see primitives/watchChart.ts); everything downstream —
 * house-lord analysis, Moon confirmation, ruling-planet confirmation,
 * timing — runs on top of that wheel using the same real ephemeris already
 * built for the other two engines (judgeHorary.ts, judgeKP.ts).
 *
 * THE ALGORITHM:
 *
 *  1. WATCH CHART — localMinuteOfHour() + computeWatchChart() build the
 *     12-house whole-sign wheel. Real transiting planets are placed into it
 *     by sign only (clockHouseOfPlanet()).
 *
 *  2. ACTIVATED HOUSE — the question's PRIMARY house (from the existing,
 *     owner-provided HOUSE_MATRIX — the same table judgeHorary/judgeKP use)
 *     is looked up on the watch wheel.
 *
 *  3. HOUSE-LORD ANALYSIS — the activated house's (whole) sign has a
 *     classical lord. That lord's condition is read via the classical
 *     toolkit in classicalToolkit.ts (the RKP material specifies which
 *     factors matter; the numeric weights are a confirmed default):
 *       - dignity: exalted/own sign = support; debilitated = obstruction
 *       - conjunction: benefic/malefic planets sharing the lord's clock-house
 *       - aspect (drishti): 7th-house aspect for all planets, plus Mars'
 *         4th/8th, Jupiter's 5th/9th, Saturn's 3rd/10th
 *       - combustion: weakens (obstruction)
 *       - retrograde: recorded as a modifier (delay), not scored directly
 *     Net tally -> supported / obstructed / mixed.
 *
 *  3b. VERDICT TRIAD — the same analysis is run on all three vital points
 *     the RKP material requires: the 1st house (querent's energy), the
 *     target house (the query), and the 11th house (fulfilment). Adds the
 *     natural friendship/enmity clash between the 1st and target rulers
 *     (planetaryRelations.ts), the Rahu/Ketu/Mars affliction and
 *     Jupiter/Venus rescue tests on the target and 11th houses, and the
 *     odd/even polarity profile of the querent and of whoever controls the
 *     matter. Its four-state outcome (positive/delayed/blocked/mixed) is
 *     the PRIMARY driver of the verdict — see rkpTriad.ts.
 *
 *  4. MOON CONFIRMATION — Moon's REAL sub-lord (full ephemeris precision,
 *     unaffected by the whole-sign wheel) is placed on the clock wheel and
 *     checked against the question's favorable/denial houses. Agreement
 *     reinforces the house-lord verdict; disagreement reduces certainty.
 *
 *  5. RULING-PLANET CONFIRMATION — Day Lord, Ascendant Sign Lord (of the
 *     watch Lagna), Moon Sign Lord, and Moon Star Lord (4 witnesses —
 *     Ascendant STAR Lord is dropped here: the watch Lagna is a whole sign
 *     with no continuous degree, so it has no nakshatra to derive a star
 *     lord from). Each witness's clock-house is checked against favorable/
 *     denial houses.
 *
 *  6. VERDICT — the triad outcome (step 3b) sets the base state; Moon
 *     confirmation and ruling-planet majority then refine it into one of six
 *     native states (YES_STRONG, YES_CONDITIONAL, DELAY, WAIT, NO_DENIED,
 *     INCONCLUSIVE), collapsed onto the shared VerdictKind for interop with
 *     the rest of the app. See combineVerdict().
 *
 *  7. TIMING — reuses computeConvergenceTiming() unchanged: dasha/antardasha/
 *     pratyantardasha convergence is astronomical, not house-model-specific.
 *
 *  8. VASTU SCAN — "the entire 360-degree compass layout of your physical
 *     living space is mapped directly onto the 12 numbers of a standard
 *     clock face" (source material). Each sign maps to a fixed physical
 *     direction by classical element (Fire=East, Earth=South, Air=West,
 *     Water=North — see primitives/watchChart.ts's SIGN_DIRECTIONS for the
 *     note on reconciling the two direction tables supplied). This produces
 *     two structured, non-question-specific facts: which direction the
 *     activated house currently sits in, and which of the 4 directions
 *     currently hold a natural malefic. No remedy wording is generated here
 *     — that stays a presentation-layer concern per the source material's
 *     own separation rule.
 *
 *  9. CONFIDENCE — the source material's 7-factor, 50-point-base model.
 *     5 of the 7 factors are computed (sub-lord clarity, Moon agreement,
 *     ruling-planet overlap, retrograde affliction, timestamp precision);
 *     Multi-Cusp Agreement and Chart Cleanliness/Void-of-Course are part of
 *     the documented model but not yet implemented (strictures, deferred)
 *     — they score 0/neutral rather than being invented. See
 *     computeConfidence().
 *
 *  10. NARRATION / REMEDY — EN/UR/HI narration per native state, and TWO
 *     remedy tracks kept side by side:
 *       - `remedy`: the app's spiritual remedy keyed on the activated
 *         house's lord (remedyTable.ts / arabicNames.ts), as before.
 *       - `materialRemedy`: RKP's own material micro-remedies — clock
 *         acceleration, corner clearance, planetary action window
 *         (rkpRemedy.ts). The RKP material's remedial rules would forbid
 *         the spiritual track; the Shams al-Asrār specification requires
 *         it. Both are emitted as structured facts and the choice is left
 *         to the presentation layer — see rkpRemedy.ts's scope note.
 *
 * Deliberately NOT yet included (explicit scope-out, not an oversight):
 *   - the 8 classical strictures (Via Combusta, Void of Course, etc.)
 *   - third-person question house rotation
 *   - Multi-Cusp Agreement and Chart Cleanliness confidence factors
 *
 * Determinism guarantee: same (chart, question) always produces the same
 * WatchVerdict. No Date.now(), no Math.random().
 */

import type { Chart, HouseIndex, Planet } from '@astrology/types/chart';
import { PLANETS } from '@astrology/types/chart';
import type { ClassifiedQuestion } from '@astrology/types/question';
import type { ReasoningStep, VerdictKind, VerdictNarration } from '@astrology/types/verdict';
import type {
  WatchVerdict,
  WatchVerdictState,
  HouseLordAnalysis,
  MoonConfirmation,
  RulingConfirmation,
  SupportDirection,
  VastuScan,
  VastuDirection,
  ConfidenceFactors,
} from '@astrology/types/watchVerdict';
import { HOUSE_MATRIX } from '@astrology/kp/rules/houseMatrix';
import {
  localMinuteOfHour,
  computeWatchChart,
  clockHouseOfPlanet,
  signLordOf,
  directionOfSign,
  type WatchChart,
} from '@astrology/primitives/watchChart';
import { calculateDayLord } from '@astrology/primitives/rulingPlanets';
import { computeConvergenceTiming } from './timing';
import { remedyForPlanet } from './remedyTable';
import { toArabic } from './arabicNames';
import { BENEFICS } from './classicalToolkit';
import { analyseTriad, type TriadAnalysis } from './rkpTriad';
import { computeRKPMaterialRemedy } from './rkpRemedy';
import { ENGINE_VERSION } from '@astrology/primitives/chartBuilder';

// Re-exported for callers that analysed a single house before the triad
// protocol landed.
export { houseLordAnalysis } from './classicalToolkit';

// ── Deterministic ID — WATCH-namespaced ────────────────────────────────────

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
  const seed = `WATCH|${chart.momentUtc}|${chart.location.latitude}|${chart.location.longitude}|${question.text}|${question.qType}`;
  const a = fnv1a(seed);
  const b = fnv1a(seed + 'b');
  const c = fnv1a(seed + 'c');
  const d = fnv1a(seed + 'd');
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-${c.slice(0, 4)}-${c.slice(4)}${d.slice(0, 8)}`;
}

function step(ruleId: string, description: string): ReasoningStep {
  return { ruleId: `WATCH_${ruleId}`, description, weight: 0 };
}

// ── Moon confirmation ──────────────────────────────────────────────────────

function moonConfirmation(
  chart: Chart,
  watch: WatchChart,
  favorable: readonly number[],
  denial: readonly number[],
  houseLordVerdict: SupportDirection,
): MoonConfirmation {
  const subLord = chart.planets.Moon.subLord as Planet;
  const subLordClockHouse = clockHouseOfPlanet(subLord, chart, watch);
  const inFavorable = (favorable as number[]).includes(subLordClockHouse);
  const inDenial = (denial as number[]).includes(subLordClockHouse);

  let agreement: MoonConfirmation['agreement'] = 'neutral';
  if (inFavorable && houseLordVerdict === 'supported') {
    agreement = 'agrees';
  } else if (inDenial && houseLordVerdict === 'obstructed') {
    agreement = 'agrees';
  } else if (
    (inFavorable && houseLordVerdict === 'obstructed') ||
    (inDenial && houseLordVerdict === 'supported')
  ) {
    agreement = 'disagrees';
  }

  return { subLord, subLordClockHouse, agreement };
}

// ── Ruling-planet confirmation ─────────────────────────────────────────────

function rulingConfirmation(
  chart: Chart,
  watch: WatchChart,
  favorable: readonly number[],
  denial: readonly number[],
): RulingConfirmation {
  const jdUtc = new Date(chart.momentUtc).getTime() / 86400000 + 2440587.5;
  const dayLord = calculateDayLord(jdUtc, chart.location.longitude);
  const ascSignLord = signLordOf(watch.lagnaSign);
  const moonSignLord = signLordOf(chart.planets.Moon.sign);
  const moonStarLord = chart.planets.Moon.nakshatraLord as Planet;

  const witnesses: Planet[] = [dayLord, ascSignLord, moonSignLord, moonStarLord];
  const favorableWitnesses: Planet[] = [];
  const denialWitnesses: Planet[] = [];
  for (const w of witnesses) {
    const h = clockHouseOfPlanet(w, chart, watch);
    if ((favorable as number[]).includes(h)) {
      favorableWitnesses.push(w);
    } else if ((denial as number[]).includes(h)) {
      denialWitnesses.push(w);
    }
  }

  return {
    dayLord,
    ascSignLord,
    moonSignLord,
    moonStarLord,
    favorableWitnesses: Object.freeze(favorableWitnesses),
    denialWitnesses: Object.freeze(denialWitnesses),
  };
}

// ── Household Vastu scan ────────────────────────────────────────────────────

/**
 * Where the 9 grahas currently sit, by physical direction — independent of
 * any specific question. "The entire 360-degree compass layout of your
 * physical living space is mapped directly onto the 12 numbers of a
 * standard clock face" (source material). Structured fact only; remedy
 * wording belongs to the presentation layer.
 */
function computeVastuScan(chart: Chart): VastuScan {
  const occupants: Record<VastuDirection, Planet[]> = {
    North: [],
    South: [],
    East: [],
    West: [],
  };
  for (const p of PLANETS) {
    occupants[directionOfSign(chart.planets[p].sign)].push(p);
  }
  const afflictedDirections = (Object.keys(occupants) as VastuDirection[]).filter(d =>
    occupants[d].some(p => !BENEFICS.has(p)),
  );
  return {
    occupantsByDirection: Object.freeze({
      North: Object.freeze(occupants.North),
      South: Object.freeze(occupants.South),
      East: Object.freeze(occupants.East),
      West: Object.freeze(occupants.West),
    }),
    afflictedDirections: Object.freeze(afflictedDirections),
  };
}

// ── Verdict combination ────────────────────────────────────────────────────

const NATIVE_TO_VERDICT_KIND: Readonly<Record<WatchVerdictState, VerdictKind>> = {
  YES_STRONG: 'YES',
  YES_CONDITIONAL: 'CONDITIONAL',
  DELAY: 'DELAYED',
  WAIT: 'CONDITIONAL',
  NO_DENIED: 'NO',
  INCONCLUSIVE: 'UNCLEAR',
};

/**
 * The triad outcome sets the base state; the Moon and the ruling witnesses
 * then refine it.
 *
 * The triad protocol (rkpTriad.ts) is the RKP material's own definitive
 * Yes/No/Delayed rule, so it leads. The Moon sub-lord and ruling-planet
 * witnesses are the confirmation layer the earlier RKP material describes,
 * and they are kept in that role: they can sharpen a positive triad into
 * YES_STRONG, soften it to YES_CONDITIONAL, or — when both contradict the
 * triad outright — reduce it to INCONCLUSIVE. They never overturn a
 * `blocked` triad, which the material treats as structural.
 */
function combineVerdict(
  triad: TriadAnalysis,
  moon: MoonConfirmation,
  ruling: RulingConfirmation,
): WatchVerdictState {
  const rulingFavors = ruling.favorableWitnesses.length > ruling.denialWitnesses.length;
  const rulingDenies = ruling.denialWitnesses.length > ruling.favorableWitnesses.length;
  const witnessesContradict = moon.agreement === 'disagrees' && rulingDenies;

  switch (triad.outcome) {
    case 'blocked':
      return 'NO_DENIED';

    case 'delayed':
      // "It will happen, but only after strict corrections." Both witnesses
      // contradicting means even the delay is not reliably readable.
      return witnessesContradict ? 'INCONCLUSIVE' : 'DELAY';

    case 'positive':
      if (witnessesContradict) {
        return 'INCONCLUSIVE';
      }
      return moon.agreement === 'agrees' && rulingFavors ? 'YES_STRONG' : 'YES_CONDITIONAL';

    case 'mixed':
      return moon.agreement === 'disagrees' || rulingDenies ? 'INCONCLUSIVE' : 'WAIT';
  }
}

// ── Confidence (7-factor, 50-point-base model — 5 of 7 factors supported) ───

/**
 * Source: RKP Knowledge Base §13.2 / Authentic Engine Specification §23-24 —
 * the exact point values below are as given there. Multi-Cusp Agreement and
 * Chart Cleanliness (Void-of-Course etc.) are part of that documented model
 * but not yet implemented in this engine (see module docstring) — they
 * contribute 0 rather than an invented value.
 */
function computeConfidence(
  houseLord: HouseLordAnalysis,
  moon: MoonConfirmation,
  ruling: RulingConfirmation,
): { confidence: number; factors: ConfidenceFactors } {
  const subLordClarity = houseLord.verdict === 'mixed' ? -10 : 20;

  const moonAgreement = moon.agreement === 'agrees' ? 15 : moon.agreement === 'disagrees' ? -15 : 0;

  const overlap = Math.max(ruling.favorableWitnesses.length, ruling.denialWitnesses.length);
  const rulingOverlap = overlap >= 3 ? 15 : overlap === 2 ? 10 : overlap === 1 ? 5 : -10;

  // "Yes = -5 if in favorable; +0 if in denial" (source material) — applied
  // as: a retrograde lord only weakens confidence when it was otherwise
  // supporting the matter.
  const retrogradeAffliction = houseLord.retrograde && houseLord.verdict === 'supported' ? -5 : 0;

  // Timestamp precision: this app always supplies GPS-derived lat/lon, the
  // "GPS-timed" case in the source model.
  const timestampPrecision = 5;

  const factors: ConfidenceFactors = {
    subLordClarity,
    moonAgreement,
    rulingOverlap,
    retrogradeAffliction,
    timestampPrecision,
  };

  const raw =
    50 + subLordClarity + moonAgreement + rulingOverlap + retrogradeAffliction + timestampPrecision;
  const confidence = Math.round(Math.min(100, Math.max(0, raw)));

  return { confidence, factors };
}

// ── Narration ────────────────────────────────────────────────────────────

function buildNarration(
  nativeState: WatchVerdictState,
  qType: string,
  lord: Planet,
): VerdictNarration {
  const witness = toArabic(lord);
  return {
    en: buildEn(nativeState, qType, witness),
    ur: buildUr(nativeState, qType),
    hi: buildHi(nativeState, qType),
  };
}

function buildEn(nativeState: WatchVerdictState, qType: string, witness: string): string {
  switch (nativeState) {
    case 'YES_STRONG':
      return `The current for your ${qType} matter is open and strong. ${witness} governs the house of your question from a position of strength, and the witnesses of this moment confirm it. The path is clear to move forward.`;
    case 'YES_CONDITIONAL':
      return `The current for your ${qType} matter is open, though not without conditions. ${witness} holds the house of your question, but the witnesses give mixed testimony — the path exists and asks for patience with its terms.`;
    case 'DELAY':
      return `The current for your ${qType} matter is favorable, but the timing is deferred. ${witness} carries the promise forward from a position of retreat — the matter will be granted, though the arrival requires patience.`;
    case 'WAIT':
      return `The current for your ${qType} matter is neither fully open nor closed. ${witness} stands in a mixed position — the moment counsels waiting rather than forcing the matter now.`;
    case 'NO_DENIED':
      return `The current for your ${qType} matter is blocked at this hour. ${witness} stands obstructed in the house of your question. The oracle counsels patience and redirection rather than forcing this path.`;
    case 'INCONCLUSIVE':
      return `The witnesses for your ${qType} matter do not speak with one voice at this hour. Return when the moment has settled and ask again.`;
  }
}

function buildUr(nativeState: WatchVerdictState, qType: string): string {
  switch (nativeState) {
    case 'YES_STRONG':
      return `آپ کے ${qType} کے معاملے میں آسمانی رو کھلی اور مضبوط ہے۔ فلکی شہادت واضح طور پر کامیابی کی طرف اشارہ کر رہی ہے۔`;
    case 'YES_CONDITIONAL':
      return `آپ کے ${qType} کے معاملے میں راستہ کھلا ہے مگر کچھ شرائط کے ساتھ۔ صبر اور توجہ درکار ہے۔`;
    case 'DELAY':
      return `آپ کے ${qType} کے معاملے میں تاخیر ہے، لیکن فلکی شہادت بالآخر موافق ہے۔`;
    case 'WAIT':
      return `آپ کے ${qType} کے معاملے میں فی الحال انتظار بہتر ہے — رو نہ مکمل کھلی ہے نہ بند۔`;
    case 'NO_DENIED':
      return `آپ کے ${qType} کے معاملے میں اس وقت آسمانی رو مسدود ہے۔ صبر اور دوسری راہ پر غور کریں۔`;
    case 'INCONCLUSIVE':
      return `اس وقت فلکی گواہی واضح نہیں ہے۔ کچھ دیر بعد دوبارہ سوال کریں۔`;
  }
}

function buildHi(nativeState: WatchVerdictState, qType: string): string {
  switch (nativeState) {
    case 'YES_STRONG':
      return `آپ کے ${qType} کے معاملے میں آسمانی رو کھلی اور مضبوط ہے۔ کامیابی کے آثار روشن ہیں۔`;
    case 'YES_CONDITIONAL':
      return `آپ کے ${qType} کے معاملے میں راستہ کھلا ہے مگر کچھ شرائط درکار ہیں۔`;
    case 'DELAY':
      return `آپ کے ${qType} کے معاملے میں تاخیر ممکن ہے، لیکن نتیجہ موافق ہوگا۔`;
    case 'WAIT':
      return `آپ کے ${qType} کے معاملے میں فی الحال انتظار کریں۔`;
    case 'NO_DENIED':
      return `آپ کے ${qType} کے معاملے میں اس وقت آسمانی رو مسدود ہے۔`;
    case 'INCONCLUSIVE':
      return `اس وقت آسمانی گواہی واضح نہیں ہے۔ کسی اور وقت سوال کریں۔`;
  }
}

// ── Main entry point ──────────────────────────────────────────────────────

export interface JudgeRKPWatchOptions {
  /** Civil timezone+DST offset from UTC, in minutes (e.g. IST = +330). See localMinuteOfHour(). */
  readonly timezoneOffsetMinutes?: number;
}

export function judgeRKPWatch(
  chart: Chart,
  question: ClassifiedQuestion,
  options: JudgeRKPWatchOptions = {},
): WatchVerdict {
  const reasoning: ReasoningStep[] = [];

  const minute = localMinuteOfHour(
    new Date(chart.momentUtc),
    chart.location.longitude,
    options.timezoneOffsetMinutes,
  );
  const watch = computeWatchChart(minute);
  reasoning.push(
    step(
      'CHART',
      `Local minute=${minute} -> bucket ${watch.bucketIndex} -> Lagna sign #${watch.lagnaSign}`,
    ),
  );

  const qType = question.qType;
  const matrix = HOUSE_MATRIX[qType];
  const { favorable, denial, primary } = matrix;
  const primaryHouse = primary as HouseIndex;

  const triad = analyseTriad(chart, watch, primaryHouse);
  const houseLord = triad.target;
  reasoning.push(
    step(
      'HOUSE_LORD',
      `House ${primaryHouse} (sign #${houseLord.sign}, direction ${houseLord.direction}) lord ${houseLord.lord} ` +
        `in clock-house ${houseLord.lordHouse}, dignity=${houseLord.dignity}, score=${houseLord.supportScore} -> ${houseLord.verdict}`,
    ),
  );
  reasoning.push(
    step(
      'TRIAD',
      `1st=${triad.lagna.lord} (${triad.querentPolarity}) / ${primaryHouse}th=${triad.target.lord} (${triad.controllerPolarity}) / 11th=${triad.fulfilment.lord}; ` +
        `ruler relation=${triad.rulerRelation}; ` +
        `target malefics=[${triad.targetPressure.blockingMalefics.join(',')}] benefics=[${triad.targetPressure.rescuingBenefics.join(',')}]; ` +
        `11th malefics=[${triad.fulfilmentPressure.blockingMalefics.join(',')}] benefics=[${triad.fulfilmentPressure.rescuingBenefics.join(',')}] ` +
        `-> ${triad.outcome} (${triad.outcomeReason})`,
    ),
  );

  const vastu = computeVastuScan(chart);
  reasoning.push(
    step(
      'VASTU',
      `Afflicted directions=[${vastu.afflictedDirections.join(',')}]; ` +
        `activated house (${primaryHouse}) direction=${houseLord.direction}` +
        (vastu.afflictedDirections.includes(houseLord.direction) ? ' (afflicted)' : ' (clear)'),
    ),
  );

  const moon = moonConfirmation(chart, watch, favorable, denial, houseLord.verdict);
  reasoning.push(
    step(
      'MOON',
      `Moon's sub-lord ${moon.subLord} occupies clock-house ${moon.subLordClockHouse} -> ${moon.agreement}`,
    ),
  );

  const ruling = rulingConfirmation(chart, watch, favorable, denial);
  reasoning.push(
    step(
      'RULING',
      `Favorable witnesses=[${ruling.favorableWitnesses.join(',')}] Denial witnesses=[${ruling.denialWitnesses.join(',')}]`,
    ),
  );

  const nativeState = combineVerdict(triad, moon, ruling);
  const verdict = NATIVE_TO_VERDICT_KIND[nativeState];
  reasoning.push(step('VERDICT', `triad=${triad.outcome} -> ${nativeState} -> ${verdict}`));

  const confirmedSignificators = ruling.favorableWitnesses;
  const timing =
    nativeState === 'NO_DENIED' || nativeState === 'INCONCLUSIVE'
      ? undefined
      : computeConvergenceTiming(chart, confirmedSignificators);
  if (timing !== undefined) {
    reasoning.push(
      step(
        'TIMING',
        `Convergence on MD=${timing.activeDasha} AD=${timing.activeAntardasha} -> ${timing.window}`,
      ),
    );
  }

  const { confidence, factors: confidenceFactors } = computeConfidence(houseLord, moon, ruling);
  reasoning.push(
    step(
      'CONFIDENCE',
      `subLordClarity=${confidenceFactors.subLordClarity} moonAgreement=${confidenceFactors.moonAgreement} ` +
        `rulingOverlap=${confidenceFactors.rulingOverlap} retrogradeAffliction=${confidenceFactors.retrogradeAffliction} ` +
        `timestampPrecision=${confidenceFactors.timestampPrecision} -> ${confidence}`,
    ),
  );

  const narration = buildNarration(nativeState, qType, houseLord.lord);
  const remedy = remedyForPlanet(houseLord.lord);
  const materialRemedy = computeRKPMaterialRemedy(chart, watch, triad);
  reasoning.push(
    step(
      'MATERIAL_REMEDY',
      `Clear ${materialRemedy.clearance.direction} corner of [${materialRemedy.clearance.objects.join(', ')}]; ` +
        `act in the hora/weekday of ${materialRemedy.window.actionPlanet}` +
        (materialRemedy.window.weekday !== undefined ? ` (${materialRemedy.window.weekday})` : '') +
        `; advance the watch 2-3 min (${materialRemedy.clock.minutesToNextBucket} min to the next segment)`,
    ),
  );

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

  return Object.freeze({
    id: deterministicId(chart, question),
    computedAt: chart.momentUtc,
    question,
    qType,
    chart,
    watch,
    favorableHouses: favorable as HouseIndex[],
    denialHouses: denial as HouseIndex[],
    primaryHouse,
    houseLord,
    triad,
    moonConfirmation: moon,
    rulingConfirmation: ruling,
    vastu,
    materialRemedy,
    verdict,
    nativeState,
    confidence,
    confidenceFactors,
    narration,
    remedy,
    reasoning: Object.freeze(reasoning),
    timing,
    retrogradeFlags: Object.freeze(retrogradeFlags),
    combustFlags: Object.freeze(combustFlags),
    engineVersion: ENGINE_VERSION,
  } satisfies WatchVerdict);
}
