import { useCallback, useEffect, useState } from 'react';
import { regionalFunctions } from '../firebase/functionsRegion';
import { ensureAppCheckReady } from '../firebase/appCheck';
import { withTimeout } from '../utils/withTimeout';
import { useQuotaStore, selectQuestionsLeft } from '@stores/quotaStore';
import type { PlanTier } from '@stores/quotaStore';

export interface QuotaState {
  canAsk: boolean;
  isPremium: boolean;
  currentPlan: PlanTier;
  questionsLeft: number | null;
  serverRemaining: number | null;
  loading: boolean;
  consumeOne: () => boolean;
  refresh: () => void;
}

const QUOTA_TTL_MS = 60_000;
let _lastFetchAt = 0;
let _cachedRemaining: number | null = null;

// PHASE 6D-4: see appCheck.ts's own doc comment for the cold-start race this
// closes. OracleScreen — the only screen that mounts this hook on the app's
// initial tab route — is the single most direct instance of that race in
// this codebase; see docs/audit/PHASE_6D_4_REVIEW.md §4.3.
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

export function invalidateQuotaCache(): void {
  _lastFetchAt = 0;
  _cachedRemaining = null;
}

export function useQuota(): QuotaState {
  const storeCanAsk = useQuotaStore(s => s.canAsk());
  const consumeOne = useQuotaStore(s => s.consumeOne);
  const questionsLeft = useQuotaStore(selectQuestionsLeft);
  const currentPlan = useQuotaStore(s => s.plan);

  const [serverRemaining, setServerRemaining] = useState<number | null>(_cachedRemaining);
  const [loading, setLoading] = useState(_cachedRemaining === null);

  const refresh = useCallback(() => {
    const now = Date.now();
    if (_cachedRemaining !== null && now - _lastFetchAt < QUOTA_TTL_MS) {
      setServerRemaining(_cachedRemaining);
      setLoading(false);
      return;
    }
    setLoading(true);
    // PHASE 6D-4: give App Check a bounded head start before the callable
    // fires, same as every other gated call site — but this function's own
    // external contract is `() => void` (a fire-and-forget refresh a mount
    // effect can call bare), so the gate + call are wrapped in an async IIFE
    // rather than making `refresh` itself async. withTimeout() never throws
    // (see src/utils/__tests__/withTimeout.test.ts), so nothing here needs
    // its own try/catch beyond the one already guarding the callable build.
    void (async () => {
      await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

      // Building the callable is synchronous: regionalFunctions() and
      // httpsCallable() run before any promise exists. A throw here — a missing
      // Firebase functions method, an app that is not yet initialised — would
      // escape this mount effect and crash whatever screen mounts the hook
      // (OracleScreen: the "veil trembled" fallback). The .catch() below only
      // covers the async rejection, so guard the synchronous build too and
      // degrade to "unknown remaining" instead of taking the screen down.
      try {
        regionalFunctions()
          .httpsCallable<object, { plan: PlanTier; planExpiry: string | null; remaining: number }>(
            'getQuota',
          )({})
          .then(r => {
            _cachedRemaining = r.data.remaining;
            _lastFetchAt = Date.now();
            setServerRemaining(r.data.remaining);
            // The server is authoritative for plan state — it self-heals an
            // expired paid plan to 'free' on every call (functions/getQuota.ts)
            // — but nothing revokes the Firebase Auth custom claim a lapsed
            // subscription was originally granted through, so authStore's own
            // plan sync (read once, at sign-in, from that claim) never sees
            // the correction on its own. Without this, isPremium/canAsk below
            // would keep reporting "unlimited" indefinitely after a real
            // subscription expired, until the seeker happened to sign out and
            // back in. Reconciling here means every refresh (any OracleScreen/
            // ReadingScreen mount, at most once per QUOTA_TTL_MS) self-corrects
            // instead.
            useQuotaStore.getState().setPlan(r.data.plan, r.data.planExpiry);
          })
          .catch(() => setServerRemaining(null))
          .finally(() => setLoading(false));
      } catch {
        setServerRemaining(null);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPremium = currentPlan !== 'free';
  const canAsk = storeCanAsk && (isPremium || serverRemaining === null || serverRemaining > 0);

  return {
    canAsk,
    isPremium,
    currentPlan,
    questionsLeft,
    serverRemaining,
    loading,
    consumeOne,
    refresh,
  };
}
