/**
 * PHASE 6A-R1 — permanent regression coverage for the syncReadings
 * ownership-check remediation.
 * --------------------------------------------------------------------------
 * Closes the finding recorded at
 * docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md §4: syncReadings wrote
 * to a fully client-supplied Firestore document id with no check of the
 * document's existing, persisted ownership — an authenticated caller who
 * knew another user's reading id could overwrite it and reassign its
 * userId to themselves.
 *
 * A minimal fake Firestore models exactly the calls readings.ts makes
 * (`collection().doc()`, `getAll()`, `batch().set()/.commit()`) against an
 * in-memory map of "existing documents" each test seeds directly — no
 * emulator needed, and the fake's own behavior (existence + ownership
 * checked from what is already "persisted", never from what the write
 * payload claims) is exactly what a real Firestore instance would do for
 * the property under test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

interface FakeDoc {
  userId: string;
  [key: string]: unknown;
}

const existing = new Map<string, FakeDoc>();
const committedWrites: Array<{ id: string; data: Record<string, unknown> }> = [];

function reset(): void {
  existing.clear();
  committedWrites.length = 0;
}

interface FakeRef {
  id: string;
  get: () => Promise<{ exists: boolean; data: () => FakeDoc | undefined }>;
  delete: () => Promise<void>;
}

function fakeDb() {
  return {
    collection: (name: string) => {
      if (name !== 'readings') {
        throw new Error(`unexpected collection: ${name}`);
      }
      return {
        doc: (id: string): FakeRef => ({
          id,
          get: () => {
            const doc = existing.get(id);
            return Promise.resolve({ exists: doc !== undefined, data: () => doc });
          },
          delete: () => {
            existing.delete(id);
            return Promise.resolve();
          },
        }),
      };
    },
    getAll: (...refs: FakeRef[]) =>
      Promise.resolve(
        refs.map(ref => {
          const doc = existing.get(ref.id);
          return {
            id: ref.id,
            exists: doc !== undefined,
            data: () => doc,
          };
        }),
      ),
    batch: () => {
      const pending: Array<{ id: string; data: Record<string, unknown> }> = [];
      return {
        set: (ref: FakeRef, data: Record<string, unknown>, _opts: { merge: boolean }) => {
          pending.push({ id: ref.id, data });
        },
        commit: () => {
          for (const p of pending) {
            committedWrites.push(p);
            // A real merge write updates the persisted document — model
            // that so a second batch in the same test sees the result of
            // the first, exactly like real Firestore would.
            const prior = existing.get(p.id) ?? ({} as FakeDoc);
            existing.set(p.id, { ...prior, ...p.data } as FakeDoc);
          }
          return Promise.resolve();
        },
      };
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

import { checkReadingOwnership, syncReadings, deleteReading } from '../readings';

beforeEach(() => {
  reset();
});

/* -------------------------------------------------------------------------- */
/*  checkReadingOwnership — the core ownership-check primitive               */
/* -------------------------------------------------------------------------- */

describe('PHASE 6A-R1 — checkReadingOwnership', () => {
  it('1. an existing, same-user reading id is allowed (no throw)', async () => {
    existing.set('r1', { userId: 'alice' });
    await expect(checkReadingOwnership(['r1'], 'alice')).resolves.toBeUndefined();
  });

  it('2. an existing, different-user reading id is rejected', async () => {
    existing.set('r1', { userId: 'bob' });
    await expect(checkReadingOwnership(['r1'], 'alice')).rejects.toThrow(HttpsError);
    await expect(checkReadingOwnership(['r1'], 'alice')).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('3. a nonexistent reading id is allowed — the ordinary new-reading case', async () => {
    await expect(checkReadingOwnership(['does-not-exist'], 'alice')).resolves.toBeUndefined();
  });

  it('4. mixed ownership in one batch: any conflict rejects the whole check', async () => {
    existing.set('mine', { userId: 'alice' });
    existing.set('theirs', { userId: 'bob' });
    await expect(checkReadingOwnership(['mine', 'theirs'], 'alice')).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('a batch of entirely legitimate ids (mix of existing-own and new) is allowed', async () => {
    existing.set('mine', { userId: 'alice' });
    await expect(checkReadingOwnership(['mine', 'brand-new'], 'alice')).resolves.toBeUndefined();
  });

  it('an empty id list is a trivial no-op', async () => {
    await expect(checkReadingOwnership([], 'alice')).resolves.toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  syncReadings — the actual callable, real Zod validation included          */
/* -------------------------------------------------------------------------- */

function reading(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    question: 'Will this work?',
    questionLang: 'en',
    category: 'general',
    verdict: 'PENDING',
    createdAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  };
}

// syncReadings is an onCall-wrapped handler; invoke its inner logic the
// same way the codebase's other callable tests do — via the exported
// .run() the Firebase Functions v2 SDK attaches for local invocation, so
// this exercises the REAL callable, not a re-implementation of it.
async function invokeSyncReadings(readings: unknown[], userId = 'alice') {
  const handler = syncReadings as unknown as {
    run: (req: {
      data: unknown;
      auth: { uid: string; token: Record<string, unknown> };
    }) => Promise<unknown>;
  };
  return handler.run({ data: { readings }, auth: { uid: userId, token: {} } });
}

describe('PHASE 6A-R1 — syncReadings integration (real callable, real Zod validation)', () => {
  it('5. {merge:true} cannot overwrite another user’s ownership — the write never happens', async () => {
    existing.set('victim-reading', { userId: 'bob', question: 'original', verdict: 'YES' });

    await expect(
      invokeSyncReadings([reading({ id: 'victim-reading', question: 'HIJACKED' })], 'alice'),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    // The document must be byte-for-byte unchanged — no partial write.
    expect(existing.get('victim-reading')).toEqual({
      userId: 'bob',
      question: 'original',
      verdict: 'YES',
    });
    expect(committedWrites).toHaveLength(0);
  });

  it('6. client-supplied ownership fields cannot bypass the check — a spoofed userId is inert, never read', async () => {
    // Per-item reading schema doesn't declare a `userId` field at all
    // (SyncReadingsSchema's inner object schema, unlike its outer
    // wrapper, is not itself .strict() — Zod's default behavior for a
    // non-strict schema is to silently drop unrecognized keys, not
    // reject them). Either way, the write path never reads `r.userId`
    // — it always writes the AUTH-derived `userId` — so a spoofed value
    // here has no path to influence anything, regardless of whether Zod
    // stripped it. This proves the actual invariant: the resulting
    // document's ownership is the caller's real uid, never the injected one.
    const result = await invokeSyncReadings(
      [{ ...reading({ id: 'new-2' }), userId: 'bob' }],
      'alice',
    );
    expect(result).toEqual({ synced: 1 });
    expect(existing.get('new-2')?.userId).toBe('alice');
  });

  it('a legitimate same-user sync (new reading) succeeds exactly as before', async () => {
    const result = await invokeSyncReadings([reading({ id: 'new-1' })], 'alice');
    expect(result).toEqual({ synced: 1 });
    expect(existing.get('new-1')?.userId).toBe('alice');
  });

  it('a legitimate same-user re-sync (existing own reading) succeeds', async () => {
    existing.set('mine', { userId: 'alice', question: 'old' });
    const result = await invokeSyncReadings(
      [reading({ id: 'mine', question: 'updated' })],
      'alice',
    );
    expect(result).toEqual({ synced: 1 });
    expect(existing.get('mine')?.question).toBe('updated');
  });

  it('mixed batch (one own, one foreign) rejects the whole call — no unauthorized AND no legitimate write happens', async () => {
    existing.set('mine', { userId: 'alice', question: 'old' });
    existing.set('theirs', { userId: 'bob', question: 'original' });

    await expect(
      invokeSyncReadings(
        [
          reading({ id: 'mine', question: 'updated' }),
          reading({ id: 'theirs', question: 'hijack' }),
        ],
        'alice',
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    // Fail-closed: not even the legitimate entry in the same batch is
    // written, matching this remediation's own documented design choice.
    expect(existing.get('mine')?.question).toBe('old');
    expect(existing.get('theirs')?.question).toBe('original');
    expect(committedWrites).toHaveLength(0);
  });

  it('an empty readings array is a no-op, unchanged from before', async () => {
    const result = await invokeSyncReadings([], 'alice');
    expect(result).toEqual({ synced: 0 });
  });
});

/* -------------------------------------------------------------------------- */
/*  deleteReading — existing ownership behavior confirmed intact (7)          */
/* -------------------------------------------------------------------------- */

async function invokeDeleteReading(readingId: string, userId = 'alice') {
  const handler = deleteReading as unknown as {
    run: (req: {
      data: unknown;
      auth: { uid: string; token: Record<string, unknown> };
    }) => Promise<unknown>;
  };
  return handler.run({ data: { readingId }, auth: { uid: userId, token: {} } });
}

describe('PHASE 6A-R1 — deleteReading: unchanged, still ownership-checked (requirement 7)', () => {
  it('deletes a same-user reading', async () => {
    existing.set('mine', { userId: 'alice' });
    const result = await invokeDeleteReading('mine', 'alice');
    expect(result).toEqual({ deleted: 'mine' });
    expect(existing.has('mine')).toBe(false);
  });

  it('rejects deleting a different user’s reading — untouched by this phase', async () => {
    existing.set('theirs', { userId: 'bob' });
    await expect(invokeDeleteReading('theirs', 'alice')).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(existing.has('theirs')).toBe(true);
  });

  it('rejects deleting a nonexistent reading', async () => {
    await expect(invokeDeleteReading('ghost', 'alice')).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});
