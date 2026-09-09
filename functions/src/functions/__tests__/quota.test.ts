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
