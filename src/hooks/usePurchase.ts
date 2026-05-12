import { useCallback, useState } from 'react';
import { firebase } from '@react-native-firebase/functions';
import { useQuotaStore } from '@stores/quotaStore';
import type { PlanTier } from '@stores/quotaStore';

export type PurchasePlan =
  | 'mureed_monthly'
  | 'mureed_annual'
  | 'khass_monthly'
  | 'khass_annual';

const PRODUCT_ID_MAP: Record<PurchasePlan, string> = {
  mureed_monthly: 'com.shamsalasrar.mureed.monthly',
  mureed_annual: 'com.shamsalasrar.mureed.annual',
  khass_monthly: 'com.shamsalasrar.khass.monthly',
  khass_annual: 'com.shamsalasrar.khass.annual',
};

function tierFromPlan(plan: PurchasePlan): PlanTier {
  return plan.startsWith('mureed') ? 'mureed' : 'khass';
}

export type PurchaseResult =
  | { success: true }
  | { success: false; reason: 'already_active' | 'verification_failed' | 'network_error' | 'not_implemented'; error?: unknown };

export interface PurchaseState {
  purchasing: boolean;
  purchase: (plan: PurchasePlan) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
}

export function usePurchase(): PurchaseState {
  const currentPlan = useQuotaStore(s => s.plan);
  const setPlan = useQuotaStore(s => s.setPlan);
  const [purchasing, setPurchasing] = useState(false);

  const purchase = useCallback(
    async (plan: PurchasePlan): Promise<PurchaseResult> => {
      const tier = tierFromPlan(plan);
      if (tier === currentPlan) {
        return { success: false, reason: 'already_active' };
      }

      setPurchasing(true);
      try {
        // ── Google Play Billing integration point ─────────────────────────────
        // When react-native-iap (or @react-native-google-play/billing-client)
        // is installed, replace this block with:
        //
        //   await RNIap.initConnection();
        //   const purchase = await RNIap.requestPurchase({ skus: [PRODUCT_ID_MAP[plan]] });
        //   const purchaseToken = purchase.purchaseToken;
        //   await RNIap.finishTransaction({ purchase, isConsumable: false });
        //
        // For now we call the cloud function directly. In dev (enforceAppCheck=false)
        // it may succeed; in production it will return success:false until a real
        // purchase token is provided.
        // ─────────────────────────────────────────────────────────────────────
        const fn = firebase.app().functions('asia-south1').httpsCallable('verifyGooglePlayPurchase');
        const result = await fn({ purchaseToken: 'iap_pending', productId: PRODUCT_ID_MAP[plan] });
        const data = result.data as { success: boolean } | null;

        if (data?.success) {
          setPlan(tier);
          return { success: true };
        }
        return { success: false, reason: 'verification_failed' };
      } catch (error) {
        return { success: false, reason: 'network_error', error };
      } finally {
        setPurchasing(false);
      }
    },
    [currentPlan, setPlan],
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    // ── Restore purchases integration point ───────────────────────────────────
    // When react-native-iap is installed:
    //   const purchases = await RNIap.getAvailablePurchases();
    //   for (const p of purchases) { verify p.purchaseToken against the server }
    // ─────────────────────────────────────────────────────────────────────────
    return { success: false, reason: 'not_implemented' };
  }, []);

  return { purchasing, purchase, restore };
}
