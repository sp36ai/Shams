/**
 * kpVerdict — maps a stored Reading's verdictJson.kp blob to KpVerdictResult.
 * --------------------------------------------------------------------------
 * Mirrors readingToAstroResult() in OracleChatScreen.tsx, but for the
 * classical KP engine's data, rendered on its own screen (KPReadingScreen).
 * Returns undefined when the reading has no `kp` data — defensive against
 * readings saved before this feature shipped.
 */

import type { Reading } from '@stores/readingsStore';
import type { KpVerdictResult, KpWitnessEntry } from '../types/verdict';

interface KpVjRulingPlanets {
  dayLord?: string;
  ascSignLord?: string;
  ascStarLord?: string;
  moonSignLord?: string;
  moonStarLord?: string;
}

interface KpVjTiming {
  window?: 'days' | 'weeks' | 'months' | 'years';
  range?: { min?: number; max?: number };
  activeDasha?: string;
  activeAntardasha?: string;
}

interface KpVjRemedy {
  planet?: string;
  action?: string;
  avoid?: string;
  zikr?: string;
  charity?: string;
}

interface KpVjSignificators {
  favorable?: string[];
  denial?: string[];
  neutral?: string[];
}

interface KpVj {
  verdict?: string;
  confidence?: number;
  narration?: Partial<Record<'en' | 'ur' | 'hi', string>>;
  timing?: KpVjTiming;
  significators?: KpVjSignificators;
  confirmedSignificators?: string[];
  deniedSignificators?: string[];
  rulingPlanets?: KpVjRulingPlanets;
  remedy?: KpVjRemedy;
  horaryNumber?: number;
  horarySubLord?: string;
  horarySubLordHouse?: number;
  reasoning?: Array<{ ruleId: string; description: string; weight: number }>;
}

interface VjWithKp {
  kp?: KpVj;
  /**
   * Cuspal sub-lords (promise layer) — computed once, shared by both engines
   * (same HOUSE_MATRIX-derived houses), stored at the TOP level of
   * verdictJson rather than under `kp`. See src/firebase/oracle.ts.
   */
  cuspSubLords?: Array<{ house: number; subLord: string; subLordHouse: number }>;
}

const WITNESS_ROLE_ORDER: KpWitnessEntry['role'][] = [
  'dayLord',
  'ascSignLord',
  'ascStarLord',
  'moonSignLord',
  'moonStarLord',
];

export function readingToKpResult(reading: Reading): KpVerdictResult | undefined {
  const vj = reading.verdictJson as VjWithKp | null;
  const kp = vj?.kp;
  if (kp === undefined) {
    return undefined;
  }

  const rp = kp.rulingPlanets;
  const witnesses: KpWitnessEntry[] = WITNESS_ROLE_ORDER.flatMap(role => {
    const planet = rp?.[role];
    if (planet === undefined) {
      return [];
    }
    const status: KpWitnessEntry['status'] = kp.confirmedSignificators?.includes(planet)
      ? 'confirmed'
      : kp.deniedSignificators?.includes(planet)
        ? 'denied'
        : 'neutral';
    return [{ planet, role, status }];
  });

  return {
    verdict: (kp.verdict ?? reading.verdict) as KpVerdictResult['verdict'],
    confidence: kp.confidence ?? 0,
    witnesses,
    confirmedCount: kp.confirmedSignificators?.length ?? 0,
    deniedCount: kp.deniedSignificators?.length ?? 0,
    timing: kp.timing?.window
      ? {
          window: kp.timing.window,
          range: { min: kp.timing.range?.min ?? 0, max: kp.timing.range?.max ?? 1 },
          activeDasha: kp.timing.activeDasha,
          activeAntardasha: kp.timing.activeAntardasha,
        }
      : undefined,
    remedy: kp.remedy?.action
      ? {
          planet: kp.remedy.planet ?? '—',
          action: kp.remedy.action,
          avoid: kp.remedy.avoid ?? '',
          zikr: kp.remedy.zikr,
          charity: kp.remedy.charity,
        }
      : undefined,
    narrative: kp.narration?.[reading.questionLang] ?? kp.narration?.en ?? '',
    category: reading.category,
    question: reading.question,
    createdAt: reading.createdAt,
    horaryNumber: kp.horaryNumber,
    horarySubLord: kp.horarySubLord,
    horarySubLordHouse: kp.horarySubLordHouse,
    reasoning: kp.reasoning,
    significators: kp.significators
      ? {
          favorable: kp.significators.favorable ?? [],
          denial: kp.significators.denial ?? [],
          neutral: kp.significators.neutral ?? [],
        }
      : undefined,
    cuspSubLords: vj?.cuspSubLords,
  };
}
