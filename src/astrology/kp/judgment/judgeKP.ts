/**
 * judgeKP — Classical KP judgment engine.
 * --------------------------------------------------------------------------
 * This is a DIFFERENT algorithm from judgeHorary.ts (the RKP engine). They
 * share the same astronomical primitives (chart, sub-lords, significators)
 * but judge them with distinct, non-interchangeable logic. See
 * docs/RKP_KP_FORENSIC_AUDIT.md for the full analysis of why KP and RKP are
 * not the same system, and docs/RKP_VS_KP_SEPARATION.md for the summary of
 * what each engine owns.
 *
 * THE ALGORITHM (source: RKP_KP_FORENSIC_AUDIT.md §A "What True KP Actually
 * Is" and §F "Correct KP Core Architecture"):
 *
 *  LAYER 1  Significators — 4-tier KP ranking per house (significators.ts):
 *           nakshatra-of-occupant > occupant > nakshatra-of-lord > lord.
 *           Union across favorable houses and denial houses; a planet
 *           signifying both sides is a neutral witness, removed from both.
 *
 *  LAYER 2  Promise — the cusp sub-lord of the question's PRIMARY house must
 *           itself be a favorable significator (connected to the favorable
 *           houses through the significator chain — not merely "absent from
 *           the denial houses"). If it is not, the chart does not promise
 *           this matter at all: hard stop, DENIED, no fructification runs.
 *           This is the classical "promise vs fructification" two-layer
 *           test — promise absent means the matter cannot happen in this
 *           chart regardless of what the ruling planets say.
 *
 *  LAYER 3  Fructification — analytical majority, NOT a weighted score:
 *             confirmed = favorable significators ∩ 5 classical ruling planets
 *             denied    = denial significators ∩ 5 classical ruling planets
 *             confirmed.length > denied.length → YES
 *             denied.length > confirmed.length → NO
 *             equal (including both empty)      → CONDITIONAL
 *           The Kotamraju filter (reject a ruling planet if its OWN sub-lord
 *           sits in a denial house) is applied to the ruling-planet set
 *           before the intersection — an advanced, legitimate KP check.
 *
 *  LAYER 4  Retrograde modifier — YES demotes to DELAYED if Moon's sub-lord,
 *           Jupiter, or Venus is retrograde. This is an established KP rule
 *           (not an RKP invention), so both engines apply it identically.
 *
 *  LAYER 5  Timing — dasha/antardasha/pratyantardasha convergence via
 *           timing.ts. Astronomical convergence, not scoring — shared
 *           machinery between both engines.
 *
 * Deliberately ABSENT — these belong to the RKP engine or the product layer,
 * not classical KP (see RKP_KP_FORENSIC_AUDIT.md §B/§G):
 *   - a numeric score or numeric confidence percentage
 *   - the Hora Lord witness (RKP's 6th "confirmatory" ruling planet) and the
 *     horary-number witness (an RKP-only additive signal)
 *   - remedy selection
 *   - narration templates
 *
 * Determinism guarantee: same (chart, question) always produces the same
 * KPVerdict, byte-for-byte except for intentional engineVersion changes.
 * No Date.now(), no Math.random(), no unordered Set iteration.
 */

import type { Chart, Planet, HouseIndex } from '@astrology/types/chart';
import type { ClassifiedQuestion } from '@astrology/types/question';
import type { ReasoningStep } from '@astrology/types/verdict';
import type {
  KPVerdict,
  KPVerdictKind,
  KPStrength,
  KPRulingPlanets,
} from '@astrology/types/kpVerdict';
import { HOUSE_MATRIX } from '@astrology/kp/rules/houseMatrix';
import { getSubLords } from '@astrology/primitives/subLord';
import { houseOfPlanet } from './significations';
import { computeSignificatorSets } from './significators';
import { computeConvergenceTiming } from './timing';
import { ENGINE_VERSION } from '@astrology/primitives/chartBuilder';

// ── Deterministic ID — KP-namespaced so it never collides with an RKP id
// computed for the same (chart, question) ─────────────────────────────────

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
  const seed = `KP|${chart.momentUtc}|${chart.location.latitude}|${chart.location.longitude}|${question.text}|${question.qType}`;
  const a = fnv1a(seed);
  const b = fnv1a(seed + 'b');
  const c = fnv1a(seed + 'c');
  const d = fnv1a(seed + 'd');
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-${c.slice(0, 4)}-${c.slice(4)}${d.slice(0, 8)}`;
}

// ── Reasoning trace ───────────────────────────────────────────────────────────

function step(ruleId: string, description: string, weight = 0): ReasoningStep {
  return { ruleId: `KP_${ruleId}`, description, weight };
}

// ── The 5 classical KP ruling-planet witnesses (Hora Lord excluded) ───────────
// chart.rulingPlanets order (see rulingPlanets.ts getRulingPlanets):
//   [0] dayLord  [1] horaLord  [2] ascSignLord  [3] ascStarLord
//   [4] moonSignLord  [5] moonStarLord
function classicalWitnesses(chart: Chart): KPRulingPlanets {
  const rps = chart.rulingPlanets;
  return {
    dayLord: rps[0] as Planet,
    ascSignLord: rps[2] as Planet,
    ascStarLord: rps[3] as Planet,
    moonSignLord: rps[4] as Planet,
    moonStarLord: rps[5] as Planet,
  };
}

function applyKotamrajuFilter(
  witnesses: readonly Planet[],
  denial: readonly number[],
  chart: Chart,
): Planet[] {
  return witnesses.filter(planet => {
    const planetData = chart.planets[planet];
    if (planetData === undefined) {
      return false;
    }
    const subLord = getSubLords(planetData.siderealLongitude).subLord as Planet;
    const subLordHouse = houseOfPlanet(subLord, chart);
    return !denial.includes(subLordHouse);
  });
}

// ── Layer 2: Promise check ────────────────────────────────────────────────────

/**
 * KP promise check: the sub-lord of the PRIMARY cusp must itself be a
 * favorable significator (connected to the favorable houses through the
 * significator chain). This is stricter than "not in a denial house" — a
 * cusp sub-lord that signifies neither side is also NOT promised.
 */
function checkPromise(
  chart: Chart,
  primary: number,
  favorableSignificators: readonly Planet[],
): { house: HouseIndex; cuspSubLord: Planet; cuspSubLordHouse: HouseIndex; promised: boolean } {
  const primaryCusp = chart.cusps[primary - 1];
  const cuspSubLord = (primaryCusp?.subLord ?? chart.planets.Moon.subLord) as Planet;
  const cuspSubLordHouse = houseOfPlanet(cuspSubLord, chart);
  const promised = (favorableSignificators as Planet[]).includes(cuspSubLord);
  return { house: primary as HouseIndex, cuspSubLord, cuspSubLordHouse, promised };
}

function strengthOf(confirmed: readonly Planet[], denied: readonly Planet[]): KPStrength {
  if (confirmed.length === 0 && denied.length === 0) {
    return 'mixed';
  }
  if (denied.length === 0 && confirmed.length >= 3) {
    return 'strong';
  }
  if (confirmed.length > denied.length) {
    return 'moderate';
  }
  if (denied.length > confirmed.length) {
    return denied.length >= 3 ? 'strong' : 'moderate';
  }
  return 'mixed';
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Judge a chart using classical KP — analytical promise/fructification
 * logic, no numeric scoring. Distinct from and NOT interchangeable with
 * judgeHorary() (the RKP engine).
 *
 * @param chart     Fully populated Chart from buildChart()
 * @param question  Pre-classified question
 * @returns         Complete KPVerdict ready to persist and render
 */
export function judgeKP(chart: Chart, question: ClassifiedQuestion): KPVerdict {
  const reasoning: ReasoningStep[] = [];

  const qType = question.qType;
  const matrix = HOUSE_MATRIX[qType];
  const { favorable, denial, primary } = matrix;

  reasoning.push(
    step(
      'HOUSES',
      `Question: '${qType}' | favorable houses=[${favorable.join(',')}] denial=[${denial.join(',')}]`,
    ),
  );

  // ── Layer 1: significators ────────────────────────────────────────────────
  const significators = computeSignificatorSets(chart, favorable, denial);
  reasoning.push(
    step(
      'SIGNIFICATORS',
      `Favorable significators=[${significators.favorable.join(',')}] ` +
        `Denial significators=[${significators.denial.join(',')}] ` +
        `Neutral(removed)=[${significators.neutral.join(',')}]`,
    ),
  );

  // ── Layer 2: promise ──────────────────────────────────────────────────────
  const promise = checkPromise(chart, primary as number, significators.favorable);

  if (!promise.promised) {
    reasoning.push(
      step(
        'PROMISE',
        `Promise FAILED: house ${promise.house} cusp sub-lord ${promise.cuspSubLord} ` +
          `(occupies house ${promise.cuspSubLordHouse}) is not a favorable significator → DENIED`,
        -1,
      ),
    );
    return Object.freeze({
      id: deterministicId(chart, question),
      computedAt: chart.momentUtc,
      question,
      qType,
      chart,
      favorableHouses: favorable as HouseIndex[],
      denialHouses: denial as HouseIndex[],
      promise,
      significators,
      rulingPlanets: classicalWitnesses(chart),
      confirmedSignificators: Object.freeze([]),
      deniedSignificators: Object.freeze([]),
      verdict: 'DENIED' as KPVerdictKind,
      strength: 'none' as KPStrength,
      stage: 'promise_failed' as const,
      reasoning: Object.freeze(reasoning),
      retrogradeFlags: Object.freeze([] as Planet[]),
      combustFlags: Object.freeze([] as Planet[]),
      engineVersion: ENGINE_VERSION,
    } satisfies KPVerdict);
  }

  reasoning.push(
    step(
      'PROMISE',
      `Promise HOLDS: house ${promise.house} cusp sub-lord ${promise.cuspSubLord} ` +
        `is a favorable significator`,
      1,
    ),
  );

  // ── Layer 3: fructification ──────────────────────────────────────────────
  const rulingPlanets = classicalWitnesses(chart);
  const witnessList: Planet[] = [
    rulingPlanets.dayLord,
    rulingPlanets.ascSignLord,
    rulingPlanets.ascStarLord,
    rulingPlanets.moonSignLord,
    rulingPlanets.moonStarLord,
  ];

  const filteredWitnesses = applyKotamrajuFilter(witnessList, denial, chart);
  for (const w of witnessList) {
    if (!filteredWitnesses.includes(w)) {
      reasoning.push(step('KOTAMRAJU', `${w} removed by Kotamraju filter (sub-lord in denial)`));
    }
  }
  const witnessSet = new Set(filteredWitnesses);

  const confirmedSignificators = significators.favorable.filter(p => witnessSet.has(p));
  const deniedSignificators = significators.denial.filter(p => witnessSet.has(p));

  for (const p of confirmedSignificators) {
    reasoning.push(
      step('FRUCTIFICATION', `${p}: favorable significator ∩ ruling planet → confirms`, 1),
    );
  }
  for (const p of deniedSignificators) {
    reasoning.push(
      step('FRUCTIFICATION', `${p}: denial significator ∩ ruling planet → opposes`, -1),
    );
  }

  let verdict: KPVerdictKind;
  if (confirmedSignificators.length > deniedSignificators.length) {
    verdict = 'YES';
  } else if (deniedSignificators.length > confirmedSignificators.length) {
    verdict = 'NO';
  } else {
    verdict = 'CONDITIONAL';
  }

  reasoning.push(
    step(
      'FRUCTIFICATION',
      `confirmed=${confirmedSignificators.length} denied=${deniedSignificators.length} → ${verdict}`,
    ),
  );

  // ── Layer 4: retrograde modifier ─────────────────────────────────────────
  const moonSubLord = chart.planets.Moon.subLord as Planet;
  if (verdict === 'YES') {
    const mslRetro = chart.planets[moonSubLord].isRetrograde;
    const jupRetro = chart.planets.Jupiter.isRetrograde;
    const venRetro = chart.planets.Venus.isRetrograde;
    if (mslRetro || jupRetro || venRetro) {
      verdict = 'DELAYED';
      const who = [mslRetro && `${moonSubLord}(MSL)`, jupRetro && 'Jupiter', venRetro && 'Venus']
        .filter(Boolean)
        .join(', ');
      reasoning.push(step('RETROGRADE', `YES → DELAYED: retrograde planet(s): ${who}`));
    }
  }

  // ── Layer 5: timing (shared convergence machinery) ───────────────────────
  const timing = computeConvergenceTiming(chart, confirmedSignificators as Planet[]);
  reasoning.push(
    step(
      'TIMING',
      `Convergence on MD=${timing.activeDasha} AD=${timing.activeAntardasha} → ${timing.window}`,
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

  return Object.freeze({
    id: deterministicId(chart, question),
    computedAt: chart.momentUtc,
    question,
    qType,
    chart,
    favorableHouses: favorable as HouseIndex[],
    denialHouses: denial as HouseIndex[],
    promise,
    significators,
    rulingPlanets,
    confirmedSignificators: Object.freeze(confirmedSignificators as Planet[]),
    deniedSignificators: Object.freeze(deniedSignificators as Planet[]),
    verdict,
    strength: strengthOf(confirmedSignificators, deniedSignificators),
    stage: 'fructification' as const,
    reasoning: Object.freeze(reasoning),
    timing,
    retrogradeFlags: Object.freeze(retrogradeFlags),
    combustFlags: Object.freeze(combustFlags),
    engineVersion: ENGINE_VERSION,
  } satisfies KPVerdict);
}
