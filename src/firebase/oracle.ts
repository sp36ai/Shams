/**
 * oracle.ts — client-side wrapper for the askOracle Cloud Function.
 *
 * The judgment engine (buildChart, judgeHorary, classifyQuestion) runs
 * exclusively on the server. This file is the ONLY place in the client that
 * talks to it. The APK contains zero engine logic.
 */

import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';
import type { Reading } from '@stores/readingsStore';

// RNFB v19 types omit .region() on the Module — it exists at runtime.
type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};

export interface AskOracleInput {
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  lat: number;
  lon: number;
  seekerProfile?: 'clarity' | 'comfort' | 'action' | 'surrender';
}

export interface AskOracleResult {
  reading: Reading;
  quotaRemaining: number | null;
}

export async function askOracle(args: AskOracleInput): Promise<AskOracleResult> {
  const functionsInstance = (functions() as FunctionsWithRegion).region('asia-south1');

  // Emulator disabled — pointing at deployed production function
  // if (__DEV__) {
  //   functionsInstance.useFunctionsEmulator('http://127.0.0.1:5001');
  //   console.log('[Oracle] Using Firebase Functions Emulator at http://127.0.0.1:5001');
  // }

  const fn = functionsInstance.httpsCallable('askOracle');

  const result = await fn({
    question: args.question,
    questionLang: args.questionLang,
    lat: args.lat,
    lon: args.lon,
    ...(args.seekerProfile !== undefined ? { seekerProfile: args.seekerProfile } : {}),
  });

  const data = result.data as {
    readingId: string;
    verdict: Reading['verdict'];
    confidence: number;
    category: string;
    narration: Record<'en' | 'ur' | 'hi', string>;
    timing?: {
      window: string;
      range: { min: number; max: number };
      activeDasha?: string;
      activeAntardasha?: string;
      activePratyantardasha?: string;
    };
    cuspSubLords?: Array<{ house: number; subLord: string; subLordHouse: number }>;
    rulingPlanets?: {
      dayLord: string;
      ascSignLord: string;
      ascStarLord: string;
      moonSignLord: string;
      moonStarLord: string;
      horaLord?: string;
    };
    significators?: { favorable: string[]; denial: string[]; neutral: string[] };
    confirmedSignificators?: string[];
    deniedSignificators?: string[];
    remedy?: {
      planet: string;
      action: string;
      avoid: string;
      mantra?: string;
      charity?: string;
    };
    reasoning: Array<{ ruleId: string; description: string; weight: number }>;
    quotaRemaining: number | null;
    computedAt: string;
    planetDegrees?: Record<string, number>;
    cuspDegrees?: Record<number, number>;
    cuspSigns?: Record<number, string>;
    planetChain?: Record<string, { manzilLord: string; subLord: string; subSubLord: string }>;
    manzila?: {
      number: number;
      name: string;
      arabic: string;
      nature: 'benefic' | 'malefic' | 'mixed';
      element: 'fire' | 'earth' | 'air' | 'water';
      oracleDescriptor: string;
    };
    oracle?: {
      opening: string;
      interpretation: string;
      spiritual_layer: string;
      hidden_influence: string;
      timing?: string | null;
      warning?: string;
      remedy: {
        quran_verse?: string;
        asma?: string;
        dua?: string;
        zikr?: string;
        sadaqah?: string;
      };
      signature: string;
    };
  };

  const reading: Reading = {
    id: data.readingId,
    question: args.question,
    questionLang: args.questionLang,
    category: data.category as Reading['category'],
    verdict: data.verdict,
    createdAt: data.computedAt,
    chartJson: {},
    verdictJson: {
      verdict: data.verdict,
      confidence: data.confidence,
      narration: data.narration,
      timing: data.timing,
      remedy: data.remedy,
      reasoning: data.reasoning,
      rulingPlanets: data.rulingPlanets,
      significators: data.significators,
      confirmedSignificators: data.confirmedSignificators,
      deniedSignificators: data.deniedSignificators,
      cuspSubLords: data.cuspSubLords,
      planetDegrees: data.planetDegrees,
      cuspDegrees: data.cuspDegrees,
      cuspSigns: data.cuspSigns,
      planetChain: data.planetChain,
      manzila: data.manzila,
      oracle: data.oracle,
    },
  };

  return { reading, quotaRemaining: data.quotaRemaining };
}
