/**
 * PHASE 6A-R1 — permanent regression coverage for the razorpayWebhook
 * fail-safe boundary hardening.
 * --------------------------------------------------------------------------
 * Closes the secondary finding recorded at
 * docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md §5: the entitlement
 * target named in a webhook payload's `notes.userId` was only truthy-
 * checked (`!userId`), not type-checked, and a genuinely nonexistent uid
 * fell into the same generic failure bucket as any transient error. This
 * does NOT invent a payer/order-binding mechanism this repository has no
 * code for — see razorpay.ts's own header for the stated trust-model
 * boundary this phase deliberately leaves unresolved.
 *
 * No test file existed for razorpay.ts before this phase — see this
 * document's own audit record (docs/audit/PHASE_6A_R1_...) for that
 * disclosure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';

const WEBHOOK_SECRET = 'test-webhook-secret';
const securityEvents: Array<Record<string, unknown>> = [];
const auditLogs: Array<Record<string, unknown>> = [];
const quotaWrites: Array<{ userId: string; data: Record<string, unknown> }> = [];
const claimsWrites: Array<{ userId: string; claims: Record<string, unknown> }> = [];
const claimedEvents = new Set<string>();
// Issue #129: this system's own order/subscription ledger — the only
// source of uid/plan the webhook trusts. Keyed by `${collection}/${id}`.
const ledger = new Map<string, Record<string, unknown>>();
function bindOrder(orderId: string, data: Record<string, unknown>): void {
  ledger.set(`razorpayOrders/${orderId}`, data);
}
function bindSubscription(subscriptionId: string, data: Record<string, unknown>): void {
  ledger.set(`razorpaySubscriptions/${subscriptionId}`, data);
}
const existingAuthUsers = new Set<string>(['real-uid-1']);
// Pre-existing custom claims on real-uid-1, to prove they survive a merge
// (admin: true must never be wiped by an entitlement update).
const existingClaimsByUid = new Map<string, Record<string, unknown>>([
  ['real-uid-1', { admin: true }],
]);

function reset(): void {
  securityEvents.length = 0;
  auditLogs.length = 0;
  quotaWrites.length = 0;
  claimsWrites.length = 0;
  claimedEvents.clear();
  ledger.clear();
}

vi.mock('../../../config', () => ({
  RAZORPAY_WEBHOOK_SECRET: { value: () => WEBHOOK_SECRET },
  REGION: 'asia-south1',
  PLAN_DURATION_DAYS: { free: 0, mureed: 31, khass: 31 },
}));

vi.mock('../../../utils/admin', () => ({
  db: {
    collection: (name: string) => {
      if (name === 'securityEvents') {
        return {
          add: (data: Record<string, unknown>) => {
            securityEvents.push(data);
            return Promise.resolve();
          },
        };
      }
      if (name === 'auditLogs') {
        return {
          add: (data: Record<string, unknown>) => {
            auditLogs.push(data);
            return Promise.resolve();
          },
        };
      }
      if (name === 'webhookEvents') {
        return {
          doc: (key: string) => ({
            get: () => Promise.resolve({ exists: claimedEvents.has(key) }),
            set: () => {
              claimedEvents.add(key);
              return Promise.resolve();
            },
            delete: () => {
              claimedEvents.delete(key);
              return Promise.resolve();
            },
          }),
        };
      }
      if (name === 'razorpayOrders' || name === 'razorpaySubscriptions') {
        return {
          doc: (id: string) => ({
            get: () => {
              const data = ledger.get(`${name}/${id}`);
              return Promise.resolve({ exists: data !== undefined, data: () => data });
            },
          }),
        };
      }
      if (name === 'quotas') {
        return {
          doc: (userId: string) => ({
            set: (data: Record<string, unknown>) => {
              quotaWrites.push({ userId, data });
              return Promise.resolve();
            },
          }),
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
    runTransaction: (fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          get: (ref: { get: () => unknown }) => Promise.resolve(ref.get()),
          set: (ref: { set: (d: unknown) => void }, data: unknown) => ref.set(data),
        }),
      ),
  },
  auth: {
    getUser: (uid: string) => {
      if (!existingAuthUsers.has(uid)) {
        const err = new Error('no user record') as Error & { code: string };
        err.code = 'auth/user-not-found';
        return Promise.reject(err);
      }
      return Promise.resolve({ customClaims: existingClaimsByUid.get(uid) ?? {} });
    },
    setCustomUserClaims: (uid: string, claims: Record<string, unknown>) => {
      claimsWrites.push({ userId: uid, claims });
      return Promise.resolve(undefined);
    },
  },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  extractNonEmptyString,
  isUnverifiableEntitlementTarget,
  resolveLedgerBinding,
} from '../razorpay';

beforeEach(() => {
  reset();
});

/* -------------------------------------------------------------------------- */
/*  Pure helpers                                                             */
/* -------------------------------------------------------------------------- */

describe('PHASE 6A-R1 — extractNonEmptyString', () => {
  it('accepts a genuine non-empty string', () => {
    expect(extractNonEmptyString('user-123')).toBe('user-123');
  });

  it('trims surrounding whitespace', () => {
    expect(extractNonEmptyString('  user-123  ')).toBe('user-123');
  });

  it.each([undefined, null, '', '   ', 42, 0, true, false, {}, [], []])(
    'rejects malformed/absent value %p',
    value => {
      expect(extractNonEmptyString(value)).toBeUndefined();
    },
  );
});

describe('PHASE 6A-R1 — isUnverifiableEntitlementTarget', () => {
  it('recognizes auth/user-not-found', () => {
    const err = Object.assign(new Error('x'), { code: 'auth/user-not-found' });
    expect(isUnverifiableEntitlementTarget(err)).toBe(true);
  });

  it('does not misclassify an unrelated error', () => {
    expect(isUnverifiableEntitlementTarget(new Error('transient'))).toBe(false);
    expect(
      isUnverifiableEntitlementTarget(Object.assign(new Error('x'), { code: 'internal' })),
    ).toBe(false);
  });

  it('handles non-object values safely', () => {
    expect(isUnverifiableEntitlementTarget(undefined)).toBe(false);
    expect(isUnverifiableEntitlementTarget('a string')).toBe(false);
    expect(isUnverifiableEntitlementTarget(null)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  End-to-end webhook boundary                                              */
/* -------------------------------------------------------------------------- */

function sign(body: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function fakeReqRes(bodyObj: unknown) {
  const bodyStr = JSON.stringify(bodyObj);
  const rawBody = Buffer.from(bodyStr, 'utf8');
  const req = {
    method: 'POST',
    headers: {
      'x-razorpay-signature': sign(bodyStr),
    },
    rawBody,
    ip: '203.0.113.7',
    socket: { remoteAddress: '203.0.113.7' },
  };
  let statusCode = 0;
  let body = '';
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    send(b: string) {
      body = b;
    },
    set() {
      return this;
    },
    on() {
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
  return { req, res };
}

function paymentCapturedPayload(
  notes: unknown,
  description = 'plan_mureed_monthly',
  orderId: string | null = 'order_test_1', // null = omit order_id
) {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_1',
          ...(orderId !== null ? { order_id: orderId } : {}),
          description,
          notes,
        },
      },
    },
  };
}

describe('PHASE 6A-R1 — razorpayWebhook fail-safe boundary (end to end)', () => {
  it('a malformed notes.userId (a JSON number, not a string) grants no entitlement', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 12345 }));
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200); // acknowledged to Razorpay, not retried
    expect(quotaWrites).toHaveLength(0); // but no entitlement was ever granted
  });

  it('an absent notes.userId grants no entitlement (pre-existing behavior, reconfirmed)', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({}));
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(0);
  });

  it('a well-formed but nonexistent uid produces ZERO entitlement mutation — the §C hard-stop, now closed', async () => {
    // PHASE 6A-R1 continuation (closes the §C hard-stop reported in
    // docs/audit/PHASE_6A_R1_OWNERSHIP_ENTITLEMENT_HARDENING.md):
    // upgradePlan() previously wrote /quotas/{userId} BEFORE calling
    // auth.getUser(userId) to verify the uid exists at all — a
    // nonexistent uid still received an orphaned Firestore write. This
    // test proves the corrected ordering: auth.getUser() runs first,
    // throws for a nonexistent uid, and NEITHER the Firestore quota
    // document NOR the Auth custom claim is ever touched.
    // Issue #129: the uid now comes from the ledger, so the ledger is what
    // names the nonexistent account here.
    bindOrder('order_test_1', { uid: 'ghost-uid-does-not-exist', planId: 'plan_mureed_monthly' });
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'ghost-uid-does-not-exist' }));
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200); // still acknowledged — Razorpay must not retry forever
    // The fix: zero entitlement mutation of any kind for an unverified uid.
    expect(quotaWrites).toHaveLength(0);
    expect(claimsWrites).toHaveLength(0);
    // The failure is recorded as a distinct, higher-signal security event,
    // not folded into the same generic bucket as a transient error.
    expect(
      securityEvents.some(
        e =>
          e.type === 'razorpay_entitlement_target_unverifiable' &&
          e.userId === 'ghost-uid-does-not-exist',
      ),
    ).toBe(true);
    // The generic failure bucket still also records it — additive, not replaced.
    expect(auditLogs.some(a => a.action === 'payment_razorpay_fail')).toBe(true);
  });

  it('the same nonexistent-uid guarantee holds for subscription.activated, not only payment.captured', async () => {
    bindSubscription('sub_test_ghost', {
      uid: 'ghost-uid-does-not-exist',
      planId: 'plan_mureed_monthly',
    });
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes({
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_ghost',
            plan_id: 'plan_mureed_monthly',
            notes: { userId: 'ghost-uid-does-not-exist' },
          },
        },
      },
    });
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(0);
    expect(claimsWrites).toHaveLength(0);
    expect(
      securityEvents.some(
        e =>
          e.type === 'razorpay_entitlement_target_unverifiable' &&
          e.userId === 'ghost-uid-does-not-exist',
      ),
    ).toBe(true);
  });

  it('a genuine, well-formed, existing uid still receives its entitlement — no regression', async () => {
    bindOrder('order_test_1', { uid: 'real-uid-1', planId: 'plan_mureed_monthly' });
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(1);
    expect(quotaWrites[0]?.userId).toBe('real-uid-1');
    expect(quotaWrites[0]?.data.plan).toBe('mureed');
    // Existing plan/expiry write shape is unchanged by the reorder.
    expect(quotaWrites[0]?.data.planExpiry).toEqual(expect.any(String));
    expect(securityEvents).toHaveLength(0);
  });

  it('existing custom claims (e.g. admin: true) survive the merge — the reorder did not change claim semantics', async () => {
    bindOrder('order_test_1', { uid: 'real-uid-1', planId: 'plan_mureed_monthly' });
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    await razorpayWebhook(req as never, res as never);

    expect(claimsWrites).toHaveLength(1);
    expect(claimsWrites[0]?.userId).toBe('real-uid-1');
    expect(claimsWrites[0]?.claims).toMatchObject({ admin: true, plan: 'mureed' });
    expect(claimsWrites[0]?.claims.planExpiry).toEqual(expect.any(String));
  });

  it('subscription.activated exercises the same corrected ordering for a genuine, existing uid', async () => {
    bindSubscription('sub_test_real', { uid: 'real-uid-1', planId: 'plan_khass_annual' });
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes({
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_real',
            plan_id: 'plan_khass_annual',
            notes: { userId: 'real-uid-1' },
          },
        },
      },
    });
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(1);
    expect(quotaWrites[0]?.data.plan).toBe('khass');
    expect(claimsWrites).toHaveLength(1);
    expect(claimsWrites[0]?.claims).toMatchObject({ admin: true, plan: 'khass' });
  });

  it('idempotency/replay behavior is unchanged — a duplicate payment.captured event grants entitlement only once', async () => {
    bindOrder('order_test_1', { uid: 'real-uid-1', planId: 'plan_mureed_monthly' });
    const { razorpayWebhook } = await import('../razorpay');
    const payload = paymentCapturedPayload({ userId: 'real-uid-1' });

    const first = fakeReqRes(payload);
    await razorpayWebhook(first.req as never, first.res as never);
    const second = fakeReqRes(payload);
    await razorpayWebhook(second.req as never, second.res as never);

    expect(first.res.statusCode).toBe(200);
    expect(second.res.statusCode).toBe(200);
    // Same paymentId ("pay_test_1") both times — claimWebhookEvent's
    // existing dedup must still suppress the second write.
    expect(quotaWrites).toHaveLength(1);
    expect(claimsWrites).toHaveLength(1);
  });

  it('an invalid HMAC signature is still rejected outright — untouched by this phase', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    (req.headers as Record<string, string>)['x-razorpay-signature'] = 'deadbeef'.repeat(8);
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(quotaWrites).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Issue #129 — entitlement bound to this system's own ledger               */
/* -------------------------------------------------------------------------- */

describe('Issue #129 — resolveLedgerBinding', () => {
  it('resolves uid and planId from a well-formed ledger record', async () => {
    bindOrder('order_ok', { uid: 'real-uid-1', planId: 'plan_mureed_monthly' });
    await expect(resolveLedgerBinding('razorpayOrders', 'order_ok')).resolves.toEqual({
      ok: true,
      uid: 'real-uid-1',
      planId: 'plan_mureed_monthly',
    });
  });

  it('an absent entity id is not bound', async () => {
    await expect(resolveLedgerBinding('razorpayOrders', undefined)).resolves.toEqual({
      ok: false,
      reason: 'missing_entity_id',
    });
  });

  it('an id this system never created is not bound', async () => {
    await expect(resolveLedgerBinding('razorpayOrders', 'order_unknown')).resolves.toEqual({
      ok: false,
      reason: 'not_in_ledger',
    });
  });

  it.each([
    [{ planId: 'plan_mureed_monthly' }],
    [{ uid: 'real-uid-1' }],
    [{ uid: 42, planId: 'plan_mureed_monthly' }],
    [{ uid: '  ', planId: 'plan_mureed_monthly' }],
  ])('a malformed ledger record %p is not bound', async record => {
    bindOrder('order_bad', record);
    await expect(resolveLedgerBinding('razorpayOrders', 'order_bad')).resolves.toEqual({
      ok: false,
      reason: 'malformed_ledger_record',
    });
  });

  it('does not read one ledger when asked for the other', async () => {
    bindOrder('shared_id', { uid: 'real-uid-1', planId: 'plan_mureed_monthly' });
    await expect(resolveLedgerBinding('razorpaySubscriptions', 'shared_id')).resolves.toEqual({
      ok: false,
      reason: 'not_in_ledger',
    });
  });
});

describe('Issue #129 — razorpayWebhook grants only ledger-bound entitlements', () => {
  it('THE FINDING: a genuinely signed payment whose notes.userId names a real account, for an order this system never created, grants nothing', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200); // acknowledged, so Razorpay stops retrying
    expect(quotaWrites).toHaveLength(0);
    expect(claimsWrites).toHaveLength(0);
    expect(securityEvents).toContainEqual(
      expect.objectContaining({
        type: 'razorpay_unbound_entitlement',
        event: 'payment.captured',
        reason: 'not_in_ledger',
        entityId: 'order_test_1',
        claimedUserId: 'real-uid-1',
      }),
    );
  });

  it('a payment with no order_id grants nothing', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(
      paymentCapturedPayload({ userId: 'real-uid-1' }, 'plan_mureed_monthly', null),
    );
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(0);
    expect(securityEvents).toContainEqual(
      expect.objectContaining({
        type: 'razorpay_unbound_entitlement',
        reason: 'missing_entity_id',
      }),
    );
  });

  it('a malformed ledger record grants nothing', async () => {
    bindOrder('order_test_1', { uid: 'real-uid-1' }); // no planId
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    await razorpayWebhook(req as never, res as never);

    expect(quotaWrites).toHaveLength(0);
    expect(securityEvents).toContainEqual(
      expect.objectContaining({ reason: 'malformed_ledger_record' }),
    );
  });

  it('the grant goes to the ledger uid, never the payload notes.userId', async () => {
    existingAuthUsers.add('attacker-uid');
    try {
      bindOrder('order_test_1', { uid: 'real-uid-1', planId: 'plan_mureed_monthly' });
      const { razorpayWebhook } = await import('../razorpay');
      const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'attacker-uid' }));
      await razorpayWebhook(req as never, res as never);

      expect(quotaWrites).toHaveLength(1);
      expect(quotaWrites[0]?.userId).toBe('real-uid-1');
      expect(claimsWrites.map(c => c.userId)).toEqual(['real-uid-1']);
    } finally {
      existingAuthUsers.delete('attacker-uid');
    }
  });

  it('the plan comes from the ledger, never the payload description/notes', async () => {
    bindOrder('order_test_1', { uid: 'real-uid-1', planId: 'plan_mureed_monthly' });
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(
      paymentCapturedPayload(
        { userId: 'real-uid-1', planId: 'plan_khass_annual' },
        'plan_khass_annual',
      ),
    );
    await razorpayWebhook(req as never, res as never);

    expect(quotaWrites).toHaveLength(1);
    expect(quotaWrites[0]?.data.plan).toBe('mureed');
  });

  it('subscription.activated for a subscription this system never created grants nothing', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes({
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_forged',
            plan_id: 'plan_khass_annual',
            notes: { userId: 'real-uid-1' },
          },
        },
      },
    });
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(0);
    expect(claimsWrites).toHaveLength(0);
    expect(securityEvents).toContainEqual(
      expect.objectContaining({
        type: 'razorpay_unbound_entitlement',
        event: 'subscription.activated',
        reason: 'not_in_ledger',
        entityId: 'sub_forged',
      }),
    );
  });

  it('an unbound event does not consume the idempotency claim', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    await razorpayWebhook(req as never, res as never);

    expect(claimedEvents.size).toBe(0);
  });
});
