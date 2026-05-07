/**
 * askOracle — the primary callable Cloud Function.
 *
 * Security pipeline (in order):
 *   1. Firebase App Check  — enforced by runtime (enforceAppCheck: true)
 *   2. Supabase JWT        — verified via HS256 + JWT secret (no network call)
 *   3. Input validation    — Zod schema, strict
 *   4. Rate limit          — 10 req/min per user, Firestore transaction
 *   5. Quota check         — atomic Firestore transaction (Sunday-week rolling)
 *   6. Build chart         — server-side ephemeris (client never touches this)
 *   7. Classify question   — keyword matcher
 *   8. Judge horary        — full RKP 5-step algorithm
 *   9. Persist reading     — /readings/{id} in Firestore
 *  10. Decrement quota     — inside the same Firestore batch
 *  11. Audit log           — /auditLogs/{id}, no PII
 *  12. Return response     — minimal verdict, no engine internals
 *
 * The client ONLY sends: token, question text, lat, lon, lang.
 * The chart is NEVER built or sent by the client.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { enforceRateLimit } from '../middleware/rateLimit';
import { parse, AskOracleSchema } from '../middleware/validate';
import { logger, hashText } from '../utils/logger';
import { requestMetaFromCallable } from '../utils/requestMeta';
import {
  FUNCTION_OPTS,
  UNLIMITED_PLANS,
  FREE_LIMIT,
  sundayWeekKey,
  type PlanTier,
} from '../config';
import type { OracleResponse, QuotaDoc, ReadingDoc, AuditLogDoc } from '../types';

// Engine — populated by sync-engine.mjs at build time

const { buildChart } =
  require('../engine/primitives/chartBuilder') as typeof import('../engine/primitives/chartBuilder');

const { judgeHorary } =
  require('../engine/kp/judgment/judgeHorary') as typeof import('../engine/kp/judgment/judgeHorary');

const { classifyQuestion } =
  require('../engine/kp/rules/questionKeywords') as typeof import('../engine/kp/rules/questionKeywords');

// ── Quota helpers ────────────────────────────────────────────────────────────

/**
 * Atomically check quota and pre-decrement.
 * Returns the plan and remaining count (null = unlimited).
 * Throws resource-exhausted if quota is zero.
 */
async function claimQuotaSlot(
  userId: string,
): Promise<{ plan: PlanTier; remaining: number | null }> {
  const quotaRef = db.collection('quotas').doc(userId);

  let plan: PlanTier = 'free';
  let remaining: number | null = null;

  await db.runTransaction(async tx => {
    const snap = await tx.get(quotaRef);
    const d = snap.exists ? (snap.data() as Partial<QuotaDoc>) : {};

    plan = d.plan ?? 'free';

    // Check plan expiry
    if (plan !== 'free' && d.planExpiry) {
      const expiry = new Date(d.planExpiry).getTime();
      if (Date.now() > expiry) {
        plan = 'free';
        tx.set(quotaRef, { plan: 'free', planExpiry: null }, { merge: true });
      }
    }

    if (UNLIMITED_PLANS.includes(plan)) {
      remaining = null;
      return; // No quota to decrement for paid plans
    }

    const currentWeek = sundayWeekKey();
    const storedWeek = d.weekKey ?? '';
    const used = storedWeek === currentWeek ? (d.used ?? 0) : 0;

    if (used >= FREE_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `Weekly quota exhausted (${used}/${FREE_LIMIT}). Upgrade to continue.`,
      );
    }

    remaining = FREE_LIMIT - used - 1;
    tx.set(
      quotaRef,
      { weekKey: currentWeek, used: used + 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });

  return { plan, remaining };
}

// ── Audit log ────────────────────────────────────────────────────────────────

async function writeAuditLog(entry: Omit<AuditLogDoc, 'ts'>): Promise<void> {
  try {
    await db.collection('auditLogs').add({
      ...entry,
      ts: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error('audit log write failed', { err: String(err) });
    // Audit failures must never block the response.
  }
}

// ── Main function ────────────────────────────────────────────────────────────

export const askOracle = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.NODE_ENV !== 'development',
  },
  async (request): Promise<OracleResponse> => {
    const startedAt = Date.now();
    const requestMeta = requestMetaFromCallable(request);

    // 1 + 2. App Check (enforced by runtime) + Auth
    const { userId } = verifyAuth(request);

    try {
      // 3. Validate
      const input = parse(AskOracleSchema, request.data);

      // 4. Rate limit
      await enforceRateLimit(userId);

      // 5. Quota (atomic)
      const { plan, remaining } = await claimQuotaSlot(userId);

      // 6. Build chart server-side — client has ZERO involvement in ephemeris
      const now = new Date().toISOString();
      const chart = buildChart(now, input.lat, input.lon);

      // 7. Classify question
      const classified = {
        text: input.question,
        lang: input.questionLang as 'en' | 'ur' | 'hi',
        qType: classifyQuestion(input.question),
        confidence: 1.0,
        matchedKeywords: [] as string[],
      };

      // 8. Judge horary — proprietary RKP algorithm runs here, server-only
      const verdict = judgeHorary(chart, classified);

      // 9+10. Persist reading + quota update in a batch
      const readingRef = db.collection('readings').doc(verdict.id);
      const readingDoc: Omit<ReadingDoc, 'createdAt'> = {
        userId,
        question: input.question,
        questionLang: input.questionLang,
        category: verdict.qType,
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        narration: verdict.narration,
        timing: {
          window: verdict.timing.window,
          range: verdict.timing.range,
        },
        remedy: verdict.remedy ?? null,
        reasoning: (verdict.reasoning as typeof verdict.reasoning).map(r => ({
          ruleId: r.ruleId,
          description: r.description,
          weight: r.weight,
        })),
      };

      const batch = db.batch();
      batch.set(readingRef, { ...readingDoc, createdAt: FieldValue.serverTimestamp() });
      await batch.commit();

      // 11. Audit (fire-and-forget)
      void writeAuditLog({
        userId,
        action: 'oracle_computed',
        questionHash: hashText(input.question),
        verdict: verdict.verdict,
        plan,
        source: requestMeta.source,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
      });

      logger.info('oracle computed', {
        userId,
        verdict: verdict.verdict,
        plan,
        durationMs: Date.now() - startedAt,
        ipHash: requestMeta.ipHash,
      });

      // 12. Return minimal response — no chart internals, no algorithm state
      return {
        readingId: verdict.id,
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        category: verdict.qType,
        narration: verdict.narration,
        timing: { window: verdict.timing.window, range: verdict.timing.range },
        remedy: verdict.remedy,
        reasoning: readingDoc.reasoning,
        quotaRemaining: remaining,
        computedAt: now,
      };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }

      logger.error('askOracle unexpected error', {
        userId,
        err: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
        ipHash: requestMeta.ipHash,
      });

      await writeAuditLog({
        userId,
        action: 'oracle_computed',
        source: requestMeta.source,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
      });
      throw new HttpsError('internal', 'Calculation failed. Please try again.');
    }
  },
);
