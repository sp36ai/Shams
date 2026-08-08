/**
 * rkpRemedy — RKP's own material, object-based remedial engine.
 * --------------------------------------------------------------------------
 * Source (RKP material, "STRICT REMEDIAL ENGINE RULES"):
 *
 *   "You are strictly forbidden from recommending gemstones, spiritual
 *    fasts, mantras, or ritualistic donations. You must only generate
 *    authentic, material RKP micro-remedies:
 *      1. Clock Acceleration: advise the user to manually set their primary
 *         wristwatch or main wall clock exactly 2 to 3 minutes fast. This
 *         pulls their timeline into the next positive house segment.
 *      2. Material Clearances: identify the exact physical direction of the
 *         afflicted target house. Order the removal of dust, rust, broken
 *         glass, unorganized papers, dark blue/black objects, or stopped
 *         electronics from that corner.
 *      3. Planetary Timing Window: pinpoint a specific action time or day
 *         based on the ruling lord of the 1st or 11th house to execute
 *         real-world breakthroughs."
 *
 * ⚠ SCOPE NOTE — READ BEFORE EXTENDING:
 * This module produces STRUCTURED FACTS ONLY (a direction, a list of object
 * categories, a planet and its weekday/hora). It deliberately emits no
 * prose. It also does NOT replace the app's existing spiritual remedy
 * (remedyTable.ts — Qur'an, Asmā', zikr, sadaqah), which the RKP material's
 * own rule above would forbid. The two coexist because they answer to
 * different owners: the RKP document governs the calculation engine, the
 * Shams al-Asrār specification governs the presentation voice. Which one
 * reaches the seeker is a presentation-layer decision, flagged for the
 * project owner rather than resolved here.
 *
 * Determinism: pure function of (chart, watch, triad). No Date.now().
 */

import type { Chart, Planet } from '../../types/chart';
import type { VastuDirection, WatchChart } from '../../primitives/watchChart';
import { calculateHoraLord } from '../../primitives/rulingPlanets';
import type { TriadAnalysis } from './rkpTriad';

export type Weekday =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

/**
 * Planetary weekday rulership — universal and undisputed (it is the origin
 * of the weekday names themselves). Rahu and Ketu rule no weekday.
 */
const PLANET_WEEKDAY: Readonly<Partial<Record<Planet, Weekday>>> = Object.freeze({
  Sun: 'Sunday',
  Moon: 'Monday',
  Mars: 'Tuesday',
  Mercury: 'Wednesday',
  Jupiter: 'Thursday',
  Venus: 'Friday',
  Saturn: 'Saturday',
});

/**
 * Object categories to clear from an afflicted corner, keyed by the planet
 * afflicting it.
 *
 * ⚠ PROVENANCE — MIXED, DO NOT SILENTLY EXTEND:
 * The RKP material names exactly three planet-specific mappings, quoted
 * verbatim below ("rusted iron for Saturn, faulty wiring for Mars,
 * cluttered paper for Mercury"). No mapping is given for Sun, Moon,
 * Jupiter, Venus, Rahu or Ketu, so none is invented here — those planets
 * fall through to GENERAL_CLEARANCE, which is itself the material's own
 * unattributed list. The six gaps are open questions for the project owner.
 */
const PLANET_CLEARANCE: Readonly<Partial<Record<Planet, readonly string[]>>> = Object.freeze({
  Saturn: Object.freeze(['rusted iron', 'stopped clocks', 'dampness']),
  Mars: Object.freeze(['faulty wiring', 'broken glass']),
  Mercury: Object.freeze(['cluttered paper', 'unorganized documents']),
});

/**
 * The material's general list, applicable to any afflicted corner:
 * "dust, rust, broken glass, unorganized papers, dark blue/black objects,
 * or stopped electronics".
 */
const GENERAL_CLEARANCE: readonly string[] = Object.freeze([
  'dust',
  'rust',
  'broken glass',
  'unorganized papers',
  'dark blue or black objects',
  'stopped electronics',
]);

export interface ClockAcceleration {
  /** The material's fixed prescription: "exactly 2 to 3 minutes fast". */
  readonly advanceMinutesMin: 2;
  readonly advanceMinutesMax: 3;
  /**
   * How many minutes until the watch chart's Lagna actually changes sign.
   * Derived, not prescribed — it tells the presentation layer whether a
   * 2-3 minute advance would in fact "pull the timeline into the next
   * house segment" right now, or only shift it within the current one.
   */
  readonly minutesToNextBucket: number;
  /** True when a 3-minute advance crosses into the next 5-minute bucket. */
  readonly crossesIntoNextSegment: boolean;
}

export interface MaterialClearance {
  /** Physical direction of the afflicted target house. */
  readonly direction: VastuDirection;
  /** The blocking planets touching that house, which key the object list. */
  readonly afflictingPlanets: readonly Planet[];
  /** Object categories to remove from that corner. */
  readonly objects: readonly string[];
}

export interface ActionWindow {
  /** The planet whose hora/weekday opens the matter — the Lagna lord. */
  readonly actionPlanet: Planet;
  /** Secondary window from the 11th (fulfilment) lord. */
  readonly fulfilmentPlanet: Planet;
  /** Weekday ruled by actionPlanet, absent for Rahu/Ketu. */
  readonly weekday?: Weekday;
  /** Which planetary hora is running at the question moment. */
  readonly currentHoraLord: Planet;
  /** True when the action planet's own hora is running right now. */
  readonly horaOpenNow: boolean;
}

export interface RKPMaterialRemedy {
  readonly clock: ClockAcceleration;
  readonly clearance: MaterialClearance;
  readonly window: ActionWindow;
}

export function computeRKPMaterialRemedy(
  chart: Chart,
  watch: WatchChart,
  triad: TriadAnalysis,
): RKPMaterialRemedy {
  // ── 1. Clock acceleration ────────────────────────────────────────────────
  const minutesToNextBucket = 5 - (watch.localMinute % 5);
  const clock: ClockAcceleration = {
    advanceMinutesMin: 2,
    advanceMinutesMax: 3,
    minutesToNextBucket,
    crossesIntoNextSegment: minutesToNextBucket <= 3,
  };

  // ── 2. Material clearance ────────────────────────────────────────────────
  const afflicting = triad.targetPressure.blockingMalefics;
  const keyed = afflicting.flatMap(p => PLANET_CLEARANCE[p] ?? []);
  if (triad.targetPressure.saturnPressure) {
    keyed.push(...(PLANET_CLEARANCE.Saturn ?? []));
  }
  const objects = keyed.length > 0 ? dedupe(keyed) : GENERAL_CLEARANCE;
  const clearance: MaterialClearance = {
    direction: triad.target.direction,
    afflictingPlanets: Object.freeze(
      triad.targetPressure.saturnPressure && !afflicting.includes('Saturn')
        ? [...afflicting, 'Saturn' as Planet]
        : [...afflicting],
    ),
    objects: Object.freeze(objects),
  };

  // ── 3. Planetary timing window ───────────────────────────────────────────
  const jdUtc = new Date(chart.momentUtc).getTime() / 86400000 + 2440587.5;
  const currentHoraLord = calculateHoraLord(jdUtc, chart.location.longitude);
  const actionPlanet = triad.lagna.lord;
  const window: ActionWindow = {
    actionPlanet,
    fulfilmentPlanet: triad.fulfilment.lord,
    weekday: PLANET_WEEKDAY[actionPlanet],
    currentHoraLord,
    horaOpenNow: currentHoraLord === actionPlanet,
  };

  return { clock, clearance, window };
}

function dedupe(items: readonly string[]): string[] {
  return [...new Set(items)];
}
