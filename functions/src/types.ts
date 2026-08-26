/**
 * Public-facing types — what the functions return to the client.
 *
 * IMPORTANT: these deliberately do NOT include the full Chart or Verdict
 * objects. Returning raw chart data or the complete reasoning chain would
 * expose the engine internals. Only the minimal set of fields needed to
 * render the UI is returned.
 */

import type { PlanTier } from './config';

export type VerdictKind =
  | 'YES'
  | 'NO'
  | 'CONDITIONAL'
  | 'DELAYED'
  | 'UNCLEAR'
  | 'PENDING'
  | 'DENIED';
export type LangCode = 'en' | 'ur' | 'hi';

/**
 * The three reading-persistence field shapes below (`ReadingTiming`,
 * `ReadingRemedy`, `ReadingReasoningStep`) are what `ReadingDoc` actually
 * needs. They used to be extracted from a much larger `OracleResponse`
 * interface — the full return-value contract of the deleted `askOracle`
 * KP/Astronomical Cloud Function (cusp sub-lords, 5 ruling planets,
 * significator sets, horary number, chart-wheel geometry, Claude synthesis
 * shape, …). Nothing in the current codebase produces that response
 * anymore — the live callable is `askWatchOracle`, whose own
 * `WatchOracleResponse` (see functions/src/functions/askWatchOracle.ts) is
 * the sole response contract in production — so the dead interface was
 * removed rather than carried forward. Pre-migration Firestore documents
 * that still have the old fields (`cuspSubLords`, `rulingPlanets`, etc.)
 * are untouched; nothing here reads them back for display, so no migration
 * is required.
 */
export interface ReadingTiming {
  window: 'days' | 'weeks' | 'months' | 'years';
  range: { min: number; max: number };
}

export interface ReadingRemedy {
  planet: string;
  action: string;
  avoid: string;
  zikr?: string;
  charity?: string;
}

export interface ReadingReasoningStep {
  ruleId: string;
  description: string;
  weight: number;
}

/** Response from getQuota. */
export interface QuotaResponse {
  plan: PlanTier;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
  dayKey: string; // "YYYY-MM-DD" (UTC day)
  planExpiry: string | null; // ISO 8601 or null for free/no expiry
}

/** Firestore /quotas/{userId} document shape. */
export interface QuotaDoc {
  dayKey: string;
  used: number;
  plan: PlanTier;
  planExpiry: string | null;
  updatedAt: FirebaseFirestore.Timestamp;
}

/** Firestore /readings/{readingId} document shape. */
export interface ReadingDoc {
  userId: string;
  question: string; // stored server-side; not returned to client via getReading
  questionLang: LangCode;
  category: string;
  verdict: VerdictKind;
  confidence: number;
  narration: Record<LangCode, string>;
  timing?: ReadingTiming;
  remedy: ReadingRemedy | null;
  reasoning: ReadingReasoningStep[];
  createdAt: FirebaseFirestore.Timestamp;
  horaryNumber?: number;
}

/** Firestore /trials/{userId} document shape. */
export interface TrialDoc {
  userId: string;
  startedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601 — startedAt + TRIAL_DURATION_DAYS
}

/** Firestore /auditLogs/{logId} document shape. */
export interface AuditLogDoc {
  userId: string;
  action: AuditAction;
  questionHash?: string; // FNV-1a of question text — never raw text
  verdict?: VerdictKind;
  plan?: PlanTier;
  source?: 'callable' | 'http';
  ipAddress?: string;
  ipHash?: string; // SHA-256 hash prefix of caller IP, never raw IP
  userAgent?: string;
  durationMs?: number;
  ts: FirebaseFirestore.Timestamp;
}

export type AuditAction =
  | 'oracle_computed'
  | 'quota_exhausted'
  | 'rate_limited'
  | 'auth_failed'
  | 'payment_razorpay_ok'
  | 'payment_razorpay_fail'
  | 'payment_play_ok'
  | 'payment_play_fail'
  | 'plan_upgraded'
  | 'reading_synced'
  | 'reading_deleted';
