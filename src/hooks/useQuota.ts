import { useCallback, useEffect, useState } from 'react';
import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';

type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};
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
    (functions() as FunctionsWithRegion)
      .region('asia-south1')
      .httpsCallable<object, { remaining: number }>('getQuota')({})
      .then(r => {
        _cachedRemaining = r.data.remaining;
        _lastFetchAt = Date.now();
        setServerRemaining(r.data.remaining);
      })
      .catch(() => setServerRemaining(null))
      .finally(() => setLoading(false));
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
