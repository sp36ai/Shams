/**
 * verifyCoinPurchase — verifies a Google Play coin pack (a consumable
 * one-time product) and credits the seeker's wallet exactly once.
 *
 * Flow:
 *   1. App Check + Firebase Auth, rate limit, validate input
 *   2. Look the product id up in COIN_PACKS (owner decision 2026-10-14)
 *   3. purchases.products.get — the purchase must be in the Purchased state
 *   4. creditCoinPurchase: bind the token to this account and credit the
 *      wallet in one transaction (a repeat verification credits nothing)
 *   5. purchases.products.consume, so the same pack can be bought again
 *      (consuming also acknowledges, which stops Play's 3-day auto-refund)
 *   6. Return what was credited and the new balance
 *
 * Uses the same service-account credentials and REST helpers as
 * verifyGooglePlayPurchase (subscriptions).
 *
 * Reference: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../utils/admin';
import { verifyAuth } from '../../middleware/auth';
import { parse, VerifyGooglePlaySchema } from '../../middleware/validate';
import { enforceRateLimit } from '../../middleware/rateLimit';
import { logger } from '../../utils/logger';
import { requestMetaFromCallable } from '../../utils/requestMeta';
import { creditCoinPurchase } from '../../utils/wallet';
import {
  COIN_PACKS,
  FUNCTION_OPTS,
  GOOGLE_PLAY_CLIENT_EMAIL,
  GOOGLE_PLAY_PRIVATE_KEY,
  MILLI_PER_COIN,
} from '../../config';
import {
  getGoogleAccessToken,
  hashPurchaseToken,
  httpsGet,
  httpsPostAuth,
  isAckFailure,
} from './googlePlay';

/** purchases.products (v3) resource — the fields this function reads. */
interface ProductPurchase {
  purchaseState?: number; // 0 = purchased, 1 = canceled, 2 = pending
  consumptionState?: number; // 0 = yet to be consumed, 1 = consumed
  orderId?: string;
}

/**
 * Throw unless the one-time purchase is completed and paid. A pending
 * purchase (e.g. cash payment not yet made) or a cancelled one is never
 * credited. Exported for unit testing.
 */
export function assertProductPurchased(purchase: ProductPurchase): void {
  if (purchase.purchaseState !== 0) {
    throw new HttpsError('failed-precondition', 'Purchase is not completed');
  }
}

export const verifyCoinPurchase = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    secrets: [GOOGLE_PLAY_CLIENT_EMAIL, GOOGLE_PLAY_PRIVATE_KEY],
  },
  async request => {
    const startedAt = Date.now();
    const requestMeta = requestMetaFromCallable(request);
    const { userId } = verifyAuth(request);
    await enforceRateLimit(userId);
    const input = parse(VerifyGooglePlaySchema, request.data);

    const coins = COIN_PACKS[input.productId];
    if (coins === undefined) {
      throw new HttpsError('invalid-argument', `Unknown coin pack: ${input.productId}`);
    }

    try {
      const accessToken = await getGoogleAccessToken();
      const purchaseUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/purchases/products/${input.productId}/tokens/${input.purchaseToken}`;
      const { status, body } = await httpsGet(purchaseUrl, accessToken);
      if (status !== 200) {
        logger.warn('play coin purchase verification failed', {
          userId,
          status,
          body: body.slice(0, 200),
          ipHash: requestMeta.ipHash,
          durationMs: Date.now() - startedAt,
        });
        throw new HttpsError('invalid-argument', 'Purchase could not be verified');
      }

      const purchase = JSON.parse(body) as ProductPurchase;
      assertProductPurchased(purchase);
      const orderId = purchase.orderId ?? '';

      const result = await creditCoinPurchase(userId, hashPurchaseToken(input.purchaseToken), {
        productId: input.productId,
        orderId,
        amountMilli: coins * MILLI_PER_COIN,
      });

      if (result.status === 'other_account') {
        logger.warn('play coin purchase token already bound to a different account', {
          userId,
          ipHash: requestMeta.ipHash,
          durationMs: Date.now() - startedAt,
        });
        await db.collection('securityEvents').add({
          type: 'play_purchase_token_reuse',
          userId,
          source: requestMeta.source,
          ipHash: requestMeta.ipHash,
          userAgent: requestMeta.userAgent,
          ts: FieldValue.serverTimestamp(),
        });
        throw new HttpsError(
          'already-exists',
          'This purchase is already linked to a different account.',
        );
      }

      // Consume after crediting, so the pack can be bought again. Non-fatal:
      // the coins are already credited, and the app also consumes the
      // purchase when it finishes the transaction.
      if (purchase.consumptionState !== 1) {
        const consumed = await httpsPostAuth(`${purchaseUrl}:consume`, accessToken);
        if (isAckFailure(consumed.status)) {
          logger.warn('play coin purchase consume failed — app will retry', {
            userId,
            status: consumed.status,
            body: consumed.body.slice(0, 200),
            ipHash: requestMeta.ipHash,
            durationMs: Date.now() - startedAt,
          });
        }
      }

      const creditedMilli = result.status === 'credited' ? result.creditedMilli : 0;
      logger.info('play coin purchase verified', {
        userId,
        productId: input.productId,
        orderId,
        creditedMilli,
        alreadyCredited: result.status === 'already_credited',
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      if (result.status === 'credited') {
        await db.collection('auditLogs').add({
          userId,
          action: 'payment_coins_ok',
          productId: input.productId,
          creditedMilli,
          source: requestMeta.source,
          ipHash: requestMeta.ipHash,
          userAgent: requestMeta.userAgent,
          durationMs: Date.now() - startedAt,
          ts: FieldValue.serverTimestamp(),
        });
      }

      return { creditedMilli, balanceMilli: result.balanceMilli };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      logger.error('verifyCoinPurchase error', {
        userId,
        err: String(err),
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      await db.collection('auditLogs').add({
        userId,
        action: 'payment_coins_fail',
        err: String(err),
        source: requestMeta.source,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
        ts: FieldValue.serverTimestamp(),
      });
      throw new HttpsError('internal', 'Purchase verification failed');
    }
  },
);
