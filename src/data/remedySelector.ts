/**
 * remedySelector — LLM selection layer (Phase 3).
 *
 * Takes the top-8 candidates from rankCandidates(), calls Claude Sonnet
 * for contextual selection, logs selectionReason to Firestore (fire-and-forget),
 * and returns the selected remedy IDs.
 *
 * selectionReason is INTERNAL ONLY — it is never rendered to the user.
 */

import firestore from '@react-native-firebase/firestore';
import { REMEDY_LIBRARY } from './remedyLibrary';
import { getCandidates, type RankingContext } from './rankCandidates';
import { renderRemedies, type RenderedRemedy } from './remedyRenderer';
import type { SeekerProfile } from '../stores/settingsStore';

const SELECTION_PROMPT = `You are the remedy selection layer of a sacred Islamic oracle.

You will receive oracle context and up to 8 candidate remedies.
Select 1 to 3 remedies that best serve this seeker's specific state.

Rules:
- Select a minimum of 1, maximum of 3 remedies
- Do not select two remedies from the same category
- Prefer variety across effectDimension
- The seeker must be able to act on your selection today

Return ONLY valid JSON in this exact structure:
{"selectedIds":["id_1","id_2"],"selectionReason":"One sentence explaining why these remedies serve this seeker's state."}

No markdown. No backticks. No preamble. Raw JSON only.`;

export interface SelectionResult {
  selectedRemedies: RenderedRemedy[];
  selectionReason: string;
}

export interface SelectionContext extends RankingContext {
  readingId: string;
  oracleSummary: string; // 1–2 sentences for the LLM, never shown to user
  questionText: string; // original question — used by Haiku description generator
  apiKey: string;
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
 *
 * Mapping table covers all 14 QuestionType values × CONFIRMED/DENIED/NEUTRAL.
 * NEUTRAL verdict defaults to the category's ambient emotional state.
 */
function deriveSpiritualState(verdict: string, category: string): RankingContext['spiritualState'] {
  const classification = verdictToClassification(verdict);
  const cat = category.toLowerCase();

  if (classification === 'CONFIRMED') {
    // Arrival states — differentiated by domain
    if (cat === 'marriage' || cat === 'children') {
      return 'hopeful';
    }
    if (cat === 'spiritual') {
      return 'grateful';
    }
    return 'hopeful';
  }

  if (classification === 'DENIED') {
    // Loss/obstruction states — differentiated by domain
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
    return 'uncertain'; // career, education, travel, lostitem, general
  }

  // NEUTRAL — ambient state by domain
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

/**
 * Haiku-generated 1–2 line sacred description for a single remedy.
 * Personalised to the seeker's question, verdict, and spiritual state.
 * Throws on any failure — caller must catch and fall back gracefully.
 */
async function generateRemedyDescription(
  remedy: RenderedRemedy,
  ctx: SelectionContext,
): Promise<string> {
  const prompt = `You are writing a 1–2 line sacred description for a spiritual remedy recommended to a seeker by an Islamic oracle.

The seeker asked: "${ctx.questionText}"
Oracle verdict: ${ctx.oracleClassification}
Seeker's state: ${ctx.spiritualState}
Remedy category: ${remedy.category}
Remedy title: ${remedy.title}
Effect: ${remedy.effectDimension}

Write exactly 1–2 lines of guidance in a sacred, compassionate register.
No bullet points. No headers. No Quranic citations (those appear elsewhere).
Begin directly with the practice, not with "This remedy" or "You should".
Maximum 30 words.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': ctx.apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`haiku http ${res.status}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('')
      .trim();

    if (text.length < 10) {
      throw new Error('description too short');
    }
    return text;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Enriches an array of RenderedRemedy with Haiku-generated descriptions.
 * All calls fire in parallel via Promise.all. Per-remedy failures are caught
 * individually — a single Haiku timeout leaves the other remedies intact.
 * Exported for unit testing with a mock generator.
 */
export async function enrichWithDescriptions(
  remedies: RenderedRemedy[],
  generate: (r: RenderedRemedy) => Promise<string>,
): Promise<RenderedRemedy[]> {
  return Promise.all(
    remedies.map(async r => {
      try {
        const description = await generate(r);
        return { ...r, description };
      } catch {
        return r; // description absent — card uses EFFECT_LABEL fallback
      }
    }),
  );
}

/** Write selectionReason to Firestore — fire-and-forget, never awaited in render path. */
function logSelectionReason(readingId: string, selectionReason: string): void {
  firestore()
    .collection('readings')
    .doc(readingId)
    .update({ selectionReason })
    .catch(() => undefined); // non-critical — silently discard
}

export async function selectRemedies(ctx: SelectionContext): Promise<SelectionResult> {
  const rankingCtx: RankingContext = {
    oracleClassification: ctx.oracleClassification,
    dominantThemes: ctx.dominantThemes,
    spiritualState: ctx.spiritualState,
    severity: ctx.severity,
  };

  const candidates = getCandidates(rankingCtx);

  if (!ctx.apiKey) {
    // No API key — return top 3 from TypeScript ranking, no LLM call
    return {
      selectedRemedies: renderRemedies(candidates.slice(0, 3).map(r => r.id)),
      selectionReason: 'fallback: no api key',
    };
  }

  const oracleContext = {
    classification: ctx.oracleClassification,
    spiritualState: ctx.spiritualState,
    severity: ctx.severity,
    summary: ctx.oracleSummary,
  };

  const userMessage = JSON.stringify({
    oracleContext,
    candidates: candidates.map(r => ({
      id: r.id,
      category: r.category,
      effectDimension: r.effectDimension,
      intensity: r.intensity,
      themeTags: r.themeTags,
    })),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': ctx.apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 120,
        system: SELECTION_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return fallbackFromCandidates(candidates, ctx.readingId, 'llm http error');
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find(b => b.type === 'text')?.text ?? '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as {
      selectedIds?: unknown;
      selectionReason?: unknown;
    };

    const rawIds = Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [];
    const validIds = new Set(REMEDY_LIBRARY.map(r => r.id));
    const selectedIds = (rawIds as unknown[])
      .filter((id): id is string => typeof id === 'string' && validIds.has(id))
      .slice(0, 3);

    if (selectedIds.length === 0) {
      return fallbackFromCandidates(candidates, ctx.readingId, 'llm returned no valid ids');
    }

    const selectionReason =
      typeof parsed.selectionReason === 'string' ? parsed.selectionReason : 'no reason provided';

    // Fire-and-forget Firestore write — never awaited
    logSelectionReason(ctx.readingId, selectionReason);

    const rendered = renderRemedies(selectedIds);
    const withDescriptions = await enrichWithDescriptions(rendered, r =>
      generateRemedyDescription(r, ctx),
    );

    return { selectedRemedies: withDescriptions, selectionReason };
  } catch {
    clearTimeout(timer);
    return fallbackFromCandidates(candidates, ctx.readingId, 'llm call failed');
  }
}

function fallbackFromCandidates(
  candidates: ReturnType<typeof getCandidates>,
  readingId: string,
  reason: string,
): SelectionResult {
  logSelectionReason(readingId, `fallback: ${reason}`);
  return {
    selectedRemedies: renderRemedies(candidates.slice(0, 3).map(r => r.id)),
    selectionReason: `fallback: ${reason}`,
  };
}

/**
 * Convenience builder — derives full SelectionContext from a Reading's verdict fields.
 * spiritualState is derived internally via Option A mapping (verdict × category).
 * Called in OracleScreen after askOracle resolves.
 */
export function contextFromReading(params: {
  readingId: string;
  verdict: string;
  category: string;
  severity: RankingContext['severity'];
  oracleSummary: string;
  questionText: string;
  apiKey: string;
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
    apiKey: params.apiKey,
    seekerProfile: params.seekerProfile ?? null,
  };
}
