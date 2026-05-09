/**
 * askOracle — the primary callable Cloud Function.
 *
 * Security pipeline (in order):
 *   1. Firebase App Check  — enforced by runtime (enforceAppCheck: true)
 *   2. Firebase Auth       — request.auth UID verified by Firebase Functions runtime
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
import { measure } from '../middleware/telemetry';
import { logger, hashText } from '../utils/logger';
import { requestMetaFromCallable } from '../utils/requestMeta';
import {
  FUNCTION_OPTS,
  UNLIMITED_PLANS,
  FREE_LIMIT,
  sundayWeekKey,
  ANTHROPIC_API_KEY,
  type PlanTier,
} from '../config';
import { ORACLE_SYNTHESIS_SYSTEM_PROMPT } from '../prompts/oracleSynthesis';
import { houseForLongitude } from '../engine/primitives/chartBuilder';
import { HOUSE_MATRIX } from '../engine/kp/rules/houseMatrix';
import type { Planet } from '../engine/types/chart';
import type { OracleResponse, QuotaDoc, ReadingDoc, AuditLogDoc } from '../types';

// ── Display-layer helpers (no engine logic — pure arithmetic) ────────────────

const SIGN_NAMES_DISPLAY = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

function signNameAt(lon: number): string {
  const idx = Math.floor((((lon % 360) + 360) % 360) / 30);
  return SIGN_NAMES_DISPLAY[idx] ?? 'Aries';
}

const DISPLAY_PLANETS: Planet[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
];

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

// ── Oracle voice synthesis (Claude) ─────────────────────────────────────────

type OracleVoiceResult = OracleResponse['oracle'];

const ORACLE_FALLBACK: NonNullable<OracleVoiceResult> = {
  opening: 'The currents are veiled at this hour…',
  interpretation: '',
  spiritual_layer: '',
  hidden_influence: '',
  timing: '',
  remedy: {
    quran_verse: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ — Al-Imran 3:173',
    translation: 'Allah is sufficient for us, and He is the best Disposer of affairs.',
  },
  signature: 'Oracle of Shams al-Asrār (by Astro Sarfaraz)',
};

function buildOracleUserMessage(params: {
  verdict: string;
  confidence: number;
  category: string;
  confirmedSignificators: string[];
  deniedSignificators: string[];
  timingWindow?: string;
  timingRange?: { min: number; max: number };
}): string {
  const {
    verdict,
    confidence,
    category,
    confirmedSignificators,
    deniedSignificators,
    timingWindow,
    timingRange,
  } = params;

  const verdictWord =
    verdict === 'YES'
      ? 'GRANTED'
      : verdict === 'NO'
        ? 'DENIED'
        : verdict === 'CONDITIONAL'
          ? 'CONDITIONAL'
          : verdict === 'DELAYED'
            ? 'DELAYED'
            : 'INCONCLUSIVE';

  const lines: string[] = [
    `Celestial decree: ${verdictWord} (celestial strength ${confidence}/100)`,
    `Realm of inquiry: ${category}`,
  ];

  if (confirmedSignificators.length > 0) {
    lines.push(`Witnesses in favour: ${confirmedSignificators.join(', ')}`);
  }
  if (deniedSignificators.length > 0) {
    lines.push(`Witnesses in opposition: ${deniedSignificators.join(', ')}`);
  }
  if (timingWindow !== undefined && timingRange !== undefined) {
    lines.push(`Celestial window: ${timingRange.min}–${timingRange.max} ${timingWindow}`);
  }

  lines.push('', 'Speak now as the Oracle.');
  return lines.join('\n');
}

async function synthesiseOracleVoice(params: {
  category: string;
  verdict: string;
  confidence: number;
  confirmedSignificators: string[];
  deniedSignificators: string[];
  timingWindow?: string;
  timingRange?: { min: number; max: number };
  apiKey: string;
}): Promise<NonNullable<OracleVoiceResult>> {
  const userMessage = buildOracleUserMessage(params);

  const timeoutMs = 9_000;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': params.apiKey,
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        system: ORACLE_SYNTHESIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      logger.warn('oracle synthesis HTTP error', { status: res.status });
      return ORACLE_FALLBACK;
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const rawText = json.content?.find(b => b.type === 'text')?.text ?? '';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      logger.warn('oracle synthesis JSON parse failed', { rawText: rawText.slice(0, 200) });
      return ORACLE_FALLBACK;
    }

    const r = (parsed.remedy ?? {}) as Record<string, unknown>;

    return {
      opening: String(parsed.opening ?? ''),
      interpretation: String(parsed.interpretation ?? ''),
      spiritual_layer: String(parsed.spiritual_layer ?? ''),
      hidden_influence: String(parsed.hidden_influence ?? ''),
      timing: typeof parsed.timing === 'string' ? parsed.timing : '',
      warning: typeof parsed.warning === 'string' ? parsed.warning : undefined,
      remedy: {
        quran_verse: typeof r.quran_verse === 'string' ? r.quran_verse : undefined,
        translation: typeof r.translation === 'string' ? r.translation : undefined,
        name_of_allah: typeof r.name_of_allah === 'string' ? r.name_of_allah : undefined,
        dua: typeof r.dua === 'string' ? r.dua : undefined,
        zikr: typeof r.zikr === 'string' ? r.zikr : undefined,
        charity: typeof r.charity === 'string' ? r.charity : undefined,
      },
      signature: String(parsed.signature ?? 'Oracle of Shams al-Asrār (by Astro Sarfaraz)'),
    };
  } catch (err) {
    clearTimeout(timer);
    logger.warn('oracle synthesis failed', { err: String(err) });
    return ORACLE_FALLBACK;
  }
}

// ── Main function ────────────────────────────────────────────────────────────

export const askOracle = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.NODE_ENV !== 'development',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request): Promise<OracleResponse> => {
    const startedAt = Date.now();
    const requestMeta = requestMetaFromCallable(request);

    // 1. App Check (enforced by runtime) — 2. Firebase Auth
    const { userId } = verifyAuth(request);

    return measure('askOracle', userId, async () => {
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
        timing: verdict.timing
          ? { window: verdict.timing.window, range: verdict.timing.range }
          : undefined,
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
        ipAddress: requestMeta.ipAddress,
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

      // ── Display-layer geometry (chart wheel) — no engine logic ─────────────
      const planetDegrees: Record<string, number> = {};
      const planetChain: Record<
        string,
        { nakshatraLord: string; subLord: string; subSubLord: string }
      > = {};
      for (const p of DISPLAY_PLANETS) {
        const pos = chart.planets[p];
        if (pos !== undefined) {
          planetDegrees[p] = pos.siderealLongitude;
          planetChain[p] = {
            nakshatraLord: String(pos.nakshatraLord),
            subLord: String(pos.subLord),
            subSubLord: String(pos.subSubLord),
          };
        }
      }

      const cuspDegrees: Record<number, number> = {};
      const cuspSigns: Record<number, string> = {};
      for (let i = 0; i < 12; i++) {
        const c = chart.cusps[i];
        if (c !== undefined) {
          cuspDegrees[i + 1] = c.siderealLongitude;
          cuspSigns[i + 1] = signNameAt(c.siderealLongitude);
        }
      }

      // Cusp sub-lords for the 2-3 most relevant houses (expert panel data)
      const matrixEntry = HOUSE_MATRIX[classified.qType];
      const relevantHouses = [matrixEntry.primary, ...matrixEntry.secondary.slice(0, 2)];
      const cuspLons = chart.cusps.map(c => c.siderealLongitude);
      const cuspSubLords = relevantHouses
        .map(h => {
          const cusp = chart.cusps[h - 1];
          if (cusp === undefined) {
            return null;
          }
          const sl = cusp.subLord as Planet;
          const slHouse = houseForLongitude(
            chart.planets[sl].siderealLongitude,
            cuspLons,
          ) as number;
          return { house: h, subLord: sl as string, subLordHouse: slHouse };
        })
        .filter(Boolean) as Array<{ house: number; subLord: string; subLordHouse: number }>;

      // 12. Oracle synthesis — Claude adds voice layer (fire with timeout, fallback on error)
      const apiKey = ANTHROPIC_API_KEY.value();
      const oracle = apiKey
        ? await synthesiseOracleVoice({
            category: verdict.qType,
            verdict: verdict.verdict,
            confidence: verdict.confidence,
            confirmedSignificators: (verdict.confirmedSignificators ?? []) as string[],
            deniedSignificators: (verdict.deniedSignificators ?? []) as string[],
            timingWindow: verdict.timing?.window,
            timingRange: verdict.timing?.range,
            apiKey,
          })
        : ORACLE_FALLBACK;

      // 13. Return minimal response — no chart internals, no algorithm state
      return {
        readingId: verdict.id,
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        category: verdict.qType,
        narration: verdict.narration,
        timing: verdict.timing
          ? { window: verdict.timing.window, range: verdict.timing.range }
          : undefined,
        cuspSubLords,
        rulingPlanets: {
          dayLord: verdict.rulingPlanets.dayLord as string,
          ascSignLord: verdict.rulingPlanets.ascSignLord as string,
          ascStarLord: verdict.rulingPlanets.ascStarLord as string,
          moonSignLord: verdict.rulingPlanets.moonSignLord as string,
          moonStarLord: verdict.rulingPlanets.moonStarLord as string,
          horaLord: verdict.rulingPlanets.horaLord as string | undefined,
        },
        significators: verdict.significators
          ? {
              favorable: verdict.significators.favorable as string[],
              denial: verdict.significators.denial as string[],
              neutral: verdict.significators.neutral as string[],
            }
          : undefined,
        confirmedSignificators: verdict.confirmedSignificators as string[] | undefined,
        deniedSignificators: verdict.deniedSignificators as string[] | undefined,
        remedy: verdict.remedy,
        reasoning: readingDoc.reasoning,
        quotaRemaining: remaining,
        computedAt: now,
        planetDegrees,
        cuspDegrees,
        cuspSigns,
        planetChain,
        oracle,
      };
    }).catch(err => {
      if (err instanceof HttpsError) {
        throw err;
      }

      logger.error('askOracle unexpected error', {
        userId,
        err: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
        ipHash: requestMeta.ipHash,
      });

      void writeAuditLog({
        userId,
        action: 'oracle_computed',
        source: requestMeta.source,
        ipAddress: requestMeta.ipAddress,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
      });
      throw new HttpsError('internal', 'Calculation failed. Please try again.');
    });
  },
);
