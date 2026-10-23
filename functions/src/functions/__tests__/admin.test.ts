/**
 * PHASE 6C-2 — permanent regression coverage for setAdminClaim's rate limiting.
 * --------------------------------------------------------------------------
 * Closes Finding 2 from docs/audit/PHASE_6B_CLOSURE.md §2: setAdminClaim
 * (like syncReadings, deleteReading, activateTrial, and getQuota) had no
 * `enforceRateLimit()` call at all, unlike every other callable in this
 * codebase. See docs/audit/PHASE_6C_2_REMEDIATION.md for the full record.
 *
 * setAdminClaim's own pre-existing admin-only authorization check
 * (request.auth.token.admin !== true) is exercised unchanged — this suite
 * only adds coverage for the new rate-limit gate, not a re-test of that
 * authorization logic (out of scope; tracked separately as Finding 11's
 * style-only observation, not touched by this remediation).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
const getUser = vi.fn().mockResolvedValue({ customClaims: {} });

vi.mock('../../utils/admin', () => ({
  auth: {
    getUser: (uid: string) => getUser(uid) as Promise<unknown>,
    setCustomUserClaims: (uid: string, claims: unknown) =>
      setCustomUserClaims(uid, claims) as Promise<void>,
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// PHASE 6C-2: setAdminClaim now calls enforceRateLimit(); mocked so tests
// exercise the real callable without hitting a real Firestore transaction.
const enforceRateLimitMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../middleware/rateLimit', () => ({
  enforceRateLimit: (userId: string) => enforceRateLimitMock(userId) as Promise<void>,
}));

import { setAdminClaim } from '../admin';

beforeEach(() => {
  setCustomUserClaims.mockClear();
  getUser.mockClear().mockResolvedValue({ customClaims: {} });
  enforceRateLimitMock.mockReset().mockResolvedValue(undefined);
});

async function invokeSetAdminClaim(targetUid: string, isAdmin: boolean, callerUid = 'admin-1') {
  const handler = setAdminClaim as unknown as {
    run: (req: {
      data: unknown;
      auth: { uid: string; token: Record<string, unknown> };
    }) => Promise<unknown>;
  };
  return handler.run({
    data: { targetUid, isAdmin },
    auth: { uid: callerUid, token: { admin: true } },
  });
}

describe('PHASE 6C-2 — setAdminClaim is rate-limited', () => {
  it('calls enforceRateLimit with the calling admin’s own uid', async () => {
    await invokeSetAdminClaim('target-1', true, 'admin-1');
    expect(enforceRateLimitMock).toHaveBeenCalledWith('admin-1');
  });

  it('a legitimate admin call still sets the claim when the rate limit allows it', async () => {
    const result = await invokeSetAdminClaim('target-1', true, 'admin-1');
    expect(result).toMatchObject({ success: true });
    expect(setCustomUserClaims).toHaveBeenCalledWith('target-1', { admin: true });
  });

  it('a rate-limit rejection blocks setAdminClaim before any claim is read or written', async () => {
    enforceRateLimitMock.mockRejectedValueOnce(
      new HttpsError(
        'resource-exhausted',
        'Too many requests. Please wait a moment before trying again.',
      ),
    );
    await expect(invokeSetAdminClaim('target-1', true, 'admin-1')).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    expect(getUser).not.toHaveBeenCalled();
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('the pre-existing non-admin rejection still runs — rate limiting did not weaken it', async () => {
    const handler = setAdminClaim as unknown as {
      run: (req: {
        data: unknown;
        auth: { uid: string; token: Record<string, unknown> } | null;
      }) => Promise<unknown>;
    };
    await expect(
      handler.run({
        data: { targetUid: 'target-1', isAdmin: true },
        auth: { uid: 'not-an-admin', token: {} },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    // Never even reached the rate limiter — the admin check comes first.
    expect(enforceRateLimitMock).not.toHaveBeenCalled();
  });
});

describe('setAdminClaim — input validation (the razorpay PHASE 6A-R1 gap, applied here)', () => {
  // Before this fix, `const { targetUid, isAdmin } = request.data as {...}`
  // plus a bare `!targetUid` check only rejected falsy values — a non-string
  // truthy value (an object, array, or number) passed straight through to
  // auth.getUser(targetUid), an uncontrolled type error caught only by the
  // generic outer catch as 'internal', never cleanly rejected as
  // 'invalid-argument' the way every other callable's Zod schema does. This
  // is the exact defect class razorpay.ts's extractNonEmptyString() fixed
  // for notes.userId (PHASE 6A-R1) — setAdminClaim never got the same fix
  // until now, despite granting the highest-privilege claim in the app.
  it('rejects a non-string targetUid (an object) before it reaches auth.getUser()', async () => {
    const handler = setAdminClaim as unknown as {
      run: (req: {
        data: unknown;
        auth: { uid: string; token: Record<string, unknown> };
      }) => Promise<unknown>;
    };
    await expect(
      handler.run({
        data: { targetUid: { uid: 'nested-object' }, isAdmin: true },
        auth: { uid: 'admin-1', token: { admin: true } },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(getUser).not.toHaveBeenCalled();
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('rejects a non-string targetUid (a number)', async () => {
    await expect(invokeSetAdminClaim(12345 as unknown as string, true)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects an empty-string targetUid', async () => {
    await expect(invokeSetAdminClaim('', true)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects a non-boolean isAdmin', async () => {
    const handler = setAdminClaim as unknown as {
      run: (req: {
        data: unknown;
        auth: { uid: string; token: Record<string, unknown> };
      }) => Promise<unknown>;
    };
    await expect(
      handler.run({
        data: { targetUid: 'target-1', isAdmin: 'true' },
        auth: { uid: 'admin-1', token: { admin: true } },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('is strict — rejects an unrecognized field (e.g. a smuggled admin: true)', async () => {
    const handler = setAdminClaim as unknown as {
      run: (req: {
        data: unknown;
        auth: { uid: string; token: Record<string, unknown> };
      }) => Promise<unknown>;
    };
    await expect(
      handler.run({
        data: { targetUid: 'target-1', isAdmin: true, admin: true },
        auth: { uid: 'admin-1', token: { admin: true } },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('still accepts a well-formed request — the fix did not tighten the legitimate path', async () => {
    const result = await invokeSetAdminClaim('target-1', true, 'admin-1');
    expect(result).toMatchObject({ success: true });
  });
});
