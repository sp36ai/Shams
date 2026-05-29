import { useCallback, useEffect, useState } from 'react';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type SubscriptionPurchase,
  type PurchaseError,
} from 'react-native-iap';
import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';
import { useQuotaStore } from '@stores/quotaStore';
import type { PlanTier } from '@stores/quotaStore';

type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};

export type PurchasePlan =
  | 'mureed_monthly'
  | 'mureed_annual'
  | 'khass_monthly'
  | 'khass_annual';

export const SKU_MAP: Record<PurchasePlan, string> = {
  mureed_monthly: 'mureed_monthly',
  mureed_annual:  'mureed_annual',
  khass_monthly:  'khass_monthly',
  khass_annual:   'khass_annual',
};

const PACKAGE_NAME = 'com.astrosarfaraz.shamsalasrar';

function tierFromPlan(plan: PurchasePlan): PlanTier {
  return plan.startsWith('mureed') ? 'mureed' : 'khass';
}

function tierFromSku(sku: string): PlanTier | null {
  const entry = Object.entries(SKU_MAP).find(([, s]) => s === sku);
  if (!entry) return null;
  return tierFromPlan(entry[0] as PurchasePlan);
}

export type PurchaseResult =
  | { success: true }
  | { success: false; reason: 'already_active' | 'verification_failed' | 'network_error' | 'user_cancelled'; error?: unknown };

export interface PurchaseState {
  purchasing: boolean;
  purchase: (plan: PurchasePlan) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
}

export function usePurchase(): PurchaseState {
  const currentPlan = useQuotaStore(s => s.plan);
  const setPlan = useQuotaStore(s => s.setPlan);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    initConnection().catch(() => undefined);

    // Listeners are required by react-native-iap to keep the purchase queue
    // draining on Android. Actual results come through the requestSubscription promise.
    const updateSub = purchaseUpdatedListener((_p: SubscriptionPurchase) => undefined);
    const errorSub = purchaseErrorListener((_e: PurchaseError) => undefined);

    return () => {
      updateSub.remove();
      errorSub.remove();
      endConnection().catch(() => undefined);
    };
  }, []);

  const verifyWithServer = useCallback(
    async (purchaseToken: string, productId: string): Promise<{ verified: boolean; planExpiry?: string }> => {
      try {
        const fn = (functions() as FunctionsWithRegion)
          .region('asia-south1')
          .httpsCallable('verifyGooglePlayPurchase');
        const result = await fn({ purchaseToken, productId, packageName: PACKAGE_NAME });
        const data = result.data as { plan?: string; planExpiry?: string } | null;
        if (typeof data?.plan === 'string') {
          return { verified: true, planExpiry: data.planExpiry };
        }
        return { verified: false };
      } catch {
        return { verified: false };
      }
    },
    [],
  );

  const purchase = useCallback(
    async (plan: PurchasePlan): Promise<PurchaseResult> => {
      const tier = tierFromPlan(plan);
      if (tier === currentPlan) {
        return { success: false, reason: 'already_active' };
      }

      setPurchasing(true);
      try {
        const sku = SKU_MAP[plan];

        // Validate SKU is live on Play Console before launching the purchase sheet
        await getSubscriptions({ skus: [sku] });

        // Launch the Google Play subscription sheet
        const result = await requestSubscription({ sku });

        const p: SubscriptionPurchase | null = Array.isArray(result)
          ? (result[0] ?? null)
          : (result ?? null);

        if (!p?.purchaseToken) {
          return { success: false, reason: 'user_cancelled' };
        }

        const { verified, planExpiry } = await verifyWithServer(p.purchaseToken, p.productId);

        if (verified) {
          await finishTransaction({ purchase: p, isConsumable: false }).catch(() => undefined);
          setPlan(tier, planExpiry);
          return { success: true };
        }

        return { success: false, reason: 'verification_failed' };
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err?.code === 'E_USER_CANCELLED') {
          return { success: false, reason: 'user_cancelled' };
        }
        return { success: false, reason: 'network_error', error };
      } finally {
        setPurchasing(false);
      }
    },
    [currentPlan, setPlan, verifyWithServer],
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    setPurchasing(true);
    try {
      const purchases = await getAvailablePurchases();

      for (const p of purchases) {
        if (!p.purchaseToken || !p.productId) continue;
        const { verified, planExpiry } = await verifyWithServer(p.purchaseToken, p.productId);
        if (verified) {
          const tier = tierFromSku(p.productId);
          if (tier) {
            setPlan(tier, planExpiry);
            return { success: true };
          }
        }
      }

      return { success: false, reason: 'verification_failed' };
    } catch (error) {
      return { success: false, reason: 'network_error', error };
    } finally {
      setPurchasing(false);
    }
  }, [setPlan, verifyWithServer]);

  return { purchasing, purchase, restore };
}
