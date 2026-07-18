import { describe, it, expect, vi } from 'vitest';

// ── Mocks — googlePlay.ts registers an onCall function and pulls firebase-admin
//    at import time; stub the side-effecting deps so we can import the pure
//    assertSubscriptionActive helper in isolation. ───────────────────────────

vi.mock('firebase-functions/v2/https', () => {
  // Defined inside the factory — vi.mock is hoisted above top-level declarations.
  class MockHttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    onCall: (_opts: unknown, handler: unknown) => handler,
    HttpsError: MockHttpsError,
  };
});
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__ts__' },
}));
vi.mock('../../../utils/admin', () => ({
  db: { collection: () => ({ doc: () => ({}) }), runTransaction: vi.fn() },
  auth: {},
}));
vi.mock('../../../middleware/auth', () => ({ verifyAuth: vi.fn() }));
vi.mock('../../../middleware/validate', () => ({ parse: vi.fn(), VerifyGooglePlaySchema: {} }));
vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../utils/requestMeta', () => ({ requestMetaFromCallable: vi.fn() }));
vi.mock('../../../config', () => ({
  FUNCTION_OPTS: {},
  GOOGLE_PLAY_CLIENT_EMAIL: { value: () => '' },
  GOOGLE_PLAY_PRIVATE_KEY: { value: () => '' },
  PLAY_PRODUCT_MAP: {},
}));

// ── Subject under test ───────────────────────────────────────────────────────

import { assertSubscriptionActive } from '../googlePlay';

const NOW = 1_700_000_000_000;
const FUTURE = String(NOW + 31 * 24 * 60 * 60 * 1000);
const PAST = String(NOW - 1000);

const base = {
  acknowledgementState: 1,
  orderId: 'GPA.1234',
  startTimeMillis: String(NOW - 1000),
  expiryTimeMillis: FUTURE,
};

function throwCode(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

describe('assertSubscriptionActive', () => {
  it('accepts an active subscription that has NO purchaseState field (regression)', () => {
    // A real purchases.subscriptions v3 resource never returns purchaseState.
    // The previous `purchaseState !== 0` check rejected every such purchase.
    const expiry = assertSubscriptionActive({ ...base, paymentState: 1 }, NOW);
    expect(expiry.getTime()).toBe(Number(FUTURE));
  });

  it('accepts a free-trial subscription (paymentState 2)', () => {
    const expiry = assertSubscriptionActive({ ...base, paymentState: 2 }, NOW);
    expect(expiry.getTime()).toBe(Number(FUTURE));
  });

  it('rejects a pending payment (paymentState 0)', () => {
    expect(throwCode(() => assertSubscriptionActive({ ...base, paymentState: 0 }, NOW))).toBe(
      'failed-precondition',
    );
  });

  it('rejects when paymentState is absent', () => {
    expect(throwCode(() => assertSubscriptionActive({ ...base }, NOW))).toBe('failed-precondition');
  });

  it('rejects an expired subscription even when payment was received', () => {
    expect(
      throwCode(() =>
        assertSubscriptionActive({ ...base, paymentState: 1, expiryTimeMillis: PAST }, NOW),
      ),
    ).toBe('failed-precondition');
  });

  it('rejects a non-numeric expiry', () => {
    expect(
      throwCode(() =>
        assertSubscriptionActive({ ...base, paymentState: 1, expiryTimeMillis: 'nope' }, NOW),
      ),
    ).toBe('failed-precondition');
  });
});
