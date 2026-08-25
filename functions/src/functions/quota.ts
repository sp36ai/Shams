/**
 * getQuota — returns the caller's current quota status.
 * Used by the client to sync server-side quota with the local quotaStore.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { FUNCTION_OPTS, UNLIMITED_PLANS, FREE_LIMIT, TRIAL_DAILY_LIMIT, todayKey } from '../config';
import { measure } from '../middleware/telemetry';
import type { QuotaResponse, QuotaDoc, TrialDoc } from '../types';

export const getQuota = onCall(
  { ...FUNCTION_OPTS, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async (request): Promise<QuotaResponse> => {
    const { userId } = verifyAuth(request);

    return measure<QuotaResponse>('getQuota', userId, async () => {
      const [snap, trialSnap] = await Promise.all([
        db.collection('quotas').doc(userId).get(),
        db.collection('trials').doc(userId).get(),
      ]);

      // Trial takes precedence over the free limit — must mirror
      // utils/quotaSlots.ts's claimQuotaSlot() exactly. This used to always report FREE_LIMIT (3)
      // here regardless of an active trial, so a trial user (limit 5) who had
      // already asked their 4th question saw the client compute
      // `serverRemaining = max(0, 3 - 4) = 0` and lock the Ask button, even
      // though the server would have happily granted questions 4 and 5.
      const currentDay = todayKey();
      let dailyLimit = FREE_LIMIT;
      if (trialSnap.exists) {
        const trial = trialSnap.data() as TrialDoc;
        if (Date.now() < new Date(trial.expiresAt).getTime()) {
          dailyLimit = TRIAL_DAILY_LIMIT;
        }
      }

      if (!snap.exists) {
        return {
          plan: 'free',
          used: 0,
          limit: dailyLimit,
          remaining: dailyLimit,
          dayKey: currentDay,
          planExpiry: null,
        };
      }

      const d = snap.data() as Partial<QuotaDoc>;
      const plan = d.plan ?? 'free';
      const storedDay = d.dayKey ?? '';
      const used = storedDay === currentDay ? (d.used ?? 0) : 0;
      const planExpiry = d.planExpiry ?? null;

      // Check if plan has expired
      const expired =
        plan !== 'free' && planExpiry !== null && Date.now() > new Date(planExpiry).getTime();
      const effectivePlan = expired ? 'free' : plan;

      if (expired) {
        // Self-heal the stale doc, matching askOracle's claimQuotaSlot — otherwise
        // this correction only ever lives in this response, never persisted, and
        // every getQuota call before the next askOracle call keeps re-deriving it
        // from scratch instead of the doc reflecting reality. Best-effort: the
        // response above is already correct regardless of whether this succeeds.
        db.collection('quotas')
          .doc(userId)
          .set({ plan: 'free', planExpiry: null }, { merge: true })
          .catch(() => undefined);
      }

      const unlimited = UNLIMITED_PLANS.includes(effectivePlan);
      const limit = unlimited ? null : dailyLimit;
      const remaining = unlimited ? null : Math.max(0, dailyLimit - used);

      return { plan: effectivePlan, used, limit, remaining, dayKey: currentDay, planExpiry };
    }).catch(err => {
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', 'Failed to retrieve quota');
    });
  },
);
