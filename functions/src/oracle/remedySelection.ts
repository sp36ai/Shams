/**
 * Remedy Selection Engine — the intervention layer.
 * --------------------------------------------------------------------------
 * Input:  an RkpDiagnosis (never a raw chart, never a planet on its own)
 * Output: an ordered protocol drawn only from REMEDY_LIBRARY, or an explicit
 *         no-remedy result.
 *
 * The engine answers one question: given this diagnosed condition, is an
 * intervention appropriate, and if so which one corresponds to it? It is
 * wholly deterministic — the same diagnosis yields the same protocol every
 * time, and every selection carries the score that produced it, so a reading
 * can be audited after the fact.
 *
 * Two rules shape the output more than the arithmetic does:
 *   - Nothing is prescribed when the chart is clean (see `interventionNeeded`).
 *     A remedy for every question turns the oracle into a vending machine.
 *   - Health and legal questions escalate to a professional ahead of any
 *     spiritual or astrological practice, regardless of score.
 */

import type { QuestionType } from '../engine/rules/houseMatrix';
import type { ImbalancePattern, RkpDiagnosis } from '../engine/rkp/diagnosis';
import {
  MANDATORY_ESCALATION_TYPES,
  REMEDY_LIBRARY,
  type Remedy,
  type RemedyCategory,
  type Tradition,
} from './remedyLibrary';

/* -------------------------------------------------------------------------- */
/*  Scoring weights                                                           */
/* -------------------------------------------------------------------------- */

const W = Object.freeze({
  /** Remedy targets the dominant imbalance. */
  PRIMARY_PATTERN: 12,
  /** Remedy targets a secondary imbalance. */
  SECONDARY_PATTERN: 6,
  /** Remedy is listed as suitable for this outcome class. */
  OUTCOME_MATCH: 8,
  /** Remedy corresponds to the obstructing agent. */
  PLANETARY: 5,
  /** Remedy corresponds to a house carrying the matter or its obstruction. */
  HOUSE: 3,
  /** Remedy's posture agrees with what the timing asks for. */
  TIMING: 4,
  /** Behavioral and practical interventions on an actionable diagnosis. */
  PRACTICAL_SUITABILITY: 4,
  /** Intensity out of step with how confident the reading is. */
  INTENSITY_MISMATCH: -6,
  /** Second and subsequent remedies from a category already represented. */
  REDUNDANCY: -7,
});

/**
 * Maximum scored interventions in a protocol. Beyond this it stops being a
 * protocol. A professional referral is additive and sits outside this cap —
 * safety advice must never be crowded out by a better-scoring practice.
 */
const MAX_PROTOCOL_LENGTH = 3;

/**
 * Rank assigned to a forced professional referral. A finite sentinel rather
 * than Infinity: this value is persisted to Firestore, which rejects
 * non-finite numbers, and it would serialise to null through JSON.
 */
const ESCALATION_SCORE = 1000;

/** Below this score a remedy is not a real correspondence, just the best of a bad set. */
const MIN_VIABLE_SCORE = 10;

/** Outcomes where concrete action or deliberate inaction earns its place. */
const ACTIONABLE_OUTCOMES = new Set([
  'CONDITIONAL',
  'DELAYED',
  'PREMATURE',
  'DECLINING',
  'UNCERTAIN',
]);

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

export interface SelectedRemedy {
  readonly remedy: Remedy;
  readonly score: number;
  /** Why this one was chosen, in diagnosis terms. Surfaced as "why this remedy". */
  readonly reason: string;
}

export interface RemedyProtocol {
  /** False when the diagnosis calls for no intervention at all. */
  readonly interventionRequired: boolean;
  /** Ordered interventions, highest correspondence first. Empty when none apply. */
  readonly steps: readonly SelectedRemedy[];
  /** Present when a professional referral was forced by the question type. */
  readonly escalation: SelectedRemedy | null;
  /** Guidance shown when no intervention is required. */
  readonly guidance: string | null;
  /** Audit trail of the selection itself, appended to the diagnosis rationale. */
  readonly rationale: readonly string[];
}

export interface SelectionOptions {
  /**
   * Traditions the seeker accepts. Remedies outside them are filtered out;
   * 'universal' entries always survive. Defaults to allowing Islamic practice,
   * which is the app's primary context.
   */
  readonly traditions?: readonly Tradition[];
}

/* -------------------------------------------------------------------------- */
/*  Scoring                                                                   */
/* -------------------------------------------------------------------------- */

function timingAgreement(diagnosis: RkpDiagnosis, remedy: Remedy): boolean {
  const waits = diagnosis.timingPosture === 'WAIT' || diagnosis.timingPosture === 'WAIT_LONG';
  const acts = diagnosis.timingPosture === 'ACT_NOW' || diagnosis.timingPosture === 'ACT_SOON';
  const patient = remedy.targetConditions.some(c => c === 'NEEDS_PATIENCE' || c === 'POOR_TIMING');
  const decisive = remedy.targetConditions.some(
    c => c === 'NEEDS_DECISIVE_ACTION' || c === 'FAVOURABLE_FLOW',
  );
  return (waits && patient) || (acts && decisive);
}

/**
 * A high-intensity practice on a low-confidence reading overclaims: the chart
 * is not sure enough to justify asking that much of the seeker.
 */
function intensityMismatched(diagnosis: RkpDiagnosis, remedy: Remedy): boolean {
  if (remedy.intensity === 'high' && diagnosis.confidence < 0.6) {
    return true;
  }
  return (
    remedy.intensity === 'low' &&
    diagnosis.confidence >= 0.8 &&
    diagnosis.outcome === 'UNFAVOURABLE'
  );
}

function scoreRemedy(
  diagnosis: RkpDiagnosis,
  remedy: Remedy,
): { score: number; reasons: string[] } | null {
  // Hard contraindication — never scored, never surfaced.
  if (remedy.avoidFor?.includes(diagnosis.outcome)) {
    return null;
  }
  // Level-5 entries are admitted only through the escalation path.
  if (remedy.category === 'practical' && remedy.escalationFor) {
    return null;
  }

  let score = 0;
  const reasons: string[] = [];

  if (remedy.targetConditions.includes(diagnosis.primaryPattern)) {
    score += W.PRIMARY_PATTERN;
    reasons.push(`addresses the dominant pattern (${diagnosis.primaryPattern})`);
  }

  const secondaryHits = diagnosis.secondaryPatterns.filter((p: ImbalancePattern) =>
    remedy.targetConditions.includes(p),
  );
  if (secondaryHits.length > 0) {
    score += W.SECONDARY_PATTERN * secondaryHits.length;
    reasons.push(`also addresses ${secondaryHits.join(', ')}`);
  }

  if (remedy.suitableFor.includes(diagnosis.outcome)) {
    score += W.OUTCOME_MATCH;
    reasons.push(`suited to a ${diagnosis.outcome.toLowerCase()} reading`);
  }

  if (
    diagnosis.obstructingAgent &&
    remedy.planetaryCorrespondences?.includes(diagnosis.obstructingAgent)
  ) {
    score += W.PLANETARY;
    reasons.push(`corresponds to the obstructing agent (${diagnosis.obstructingAgent})`);
  }

  if (remedy.houseCorrespondences?.length) {
    const houses = new Set([diagnosis.targetHouse, ...diagnosis.obstructingHouses]);
    if (remedy.houseCorrespondences.some(h => houses.has(h))) {
      score += W.HOUSE;
      reasons.push('corresponds to a house carrying this matter');
    }
  }

  if (timingAgreement(diagnosis, remedy)) {
    score += W.TIMING;
    reasons.push('matches what the timing asks for');
  }

  if (
    (remedy.category === 'behavioral' || remedy.category === 'practical') &&
    ACTIONABLE_OUTCOMES.has(diagnosis.outcome)
  ) {
    score += W.PRACTICAL_SUITABILITY;
  }

  if (intensityMismatched(diagnosis, remedy)) {
    score += W.INTENSITY_MISMATCH;
  }

  return { score, reasons };
}

/* -------------------------------------------------------------------------- */
/*  Safety filter                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Returns the professional referral this question type demands, if any.
 *
 * Health and legal always escalate. Financial, property and relational
 * questions escalate only when the reading is adverse — routine questions
 * should not be met with a lawyer.
 */
function escalationFor(qType: QuestionType, diagnosis: RkpDiagnosis): SelectedRemedy | null {
  const candidate = REMEDY_LIBRARY.find(r => r.escalationFor?.includes(qType));
  if (!candidate) {
    return null;
  }

  const mandatory = MANDATORY_ESCALATION_TYPES.includes(qType);
  const adverse =
    diagnosis.outcome === 'UNFAVOURABLE' ||
    diagnosis.outcome === 'DECLINING' ||
    diagnosis.confidence < 0.5;

  if (!mandatory && !adverse) {
    return null;
  }

  return {
    remedy: candidate,
    score: ESCALATION_SCORE,
    reason: mandatory
      ? `Questions of this kind (${qType}) require qualified professional advice; a reading does not substitute for it.`
      : `The reading is adverse on a ${qType} matter, which warrants professional advice before acting.`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Selection                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build the remedy protocol for a diagnosis.
 *
 * Deterministic: identical diagnoses produce identical protocols.
 */
export function selectRemedyProtocol(
  diagnosis: RkpDiagnosis,
  options: SelectionOptions = {},
): RemedyProtocol {
  const traditions = options.traditions ?? ['universal', 'islamic'];
  const rationale: string[] = [];

  const escalation = escalationFor(diagnosis.qType, diagnosis);
  if (escalation) {
    rationale.push(`Safety filter: escalated to ${escalation.remedy.name}.`);
  }

  // ── No-remedy result ─────────────────────────────────────────────────────
  // A clean, confident, unobstructed chart gets no prescription. The escalation
  // path still runs first, so a favourable health question keeps its referral.
  if (!diagnosis.interventionNeeded) {
    rationale.push('Diagnosis reports no intervention needed; returning no-remedy result.');
    return Object.freeze({
      // A forced professional referral is itself an intervention, so this is
      // only false when there is genuinely nothing for the seeker to do.
      interventionRequired: escalation !== null,
      steps: escalation ? Object.freeze([escalation]) : Object.freeze([]),
      escalation,
      guidance: escalation
        ? 'No spiritual or astrological remedy is indicated by the chart. The professional advice noted above stands on its own.'
        : 'No specific remedy is indicated. The reading is favourable and unobstructed — proceed according to it, and avoid unnecessary ritualisation.',
      rationale: Object.freeze(rationale),
    });
  }

  // ── Score the eligible library ───────────────────────────────────────────
  const eligible = REMEDY_LIBRARY.filter(r => r.traditions.some(t => traditions.includes(t)));
  rationale.push(`${eligible.length} of ${REMEDY_LIBRARY.length} remedies eligible by tradition.`);

  const scored = eligible
    .map(remedy => {
      const result = scoreRemedy(diagnosis, remedy);
      return result ? { remedy, ...result } : null;
    })
    .filter((s): s is { remedy: Remedy; score: number; reasons: string[] } => s !== null)
    .filter(s => s.score >= MIN_VIABLE_SCORE)
    // Ties break on id so the ordering is stable across runs.
    .sort((a, b) => b.score - a.score || a.remedy.id.localeCompare(b.remedy.id));

  // ── Redundancy: at most one remedy per category ──────────────────────────
  const steps: SelectedRemedy[] = [];
  const usedCategories = new Set<RemedyCategory>();

  for (const candidate of scored) {
    if (steps.length >= MAX_PROTOCOL_LENGTH) {
      break;
    }
    if (usedCategories.has(candidate.remedy.category)) {
      continue;
    }
    usedCategories.add(candidate.remedy.category);
    steps.push({
      remedy: candidate.remedy,
      score: candidate.score,
      reason: `Selected because it ${candidate.reasons.join(', ')}.`,
    });
  }

  if (steps.length === 0) {
    rationale.push('No remedy cleared the viability threshold.');
    return Object.freeze({
      interventionRequired: escalation !== null,
      steps: escalation ? Object.freeze([escalation]) : Object.freeze([]),
      escalation,
      guidance:
        'No specific remedy corresponds closely enough to this reading to be worth prescribing. Attend to the indication itself rather than seeking a practice.',
      rationale: Object.freeze(rationale),
    });
  }

  rationale.push(
    `Selected ${steps.length} intervention(s) across ${usedCategories.size} categor(ies).`,
  );

  return Object.freeze({
    interventionRequired: true,
    steps: Object.freeze(escalation ? [escalation, ...steps] : steps),
    escalation,
    guidance: null,
    rationale: Object.freeze(rationale),
  });
}
