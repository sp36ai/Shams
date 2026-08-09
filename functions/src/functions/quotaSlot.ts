/**
 * quotaSlot — atomic daily-quota claim, shared by every oracle callable.
 *
 * Extracted from the original askOracle.ts so both askOracle's successor
 * (askWatchOracle) and any future oracle entry point claim quota through the
 * exact same ledger — one seeker, one daily count, regardless of which
 * engine answered.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { db } from '../utils/admin';
import { UNLIMITED_PLANS, FREE_LIMIT, TRIAL_DAILY_LIMIT, todayKey, type PlanTier } from '../config';
import type { TrialDoc, QuotaDoc } from '../types';

/**
 * Atomically check quota and pre-decrement.
 * Returns the plan and remaining count (null = unlimited).
 * Throws resource-exhausted if quota is zero.
 *
 * Trial logic: if /trials/{userId} exists and has not expired the daily
 * limit is TRIAL_DAILY_LIMIT (5) instead of FREE_LIMIT (3). This is
 * enforced server-side so reinstalling the app cannot reset the trial.
 */
export async function claimQuotaSlot(
  userId: string,
): Promise<{ plan: PlanTier; remaining: number | null; trialActive: boolean }> {
  const quotaRef = db.collection('quotas').doc(userId);
  const trialRef = db.collection('trials').doc(userId);

  let plan: PlanTier = 'free';
  let remaining: number | null = null;
  let trialActive = false;

  await db.runTransaction(async tx => {
    const [quotaSnap, trialSnap] = await Promise.all([tx.get(quotaRef), tx.get(trialRef)]);
    const d = quotaSnap.exists ? (quotaSnap.data() as Partial<QuotaDoc>) : {};

    plan = d.plan ?? 'free';

    // Check plan expiry
    if (plan !== 'free' && d.planExpiry) {
      const expiry = new Date(d.planExpiry).getTime();
      if (Date.now() > expiry) {
        plan = 'free';
        tx.set(quotaRef, { plan: 'free', planExpiry: null }, { merge: true });
      }
    }

    if (UNLIMITED_PLANS.includes(plan)) {
      remaining = null;
      return; // No quota to decrement for paid plans
    }

    // Determine effective daily limit — trial takes precedence over free limit
    let dailyLimit = FREE_LIMIT;
    if (trialSnap.exists) {
      const trial = trialSnap.data() as TrialDoc;
      const trialExpiry = new Date(trial.expiresAt).getTime();
      if (Date.now() < trialExpiry) {
        trialActive = true;
        dailyLimit = TRIAL_DAILY_LIMIT;
      }
    }

    const currentDay = todayKey();
    const storedDay = d.dayKey ?? '';
    const used = storedDay === currentDay ? (d.used ?? 0) : 0;

    if (used >= dailyLimit) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily quota exhausted (${used}/${dailyLimit}). Upgrade to continue.`,
      );
    }

    remaining = dailyLimit - used - 1;
    tx.set(
      quotaRef,
      { dayKey: currentDay, used: used + 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });

  return { plan, remaining, trialActive };
}
