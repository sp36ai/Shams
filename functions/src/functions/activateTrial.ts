/**
 * activateTrial — idempotent server-side trial registration.
 *
 * Called by the client once when the user first accepts the free trial.
 * Writes /trials/{userId} to Firestore so the server can enforce the
 * 7-day / 5-question-per-day trial limit independently of MMKV state.
 *
 * Idempotent: if the document already exists the function returns the
 * existing record unchanged. A second call (e.g. after reinstall)
 * preserves the original trial start date — no trial reset.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../utils/admin';
import { verifyAuth } from '../middleware/auth';
import { FUNCTION_OPTS, TRIAL_DURATION_DAYS } from '../config';
import { measure } from '../middleware/telemetry';
import type { TrialDoc } from '../types';

export interface ActivateTrialResponse {
  startedAt: string;
  expiresAt: string;
  alreadyActive: boolean;
}

export const activateTrial = onCall(
  { ...FUNCTION_OPTS, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' },
  async (request): Promise<ActivateTrialResponse> => {
    const { userId } = verifyAuth(request);

    return measure<ActivateTrialResponse>('activateTrial', userId, async () => {
      const trialRef = db.collection('trials').doc(userId);

      return db.runTransaction(async tx => {
        const snap = await tx.get(trialRef);

        if (snap.exists) {
          const existing = snap.data() as TrialDoc;
          return {
            startedAt: existing.startedAt,
            expiresAt: existing.expiresAt,
            alreadyActive: true,
          };
        }

        const now = new Date();
        const startedAt = now.toISOString();
        const expiresAt = new Date(
          now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();

        const doc: TrialDoc & { createdAt: ReturnType<typeof FieldValue.serverTimestamp> } = {
          userId,
          startedAt,
          expiresAt,
          createdAt: FieldValue.serverTimestamp(),
        };

        tx.set(trialRef, doc);

        return { startedAt, expiresAt, alreadyActive: false };
      });
    }).catch(err => {
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', 'Failed to activate trial');
    });
  },
);
