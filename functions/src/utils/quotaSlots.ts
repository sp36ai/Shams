/**
 * quotaSlots.ts — atomic quota claim/refund, shared across oracle callables.
 *
 * Extracted from the now-retired askOracle.ts (see git history), which is
 * where this logic originated — but it was never askOracle-specific: it's
 * the same claim/refund pair askWatchOracle.ts depends on for every live
 * reading. Moved here so a shared concern lives in shared infrastructure
 * instead of inside one particular callable's file.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin';
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

/**
 * Give back a quota slot claimed by claimQuotaSlot() when the reading it was
 * claimed for never actually completed (chart build, judgment, or persistence
 * threw after the slot was already spent). Without this, a querent who hits a
 * transient failure loses one of their 3 (free) or 5 (trial) daily questions
 * for nothing — the exact failure mode QA hit when repeated questions all
 * returned the generic "scrolls have not opened their seal" error while the
 * quota badge kept counting down.
 *
 * No-ops safely if the day has rolled over since the claim (nothing to
 * refund against) or if there's nothing to give back (paid plans never
 * decrement `used` in the first place). Callers should treat a refund
 * failure as non-fatal — log and move on, never let it mask the original
 * error that triggered the refund.
 */
export async function refundQuotaSlot(userId: string): Promise<void> {
  const quotaRef = db.collection('quotas').doc(userId);
  const currentDay = todayKey();

  await db.runTransaction(async tx => {
    const snap = await tx.get(quotaRef);
    if (!snap.exists) {
      return;
    }
    const d = snap.data() as Partial<QuotaDoc>;
    if ((d.dayKey ?? '') !== currentDay) {
      return; // day rolled over since the claim — nothing to refund
    }
    const used = d.used ?? 0;
    if (used <= 0) {
      return;
    }
    tx.set(quotaRef, { used: used - 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}
