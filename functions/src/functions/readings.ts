/**
 * Reading management functions.
 *
 * syncReadings  — bulk-upserts locally-computed readings to Firestore.
 *                 Used when the user upgrades from offline-only to synced.
 *                 Server validates ownership: userId in doc = caller's userId.
 *
 * deleteReading — deletes a single reading. Owner-only.
 *
 * PHASE 6A-R1: syncReadings' own doc comment above claimed ownership
 * validation this function did not actually perform — see
 * docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md §4 and
 * docs/audit/PHASE_6A_R1_OWNERSHIP_ENTITLEMENT_HARDENING.md for the full
 * finding and remediation record. `r.id` is fully client-supplied (Zod
 * only bounds it to a non-empty string ≤128 chars); the write was an
 * unconditional `{merge: true}` that both overwrote whatever already
 * existed at that id AND unconditionally reset its `userId` to the
 * caller's own uid — a cross-user reading could be overwritten and its
 * ownership reassigned by any authenticated caller who knew its id.
 * `checkReadingOwnership()` below closes this: every id in the batch is
 * read BEFORE any write, and the whole call is rejected — nothing in the
 * batch is written — if any existing document belongs to a different
 * user. A nonexistent id is treated as a legitimate new reading (the
 * ordinary case: a locally-cast reading being synced for the first
 * time), matching this function's own original, intended behavior for
 * that case exactly.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { parse, SyncReadingsSchema, DeleteReadingSchema } from '../middleware/validate';
import { logger } from '../utils/logger';
import { FUNCTION_OPTS } from '../config';

const MAX_BATCH_SIZE = 500; // Firestore batch limit

/**
 * PHASE 6A-R1: does every reading id in this sync request either not yet
 * exist, or already belong to `userId`? Reads every id in the batch via a
 * single `db.getAll()` call BEFORE any write is attempted — ownership is
 * established from the document's own PERSISTED `userId` field, never
 * from anything the client supplied (the sync payload has no `userId`
 * field at all — `SyncReadingsSchema` is `.strict()` and does not declare
 * one, so Zod itself rejects an attempt to smuggle one in before this
 * function is ever reached).
 *
 * Throws `permission-denied` — and performs no write of any kind, for
 * any reading in the batch, including the legitimate ones — the moment a
 * single conflicting id is found. This is the "smallest safe correction"
 * behavior: a batch is accepted only when every id in it is genuinely
 * this caller's own (new or existing), exactly preserving the original,
 * intended synchronization behavior for that — the only — case, and
 * failing closed rather than partially, silently applying some writes
 * and dropping others, for any other case.
 *
 * Exported for direct testing.
 */
export async function checkReadingOwnership(
  readingIds: readonly string[],
  userId: string,
): Promise<void> {
  if (readingIds.length === 0) {
    return;
  }
  const refs = readingIds.map(id => db.collection('readings').doc(id));
  const snaps = await db.getAll(...refs);
  for (const snap of snaps) {
    if (!snap.exists) {
      continue; // nonexistent id — a legitimate new reading, allowed
    }
    const existingUserId = (snap.data() as { userId?: string } | undefined)?.userId;
    if (existingUserId !== userId) {
      logger.warn('syncReadings: rejected — id belongs to a different user', {
        userId,
        readingId: snap.id,
      });
      throw new HttpsError('permission-denied', 'One or more readings could not be synced.');
    }
  }
}

export const syncReadings = onCall(
  { ...FUNCTION_OPTS, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async request => {
    const { userId } = verifyAuth(request);
    const { readings } = parse(SyncReadingsSchema, request.data);

    if (readings.length === 0) {
      return { synced: 0 };
    }

    try {
      // PHASE 6A-R1: verify every id in the WHOLE request before writing
      // any of it — not per-chunk, so a conflict discovered in a later
      // chunk cannot be preceded by writes from an earlier one.
      await checkReadingOwnership(
        readings.map(r => r.id),
        userId,
      );

      let synced = 0;

      // Firestore batches are capped at 500 ops; chunk if needed.
      for (let i = 0; i < readings.length; i += MAX_BATCH_SIZE) {
        const chunk = readings.slice(i, i + MAX_BATCH_SIZE);
        const batch = db.batch();

        for (const r of chunk) {
          const ref = db.collection('readings').doc(r.id);
          batch.set(
            ref,
            {
              userId, // server sets this — client cannot fake it
              question: r.question,
              questionLang: r.questionLang,
              category: r.category,
              verdict: r.verdict,
              createdAt: new Date(r.createdAt),
              syncedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          synced++;
        }

        await batch.commit();
      }

      logger.info('readings synced', { userId, count: synced });
      return { synced };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      logger.error('syncReadings failed', { userId, err: String(err) });
      throw new HttpsError('internal', 'Sync failed');
    }
  },
);

export const deleteReading = onCall(
  { ...FUNCTION_OPTS, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async request => {
    const { userId } = verifyAuth(request);
    const { readingId } = parse(DeleteReadingSchema, request.data);

    try {
      const ref = db.collection('readings').doc(readingId);
      const snap = await ref.get();

      if (!snap.exists) {
        throw new HttpsError('not-found', 'Reading not found');
      }

      // Ownership check — prevent cross-user deletion
      if ((snap.data() as { userId?: string }).userId !== userId) {
        logger.warn('unauthorized delete attempt', { userId, readingId });
        throw new HttpsError('permission-denied', 'Not your reading');
      }

      await ref.delete();
      logger.info('reading deleted', { userId, readingId });
      return { deleted: readingId };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', 'Delete failed');
    }
  },
);
