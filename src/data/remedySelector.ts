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

import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';
import { getCandidates, type RankingContext } from './rankCandidates';
import { renderRemedies, type RenderedRemedy } from './remedyRenderer';
import type { SeekerProfile } from '../stores/settingsStore';

type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};

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

/** Map oracle category string to dominant themes for ranking. */
function categoryToThemes(category: string): RankingContext['dominantThemes'] {
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
    const ranked = top8.find(c => c.id === r.id);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      effectDimension: r.effectDimension,
      intensity: r.intensity,
      themeTags: r.themeTags,
      score: ranked?.score ?? 0,
    };
  });

  try {
    const fn = (functions() as FunctionsWithRegion).region('asia-south1').httpsCallable<
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
}): SelectionContext {
  return {
    readingId: params.readingId,
    oracleClassification: verdictToClassification(params.verdict),
    dominantThemes: categoryToThemes(params.category),
    spiritualState: deriveSpiritualState(params.verdict, params.category),
    severity: params.severity,
    oracleSummary: params.oracleSummary,
    questionText: params.questionText,
    seekerProfile: params.seekerProfile ?? null,
  };
}
