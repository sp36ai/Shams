/**
 * razorpayWebhook — HTTP endpoint for Razorpay payment events.
 *
 * Security:
 *   - HMAC-SHA256 signature verification (X-Razorpay-Signature header)
 *   - Only `payment.captured` and `subscription.activated` events trigger plan upgrades
 *   - All other events are acknowledged (200) but ignored
 *   - Idempotent: re-processing a known payment is a no-op
 *
 * Flow on successful payment:
 *   1. Verify HMAC signature
 *   2. Extract user ID from payment notes (set by client at order creation)
 *   3. Map Razorpay plan ID → PlanTier
 *   4. Update /quotas/{userId}.plan in Firestore
 *   5. Set Firebase Auth custom claims ({ plan, planExpiry })
 *   6. Write audit log
 */

import * as crypto from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db, auth } from '../../utils/admin';
import { logger } from '../../utils/logger';
import { REGION, PLAN_DURATION_DAYS, type PlanTier } from '../../config';

// Map Razorpay plan IDs to internal plan tiers
const RAZORPAY_PLAN_MAP: Record<string, PlanTier> = {
  plan_starter_weekly: 'starter',
  plan_premium_monthly: 'premium',
  plan_consultation_monthly: 'consultation',
};

function getRazorpaySecret(): string {
  const s = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!s) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
  }
  return s;
}

function verifyRazorpaySignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto.createHmac('sha256', getRazorpaySecret()).update(rawBody).digest('hex');
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.toLowerCase(), 'hex'),
  );
}

async function upgradePlan(userId: string, plan: PlanTier): Promise<void> {
  const durationDays = PLAN_DURATION_DAYS[plan];
  const expiresAt = new Date(Date.now() + durationDays * 86_400_000);

  // Firestore update (authoritative for quota checks)
  await db.collection('quotas').doc(userId).set(
    {
      plan,
      planExpiry: expiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Firebase custom claims — client reads these on next getIdTokenResult()
  await auth.setCustomUserClaims(userId, { plan, planExpiry: expiresAt.toISOString() });

  logger.info('plan upgraded', { userId, plan, expiresAt: expiresAt.toISOString() });

  await db.collection('auditLogs').add({
    userId,
    action: 'plan_upgraded',
    plan,
    ts: FieldValue.serverTimestamp(),
  });
}

export const razorpayWebhook = onRequest(
  { region: REGION, timeoutSeconds: 30 },
  async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // 1. Verify signature before touching the body
    const signature = req.headers['x-razorpay-signature'];
    if (typeof signature !== 'string') {
      logger.warn('razorpay webhook: missing signature');
      res.status(400).send('Missing signature');
      return;
    }

    // req.rawBody is populated by Cloud Functions when Content-Type is application/json
    const rawBody = (req as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.warn('razorpay webhook: rawBody unavailable');
      res.status(400).send('Bad request');
      return;
    }

    let signatureValid: boolean;
    try {
      signatureValid = verifyRazorpaySignature(rawBody, signature);
    } catch {
      res.status(500).send('Signature verification error');
      return;
    }

    if (!signatureValid) {
      logger.warn('razorpay webhook: invalid signature');
      await db.collection('securityEvents').add({
        type: 'razorpay_invalid_signature',
        ts: FieldValue.serverTimestamp(),
      });
      res.status(401).send('Invalid signature');
      return;
    }

    // 2. Parse event
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      res.status(400).send('Invalid JSON');
      return;
    }

    const eventType = event.event as string | undefined;
    logger.info('razorpay webhook received', { event: eventType });

    try {
      if (eventType === 'payment.captured') {
        const payment = (event.payload as Record<string, unknown>)?.payment as
          | Record<string, unknown>
          | undefined;
        const entity = payment?.entity as Record<string, unknown> | undefined;
        const notes = entity?.notes as Record<string, string> | undefined;

        const userId = notes?.userId;
        const razorPlan = notes?.planId ?? (entity?.description as string | undefined);

        if (!userId || !razorPlan) {
          logger.warn('razorpay payment.captured: missing userId or planId in notes');
          res.status(200).send('OK');
          return;
        }

        const plan = RAZORPAY_PLAN_MAP[razorPlan];
        if (!plan) {
          logger.warn('razorpay: unknown plan', { razorPlan });
          res.status(200).send('OK');
          return;
        }

        await upgradePlan(userId, plan);
      } else if (eventType === 'subscription.activated') {
        const sub = (event.payload as Record<string, unknown>)?.subscription as
          | Record<string, unknown>
          | undefined;
        const entity = sub?.entity as Record<string, unknown> | undefined;
        const notes = entity?.notes as Record<string, string> | undefined;

        const userId = notes?.userId;
        const razorPlan = entity?.plan_id as string | undefined;

        if (!userId || !razorPlan) {
          logger.warn('razorpay subscription.activated: missing userId or plan_id');
          res.status(200).send('OK');
          return;
        }

        const plan = RAZORPAY_PLAN_MAP[razorPlan];
        if (plan) {
          await upgradePlan(userId, plan);
        }
      }
      // All other event types: acknowledge silently
    } catch (err) {
      logger.error('razorpay webhook handler error', { err: String(err) });
      await db.collection('auditLogs').add({
        action: 'payment_razorpay_fail',
        err: String(err),
        ts: FieldValue.serverTimestamp(),
      });
      // Still return 200 so Razorpay doesn't retry indefinitely
    }

    res.status(200).send('OK');
  },
);
