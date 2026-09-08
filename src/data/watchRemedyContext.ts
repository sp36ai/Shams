/**
 * watchRemedyContext — physical-correspondence context for a Watch verdict.
 * --------------------------------------------------------------------------
 * PHASE 2B NOTE: this file used to also translate a watch verdict into the
 * ranking context the second, LLM-driven remedy path (selectRemedies)
 * consumed — `watchVerdictToRankingContext()`, plus the `classificationOf`/
 * `severityOf`/`spiritualStateOf` helpers and the `OBSTRUCTION_THEMES`/
 * `STATE_THEMES` tables it drew on. That path was disconnected — see
 * docs/audit/PHASE_2B_ENGINE_MIGRATION.md and
 * docs/audit/REMEDY_MIGRATION_PLAN.md for the full trace — and
 * `watchVerdictToRankingContext` was removed along with it, since
 * `src/screens/ReadingScreen.tsx` was its only caller. Removed rather than
 * left in place, because leaving a fully-orphaned ranking-context builder
 * around numbers among exactly the kind of "second decision path" this
 * migration exists to eliminate — as distinct from the still-orphaned but
 * *retained* files (`remedySelector.ts`, `rankCandidates.ts`, etc.), which
 * are left on disk, deprecated, because this session's tooling could not
 * delete whole files this phase (documented in the migration doc).
 *
 * What remains is unrelated: the physical-correspondence direction display
 * (`directionalFocusFor`), which RkpWatchCard renders regardless of remedy
 * selection and which Phase 2B did not touch.
 */

import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import type { Direction } from '@astrology/rkp/nomenclature';

export interface DirectionalFocus {
  /** Compass direction the affliction sits in. */
  readonly direction: Direction;
  /** What that obstruction corresponds to physically. */
  readonly focus: string;
}

/**
 * The physical correspondence of an affliction, by direction.
 *
 * Kept deliberately separate from remedy selection: the spiritual response
 * is the remedy, and this is context the UI may show alongside it. Returns
 * null when the chart names no obstruction, or names one with no physical
 * seat (Qamar's disagreement is interior, not environmental).
 */
export function directionalFocusFor(verdict: DisplayWatchVerdict): DirectionalFocus | null {
  if (verdict.afflictedDirection === null) {
    return null;
  }
  const focus = PHYSICAL_CORRESPONDENCE[verdict.obstruction];
  if (focus === undefined) {
    return null;
  }
  return { direction: verdict.afflictedDirection, focus };
}

// Keyed by both the engine's internal node names (Rahu/Ketu) and their
// boundary name (Ras/Dhanab — what a verdict received from askWatchOracle
// actually carries), same as the removed OBSTRUCTION_THEMES table used to be.
const PHYSICAL_CORRESPONDENCE: Readonly<Record<string, string>> = Object.freeze({
  Saturn: 'Stalled and accumulated things — unsorted paperwork, rust, items long unmoved.',
  Mars: 'Heat and breakage — faulty wiring, cracked glass, anything sharp left exposed.',
  Rahu: 'Disorder and excess — tangled cables, dead electronics, clutter with no owner.',
  Ras: 'Disorder and excess — tangled cables, dead electronics, clutter with no owner.',
  Ketu: 'The forgotten — possessions kept without purpose, or left behind by someone gone.',
  Dhanab: 'The forgotten — possessions kept without purpose, or left behind by someone gone.',
});
