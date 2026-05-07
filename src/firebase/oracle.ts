/**
 * oracle.ts — client-side wrapper for the askOracle Cloud Function.
 *
 * The judgment engine (buildChart, judgeHorary, classifyQuestion) runs
 * exclusively on the server. This file is the ONLY place in the client that
 * talks to it. The APK contains zero engine logic.
 */

import functions from '@react-native-firebase/functions';
import type { Reading } from '@stores/readingsStore';

export interface AskOracleInput {
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  lat: number;
  lon: number;
}

export interface AskOracleResult {
  reading: Reading;
  quotaRemaining: number | null;
}

export async function askOracle(args: AskOracleInput): Promise<AskOracleResult> {
  const fn = functions().httpsCallable('askOracle');

  const result = await fn({
    question: args.question,
    questionLang: args.questionLang,
    lat: args.lat,
    lon: args.lon,
  });

  const data = result.data as {
    readingId: string;
    verdict: Reading['verdict'];
    confidence: number;
    category: string;
    narration: Record<'en' | 'ur' | 'hi', string>;
    timing: { window: string; range: { min: number; max: number } };
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
    },
  };

  return { reading, quotaRemaining: data.quotaRemaining };
}
