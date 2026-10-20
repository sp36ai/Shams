/**
 * EMULATOR — deleteAccount and the deletion race against real Firestore
 * semantics (transactions, locking, subcollections). Nothing here is mocked:
 * the real Admin SDK, the real deleteAccount / syncReadings callables, the
 * real rate-limit gate and the real deleted-account marker.
 *
 * Skipped unless pointed at the emulators, and refuses outright to run
 * against anything but a `demo-` project (utils/admin.ts would otherwise
 * fall back to the production project id):
 *
 *   firebase emulators:start --only firestore,auth --project demo-shams
 *   cd functions
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   GCLOUD_PROJECT=demo-shams RATE_LIMIT_PER_MINUTE=100000 \
 *   npx vitest run account.emulator
 */

import { describe, it, expect, beforeEach } from 'vitest';

const PROJECT = process.env.GCLOUD_PROJECT ?? '';
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
const ON_EMULATOR = FS_HOST !== '' && AUTH_HOST !== '';

if (ON_EMULATOR && !PROJECT.startsWith('demo-')) {
  throw new Error(`refusing to run: GCLOUD_PROJECT must be a demo- project, got "${PROJECT}"`);
}

type Runnable = { run: (req: unknown) => Promise<unknown> };

async function load() {
  const admin = await import('../../utils/admin');
  const { deleteAccount } = await import('../account');
  const { syncReadings } = await import('../readings');
  const accountState = await import('../../utils/accountState');
  const idempotency = await import('../../utils/idempotency');
  const wallet = await import('../../utils/wallet');
  return { ...admin, deleteAccount, syncReadings, accountState, idempotency, wallet };
}

function call(fn: unknown, uid: string, data: unknown = {}): Promise<unknown> {
  return (fn as Runnable).run({ data, auth: { uid, token: {} }, app: { appId: 'emulator' } });
}

async function clearEmulators(): Promise<void> {
  await fetch(`http://${FS_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`, {
    method: 'DELETE',
  });
}

describe.skipIf(!ON_EMULATOR)('EMULATOR — deleteAccount on real Firestore', () => {
  let m: Awaited<ReturnType<typeof load>>;

  beforeEach(async () => {
    m = await load();
    await clearEmulators();
    for (const uid of ['alice', 'bob']) {
      await m.auth.createUser({ uid });
      const b = m.db.batch();
      b.set(m.db.doc(`users/${uid}`), { plan: 'premium' });
      b.set(m.db.doc(`quotas/${uid}`), { used: 1 });
      b.set(m.db.doc(`trials/${uid}`), { userId: uid });
      b.set(m.db.doc(`readings/${uid}-r1`), { userId: uid, question: 'q' });
      b.set(m.db.doc(`idempotencyKeys/${uid}__req1`), { userId: uid, response: { x: 1 } });
      b.set(m.db.doc(`rateLimits/${uid}/minutes/2026-10-20T10:00`), { count: 3 });
      b.set(m.db.doc(`wallets/${uid}`), { balanceMilli: 5000 });
      b.set(m.db.doc(`wallets/${uid}/ledger/e1`), { type: 'grant', amountMilli: 5000 });
      b.set(m.db.doc(`purchaseTokens/hash-${uid}`), { userId: uid });
      b.set(m.db.doc(`securityEvents/ev-${uid}`), { userId: uid });
      await b.commit();
    }
  });

  /** Every document path under a collection, recursively, that mentions uid. */
  async function pathsFor(uid: string): Promise<string[]> {
    const out: string[] = [];
    async function walk(refs: FirebaseFirestore.CollectionReference[]): Promise<void> {
      for (const col of refs) {
        const docs = await col.listDocuments();
        for (const d of docs) {
          const snap = await d.get();
          const mentions = d.path.includes(uid) || snap.data()?.userId === uid;
          if (snap.exists && mentions) {
            out.push(d.path);
          }
          await walk(await d.listCollections());
        }
      }
    }
    await walk(await m.db.listCollections());
    return out.sort();
  }

  const KEPT = /^(auditLogs|deletedAccounts|purchaseTokens|securityEvents)\//;

  it('deletes everything of alice’s but the kept records, and nothing of bob’s', async () => {
    const bobBefore = await pathsFor('bob');
    const result = await call(m.deleteAccount, 'alice');
    expect(result).toMatchObject({ deleted: true, readingsDeleted: 1 });

    const left = await pathsFor('alice');
    expect(left.filter(p => !KEPT.test(p))).toEqual([]);
    expect(left).toEqual(
      expect.arrayContaining([
        'deletedAccounts/alice',
        'purchaseTokens/hash-alice',
        'securityEvents/ev-alice',
      ]),
    );
    // Subcollections really are gone, not just orphaned under a deleted parent.
    expect((await m.db.collection('wallets/alice/ledger').get()).size).toBe(0);
    expect((await m.db.collection('rateLimits/alice/minutes').get()).size).toBe(0);

    expect(await pathsFor('bob')).toEqual(bobBefore);
    await expect(m.auth.getUser('alice')).rejects.toMatchObject({ code: 'auth/user-not-found' });
    await expect(m.auth.getUser('bob')).resolves.toBeTruthy();
  });

  it('a retry after completion succeeds and changes nothing more', async () => {
    await call(m.deleteAccount, 'alice');
    const after = await pathsFor('alice');
    await expect(call(m.deleteAccount, 'alice')).resolves.toMatchObject({ deleted: true });
    expect((await pathsFor('alice')).filter(p => !KEPT.test(p))).toEqual([]);
    expect((await pathsFor('alice')).filter(p => !p.startsWith('auditLogs/'))).toEqual(
      after.filter(p => !p.startsWith('auditLogs/')),
    );
  });

  it('a call with a still-valid token after deletion is refused and writes nothing', async () => {
    await call(m.deleteAccount, 'alice');
    await expect(
      call(m.syncReadings, 'alice', {
        readings: [
          {
            id: 'alice-late',
            question: 'Will this work?',
            questionLang: 'en',
            category: 'general',
            verdict: 'YES',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect((await m.db.doc('readings/alice-late').get()).exists).toBe(false);
    expect((await m.db.collection('rateLimits/alice/minutes').get()).size).toBe(0);
  });

  it('RACE: concurrent writes during deletion never leave alice’s data behind (20 rounds)', async () => {
    const tally = { landedThenSwept: 0, refused: 0, otherErrors: [] as string[] };

    for (let round = 0; round < 20; round++) {
      await clearEmulators();
      await m.auth.createUser({ uid: 'alice' });
      await m.db.doc('readings/alice-seed').set({ userId: 'alice' });

      // Concurrent writers on every guarded path that can run without a
      // model call, staggered across the deletion's lifetime.
      const writers = Array.from({ length: 12 }, (_, i) =>
        (async () => {
          await new Promise(r => setTimeout(r, i * 3));
          const ops = [
            () =>
              m.accountState.writeIfAccountActive('alice', tx => {
                tx.set(m.db.doc(`readings/alice-w${round}-${i}`), { userId: 'alice' });
              }),
            () => m.idempotency.claimRequest('alice', `req-${round}-${i}`),
            () => m.wallet.creditWallet('alice', 1000, 'grant'),
            () =>
              call(m.syncReadings, 'alice', {
                readings: [
                  {
                    id: `alice-s${round}-${i}`,
                    question: 'Will this work?',
                    questionLang: 'en',
                    category: 'general',
                    verdict: 'YES',
                    createdAt: new Date().toISOString(),
                  },
                ],
              }),
          ];
          try {
            await ops[i % ops.length]!();
            tally.landedThenSwept += 1;
          } catch (err) {
            if ((err as { code?: string }).code === 'failed-precondition') {
              tally.refused += 1;
            } else {
              tally.otherErrors.push(String(err));
            }
          }
        })(),
      );

      await Promise.all([call(m.deleteAccount, 'alice'), ...writers]);

      // The invariant: whatever won the race, nothing deletable survives.
      const left = (await pathsFor('alice')).filter(p => !KEPT.test(p));
      expect(left, `round ${round}`).toEqual([]);
    }

    console.warn('[emulator race]', JSON.stringify(tally));
    expect(tally.otherErrors).toEqual([]);
    // Both outcomes must actually occur, or the race was never exercised.
    expect(tally.landedThenSwept).toBeGreaterThan(0);
    expect(tally.refused).toBeGreaterThan(0);
  }, 300_000);
});
