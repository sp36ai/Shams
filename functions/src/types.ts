/**
 * Public-facing types — what the functions return to the client.
 *
 * IMPORTANT: these deliberately do NOT include the full Chart or Verdict
 * objects. Returning raw chart data or the complete reasoning chain would
 * expose the engine internals. Only the minimal set of fields needed to
 * render the UI is returned.
 */

import type { PlanTier } from './config';

export type VerdictKind = 'YES' | 'NO' | 'CONDITIONAL' | 'DELAYED' | 'UNCLEAR' | 'PENDING';
export type LangCode = 'en' | 'ur' | 'hi';

/** Response from askOracle. */
export interface OracleResponse {
  readingId: string;
  verdict: VerdictKind;
  confidence: number; // 0-100
  category: string; // question type, e.g. "career"
  narration: Record<LangCode, string>;
  timing: {
    window: 'days' | 'weeks' | 'months' | 'years';
    range: { min: number; max: number };
  };
  remedy?: {
    planet: string;
    action: string;
    avoid: string;
    mantra?: string;
    charity?: string;
  };
  reasoning: Array<{
    ruleId: string;
    description: string;
    weight: number;
  }>;
  quotaRemaining: number | null; // null = unlimited plan
  computedAt: string; // ISO 8601
}

/** Response from getQuota. */
export interface QuotaResponse {
  plan: PlanTier;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
  weekKey: string; // "YYYY-MM-DD" (Sunday)
  planExpiry: string | null; // ISO 8601 or null for free/no expiry
}

/** Firestore /quotas/{userId} document shape. */
export interface QuotaDoc {
  weekKey: string;
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
  timing: OracleResponse['timing'];
  remedy: OracleResponse['remedy'] | null;
  reasoning: OracleResponse['reasoning'];
  createdAt: FirebaseFirestore.Timestamp;
}

/** Firestore /auditLogs/{logId} document shape. */
export interface AuditLogDoc {
  userId: string;
  action: AuditAction;
  questionHash?: string; // FNV-1a of question text — never raw text
  verdict?: VerdictKind;
  plan?: PlanTier;
  source?: 'callable' | 'http';
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
