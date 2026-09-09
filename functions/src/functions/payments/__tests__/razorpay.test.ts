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
const claimedEvents = new Set<string>();
const existingAuthUsers = new Set<string>(['real-uid-1']);

function reset(): void {
  securityEvents.length = 0;
  auditLogs.length = 0;
  quotaWrites.length = 0;
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
      return Promise.resolve({ customClaims: {} });
    },
    setCustomUserClaims: () => Promise.resolve(undefined),
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

  it('a well-formed but nonexistent uid is recorded as a distinct securityEvent — KNOWN OPEN GAP: the quota write still happens first', async () => {
    // PHASE 6A-R1 HARD-STOP (reported, not remediated — see
    // docs/audit/PHASE_6A_R1_OWNERSHIP_ENTITLEMENT_HARDENING.md §C):
    // upgradePlan() writes /quotas/{userId} BEFORE calling
    // auth.getUser(userId) to verify the uid exists at all. This test
    // pins that CURRENT, NOT-YET-FIXED behavior exactly as found —
    // discovered by this very test during 6A-R1's own development — so
    // a future fix changes this assertion, not silently regresses past
    // an unnoticed one. This is not treated as safe; it is the open
    // finding itself, documented in the permanent suite per this
    // project's own evidence-over-assumption discipline.
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'ghost-uid-does-not-exist' }));
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200); // still acknowledged — Razorpay must not retry forever
    // KNOWN GAP, not the intended final behavior: the Firestore quota
    // write already happened before auth.getUser() rejected the uid.
    expect(quotaWrites).toHaveLength(1);
    expect(quotaWrites[0]?.userId).toBe('ghost-uid-does-not-exist');
    // What DID get fixed in this phase: the failure is now recorded as
    // a distinct, higher-signal security event, not folded into the
    // same generic bucket as a transient error.
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

  it('a genuine, well-formed, existing uid still receives its entitlement — no regression', async () => {
    const { razorpayWebhook } = await import('../razorpay');
    const { req, res } = fakeReqRes(paymentCapturedPayload({ userId: 'real-uid-1' }));
    await razorpayWebhook(req as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(quotaWrites).toHaveLength(1);
    expect(quotaWrites[0]?.userId).toBe('real-uid-1');
    expect(quotaWrites[0]?.data.plan).toBe('mureed');
    expect(securityEvents).toHaveLength(0);
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
