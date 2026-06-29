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

/** Response from askOracle. */
export interface OracleResponse {
  readingId: string;
  verdict: VerdictKind;
  confidence: number; // 0-100
  category: string; // question type, e.g. "career"
  narration: Record<LangCode, string>;
  /** Absent when verdict is DENIED — chart lacks the promise to answer. */
  timing?: {
    window: 'days' | 'weeks' | 'months' | 'years';
    range: { min: number; max: number };
  };
  /** Sub-lord of each relevant cusp for expert inspection. */
  cuspSubLords?: Array<{ house: number; subLord: string; subLordHouse: number }>;
  /** All 5 ruling planets at the chart moment. */
  rulingPlanets?: {
    dayLord: string;
    ascSignLord: string;
    ascStarLord: string;
    moonSignLord: string;
    moonStarLord: string;
    horaLord?: string;
  };
  /** KP significator sets: which planets speak for/against the question. */
  significators?: {
    favorable: string[];
    denial: string[];
    neutral: string[];
  };
  /** Ruling planets confirmed as favorable significators — primary decisive witnesses. */
  confirmedSignificators?: string[];
  /** Ruling planets confirmed as denial significators — opposing witnesses. */
  deniedSignificators?: string[];
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

  // ── Display-layer geometry (chart wheel) ─────────────────────────────────
  /** Sidereal longitudes 0–360 for all 9 grahas — display geometry only. */
  planetDegrees?: Record<string, number>;
  /** Sidereal longitudes 0–360 for all 12 Placidus cusps, 1-indexed — display only. */
  cuspDegrees?: Record<number, number>;
  /** Zodiac sign name for each cusp (1-indexed) — display only. */
  cuspSigns?: Record<number, string>;
  /** Per-planet nakshatra-lord / sub-lord / sub-sub-lord chain — display only. */
  planetChain?: Record<string, { manzilLord: string; subLord: string; subSubLord: string }>;
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
