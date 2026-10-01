import { useCallback, useEffect, useState } from 'react';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type Purchase,
  type PurchaseError,
  type ProductSubscription,
} from 'react-native-iap';

import { regionalFunctions } from '../firebase/functionsRegion';
import { ensureAppCheckReady } from '../firebase/appCheck';
import { withTimeout } from '../utils/withTimeout';
import { useQuotaStore } from '@stores/quotaStore';
import type { PlanTier } from '@stores/quotaStore';

export type PurchasePlan = 'mureed_monthly' | 'mureed_annual' | 'khass_monthly' | 'khass_annual';

export const SKU_MAP: Record<PurchasePlan, string> = {
  mureed_monthly: 'mureed_monthly',
  mureed_annual: 'mureed_annual',
  khass_monthly: 'khass_monthly',
  khass_annual: 'khass_annual',
};

const PACKAGE_NAME = 'com.astrosarfaraz.shamsalasrar';

// PHASE 6D-4: see appCheck.ts's own doc comment for the cold-start race this
// closes. The purchaseUpdatedListener path below is the one that matters
// most here — a deferred/renewal purchase delivered by the native IAP layer
// has no user-facing retry if verification fails, unlike purchase()/restore()
// which return their failure to a caller that can react — see
// docs/audit/PHASE_6D_4_REVIEW.md §6.
const APP_CHECK_GATE_TIMEOUT_MS = 8000;

function tierFromPlan(plan: PurchasePlan): PlanTier {
  return plan.startsWith('mureed') ? 'mureed' : 'khass';
}

function tierFromSku(sku: string): PlanTier | null {
  const entry = Object.entries(SKU_MAP).find(([, s]) => s === sku);
  if (!entry) {
    return null;
  }
  return tierFromPlan(entry[0] as PurchasePlan);
}

export type PurchaseResult =
  | { success: true }
  | {
      success: false;
      reason: 'already_active' | 'verification_failed' | 'network_error' | 'user_cancelled';
      error?: unknown;
    };

export interface PurchaseState {
  purchasing: boolean;
  purchase: (plan: PurchasePlan) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
}

export function usePurchase(): PurchaseState {
  const currentPlan = useQuotaStore(s => s.plan);
  const setPlan = useQuotaStore(s => s.setPlan);
  const [purchasing, setPurchasing] = useState(false);

  const verifyWithServer = useCallback(
    async (
      purchaseToken: string,
      productId: string,
    ): Promise<{ verified: boolean; planExpiry?: string }> => {
      try {
        await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);

        const fn = regionalFunctions().httpsCallable('verifyGooglePlayPurchase');
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

  useEffect(() => {
    initConnection().catch(() => undefined);

    // purchaseUpdatedListener fires for renewals and deferred purchases
    // that complete outside the requestPurchase flow (e.g., Play Store auto-renewal).
    const updateSub = purchaseUpdatedListener((p: Purchase) => {
      if (!p.purchaseToken || !p.productId) {
        return;
      }
      verifyWithServer(p.purchaseToken, p.productId)
        .then(({ verified, planExpiry }) => {
          if (verified) {
            const tier = tierFromSku(p.productId);
            if (tier) {
              setPlan(tier, planExpiry);
            }
            finishTransaction({ purchase: p, isConsumable: false }).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    });
    const errorSub = purchaseErrorListener((_e: PurchaseError) => undefined);

    return () => {
      updateSub.remove();
      errorSub.remove();
      endConnection().catch(() => undefined);
    };
  }, [verifyWithServer, setPlan]);

  const purchase = useCallback(
    async (plan: PurchasePlan): Promise<PurchaseResult> => {
      const tier = tierFromPlan(plan);
      if (tier === currentPlan) {
        return { success: false, reason: 'already_active' };
      }

      setPurchasing(true);
      try {
        const sku = SKU_MAP[plan];

        // Validate SKU is live on Play Console and get the offer token
        // (required by Play Billing Library 8+'s subscriptionOffers param).
        const subs = await fetchProducts({ skus: [sku], type: 'subs' });
        const sub = (Array.isArray(subs) ? subs : []).find(
          (s): s is ProductSubscription => s.id === sku,
        );
        const offerToken =
          sub && 'subscriptionOffers' in sub
            ? sub.subscriptionOffers?.[0]?.offerTokenAndroid
            : undefined;

        // Launch the Google Play subscription sheet
        await requestPurchase({
          type: 'subs',
          request: {
            google: {
              skus: [sku],
              ...(offerToken ? { subscriptionOffers: [{ sku, offerToken }] } : {}),
            },
          },
        });

        // The actual result arrives asynchronously via purchaseUpdatedListener /
        // purchaseErrorListener (registered in the effect above), not this call's
        // return value. Wait for the first purchase or error event for this SKU.
        const p = await new Promise<Purchase | null>(resolve => {
          const updateSub = purchaseUpdatedListener(updatedPurchase => {
            if (updatedPurchase.productId === sku) {
              updateSub.remove();
              errSub.remove();
              resolve(updatedPurchase);
            }
          });
          const errSub = purchaseErrorListener(error => {
            if (!error.productId || error.productId === sku) {
              updateSub.remove();
              errSub.remove();
              resolve(null);
            }
          });
        });

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
        if (err?.code === 'user-cancelled') {
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
        if (!p.purchaseToken || !p.productId) {
          continue;
        }
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
