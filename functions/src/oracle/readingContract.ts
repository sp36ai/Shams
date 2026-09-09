/**
 * readingContract.ts — the immutable boundary between the deterministic
 * Watch engine and the Oracle narration layer.
 * --------------------------------------------------------------------------
 * PHASE 3. See docs/audit/PHASE_3_IMMUTABLE_READING_CONTRACT.md for the full
 * design record — field provenance, claim surface, immutability strategy,
 * serialization/fingerprint rules, and what was deliberately deferred.
 *
 * ONE SENTENCE SUMMARY: `ReadingContract` is what the deterministic engine
 * decided, assembled once, frozen, and never touched again; everything past
 * this file (narration, TTS, UI) may only read it.
 *
 * This file does NOT compute a judgment, diagnosis, or remedy. It carries no
 * decision logic of its own — `buildReadingContract()` is a pure assembly
 * function over values `diagnose()` and `selectRemedyProtocol()` already
 * produced elsewhere. Nothing here may be called before those, and nothing
 * here may recompute what they already decided.
 *
 * This file sits outside functions/src/engine/ for the same reason
 * responseComposer.ts does (see that file's own header): it is not part of
 * the generated mirror of src/astrology/ and must not be placed there, or
 * sync-engine.mjs's prune step would delete it on the next build.
 */

import { createHash } from 'crypto';

import type { QuestionType } from '../engine/kp/rules/houseMatrix';
import type { DisplayWatchVerdict } from '../engine/rkp/watchJudgment';
import type { RkpDiagnosis } from '../engine/rkp/diagnosis';
import { ENGINE_VERSION } from '../engine/primitives/chartBuilder';
import type { RemedyProtocol } from './remedySelection';

/**
 * The contract's own schema version — independent of ENGINE_VERSION, which
 * versions the astronomical/judgment computation itself. This versions the
 * SHAPE this file assembles that computation into. Bump only when a field
 * is added, renamed, or removed below.
 */
export const READING_CONTRACT_VERSION = '1.0.0';

/* -------------------------------------------------------------------------- */
/*  Schema                                                                    */
/* -------------------------------------------------------------------------- */

export interface ReadingContractProvenance {
  readonly contractVersion: string;
  readonly engineVersion: string;
  /**
   * No independent "rules version" exists in this codebase today — the
   * house matrix, remedy library, and judgment weights are versioned
   * together with the engine build, not separately. Rather than invent a
   * second number nothing currently tracks independently (which the Phase 3
   * brief explicitly warns against — "Do not invent new scoring
   * semantics"), this field is documented as a deliberate alias of
   * `engineVersion` until the day the rules and the engine actually version
   * independently, at which point this field starts meaning something
   * different without changing its name or position in the schema.
   */
  readonly rulesVersion: string;
  /** The reading document's id — see PHASE_3 doc §I for the Firestore link. */
  readonly readingId: string;
  /** The server's own instant for this reading — see askWatchOracle.ts's
   *  own comment on why this is never client-supplied. ISO 8601, UTC. */
  readonly computedAt: string;
}

export interface ReadingContractQuestion {
  /**
   * The seeker's own words, verbatim, as received by the server — before
   * the prompt-time sanitization narrationContext.ts applies at the point
   * of use. Source of truth: the caller (user input), not the engine —
   * recorded here for provenance/audit completeness, not because the
   * engine decided it. Absent when the caller didn't send one (see
   * CompositionInput.question — optional).
   */
  readonly raw: string | null;
  /** The engine's own resolved classification. Source of truth: classifyQuestion(). */
  readonly questionType: QuestionType;
}

/**
 * The judgment, verbatim from the engine. Reused rather than restated —
 * `DisplayWatchVerdict` already IS the structured judgment representation;
 * duplicating its fields into a new shape here would be exactly the
 * "second copy of the truth" this contract exists to prevent.
 */
export type ReadingContractJudgment = DisplayWatchVerdict;

/** The diagnosis, verbatim from the engine. Same reasoning as judgment above. */
export type ReadingContractDiagnosis = RkpDiagnosis;

/**
 * One remedy step as the contract (and, downstream, narration and the
 * future validator) needs it. A composed union of two already-existing
 * shapes' fields — `SelectedRemedy`'s `reason` (why THIS selection chose
 * it) and `Remedy`'s own display fields — because no single existing
 * exported type carries both. This is not a new remedy-selection concept:
 * every field here is copied from a `SelectedRemedy` the deterministic
 * `selectRemedyProtocol()` already produced.
 */
export interface ReadingContractRemedyStep {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly evidenceType: string;
  readonly intensity: string;
  readonly duration: string | null;
  readonly explanation: string;
  readonly instructions: readonly string[];
  readonly isEscalation: boolean;
  /** Why THIS reading's selection chose it — SelectedRemedy.reason. */
  readonly reason: string;
}

export interface ReadingContractRemedy {
  readonly interventionRequired: boolean;
  readonly guidance: string | null;
  readonly steps: readonly ReadingContractRemedyStep[];
  readonly rationale: readonly string[];
}

/**
 * The complete allow-list of celestial-entity names this reading may be
 * narrated with reference to. Derived, not invented: every value here is
 * copied from a field the engine already computed and already
 * boundary-name-mapped (see utils/planetBoundaryName.ts) before this
 * contract is built — this array does not perform any naming translation
 * of its own, it only collects which of those already-safe names are
 * actually in play for this specific reading. See PHASE_3_CLAIM_SURFACE.md.
 */
export type ReadingContractCelestialEntities = readonly string[];

export interface ReadingContract {
  readonly provenance: ReadingContractProvenance;
  readonly question: ReadingContractQuestion;
  readonly judgment: ReadingContractJudgment;
  readonly diagnosis: ReadingContractDiagnosis;
  readonly remedy: ReadingContractRemedy;
  readonly celestialEntities: ReadingContractCelestialEntities;
}

/* -------------------------------------------------------------------------- */
/*  Construction                                                              */
/* -------------------------------------------------------------------------- */

export interface BuildReadingContractInput {
  readonly readingId: string;
  readonly computedAt: Date;
  readonly question: string | undefined;
  readonly verdict: DisplayWatchVerdict;
  readonly diagnosis: RkpDiagnosis;
  readonly protocol: RemedyProtocol;
}

/**
 * Assemble the immutable contract from values the deterministic engine
 * already produced. Performs no judgment, diagnosis, or remedy computation
 * of its own — `diagnosis` and `protocol` must already be the real output
 * of `diagnose()`/`selectRemedyProtocol()`, called exactly where they are
 * called today (composeWatchOracleResponse). Deep-frozen before return —
 * see `deepFreeze()` below and PHASE_3 doc §D for why TypeScript `readonly`
 * alone was judged insufficient.
 */
export function buildReadingContract(input: BuildReadingContractInput): ReadingContract {
  const { readingId, computedAt, question, verdict, diagnosis, protocol } = input;

  const steps: ReadingContractRemedyStep[] = protocol.steps.map(s => ({
    id: s.remedy.id,
    name: s.remedy.name,
    category: s.remedy.category,
    evidenceType: s.remedy.evidenceType,
    intensity: s.remedy.intensity,
    duration: s.remedy.duration ?? null,
    explanation: s.remedy.explanation,
    instructions: s.remedy.instructions,
    isEscalation: s.remedy.category === 'practical' && s.remedy.escalationFor !== undefined,
    reason: s.reason,
  }));

  const celestialEntities = Array.from(
    new Set(
      [verdict.targetRulerName, verdict.lagnaRuler, verdict.obstruction].filter(
        (name): name is string => typeof name === 'string' && name.length > 0 && name !== 'None',
      ),
    ),
  );

  const contract: ReadingContract = {
    provenance: {
      contractVersion: READING_CONTRACT_VERSION,
      engineVersion: ENGINE_VERSION,
      rulesVersion: ENGINE_VERSION,
      readingId,
      computedAt: computedAt.toISOString(),
    },
    question: {
      raw: question ?? null,
      questionType: diagnosis.qType,
    },
    judgment: verdict,
    diagnosis,
    remedy: {
      interventionRequired: protocol.interventionRequired,
      guidance: protocol.guidance,
      steps,
      rationale: protocol.rationale,
    },
    celestialEntities,
  };

  return deepFreeze(contract);
}

/* -------------------------------------------------------------------------- */
/*  Immutability                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Recursively `Object.freeze`s every plain object/array reachable from
 * `value`. TypeScript's `readonly` is compile-time only and does not stop
 * `as any`, a spread-then-mutate, or code outside this module's type
 * checking from writing to a nested field — a deep runtime freeze is what
 * actually prevents that, at the cost of a shallow recursive walk once per
 * reading (the contract is a few dozen fields deep at most; this is not the
 * multi-hundred-planet/house WatchChart object, so the cost is negligible —
 * see PHASE_3 doc §D for the measurement reasoning).
 *
 * Does not freeze class instances or functions (none exist in this
 * contract's shape) and does not attempt to freeze `Date` objects (also
 * none — `computedAt` is stored as an ISO string specifically so this
 * freezing pass never has to reason about Date mutability).
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const child = (value as unknown as Record<string, unknown>)[key];
    if (child !== null && (typeof child === 'object' || typeof child === 'function')) {
      deepFreeze(child);
    }
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*  Canonical serialization                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A stable, deterministic serialization of `value`: object keys sorted
 * recursively, so the same logical contract always serializes to the same
 * string regardless of property insertion order. Arrays keep their order
 * (order is meaningful — e.g. remedy steps, rationale lines).
 *
 * JSON-safe only: throws on `undefined` inside an object (JSON.stringify's
 * usual behavior — such keys are simply omitted) is NOT special-cased here
 * beyond what JSON.stringify itself does; every field in `ReadingContract`
 * is always present (`| null`, not `?`, for every optional-shaped value),
 * so this is a non-issue for this contract's own shape. Functions, class
 * instances, and circular structures are not handled specially — this
 * contract's shape contains none of them by construction.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*  Fingerprint                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A deterministic fingerprint of a contract's JUDGMENT-BEARING content —
 * question, judgment, diagnosis, and remedy — deliberately EXCLUDING
 * `provenance` in full: `readingId` and `computedAt` are per-invocation
 * identity, not judgment content, and including them would make the
 * fingerprint different for two readings that are, judgment-wise, the
 * identical deterministic result (e.g. this contract vs. itself,
 * regenerated). `contractVersion`/`engineVersion`/`rulesVersion` ARE
 * included (via a small explicit object below, not the whole provenance
 * block) — a fingerprint computed under one engine version should not
 * silently collide with one computed under another.
 *
 * Distinct in scope from the ad hoc `fingerprintChart()` helper in
 * functions/scripts/generate-golden-corpus.ts (Phase 1 test scaffolding,
 * never shipped): that one hashes the full WatchChart (every planet/house)
 * for regression-testing the chart-construction step in isolation. This
 * one hashes the reading's settled judgment/diagnosis/remedy — the
 * verdict's own chart-derived fields (target house, ruler, sign, etc.) are
 * already inside `judgment`, so this fingerprint changes if and only if
 * something judgment-relevant about the chart would have changed too;
 * a second, separate full-chart hash inside the production contract would
 * be exactly the "arbitrary chart object duplication" the Phase 3 brief
 * warns against.
 */
export function computeContractFingerprint(contract: ReadingContract): string {
  const material = {
    contractVersion: contract.provenance.contractVersion,
    engineVersion: contract.provenance.engineVersion,
    rulesVersion: contract.provenance.rulesVersion,
    question: contract.question,
    judgment: contract.judgment,
    diagnosis: contract.diagnosis,
    remedy: contract.remedy,
    celestialEntities: contract.celestialEntities,
  };
  return createHash('sha256').update(canonicalStringify(material)).digest('hex');
}
