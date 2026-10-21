/**
 * deleteAccount — what is deleted, what is kept, and that a retry after a
 * partial failure finishes the job (deletion hardening, 2026-10-20).
 *
 * The fake Firestore below stores documents by full path ("readings/r1",
 * "rateLimits/alice/minutes/2026-10-20T10:00"), so a collection query only
 * sees its own direct children — exactly the real rule that deleting a
 * parent document leaves its subcollections behind. That is the property
 * the rate-limit cleanup depends on, so the fake models it rather than
 * hiding it.
 *
 * utils/accountState.ts is NOT mocked here: the real deleted-account marker
 * runs against this fake, including a write that arrives mid-deletion.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Data = Record<string, unknown>;
const store = new Map<string, Data>();
/** Number of further batch commits that should fail, to simulate a crash. */
let failNextCommits = 0;
let commitsBeforeFailure = Infinity;
/** Every mutation in order, to prove the marker is written before any delete. */
const ops: string[] = [];
/** Runs once, just before the first batch commit — a request landing mid-deletion. */
let onFirstCommit: (() => Promise<void>) | null = null;

interface FakeDocRef {
  path: string;
  collection: (name: string) => FakeQuery;
  set: (data: Data, opts?: { merge?: boolean }) => Promise<void>;
}

function write(path: string, data: Data, opts?: { merge?: boolean }): void {
  ops.push(`set ${path}`);
  store.set(path, opts?.merge === true ? { ...(store.get(path) ?? {}), ...data } : data);
}

interface FakeQuery {
  where: (field: string, op: '==', value: unknown) => FakeQuery;
  limit: (n: number) => FakeQuery;
  doc: (id: string) => FakeDocRef;
  get: () => Promise<{ empty: boolean; size: number; docs: Array<{ ref: FakeDocRef }> }>;
}

function docRef(path: string): FakeDocRef {
  return {
    path,
    collection: name => query(`${path}/${name}`),
    set: (data, opts) => {
      write(path, data, opts);
      return Promise.resolve();
    },
  };
}

function query(
  collectionPath: string,
  filters: Array<[string, unknown]> = [],
  max = Infinity,
): FakeQuery {
  return {
    where: (field, _op, value) => query(collectionPath, [...filters, [field, value]], max),
    limit: n => query(collectionPath, filters, n),
    doc: id => docRef(`${collectionPath}/${id}`),
    get: () => {
      const depth = collectionPath.split('/').length + 1;
      const docs = [...store.entries()]
        .filter(
          ([path]) => path.startsWith(`${collectionPath}/`) && path.split('/').length === depth,
        )
        .filter(([, data]) => filters.every(([f, v]) => data[f] === v))
        .slice(0, max)
        .map(([path]) => ({ ref: docRef(path) }));
      return Promise.resolve({ empty: docs.length === 0, size: docs.length, docs });
    },
  };
}

const fakeDb = {
  collection: (name: string) => {
    const q = query(name);
    return {
      ...q,
      add: (data: Data) => {
        store.set(`${name}/auto-${store.size}`, data);
        return Promise.resolve();
      },
    };
  },
  batch: () => {
    const deletes: string[] = [];
    return {
      delete: (ref: FakeDocRef) => {
        deletes.push(ref.path);
      },
      commit: async () => {
        if (onFirstCommit !== null) {
          const hook = onFirstCommit;
          onFirstCommit = null;
          await hook();
        }
        if (commitsBeforeFailure <= 0 && failNextCommits > 0) {
          failNextCommits -= 1;
          throw new Error('simulated Firestore failure');
        }
        commitsBeforeFailure -= 1;
        deletes.forEach(p => {
          ops.push(`delete ${p}`);
          store.delete(p);
        });
      },
    };
  },
  // Sequential, which is enough here: the interleavings that matter are
  // staged explicitly (onFirstCommit), not left to timing.
  runTransaction: async <T>(
    fn: (tx: {
      get: (ref: FakeDocRef) => Promise<{ exists: boolean }>;
      set: (ref: FakeDocRef, data: Data, opts?: { merge?: boolean }) => void;
    }) => Promise<T>,
  ): Promise<T> => {
    const writes: Array<() => void> = [];
    const result = await fn({
      get: ref => Promise.resolve({ exists: store.has(ref.path) }),
      set: (ref, data, opts) => {
        writes.push(() => write(ref.path, data, opts));
      },
    });
    writes.forEach(w => w());
    return result;
  },
};

const deleteUserMock: Mock = vi.fn();

// Looked up at call time: vi.mock is hoisted above the fake's definition.
vi.mock('../../utils/admin', () => ({
  db: {
    collection: (name: string) => fakeDb.collection(name),
    batch: () => fakeDb.batch(),
    runTransaction: (fn: Parameters<typeof fakeDb.runTransaction>[0]) => fakeDb.runTransaction(fn),
  },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  auth: { deleteUser: (uid: string) => deleteUserMock(uid) as Promise<void> },
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// The real enforceRateLimit writes this minute's counter before deletion
// begins; model that so the test proves the call's own counter goes too.
const rateLimitOpts: unknown[] = [];
vi.mock('../../middleware/rateLimit', () => ({
  enforceRateLimit: (userId: string, opts?: unknown) => {
    rateLimitOpts.push(opts);
    store.set(`rateLimits/${userId}/minutes/NOW`, { count: 1, expiresAt: 'later' });
    return Promise.resolve();
  },
}));

import { deleteAccount } from '../account';
import { writeIfAccountActive } from '../../utils/accountState';

type Runnable = { run: (req: unknown) => Promise<unknown> };

function callDelete(uid: string): Promise<unknown> {
  return (deleteAccount as unknown as Runnable).run({
    data: {},
    auth: { uid, token: {} },
    app: { appId: 'test' },
  });
}

/** Two users' worth of every record kind, so leaks across users show up. */
function seed(): void {
  for (const uid of ['alice', 'bob']) {
    store.set(`users/${uid}`, { plan: 'premium' });
    store.set(`quotas/${uid}`, { used: 1 });
    store.set(`trials/${uid}`, { activatedAt: 1 });
    store.set(`readings/${uid}-r1`, { userId: uid, question: 'q' });
    store.set(`readings/${uid}-r2`, { userId: uid, question: 'q' });
    store.set(`idempotencyKeys/${uid}__req1`, { userId: uid, response: { oracle: 'text' } });
    store.set(`rateLimits/${uid}/minutes/2026-10-20T10:00`, { count: 3 });
    store.set(`wallets/${uid}`, { balanceMilli: 5000 });
    store.set(`wallets/${uid}/ledger/e1`, { type: 'grant', amountMilli: 5000 });
    store.set(`purchaseTokens/hash-${uid}`, { userId: uid });
    store.set(`auditLogs/log-${uid}`, { userId: uid, action: 'reading' });
    store.set(`securityEvents/ev-${uid}`, { userId: uid, ipHash: 'h' });
  }
}

function pathsFor(uid: string): string[] {
  return [...store.keys()].filter(p => p.includes(uid)).sort();
}

beforeEach(() => {
  store.clear();
  failNextCommits = 0;
  commitsBeforeFailure = Infinity;
  ops.length = 0;
  onFirstCommit = null;
  rateLimitOpts.length = 0;
  deleteUserMock.mockReset().mockResolvedValue(undefined);
  seed();
});

describe('deleteAccount — what is deleted', () => {
  it('removes profile, quota, trial, readings, reply copies, wallet and rate-limit counters', async () => {
    await callDelete('alice');
    const left = pathsFor('alice');
    for (const gone of [
      'users/alice',
      'quotas/alice',
      'trials/alice',
      'readings/alice-r1',
      'readings/alice-r2',
      'idempotencyKeys/alice__req1',
      'rateLimits/alice/minutes/2026-10-20T10:00',
      'rateLimits/alice/minutes/NOW',
      'wallets/alice',
      'wallets/alice/ledger/e1',
    ]) {
      expect(left).not.toContain(gone);
    }
    expect(deleteUserMock).toHaveBeenCalledWith('alice');
  });

  it('touches nothing belonging to another user', async () => {
    const before = pathsFor('bob');
    await callDelete('alice');
    expect(pathsFor('bob')).toEqual(before);
  });

  it('pages through more readings than one batch holds', async () => {
    for (let i = 0; i < 950; i++) {
      store.set(`readings/alice-bulk-${i}`, { userId: 'alice' });
    }
    const result = (await callDelete('alice')) as { readingsDeleted: number };
    expect(result.readingsDeleted).toBe(952);
    expect(pathsFor('alice').filter(p => p.startsWith('readings/'))).toEqual([]);
  });
});

describe('deleteAccount — what is deliberately kept', () => {
  it('keeps fraud/security records and the deleted-account marker', async () => {
    await callDelete('alice');
    expect(pathsFor('alice')).toEqual(
      expect.arrayContaining([
        'auditLogs/log-alice',
        'deletedAccounts/alice',
        'purchaseTokens/hash-alice',
        'securityEvents/ev-alice',
      ]),
    );
  });

  it('the marker holds only timestamps, and expires', async () => {
    await callDelete('alice');
    const marker = store.get('deletedAccounts/alice');
    expect(Object.keys(marker ?? {}).sort()).toEqual(['deletedAt', 'expiresAt']);
    const hours = ((marker!.expiresAt as Date).getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it('writes an account_deleted audit entry with counts and no personal data', async () => {
    await callDelete('alice');
    const entry = [...store.values()].find(d => d.action === 'account_deleted');
    expect(entry).toEqual(
      expect.objectContaining({ userId: 'alice', action: 'account_deleted', deletedReadings: 2 }),
    );
    expect(JSON.stringify(entry)).not.toMatch(/question|email|name/i);
  });

  it('leaves nothing for alice beyond the kept records', async () => {
    await callDelete('alice');
    const kept = /^(auditLogs|deletedAccounts|purchaseTokens|securityEvents)\//;
    expect(pathsFor('alice').filter(p => !kept.test(p))).toEqual([]);
  });
});

describe('deleteAccount — failure and retry', () => {
  it('a failure partway keeps the login, so the seeker can retry', async () => {
    commitsBeforeFailure = 1; // readings page commits, the next batch fails
    failNextCommits = 1;
    await expect(callDelete('alice')).rejects.toMatchObject({ code: 'internal' });
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(pathsFor('alice')).toContain('idempotencyKeys/alice__req1');
  });

  it('the retry finishes everything the failed attempt left', async () => {
    commitsBeforeFailure = 1;
    failNextCommits = 1;
    await expect(callDelete('alice')).rejects.toBeTruthy();
    await callDelete('alice');
    const kept = /^(auditLogs|deletedAccounts|purchaseTokens|securityEvents)\//;
    expect(pathsFor('alice').filter(p => !kept.test(p))).toEqual([]);
    expect(deleteUserMock).toHaveBeenCalledWith('alice');
  });

  it('a retry after the login is already gone still succeeds', async () => {
    deleteUserMock.mockRejectedValue({ code: 'auth/user-not-found' });
    await expect(callDelete('alice')).resolves.toMatchObject({ deleted: true });
  });

  it('any other login-deletion error is reported, not swallowed', async () => {
    deleteUserMock.mockRejectedValue({ code: 'auth/internal-error' });
    await expect(callDelete('alice')).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('deleteAccount — the deletion race', () => {
  it('writes the marker before deleting anything', async () => {
    await callDelete('alice');
    const markerAt = ops.indexOf('set deletedAccounts/alice');
    const firstDelete = ops.findIndex(o => o.startsWith('delete '));
    expect(markerAt).toBeGreaterThanOrEqual(0);
    expect(markerAt).toBeLessThan(firstDelete);
  });

  it('a request that lands mid-deletion is refused and leaves nothing behind', async () => {
    let inFlight: Promise<void> | null = null;
    onFirstCommit = () => {
      // An askWatchOracle call still casting when the seeker hit Delete.
      inFlight = writeIfAccountActive('alice', tx => {
        tx.set(fakeDb.collection('readings').doc('alice-late') as never, { userId: 'alice' });
      });
      return inFlight.catch(() => undefined);
    };
    await callDelete('alice');
    await expect(inFlight).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(store.has('readings/alice-late')).toBe(false);
  });

  it('a write after deletion completes (e.g. a still-valid token) is refused', async () => {
    await callDelete('alice');
    await expect(
      writeIfAccountActive('alice', tx => {
        tx.set(fakeDb.collection('quotas').doc('alice') as never, { plan: 'free' });
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(store.has('quotas/alice')).toBe(false);
  });

  it('a write that committed before the marker is swept with everything else', async () => {
    await writeIfAccountActive('alice', tx => {
      tx.set(fakeDb.collection('readings').doc('alice-early') as never, { userId: 'alice' });
    });
    await callDelete('alice');
    expect(store.has('readings/alice-early')).toBe(false);
  });

  it('other users can still write while alice is being deleted', async () => {
    await callDelete('alice');
    await writeIfAccountActive('bob', tx => {
      tx.set(fakeDb.collection('readings').doc('bob-new') as never, { userId: 'bob' });
    });
    expect(store.has('readings/bob-new')).toBe(true);
  });

  it('lets its own retry past the rate-limit check that refuses everyone else', async () => {
    await callDelete('alice');
    expect(rateLimitOpts).toEqual([{ allowDeletedAccount: true }]);
  });
});

describe('TTL policies match the paths the code writes', () => {
  const indexes = JSON.parse(
    readFileSync(join(__dirname, '../../../../firestore.indexes.json'), 'utf8'),
  ) as { fieldOverrides: Array<{ collectionGroup: string; fieldPath: string; ttl?: boolean }> };
  const ttlGroups = indexes.fieldOverrides
    .filter(o => o.ttl === true && o.fieldPath === 'expiresAt')
    .map(o => o.collectionGroup);

  it('covers the rate-limit counters by their real subcollection name', () => {
    const src = readFileSync(join(__dirname, '../../middleware/rateLimit.ts'), 'utf8');
    expect(src).toContain(".collection('minutes')");
    expect(ttlGroups).toContain('minutes');
    expect(ttlGroups).not.toContain('rateLimits');
  });

  it('covers the deleted-account marker', () => {
    const src = readFileSync(join(__dirname, '../../utils/accountState.ts'), 'utf8');
    expect(src).toContain("const COLLECTION = 'deletedAccounts'");
    expect(ttlGroups).toContain('deletedAccounts');
  });

  it('covers the saved reply copies', () => {
    const src = readFileSync(join(__dirname, '../../utils/idempotency.ts'), 'utf8');
    expect(src).toContain("const COLLECTION = 'idempotencyKeys'");
    expect(ttlGroups).toContain('idempotencyKeys');
  });
});
