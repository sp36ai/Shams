/**
 * Centralised configuration — aligned with the mobile client's models.
 *
 * Quota model: Sunday-anchored rolling week (matches quotaStore.ts on client).
 * Plan tiers:  free | starter | premium | consultation (matches PlanTier type).
 */

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

export const RAZORPAY_WEBHOOK_SECRET_KEY = 'RAZORPAY_WEBHOOK_SECRET';
export const GOOGLE_PLAY_CLIENT_EMAIL_KEY = 'GOOGLE_PLAY_CLIENT_EMAIL';
export const GOOGLE_PLAY_PRIVATE_KEY_KEY = 'GOOGLE_PLAY_PRIVATE_KEY';

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
