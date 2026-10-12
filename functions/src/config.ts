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

export const REGION = 'asia-south1'; // Mumbai — closest to primary user base

export const FUNCTION_OPTS = {
  region: REGION,
  timeoutSeconds: 60,
  memory: '512MiB' as const,
  // enforceAppCheck is set per-function — see individual function files.
} as const;

// askOracle calls the narration model (up to 40s) + safety validation + cold start overhead.
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
export const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

/**
 * OpenAI model ids — the only place they are named. Each was checked against
 * OpenAI's model pages and deprecations list on 2026-10-12:
 *
 *   gpt-5.4-mini — narration and follow-up discussion (owner's choice).
 *     Responses API; not on the deprecations list. $0.75 / $4.50 per 1M
 *     input / output tokens. Pinnable snapshot: gpt-5.4-mini-2026-03-17.
 *   gpt-6-luna   — the question gate and onboarding profile inference.
 *     Responses API; $0.10 / $0.50 per 1M tokens. OpenAI's named replacement
 *     for gpt-5.4-nano, which was deprecated 2026-10-01 (shutdown 2027-04-01)
 *     and so is not used here.
 *
 * functions/src/__tests__/modelIds.test.ts fails the build if any other id
 * appears in a request, or a known-retired one does.
 */
export const OPENAI_MODELS = Object.freeze({
  narration: 'gpt-5.4-mini',
  discussion: 'gpt-5.4-mini',
  classification: 'gpt-6-luna',
  profileInference: 'gpt-6-luna',
} as const);

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
