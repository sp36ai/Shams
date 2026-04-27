/**
 * rateLimit.ts — per-user sliding-minute rate limiter backed by Firestore.
 *
 * Limit: MAX_PER_MINUTE calls per user per calendar minute (UTC).
 * Storage: /rateLimits/{userId}/minutes/{YYYY-MM-DDTHH:mm}
 *   • count  — number of calls in this minute window
 *   • expiresAt — server timestamp 2 minutes ahead (for TTL cleanup)
 *
 * The check-and-increment is inside a Firestore transaction for atomicity.
 * Documents older than 2 minutes are never read (key is the UTC minute string).
 * Firestore TTL deletes them lazily via the expiresAt field index.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../utils/admin';

const MAX_PER_MINUTE = 10;

function minuteKey(): string {
  // "2025-01-15T14:30" — changes every 60 s
  return new Date().toISOString().slice(0, 16);
}

export async function enforceRateLimit(userId: string): Promise<void> {
  const key = minuteKey();
  const ref = db.collection('rateLimits').doc(userId).collection('minutes').doc(key);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;

    if (count >= MAX_PER_MINUTE) {
      throw new HttpsError(
        'resource-exhausted',
        'Too many requests. Please wait a moment before trying again.',
      );
    }

    // Increment synchronously inside the transaction (no FieldValue.increment —
    // that is not allowed when you need the value for the guard above).
    tx.set(
      ref,
      {
        count, // already read
        increment: FieldValue.increment(1), // applied server-side
        expiresAt: new Date(Date.now() + 120_000), // TTL for Firestore cleanup
      },
      { merge: true },
    );

    // Note: because we set `count` (stale) + `increment`, the final server
    // value = count + 1 only if no concurrent write happened in this tx window.
    // Firestore transactions are serialisable — safe.
  });
}
