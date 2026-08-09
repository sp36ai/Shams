/**
 * askWatchOracle — the Digital Watch Oracle callable, and the app's sole
 * oracle entry point.
 *
 * Security + delivery pipeline:
 *   1. Firebase App Check  — enforced by runtime
 *   2. Firebase Auth       — request.auth UID verified by the runtime
 *   3. Input validation    — Zod, strict
 *   4. Rate limit          — shared limiter, per user
 *   5. Quota check         — claimQuotaSlot(), the same ledger every oracle
 *                            reading has ever used, so a watch reading costs
 *                            exactly what a reading always has
 *   6. Build watch chart   — server-side; the APK still contains zero engine
 *   7. Classify question   — shared keyword matcher
 *   8. Judge               — RKP watch judgment (src/astrology/rkp/)
 *   9. Oracle voice        — Claude prose synthesis, same voice layer the
 *                            app has always spoken in (see oracleVoice.ts)
 *  10. Persist reading     — /readings/{id}
 *  11. Audit log           — no PII
 *
 * WHY THERE IS NO lat/lon
 *   The watch frame replaces the house cusps, and planetary positions are
 *   apparent geocentric — identical for every observer at a given instant. So
 *   this reading needs no location at all, which is what lets it run the
 *   moment the app opens with nothing asked of the querent.
 *
 * WHERE THE MINUTE COMES FROM — read before changing
 *   The mechanism is the querent's watch face, so the selecting minute must be
 *   THEIR local wall-clock minute. This server runs in UTC, so it cannot read
 *   that from its own clock: at 11:13 in Srinagar the server's UTC minute is
 *   43, which selects a different bracket entirely.
 *
 *   The split is deliberate:
 *     - the INSTANT is the server's own `Date.now()`, never client-supplied,
 *       so a querent cannot replay or hand-pick a moment to re-roll a reading;
 *     - the OFFSET is client-asserted, because only the device knows which
 *       zone its owner is standing in.
 *
 *   That means a determined caller could assert a false offset to land in a
 *   chosen bracket. This is accepted, not overlooked: the offset selects the
 *   querent's own frame and nobody else's, the quota is still charged, and no
 *   privilege boundary is crossed. It is stated here so nobody later mistakes
 *   the offset for a trusted value.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { enforceRateLimit } from '../middleware/rateLimit';
import { parse, AskWatchOracleSchema } from '../middleware/validate';
import { measure } from '../middleware/telemetry';
import { logger, hashText } from '../utils/logger';
import { requestMetaFromCallable } from '../utils/requestMeta';
import { localIsoFromOffset } from '../utils/localTime';
import { ORACLE_FUNCTION_OPTS, ANTHROPIC_API_KEY } from '../config';
import { claimQuotaSlot } from './quotaSlot';
import { synthesiseOracleVoice, ORACLE_FALLBACK } from './oracleVoice';
import { runSafetyValidator } from './safetyValidator';
import { getManzila, getManzilaOracleLine } from '../engine/manazil';
import type { AuditLogDoc, ReadingDoc, OracleResponse, VerdictKind } from '../types';

/* eslint-disable @typescript-eslint/no-var-requires */
const { buildWatchChart } =
  require('../engine/rkp/watchChart') as typeof import('../engine/rkp/watchChart');
const { judgeWatchChart } =
  require('../engine/rkp/watchJudgment') as typeof import('../engine/rkp/watchJudgment');
const { classifyQuestion } =
  require('../engine/rules/questionKeywords') as typeof import('../engine/rules/questionKeywords');
/* eslint-enable @typescript-eslint/no-var-requires */

import type { WatchState, WatchVerdict } from '../engine/rkp/watchJudgment';

/**
 * The six watch states expressed in the app's existing verdict vocabulary, so
 * a watch reading files into the same history and filters as any other.
 *
 * MOVING and REVERSING both land on CONDITIONAL: each says yes with a
 * qualification attached, which is precisely what CONDITIONAL means here.
 */
const STATE_TO_VERDICT: Readonly<Record<WatchState, VerdictKind>> = Object.freeze({
  FULFILLED: 'YES',
  MOVING: 'CONDITIONAL',
  DELAYED: 'DELAYED',
  BLOCKED: 'NO',
  REVERSING: 'CONDITIONAL',
  UNFORMED: 'UNCLEAR',
});

/** Confidence band as a 0–1 number, for the shared reading document. */
const CONFIDENCE_NUMERIC: Readonly<Record<WatchVerdict['confidence'], number>> = Object.freeze({
  VERY_HIGH: 0.95,
  HIGH: 0.8,
  MODERATE: 0.6,
  LOW: 0.4,
  UNCERTAIN: 0.2,
});

/**
 * Buckets the watch engine's day-precision timing window into the coarser
 * days/weeks/months/years vocabulary the oracle voice prompt and the rest of
 * the app already speak in.
 */
function bucketTiming(
  timing: WatchVerdict['timing'],
): { window: 'days' | 'weeks' | 'months'; range: { min: number; max: number } } | undefined {
  if (timing === null) {
    return undefined;
  }
  const { minDays, maxDays } = timing;
  if (maxDays <= 14) {
    return { window: 'days', range: { min: minDays, max: maxDays } };
  }
  if (maxDays <= 60) {
    return {
      window: 'weeks',
      range: { min: Math.round(minDays / 7), max: Math.round(maxDays / 7) },
    };
  }
  return {
    window: 'months',
    range: { min: Math.round(minDays / 30), max: Math.round(maxDays / 30) },
  };
}

export interface WatchOracleResponse {
  readingId: string;
  /** Server instant the reading was computed at, UTC. */
  computedAt: string;
  /** The querent's local moment, as used for bracket selection. */
  localMoment: string;
  window: { startMinute: number; endMinute: number; minute: number };
  lagnaSignName: string;
  lagnaRulerName: string;
  verdict: WatchVerdict;
  quotaRemaining: number | null;
  /** al-Qamar's Arabic lunar mansion at the chart moment — display only. */
  manzila: OracleResponse['manzila'];
  /** Oracle voice (Claude prose synthesis) — same layer every reading gets. */
  oracle: OracleResponse['oracle'];
}

/* -------------------------------------------------------------------------- */
/*  Callable                                                                  */
/* -------------------------------------------------------------------------- */

export const askWatchOracle = onCall(
  {
    ...ORACLE_FUNCTION_OPTS,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request): Promise<WatchOracleResponse> => {
    const startedAt = Date.now();
    const requestMeta = requestMetaFromCallable(request);
    const { userId } = verifyAuth(request);

    return measure('askWatchOracle', userId, async () => {
      const input = parse(AskWatchOracleSchema, request.data);

      await enforceRateLimit(userId);

      // Costs the same as any oracle reading has always cost — same ledger.
      const { plan, remaining } = await claimQuotaSlot(userId);

      // Instant is ours; only the zone comes from the caller.
      const instant = new Date();
      const localMoment = localIsoFromOffset(instant, input.utcOffsetMinutes);

      const chart = buildWatchChart(localMoment);
      const qType = classifyQuestion(input.question);
      const verdict = judgeWatchChart(chart, qType);

      const readingRef = db.collection('readings').doc();
      const narration = verdict.factors.join(' ');
      const readingDoc: Omit<ReadingDoc, 'createdAt'> = {
        userId,
        question: input.question,
        questionLang: input.questionLang,
        category: qType,
        verdict: STATE_TO_VERDICT[verdict.state],
        confidence: CONFIDENCE_NUMERIC[verdict.confidence],
        narration: {
          en: narration,
          ur: narration,
          hi: narration,
        },
        remedy: null,
        reasoning: verdict.factors.map((description, i) => ({
          ruleId: `rkp.watch.${i + 1}`,
          description,
          weight: 1,
        })),
      };

      await readingRef.set({
        ...readingDoc,
        createdAt: new Date(),
      });

      const audit: Omit<AuditLogDoc, 'ts'> = {
        userId,
        action: 'oracle_computed',
        questionHash: hashText(input.question),
        verdict: STATE_TO_VERDICT[verdict.state],
        plan,
        source: requestMeta.source,
        ipAddress: requestMeta.ipAddress,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
      };
      try {
        await db.collection('auditLogs').add({ ...audit, ts: new Date() });
      } catch (err) {
        logger.warn('askWatchOracle: audit log write failed', { err: String(err) });
      }

      // ── Oracle voice synthesis — same Claude layer every reading has had ──
      const moonLongitude = (chart.planets.Moon.sign - 1) * 30 + chart.planets.Moon.degreeInSign;
      const manzila = getManzila(moonLongitude);
      const verdictBinary =
        STATE_TO_VERDICT[verdict.state] === 'YES' ||
        STATE_TO_VERDICT[verdict.state] === 'CONDITIONAL'
          ? 'CONFIRMED'
          : 'DENIED';
      const manzilaLine = getManzilaOracleLine(moonLongitude, verdictBinary);
      const bucketedTiming = bucketTiming(verdict.timing);
      const confidenceNumeric = Math.round(CONFIDENCE_NUMERIC[verdict.confidence] * 100);

      const apiKey = ANTHROPIC_API_KEY.value();
      const oracleRaw = apiKey
        ? await synthesiseOracleVoice({
            verdict: STATE_TO_VERDICT[verdict.state],
            confidence: confidenceNumeric,
            timingWindow: bucketedTiming?.window,
            timingRange: bucketedTiming?.range,
            manzilaLine,
            seekerProfile: input.seekerProfile,
            apiKey,
            seekerName: input.seekerName,
            motherName: input.motherName,
          })
        : ORACLE_FALLBACK;

      const oracle = apiKey
        ? await runSafetyValidator(oracleRaw, readingRef.id, apiKey)
        : oracleRaw;

      return {
        readingId: readingRef.id,
        computedAt: instant.toISOString(),
        localMoment,
        window: {
          startMinute: chart.window.startMinute,
          endMinute: chart.window.endMinute,
          minute: chart.window.minute,
        },
        lagnaSignName: chart.lagnaSignName,
        lagnaRulerName: chart.planets[chart.lagnaRuler].name,
        verdict,
        quotaRemaining: remaining,
        manzila: {
          number: manzila.number,
          name: manzila.name,
          arabic: manzila.arabic,
          nature: manzila.nature,
          element: manzila.element,
          oracleDescriptor: manzila.oracleDescriptor,
        },
        oracle,
      };
    }).catch(err => {
      const code = err instanceof HttpsError ? err.code : 'internal';

      logger.error('askWatchOracle unexpected error', {
        userId,
        code,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        durationMs: Date.now() - startedAt,
        ipHash: requestMeta.ipHash,
      });

      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError(
        'internal',
        'The oracle could not complete this reading. Please try again.',
      );
    });
  },
);
