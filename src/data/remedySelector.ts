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
import { REMEDY_LIBRARY, type TaggedRemedy } from './remedyLibrary';
import { getCandidates, type RankingContext } from './rankCandidates';

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
  selectedRemedies: TaggedRemedy[];
  selectionReason: string;
}

export interface SelectionContext extends RankingContext {
  readingId: string;
  oracleSummary: string; // 1–2 sentences for the LLM, never shown to user
  apiKey: string;
}

function verdictToClassification(verdict: string): RankingContext['oracleClassification'] {
  if (verdict === 'YES' || verdict === 'CONDITIONAL') return 'CONFIRMED';
  if (verdict === 'NO' || verdict === 'DENIED') return 'DENIED';
  return 'NEUTRAL';
}

/** Map oracle category string to dominant themes for ranking. */
function categoryToThemes(category: string): RankingContext['dominantThemes'] {
  const map: Record<string, RankingContext['dominantThemes']> = {
    marriage: ['ATTACHMENT', 'DOUBT'],
    career: ['MATERIAL_ANXIETY', 'DELAY'],
    finance: ['MATERIAL_ANXIETY', 'STAGNATION'],
    health: ['ANXIETY', 'GRIEF'],
    travel: ['DOUBT', 'FORCING'],
    legal: ['CONFLICT', 'OBSTRUCTION'],
    lost_item: ['STAGNATION', 'ANXIETY'],
    relationship: ['ESTRANGEMENT', 'CONFLICT'],
    spiritual: ['SPIRITUAL_NEGLECT', 'DOUBT'],
  };
  return map[category.toLowerCase()] ?? ['DOUBT', 'OBSTRUCTION'];
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
    const fallbackRemedies = candidates.slice(0, 3);
    return { selectedRemedies: fallbackRemedies, selectionReason: 'fallback: no api key' };
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
      typeof parsed.selectionReason === 'string'
        ? parsed.selectionReason
        : 'no reason provided';

    // Fire-and-forget Firestore write — never awaited
    logSelectionReason(ctx.readingId, selectionReason);

    const selectedRemedies = selectedIds
      .map(id => REMEDY_LIBRARY.find(r => r.id === id))
      .filter((r): r is TaggedRemedy => r !== undefined);

    return { selectedRemedies, selectionReason };
  } catch {
    clearTimeout(timer);
    return fallbackFromCandidates(candidates, ctx.readingId, 'llm call failed');
  }
}

function fallbackFromCandidates(
  candidates: TaggedRemedy[],
  readingId: string,
  reason: string,
): SelectionResult {
  const selectedRemedies = candidates.slice(0, 3);
  logSelectionReason(readingId, `fallback: ${reason}`);
  return { selectedRemedies, selectionReason: `fallback: ${reason}` };
}

/**
 * Convenience builder — derives RankingContext from a Reading's verdict fields.
 * Called in OracleScreen after askOracle resolves.
 */
export function contextFromReading(params: {
  readingId: string;
  verdict: string;
  category: string;
  spiritualState: RankingContext['spiritualState'];
  severity: RankingContext['severity'];
  oracleSummary: string;
  apiKey: string;
}): SelectionContext {
  return {
    readingId: params.readingId,
    oracleClassification: verdictToClassification(params.verdict),
    dominantThemes: categoryToThemes(params.category),
    spiritualState: params.spiritualState,
    severity: params.severity,
    oracleSummary: params.oracleSummary,
    apiKey: params.apiKey,
  };
}
