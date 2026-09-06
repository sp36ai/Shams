/**
 * idempotency.ts — one user action, one reading, one quota slot.
 * --------------------------------------------------------------------------
 * askWatchOracle both charges the seeker and casts a chart, so "did this
 * already run?" cannot be answered from the client. A re-entrancy guard in the
 * app protects against a double tap and nothing else: if the process dies
 * after the server has cast and charged but before the response lands, the
 * seeker retries, and without this they are charged twice for one question and
 * end up with two Readings of the same moment.
 *
 * The client sends a requestId it generates once per user action and reuses on
 * every retry of that action. The server records it, scoped to the caller's
 * UID (never to a client-supplied user id), and:
 *
 *     first arrival  → claim the id, run the work, store the response
 *     retry, done    → return the ORIGINAL response; no chart, no quota
 *     retry, running → 'aborted', a retryable error, because the first attempt
 *                      may still be about to succeed and casting a second
 *                      chart would be the exact duplicate this prevents
 *     failed attempt → the claim is released, so a genuine retry proceeds
 *
 * The claim is a transactional create-if-absent, so two concurrent calls with
 * the same id cannot both win it.
 *
 * Records carry `expiresAt` for a Firestore TTL policy on the collection —
 * they exist to deduplicate a retry, not to be an audit log. Without that
 * policy configured they simply accumulate; see DEPLOYMENT.md.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import { logger } from './logger';

const COLLECTION = 'idempotencyKeys';

/** How long a completed response can still be replayed to a retry. */
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How long an in-progress claim blocks a retry. Sized above the callable's own
 * 120s ceiling: while the first attempt could still return, a second must not
 * start. Past it the claim is stale — the attempt that made it can no longer
 * be running — and the retry takes it over.
 */
const IN_PROGRESS_TIMEOUT_MS = 3 * 60 * 1000;

interface IdempotencyDoc {
  userId: string;
  status: 'in_progress' | 'done';
  claimedAt: number;
  /** The original response, replayed verbatim to a retry. */
  response?: unknown;
  expiresAt: Date;
}

/**
 * Scoped to the caller's UID so one user's requestId can never collide with —
 * or read back — another's.
 */
function docId(userId: string, requestId: string): string {
  return `${userId}__${requestId}`;
}

export interface ClaimResult<T> {
  /** Set when this action already completed: return it and do nothing else. */
  replay: T | null;
}

/**
 * Claim a requestId before doing any charged work.
 *
 * Throws 'aborted' when an attempt is already in flight. Returns a replay when
 * the action has already completed.
 */
export async function claimRequest<T>(userId: string, requestId: string): Promise<ClaimResult<T>> {
  const ref = db.collection(COLLECTION).doc(docId(userId, requestId));
  const now = Date.now();

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);

    if (snap.exists) {
      const data = snap.data() as IdempotencyDoc;

      if (data.status === 'done') {
        logger.info('idempotent replay', { userId, requestId });
        return { replay: (data.response ?? null) as T | null };
      }

      if (now - data.claimedAt < IN_PROGRESS_TIMEOUT_MS) {
        throw new HttpsError('aborted', 'This question is already being read. Give it a moment.');
      }
      // Stale claim: the attempt that made it cannot still be running.
      logger.warn('idempotency claim taken over after timeout', { userId, requestId });
    }

    const doc: IdempotencyDoc = {
      userId,
      status: 'in_progress',
      claimedAt: now,
      expiresAt: new Date(now + RECORD_TTL_MS),
    };
    tx.set(ref, doc);
    return { replay: null };
  });
}

/** Record the response so a retry of this action replays it. */
export async function completeRequest(
  userId: string,
  requestId: string,
  response: unknown,
): Promise<void> {
  try {
    await db
      .collection(COLLECTION)
      .doc(docId(userId, requestId))
      .set(
        {
          userId,
          status: 'done',
          claimedAt: Date.now(),
          response,
          expiresAt: new Date(Date.now() + RECORD_TTL_MS),
        },
        { merge: true },
      );
  } catch (err) {
    // The reading itself succeeded and has been returned. Failing to record
    // that only costs deduplication of a retry, which must not turn a
    // successful reading into an error.
    logger.warn('idempotency completion write failed', {
      err: String(err),
      userId,
      requestId,
    });
  }
}

/**
 * Release a claim whose work failed, so the seeker's retry genuinely retries.
 * A failed attempt has already refunded its quota slot; leaving the claim in
 * place would block the next attempt for IN_PROGRESS_TIMEOUT_MS.
 */
export async function releaseRequest(userId: string, requestId: string): Promise<void> {
  try {
    await db.collection(COLLECTION).doc(docId(userId, requestId)).delete();
  } catch (err) {
    logger.warn('idempotency claim release failed', {
      err: String(err),
      userId,
      requestId,
    });
  }
}
