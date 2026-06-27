/**
 * Reading management functions.
 *
 * syncReadings  — bulk-upserts locally-computed readings to Firestore.
 *                 Used when the user upgrades from offline-only to synced.
 *                 Server validates ownership: userId in doc = caller's userId.
 *
 * deleteReading — deletes a single reading. Owner-only.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { parse, SyncReadingsSchema, DeleteReadingSchema } from '../middleware/validate';
import { logger } from '../utils/logger';
import { FUNCTION_OPTS } from '../config';

const MAX_BATCH_SIZE = 500; // Firestore batch limit

export const syncReadings = onCall(
  { ...FUNCTION_OPTS, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async request => {
    const { userId } = verifyAuth(request);
    const { readings } = parse(SyncReadingsSchema, request.data);

    if (readings.length === 0) {
      return { synced: 0 };
    }

    try {
      let synced = 0;

      // Firestore batches are capped at 500 ops; chunk if needed.
      for (let i = 0; i < readings.length; i += MAX_BATCH_SIZE) {
        const chunk = readings.slice(i, i + MAX_BATCH_SIZE);
        const batch = db.batch();

        for (const r of chunk) {
          const ref = db.collection('readings').doc(r.id);
          const clientCreatedAt = new Date(r.createdAt);
          const createdAt = clientCreatedAt > new Date() ? new Date() : clientCreatedAt;
          batch.set(
            ref,
            {
              userId, // server sets this — client cannot fake it
              question: r.question,
              questionLang: r.questionLang,
              category: r.category,
              verdict: r.verdict,
              createdAt,
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
