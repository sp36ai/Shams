import { useCallback, useState } from 'react';
import { firebase } from '@react-native-firebase/functions';
import { useQuotaStore } from '@stores/quotaStore';
import type { PlanTier } from '@stores/quotaStore';

export type PurchaseResult =
  | { success: true }
  | { success: false; reason: 'already_active' | 'verification_failed' | 'network_error' | 'not_implemented'; error?: unknown };

export interface PurchaseState {
  purchasing: boolean;
  purchase: (plan: PlanTier) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
}

export function usePurchase(): PurchaseState {
  const currentPlan = useQuotaStore(s => s.plan);
  const setPlan = useQuotaStore(s => s.setPlan);
  const [purchasing, setPurchasing] = useState(false);

  const purchase = useCallback(
    async (plan: PlanTier): Promise<PurchaseResult> => {
      if (plan === currentPlan) {
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
        const result = await fn({ purchaseToken: 'iap_pending', productId: plan });
        const data = result.data as { success: boolean } | null;

        if (data?.success) {
          setPlan(plan);
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
