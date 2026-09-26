/**
 * PHASE 6C-2 — permanent regression coverage for activateTrial's rate limiting.
 * --------------------------------------------------------------------------
 * Closes Finding 2 from docs/audit/PHASE_6B_CLOSURE.md §2: activateTrial
 * (like syncReadings, deleteReading, getQuota, and setAdminClaim) had no
 * `enforceRateLimit()` call at all, unlike every other callable in this
 * codebase. See docs/audit/PHASE_6C_2_REMEDIATION.md for the full record.
 *
 * A minimal fake Firestore transaction models exactly what activateTrial.ts
 * needs (`collection('trials').doc(userId)`, `runTransaction`) against an
 * in-memory map of seeded documents — no emulator needed.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

interface FakeDoc {
  [key: string]: unknown;
}

const trials = new Map<string, FakeDoc>();

function reset(): void {
  trials.clear();
}

function fakeDb() {
  return {
    collection: (name: string) => {
      if (name !== 'trials') {
        throw new Error(`unexpected collection: ${name}`);
      }
      return {
        doc: (id: string) => ({ id }),
      };
    },
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        get: (ref: { id: string }) => {
          const doc = trials.get(ref.id);
          return Promise.resolve({ exists: doc !== undefined, data: () => doc });
        },
        set: (ref: { id: string }, data: Record<string, unknown>) => {
          trials.set(ref.id, data);
        },
      };
      return fn(tx);
    },
  };
}

vi.mock('../../utils/admin', () => ({
  db: fakeDb(),
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// PHASE 6C-2: activateTrial now calls enforceRateLimit(); mocked so tests
// exercise the real callable without hitting a real Firestore transaction.
const enforceRateLimitMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../middleware/rateLimit', () => ({
  enforceRateLimit: (userId: string) => enforceRateLimitMock(userId) as Promise<void>,
}));

import { activateTrial } from '../activateTrial';

beforeEach(() => {
  reset();
  enforceRateLimitMock.mockReset().mockResolvedValue(undefined);
});

async function invokeActivateTrial(userId = 'alice') {
  const handler = activateTrial as unknown as {
    run: (req: {
      data: unknown;
      auth: { uid: string; token: Record<string, unknown> };
    }) => Promise<unknown>;
  };
  return handler.run({ data: {}, auth: { uid: userId, token: {} } });
}

describe('PHASE 6C-2 — activateTrial is rate-limited', () => {
  it('calls enforceRateLimit with the caller’s own uid', async () => {
    await invokeActivateTrial('alice');
    expect(enforceRateLimitMock).toHaveBeenCalledWith('alice');
  });

  it('a legitimate call still activates a new trial when the rate limit allows it', async () => {
    const result = await invokeActivateTrial('alice');
    expect(result).toMatchObject({ alreadyActive: false });
    expect(trials.has('alice')).toBe(true);
  });

  it('a rate-limit rejection blocks activateTrial before any Firestore write happens', async () => {
    enforceRateLimitMock.mockRejectedValueOnce(
      new HttpsError(
        'resource-exhausted',
        'Too many requests. Please wait a moment before trying again.',
      ),
    );
    await expect(invokeActivateTrial('alice')).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    expect(trials.has('alice')).toBe(false);
  });
});

describe('activateTrial — idempotent replay (the file’s own stated core property)', () => {
  it('a second call returns the ORIGINAL startedAt/expiresAt unchanged, not a fresh 7-day window', async () => {
    const first = (await invokeActivateTrial('alice')) as {
      startedAt: string;
      expiresAt: string;
      alreadyActive: boolean;
    };
    expect(first).toMatchObject({ alreadyActive: false });

    const second = await invokeActivateTrial('alice');

    expect(second).toMatchObject({ alreadyActive: true });
    expect(second).toEqual({
      startedAt: first.startedAt,
      expiresAt: first.expiresAt,
      alreadyActive: true,
    });
  });

  it('a second call performs no Firestore write — the stored document is untouched', async () => {
    await invokeActivateTrial('alice');
    const storedAfterFirst = trials.get('alice');

    await invokeActivateTrial('alice');

    // Same object reference: `tx.set` was never called a second time, not
    // merely "wrote the same values back".
    expect(trials.get('alice')).toBe(storedAfterFirst);
  });

  it('two different users each get their own independent trial', async () => {
    const alice = await invokeActivateTrial('alice');
    const bob = await invokeActivateTrial('bob');

    expect(alice).toMatchObject({ alreadyActive: false });
    expect(bob).toMatchObject({ alreadyActive: false });
    expect(trials.has('alice')).toBe(true);
    expect(trials.has('bob')).toBe(true);
  });
});
