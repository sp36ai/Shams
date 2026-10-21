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
import {
  UNLIMITED_PLANS,
  FREE_LIMIT,
  TRIAL_DAILY_LIMIT,
  todayKey,
  FREE_QUESTION_INTERVAL_DAYS,
  EXTRA_QUESTION_COST_MILLI,
  PAID_DAILY_FAIR_USE,
  type PlanTier,
} from '../config';
import type { TrialDoc, QuotaDoc } from '../types';
import { monetizationModeFor, type MonetizationMode } from './monetization';
import { balanceOf, walletRef, writeBalance } from './wallet';
import { assertAccountActive, isAccountDeleted } from './accountState';

/**
 * What a claimed question was paid with, so refundQuotaSlot can give back
 * exactly that and nothing else.
 */
export type QuotaCharge =
  | { kind: 'none' } // legacy paid plan: nothing counted
  | { kind: 'daily' } // a daily counter slot (legacy free/trial, or coins-mode fair use)
  | { kind: 'free_weekly'; previousLastFreeAt: string | null } // coins mode, free question
  | { kind: 'coins'; amountMilli: number }; // coins mode, extra question paid from the wallet

const DAY_MS = 24 * 60 * 60 * 1000;

/** Coins mode, free plan: when the next free question becomes available (null = now). */
export function nextFreeAt(lastFreeAt: string | null | undefined, now = Date.now()): string | null {
  if (lastFreeAt === null || lastFreeAt === undefined) {
    return null;
  }
  const last = new Date(lastFreeAt).getTime();
  if (!Number.isFinite(last)) {
    return null;
  }
  const next = last + FREE_QUESTION_INTERVAL_DAYS * DAY_MS;
  return next <= now ? null : new Date(next).toISOString();
}

/**
 * Atomically check quota and pre-decrement.
 * Returns the plan and remaining count (null = unlimited).
 * Throws resource-exhausted if quota is zero.
 *
 * Trial logic: if /trials/{userId} exists and has not expired the daily
 * limit is TRIAL_DAILY_LIMIT (5) instead of FREE_LIMIT (3). This is
 * enforced server-side so reinstalling the app cannot reset the trial.
 */
export async function claimQuotaSlot(userId: string): Promise<{
  plan: PlanTier;
  remaining: number | null;
  trialActive: boolean;
  charge: QuotaCharge;
  mode: MonetizationMode;
}> {
  const mode = await monetizationModeFor(userId);
  if (mode === 'coins') {
    return { ...(await claimCoinsModeSlot(userId)), mode };
  }
  return { ...(await claimLegacySlot(userId)), mode };
}

/** The pre-coin rules: a daily counter for free/trial, nothing for paid plans. */
async function claimLegacySlot(userId: string): Promise<{
  plan: PlanTier;
  remaining: number | null;
  trialActive: boolean;
  charge: QuotaCharge;
}> {
  const quotaRef = db.collection('quotas').doc(userId);
  const trialRef = db.collection('trials').doc(userId);

  let plan: PlanTier = 'free';
  let remaining: number | null = null;
  let trialActive = false;

  await db.runTransaction(async tx => {
    await assertAccountActive(tx, userId);
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

  const charge: QuotaCharge = remaining === null ? { kind: 'none' } : { kind: 'daily' };
  return { plan, remaining, trialActive, charge };
}

/** Is this stored plan active right now (paid and not past its expiry)? */
function activePaidPlan(d: Partial<QuotaDoc>, now: number): PlanTier | null {
  const plan = d.plan ?? 'free';
  if (plan === 'free') {
    return null;
  }
  if (d.planExpiry && now > new Date(d.planExpiry).getTime()) {
    return null;
  }
  return plan;
}

/**
 * The coin economy (see utils/monetization.ts): paid plans get a fair-use
 * daily cap; free seekers get one question per FREE_QUESTION_INTERVAL_DAYS,
 * then pay EXTRA_QUESTION_COST_MILLI from the wallet per extra question.
 * Quota, free-question clock and wallet are read and written in ONE
 * transaction, so two questions sent at once cannot both take the last free
 * question or the same coins.
 */
async function claimCoinsModeSlot(userId: string): Promise<{
  plan: PlanTier;
  remaining: number | null;
  trialActive: boolean;
  charge: QuotaCharge;
}> {
  const quotaRef = db.collection('quotas').doc(userId);
  const wRef = walletRef(userId);

  return db.runTransaction(async tx => {
    await assertAccountActive(tx, userId);
    const [quotaSnap, walletSnap] = await Promise.all([tx.get(quotaRef), tx.get(wRef)]);
    const d = quotaSnap.exists ? (quotaSnap.data() as Partial<QuotaDoc>) : {};
    const now = Date.now();

    const paid = activePaidPlan(d, now);
    if (paid === null && (d.plan ?? 'free') !== 'free') {
      // Expired paid plan: downgrade in the same transaction, as legacy does.
      tx.set(quotaRef, { plan: 'free', planExpiry: null }, { merge: true });
    }

    if (paid !== null) {
      const currentDay = todayKey(now);
      const used = (d.dayKey ?? '') === currentDay ? (d.used ?? 0) : 0;
      if (used >= PAID_DAILY_FAIR_USE) {
        throw new HttpsError(
          'resource-exhausted',
          `Today's fair-use limit of ${PAID_DAILY_FAIR_USE} questions is reached. It resets at midnight UTC.`,
          { reason: 'fair_use', limit: PAID_DAILY_FAIR_USE },
        );
      }
      tx.set(
        quotaRef,
        { dayKey: currentDay, used: used + 1, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return {
        plan: paid,
        remaining: PAID_DAILY_FAIR_USE - used - 1,
        trialActive: false,
        charge: { kind: 'daily' } as QuotaCharge,
      };
    }

    const previousLastFreeAt = d.lastFreeAt ?? null;
    if (nextFreeAt(previousLastFreeAt, now) === null) {
      tx.set(
        quotaRef,
        { lastFreeAt: new Date(now).toISOString(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return {
        plan: 'free' as PlanTier,
        remaining: 0,
        trialActive: false,
        charge: { kind: 'free_weekly', previousLastFreeAt } as QuotaCharge,
      };
    }

    const balance = walletSnap.exists ? balanceOf(walletSnap.data()) : 0;
    if (balance < EXTRA_QUESTION_COST_MILLI) {
      throw new HttpsError(
        'resource-exhausted',
        'Your free question for this week is used. Add coins or upgrade to ask again.',
        {
          reason: 'free_used',
          nextFreeAt: nextFreeAt(previousLastFreeAt, now),
          questionCostMilli: EXTRA_QUESTION_COST_MILLI,
          balanceMilli: balance,
        },
      );
    }
    writeBalance(tx, userId, balance - EXTRA_QUESTION_COST_MILLI, {
      type: 'spend_question',
      amountMilli: -EXTRA_QUESTION_COST_MILLI,
    });
    return {
      plan: 'free' as PlanTier,
      remaining: 0,
      trialActive: false,
      charge: { kind: 'coins', amountMilli: EXTRA_QUESTION_COST_MILLI } as QuotaCharge,
    };
  });
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
export async function refundQuotaSlot(
  userId: string,
  charge: QuotaCharge = { kind: 'daily' },
): Promise<void> {
  if (charge.kind === 'none') {
    return;
  }
  if (charge.kind === 'free_weekly') {
    // Give the free question back: restore the clock to where it was.
    // A refund on a deleted account is simply dropped — it must neither
    // recreate the quota record nor throw over the error being refunded.
    const quotaRef = db.collection('quotas').doc(userId);
    await db.runTransaction(async tx => {
      if (await isAccountDeleted(tx, userId)) {
        return;
      }
      tx.set(
        quotaRef,
        { lastFreeAt: charge.previousLastFreeAt, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });
    return;
  }
  if (charge.kind === 'coins') {
    const wRef = walletRef(userId);
    await db.runTransaction(async tx => {
      if (await isAccountDeleted(tx, userId)) {
        return;
      }
      const snap = await tx.get(wRef);
      const balance = snap.exists ? balanceOf(snap.data()) : 0;
      writeBalance(tx, userId, balance + charge.amountMilli, {
        type: 'refund',
        amountMilli: charge.amountMilli,
        note: 'question not completed',
      });
    });
    return;
  }
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
