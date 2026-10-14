/**
 * Coin packs: only a completed purchase is credited (never a pending or
 * cancelled one).
 */

import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { assertProductPurchased } from '../googlePlayCoins';
import { COIN_PACKS } from '../../../config';

describe('assertProductPurchased', () => {
  it('accepts purchaseState 0 (purchased)', () => {
    expect(() => assertProductPurchased({ purchaseState: 0 })).not.toThrow();
  });

  it.each([1, 2, undefined])('rejects purchaseState %s', state => {
    expect(() => assertProductPurchased({ purchaseState: state })).toThrow(HttpsError);
  });
});

describe('COIN_PACKS', () => {
  it('sells 10, 30 and 100 coins at ₹10 a coin (owner decision 2026-10-14)', () => {
    expect(COIN_PACKS).toEqual({ shams_coins_10: 10, shams_coins_30: 30, shams_coins_100: 100 });
  });
});
