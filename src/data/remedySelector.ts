/**
 * remedySelector — LLM selection layer (Phase 3).
 *
 * Takes the top-8 candidates from rankCandidates(), calls the selectRemedies
 * Cloud Function for contextual selection and description generation,
 * and returns the selected remedy IDs.
 *
 * The Cloud Function logs selectionReason to Firestore and holds the API key.
 * The client never touches the Anthropic API directly.
 */

import { regionalFunctions } from '../firebase/functionsRegion';
import { getCandidates, type OracleClassification, type RankingContext } from './rankCandidates';
import { renderRemedies, type RenderedRemedy } from './remedyRenderer';
import type { RemedyTag } from './remedyLibrary';
import type { SeekerProfile } from '../stores/settingsStore';

export interface SelectionResult {
  selectedRemedies: RenderedRemedy[];
  selectionReason: string;
}

export interface SelectionContext extends RankingContext {
  readingId: string;
  oracleSummary: string; // 1–2 sentences for the LLM, never shown to user
  questionText: string; // original question — used by Haiku description generator
  seekerProfile?: SeekerProfile | null;
}

function verdictToClassification(verdict: string): RankingContext['oracleClassification'] {
  if (verdict === 'YES' || verdict === 'CONDITIONAL') {
    return 'CONFIRMED';
  }
  if (verdict === 'NO' || verdict === 'DENIED') {
    return 'DENIED';
  }
  return 'NEUTRAL';
}

/**
 * Chart-derived remedy themes — the RKP signals the ranker used to ignore.
 * --------------------------------------------------------------------------
 * Until now `dominantThemes` came from the question TOPIC alone: every
 * career question got MATERIAL_ANXIETY + DELAY whether the chart showed a
 * clean opening or a Rahu-blocked denial. The engine now knows what is
 * actually in the way, so the ranker can use it.
 *
 * ⚠ NO NEW DEVOTIONAL CONTENT IS INTRODUCED HERE. These map the engine's
 * enums onto the EXISTING 18-tag vocabulary in remedyLibrary.ts, so remedy
 * selection still draws from the same owner-provided 39-remedy library.
 * Only the ranking inputs change.
 *
 * Provenance of each mapping:
 *   - Saturn -> DELAY/STAGNATION — the RKP material's own signature for
 *     Saturn ("brings delays and rigid structures", "hard bureaucratic
 *     delay").
 *   - Mars -> CONFLICT/HASTE — the material's "friction, anger, and sudden
 *     action", matching remedyTable.ts's own Mars line ("avoid anger,
 *     haste, and confrontation").
 *   - Rahu -> DOUBT/RESTLESSNESS — remedyTable.ts's Rahu line ("avoid
 *     confusion, deception, and impulsive decisions").
 *   - Ketu -> SPIRITUAL_NEGLECT/DOUBT — remedyTable.ts's Ketu line ("avoid
 *     doubt and spiritual neglect").
 * The condition-state mappings follow each state's own definition.
 */
const OBSTRUCTION_THEMES: Readonly<Record<string, readonly RemedyTag[]>> = Object.freeze({
  Saturn: ['DELAY', 'STAGNATION'],
  Mars: ['CONFLICT', 'HASTE'],
  Rahu: ['DOUBT', 'RESTLESSNESS'],
  Ketu: ['SPIRITUAL_NEGLECT', 'DOUBT'],
  MOON_DISAGREEMENT: ['ANXIETY', 'DOUBT'],
  DENIAL_WITNESS: ['OBSTRUCTION'],
  NONE: [],
});

const CONDITION_THEMES: Readonly<Record<string, readonly RemedyTag[]>> = Object.freeze({
  /** Structurally blocked. */
  Stambhana: ['OBSTRUCTION', 'STAGNATION'],
  /** Decaying, failing. */
  Kshaya: ['GRIEF', 'SUPPRESSION'],
  /** Reversing, rework required. */
  Vakra: ['DOUBT', 'RESTLESSNESS'],
  /** Unformed, premature — the timing has not matured. */
  Bija: ['DOUBT', 'STAGNATION'],
  /** Fully resolved. */
  Siddhi: ['ABUNDANCE'],
  /** In motion — carries no obstruction of its own. */
  Gati: [],
});

const SECONDARY_THEMES: Readonly<Record<string, readonly RemedyTag[]>> = Object.freeze({
  ENVIRONMENTAL_FRICTION: ['STAGNATION'],
  INNER_CONFLICT: ['DOUBT', 'RESTLESSNESS'],
  NONE: [],
});

/**
 * The six native states, collapsed onto the three effect-dimension buckets
 * the ranker weights by (see CONFIRMED_DIMENSIONS / DENIED_DIMENSIONS in
 * rankCandidates.ts).
 *
 * DELAY and WAIT stay NEUTRAL deliberately: they are not refusals, and
 * routing them to DENIED would flood a "yes, but later" reading with
 * surrender-and-grief remedies. Their patience signal is carried by the
 * DELAY/STAGNATION tags instead, which is the finer instrument.
 */
function nativeStateToClassification(nativeState: string): OracleClassification | undefined {
  switch (nativeState) {
    case 'YES_STRONG':
    case 'YES_CONDITIONAL':
      return 'CONFIRMED';
    case 'NO_DENIED':
      return 'DENIED';
    case 'DELAY':
    case 'WAIT':
    case 'INCONCLUSIVE':
      return 'NEUTRAL';
    default:
      return undefined; // unrecognised — fall back to the verdict mapping
  }
}

/** Signals the RKP engine now returns, all optional for older readings. */
export interface RKPRemedySignals {
  /** Six-state verdict — YES_STRONG … INCONCLUSIVE. */
  nativeState?: string;
  /** Condition classification — Siddhi / Stambhana / Gati / Vakra / Kshaya / Bija. */
  conditionState?: string;
  /** Closed-enum obstruction — Saturn / Mars / Rahu / Ketu / MOON_DISAGREEMENT / … */
  obstruction?: string;
  /** ENVIRONMENTAL_FRICTION / INNER_CONFLICT / NONE. */
  secondaryTheme?: string;
}

/**
 * Merge the chart-derived themes with the topic-derived ones.
 *
 * The topic themes are kept as a floor rather than replaced: a marriage
 * question is still about ATTACHMENT even when the chart is clean. Chart
 * themes lead, so tag-overlap scoring in rankCandidates() favours what is
 * actually obstructing the matter. Order is preserved and duplicates
 * removed, keeping the whole thing deterministic.
 */
function mergeThemes(
  chartThemes: readonly RemedyTag[],
  topicThemes: readonly RemedyTag[],
): RemedyTag[] {
  return [...new Set([...chartThemes, ...topicThemes])];
}

/**
 * Map oracle category string to dominant themes for ranking.
 * Exported so the Watch Oracle bridge reuses this mapping rather than keeping
 * a second copy that could drift — see data/watchRemedyContext.ts.
 */
export function categoryToThemes(category: string): RankingContext['dominantThemes'] {
  const map: Record<string, RankingContext['dominantThemes']> = {
    marriage: ['ATTACHMENT', 'DOUBT'],
    career: ['MATERIAL_ANXIETY', 'DELAY'],
    finance: ['MATERIAL_ANXIETY', 'STAGNATION'],
    health: ['ANXIETY', 'GRIEF'],
    property: ['MATERIAL_ANXIETY', 'OBSTRUCTION'],
    travel: ['DOUBT', 'FORCING'],
    legal: ['CONFLICT', 'OBSTRUCTION'],
    education: ['DOUBT', 'DELAY'],
    business: ['MATERIAL_ANXIETY', 'FORCING'],
    children: ['GRIEF', 'ATTACHMENT'],
    lostitem: ['STAGNATION', 'ANXIETY'],
    enemies: ['CONFLICT', 'ESTRANGEMENT'],
    spiritual: ['SPIRITUAL_NEGLECT', 'DOUBT'],
    general: ['DOUBT', 'OBSTRUCTION'],
  };
  return map[category.toLowerCase()] ?? ['DOUBT', 'OBSTRUCTION'];
}

/**
 * Option A — derive SpiritualState from verdict × category.
 */
function deriveSpiritualState(verdict: string, category: string): RankingContext['spiritualState'] {
  const classification = verdictToClassification(verdict);
  const cat = category.toLowerCase();

  if (classification === 'CONFIRMED') {
    if (cat === 'marriage' || cat === 'children') {
      return 'hopeful';
    }
    if (cat === 'spiritual') {
      return 'grateful';
    }
    return 'hopeful';
  }

  if (classification === 'DENIED') {
    if (cat === 'marriage' || cat === 'children') {
      return 'grieving';
    }
    if (cat === 'legal' || cat === 'enemies') {
      return 'remorseful';
    }
    if (cat === 'finance' || cat === 'property' || cat === 'business') {
      return 'anxious';
    }
    if (cat === 'health') {
      return 'fearful';
    }
    if (cat === 'spiritual') {
      return 'remorseful';
    }
    return 'uncertain';
  }

  // NEUTRAL
  if (cat === 'legal' || cat === 'enemies') {
    return 'uncertain';
  }
  if (cat === 'health') {
    return 'anxious';
  }
  if (cat === 'spiritual') {
    return 'uncertain';
  }
  if (cat === 'marriage' || cat === 'children') {
    return 'hopeful';
  }
  return 'uncertain';
}

export async function selectRemedies(ctx: SelectionContext): Promise<SelectionResult> {
  const rankingCtx: RankingContext = {
    oracleClassification: ctx.oracleClassification,
    dominantThemes: ctx.dominantThemes,
    spiritualState: ctx.spiritualState,
    severity: ctx.severity,
  };

  const candidates = getCandidates(rankingCtx);
  const top8 = candidates.slice(0, 8);
  const rendered = renderRemedies(top8.map(c => c.id));

  if (rendered.length === 0) {
    return { selectedRemedies: [], selectionReason: 'fallback: no candidates' };
  }

  // Build the payload for the selectRemedies Cloud Function
  const candidatePayload = rendered.map(r => {
    const rankIdx = top8.findIndex(c => c.id === r.id);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      effectDimension: r.effectDimension,
      intensity: r.intensity,
      themeTags: r.themeTags,
      score: rankIdx >= 0 ? (top8.length - rankIdx) * 10 : 0,
    };
  });

  try {
    const fn = regionalFunctions().httpsCallable<
      {
        oracleContext: {
          classification: string;
          spiritualState: string;
          severity: string;
          summary: string;
        };
        candidates: typeof candidatePayload;
        questionText: string;
        readingId: string;
      },
      {
        selectedIds: string[];
        selectionReason: string;
        descriptions: Record<string, string>;
      }
    >('selectRemedies');

    const result = await fn({
      oracleContext: {
        classification: ctx.oracleClassification,
        spiritualState: ctx.spiritualState,
        severity: ctx.severity,
        summary: ctx.oracleSummary,
      },
      candidates: candidatePayload,
      questionText: ctx.questionText,
      readingId: ctx.readingId,
    });

    const data = result.data;
    const selectedIds = Array.isArray(data?.selectedIds) ? data.selectedIds : [];

    if (selectedIds.length === 0) {
      return {
        selectedRemedies: renderRemedies(top8.slice(0, 3).map(c => c.id)),
        selectionReason: 'fallback: cf returned no valid ids',
      };
    }

    const selectedRemedies = renderRemedies(selectedIds).map(r => ({
      ...r,
      description: data.descriptions?.[r.id] ?? r.description,
    }));

    return {
      selectedRemedies,
      selectionReason: data.selectionReason ?? '',
    };
  } catch {
    return {
      selectedRemedies: renderRemedies(top8.slice(0, 3).map(c => c.id)),
      selectionReason: 'fallback: cf call failed',
    };
  }
}

/**
 * Enrich remedies with generated descriptions in parallel.
 * Each call to `generate` is isolated — failures leave the description absent
 * rather than propagating to the caller.
 */
export async function enrichWithDescriptions(
  remedies: RenderedRemedy[],
  generate: (remedy: RenderedRemedy) => Promise<string>,
): Promise<RenderedRemedy[]> {
  const results = await Promise.allSettled(remedies.map(r => generate(r)));
  return remedies.map((r, i) => {
    const outcome = results[i];
    if (outcome?.status === 'fulfilled') {
      return { ...r, description: outcome.value };
    }
    return r;
  });
}

/**
 * Convenience builder — derives full SelectionContext from a Reading's verdict fields.
 * seekerProfile is optional contextual data for future use.
 */
export function contextFromReading(params: {
  readingId: string;
  verdict: string;
  category: string;
  severity: RankingContext['severity'];
  oracleSummary: string;
  questionText: string;
  seekerProfile?: SeekerProfile | null;
  /**
   * RKP chart signals. Optional throughout: readings persisted before the
   * watch engine landed carry none of them, and must keep ranking exactly
   * as they did — so every one of these falls back to the topic-and-verdict
   * behaviour when absent.
   */
  rkp?: RKPRemedySignals;
}): SelectionContext {
  const rkp = params.rkp ?? {};

  const chartThemes: RemedyTag[] = [
    ...(rkp.obstruction ? (OBSTRUCTION_THEMES[rkp.obstruction] ?? []) : []),
    ...(rkp.conditionState ? (CONDITION_THEMES[rkp.conditionState] ?? []) : []),
    ...(rkp.secondaryTheme ? (SECONDARY_THEMES[rkp.secondaryTheme] ?? []) : []),
  ];

  return {
    readingId: params.readingId,
    oracleClassification:
      (rkp.nativeState !== undefined ? nativeStateToClassification(rkp.nativeState) : undefined) ??
      verdictToClassification(params.verdict),
    dominantThemes: mergeThemes(chartThemes, categoryToThemes(params.category)),
    spiritualState: deriveSpiritualState(params.verdict, params.category),
    severity: params.severity,
    oracleSummary: params.oracleSummary,
    questionText: params.questionText,
    seekerProfile: params.seekerProfile ?? null,
  };
}
