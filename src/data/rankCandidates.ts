import { REMEDY_LIBRARY, type RemedyTag, type SpiritualState, type TaggedRemedy } from './remedyLibrary';

export type OracleClassification = 'CONFIRMED' | 'DENIED' | 'NEUTRAL';
export type Severity = 'low' | 'moderate' | 'high';

export interface RankingContext {
  oracleClassification: OracleClassification;
  dominantThemes: RemedyTag[];
  spiritualState: SpiritualState;
  severity: Severity;
}

interface ScoredRemedy {
  remedy: TaggedRemedy;
  score: number;
}

const INTENSITY_MAP: Record<Severity, TaggedRemedy['intensity'][]> = {
  low: ['gentle'],
  moderate: ['gentle', 'moderate'],
  high: ['moderate', 'deep'],
};

const STATE_TAG_MAP: Record<SpiritualState, RemedyTag[]> = {
  restless: ['RESTLESSNESS', 'DISTRACTION', 'ANXIETY'],
  hopeful: ['ABUNDANCE'],
  remorseful: ['PRIDE', 'CONFLICT', 'SPIRITUAL_NEGLECT'],
  uncertain: ['DOUBT', 'ATTACHMENT', 'FORCING'],
  grieving: ['GRIEF', 'SUPPRESSION', 'ESTRANGEMENT'],
  proud: ['PRIDE', 'FORCING', 'ATTACHMENT'],
  anxious: ['ANXIETY', 'MATERIAL_ANXIETY', 'RESTLESSNESS'],
  grateful: ['ABUNDANCE', 'SPIRITUAL_NEGLECT'],
};

const CONFIRMED_DIMENSIONS = new Set(['gratitude', 'opening', 'activation']);
const DENIED_DIMENSIONS = new Set(['surrender', 'patience', 'trust_building', 'comfort']);

export function rankCandidates(
  context: RankingContext,
  topN = 8,
  library = REMEDY_LIBRARY,
): TaggedRemedy[] {
  const allowed = new Set(INTENSITY_MAP[context.severity]);
  const stateTags = STATE_TAG_MAP[context.spiritualState];

  const scored: ScoredRemedy[] = library
    .filter(r => allowed.has(r.intensity))
    .map(remedy => {
      let score = 0;

      // Primary: tag overlap with dominantThemes (+10 per hit)
      for (const tag of context.dominantThemes) {
        if (remedy.themeTags.includes(tag)) {
          score += 10;
        }
      }

      // Secondary: spiritual state alignment (+5 per hit, no double-count)
      const primaryHits = new Set(
        context.dominantThemes.filter(t => remedy.themeTags.includes(t)),
      );
      for (const tag of stateTags) {
        if (remedy.themeTags.includes(tag) && !primaryHits.has(tag)) {
          score += 5;
        }
      }

      // Tertiary: verdict alignment bonus (+3)
      if (
        context.oracleClassification === 'DENIED' &&
        DENIED_DIMENSIONS.has(remedy.effectDimension)
      ) {
        score += 3;
      }
      if (
        context.oracleClassification === 'CONFIRMED' &&
        CONFIRMED_DIMENSIONS.has(remedy.effectDimension)
      ) {
        score += 3;
      }

      return { remedy, score };
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.remedy);
}

export function enforceCategoryDiversity(
  candidates: TaggedRemedy[],
  maxPerCategory = 2,
): TaggedRemedy[] {
  const counts: Record<string, number> = {};
  return candidates.filter(r => {
    const n = counts[r.category] ?? 0;
    if (n >= maxPerCategory) return false;
    counts[r.category] = n + 1;
    return true;
  });
}

/** Full pipeline: rank → diversity guard → top 8 for LLM. */
export function getCandidates(context: RankingContext): TaggedRemedy[] {
  const ranked = rankCandidates(context);
  return enforceCategoryDiversity(ranked);
}
