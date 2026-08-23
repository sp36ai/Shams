/**
 * deleteAccount — permanently deletes a user's account and every category of
 * data the Privacy Policy's deletion section names: profile, quota, trial,
 * and every reading.
 *
 * This is the technical control the audit's §7 finding said was missing —
 * the Privacy Policy promised "all associated data (readings, quota
 * records, subscription status) is permanently deleted within 30 days" of
 * account deletion, and until this function existed, nothing in the
 * codebase actually did that.
 *
 * Deliberately NOT deleted:
 *   - /purchaseTokens/{tokenHash} entries referencing this uid — deleting
 *     the token binding would defeat its whole purpose (a leaked purchase
 *     token could then be redeemed again by a different account; see
 *     payments/googlePlay.ts). This is a fraud-prevention record, not a
 *     personal-data record in the sense the deletion promise covers.
 *   - /auditLogs and /securityEvents entries — these carry no raw PII
 *     (question text is hashed, everything else is opaque ids/business
 *     fields; see utils/logger.ts's logging policy) and exist specifically
 *     as the fraud/abuse trail this same audit's payment-security findings
 *     depend on. privacy-policy.html states this retention exception
 *     explicitly so the policy text matches this actual behavior.
 *
 * Order matters: Firestore data is deleted before the Firebase Auth user.
 * Deleting Auth first would invalidate the caller's own ID token mid-
 * operation, and would make a retry after a partial failure impossible to
 * authenticate (the caller could never prove who they were again). Every
 * step is idempotent — safe to call this function again if a prior attempt
 * was interrupted partway (a timeout, a transient Firestore error).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db, auth } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { enforceRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { FUNCTION_OPTS } from '../config';

// Firestore batches cap at 500 ops; stay comfortably under that per page so a
// single query+batch round-trip never risks hitting the ceiling from a
// concurrent write landing between the query and the commit.
const READINGS_DELETE_PAGE_SIZE = 400;

async function deleteAllReadings(userId: string): Promise<number> {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await db
      .collection('readings')
      .where('userId', '==', userId)
      .limit(READINGS_DELETE_PAGE_SIZE)
      .get();
    if (snap.empty) {
      break;
    }
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < READINGS_DELETE_PAGE_SIZE) {
      break;
    }
  }
  return deleted;
}

export const deleteAccount = onCall(
  {
    ...FUNCTION_OPTS,
    timeoutSeconds: 120, // generous headroom for the readings-deletion loop
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async request => {
    const { userId } = verifyAuth(request);
    await enforceRateLimit(userId);

    try {
      const deletedReadings = await deleteAllReadings(userId);

      // Profile, quota, trial — small, fixed set, one batch.
      const cleanupBatch = db.batch();
      cleanupBatch.delete(db.collection('users').doc(userId));
      cleanupBatch.delete(db.collection('quotas').doc(userId));
      cleanupBatch.delete(db.collection('trials').doc(userId));
      await cleanupBatch.commit();

      // Auth user last (see module doc). "Already gone" counts as success —
      // that's what makes calling this twice (a retried request after a
      // client-side timeout) safe rather than a hard failure.
      try {
        await auth.deleteUser(userId);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== 'auth/user-not-found') {
          throw err;
        }
      }

      logger.info('account deleted', { userId, deletedReadings });

      // Deliberately no PII here either — same policy as every other audit
      // log in this codebase (see utils/logger.ts).
      await db.collection('auditLogs').add({
        userId,
        action: 'account_deleted',
        deletedReadings,
        ts: FieldValue.serverTimestamp(),
      });

      return { deleted: true, readingsDeleted: deletedReadings };
    } catch (err) {
      logger.error('deleteAccount failed', {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError(
        'internal',
        'Account deletion could not be completed. Please try again or contact support.',
      );
    }
  },
);
