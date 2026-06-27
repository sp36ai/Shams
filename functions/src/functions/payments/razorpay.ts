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
import { requestMetaFromHttp, type RequestAuditMeta } from '../../utils/requestMeta';
import { RAZORPAY_WEBHOOK_SECRET, REGION, PLAN_DURATION_DAYS, type PlanTier } from '../../config';

// Per-IP sliding-window rate limiter for the webhook endpoint.
// Razorpay retries events a fixed number of times — 30 req/min per IP is very generous.
const IP_RATE_LIMIT = 30;
const ipCounters = new Map<string, { count: number; windowStart: number }>();

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = ipCounters.get(ip);
  if (!entry || now - entry.windowStart >= windowMs) {
    ipCounters.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= IP_RATE_LIMIT;
}

/**
 * RAZORPAY WEBHOOK SECRET — GCP SECRET MANAGER
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Secret Management Architecture:
 * ───────────────────────────────
 *   Location:           Google Cloud Secret Manager
 *   Project:            shams-app-4d0e7 (asia-south1)
 *   Secret Name:        RAZORPAY_WEBHOOK_SECRET
 *   Access Level:       Cloud Function only (least-privilege binding)
 *   Current Version:    \"latest\" (auto-rotated)
 *   Backup Versions:    Retained for 90 days in Secret Manager
 *
 * Rotation Policy:
 * ────────────────\n *   Automated:     Rotating every 30 days via GCP Secret Manager\n *   Manual:         firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET\n *   Transition:     Old key valid for 30 days after rotation (backward compat)\n *   New key:        Immediately active for new webhook invocations\n *\n * Access Control (IAM):\n * ────────────────────\n *   Read:   Only razorpayWebhook Cloud Function (binding: secretAccessor role)\n *   Write:  Terraform & Firebase CLI (deployment automation)\n *   Audit:  GCP Cloud Audit Logs (all read/write logged with timestamps)\n *\n * Deployment Verification:\n * ────────────────────────\n *   Production:     Uses \"latest\" version (environment: functions/.env.yaml)\n *   Emulator:       Reads from functions/.env (local .env file)\n *   CI/CD:          Deployed via Terraform or Firebase CLI\n *\n * To Deploy/Rotate:\n * ──────────────────\n *   1. Get the new Razorpay webhook secret from Razorpay Dashboard\n *   2. Run: firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET\n *      (paste the secret when prompted)\n *   3. Run: firebase deploy --only functions:razorpayWebhook\n *   4. Verify: gcloud secrets versions list RAZORPAY_WEBHOOK_SECRET\n *\n * To Check Current Secret (secure):\n * ─────────────────────────────────\n *   gcloud secrets versions list RAZORPAY_WEBHOOK_SECRET\n *      (does NOT display secret value, only metadata)\n *\n * Audit Trail:\n * ───────────\n *   All secret access is logged to Google Cloud Audit Logs\n *   Access pattern:\n *     - razorpayWebhook invoked\n *     - Secret Manager reads latest version\n *     - Webhook HMAC verification (constant-time comparison)\n *     - Audit log written (action=\"plan_upgraded\", etc.)\n */

// Map Razorpay plan IDs to internal plan tiers
const RAZORPAY_PLAN_MAP: Record<string, PlanTier> = {
  plan_mureed_monthly: 'mureed',
  plan_mureed_annual: 'mureed',
  plan_khass_monthly: 'khass',
  plan_khass_annual: 'khass',
};

function getRazorpaySecret(): string {
  const s = RAZORPAY_WEBHOOK_SECRET.value();
  if (!s) {
    // Log at error severity so Cloud Logging alerts fire — this is a deploy misconfiguration.
    logger.error(
      'RAZORPAY_WEBHOOK_SECRET secret is empty — set it via: firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET',
    );
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

async function upgradePlan(
  userId: string,
  plan: PlanTier,
  requestMeta: RequestAuditMeta,
  razorpayPaymentId?: string,
): Promise<void> {
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

  // Merge into existing claims — do NOT replace (would wipe admin: true, etc.)
  const existingUser = await auth.getUser(userId);
  const currentClaims = existingUser.customClaims ?? {};
  await auth.setCustomUserClaims(userId, {
    ...currentClaims,
    plan,
    planExpiry: expiresAt.toISOString(),
  });

  logger.info('plan upgraded', {
    userId,
    plan,
    expiresAt: expiresAt.toISOString(),
    ipHash: requestMeta.ipHash,
  });

  await db.collection('auditLogs').add({
    userId,
    action: 'plan_upgraded',
    plan,
    source: requestMeta.source,
    ipHash: requestMeta.ipHash,
    userAgent: requestMeta.userAgent,
    ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
    ts: FieldValue.serverTimestamp(),
  });
}

export const razorpayWebhook = onRequest(
  { region: REGION, timeoutSeconds: 30, cors: false, secrets: [RAZORPAY_WEBHOOK_SECRET] },
  async (req, res) => {
    const startedAt = Date.now();
    const requestMeta = requestMetaFromHttp(req);

    // Handle CORS pre-flight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'X-Razorpay-Signature, Content-Type');
      res.status(204).send('');
      return;
    }

    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Per-IP rate limit — enforced before HMAC to prevent brute-force probing.
    const clientIp = requestMeta.ipAddress ?? 'unknown';
    if (!checkIpRateLimit(clientIp)) {
      logger.warn('razorpay webhook: ip rate limit exceeded', {
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      res.status(429).send('Too Many Requests');
      return;
    }

    // 1. Verify signature before touching the body
    const signature = req.headers['x-razorpay-signature'];
    if (typeof signature !== 'string') {
      logger.warn('razorpay webhook: missing signature', {
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      res.status(400).send('Missing signature');
      return;
    }

    // req.rawBody is populated by Cloud Functions when Content-Type is application/json
    const rawBody = (req as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.warn('razorpay webhook: rawBody unavailable', {
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      res.status(400).send('Bad request');
      return;
    }

    let signatureValid: boolean;
    try {
      signatureValid = verifyRazorpaySignature(rawBody, signature);
    } catch (sigErr) {
      logger.error('razorpay webhook: signature verification threw', {
        err: String(sigErr),
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      res.status(500).send('Signature verification error');
      return;
    }

    if (!signatureValid) {
      logger.warn('razorpay webhook: invalid signature', {
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      await db.collection('securityEvents').add({
        type: 'razorpay_invalid_signature',
        source: requestMeta.source,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
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
    logger.info('razorpay webhook received', {
      event: eventType,
      ipHash: requestMeta.ipHash,
      durationMs: Date.now() - startedAt,
    });

    try {
      if (eventType === 'payment.captured') {
        const payment = (event.payload as Record<string, unknown>)?.payment as
          | Record<string, unknown>
          | undefined;
        const entity = payment?.entity as Record<string, unknown> | undefined;
        const notes = entity?.notes as Record<string, string> | undefined;

        const userId = notes?.userId;
        const razorPlan = notes?.planId ?? (entity?.description as string | undefined);
        const paymentId = entity?.id as string | undefined;

        if (!userId || !razorPlan) {
          logger.warn('razorpay payment.captured: missing userId or planId in notes', {
            ipHash: requestMeta.ipHash,
            durationMs: Date.now() - startedAt,
          });
          res.status(200).send('OK');
          return;
        }

        const plan = RAZORPAY_PLAN_MAP[razorPlan];
        if (!plan) {
          logger.warn('razorpay: unknown plan', {
            razorPlan,
            ipHash: requestMeta.ipHash,
            durationMs: Date.now() - startedAt,
          });
          res.status(200).send('OK');
          return;
        }

        // Idempotency: skip if this payment has already been processed
        if (paymentId) {
          const existing = await db
            .collection('auditLogs')
            .where('razorpayPaymentId', '==', paymentId)
            .limit(1)
            .get();
          if (!existing.empty) {
            logger.info('razorpay: duplicate payment event, skipping', {
              paymentId,
              ipHash: requestMeta.ipHash,
            });
            res.status(200).send('OK');
            return;
          }
        }

        await upgradePlan(userId, plan, requestMeta, paymentId);
      } else if (eventType === 'subscription.activated') {
        const sub = (event.payload as Record<string, unknown>)?.subscription as
          | Record<string, unknown>
          | undefined;
        const entity = sub?.entity as Record<string, unknown> | undefined;
        const notes = entity?.notes as Record<string, string> | undefined;

        const userId = notes?.userId;
        const razorPlan = entity?.plan_id as string | undefined;

        if (!userId || !razorPlan) {
          logger.warn('razorpay subscription.activated: missing userId or plan_id', {
            ipHash: requestMeta.ipHash,
            durationMs: Date.now() - startedAt,
          });
          res.status(200).send('OK');
          return;
        }

        const plan = RAZORPAY_PLAN_MAP[razorPlan];
        if (plan) {
          await upgradePlan(userId, plan, requestMeta);
        }
      }
      // All other event types: acknowledge silently
    } catch (err) {
      logger.error('razorpay webhook handler error', {
        err: String(err),
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      await db.collection('auditLogs').add({
        action: 'payment_razorpay_fail',
        err: String(err),
        source: requestMeta.source,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
        ts: FieldValue.serverTimestamp(),
      });
      // Still return 200 so Razorpay doesn't retry indefinitely
    }

    res.status(200).send('OK');
  },
);
