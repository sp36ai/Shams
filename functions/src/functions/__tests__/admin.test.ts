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
