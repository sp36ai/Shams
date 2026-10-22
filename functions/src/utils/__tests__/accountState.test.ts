/**
 * The deleted-account marker (utils/accountState.ts) and the one gate every
 * callable passes through first (middleware/rateLimit.ts), against a fake
 * Firestore keyed by full path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Data = Record<string, unknown>;
const store = new Map<string, Data>();

interface Ref {
  path: string;
  collection: (name: string) => { doc: (id: string) => Ref };
  set: (data: Data) => Promise<void>;
}

function ref(path: string): Ref {
  return {
    path,
    collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }),
    set: data => {
      store.set(path, data);
      return Promise.resolve();
    },
  };
}

vi.mock('../admin', () => ({
  db: {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async <T>(
      fn: (tx: {
        get: (r: Ref) => Promise<{ exists: boolean; data: () => Data | undefined }>;
        set: (r: Ref, data: Data, opts?: { merge?: boolean }) => void;
      }) => Promise<T>,
    ): Promise<T> => {
      const writes: Array<() => void> = [];
      const result = await fn({
        get: r => Promise.resolve({ exists: store.has(r.path), data: () => store.get(r.path) }),
        set: (r, data, opts) => {
          writes.push(() =>
            store.set(r.path, opts?.merge === true ? { ...store.get(r.path), ...data } : data),
          );
        },
      });
      writes.forEach(w => w());
      return result;
    },
  },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

vi.mock('../../config', () => ({
  RATE_LIMIT_PER_MINUTE: { value: () => 30 },
}));

import {
  assertAccountActive,
  isAccountDeleted,
  markAccountDeleted,
  writeIfAccountActive,
} from '../accountState';
import { enforceRateLimit } from '../../middleware/rateLimit';
import { db } from '../admin';

beforeEach(() => {
  store.clear();
});

describe('accountState', () => {
  it('an account with no marker is active', async () => {
    await db.runTransaction(async tx => {
      expect(await isAccountDeleted(tx, 'alice')).toBe(false);
      await expect(assertAccountActive(tx, 'alice')).resolves.toBeUndefined();
    });
  });

  it('markAccountDeleted writes a marker with only timestamps, expiring in a day', async () => {
    await markAccountDeleted('alice');
    const marker = store.get('deletedAccounts/alice');
    expect(Object.keys(marker ?? {}).sort()).toEqual(['deletedAt', 'expiresAt']);
    const hours = ((marker!.expiresAt as Date).getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it('a marked account is refused with failed-precondition', async () => {
    await markAccountDeleted('alice');
    await db.runTransaction(async tx => {
      expect(await isAccountDeleted(tx, 'alice')).toBe(true);
      await expect(assertAccountActive(tx, 'alice')).rejects.toMatchObject({
        code: 'failed-precondition',
      });
    });
  });

  it('writeIfAccountActive writes for an active account', async () => {
    await writeIfAccountActive('alice', tx => {
      tx.set(db.collection('readings').doc('r1'), { userId: 'alice' });
    });
    expect(store.get('readings/r1')).toEqual({ userId: 'alice' });
  });

  it('writeIfAccountActive writes nothing for a marked account', async () => {
    await markAccountDeleted('alice');
    await expect(
      writeIfAccountActive('alice', tx => {
        tx.set(db.collection('readings').doc('r1'), { userId: 'alice' });
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(store.has('readings/r1')).toBe(false);
  });

  it("one user's marker does not affect another", async () => {
    await markAccountDeleted('alice');
    await writeIfAccountActive('bob', tx => {
      tx.set(db.collection('readings').doc('b1'), { userId: 'bob' });
    });
    expect(store.has('readings/b1')).toBe(true);
  });
});

describe('enforceRateLimit — the first gate of every callable', () => {
  it('admits an active account and counts the call', async () => {
    await enforceRateLimit('alice');
    const counters = [...store.keys()].filter(k => k.startsWith('rateLimits/alice/minutes/'));
    expect(counters).toHaveLength(1);
  });

  it('turns away a deleted account before counting anything', async () => {
    await markAccountDeleted('alice');
    await expect(enforceRateLimit('alice')).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    expect([...store.keys()].some(k => k.startsWith('rateLimits/alice/'))).toBe(false);
  });

  it('lets deleteAccount retry through with allowDeletedAccount', async () => {
    await markAccountDeleted('alice');
    await expect(enforceRateLimit('alice', { allowDeletedAccount: true })).resolves.toBeUndefined();
  });
});
