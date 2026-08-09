/**
 * askWatchOracle — the Digital Watch Oracle callable.
 *
 * Sibling of askOracle. Same security pipeline, same quota, different engine:
 *   1. Firebase App Check  — enforced by runtime
 *   2. Firebase Auth       — request.auth UID verified by the runtime
 *   3. Input validation    — Zod, strict
 *   4. Rate limit          — shared limiter, per user
 *   5. Quota check         — claimQuotaSlot(), the SAME helper askOracle uses,
 *                            so a watch reading costs exactly what an
 *                            astronomical one costs. No free side door.
 *   6. Build watch chart   — server-side; the APK still contains zero engine
 *   7. Classify question   — shared keyword matcher
 *   8. Judge               — RKP watch judgment
 *   9. Persist reading     — /readings/{id}, so watch readings appear in the
 *                            same history as astronomical ones
 *  10. Audit log           — no PII
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

import { onCall } from 'firebase-functions/v2/https';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { enforceRateLimit } from '../middleware/rateLimit';
import { parse, AskWatchOracleSchema } from '../middleware/validate';
import { measure } from '../middleware/telemetry';
import { logger, hashText } from '../utils/logger';
import { localIsoFromOffset } from '../utils/localTime';
import { toBoundaryPlanetName } from '../utils/planetBoundaryName';
import { ORACLE_FUNCTION_OPTS, ANTHROPIC_API_KEY } from '../config';
import { claimQuotaSlot } from './askOracle';
import type { AuditLogDoc, ReadingDoc } from '../types';
import type { VerdictKind } from '../engine/types/verdict';

/* eslint-disable @typescript-eslint/no-var-requires */
const { buildWatchChart } =
  require('../engine/rkp/watchChart') as typeof import('../engine/rkp/watchChart');
const { judgeWatchChart } =
  require('../engine/rkp/watchJudgment') as typeof import('../engine/rkp/watchJudgment');
const { classifyQuestion } =
  require('../engine/kp/rules/questionKeywords') as typeof import('../engine/kp/rules/questionKeywords');
const { composeWatchOracleResponse } =
  require('../oracle/responseComposer') as typeof import('../oracle/responseComposer');
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
 * WatchVerdict as it crosses the boundary to the client: `obstruction`,
 * `targetRuler` and `lagnaRuler` carry the raw internal Planet identifier
 * inside the engine, but the shadow nodes (Rahu/Ketu) are renamed to their
 * classical Arabic/Urdu short forms (Ras/Dhanab) before the response leaves
 * the server — see utils/planetBoundaryName.ts. Every other field is already
 * a plain display string (e.g. targetRulerName) and needs no translation.
 */
export type PublicWatchVerdict = Omit<
  WatchVerdict,
  'obstruction' | 'targetRuler' | 'lagnaRuler'
> & {
  obstruction: string;
  targetRuler: string;
  lagnaRuler: string;
};

export interface WatchOracleResponse {
  readingId: string;
  /** Server instant the reading was computed at, UTC. */
  computedAt: string;
  /** The querent's local moment, as used for bracket selection. */
  localMoment: string;
  window: { startMinute: number; endMinute: number; minute: number };
  lagnaSignName: string;
  lagnaRulerName: string;
  verdict: PublicWatchVerdict;
  /** The mystical oracle response in Shams al-Asrār voice. */
  oracle?: {
    opening: string;
    interpretation: string;
    spiritual_layer: string;
    signature: string;
  };
  quotaRemaining: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Callable                                                                  */
/* -------------------------------------------------------------------------- */

export const askWatchOracle = onCall(
  {
    ...ORACLE_FUNCTION_OPTS,
    // The judgment itself is pure computation, but the oracle voice is
    // synthesised by Anthropic (up to 25s) — so this needs the same headroom
    // and the same secret binding as askOracle.
    secrets: [ANTHROPIC_API_KEY],
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async (request): Promise<WatchOracleResponse> => {
    const { userId } = verifyAuth(request);

    return measure('askWatchOracle', userId, async () => {
      const input = parse(AskWatchOracleSchema, request.data);

      await enforceRateLimit(userId);

      // Costs the same as an astronomical reading — same helper, same ledger.
      const { plan, remaining } = await claimQuotaSlot(userId);

      // Instant is ours; only the zone comes from the caller.
      const instant = new Date();
      const localMoment = localIsoFromOffset(instant, input.utcOffsetMinutes);

      const chart = buildWatchChart(localMoment);
      const qType = classifyQuestion(input.question);
      const verdict = judgeWatchChart(chart, qType);

      // ── Compose mystical oracle response ─────────────────────────────────
      let oracleResponse;
      try {
        oracleResponse = await composeWatchOracleResponse({
          verdict,
          seekerName: input.seekerName,
          motherName: input.motherName,
        });
      } catch (err) {
        logger.warn('askWatchOracle: oracle composition failed', {
          err: String(err),
          userId,
        });
        // Composition failure is not fatal; proceed without oracle response
        oracleResponse = null;
      }

      const readingRef = db.collection('readings').doc();
      const narration = oracleResponse?.interpretation || verdict.factors.join(' ');
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
        // Store oracle response if composition succeeded
        ...(oracleResponse ? { oracle: oracleResponse } : {}),
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
        source: 'callable',
      };
      try {
        await db.collection('auditLogs').add({ ...audit, ts: new Date() });
      } catch (err) {
        logger.warn('askWatchOracle: audit log write failed', { err: String(err) });
      }

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
        // Shadow-node boundary mapping — obstruction/targetRuler/lagnaRuler
        // are the only raw Planet identifiers left in the verdict; everything
        // else (targetRulerName etc.) already went through nomenclature.ts.
        verdict: {
          ...verdict,
          obstruction: toBoundaryPlanetName(verdict.obstruction),
          targetRuler: toBoundaryPlanetName(verdict.targetRuler),
          lagnaRuler: toBoundaryPlanetName(verdict.lagnaRuler),
        },
        ...(oracleResponse ? { oracle: oracleResponse } : {}),
        quotaRemaining: remaining,
      };
    });
  },
);
