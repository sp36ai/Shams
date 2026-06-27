/**
 * Centralised configuration — aligned with the mobile client's models.
 *
 * Quota model: UTC day rolling (matches quotaStore.ts on client).
 * Plan tiers:  free | mureed | khass (matches PlanTier type).
 */
import { defineInt, defineSecret } from 'firebase-functions/params';

export type PlanTier = 'free' | 'mureed' | 'khass';

export const UNLIMITED_PLANS: PlanTier[] = ['mureed', 'khass'];
export const FREE_LIMIT = 100; // questions per UTC day

/** Return the ISO date string (YYYY-MM-DD) for the current UTC day. */
export function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export const REGION = 'asia-south1'; // Mumbai — closest to primary user base

export const FUNCTION_OPTS = {
  region: REGION,
  timeoutSeconds: 60,
  memory: '512MiB' as const,
  // enforceAppCheck is set per-function — see individual function files.
} as const;

// askOracle calls Anthropic (up to 25s) + safety validation (up to 24s) + cold start overhead.
// 120s prevents timeout on cold starts.
export const ORACLE_FUNCTION_OPTS = {
  ...FUNCTION_OPTS,
  timeoutSeconds: 120,
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

/**
 * Google Play product IDs mapped to plan tiers.
 * Create these exact SKU strings in Google Play Console → Subscriptions.
 */
export const PLAY_PRODUCT_MAP: Record<string, PlanTier> = {
  mureed_monthly: 'mureed',
  mureed_annual: 'mureed',
  khass_monthly: 'khass',
  khass_annual: 'khass',
};

/** Plan durations in days (for expiry calculation). */
export const PLAN_DURATION_DAYS: Record<PlanTier, number> = {
  free: 0, // never expires
  mureed: 31, // monthly billing cycle
  khass: 31, // monthly billing cycle (annual handled by Play Store)
};
