/**
 * Centralised configuration — aligned with the mobile client's models.
 *
 * Quota model: UTC day rolling (matches quotaStore.ts on client).
 * Plan tiers:  free | mureed | khass (matches PlanTier type).
 */
import { defineInt, defineSecret } from 'firebase-functions/params';

export type PlanTier = 'free' | 'mureed' | 'khass';

export const UNLIMITED_PLANS: PlanTier[] = ['mureed', 'khass'];
// Paywall limits. Must stay in sync with the client (src/stores/quotaStore.ts).
//
// TEMPORARY — raised from 3/5 to 50/50 for internal testing, so testers
// aren't paywall-blocked mid-session while exercising the app. Revert both
// this file and src/stores/quotaStore.ts to 3/5 once testing concludes —
// tracked as an explicit owner decision, not a permanent pricing change.
export const FREE_LIMIT = 50; // questions per UTC day — free plan
export const TRIAL_DAILY_LIMIT = 50; // questions per UTC day — 7-day trial
export const TRIAL_DURATION_DAYS = 7;

/** Return the ISO date string (YYYY-MM-DD) for the current UTC day. */
export function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Cost ceiling on follow-up turns for one reading — a backstop, not the
 * conversational limit.
 *
 * Owner decision 2026-10-11: there is no fixed number of follow-ups. The
 * oracle closes the conversation when it has done its work
 * (`conversationComplete`, see discussReading.ts). Discussion is free — the
 * unit sold is the reading — so this bound still keeps one reading from
 * becoming an unbounded run of model calls; it is set far above where a
 * conversation ends on its own.
 */
export const DISCUSSION_TURN_LIMIT = 40;

// ── Coin economy (owner decision 2026-10-14) ──────────────────────────────
// Applies only where utils/monetization.ts says the seeker is in 'coins' mode.
// Amounts are integer millicoins: 1 coin = 1000 milli = ₹10.
export const MILLI_PER_COIN = 1000;
/** Free plan: one question per this many days, counted from the last free one. */
export const FREE_QUESTION_INTERVAL_DAYS = 7;
/** Free plan: price of a question beyond the free one (3 coins = ₹30). */
export const EXTRA_QUESTION_COST_MILLI = 3 * MILLI_PER_COIN;
/** Paid plan: fair-use cap on questions per UTC day ("unlimited*"). */
export const PAID_DAILY_FAIR_USE = 10;
/** Discussion price: 1 coin per 10,000 model tokens, i.e. 10 tokens per millicoin. */
export const TOKENS_PER_MILLICOIN = 10;
/** Discussion: a turn needs at least this balance to start (1 coin). */
export const MIN_DISCUSSION_BALANCE_MILLI = 1 * MILLI_PER_COIN;
/**
 * Coin packs sold through Google Play as consumable in-app products (owner
 * decision 2026-10-14): ₹10 per coin, no bonuses. Product id → coins.
 */
export const COIN_PACKS: Record<string, number> = {
  shams_coins_10: 10,
  shams_coins_30: 30,
  shams_coins_100: 100,
};

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
  // Premium ₹299/month (owner decision 2026-10-14): the one plan sold from
  // now on. Maps to the top tier so it unlocks everything (both premium
  // themes included). The four below stay mapped for existing subscribers.
  shams_premium_monthly: 'khass',
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
