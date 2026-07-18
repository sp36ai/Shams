/**
 * deleteAccount — permanently delete the caller's account and personal data.
 *
 * Google Play (and basic data-protection hygiene) require an in-app path for a
 * user to delete their own account and associated data. This removes:
 *   - every /readings document owned by the caller
 *   - /quotas/{uid} and /trials/{uid}
 *   - the Firebase Auth user record itself
 *
 * Deliberately RETAINED (fraud-control / financial record, not personal
 * content — documented for the data-safety disclosure):
 *   - /auditLogs entries — opaque userId only; the payment-dispute / abuse trail
 *   - /playPurchaseTokens — token→account binding; keeping it stops a shared
 *     purchase token from being re-claimed by a fresh account after deletion
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db, auth } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { FUNCTION_OPTS } from '../config';

const DELETE_BATCH_SIZE = 400; // under Firestore's 500-op batch cap

async function deleteOwnedReadings(userId: string): Promise<number> {
  let deleted = 0;
  // Page through the user's readings and batch-delete until none remain.
  for (;;) {
    const snap = await db
      .collection('readings')
      .where('userId', '==', userId)
      .limit(DELETE_BATCH_SIZE)
      .get();
    if (snap.empty) {
      break;
    }
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < DELETE_BATCH_SIZE) {
      break;
    }
  }
  return deleted;
}

export const deleteAccount = onCall(
  { ...FUNCTION_OPTS, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async request => {
    const { userId } = verifyAuth(request);

    try {
      const readingsDeleted = await deleteOwnedReadings(userId);

      // Remove per-user quota + trial documents.
      const batch = db.batch();
      batch.delete(db.collection('quotas').doc(userId));
      batch.delete(db.collection('trials').doc(userId));
      await batch.commit();

      // Retain an opaque record of the deletion itself (no personal content).
      await db.collection('auditLogs').add({
        userId,
        action: 'account_deleted',
        readingsDeleted,
        ts: FieldValue.serverTimestamp(),
      });

      // Delete the Firebase Auth user LAST, so a failure in any step above never
      // leaves personal data behind with no owning account.
      await auth.deleteUser(userId);

      logger.info('account deleted', { userId, readingsDeleted });
      return { deleted: true, readingsDeleted };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      logger.error('deleteAccount failed', { userId, err: String(err) });
      throw new HttpsError('internal', 'Account deletion failed');
    }
  },
);
