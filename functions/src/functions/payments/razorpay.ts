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
 *   2. Resolve the entitlement binding from this system's own ledger
 *      (razorpayOrders/{orderId} or razorpaySubscriptions/{subscriptionId})
 *   3. Map the ledger's Razorpay plan ID → PlanTier
 *   4. Update /quotas/{userId}.plan in Firestore
 *   5. Set Firebase Auth custom claims ({ plan, planExpiry })
 *   6. Write audit log
 *
 * Trust model (issue #129; history in PHASE_6A_F1 §5 / PHASE_6A_R1 §B):
 *
 * The HMAC signature proves only that Razorpay's servers produced the
 * payload. It does NOT prove that the payload's `notes.userId` names the
 * account that paid: notes are set wherever the order was created, which
 * is outside anything this endpoint can verify. So this endpoint no longer
 * reads identity or plan from the payload at all.
 *
 * Entitlement is granted only for an order/subscription that THIS system
 * created and recorded in its ledger, keyed by Razorpay's own id:
 *   razorpayOrders/{order_id}               { uid, planId, ... }
 *   razorpaySubscriptions/{subscription_id} { uid, planId, ... }
 * The ledger's `uid` must be bound to `request.auth.uid` by the
 * server-side creation callable that writes it (Admin SDK only; clients
 * cannot read or write these collections — Firestore's catch-all deny).
 * That callable does not exist yet; until it does, the ledger is empty
 * and this endpoint grants nothing — it fails closed. Any event whose id
 * is missing, not in the ledger, or bound to a malformed ledger record is
 * acknowledged (200, so Razorpay does not retry forever), granted nothing,
 * and recorded as a `razorpay_unbound_entitlement` security event.
 *
 * Kept from Phase 6A-R1: a ledger uid with no Firebase Auth account still
 * produces zero entitlement mutation and its own
 * `razorpay_entitlement_target_unverifiable` security event.
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
const WINDOW_MS = 60_000;
const EVICT_EVERY = 500;
const ipCounters = new Map<string, { count: number; windowStart: number }>();
let _reqCount = 0;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();

  _reqCount++;
  if (_reqCount % EVICT_EVERY === 0) {
    for (const [k, e] of ipCounters) {
      if (now - e.windowStart >= WINDOW_MS) {
        ipCounters.delete(k);
      }
    }
  }

  const entry = ipCounters.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
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

/**
 * Atomically claims a Razorpay event for processing, keyed by event type +
 * the entity's own id (Razorpay guarantees payment/subscription ids are
 * unique — no assumption about a webhook-envelope-level id is needed).
 * Returns true if this call is the one that should process the event; false
 * if another delivery (a concurrent retry, or Razorpay's own redelivery)
 * already claimed it.
 *
 * Replaces two prior gaps:
 *   - payment.captured deduped by querying /auditLogs for a matching
 *     razorpayPaymentId, then writing the upgrade separately — read, then
 *     write, not atomic. Two concurrent deliveries could both observe "not
 *     yet processed" before either recorded it.
 *   - subscription.activated had no dedup at all.
 * Both now go through this single transactional claim.
 */
async function claimWebhookEvent(key: string): Promise<boolean> {
  const ref = db.collection('webhookEvents').doc(key);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return false;
    }
    tx.set(ref, { claimedAt: FieldValue.serverTimestamp(), source: 'razorpay' });
    return true;
  });
}

/**
 * Releases a claim taken by claimWebhookEvent() when processing failed after
 * the claim succeeded. Without this, a transient failure (a Firestore write
 * blip, a downed Auth API call) would permanently block any future retry —
 * including a manual "resend webhook" from the Razorpay dashboard, which is
 * a real support-recovery path — from ever processing that event.
 */
async function releaseWebhookEvent(key: string): Promise<void> {
  await db
    .collection('webhookEvents')
    .doc(key)
    .delete()
    .catch(() => undefined);
}

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

/**
 * PHASE 6A-R1: extract a genuinely well-formed, non-empty string from an
 * arbitrary parsed-JSON value — deliberately NOT trusting the
 * `Record<string, string>` casts on `notes`/`entity` above, since a cast
 * is a compile-time promise, not a runtime check. A malformed webhook
 * payload (a number, an object, an empty string, `null`) previously read
 * as merely "falsy or not" (`!userId`), which correctly rejected
 * `undefined`/`""`/`null` but let a non-string truthy value (e.g. a JSON
 * number or object at that key) flow into `auth.getUser()`/Firestore's
 * `.doc()` as an uncontrolled type error, caught only by the generic
 * outer catch rather than rejected deliberately and specifically.
 *
 * Exported for direct testing.
 */
export function extractNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * PHASE 6A-R1: is this webhook-processing failure specifically "the
 * entitlement target named in `notes.userId` does not exist as a
 * Firebase Auth account"? Firebase Admin Auth throws with this exact
 * code from `auth.getUser()` for an unknown uid — see `upgradePlan()`
 * below. Distinguished from every other failure (a transient Firestore
 * error, a network blip) because it is the strongest available signal,
 * within this integration's current trust model (see this file's
 * header), that the payload's `notes.userId` does not name a real,
 * verifiable entitlement target — worth its own securityEvents record
 * rather than the same generic `payment_razorpay_fail` bucket every
 * other failure already uses.
 *
 * Exported for direct testing.
 */
export function isUnverifiableEntitlementTarget(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'auth/user-not-found'
  );
}

/**
 * PHASE 6A-R1: record the distinct securityEvents entry for
 * `isUnverifiableEntitlementTarget()` — see this file's header for why
 * this is worth its own record rather than the generic
 * `payment_razorpay_fail` audit log every other failure already writes
 * to (that generic write still happens too, via the outer catch; this
 * is additive, not a replacement).
 */
async function recordUnverifiableEntitlementTarget(
  userId: string,
  requestMeta: RequestAuditMeta,
): Promise<void> {
  await db.collection('securityEvents').add({
    type: 'razorpay_entitlement_target_unverifiable',
    userId,
    source: requestMeta.source,
    ipHash: requestMeta.ipHash,
    userAgent: requestMeta.userAgent,
    ts: FieldValue.serverTimestamp(),
  });
}

/**
 * The entitlement binding this system recorded when it created a Razorpay
 * order or subscription — the only source of uid and plan the webhook
 * trusts (see this file's header).
 */
export type LedgerBinding =
  | { ok: true; uid: string; planId: string }
  | { ok: false; reason: 'missing_entity_id' | 'not_in_ledger' | 'malformed_ledger_record' };

export const RAZORPAY_ORDER_LEDGER = 'razorpayOrders';
export const RAZORPAY_SUBSCRIPTION_LEDGER = 'razorpaySubscriptions';

/**
 * Look up `entityId` in `ledger`. Never falls back to anything in the
 * webhook payload: an absent id, an unknown id, or a record without a
 * well-formed uid/planId all resolve to "not bound". A Firestore read
 * error propagates (a transient failure, handled by the caller's
 * generic catch) rather than being mistaken for "not bound".
 *
 * Exported for direct testing.
 */
export async function resolveLedgerBinding(
  ledger: string,
  entityId: string | undefined,
): Promise<LedgerBinding> {
  if (!entityId) {
    return { ok: false, reason: 'missing_entity_id' };
  }
  const snap = await db.collection(ledger).doc(entityId).get();
  if (!snap.exists) {
    return { ok: false, reason: 'not_in_ledger' };
  }
  const data = snap.data() as Record<string, unknown> | undefined;
  const uid = extractNonEmptyString(data?.uid);
  const planId = extractNonEmptyString(data?.planId);
  if (!uid || !planId) {
    return { ok: false, reason: 'malformed_ledger_record' };
  }
  return { ok: true, uid, planId };
}

async function recordUnboundEntitlement(
  eventType: string,
  reason: string,
  entityId: string | undefined,
  claimedUserId: string | undefined,
  requestMeta: RequestAuditMeta,
): Promise<void> {
  await db.collection('securityEvents').add({
    type: 'razorpay_unbound_entitlement',
    event: eventType,
    reason,
    ...(entityId ? { entityId } : {}),
    // The payload's own claim, kept for forensics only — never trusted.
    ...(claimedUserId ? { claimedUserId } : {}),
    source: requestMeta.source,
    ipHash: requestMeta.ipHash,
    userAgent: requestMeta.userAgent,
    ts: FieldValue.serverTimestamp(),
  });
}

async function upgradePlan(
  userId: string,
  plan: PlanTier,
  requestMeta: RequestAuditMeta,
  razorpayPaymentId?: string,
): Promise<void> {
  const durationDays = PLAN_DURATION_DAYS[plan];
  const expiresAt = new Date(Date.now() + durationDays * 86_400_000);

  // PHASE 6A-R1 (continuation — the §C hard-stop): verify the target
  // identity FIRST. Previously the Firestore quota write below ran
  // before this call, so a well-formed but nonexistent uid still left
  // an orphaned /quotas/{userId} entitlement document even though
  // auth.getUser() was about to reject it — the exact "entitlement
  // persisted before the identity receiving it was verified" defect
  // docs/audit/PHASE_6A_R1_OWNERSHIP_ENTITLEMENT_HARDENING.md §C
  // reported. auth.getUser() throwing (caught by this function's own
  // caller — isUnverifiableEntitlementTarget() there recognizes exactly
  // this) now happens before ANY mutation, Firestore or Auth, so a
  // nonexistent uid produces zero entitlement mutation of any kind.
  const existingUser = await auth.getUser(userId);
  const currentClaims = existingUser.customClaims ?? {};

  // Firestore update (authoritative for quota checks) — only after the
  // identity above is confirmed real.
  await db.collection('quotas').doc(userId).set(
    {
      plan,
      planExpiry: expiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Merge into existing claims — do NOT replace (would wipe admin: true, etc.)
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
    // Skip rate limiting when IP is unresolvable to avoid collapsing all such
    // requests into one shared bucket that would block legitimate retries.
    const clientIp = requestMeta.ipAddress;
    if (clientIp !== undefined && !checkIpRateLimit(clientIp)) {
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

        const paymentId = extractNonEmptyString(entity?.id);
        const orderId = extractNonEmptyString(entity?.order_id);

        const binding = await resolveLedgerBinding(RAZORPAY_ORDER_LEDGER, orderId);
        if (!binding.ok) {
          logger.warn('razorpay payment.captured: no ledger binding, granting nothing', {
            reason: binding.reason,
            orderId,
            ipHash: requestMeta.ipHash,
            durationMs: Date.now() - startedAt,
          });
          await recordUnboundEntitlement(
            'payment.captured',
            binding.reason,
            orderId,
            extractNonEmptyString(notes?.userId),
            requestMeta,
          );
          res.status(200).send('OK');
          return;
        }
        const userId = binding.uid;

        const plan = RAZORPAY_PLAN_MAP[binding.planId];
        if (!plan) {
          logger.warn('razorpay: unknown plan', {
            razorPlan: binding.planId,
            ipHash: requestMeta.ipHash,
            durationMs: Date.now() - startedAt,
          });
          res.status(200).send('OK');
          return;
        }

        // Idempotency: atomically claim this payment id before processing it.
        // A missing paymentId can't be deduped meaningfully — process it
        // (rare; Razorpay always includes entity.id for a real payment).
        if (paymentId) {
          const claimed = await claimWebhookEvent(`payment.captured:${paymentId}`);
          if (!claimed) {
            logger.info('razorpay: duplicate payment event, skipping', {
              paymentId,
              ipHash: requestMeta.ipHash,
            });
            res.status(200).send('OK');
            return;
          }
        }

        try {
          await upgradePlan(userId, plan, requestMeta, paymentId);
        } catch (err) {
          if (paymentId) {
            await releaseWebhookEvent(`payment.captured:${paymentId}`);
          }
          if (isUnverifiableEntitlementTarget(err)) {
            await recordUnverifiableEntitlementTarget(userId, requestMeta);
          }
          throw err;
        }
      } else if (eventType === 'subscription.activated') {
        const sub = (event.payload as Record<string, unknown>)?.subscription as
          | Record<string, unknown>
          | undefined;
        const entity = sub?.entity as Record<string, unknown> | undefined;
        const notes = entity?.notes as Record<string, string> | undefined;

        const subscriptionId = extractNonEmptyString(entity?.id);

        const binding = await resolveLedgerBinding(RAZORPAY_SUBSCRIPTION_LEDGER, subscriptionId);
        if (!binding.ok) {
          logger.warn('razorpay subscription.activated: no ledger binding, granting nothing', {
            reason: binding.reason,
            subscriptionId,
            ipHash: requestMeta.ipHash,
            durationMs: Date.now() - startedAt,
          });
          await recordUnboundEntitlement(
            'subscription.activated',
            binding.reason,
            subscriptionId,
            extractNonEmptyString(notes?.userId),
            requestMeta,
          );
          res.status(200).send('OK');
          return;
        }
        const userId = binding.uid;

        const plan = RAZORPAY_PLAN_MAP[binding.planId];
        if (plan) {
          // Same atomic claim as payment.captured — this event type previously
          // had no dedup at all, so a Razorpay redelivery would silently
          // re-run upgradePlan (harmless here since it recomputes the same
          // expiry rather than stacking it, but inconsistent and unobserved).
          const claimKey = `subscription.activated:${subscriptionId}`;
          const claimed = await claimWebhookEvent(claimKey);
          if (!claimed) {
            logger.info('razorpay: duplicate subscription.activated event, skipping', {
              subscriptionId,
              ipHash: requestMeta.ipHash,
            });
            res.status(200).send('OK');
            return;
          }
          try {
            await upgradePlan(userId, plan, requestMeta);
          } catch (err) {
            await releaseWebhookEvent(claimKey);
            if (isUnverifiableEntitlementTarget(err)) {
              await recordUnverifiableEntitlementTarget(userId, requestMeta);
            }
            throw err;
          }
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
