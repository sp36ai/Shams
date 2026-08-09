/**
 * watchRemedyContext — bridges a Watch Oracle verdict into the remedy pipeline.
 * --------------------------------------------------------------------------
 * The app already owns a complete Islamic remedy layer: 38 tagged remedies in
 * remedyLibrary.ts (salawat, dua, istikhara, sadaqa, fasting, quran, dhikr,
 * charity, night prayer, silence, tawbah), ranked by rankCandidates.ts and
 * selected contextually by the Cloud Function behind remedySelector.ts.
 *
 * Nothing about that needs replacing for the Watch Oracle. What was missing is
 * a translation: the watch engine speaks in Ghars, rulers and obstructions,
 * while the remedy ranker speaks in themes, spiritual states and severity.
 * This module is that translation and nothing more.
 *
 * Layering: data → astrology (types only). The astrology modules stay pure and
 * never import from data, firebase or stores.
 *
 * On the reading of an obstruction: the obstructing planet describes the SHAPE
 * of the difficulty, which is what selects an apt spiritual response — Zuhal's
 * grinding delay asks for something different from Mirrikh's heat. The mapping
 * below is that correspondence, not a claim that a planet causes a state.
 */

import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import type { Direction } from '@astrology/rkp/nomenclature';
import type { SeekerProfile } from '../stores/settingsStore';
import type { RemedyTag } from './remedyLibrary';
import type { OracleClassification, RankingContext, Severity } from './rankCandidates';
import { categoryToThemes } from './remedySelector';

type SpiritualState = RankingContext['spiritualState'];

/* -------------------------------------------------------------------------- */
/*  State → classification and severity                                       */
/* -------------------------------------------------------------------------- */

/**
 * How the six watch states read as an oracle outcome.
 * DELAYED and REVERSING are deliberately NEUTRAL rather than DENIED: both say
 * the matter still stands, only not on the timeline the querent wanted.
 */
function classificationOf(verdict: DisplayWatchVerdict): OracleClassification {
  switch (verdict.state) {
    case 'FULFILLED':
    case 'MOVING':
      return 'CONFIRMED';
    case 'BLOCKED':
      return 'DENIED';
    case 'DELAYED':
    case 'REVERSING':
    case 'UNFORMED':
      return 'NEUTRAL';
  }
}

/**
 * Severity gates remedy intensity: 'low' admits only gentle practices, 'high'
 * reaches for the deep ones. A settled, favourable chart should not hand the
 * querent a heavy prescription.
 */
function severityOf(verdict: DisplayWatchVerdict): Severity {
  switch (verdict.state) {
    case 'BLOCKED':
      return 'high';
    case 'DELAYED':
      // A hard obstruction on a delayed matter is heavier than mere slowness.
      return verdict.obstruction === 'Saturn' || verdict.obstruction === 'Mars'
        ? 'high'
        : 'moderate';
    case 'REVERSING':
    case 'UNFORMED':
      return 'moderate';
    case 'MOVING':
    case 'FULFILLED':
      return 'low';
  }
}

/* -------------------------------------------------------------------------- */
/*  Obstruction → themes and inner state                                      */
/* -------------------------------------------------------------------------- */

/**
 * The shape of difficulty each obstructing agent describes.
 *
 * Keyed by BOTH the engine's internal node names (Rahu/Ketu — used by tests
 * and any caller working directly off judgeWatchChart) and their boundary
 * name (Ras/Dhanab — what a verdict received from askWatchOracle actually
 * carries). Same themes either way; only the lookup key differs.
 */
const OBSTRUCTION_THEMES: Readonly<Record<string, readonly RemedyTag[]>> = Object.freeze({
  Saturn: ['DELAY', 'STAGNATION', 'OBSTRUCTION'],
  Mars: ['CONFLICT', 'HASTE', 'FORCING'],
  Rahu: ['DOUBT', 'DISTRACTION', 'MATERIAL_ANXIETY'],
  Ras: ['DOUBT', 'DISTRACTION', 'MATERIAL_ANXIETY'],
  Ketu: ['ESTRANGEMENT', 'SPIRITUAL_NEGLECT', 'GRIEF'],
  Dhanab: ['ESTRANGEMENT', 'SPIRITUAL_NEGLECT', 'GRIEF'],
  MoonDisagreement: ['RESTLESSNESS', 'DOUBT', 'ANXIETY'],
});

/** Themes carried by the state itself, independent of any obstruction. */
const STATE_THEMES: Readonly<Record<DisplayWatchVerdict['state'], readonly RemedyTag[]>> =
  Object.freeze({
    FULFILLED: ['ABUNDANCE'],
    MOVING: ['ABUNDANCE', 'DOUBT'],
    DELAYED: ['DELAY', 'OBSTRUCTION'],
    BLOCKED: ['OBSTRUCTION', 'STAGNATION'],
    REVERSING: ['DOUBT', 'ATTACHMENT'],
    UNFORMED: ['DOUBT', 'RESTLESSNESS'],
  });

/**
 * Inner state of the querent, as the chart reports it.
 *
 * Qamar carries the mind, so its disagreement outranks the verdict: a settled
 * chart read by an unsettled questioner is still an unsettled reading.
 */
function spiritualStateOf(verdict: DisplayWatchVerdict): SpiritualState {
  if (verdict.obstruction === 'MoonDisagreement') {
    return 'restless';
  }
  switch (verdict.state) {
    case 'FULFILLED':
      return 'grateful';
    case 'MOVING':
      return 'hopeful';
    case 'BLOCKED':
      return verdict.obstruction === 'Mars' ? 'fearful' : 'anxious';
    case 'DELAYED':
      return 'anxious';
    case 'REVERSING':
    case 'UNFORMED':
      return 'uncertain';
  }
}

/* -------------------------------------------------------------------------- */
/*  Public bridge                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Translate a watch verdict into the context the remedy ranker expects.
 *
 * Themes are merged from three sources and de-duplicated, most specific first:
 * the obstruction (what is actually in the way), the state (how the matter
 * stands), and the question type (what domain it lives in).
 */
export function watchVerdictToRankingContext(
  verdict: DisplayWatchVerdict,
  seekerProfile?: SeekerProfile | null,
): RankingContext {
  const themes: RemedyTag[] = [
    ...(OBSTRUCTION_THEMES[verdict.obstruction] ?? []),
    ...STATE_THEMES[verdict.state],
    ...categoryToThemes(verdict.qType),
  ];

  return {
    oracleClassification: classificationOf(verdict),
    dominantThemes: [...new Set(themes)],
    spiritualState: spiritualStateOf(verdict),
    severity: severityOf(verdict),
    seekerProfile,
  };
}

/* -------------------------------------------------------------------------- */
/*  Directional focus                                                         */
/* -------------------------------------------------------------------------- */

export interface DirectionalFocus {
  /** Compass direction the affliction sits in. */
  readonly direction: Direction;
  /** What that obstruction corresponds to physically. */
  readonly focus: string;
}

/**
 * The physical correspondence of an affliction, by direction.
 *
 * Kept deliberately separate from the remedy selection above: the spiritual
 * response is the remedy, and this is context the UI may show alongside it.
 * Returns null when the chart names no obstruction, or names one with no
 * physical seat (Qamar's disagreement is interior, not environmental).
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

// Keyed by both the internal node names and their boundary name — see
// OBSTRUCTION_THEMES above for why.
const PHYSICAL_CORRESPONDENCE: Readonly<Record<string, string>> = Object.freeze({
  Saturn: 'Stalled and accumulated things — unsorted paperwork, rust, items long unmoved.',
  Mars: 'Heat and breakage — faulty wiring, cracked glass, anything sharp left exposed.',
  Rahu: 'Disorder and excess — tangled cables, dead electronics, clutter with no owner.',
  Ras: 'Disorder and excess — tangled cables, dead electronics, clutter with no owner.',
  Ketu: 'The forgotten — possessions kept without purpose, or left behind by someone gone.',
  Dhanab: 'The forgotten — possessions kept without purpose, or left behind by someone gone.',
});
