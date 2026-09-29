/**
 * PHASE 6C-2 — permanent regression coverage for getQuota's rate limiting.
 * --------------------------------------------------------------------------
 * Closes Finding 2 from docs/audit/PHASE_6B_CLOSURE.md §2: getQuota (like
 * syncReadings, deleteReading, activateTrial, and setAdminClaim) had no
 * `enforceRateLimit()` call at all, unlike every other callable in this
 * codebase. See docs/audit/PHASE_6C_2_REMEDIATION.md for the full record.
 *
 * A minimal fake Firestore models exactly the reads getQuota.ts makes
 * (`collection('quotas'|'trials').doc(userId).get()`) against an in-memory
 * map of seeded documents — no emulator needed.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { FREE_LIMIT, TRIAL_DAILY_LIMIT, todayKey } from '../../config';

interface FakeDoc {
  [key: string]: unknown;
}

const quotas = new Map<string, FakeDoc>();
const trials = new Map<string, FakeDoc>();
const quotaWrites: Array<{ id: string; data: Record<string, unknown> }> = [];

function reset(): void {
  quotas.clear();
  trials.clear();
  quotaWrites.length = 0;
}

function fakeDb() {
  return {
    collection: (name: 'quotas' | 'trials') => {
      const store = name === 'quotas' ? quotas : trials;
      if (name !== 'quotas' && name !== 'trials') {
        throw new Error(`unexpected collection: ${String(name)}`);
      }
      return {
        doc: (id: string) => ({
          get: () => {
            const doc = store.get(id);
            return Promise.resolve({ exists: doc !== undefined, data: () => doc });
          },
          set: (data: Record<string, unknown>, _opts: { merge: boolean }) => {
            if (name === 'quotas') {
              quotaWrites.push({ id, data });
              store.set(id, { ...(store.get(id) ?? {}), ...data });
            }
            return Promise.resolve();
          },
        }),
      };
    },
  };
}

vi.mock('../../utils/admin', () => ({
  db: fakeDb(),
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// PHASE 6C-2: getQuota now calls enforceRateLimit(); mocked so tests
// exercise the real callable without hitting a real Firestore transaction.
const enforceRateLimitMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../middleware/rateLimit', () => ({
  enforceRateLimit: (userId: string) => enforceRateLimitMock(userId) as Promise<void>,
}));

import { getQuota } from '../quota';

beforeEach(() => {
  reset();
  enforceRateLimitMock.mockReset().mockResolvedValue(undefined);
});

async function invokeGetQuota(userId = 'alice') {
  const handler = getQuota as unknown as {
    run: (req: {
      data: unknown;
      auth: { uid: string; token: Record<string, unknown> };
    }) => Promise<unknown>;
  };
  return handler.run({ data: {}, auth: { uid: userId, token: {} } });
}

describe('PHASE 6C-2 — getQuota is rate-limited', () => {
  it('calls enforceRateLimit with the caller’s own uid', async () => {
    await invokeGetQuota('alice');
    expect(enforceRateLimitMock).toHaveBeenCalledWith('alice');
  });

  it('a legitimate call still returns quota status when the rate limit allows it', async () => {
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ plan: 'free', used: 0 });
  });

  it('a rate-limit rejection blocks getQuota before any Firestore read happens', async () => {
    quotas.set('alice', { plan: 'khass', used: 5, dayKey: '2099-01-01' });
    enforceRateLimitMock.mockRejectedValueOnce(
      new HttpsError(
        'resource-exhausted',
        'Too many requests. Please wait a moment before trying again.',
      ),
    );
    await expect(invokeGetQuota('alice')).rejects.toMatchObject({ code: 'resource-exhausted' });
    // No self-heal write and no successful read path should have run.
    expect(quotaWrites).toHaveLength(0);
  });
});

describe('getQuota — no existing quota doc (brand-new user)', () => {
  it('reports the full free daily limit as remaining', async () => {
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({
      plan: 'free',
      used: 0,
      limit: FREE_LIMIT,
      remaining: FREE_LIMIT,
    });
  });

  it('reports the trial limit, not the free one, when a trial is active', async () => {
    trials.set('alice', {
      userId: 'alice',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ limit: TRIAL_DAILY_LIMIT, remaining: TRIAL_DAILY_LIMIT });
  });
});

describe('getQuota — trial precedence over the free limit (the documented regression)', () => {
  // The comment right above dailyLimit's computation in quota.ts describes
  // a real past bug: getQuota used to always report FREE_LIMIT regardless
  // of an active trial, so a trial user who'd asked their 4th of 5 daily
  // questions saw the client compute remaining = max(0, 3-4) = 0 and lock
  // the Ask button, even though claimQuotaSlot would have granted it. That
  // fix had no test locking it in place until this one.
  it('an active trial uses TRIAL_DAILY_LIMIT even when FREE_LIMIT would already be exhausted', async () => {
    trials.set('alice', {
      userId: 'alice',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    quotas.set('alice', { plan: 'free', dayKey: todayKey(), used: FREE_LIMIT });

    const result = await invokeGetQuota('alice');

    expect(result).toMatchObject({
      limit: TRIAL_DAILY_LIMIT,
      remaining: Math.max(0, TRIAL_DAILY_LIMIT - FREE_LIMIT),
    });
  });

  it('an expired trial falls back to the free limit, not the trial one', async () => {
    trials.set('alice', {
      userId: 'alice',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ limit: FREE_LIMIT, remaining: FREE_LIMIT });
  });
});

describe('getQuota — day rollover', () => {
  it('resets used to 0 when the stored dayKey is from an earlier day', async () => {
    quotas.set('alice', { plan: 'free', dayKey: '2020-01-01', used: FREE_LIMIT });
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ used: 0, remaining: FREE_LIMIT });
  });

  it('keeps the stored used count for the same day', async () => {
    quotas.set('alice', { plan: 'free', dayKey: todayKey(), used: 2 });
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ used: 2, remaining: FREE_LIMIT - 2 });
  });
});

describe('getQuota — plan expiry self-heal', () => {
  it('an expired paid plan reports as free in the response', async () => {
    quotas.set('alice', {
      plan: 'khass',
      planExpiry: new Date(Date.now() - 1000).toISOString(),
      dayKey: todayKey(),
      used: 0,
    });
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ plan: 'free', planExpiry: null });
  });

  it('persists the self-heal to Firestore, best-effort', async () => {
    quotas.set('alice', {
      plan: 'khass',
      planExpiry: new Date(Date.now() - 1000).toISOString(),
      dayKey: todayKey(),
      used: 0,
    });
    await invokeGetQuota('alice');
    expect(quotaWrites).toHaveLength(1);
    expect(quotaWrites[0]?.data).toMatchObject({ plan: 'free', planExpiry: null });
  });

  it('a still-valid paid plan is reported unlimited, with no self-heal write', async () => {
    quotas.set('alice', {
      plan: 'khass',
      planExpiry: new Date(Date.now() + 86_400_000).toISOString(),
      dayKey: todayKey(),
      used: 0,
    });
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ plan: 'khass', limit: null, remaining: null });
    expect(quotaWrites).toHaveLength(0);
  });

  it('a free-plan doc (planExpiry always null) never triggers the expiry self-heal', async () => {
    quotas.set('alice', { plan: 'free', planExpiry: null, dayKey: todayKey(), used: 1 });
    await invokeGetQuota('alice');
    expect(quotaWrites).toHaveLength(0);
  });
});

describe('getQuota — remaining never goes negative', () => {
  it('clamps to 0 when used somehow exceeds the daily limit', async () => {
    quotas.set('alice', { plan: 'free', dayKey: todayKey(), used: FREE_LIMIT + 10 });
    const result = await invokeGetQuota('alice');
    expect(result).toMatchObject({ remaining: 0 });
  });
});
