/**
 * rateLimit.ts — per-user sliding-minute rate limiter backed by Firestore.
 *
 * Limit: RATE_LIMIT_PER_MINUTE param (default 10) per user per UTC minute.
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
import { RATE_LIMIT_PER_MINUTE } from '../config';

const DEFAULT_MAX_PER_MINUTE = 10;

function maxPerMinute(): number {
  const configured = RATE_LIMIT_PER_MINUTE.value();
  if (!Number.isFinite(configured) || configured < 1) {
    return DEFAULT_MAX_PER_MINUTE;
  }
  return Math.floor(configured);
}

function minuteKey(): string {
  // "2025-01-15T14:30" — changes every 60 s
  return new Date().toISOString().slice(0, 16);
}

export async function enforceRateLimit(userId: string): Promise<void> {
  const key = minuteKey();
  const ref = db.collection('rateLimits').doc(userId).collection('minutes').doc(key);
  const limit = maxPerMinute();

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;

    if (count >= limit) {
      throw new HttpsError(
        'resource-exhausted',
        'Too many requests. Please wait a moment before trying again.',
      );
    }

    // Increment inside the same transaction for strict guard + write atomicity.
    tx.set(
      ref,
      {
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 120_000), // TTL for Firestore cleanup
      },
      { merge: true },
    );
  });
}
