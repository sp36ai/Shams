/**
 * RKP diagnosis layer — the standardised reading between judgment and remedy.
 * --------------------------------------------------------------------------
 * The raw WatchVerdict must not select a remedy directly. A planet appearing
 * in a chart is not, by itself, grounds for an intervention. This module
 * converts the verdict into a normalised diagnosis — an outcome class, an
 * imbalance profile and a timing posture — and the remedy engine works only
 * from that.
 *
 * The separation matters for a reason beyond tidiness: it is what lets the
 * system say "Zuhal weighs on the tenth, therefore the pattern is delay,
 * therefore patience" instead of "Zuhal is bad, therefore perform a Zuhal
 * remedy". The middle term is the diagnosis, and it is auditable — every
 * conclusion is recorded in `rationale`.
 *
 * Purity: this file depends on astrology types only. No data, firebase or
 * store imports, so sync-engine can mirror it to the server unchanged.
 */

import { HOUSE_MATRIX, type QuestionType } from '../rules/houseMatrix';

import type { Confidence, DisplayWatchVerdict, WatchState } from './watchJudgment';

/* -------------------------------------------------------------------------- */
/*  Result types                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The eight standing conditions a matter can be diagnosed into.
 *
 * These are deliberately broader than the six WatchStates: a state describes
 * what the chart shows, an outcome describes what it means for the seeker's
 * decision. FULFILLED with an obstruction present is not simply favourable —
 * it is conditional, and that distinction drives a different intervention.
 */
export type RkpOutcome =
  /** Conditions support the matter. */
  | 'FAVOURABLE'
  /** Significant denial or obstruction. */
  | 'UNFAVOURABLE'
  /** The matter may materialise later. */
  | 'DELAYED'
  /** Conflicting significators; the chart has not settled. */
  | 'UNCERTAIN'
  /** Outcome depends on a factor outside the chart's reach. */
  | 'CONDITIONAL'
  /** Timing is not yet supportive, though the matter itself is sound. */
  | 'PREMATURE'
  /** The matter is gathering strength. */
  | 'ESCALATING'
  /** The opportunity is weakening. */
  | 'DECLINING';

/**
 * The imbalance profile. These name what is actually out of true, which is
 * what a remedy targets — never the planet itself.
 */
export type ImbalancePattern =
  | 'OBSTRUCTION'
  | 'UNCERTAINTY'
  | 'CONFLICT'
  | 'INSTABILITY'
  | 'ATTACHMENT'
  | 'HASTE'
  | 'POOR_TIMING'
  | 'EXTERNAL_OPPOSITION'
  | 'NEEDS_PATIENCE'
  | 'NEEDS_DECISIVE_ACTION'
  | 'FAVOURABLE_FLOW';

/** What the seeker should do about timing, independent of what they should feel. */
export type TimingPosture = 'ACT_NOW' | 'ACT_SOON' | 'WAIT' | 'WAIT_LONG' | 'UNKNOWN';

export interface RkpDiagnosis {
  readonly outcome: RkpOutcome;
  readonly primaryPattern: ImbalancePattern;
  readonly secondaryPatterns: readonly ImbalancePattern[];
  readonly timingPosture: TimingPosture;
  /** Verdict confidence as a 0–1 scalar, for scoring arithmetic. */
  readonly confidence: number;
  /**
   * False when the chart is clean enough that prescribing anything would be
   * manufacturing a need. Drives the no-remedy result.
   */
  readonly interventionNeeded: boolean;
  /** Obstructing agent as a display name, or null when the path is clear. */
  readonly obstructingAgent: string | null;
  readonly qType: QuestionType;
  readonly targetHouse: number;
  readonly supportingHouses: readonly number[];
  readonly obstructingHouses: readonly number[];
  readonly timing: { readonly minDays: number; readonly maxDays: number } | null;
  /** Ordered audit trail: why this diagnosis, in chart terms. */
  readonly rationale: readonly string[];
}

/* -------------------------------------------------------------------------- */
/*  Correspondences                                                           */
/* -------------------------------------------------------------------------- */

const CONFIDENCE_SCALAR: Readonly<Record<Confidence, number>> = Object.freeze({
  VERY_HIGH: 0.95,
  HIGH: 0.8,
  MODERATE: 0.6,
  LOW: 0.4,
  UNCERTAIN: 0.2,
});

/**
 * What each obstructing agent says about the *shape* of the difficulty.
 *
 * This is a correspondence between an obstruction and the kind of imbalance it
 * describes — not a claim that the planet causes the seeker's condition.
 * Shadow nodes appear under both their internal and boundary names, since a
 * verdict may arrive either side of the server boundary mapping.
 */
const AGENT_PATTERNS: Readonly<Record<string, readonly ImbalancePattern[]>> = Object.freeze({
  Saturn: ['OBSTRUCTION', 'NEEDS_PATIENCE'],
  Mars: ['CONFLICT', 'HASTE'],
  Sun: ['EXTERNAL_OPPOSITION'],
  Mercury: ['UNCERTAINTY'],
  Jupiter: ['ATTACHMENT'],
  Venus: ['ATTACHMENT'],
  Moon: ['UNCERTAINTY', 'INSTABILITY'],
  Rahu: ['UNCERTAINTY', 'ATTACHMENT'],
  Ras: ['UNCERTAINTY', 'ATTACHMENT'],
  Ketu: ['UNCERTAINTY', 'INSTABILITY'],
  Dhanab: ['UNCERTAINTY', 'INSTABILITY'],
  MoonDisagreement: ['UNCERTAINTY'],
});

/** Base outcome per settled state, before obstruction and timing refine it. */
const STATE_OUTCOME: Readonly<Record<WatchState, RkpOutcome>> = Object.freeze({
  FULFILLED: 'FAVOURABLE',
  MOVING: 'ESCALATING',
  DELAYED: 'DELAYED',
  BLOCKED: 'UNFAVOURABLE',
  REVERSING: 'DECLINING',
  UNFORMED: 'UNCERTAIN',
});

/** Long-horizon threshold, in days, above which a delay reads as prematurity. */
const PREMATURE_THRESHOLD_DAYS = 45;
/** Below this, the window is near enough that the seeker can move on it. */
const IMMINENT_THRESHOLD_DAYS = 14;

/* -------------------------------------------------------------------------- */
/*  Diagnosis                                                                 */
/* -------------------------------------------------------------------------- */

function timingPostureFor(
  outcome: RkpOutcome,
  timing: { minDays: number; maxDays: number } | null,
  hasObstruction: boolean,
): TimingPosture {
  if (outcome === 'FAVOURABLE' && !hasObstruction) {
    return 'ACT_NOW';
  }
  if (outcome === 'UNFAVOURABLE') {
    // Nothing to time — the chart does not carry the matter.
    return 'WAIT';
  }
  if (!timing) {
    return 'UNKNOWN';
  }
  if (timing.maxDays <= IMMINENT_THRESHOLD_DAYS) {
    return 'ACT_SOON';
  }
  if (timing.maxDays <= PREMATURE_THRESHOLD_DAYS) {
    return 'WAIT';
  }
  return 'WAIT_LONG';
}

/**
 * Convert a settled verdict into a standardised diagnosis.
 *
 * Accepts either the engine's WatchVerdict or the boundary-mapped
 * DisplayWatchVerdict — the shadow-node rename does not affect the reading.
 */
export function diagnose(verdict: DisplayWatchVerdict): RkpDiagnosis {
  const rationale: string[] = [];

  const hasObstruction = verdict.obstruction !== 'None';
  const obstructingAgent = hasObstruction ? verdict.obstruction : null;

  // ── Outcome ──────────────────────────────────────────────────────────────
  let outcome: RkpOutcome = STATE_OUTCOME[verdict.state];
  rationale.push(`Watch state ${verdict.state} reads as ${outcome}.`);

  // A positive state carrying an obstruction is not clean: the matter stands,
  // but something must give first. That is conditional, not favourable.
  if ((outcome === 'FAVOURABLE' || outcome === 'ESCALATING') && hasObstruction) {
    outcome = 'CONDITIONAL';
    rationale.push(
      `${obstructingAgent} obstructs an otherwise supported matter, making the outcome conditional.`,
    );
  }

  // A delay stretched past the long horizon is better described as timing that
  // has not arrived than as an obstruction to be worked on.
  if (
    outcome === 'DELAYED' &&
    verdict.timing &&
    verdict.timing.minDays > PREMATURE_THRESHOLD_DAYS
  ) {
    outcome = 'PREMATURE';
    rationale.push(
      `Earliest window is ${verdict.timing.minDays} days out; the timing is not yet supportive.`,
    );
  }

  if (verdict.reversal === 'POSSIBLE' && outcome !== 'DECLINING') {
    rationale.push('A ruling planet is retrograde — reversal remains possible.');
  }

  // ── Imbalance profile ────────────────────────────────────────────────────
  const patterns: ImbalancePattern[] = [];
  const add = (p: ImbalancePattern): void => {
    if (!patterns.includes(p)) {
      patterns.push(p);
    }
  };

  if (obstructingAgent) {
    const agentPatterns = AGENT_PATTERNS[obstructingAgent] ?? ['OBSTRUCTION'];
    for (const p of agentPatterns) {
      add(p);
    }
    rationale.push(`Obstruction by ${obstructingAgent} indicates ${agentPatterns.join(' + ')}.`);
  }

  switch (outcome) {
    case 'FAVOURABLE':
      add('FAVOURABLE_FLOW');
      break;
    case 'UNFAVOURABLE':
      add('OBSTRUCTION');
      add('NEEDS_PATIENCE');
      break;
    case 'DELAYED':
      add('NEEDS_PATIENCE');
      add('POOR_TIMING');
      break;
    case 'PREMATURE':
      add('POOR_TIMING');
      add('NEEDS_PATIENCE');
      break;
    case 'UNCERTAIN':
      add('UNCERTAINTY');
      break;
    case 'DECLINING':
      add('INSTABILITY');
      add('NEEDS_DECISIVE_ACTION');
      break;
    case 'ESCALATING':
      add('NEEDS_DECISIVE_ACTION');
      break;
    case 'CONDITIONAL':
      add('UNCERTAINTY');
      break;
  }

  if (verdict.rulerRelation === 'Enemy') {
    add('EXTERNAL_OPPOSITION');
    rationale.push("The querent's ruler regards the ruler of the matter as an enemy.");
  }

  if (verdict.reversal === 'POSSIBLE') {
    add('INSTABILITY');
  }

  // An assertive controller on a blocked matter is opposition from a person,
  // not merely circumstance.
  if (verdict.controllerProfile === 'Assertive' && outcome === 'UNFAVOURABLE') {
    add('EXTERNAL_OPPOSITION');
    rationale.push('An assertive party controls the matter while the chart denies it.');
  }

  // Wanting a fast answer from a slow chart is the classic attachment signature.
  if (
    (outcome === 'DELAYED' || outcome === 'PREMATURE') &&
    verdict.controllerProfile === 'Assertive'
  ) {
    add('ATTACHMENT');
  }

  const confidence = CONFIDENCE_SCALAR[verdict.confidence];
  const timingPosture = timingPostureFor(outcome, verdict.timing, hasObstruction);

  // ── No-remedy test ───────────────────────────────────────────────────────
  // Clean chart, high confidence, nothing obstructing: prescribing anything
  // here would be ritual for its own sake.
  const interventionNeeded = !(
    outcome === 'FAVOURABLE' &&
    !hasObstruction &&
    confidence >= 0.8 &&
    verdict.reversal === 'NONE'
  );
  if (!interventionNeeded) {
    rationale.push(
      'Chart is clear, confidence is high and nothing obstructs — no intervention indicated.',
    );
  }

  const matrix = HOUSE_MATRIX[verdict.qType];

  return Object.freeze({
    outcome,
    primaryPattern: patterns[0] ?? 'UNCERTAINTY',
    secondaryPatterns: Object.freeze(patterns.slice(1)),
    timingPosture,
    confidence,
    interventionNeeded,
    obstructingAgent,
    qType: verdict.qType,
    targetHouse: verdict.targetHouse,
    supportingHouses: Object.freeze([...matrix.favorable]),
    obstructingHouses: Object.freeze([...matrix.denial]),
    timing: verdict.timing,
    rationale: Object.freeze(rationale),
  });
}
