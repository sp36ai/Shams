/**
 * cleanupUserData — cascading account-erasure trigger.
 * --------------------------------------------------------------------------
 * Fires the moment a Firebase Auth user record is destroyed — whether from
 * this app's own account-deletion flow (Settings → authStore.deleteAccount())
 * or an admin-console deletion. A server-side Admin SDK operation is the
 * only place this can be guaranteed regardless of the trigger: a
 * client-side callable could be interrupted mid-execution by a dropped
 * connection right after the Auth record is gone but before cleanup runs.
 *
 * This app currently offers only email/password and Google sign-in — no
 * Sign in with Apple, so there is no live "user revokes it from iOS
 * Settings" path today. Worth keeping the trigger-based design anyway: if
 * Apple Sign-In is ever added, Apple requires supporting that exact
 * revocation path, which bypasses any in-app UI entirely and could only
 * ever be caught here.
 *
 * Scope — verified against the real schema in `firestore.rules` and every
 * `.collection()` call in this codebase, not assumed:
 *
 *   DELETE  readings          — top-level docs, `userId` field. Queried and
 *                               batch-deleted 500 at a time, the same
 *                               chunking `syncReadings` already uses.
 *   DELETE  quotas/{uid}      — direct doc delete.
 *   DELETE  trials/{uid}      — direct doc delete.
 *   DELETE  users/{uid}       — direct doc delete. Provisioned in
 *                               firestore.rules but not written by any
 *                               code path today — included defensively so
 *                               a future feature that starts using it
 *                               doesn't silently create an erasure gap.
 *   DELETE  rateLimits/{uid}/** — recursiveDelete. Rolling rate-limit
 *                               state under a per-user subcollection.
 *
 *   PRESERVE auditLogs, securityEvents — NOT erased. This project's
 *                               standing rules list audit logs as
 *                               protected infrastructure to preserve, and
 *                               every write path (askWatchOracle, both
 *                               payment webhooks) treats these as the
 *                               compliance/fraud record of what an
 *                               account did, not as that account's
 *                               content — an account being deleted
 *                               shouldn't erase the trail of it.
 *   PRESERVE purchaseTokens    — NOT erased. Its documented purpose is
 *                               binding a Play Store purchase token to
 *                               the account that redeemed it, specifically
 *                               so one leaked token can't be redeemed by
 *                               more than one account. Deleting it on
 *                               account deletion would reopen exactly
 *                               that hole — sign up again with the same
 *                               token, claim the premium unlock again.
 *
 * API note: this is the one deliberate v1 function in the codebase. The
 * classic auth-delete trigger has no v2 equivalent yet; every callable
 * function here otherwise uses `firebase-functions/v2/https`.
 */

import * as functionsV1 from 'firebase-functions/v1';
import { db } from '../utils/admin';
import { logger } from '../utils/logger';
import { REGION } from '../config';

const MAX_BATCH_SIZE = 500; // Firestore batch limit — same cap syncReadings chunks around.

/**
 * Deletes every `readings` doc owned by `userId`, 500 at a time. Re-queries
 * after each committed batch rather than paging one snapshot — once a batch
 * commits those docs are gone, so the next query naturally picks up
 * whatever's left, with no cursor bookkeeping needed for a bounded cleanup.
 */
async function deleteAllReadings(userId: string): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await db
      .collection('readings')
      .where('userId', '==', userId)
      .limit(MAX_BATCH_SIZE)
      .get();

    if (snap.empty) {
      break;
    }

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;

    if (snap.size < MAX_BATCH_SIZE) {
      break;
    }
  }
  return deleted;
}

export const cleanupUserData = functionsV1
  .region(REGION)
  .auth.user()
  .onDelete(async user => {
    const userId = user.uid;
    logger.info('cleanupUserData: starting cascade delete', { userId });

    try {
      const [readingsDeleted] = await Promise.all([
        deleteAllReadings(userId),
        db.collection('quotas').doc(userId).delete(),
        db.collection('trials').doc(userId).delete(),
        db.collection('users').doc(userId).delete(),
        db.recursiveDelete(db.collection('rateLimits').doc(userId)),
      ]);

      logger.info('cleanupUserData: cascade delete complete', { userId, readingsDeleted });
    } catch (err) {
      // Logged with full context so a partial cleanup surfaces in Cloud
      // Logging rather than silently reporting success — re-thrown so the
      // invocation itself is recorded as failed in Cloud Functions' own
      // error metrics. Automatic retry is a deploy-time setting on this
      // function, not guaranteed by the throw alone.
      logger.error('cleanupUserData: cascade delete failed', { userId, err: String(err) });
      throw err;
    }
  });
