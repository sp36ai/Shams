import { useCallback, useEffect, useState } from 'react';
import { regionalFunctions } from '../firebase/functionsRegion';
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
    // Building the callable is synchronous: regionalFunctions() and
    // httpsCallable() run before any promise exists. A throw here — a missing
    // Firebase functions method, an app that is not yet initialised — would
    // escape this mount effect and crash whatever screen mounts the hook
    // (OracleScreen: the "veil trembled" fallback). The .catch() below only
    // covers the async rejection, so guard the synchronous build too and
    // degrade to "unknown remaining" instead of taking the screen down.
    try {
      regionalFunctions()
        .httpsCallable<object, { remaining: number }>('getQuota')({})
        .then(r => {
          _cachedRemaining = r.data.remaining;
          _lastFetchAt = Date.now();
          setServerRemaining(r.data.remaining);
        })
        .catch(() => setServerRemaining(null))
        .finally(() => setLoading(false));
    } catch {
      setServerRemaining(null);
      setLoading(false);
    }
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
