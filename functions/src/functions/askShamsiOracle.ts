/**
 * askShamsiOracle Cloud Function
 * 
 * Executes full Shamsi Logic pipeline (Phases 1-4) for horary questions
 * requiring real location-based Placidus house calculations.
 * 
 * Phases:
 * 1. Promise Check (CSL → StL verification)
 * 2. Significator Grading (A-D ranks, with Untenanted Planet Rule)
 * 3. Time-Window Narrowing (DBA + 5 Ruling Planets filter)
 * 4. Transit Trigger (Sun/Moon/Lagna timing based on event timeline)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { buildChart } from '../engine/primitives/chartBuilder';
import {
  judgeShamsiLogic,
  resolveTransitTrigger,
  createEphemerisAdapter,
  resolveKPCoordinates,
  EventTimeline,
} from '../engine/rkp/shamsiLogic';
import { composeShamsiNarration } from '../engine/rkp/shamsiNarration';
import { parse, AskShamsiOracleSchema, type AskShamsiOracleInput } from '../middleware/validateShamsi';
import { enforceAppCheck } from '../utils/appCheck';
import { getQuotaForUser, deductQuota } from '../utils/quota';
import type { ShamsiQuestionType } from '../engine/rkp/shamsiHouseMatrix';
import { classifyQuestionAsType } from '../utils/classification';

export interface AskShamsiOracleResult {
  readingId: string;
  computedAt: string;
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  latitude: number;
  longitude: number;
  verdict: {
    promise: string;
    grade: string;
    operative: string[];
  };
  timing: {
    sun: { startTime: string; endTime: string } | null;
    moon: { startTime: string; endTime: string } | null;
    lagna: { startTime: string; endTime: string } | null;
  } | null;
  narration: string;
  remedy: {
    type: string;
    description: string;
    duration: string | null;
  } | null;
  quotaRemaining: number | null;
}

export const askShamsiOracle = onCall(
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async (request): Promise<AskShamsiOracleResult> => {
    // 1. Enforce authentication
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }

    // 2. Validate input
    const input = parse(AskShamsiOracleSchema, request.data) as AskShamsiOracleInput;
    const { question, questionLang, latitude, longitude, eventTimeline } = input;

    // 3. Check quota
    const quota = await getQuotaForUser(uid);
    if (quota.remaining <= 0) {
      throw new HttpsError('resource-exhausted', 'Daily quota exceeded');
    }

    try {
      // 4. Classify question → get QuestionType (employment, career, marriage, etc.)
      const questionType = await classifyQuestionAsType(question, questionLang);

      // 5. Build real chart with Placidus cusps
      const now = new Date();
      const chart = buildChart(now.toISOString(), latitude, longitude);

      // 6. Run Phases 1-3: Promise → Grades → Time Window
      const verdict = judgeShamsiLogic(chart, questionType as ShamsiQuestionType);

      // 7. Run Phase 4: Transit Trigger (if PROMISED)
      let timing = null;
      if (verdict.promise.verdict === 'PROMISED') {
        const timeline = eventTimeline === 'macro' ? EventTimeline.MACRO : EventTimeline.MICRO;
        timing = resolveTransitTrigger(
          chart,
          verdict.timeWindow,
          timeline,
          createEphemerisAdapter(latitude, longitude),
          resolveKPCoordinates,
        );
      }

      // 8. Compose narration + remedy
      const narration = composeShamsiNarration(
        verdict,
        timing || undefined,
        questionType as ShamsiQuestionType,
        questionLang,
      );

      // 9. Format operative planets for response
      const operativePlanets = verdict.timeWindow.operative.map(
        op => `${op.planet} (${op.dbaRole}, Grade ${op.grade || 'N/A'})`,
      );

      // 10. Generate reading ID and store (pseudo-code; actual store logic varies)
      const readingId = `reading_${uid}_${Date.now()}`;
      // await storeReading(uid, { readingId, question, verdict, narration, computedAt: now });

      // 11. Deduct quota
      await deductQuota(uid, 1);
      const quotaAfter = quota.remaining - 1;

      return {
        readingId,
        computedAt: now.toISOString(),
        question,
        questionLang,
        latitude,
        longitude,
        verdict: {
          promise: verdict.promise.verdict,
          grade: operativePlanets.length > 0 ? operativePlanets[0].split(' ')[1] || 'N/A' : 'N/A',
          operative: operativePlanets,
        },
        timing: timing
          ? {
              sun: timing.sunWindow
                ? {
                    startTime: timing.sunWindow.startTimeIso,
                    endTime: timing.sunWindow.endTimeIso,
                  }
                : null,
              moon: timing.moonWindow
                ? {
                    startTime: timing.moonWindow.startTimeIso,
                    endTime: timing.moonWindow.endTimeIso,
                  }
                : null,
              lagna: timing.lagnaWindow
                ? {
                    startTime: timing.lagnaWindow.startTimeIso,
                    endTime: timing.lagnaWindow.endTimeIso,
                  }
                : null,
            }
          : null,
        narration: narration.verdict,
        remedy: narration.remedy,
        quotaRemaining: quotaAfter,
      };
    } catch (err) {
      console.error('askShamsiOracle error:', err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Oracle computation failed');
    }
  },
);
