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
import { activateTrialOnServer } from '../firebase/trial';

/* -------------------------------------------------------------------------- */
/*  Plan tiers                                                                */
/* -------------------------------------------------------------------------- */

export type PlanTier = 'free' | 'mureed' | 'khass';

// TEMP (internal testing): raised from 3/5 to give testers headroom while the
// oracle engine is being debugged. REVERT to FREE=3, TRIAL=5 before public
// launch — these are the paywall limits. Must stay in sync with the server
// (functions/src/config.ts FREE_LIMIT / TRIAL_DAILY_LIMIT).
export const FREE_DAILY_LIMIT = 50;
export const TRIAL_DAILY_LIMIT = 50;
export const TRIAL_DURATION_DAYS = 7;

/** Plans that get unlimited questions. */
const UNLIMITED_PLANS: readonly PlanTier[] = ['mureed', 'khass'];

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
  /**
   * Reconcile the locally-displayed trial window against the authoritative
   * server start date (returned by activateTrial). Prevents a reinstall from
   * silently re-gifting a fresh 7-day countdown when the server already holds
   * an earlier — possibly expired — start date.
   */
  reconcileTrialFromServer: (serverStartedAt: string) => void;
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
    const { plan, questionsToday, trialActive } = get();
    if ((UNLIMITED_PLANS as PlanTier[]).includes(plan)) {
      return true;
    }
    const limit = trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT;
    return questionsToday < limit;
  },

  consumeOne(): boolean {
    const { plan, questionsToday, trialActive } = get();
    if ((UNLIMITED_PLANS as PlanTier[]).includes(plan)) {
      return true;
    }
    const limit = trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT;
    if (questionsToday >= limit) {
      return false;
    }
    const next = questionsToday + 1;
    storage.set(KEYS.QUOTA_COUNT, next);
    storage.set(KEYS.QUOTA_WEEK, todayKey());
    set({ questionsToday: next });
    return true;
  },

  setPlan(plan: PlanTier, expiry?: string): void {
    storage.set(KEYS.QUOTA_PLAN, plan);
    if (expiry) {
      storage.set(KEYS.QUOTA_PLAN_EXPIRY, expiry);
    }
    set({ plan, ...(expiry ? { planExpiry: expiry } : {}) });
  },

  startTrial(): void {
    const { trialStartDate } = get();
    if (trialStartDate !== null) {
      return;
    }
    const today = todayKey();
    storage.set(KEYS.TRIAL_START, today);
    set({ trialStartDate: today, trialActive: true, trialExpired: false });
    // Register on server so trial cannot be reset by reinstalling the app.
    // The server is idempotent and returns the ORIGINAL start date if one
    // already exists — reconcile the local countdown to it so a reinstall
    // cannot show a fresh 7 days over a server-side window that already
    // started (or expired). Server also enforces the limit independently via
    // /trials/{userId} on every askOracle call.
    void activateTrialOnServer()
      .then(res => get().reconcileTrialFromServer(res.startedAt))
      .catch(err => console.warn('[quotaStore] trial server registration failed', err));
  },

  reconcileTrialFromServer(serverStartedAt: string): void {
    // Normalise to the same UTC "YYYY-MM-DD" day key the local clock uses.
    const parsed = new Date(serverStartedAt);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const serverDay = parsed.toISOString().slice(0, 10);
    if (serverDay === get().trialStartDate) {
      return; // already aligned — nothing to do
    }
    storage.set(KEYS.TRIAL_START, serverDay);
    const { trialActive, trialExpired } = computeTrialState(serverDay);
    set({ trialStartDate: serverDay, trialActive, trialExpired });
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
  if ((UNLIMITED_PLANS as PlanTier[]).includes(s.plan)) {
    return Infinity;
  }
  const limit = s.trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT;
  return Math.max(0, limit - s.questionsToday);
};

export const selectIsUnlimited = (s: QuotaState): boolean =>
  (UNLIMITED_PLANS as PlanTier[]).includes(s.plan);
