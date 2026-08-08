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
 *     classical lord. That lord's condition is read via the standard
 *     classical toolkit (confirmed default, not sourced from the RKP
 *     material itself — see module docstring on houseLordAnalysis()):
 *       - dignity: exalted/own sign = support; debilitated = obstruction
 *       - conjunction: benefic/malefic planets sharing the lord's clock-house
 *       - aspect (drishti): 7th-house aspect for all planets, plus Mars'
 *         4th/8th, Jupiter's 5th/9th, Saturn's 3rd/10th
 *       - combustion: weakens (obstruction)
 *       - retrograde: recorded as a modifier (delay), not scored directly
 *     Net tally -> supported / obstructed / mixed.
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
 *  6. VERDICT — house-lord direction + Moon confirmation + ruling-planet
 *     majority combine into one of six native states (YES_STRONG,
 *     YES_CONDITIONAL, DELAY, WAIT, NO_DENIED, INCONCLUSIVE), collapsed onto
 *     the shared VerdictKind for interop with the rest of the app.
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
 * Deliberately NOT yet included (explicit scope-out, not an oversight):
 *   - the 0-100 confidence score / confidence bands
 *   - the 8 classical strictures (Via Combusta, Void of Course, etc.)
 *   - third-person question house rotation
 *   - remedy / narration (product layer, out of scope for the calc engine)
 *
 * Determinism guarantee: same (chart, question) always produces the same
 * WatchVerdict. No Date.now(), no Math.random().
 */

import type { Chart, HouseIndex, Planet, SignIndex } from '../../types/chart';
import { PLANETS } from '../../types/chart';
import type { ClassifiedQuestion } from '../../types/question';
import type { ReasoningStep, VerdictKind } from '../../types/verdict';
import type {
  WatchVerdict,
  WatchVerdictState,
  HouseLordAnalysis,
  MoonConfirmation,
  RulingConfirmation,
  SupportDirection,
  VastuScan,
  VastuDirection,
} from '../../types/watchVerdict';
import { HOUSE_MATRIX } from '../../kp/rules/houseMatrix';
import {
  localMinuteOfHour,
  computeWatchChart,
  clockHouseOfPlanet,
  signLordOf,
  directionOfHouse,
  directionOfSign,
  type WatchChart,
} from '../../primitives/watchChart';
import { calculateDayLord } from '../../primitives/rulingPlanets';
import { computeConvergenceTiming } from './timing';
import { ENGINE_VERSION } from '../../primitives/chartBuilder';

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

// ── Classical toolkit: dignity, benefic/malefic, aspects (confirmed default) ──

const OWN_SIGNS: Readonly<Record<Planet, readonly SignIndex[]>> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11],
  Rahu: [],
  Ketu: [],
};

const EXALTED_SIGNS: Readonly<Record<Planet, readonly SignIndex[]>> = {
  Sun: [1],
  Moon: [2],
  Mars: [10],
  Mercury: [6],
  Jupiter: [4],
  Venus: [12],
  Saturn: [7],
  Rahu: [2, 3],
  Ketu: [8, 9],
};

const DEBILITATED_SIGNS: Readonly<Record<Planet, readonly SignIndex[]>> = {
  Sun: [7],
  Moon: [8],
  Mars: [4],
  Mercury: [12],
  Jupiter: [10],
  Venus: [6],
  Saturn: [1],
  Rahu: [8, 9],
  Ketu: [2, 3],
};

/**
 * Simplified natural benefic/malefic classification (Moon always benefic
 * here — see module docstring). Exhaustive over the 9 grahas: anything not
 * in BENEFICS (Sun, Mars, Saturn, Rahu, Ketu) is treated as malefic.
 */
const BENEFICS: ReadonlySet<Planet> = new Set(['Jupiter', 'Venus', 'Mercury', 'Moon']);

function dignityOf(planet: Planet, sign: SignIndex): 'exalted' | 'own' | 'debilitated' | 'neutral' {
  if (EXALTED_SIGNS[planet].includes(sign)) {
    return 'exalted';
  }
  if (OWN_SIGNS[planet].includes(sign)) {
    return 'own';
  }
  if (DEBILITATED_SIGNS[planet].includes(sign)) {
    return 'debilitated';
  }
  return 'neutral';
}

/** Houses aspected (drishti) by a planet at `fromHouse` — 7th for all, plus special rules. */
function aspectedHousesFrom(planet: Planet, fromHouse: HouseIndex): HouseIndex[] {
  const offsets = [6]; // 7th-house aspect, universal
  if (planet === 'Mars') {
    offsets.push(3, 7); // 4th, 8th
  } else if (planet === 'Jupiter') {
    offsets.push(4, 8); // 5th, 9th
  } else if (planet === 'Saturn') {
    offsets.push(2, 9); // 3rd, 10th
  }
  return offsets.map(o => (((fromHouse - 1 + o) % 12) + 1) as HouseIndex);
}

// ── House-lord support/obstruction analysis ────────────────────────────────

/**
 * Analyze the lord of `house` on the watch wheel using the classical
 * toolkit confirmed for this engine: dignity, conjunction, aspect (drishti),
 * combustion, retrograde. This specific scoring is a standard technique
 * applied to the RKP watch framework — not itself sourced from the RKP
 * material, which describes the concept (support vs. obstruction) without
 * giving exact weights. See module docstring.
 */
export function houseLordAnalysis(
  chart: Chart,
  watch: WatchChart,
  house: HouseIndex,
): HouseLordAnalysis {
  const sign = watch.houseSigns[house - 1] as SignIndex;
  const direction = directionOfHouse(house, watch);
  const lord = signLordOf(sign);
  const lordHouse = clockHouseOfPlanet(lord, chart, watch);
  const dignity = dignityOf(lord, chart.planets[lord].sign);

  const conjunctSupport: Planet[] = [];
  const conjunctObstruction: Planet[] = [];
  const aspectSupport: Planet[] = [];
  const aspectObstruction: Planet[] = [];

  for (const p of PLANETS) {
    if (p === lord) {
      continue;
    }
    const pHouse = clockHouseOfPlanet(p, chart, watch);
    if (pHouse === lordHouse) {
      (BENEFICS.has(p) ? conjunctSupport : conjunctObstruction).push(p);
    }
    if (aspectedHousesFrom(p, pHouse).includes(lordHouse)) {
      (BENEFICS.has(p) ? aspectSupport : aspectObstruction).push(p);
    }
  }

  const combust = chart.planets[lord].isCombust;
  const retrograde = chart.planets[lord].isRetrograde;

  const supportScore =
    (dignity === 'exalted' || dignity === 'own' ? 2 : 0) +
    (dignity === 'debilitated' ? -2 : 0) +
    conjunctSupport.length -
    conjunctObstruction.length +
    aspectSupport.length -
    aspectObstruction.length -
    (combust ? 1 : 0);

  const verdict: SupportDirection =
    supportScore > 0 ? 'supported' : supportScore < 0 ? 'obstructed' : 'mixed';

  return {
    house,
    sign,
    direction,
    lord,
    lordHouse,
    dignity,
    conjunctSupport: Object.freeze(conjunctSupport),
    conjunctObstruction: Object.freeze(conjunctObstruction),
    aspectSupport: Object.freeze(aspectSupport),
    aspectObstruction: Object.freeze(aspectObstruction),
    retrograde,
    combust,
    supportScore,
    verdict,
  };
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

function combineVerdict(
  houseLord: HouseLordAnalysis,
  moon: MoonConfirmation,
  ruling: RulingConfirmation,
): WatchVerdictState {
  if (houseLord.verdict === 'obstructed') {
    return 'NO_DENIED';
  }

  const rulingFavors = ruling.favorableWitnesses.length > ruling.denialWitnesses.length;
  const rulingDenies = ruling.denialWitnesses.length > ruling.favorableWitnesses.length;

  if (houseLord.verdict === 'supported') {
    if (houseLord.retrograde) {
      return 'DELAY';
    }
    if (moon.agreement === 'agrees' && rulingFavors) {
      return 'YES_STRONG';
    }
    if (moon.agreement === 'disagrees' && rulingDenies) {
      return 'INCONCLUSIVE';
    }
    return 'YES_CONDITIONAL';
  }

  // houseLord.verdict === 'mixed'
  if (moon.agreement === 'disagrees' || rulingDenies) {
    return 'INCONCLUSIVE';
  }
  return 'WAIT';
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

  const houseLord = houseLordAnalysis(chart, watch, primaryHouse);
  reasoning.push(
    step(
      'HOUSE_LORD',
      `House ${primaryHouse} (sign #${houseLord.sign}, direction ${houseLord.direction}) lord ${houseLord.lord} ` +
        `in clock-house ${houseLord.lordHouse}, dignity=${houseLord.dignity}, score=${houseLord.supportScore} -> ${houseLord.verdict}`,
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

  const nativeState = combineVerdict(houseLord, moon, ruling);
  const verdict = NATIVE_TO_VERDICT_KIND[nativeState];
  reasoning.push(step('VERDICT', `${nativeState} -> ${verdict}`));

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
    moonConfirmation: moon,
    rulingConfirmation: ruling,
    vastu,
    verdict,
    nativeState,
    reasoning: Object.freeze(reasoning),
    timing,
    retrogradeFlags: Object.freeze(retrogradeFlags),
    combustFlags: Object.freeze(combustFlags),
    engineVersion: ENGINE_VERSION,
  } satisfies WatchVerdict);
}
