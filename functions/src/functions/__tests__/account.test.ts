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
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Data = Record<string, unknown>;
const store = new Map<string, Data>();
/** Number of further batch commits that should fail, to simulate a crash. */
let failNextCommits = 0;
let commitsBeforeFailure = Infinity;

interface FakeDocRef {
  path: string;
  collection: (name: string) => FakeQuery;
}

interface FakeQuery {
  where: (field: string, op: '==', value: unknown) => FakeQuery;
  limit: (n: number) => FakeQuery;
  doc: (id: string) => FakeDocRef;
  get: () => Promise<{ empty: boolean; size: number; docs: Array<{ ref: FakeDocRef }> }>;
}

function docRef(path: string): FakeDocRef {
  return { path, collection: name => query(`${path}/${name}`) };
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
      commit: () => {
        if (commitsBeforeFailure <= 0 && failNextCommits > 0) {
          failNextCommits -= 1;
          return Promise.reject(new Error('simulated Firestore failure'));
        }
        commitsBeforeFailure -= 1;
        deletes.forEach(p => store.delete(p));
        return Promise.resolve();
      },
    };
  },
};

const deleteUserMock: Mock = vi.fn();

// Looked up at call time: vi.mock is hoisted above the fake's definition.
vi.mock('../../utils/admin', () => ({
  db: {
    collection: (name: string) => fakeDb.collection(name),
    batch: () => fakeDb.batch(),
  },
  auth: { deleteUser: (uid: string) => deleteUserMock(uid) as Promise<void> },
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// The real enforceRateLimit writes this minute's counter before deletion
// begins; model that so the test proves the call's own counter goes too.
vi.mock('../../middleware/rateLimit', () => ({
  enforceRateLimit: (userId: string) => {
    store.set(`rateLimits/${userId}/minutes/NOW`, { count: 1, expiresAt: 'later' });
    return Promise.resolve();
  },
}));

import { deleteAccount } from '../account';

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
  deleteUserMock.mockReset().mockResolvedValue(undefined);
  seed();
});

describe('deleteAccount — what is deleted', () => {
  it('removes profile, quota, trial, readings, reply copies and rate-limit counters', async () => {
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
  it('keeps fraud/security records and the wallet pending a retention decision', async () => {
    await callDelete('alice');
    expect(pathsFor('alice')).toEqual(
      expect.arrayContaining([
        'auditLogs/log-alice',
        'purchaseTokens/hash-alice',
        'securityEvents/ev-alice',
        'wallets/alice',
        'wallets/alice/ledger/e1',
      ]),
    );
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
    const kept = /^(auditLogs|purchaseTokens|securityEvents|wallets)\//;
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
    const kept = /^(auditLogs|purchaseTokens|securityEvents|wallets)\//;
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

  it('covers the saved reply copies', () => {
    const src = readFileSync(join(__dirname, '../../utils/idempotency.ts'), 'utf8');
    expect(src).toContain("const COLLECTION = 'idempotencyKeys'");
    expect(ttlGroups).toContain('idempotencyKeys');
  });
});
