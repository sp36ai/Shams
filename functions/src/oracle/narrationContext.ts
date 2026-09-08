/**
 * narrationContext.ts — the least-privilege view of a ReadingContract that
 * Oracle narration is allowed to see.
 * --------------------------------------------------------------------------
 * PHASE 3. See docs/audit/PHASE_3_IMMUTABLE_READING_CONTRACT.md §E and
 * docs/audit/PHASE_3_CLAIM_SURFACE.md.
 *
 * `toNarrationContext()` is a pure, narrowing projection — it invents
 * nothing, computes nothing, and cannot widen what the contract already
 * settled. Every field on `NarrationContext` is either copied verbatim from
 * `ReadingContract` or is `seekerName`/`motherName`, which are caller-
 * supplied personalization, never engine truth (see CompositionInput's own
 * doc comments in responseComposer.ts).
 *
 * What this file deliberately does NOT expose, compared to the full
 * `ReadingContract`: `provenance` (readingId, timestamps, version strings —
 * narration has no legitimate reason to know or mention these), the full
 * `celestialEntities` allow-list (narration is fed the entities already
 * embedded in `diagnosis`/`remedy` below; the allow-list itself is a
 * future-validator concern — see PHASE_3_CLAIM_SURFACE.md — not a
 * narration input), remedy step `id`/`duration`/`instructions`/
 * `explanation`/`isEscalation` (the synthesis prompt's remedy lines use
 * only name/category/evidenceType/reason — see buildUserPrompt in
 * responseComposer.ts — so nothing else is threaded through). No database
 * handle, callable function, mutable engine object, or unrelated user data
 * (auth, payment, security metadata) was ever reachable from
 * `ReadingContract` in the first place, so none of it needs excluding here
 * either — the boundary was already enforced one layer up.
 */

import type { ReadingContract } from './readingContract';
import type { QuestionType } from '../engine/kp/rules/houseMatrix';
import type { ImbalancePattern, RkpOutcome, TimingPosture } from '../engine/rkp/diagnosis';

export interface NarrationContextRemedyStep {
  readonly name: string;
  readonly category: string;
  readonly evidenceType: string;
  /** Why THIS reading's selection chose it — copied from ReadingContract, not re-derived. */
  readonly reason: string;
}

export interface NarrationContext {
  /** Caller-supplied personalization — never engine truth. See file header. */
  readonly seekerName: string | null;
  readonly motherName: string | null;
  /** The seeker's own words, unsanitized. Sanitized at the point of use
   *  (buildUserPrompt calling sanitizeQuestion) — not here, so this stays a
   *  faithful, unmodified copy of what the contract itself recorded. */
  readonly question: string | null;
  readonly diagnosis: {
    readonly outcome: RkpOutcome;
    readonly primaryPattern: ImbalancePattern;
    readonly secondaryPatterns: readonly ImbalancePattern[];
    readonly timingPosture: TimingPosture;
    readonly timing: { readonly minDays: number; readonly maxDays: number } | null;
    readonly confidence: number;
    readonly obstructingAgent: string | null;
    readonly targetHouse: number;
    readonly questionType: QuestionType;
    readonly rationale: readonly string[];
  };
  readonly remedy: {
    readonly interventionRequired: boolean;
    readonly guidance: string | null;
    readonly steps: readonly NarrationContextRemedyStep[];
  };
}

export function toNarrationContext(
  contract: ReadingContract,
  extras: { readonly seekerName?: string; readonly motherName?: string } = {},
): NarrationContext {
  return {
    seekerName: extras.seekerName ?? null,
    motherName: extras.motherName ?? null,
    question: contract.question.raw,
    diagnosis: {
      outcome: contract.diagnosis.outcome,
      primaryPattern: contract.diagnosis.primaryPattern,
      secondaryPatterns: contract.diagnosis.secondaryPatterns,
      timingPosture: contract.diagnosis.timingPosture,
      timing: contract.diagnosis.timing,
      confidence: contract.diagnosis.confidence,
      obstructingAgent: contract.diagnosis.obstructingAgent,
      targetHouse: contract.diagnosis.targetHouse,
      questionType: contract.question.questionType,
      rationale: contract.diagnosis.rationale,
    },
    remedy: {
      interventionRequired: contract.remedy.interventionRequired,
      guidance: contract.remedy.guidance,
      steps: contract.remedy.steps.map(s => ({
        name: s.name,
        category: s.category,
        evidenceType: s.evidenceType,
        reason: s.reason,
      })),
    },
  };
}
