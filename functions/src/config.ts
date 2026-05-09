/**
 * Centralised configuration — aligned with the mobile client's models.
 *
 * Quota model: Sunday-anchored rolling week (matches quotaStore.ts on client).
 * Plan tiers:  free | starter | premium | consultation (matches PlanTier type).
 */
import { defineInt, defineSecret } from 'firebase-functions/params';

export type PlanTier = 'free' | 'starter' | 'premium' | 'consultation';

export const UNLIMITED_PLANS: PlanTier[] = ['starter', 'premium', 'consultation'];
export const FREE_LIMIT = 3; // questions per rolling week

/** Return the ISO date string (YYYY-MM-DD) of the most recent Sunday (UTC). */
export function sundayWeekKey(now = Date.now()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  return d.toISOString().slice(0, 10);
}

export const REGION = 'asia-south1'; // Mumbai — closest to primary user base

export const FUNCTION_OPTS = {
  region: REGION,
  timeoutSeconds: 30,
  memory: '512MiB' as const,
  // enforceAppCheck is set per-function — see individual function files.
} as const;

/**
 * Secret Manager bindings.
 * These must be attached to each function that needs them via `secrets: [...]`.
 */
export const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');
export const GOOGLE_PLAY_CLIENT_EMAIL = defineSecret('GOOGLE_PLAY_CLIENT_EMAIL');
export const GOOGLE_PLAY_PRIVATE_KEY = defineSecret('GOOGLE_PLAY_PRIVATE_KEY');
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/**
 * Configurable callable rate limit (requests per user per minute).
 * Set in `functions/.env` for emulator or via deployed params.
 */
export const RATE_LIMIT_PER_MINUTE = defineInt('RATE_LIMIT_PER_MINUTE', {
  default: 10,
  description: 'Maximum callable requests per user per minute',
});

/** Google Play product IDs mapped to plan tiers. */
export const PLAY_PRODUCT_MAP: Record<string, PlanTier> = {
  shams_starter_weekly: 'starter',
  shams_premium_monthly: 'premium',
  shams_consultation_monthly: 'consultation',
};

/** Plan durations in days (for expiry calculation). */
export const PLAN_DURATION_DAYS: Record<PlanTier, number> = {
  free: 0, // never expires
  starter: 7,
  premium: 31,
  consultation: 31,
};
