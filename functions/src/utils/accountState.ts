/**
 * accountState — the deleted-account marker that closes the deletion race.
 * --------------------------------------------------------------------------
 * deleteAccount writes /deletedAccounts/{uid} BEFORE it deletes anything.
 * Every write that can create user data reads that marker inside the same
 * Firestore transaction and refuses if it exists. Transactions are
 * serializable, so for any such write there are only two outcomes:
 *
 *   - it commits before the marker → deleteAccount's sweep, which runs after
 *     the marker, deletes what it wrote;
 *   - it commits after the marker  → it read the marker and aborted.
 *
 * Without this, a reading request already in flight when the seeker deleted
 * their account could finish and write a reading that nothing would ever
 * delete — and a still-valid ID token (Firebase tokens outlive the Auth
 * user by up to an hour) could create new data after deletion completed.
 *
 * The marker holds only the uid (as its id) and timestamps. It carries an
 * `expiresAt` for a TTL policy: by then no token for the uid can still be
 * valid and no request that began before deletion can still be running.
 * Firebase never reuses a deleted uid, so the marker's expiry cannot
 * unblock a new account.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { db, FieldValue } from './admin';

const COLLECTION = 'deletedAccounts';

/** ID tokens last an hour and functions at most minutes; a day is ample margin. */
const MARKER_TTL_MS = 24 * 60 * 60 * 1000;

export function deletedAccountRef(userId: string): DocumentReference {
  return db.collection(COLLECTION).doc(userId);
}

export const ACCOUNT_DELETED_MESSAGE = 'This account has been deleted.';

function refuse(): never {
  throw new HttpsError('failed-precondition', ACCOUNT_DELETED_MESSAGE);
}

/** Read the marker inside a transaction. For paths that must not throw (refunds). */
export async function isAccountDeleted(tx: Transaction, userId: string): Promise<boolean> {
  const marker = await tx.get(deletedAccountRef(userId));
  return marker.exists;
}

/**
 * Refuse inside a transaction if the account is being or has been deleted.
 * Call before the transaction's writes (Firestore requires reads first).
 */
export async function assertAccountActive(tx: Transaction, userId: string): Promise<void> {
  if (await isAccountDeleted(tx, userId)) {
    refuse();
  }
}

/**
 * For a write that was not already in a transaction: run it in one that
 * checks the marker first, so it cannot land after deletion has begun.
 */
export async function writeIfAccountActive(
  userId: string,
  write: (tx: Transaction) => void,
): Promise<void> {
  await db.runTransaction(async tx => {
    await assertAccountActive(tx, userId);
    write(tx);
  });
}

/** Written first by deleteAccount; refreshed on every retry. */
export async function markAccountDeleted(userId: string): Promise<void> {
  await deletedAccountRef(userId).set({
    deletedAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + MARKER_TTL_MS),
  });
}
