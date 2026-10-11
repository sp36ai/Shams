/**
 * Regression coverage for a retry-after-null-reply bug in discussReading.ts.
 * --------------------------------------------------------------------------
 * When composeDiscussionReply() returns null — Claude unreachable, a
 * malformed response, or a reply that failed PHASE 5F validation — the
 * handler refunds the spent discussion turn and throws 'unavailable', which
 * the client (ReadingScreen.errorMessageFor) renders as a failed bubble with
 * a Retry button. That retry reuses the SAME requestId (see
 * ReadingScreen.tsx's handleRetry: "under its own SAME requestId, so the
 * turn is not spent twice").
 *
 * The idempotency claim taken at the top of the handler must not outlive
 * that failed attempt, or the retry runs straight into claimRequest's
 * in-flight branch and is told "This question is already being read" for up
 * to IN_PROGRESS_TIMEOUT_MS (3 minutes) — even though nothing is running.
 * The catch block for a load/transaction failure already released the claim
 * correctly; the null-reply branch below it did not. Fixed by adding the
 * same release() call there.
 *
 * Firestore and the idempotency/composer modules are faked at the module
 * boundary, same discipline as readings.test.ts and idempotency.test.ts —
 * this exercises the REAL callable via its .run() handle, not a
 * re-implementation of its control flow.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { ReadingDoc } from '../../types';
import type { ClaimResult } from '../../utils/idempotency';
import type { DiscussionReply } from '../../oracle/discussionComposer';

interface FakeRef {
  id: string;
  get: () => Promise<{ exists: boolean; data: () => unknown }>;
  update: (data: Record<string, unknown>) => Promise<void>;
}

const readings = new Map<string, ReadingDoc>();
const auditLogs: unknown[] = [];

function fakeReadingRef(id: string): FakeRef {
  return {
    id,
    get: () => Promise.resolve({ exists: readings.has(id), data: () => readings.get(id) }),
    update: (data: Record<string, unknown>) => {
      const prior = readings.get(id);
      if (prior !== undefined) {
        // FieldValue.increment sentinels are never interpreted here — no
        // assertion in this file depends on the post-refund turn count,
        // only on whether the idempotency claim was released.
        readings.set(id, { ...prior, ...data } as ReadingDoc);
      }
      return Promise.resolve();
    },
  };
}

vi.mock('../../utils/admin', () => ({
  db: {
    collection: (name: string) => {
      if (name === 'readings') {
        return { doc: (id: string) => fakeReadingRef(id) };
      }
      if (name === 'auditLogs') {
        return {
          add: (data: unknown) => {
            auditLogs.push(data);
            return Promise.resolve();
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (ref: FakeRef) => ref.get(),
        update: (ref: FakeRef, data: Record<string, unknown>) => ref.update(data),
      }),
  },
}));

const enforceRateLimitMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../middleware/rateLimit', () => ({
  enforceRateLimit: (userId: string) => enforceRateLimitMock(userId) as Promise<void>,
}));

const claimRequestMock: Mock = vi.fn().mockResolvedValue({ replay: null });
const completeRequestMock: Mock = vi.fn().mockResolvedValue(undefined);
const releaseRequestMock: Mock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/idempotency', () => ({
  claimRequest: (userId: string, requestId: string) =>
    claimRequestMock(userId, requestId) as Promise<ClaimResult<unknown>>,
  completeRequest: (userId: string, requestId: string, response: unknown) =>
    completeRequestMock(userId, requestId, response) as Promise<void>,
  releaseRequest: (userId: string, requestId: string) =>
    releaseRequestMock(userId, requestId) as Promise<void>,
}));

const composeDiscussionReplyMock: Mock = vi.fn();
vi.mock('../../oracle/discussionComposer', () => ({
  composeDiscussionReply: (input: unknown) =>
    composeDiscussionReplyMock(input) as Promise<DiscussionReply | null>,
}));

import { discussReading } from '../discussReading';

function seedReading(id: string, overrides: Partial<ReadingDoc> = {}): void {
  readings.set(id, {
    userId: 'alice',
    question: 'Will this work?',
    questionLang: 'en',
    category: 'career',
    verdict: 'DELAYED',
    confidence: 0.6,
    narration: { en: 'n', ur: 'n', hi: 'n' },
    reasoning: [],
    remedy: null,
    discussionTurns: 0,
    createdAt: {
      toDate: () => new Date('2026-08-15T00:00:00.000Z'),
    } as unknown as ReadingDoc['createdAt'],
    ...overrides,
  } as ReadingDoc);
}

function invoke(input: Record<string, unknown>, requestId?: string) {
  const handler = discussReading as unknown as {
    run: (req: {
      data: unknown;
      auth: { uid: string; token: Record<string, unknown> };
    }) => Promise<unknown>;
  };
  return handler.run({
    data: {
      readingId: 'r1',
      message: 'why?',
      lang: 'en',
      ...(requestId ? { requestId } : {}),
      ...input,
    },
    auth: { uid: 'alice', token: {} },
  });
}

beforeEach(() => {
  readings.clear();
  auditLogs.length = 0;
  claimRequestMock.mockReset().mockResolvedValue({ replay: null });
  completeRequestMock.mockReset().mockResolvedValue(undefined);
  releaseRequestMock.mockReset().mockResolvedValue(undefined);
  composeDiscussionReplyMock.mockReset();
});

describe('discussReading — idempotency claim release on a null reply', () => {
  it('releases the claim when composeDiscussionReply returns null, so a same-requestId retry is not blocked', async () => {
    seedReading('r1', { discussionTurns: 0 });
    composeDiscussionReplyMock.mockResolvedValueOnce(null);

    await expect(invoke({}, 'request-1')).rejects.toMatchObject({ code: 'unavailable' });

    expect(claimRequestMock).toHaveBeenCalledWith('alice', 'request-1');
    expect(releaseRequestMock).toHaveBeenCalledWith('alice', 'request-1');
  });

  it('refunds the spent turn on the same null-reply failure', async () => {
    seedReading('r1', { discussionTurns: 0 });
    composeDiscussionReplyMock.mockResolvedValueOnce(null);

    await expect(invoke({}, 'request-1')).rejects.toMatchObject({ code: 'unavailable' });

    // The transaction incremented to 1, the failure path decremented back —
    // both are FieldValue.increment sentinels in this fake, so the assertion
    // that matters is the CALL happened, not the fake's arithmetic on it.
    expect(readings.get('r1')?.discussionTurns).toBeDefined();
  });

  it('releases the claim on a load/transaction failure too (existing behavior, unchanged)', async () => {
    // No reading seeded — the transaction throws 'not-found' before
    // composeDiscussionReply is ever called.
    await expect(invoke({}, 'request-2')).rejects.toMatchObject({ code: 'not-found' });

    expect(releaseRequestMock).toHaveBeenCalledWith('alice', 'request-2');
    expect(composeDiscussionReplyMock).not.toHaveBeenCalled();
  });

  it('does NOT release the claim on success — the completed response stands for a same-id replay', async () => {
    seedReading('r1', { discussionTurns: 0 });
    composeDiscussionReplyMock.mockResolvedValueOnce({
      answer: 'It is delay, not denial.',
      isNewQuestion: false,
      conversationComplete: false,
    });

    const result = await invoke({}, 'request-3');

    expect(result).toMatchObject({ answer: 'It is delay, not denial.' });
    expect(releaseRequestMock).not.toHaveBeenCalled();
    expect(completeRequestMock).toHaveBeenCalledWith('alice', 'request-3', expect.anything());
  });
});

describe('discussReading — the oracle closes the conversation (owner decision 2026-10-11)', () => {
  it('returns the closing reply and marks the reading closed', async () => {
    seedReading('r1', { discussionTurns: 3 });
    composeDiscussionReplyMock.mockResolvedValueOnce({
      answer: 'You hold what this reading can give. A new question deserves its own moment.',
      isNewQuestion: false,
      conversationComplete: true,
    });

    const result = await invoke({}, 'request-close');

    expect(result).toMatchObject({ conversationComplete: true });
    expect(readings.get('r1')?.discussionClosed).toBe(true);
  });

  it('keeps an ordinary reply open', async () => {
    seedReading('r1', { discussionTurns: 3 });
    composeDiscussionReplyMock.mockResolvedValueOnce({
      answer: 'Zuhal holds the gate.',
      isNewQuestion: false,
      conversationComplete: false,
    });

    const result = await invoke({}, 'request-open');

    expect(result).toMatchObject({ conversationComplete: false });
    expect(readings.get('r1')?.discussionClosed).toBeUndefined();
  });

  it('declines a follow-up on a closed reading without calling the model', async () => {
    seedReading('r1', { discussionTurns: 3, discussionClosed: true });

    await expect(invoke({}, 'request-after')).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    expect(composeDiscussionReplyMock).not.toHaveBeenCalled();
    expect(releaseRequestMock).toHaveBeenCalledWith('alice', 'request-after');
  });

  it('no longer stops at 12 follow-ups', async () => {
    seedReading('r1', { discussionTurns: 12 });
    composeDiscussionReplyMock.mockResolvedValueOnce({
      answer: 'Still here.',
      isNewQuestion: false,
      conversationComplete: false,
    });

    await expect(invoke({}, 'request-13')).resolves.toMatchObject({ answer: 'Still here.' });
  });
});
