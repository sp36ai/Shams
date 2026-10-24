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
import { assertSubscriptionActive, isAckFailure } from '../googlePlay';

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

  it('accepts an active subscription with no purchaseState field at all — the actual bug', () => {
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

/**
 * Regression coverage for the silent-acknowledge-failure finding: httpsPostAuth
 * (the Play Developer API's `acknowledge` call) used to resolve on ANY HTTP
 * response regardless of status, so a rejected acknowledgement was
 * indistinguishable from a successful one — verifyGooglePlayPurchase would
 * grant the plan and log nothing, and Google would auto-refund the
 * unacknowledged subscription days later with no trail explaining why.
 * isAckFailure() is the extracted, now-testable predicate that decides
 * whether the call site logs a warning for that response.
 */
describe('isAckFailure', () => {
  it('treats 200 and 204 (Play’s documented success responses) as success', () => {
    expect(isAckFailure(200)).toBe(false);
    expect(isAckFailure(204)).toBe(false);
  });

  it('treats any 4xx or 5xx as a failure worth logging', () => {
    expect(isAckFailure(400)).toBe(true);
    expect(isAckFailure(401)).toBe(true);
    expect(isAckFailure(404)).toBe(true);
    expect(isAckFailure(500)).toBe(true);
    expect(isAckFailure(503)).toBe(true);
  });

  it('treats status 0 (a response with no statusCode at all) as a failure', () => {
    // httpsPostAuth's `res.statusCode ?? 0` fallback — a malformed or
    // connection-reset response should never read as silently successful.
    expect(isAckFailure(0)).toBe(true);
  });

  it('treats other 2xx codes as success, not just 200/204', () => {
    expect(isAckFailure(201)).toBe(false);
  });
});
