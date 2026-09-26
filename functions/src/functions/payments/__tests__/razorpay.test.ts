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

import { extractNonEmptyString, isUnverifiableEntitlementTarget } from '../razorpay';

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

function paymentCapturedPayload(notes: unknown, description = 'plan_mureed_monthly') {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_1',
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
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    await razorpayWebhook(req as never, res as never);

    expect(claimsWrites).toHaveLength(1);
    expect(claimsWrites[0]?.userId).toBe('real-uid-1');
    expect(claimsWrites[0]?.claims).toMatchObject({ admin: true, plan: 'mureed' });
    expect(claimsWrites[0]?.claims.planExpiry).toEqual(expect.any(String));
  });

  it('subscription.activated exercises the same corrected ordering for a genuine, existing uid', async () => {
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

  /* ------------------------------------------------------------------------ */
  /*  Unknown/unmapped plan — regression for the silent-drop finding          */
  /* ------------------------------------------------------------------------ */

  it('payment.captured with an unrecognized plan grants no entitlement and logs a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(
      paymentCapturedPayload({ userId: 'real-uid-1' }, 'plan_does_not_exist'),
    );
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(0);
    expect(claimsWrites).toHaveLength(0);
    expect(
      warnSpy.mock.calls.some(([line]) => String(line).includes('razorpay: unknown plan')),
    ).toBe(true);
    warnSpy.mockRestore();
  });

  it('subscription.activated with an unrecognized plan_id grants no entitlement and logs a warning', async () => {
    // Regression: this branch used to fall through the `if (plan)` guard
    // with no `else` at all — silently dropping the event (200 OK, zero
    // logging, zero audit trail) instead of warning like payment.captured's
    // own unknown-plan branch already did. A payer would be charged by
    // Razorpay and never upgraded, with nothing in Cloud Logging to explain
    // why — see razorpay.ts's fix for the full account.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes({
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_unknown_plan',
            plan_id: 'plan_does_not_exist',
            notes: { userId: 'real-uid-1' },
          },
        },
      },
    });
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(0);
    expect(claimsWrites).toHaveLength(0);
    expect(
      warnSpy.mock.calls.some(([line]) =>
        String(line).includes('razorpay subscription.activated: unknown plan'),
      ),
    ).toBe(true);
    warnSpy.mockRestore();
  });
});
