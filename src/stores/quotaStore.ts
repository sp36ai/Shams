/**
 * quotaStore — free-tier question quota.
 * --------------------------------------------------------------------------
 * Free plan: 3 questions per rolling week (Sun 00:00 local → Sat 23:59).
 * Paid plans: unlimited (quota check is bypassed at the call site).
 *
 * Week identity: "YYYY-WNN" ISO week string derived from the local Sunday-
 * anchored week. We use Sunday (day 0) as the week start because that is
 * culturally common in the South Asian / MENA target market.
 *
 * Persistence: MMKV synchronous writes — zero async latency on the ask path.
 * The quota check in OracleScreen is therefore synchronous: no spinner needed.
 */

import { create } from 'zustand';
import { storage, KEYS } from '@storage/mmkv';

/* -------------------------------------------------------------------------- */
/*  Plan tiers                                                                */
/* -------------------------------------------------------------------------- */

export type PlanTier = 'free' | 'starter' | 'premium' | 'consultation';

export const FREE_LIMIT = 3;

/** Plans that get unlimited questions. */
const UNLIMITED_PLANS: readonly PlanTier[] = ['starter', 'premium', 'consultation'];

/* -------------------------------------------------------------------------- */
/*  Week key — Sunday-anchored ISO-style "YYYY-SWnn"                          */
/* -------------------------------------------------------------------------- */

function sundayWeekKey(now = Date.now()): string {
  const d = new Date(now);
  // Day of week: 0=Sun … 6=Sat. Subtract days back to most recent Sunday.
  const dayOfWeek = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);
  // Format YYYY-SWnn  (SW = Sunday-week to distinguish from ISO Monday-weeks)
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const day = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* -------------------------------------------------------------------------- */
/*  Rehydration                                                               */
/* -------------------------------------------------------------------------- */

function readPlan(): PlanTier {
  const raw = storage.getString(KEYS.QUOTA_PLAN);
  if (raw === 'starter' || raw === 'premium' || raw === 'consultation') {
    return raw;
  }
  return 'free';
}

function readCount(): number {
  const storedWeek = storage.getString(KEYS.QUOTA_WEEK);
  const currentWeek = sundayWeekKey();
  if (storedWeek !== currentWeek) {
    // New week — reset counter, update week key
    storage.set(KEYS.QUOTA_WEEK, currentWeek);
    storage.set(KEYS.QUOTA_COUNT, 0);
    return 0;
  }
  return storage.getNumber(KEYS.QUOTA_COUNT) ?? 0;
}

/* -------------------------------------------------------------------------- */
/*  Store interface                                                           */
/* -------------------------------------------------------------------------- */

export interface QuotaState {
  /** Questions asked so far this week (free plan only; unused for paid). */
  usedThisWeek: number;
  /** Current plan tier. */
  plan: PlanTier;

  /** True when the user may ask another question right now. */
  canAsk: () => boolean;
  /** Record one question asked. Returns false if quota is already exhausted. */
  consumeOne: () => boolean;
  /** Upgrade plan (called after successful purchase). */
  setPlan: (plan: PlanTier) => void;
  /** Reset quota to 0 for testing / sign-out. */
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Store factory                                                             */
/* -------------------------------------------------------------------------- */

export const useQuotaStore = create<QuotaState>((set, get) => ({
  usedThisWeek: readCount(),
  plan: readPlan(),

  canAsk(): boolean {
    const { plan, usedThisWeek } = get();
    if ((UNLIMITED_PLANS as PlanTier[]).includes(plan)) {
      return true;
    }
    return usedThisWeek < FREE_LIMIT;
  },

  consumeOne(): boolean {
    const { plan, usedThisWeek } = get();
    if ((UNLIMITED_PLANS as PlanTier[]).includes(plan)) {
      return true;
    }
    if (usedThisWeek >= FREE_LIMIT) {
      return false;
    }
    const next = usedThisWeek + 1;
    storage.set(KEYS.QUOTA_COUNT, next);
    storage.set(KEYS.QUOTA_WEEK, sundayWeekKey());
    set({ usedThisWeek: next });
    return true;
  },

  setPlan(plan: PlanTier): void {
    storage.set(KEYS.QUOTA_PLAN, plan);
    set({ plan });
  },

  reset(): void {
    storage.set(KEYS.QUOTA_COUNT, 0);
    storage.set(KEYS.QUOTA_WEEK, sundayWeekKey());
    storage.set(KEYS.QUOTA_PLAN, 'free');
    set({ usedThisWeek: 0, plan: 'free' });
  },
}));

/* -------------------------------------------------------------------------- */
/*  Selectors                                                                 */
/* -------------------------------------------------------------------------- */

export const selectQuestionsLeft = (s: QuotaState): number => {
  if ((UNLIMITED_PLANS as PlanTier[]).includes(s.plan)) {
    return Infinity;
  }
  return Math.max(0, FREE_LIMIT - s.usedThisWeek);
};

export const selectIsUnlimited = (s: QuotaState): boolean =>
  (UNLIMITED_PLANS as PlanTier[]).includes(s.plan);
