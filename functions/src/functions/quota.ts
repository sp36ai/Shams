/**
 * getQuota — returns the caller's current quota status.
 * Used by the client to sync server-side quota with the local quotaStore.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { FUNCTION_OPTS, UNLIMITED_PLANS, FREE_LIMIT, sundayWeekKey } from '../config';
import type { QuotaResponse, QuotaDoc } from '../types';

export const getQuota = onCall(
  { ...FUNCTION_OPTS, enforceAppCheck: process.env.NODE_ENV !== 'development' },
  async (request): Promise<QuotaResponse> => {
    const { userId } = verifyAuth(request);

    try {
      const snap = await db.collection('quotas').doc(userId).get();

      if (!snap.exists) {
        return {
          plan: 'free',
          used: 0,
          limit: FREE_LIMIT,
          remaining: FREE_LIMIT,
          weekKey: sundayWeekKey(),
          planExpiry: null,
        };
      }

      const d = snap.data() as Partial<QuotaDoc>;
      const plan = d.plan ?? 'free';
      const currentWeek = sundayWeekKey();
      const storedWeek = d.weekKey ?? '';
      const used = storedWeek === currentWeek ? (d.used ?? 0) : 0;
      const planExpiry = d.planExpiry ?? null;

      // Check if plan has expired
      const effectivePlan =
        plan !== 'free' && planExpiry && Date.now() > new Date(planExpiry).getTime()
          ? 'free'
          : plan;

      const unlimited = UNLIMITED_PLANS.includes(effectivePlan);
      const limit = unlimited ? null : FREE_LIMIT;
      const remaining = unlimited ? null : Math.max(0, FREE_LIMIT - used);

      return { plan: effectivePlan, used, limit, remaining, weekKey: currentWeek, planExpiry };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', 'Failed to retrieve quota');
    }
  },
);
