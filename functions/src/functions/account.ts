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
 * Also deleted (deletion hardening, 2026-10-20 — these survived deletion
 * before, contrary to the policy's "every reading" promise):
 *   - /idempotencyKeys docs with this userId — each stores a full reading
 *     or follow-up reply so a retried request can be replayed; otherwise
 *     kept until a TTL policy (if one is configured) expires them.
 *   - /rateLimits/{uid}/minutes/* and /rateLimits/{uid} — per-minute
 *     request counters, i.e. a record of when this user was active.
 *   - /wallets/{uid}/ledger/* and /wallets/{uid} — the coin balance and its
 *     history (owner decision 2026-10-20). No real-money purchase writes a
 *     ledger entry yet; revisit before paid coin packs launch, since a
 *     ledger of payments may then have to be kept and disclosed.
 *
 * The deletion race: a request already in flight (or one carrying a still-
 * valid ID token after the Auth user is gone) could otherwise write data
 * after the sweep. So the first thing this does is write the deleted-
 * account marker, which every user-data write checks in its own
 * transaction — see utils/accountState.ts. The marker itself (uid +
 * timestamps only) expires by TTL.
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
import { FieldValue, type Query } from 'firebase-admin/firestore';
import { db, auth } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { enforceRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { FUNCTION_OPTS } from '../config';
import { markAccountDeleted } from '../utils/accountState';

// Firestore batches cap at 500 ops; stay comfortably under that per page so a
// single query+batch round-trip never risks hitting the ceiling from a
// concurrent write landing between the query and the commit.
const DELETE_PAGE_SIZE = 400;

/**
 * Delete every document a query matches, one page per batch, re-querying
 * after each page so deleted documents are never fetched twice. Safe to
 * re-run after a partial failure: it just finds what is left.
 */
async function deleteInPages(query: () => Query): Promise<number> {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query().limit(DELETE_PAGE_SIZE).get();
    if (snap.empty) {
      break;
    }
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < DELETE_PAGE_SIZE) {
      break;
    }
  }
  return deleted;
}

/**
 * Everything keyed to this user that deleteAccount removes, before the
 * Auth user itself. Exported for direct testing.
 */
export async function deleteUserData(userId: string): Promise<{
  readings: number;
  replayCopies: number;
  walletEntries: number;
  rateLimitCounters: number;
}> {
  const readings = await deleteInPages(() =>
    db.collection('readings').where('userId', '==', userId),
  );
  const replayCopies = await deleteInPages(() =>
    db.collection('idempotencyKeys').where('userId', '==', userId),
  );
  const walletEntries = await deleteInPages(() =>
    db.collection('wallets').doc(userId).collection('ledger'),
  );
  // Rate-limit counters live in a subcollection, which deleting the parent
  // document would leave behind — so the children go first, explicitly.
  // This call's own counter (enforceRateLimit runs before it) goes too.
  const rateLimitCounters = await deleteInPages(() =>
    db.collection('rateLimits').doc(userId).collection('minutes'),
  );

  // Profile (with plan status), quota, trial, rate-limit parent — small,
  // fixed set, one batch. Deleting a document that does not exist is a no-op.
  const cleanupBatch = db.batch();
  cleanupBatch.delete(db.collection('users').doc(userId));
  cleanupBatch.delete(db.collection('quotas').doc(userId));
  cleanupBatch.delete(db.collection('trials').doc(userId));
  cleanupBatch.delete(db.collection('rateLimits').doc(userId));
  cleanupBatch.delete(db.collection('wallets').doc(userId));
  await cleanupBatch.commit();

  return { readings, replayCopies, walletEntries, rateLimitCounters };
}

export const deleteAccount = onCall(
  {
    ...FUNCTION_OPTS,
    timeoutSeconds: 120, // generous headroom for the readings-deletion loop
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async request => {
    const { userId } = verifyAuth(request);
    // A retry of an interrupted deletion must get past the marker it wrote.
    await enforceRateLimit(userId, { allowDeletedAccount: true });

    try {
      // First, before anything is deleted: from here on no write can add
      // data for this user (utils/accountState.ts).
      await markAccountDeleted(userId);
      const deleted = await deleteUserData(userId);
      const deletedReadings = deleted.readings;

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

      logger.info('account deleted', { userId, ...deleted });

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
