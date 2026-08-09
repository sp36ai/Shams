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

/** Response from askWatchOracle (the oracle field + shared display fields). */
export interface OracleResponse {
  readingId: string;
  verdict: VerdictKind;
  confidence: number; // 0-100
  category: string; // question type, e.g. "career"
  narration: Record<LangCode, string>;
  timing?: {
    window: 'days' | 'weeks' | 'months' | 'years';
    range: { min: number; max: number };
  };
  remedy?: {
    planet: string;
    action: string;
    avoid: string;
    zikr?: string;
    charity?: string;
  };
  reasoning: Array<{
    ruleId: string;
    description: string;
    weight: number;
  }>;
  quotaRemaining: number | null; // null = unlimited plan
  computedAt: string; // ISO 8601

  /** al-Qamar's Arabic lunar mansion at the chart moment — display only. */
  manzila?: {
    number: number;
    name: string;
    arabic: string;
    nature: 'benefic' | 'malefic' | 'mixed';
    element: 'fire' | 'earth' | 'air' | 'water';
    oracleDescriptor: string;
  };

  // ── Oracle voice (Claude synthesis layer) ─────────────────────────────────
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
  timing?: OracleResponse['timing'];
  remedy: OracleResponse['remedy'] | null;
  reasoning: OracleResponse['reasoning'];
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
