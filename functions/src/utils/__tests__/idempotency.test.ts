/**
 * idempotency — one user action, one reading, one quota slot.
 *
 * The properties tested here are the ones a client-side guard cannot provide,
 * because they must hold across process death: a retry of a completed action
 * replays the original response without casting or charging again, a retry of
 * an in-flight action is refused rather than duplicated, and a retry of a
 * FAILED action genuinely retries.
 *
 * Firestore is faked at the module boundary — the transaction semantics that
 * matter (get-then-create-if-absent inside one transaction) are the contract
 * this file depends on, not something a unit test can meaningfully re-verify
 * against the real service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface StoredDoc {
  [key: string]: unknown;
}

const docs = new Map<string, StoredDoc>();

function makeRef(id: string) {
  return {
    id,
    get: () => Promise.resolve({ exists: docs.has(id), data: () => docs.get(id) }),
    set: (value: StoredDoc, options?: { merge?: boolean }) => {
      docs.set(id, options?.merge === true ? { ...docs.get(id), ...value } : value);
      return Promise.resolve();
    },
    delete: () => {
      docs.delete(id);
      return Promise.resolve();
    },
  };
}

vi.mock('../admin', () => ({
  db: {
    collection: () => ({ doc: (id: string) => makeRef(id) }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (ref: { id: string }, value: StoredDoc) => {
          docs.set(ref.id, value);
        },
      }),
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Imported after the mocks above are declared — vi.mock is hoisted, so a
// static import here would still get the fakes, but this states the ordering.
import { claimRequest, completeRequest, releaseRequest } from '../idempotency';

beforeEach(() => {
  docs.clear();
});

describe('claimRequest', () => {
  it('lets the first attempt through with nothing to replay', async () => {
    const { replay } = await claimRequest('user-1', 'req-1');
    expect(replay).toBeNull();
  });

  it('replays the original response instead of running the work again', async () => {
    await claimRequest('user-1', 'req-1');
    await completeRequest('user-1', 'req-1', { readingId: 'r1', quotaRemaining: 2 });

    const { replay } = await claimRequest<{ readingId: string }>('user-1', 'req-1');
    expect(replay).toEqual({ readingId: 'r1', quotaRemaining: 2 });
  });

  it('refuses a retry while the first attempt could still succeed', async () => {
    await claimRequest('user-1', 'req-1');
    await expect(claimRequest('user-1', 'req-1')).rejects.toMatchObject({ code: 'aborted' });
  });

  it('takes over a claim old enough that its attempt cannot still be running', async () => {
    await claimRequest('user-1', 'req-1');
    const stored = docs.get('user-1__req-1') as { claimedAt: number };
    stored.claimedAt = Date.now() - 10 * 60 * 1000;

    const { replay } = await claimRequest('user-1', 'req-1');
    expect(replay).toBeNull();
  });

  it('scopes ids to the caller, so one user cannot read back another response', async () => {
    await claimRequest('user-1', 'shared-id');
    await completeRequest('user-1', 'shared-id', { readingId: 'r1' });

    // Same id, different authenticated user: a fresh claim, not a replay.
    const { replay } = await claimRequest('user-2', 'shared-id');
    expect(replay).toBeNull();
  });

  it('lets a genuine retry proceed after a failed attempt released its claim', async () => {
    await claimRequest('user-1', 'req-1');
    await releaseRequest('user-1', 'req-1');

    const { replay } = await claimRequest('user-1', 'req-1');
    expect(replay).toBeNull();
  });
});

describe('completeRequest', () => {
  it('resolves rather than throwing, so recording never fails a cast reading', async () => {
    // The reading has already been cast and returned; failing to record it
    // only costs deduplication of a retry, and must not fail the reading.
    docs.set('user-1__req-1', { status: 'in_progress' });
    await expect(completeRequest('user-1', 'req-1', { readingId: 'r1' })).resolves.toBeUndefined();
  });
});
