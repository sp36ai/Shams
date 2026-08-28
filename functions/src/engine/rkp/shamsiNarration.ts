/**
 * Shamsi Logic Verdict Narration & Remedy Composition
 * 
 * Transforms raw phase outputs into prose verdicts and remedy selections.
 */

import type { Planet } from '../types/chart';
import type { PromiseCheckResult, ShamsiVerdict, TransitTriggerResult } from './shamsiLogic';
import type { ShamsiQuestionType } from './shamsiHouseMatrix';

export interface ShamsiNarration {
  verdict: string;
  reasoning: string;
  remedy: RemedyRecommendation | null;
  timing: string | null;
}

export interface RemedyRecommendation {
  type: string; // e.g., 'dua', 'salawat', 'istikhara', 'sadaqa', 'fasting'
  description: string;
  duration: string | null;
}

/**
 * Compose human-readable verdict from Promise Check result.
 */
export function composePromiseNarration(
  promise: PromiseCheckResult,
  questionType: ShamsiQuestionType,
  lang: 'en' | 'ur' | 'hi',
): string {
  const csl = promise.cuspalSubLord;
  const stl = promise.starLordOfCSL;

  if (lang === 'en') {
    if (promise.verdict === 'PROMISED') {
      return `The Star Lord of the Cuspal Sub-Lord of House ${promise.primaryHouse} (${stl}) signifies the primary and supporting houses. The oracle says: YES, the path is open.`;
    } else if (promise.verdict === 'DENIED') {
      return `The Star Lord of the Cuspal Sub-Lord of House ${promise.primaryHouse} (${stl}) signifies the negating house. The oracle says: NO, the path is blocked.`;
    } else {
      return `The Star Lord of the Cuspal Sub-Lord of House ${promise.primaryHouse} (${stl}) touches neither promise nor denial. The oracle is UNCLEAR.`;
    }
  } else if (lang === 'ur') {
    if (promise.verdict === 'PROMISED') {
      return `نجم رب حصہ کی ذیلی رب (${stl}) بنیادی اور معاون گھروں کو ظاہر کرتا ہے۔ اوریکل کہتا ہے: جی، راستہ کھلا ہے۔`;
    } else if (promise.verdict === 'DENIED') {
      return `نجم رب حصہ کی ذیلی رب (${stl}) منفی گھر کو ظاہر کرتا ہے۔ اوریکل کہتا ہے: نہیں، راستہ بند ہے۔`;
    } else {
      return `نجم رب حصہ کی ذیلی رب (${stl}) وعدے اور انکار دونوں کو نہیں چھوتا۔ اوریکل غیر واضح ہے۔`;
    }
  } else {
    // Hindi (frozen, fallback to English)
    return `The Star Lord of the Cuspal Sub-Lord (${stl}) is ${promise.verdict.toLowerCase()}.`;
  }
}

/**
 * Select remedy based on obstructing planet.
 */
export function selectRemedy(obstruction: Planet | null): RemedyRecommendation | null {
  if (!obstruction) return null;

  const remedyMap: Record<Planet, RemedyRecommendation> = {
    Sun: {
      type: 'surya-namaskar',
      description: 'Practice Sun Salutation (Surya Namaskar) to invoke solar authority and clarity.',
      duration: '108 repetitions daily for 40 days',
    },
    Moon: {
      type: 'dua',
      description: 'Recite a dua seeking emotional clarity and peace.',
      duration: '21 days, preferably at night',
    },
    Mars: {
      type: 'sadaqa',
      description: 'Give charity to the needy (sadaqa) to pacify Mars.',
      duration: 'Tuesday mornings, for 40 days',
    },
    Mercury: {
      type: 'mantra',
      description: 'Recite the Mercury mantra or dhikr for clarity and intellect.',
      duration: '40 days, morning and evening',
    },
    Jupiter: {
      type: 'salawat',
      description: 'Recite Salawat (blessings upon the Prophet) to invoke Jupiterian grace.',
      duration: 'Daily, preferably after prayers',
    },
    Venus: {
      type: 'istikhara',
      description: 'Perform Istikhara to seek divine guidance on matters of desire.',
      duration: 'Once per night for 7 nights',
    },
    Saturn: {
      type: 'fasting',
      description: 'Fast (sawm) on Saturdays to strengthen patience and resolve.',
      duration: '40 Saturdays or 12 consecutive weeks',
    },
    Rahu: {
      type: 'mantra',
      description: 'Recite Rahu mantra or protective dhikr to manage shadow effects.',
      duration: '40 days, morning and evening',
    },
    Ketu: {
      type: 'meditation',
      description: 'Practice spiritual meditation to transcend material obstacles (Ketu).',
      duration: '40 days, daily practice',
    },
  };

  return remedyMap[obstruction] || null;
}

/**
 * Compose timing narration from transit windows.
 */
export function composeTimingNarration(
  timing: TransitTriggerResult,
  lang: 'en' | 'ur' | 'hi',
): string | null {
  if (!timing.sunWindow && !timing.moonWindow && !timing.lagnaWindow) {
    return null;
  }

  if (lang === 'en') {
    const parts: string[] = [];
    if (timing.sunWindow) {
      parts.push(`Sun enters the target star from ${timing.sunWindow.startTimeIso} to ${timing.sunWindow.endTimeIso}.`);
    }
    if (timing.moonWindow) {
      parts.push(`Moon enters the target star from ${timing.moonWindow.startTimeIso} to ${timing.moonWindow.endTimeIso}.`);
    }
    if (timing.lagnaWindow) {
      parts.push(`Lagna enters the target star from ${timing.lagnaWindow.startTimeIso} to ${timing.lagnaWindow.endTimeIso}.`);
    }
    return parts.join(' ');
  } else if (lang === 'ur') {
    const parts: string[] = [];
    if (timing.sunWindow) {
      parts.push(`سورج ${timing.sunWindow.startTimeIso} سے ${timing.sunWindow.endTimeIso} تک ہدف کے ستارے میں داخل ہ��تا ہے۔`);
    }
    if (timing.moonWindow) {
      parts.push(`چاند ${timing.moonWindow.startTimeIso} سے ${timing.moonWindow.endTimeIso} تک ہدف کے ستارے میں داخل ہوتا ہے۔`);
    }
    if (timing.lagnaWindow) {
      parts.push(`لگنا ${timing.lagnaWindow.startTimeIso} سے ${timing.lagnaWindow.endTimeIso} تک ہدف کے ستارے میں داخل ہوتا ہے۔`);
    }
    return parts.join(' ');
  } else {
    return 'Timing information is available (Hindi translation pending).';
  }
}

/**
 * Compose full Shamsi verdict narration.
 */
export function composeShamsiNarration(
  verdict: ShamsiVerdict,
  timing: TransitTriggerResult | null,
  questionType: ShamsiQuestionType,
  lang: 'en' | 'ur' | 'hi' = 'en',
): ShamsiNarration {
  const promiseText = composePromiseNarration(verdict.promise, questionType, lang);
  const timingText = timing ? composeTimingNarration(timing, lang) : null;

  // Determine obstructing planet (if DENIED)
  let obstructingPlanet: Planet | null = null;
  if (verdict.promise.verdict === 'DENIED') {
    obstructingPlanet = verdict.promise.starLordOfCSL;
  }

  const remedy = selectRemedy(obstructingPlanet);

  return {
    verdict: promiseText,
    reasoning: `Cuspal Sub-Lord: ${verdict.promise.cuspalSubLord}, Star Lord: ${verdict.promise.starLordOfCSL}`,
    remedy,
    timing: timingText,
  };
}
