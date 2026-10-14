/**
 * useCoinPurchase — buying coin packs through Google Play.
 *
 * The server decides what is credited: verifyCoinPurchase checks the
 * purchase with Google Play, credits the wallet once per purchase and
 * consumes it. The app only launches the Play sheet, sends the purchase
 * token for verification, finishes the transaction as a consumable and
 * shows the balance the server returns.
 *
 * A purchase whose verification did not complete (app closed, network lost)
 * stays unfinished on Play; every time this hook mounts it sends any such
 * coin purchase for verification again. That is safe because the server
 * credits each purchase only once.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type Purchase,
} from 'react-native-iap';

import { regionalFunctions } from '../firebase/functionsRegion';
import { ensureAppCheckReady } from '../firebase/appCheck';
import { withTimeout } from '../utils/withTimeout';
import { useWalletStore } from '@stores/walletStore';
import { COIN_SKUS, isCoinSku } from '../data/coinPacks';

const PACKAGE_NAME = 'com.astrosarfaraz.shamsalasrar';
const APP_CHECK_GATE_TIMEOUT_MS = 10_000;

export type CoinPurchaseResult =
  | { status: 'credited'; creditedMilli: number }
  | { status: 'pending' | 'cancelled' | 'failed' | 'unavailable' };

interface VerifyResponse {
  creditedMilli?: unknown;
  balanceMilli?: unknown;
}

export interface CoinPurchaseState {
  /** Localised Play price per SKU, once loaded (e.g. "₹100.00"). */
  prices: Record<string, string>;
  /** The SKU being bought, or null. */
  buying: string | null;
  buy: (sku: string) => Promise<CoinPurchaseResult>;
}

/** Ask the server to verify and credit; returns what it credited, or null. */
async function verifyCoins(p: Purchase): Promise<{ creditedMilli: number } | null> {
  try {
    await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);
    const fn = regionalFunctions().httpsCallable('verifyCoinPurchase');
    const result = await fn({
      purchaseToken: p.purchaseToken,
      productId: p.productId,
      packageName: PACKAGE_NAME,
    });
    const data = (result.data ?? {}) as VerifyResponse;
    if (typeof data.balanceMilli === 'number') {
      useWalletStore.getState().update({ balanceMilli: data.balanceMilli });
    }
    await finishTransaction({ purchase: p, isConsumable: true }).catch(() => undefined);
    return { creditedMilli: typeof data.creditedMilli === 'number' ? data.creditedMilli : 0 };
  } catch {
    return null;
  }
}

export function useCoinPurchase(enabled: boolean): CoinPurchaseState {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await initConnection();
        const products = await fetchProducts({ skus: [...COIN_SKUS], type: 'in-app' });
        const next: Record<string, string> = {};
        for (const product of Array.isArray(products) ? products : []) {
          if (isCoinSku(product.id) && typeof product.displayPrice === 'string') {
            next[product.id] = product.displayPrice;
          }
        }
        if (!cancelled) {
          setPrices(next);
        }
        // Recover coin purchases whose verification never completed.
        const owned = await getAvailablePurchases();
        for (const p of owned) {
          if (p.purchaseToken && isCoinSku(p.productId) && p.purchaseState === 'purchased') {
            await verifyCoins(p);
          }
        }
      } catch {
        // Store unavailable (no Play services, emulator): packs show no price.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const buy = useCallback(async (sku: string): Promise<CoinPurchaseResult> => {
    if (!isCoinSku(sku)) {
      return { status: 'unavailable' };
    }
    setBuying(sku);
    try {
      await initConnection();
      const products = await fetchProducts({ skus: [sku], type: 'in-app' });
      if (!(Array.isArray(products) ? products : []).some(product => product.id === sku)) {
        return { status: 'unavailable' };
      }

      const waitForResult = new Promise<Purchase | null>(resolve => {
        const updateSub = purchaseUpdatedListener(p => {
          if (p.productId === sku) {
            updateSub.remove();
            errSub.remove();
            resolve(p);
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
      await requestPurchase({ type: 'in-app', request: { google: { skus: [sku] } } });
      const p = await waitForResult;

      if (!p?.purchaseToken) {
        return { status: 'cancelled' };
      }
      if (p.purchaseState === 'pending') {
        return { status: 'pending' };
      }
      const verified = await verifyCoins(p);
      return verified === null
        ? { status: 'failed' }
        : { status: 'credited', creditedMilli: verified.creditedMilli };
    } catch (error: unknown) {
      return (error as { code?: string })?.code === 'user-cancelled'
        ? { status: 'cancelled' }
        : { status: 'failed' };
    } finally {
      setBuying(null);
    }
  }, []);

  return { prices, buying, buy };
}
