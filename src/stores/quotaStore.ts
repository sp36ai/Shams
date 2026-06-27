/**
 * quotaStore — question quota and trial management.
 * --------------------------------------------------------------------------
 * Free plan:    3 questions per UTC day.
 * Trial:        5 questions per UTC day during a 7-day window.
 * Paid plans:   unlimited (quota check is bypassed at the call site).
 *
 * Day identity: UTC date string "YYYY-MM-DD".
 *
 * Persistence: MMKV synchronous writes — zero async latency on the ask path.
 */

import { create } from 'zustand';
import { storage, KEYS } from '@storage/mmkv';

/* -------------------------------------------------------------------------- */
/*  Plan tiers                                                                */
/* -------------------------------------------------------------------------- */

export type PlanTier = 'free' | 'mureed' | 'khass';

export const FREE_DAILY_LIMIT = 3;
export const MUREED_DAILY_LIMIT = 3;
export const TRIAL_DAILY_LIMIT = 3;
export const TRIAL_DURATION_DAYS = 7;

/** Only khass is truly unlimited. Mureed is 3/day. */
const UNLIMITED_PLANS: readonly PlanTier[] = ['khass'];

/* -------------------------------------------------------------------------- */
/*  Day key — UTC "YYYY-MM-DD"                                               */
/* -------------------------------------------------------------------------- */

function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*  Rehydration                                                               */
/* -------------------------------------------------------------------------- */

function readPlan(): PlanTier {
  const stored = storage.getString(KEYS.QUOTA_PLAN);
  if (stored === 'mureed' || stored === 'khass') {
    return stored;
  }
  return 'free';
}

function readCount(): number {
  const storedDay = storage.getString(KEYS.QUOTA_WEEK);
  const currentDay = todayKey();
  if (storedDay !== currentDay) {
    storage.set(KEYS.QUOTA_WEEK, currentDay);
    storage.set(KEYS.QUOTA_COUNT, 0);
    return 0;
  }
  return storage.getNumber(KEYS.QUOTA_COUNT) ?? 0;
}

/* -------------------------------------------------------------------------- */
/*  Trial helpers                                                             */
/* -------------------------------------------------------------------------- */

function readTrialStart(): string | null {
  return storage.getString(KEYS.TRIAL_START) ?? null;
}

function computeTrialState(trialStartDate: string | null): {
  trialActive: boolean;
  trialExpired: boolean;
} {
  if (!trialStartDate) {
    return { trialActive: false, trialExpired: false };
  }
  const elapsed = Math.floor((Date.now() - new Date(trialStartDate).getTime()) / 86_400_000);
  if (TRIAL_DURATION_DAYS - elapsed > 0) {
    return { trialActive: true, trialExpired: false };
  }
  return { trialActive: false, trialExpired: true };
}

/* -------------------------------------------------------------------------- */
/*  Store interface                                                           */
/* -------------------------------------------------------------------------- */

export interface QuotaState {
  /** Questions asked today (free/trial only; unused for paid). */
  questionsToday: number;
  /** Current plan tier. */
  plan: PlanTier;
  /** ISO date string of trial start, or null if never started. */
  trialStartDate: string | null;
  /** True while 7-day trial window is open. */
  trialActive: boolean;
  /** True if trial was started but has now expired. */
  trialExpired: boolean;
  /** Per-day free limit (exposed for OracleScreen gate). */
  FREE_DAILY_LIMIT: number;
  /** ISO expiry date returned by the server after purchase verification. */
  planExpiry: string | null;

  /** True when the user may ask another question right now. */
  canAsk: () => boolean;
  /** Record one question asked. Returns false if quota is already exhausted. */
  consumeOne: () => boolean;
  /** Upgrade plan (called after successful purchase). Optional expiry is the ISO string from server. */
  setPlan: (plan: PlanTier, expiry?: string) => void;
  /** Start the 7-day trial (no-op if already started). */
  startTrial: () => void;
  /** Read current trial status. */
  checkTrial: () => { active: boolean; daysRemaining: number; expired: boolean };
  /** Reset quota to 0 for testing / sign-out. */
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Store factory                                                             */
/* -------------------------------------------------------------------------- */

const _initTrialStart = readTrialStart();
const _initTrialState = computeTrialState(_initTrialStart);

export const useQuotaStore = create<QuotaState>((set, get) => ({
  questionsToday: readCount(),
  plan: readPlan(),
  planExpiry: storage.getString(KEYS.QUOTA_PLAN_EXPIRY) ?? null,
  trialStartDate: _initTrialStart,
  trialActive: _initTrialState.trialActive,
  trialExpired: _initTrialState.trialExpired,
  FREE_DAILY_LIMIT,

  canAsk(): boolean {
    // Always read fresh count from MMKV to handle midnight rollover without store re-init
    const fresh = readCount();
    const { plan, planExpiry, trialActive } = get();
    if (fresh !== get().questionsToday) {
      set({ questionsToday: fresh });
    }
    // Enforce plan expiry — downgrade expired paid plans to free
    if ((plan === 'mureed' || plan === 'khass') && planExpiry) {
      if (new Date(planExpiry).getTime() < Date.now()) {
        return fresh < FREE_DAILY_LIMIT;
      }
    }
    if ((UNLIMITED_PLANS as PlanTier[]).includes(plan)) {
      return true;
    }
    if (plan === 'mureed') {
      return fresh < MUREED_DAILY_LIMIT;
    }
    const limit = trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT;
    return fresh < limit;
  },

  consumeOne(): boolean {
    // Always read fresh count from MMKV to handle midnight rollover without store re-init
    const fresh = readCount();
    const { plan, planExpiry, trialActive } = get();
    const expired =
      (plan === 'mureed' || plan === 'khass') &&
      planExpiry != null &&
      new Date(planExpiry).getTime() < Date.now();
    if (!expired && (UNLIMITED_PLANS as PlanTier[]).includes(plan)) {
      return true;
    }
    const limit =
      !expired && plan === 'mureed'
        ? MUREED_DAILY_LIMIT
        : trialActive
          ? TRIAL_DAILY_LIMIT
          : FREE_DAILY_LIMIT;
    if (fresh >= limit) {
      return false;
    }
    const next = fresh + 1;
    storage.set(KEYS.QUOTA_COUNT, next);
    storage.set(KEYS.QUOTA_WEEK, todayKey());
    set({ questionsToday: next });
    return true;
  },

  setPlan(plan: PlanTier, expiry?: string): void {
    storage.set(KEYS.QUOTA_PLAN, plan);
    if (expiry) {
      storage.set(KEYS.QUOTA_PLAN_EXPIRY, expiry);
    } else {
      storage.delete(KEYS.QUOTA_PLAN_EXPIRY);
    }
    // Clear trial state when upgrading to paid plan
    const clearTrial = plan === 'mureed' || plan === 'khass';
    if (clearTrial) {
      storage.delete(KEYS.TRIAL_START);
    }
    set({
      plan,
      planExpiry: expiry ?? null,
      ...(clearTrial ? { trialStartDate: null, trialActive: false, trialExpired: false } : {}),
    });
  },

  startTrial(): void {
    const { trialStartDate } = get();
    if (trialStartDate !== null) {
      return;
    }
    const today = todayKey();
    storage.set(KEYS.TRIAL_START, today);
    set({ trialStartDate: today, trialActive: true, trialExpired: false });
  },

  checkTrial(): { active: boolean; daysRemaining: number; expired: boolean } {
    const { trialStartDate } = get();
    if (!trialStartDate) {
      return { active: false, daysRemaining: 0, expired: false };
    }
    const startMs = new Date(trialStartDate).getTime();
    const elapsed = Math.floor((Date.now() - startMs) / 86_400_000);
    const remaining = TRIAL_DURATION_DAYS - elapsed;
    if (remaining > 0) {
      return { active: true, daysRemaining: remaining, expired: false };
    }
    return { active: false, daysRemaining: 0, expired: true };
  },

  reset(): void {
    storage.set(KEYS.QUOTA_COUNT, 0);
    storage.set(KEYS.QUOTA_WEEK, todayKey());
    storage.set(KEYS.QUOTA_PLAN, 'free');
    storage.delete(KEYS.QUOTA_PLAN_EXPIRY);
    storage.delete(KEYS.TRIAL_START);
    set({
      questionsToday: 0,
      plan: 'free',
      planExpiry: null,
      trialStartDate: null,
      trialActive: false,
      trialExpired: false,
    });
  },
}));

/* -------------------------------------------------------------------------- */
/*  Selectors                                                                 */
/* -------------------------------------------------------------------------- */

export const selectQuestionsLeft = (s: QuotaState): number => {
  // Expired paid plans: downgrade display to free limit
  if ((s.plan === 'mureed' || s.plan === 'khass') && s.planExpiry) {
    if (new Date(s.planExpiry).getTime() < Date.now()) {
      return Math.max(0, FREE_DAILY_LIMIT - s.questionsToday);
    }
  }
  if ((UNLIMITED_PLANS as PlanTier[]).includes(s.plan)) {
    return Infinity;
  }
  if (s.plan === 'mureed') {
    return Math.max(0, MUREED_DAILY_LIMIT - s.questionsToday);
  }
  const limit = s.trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT;
  return Math.max(0, limit - s.questionsToday);
};

export const selectIsUnlimited = (s: QuotaState): boolean =>
  (UNLIMITED_PLANS as PlanTier[]).includes(s.plan);
