/**
 * Quota Management Utilities
 * 
 * Tracks and enforces daily question limits per subscription tier.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export interface UserQuota {
  uid: string;
  plan: 'free' | 'mureed' | 'khass';
  daily_limit: number;
  used_today: number;
  remaining: number;
  reset_at: number; // Unix timestamp
}

/**
 * Get current quota status for user.
 */
export async function getQuotaForUser(uid: string): Promise<UserQuota> {
  const db = getFirestore();
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User document not found');
  }

  const data = userDoc.data();
  const plan = data?.subscription?.plan || 'free';

  // Daily limits by tier
  const limits: Record<string, number> = {
    free: 5,
    mureed: 3, // 3 per day
    khass: Infinity, // Unlimited
  };

  const dailyLimit = limits[plan] || 5;
  const usedToday = data?.quota?.used_today || 0;
  const resetAt = data?.quota?.reset_at || Date.now() + 24 * 60 * 60 * 1000;

  // Reset if past 24h window
  const now = Date.now();
  const actualUsed = now < resetAt ? usedToday : 0;

  return {
    uid,
    plan: plan as 'free' | 'mureed' | 'khass',
    daily_limit: dailyLimit,
    used_today: actualUsed,
    remaining: Math.max(0, dailyLimit - actualUsed),
    reset_at: resetAt,
  };
}

/**
 * Deduct N questions from user's quota.
 */
export async function deductQuota(uid: string, count: number = 1): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  // Use transaction to prevent race conditions
  await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const quota = await getQuotaForUser(uid);
    const newUsed = quota.used_today + count;

    tx.update(userRef, {
      'quota.used_today': newUsed,
    });
  });
}

/**
 * Reset user quota (called daily by scheduled function or manually).
 */
export async function resetUserQuota(uid: string): Promise<void> {
  const db = getFirestore();
  await db.collection('users').doc(uid).update({
    'quota.used_today': 0,
    'quota.reset_at': Date.now() + 24 * 60 * 60 * 1000,
  });
}
