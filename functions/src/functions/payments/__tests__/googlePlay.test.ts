/**
 * Regression coverage for assertSubscriptionActive() — the purchaseState bug.
 *
 * purchases.subscriptions (v3), the endpoint verifyGooglePlayPurchase
 * actually calls, does not return a `purchaseState` field on its response.
 * That field only exists on the *products* resource (one-time purchases).
 * The original code declared `purchaseState` on its SubscriptionPurchase
 * interface anyway and gated active status on `purchase.purchaseState !== 0`
 * — which is `undefined !== 0`, always true, so every real subscription was
 * rejected as "not active" regardless of its actual state. This suite pins
 * the fix: active status must come from `paymentState` + `expiryTimeMillis`,
 * the fields the real API response actually has.
 */

import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { assertSubscriptionActive } from '../googlePlay';

const NOW = 1_700_000_000_000;
const FUTURE = String(NOW + 30 * 24 * 60 * 60 * 1000);
const PAST = String(NOW - 1000);

function purchase(overrides: { paymentState?: number; expiryTimeMillis?: string }) {
  return {
    acknowledgementState: 1,
    orderId: 'GPA.0000-0000-0000-00000',
    startTimeMillis: String(NOW - 1000),
    expiryTimeMillis: FUTURE,
    ...overrides,
  };
}

describe('assertSubscriptionActive', () => {
  it('accepts paymentState 1 (payment received) with a future expiry', () => {
    const expiresAt = assertSubscriptionActive(purchase({ paymentState: 1 }), NOW);
    expect(expiresAt).toEqual(new Date(Number(FUTURE)));
  });

  it('accepts paymentState 2 (free trial) with a future expiry', () => {
    const expiresAt = assertSubscriptionActive(purchase({ paymentState: 2 }), NOW);
    expect(expiresAt).toEqual(new Date(Number(FUTURE)));
  });

  it('rejects an active subscription with no purchaseState field — the actual bug', () => {
    // Real v3 subscriptions.get responses never carry purchaseState at all;
    // this is what "undefined !== 0, always true" looked like in practice.
    // paymentState IS present here (a real active subscription), and that
    // must be enough on its own.
    const realResponseShape = purchase({ paymentState: 1 }) as Record<string, unknown>;
    expect('purchaseState' in realResponseShape).toBe(false);
    expect(() => assertSubscriptionActive(realResponseShape as never, NOW)).not.toThrow();
  });

  it('rejects paymentState 0 (payment pending)', () => {
    expect(() => assertSubscriptionActive(purchase({ paymentState: 0 }), NOW)).toThrow(HttpsError);
  });

  it('rejects a missing paymentState', () => {
    expect(() => assertSubscriptionActive(purchase({}), NOW)).toThrow(HttpsError);
  });

  it('rejects an expired subscription even with an active paymentState', () => {
    expect(() =>
      assertSubscriptionActive(purchase({ paymentState: 1, expiryTimeMillis: PAST }), NOW),
    ).toThrow('expired');
  });

  it('rejects a non-numeric expiryTimeMillis', () => {
    expect(() =>
      assertSubscriptionActive(
        purchase({ paymentState: 1, expiryTimeMillis: 'not-a-number' }),
        NOW,
      ),
    ).toThrow(HttpsError);
  });
});
