/**
 * verifyGooglePlayPurchase — verifies an Android in-app purchase token.
 *
 * Flow:
 *   1. App Check + Firebase Auth (request.auth — enforced by callable runtime)
 *   2. Validate input (purchaseToken, productId, packageName)
 *   3. Call Google Play Developer API via service account credentials
 *   4. Verify purchase is PURCHASED state (0) and not consumed
 *   5. Map productId → PlanTier
 *   6. Update Firestore /quotas/{userId} + set Firebase Auth custom claims
 *   7. Acknowledge the purchase (to prevent auto-refund)
 *   8. Return confirmed plan
 *
 * Google Play service account credentials are stored in Firebase Secret Manager:
 *   - GOOGLE_PLAY_CLIENT_EMAIL — service account email
 *   - GOOGLE_PLAY_PRIVATE_KEY  — service account private key (PEM)
 *
 * Reference: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get
 */

import * as https from 'https';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db, auth } from '../../utils/admin';
import { verifyAuth } from '../../middleware/auth';
import { parse, VerifyGooglePlaySchema } from '../../middleware/validate';
import { logger } from '../../utils/logger';
import { requestMetaFromCallable } from '../../utils/requestMeta';
import {
  FUNCTION_OPTS,
  GOOGLE_PLAY_CLIENT_EMAIL,
  GOOGLE_PLAY_PRIVATE_KEY,
  PLAY_PRODUCT_MAP,
  PLAN_DURATION_DAYS,
} from '../../config';

// ── Google Play API client (no googleapis SDK to keep bundle small) ───────────

interface GoogleAccessToken {
  access_token: string;
  expires_in: number;
}

interface SubscriptionPurchaseV2 {
  subscriptionState: string; // SUBSCRIPTION_STATE_ACTIVE, _CANCELED, _EXPIRED, etc.
  acknowledgementState: string; // ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED or _PENDING
  orderId?: string;
  lineItems: Array<{ expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled: boolean } }>;
  startTime?: string;
}

function httpsPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      res => {
        let data = '';
        res.on('data', (c: string) => {
          data += c;
        });
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url: string, accessToken: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      res => {
        let data = '';
        res.on('data', (c: string) => {
          data += c;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function httpsPostAuth(url: string, accessToken: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Length': '0' },
      },
      res => {
        res.on('data', () => undefined);
        res.on('end', () => resolve(res.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function getGoogleAccessToken(): Promise<string> {
  const clientEmail = GOOGLE_PLAY_CLIENT_EMAIL.value();
  const privateKey = GOOGLE_PLAY_PRIVATE_KEY.value().replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new HttpsError('internal', 'Play Store credentials not configured');
  }

  // Build JWT for service account auth
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  ).toString('base64url');

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(privateKey, 'base64url');
  const jwtAssertion = `${header}.${payload}.${sig}`;

  const tokenResp = await httpsPost(
    'https://oauth2.googleapis.com/token',
    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwtAssertion}`,
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  );

  const tokenData = JSON.parse(tokenResp) as GoogleAccessToken;
  return tokenData.access_token;
}

// ── Main function ────────────────────────────────────────────────────────────

export const verifyGooglePlayPurchase = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.NODE_ENV !== 'development',
    secrets: [GOOGLE_PLAY_CLIENT_EMAIL, GOOGLE_PLAY_PRIVATE_KEY],
  },
  async request => {
    const startedAt = Date.now();
    const requestMeta = requestMetaFromCallable(request);
    const { userId } = verifyAuth(request);
    const input = parse(VerifyGooglePlaySchema, request.data);

    try {
      const plan = PLAY_PRODUCT_MAP[input.productId];
      if (!plan) {
        throw new HttpsError('invalid-argument', `Unknown productId: ${input.productId}`);
      }

      // Get Google OAuth token
      const accessToken = await getGoogleAccessToken();

      // Verify subscription with Google Play Subscriptions v2 API
      const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/purchases/subscriptionsv2/get/${input.productId}/tokens/${input.purchaseToken}`;
      const { status, body } = await httpsGet(apiUrl, accessToken);

      if (status !== 200) {
        logger.warn('play purchase verification failed', {
          userId,
          status,
          body: body.slice(0, 200),
          ipHash: requestMeta.ipHash,
          durationMs: Date.now() - startedAt,
        });
        throw new HttpsError('invalid-argument', 'Purchase could not be verified');
      }

      const purchase = JSON.parse(body) as SubscriptionPurchaseV2;

      const lineExpiry = purchase.lineItems?.[0]?.expiryTime;
      const durationDays = PLAN_DURATION_DAYS[input.productId] ?? 31;

      // Only accept active subscriptions or canceled ones still within paid period
      if (purchase.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED') {
        const expiryMs = lineExpiry ? new Date(lineExpiry).getTime() : 0;
        if (isNaN(expiryMs) || expiryMs <= Date.now()) {
          throw new HttpsError('failed-precondition', 'Subscription has expired');
        }
      } else if (purchase.subscriptionState !== 'SUBSCRIPTION_STATE_ACTIVE') {
        throw new HttpsError('failed-precondition', 'Subscription is not in a valid state');
      }

      // Use expiry from Play if valid, otherwise fall back to duration table
      let expiresAt: Date;
      if (lineExpiry) {
        const parsed = new Date(lineExpiry);
        expiresAt = isNaN(parsed.getTime())
          ? new Date(Date.now() + durationDays * 86_400_000)
          : parsed;
      } else {
        expiresAt = new Date(Date.now() + durationDays * 86_400_000);
      }

      // Acknowledge subscription to prevent auto-refund (3-day window).
      // Uses subscriptionsv2 acknowledge endpoint (not the v1 subscriptions path).
      if (purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
        const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/purchases/subscriptionsv2/tokens/${input.purchaseToken}:acknowledge`;
        const ackStatus = await httpsPostAuth(ackUrl, accessToken);
        if (ackStatus !== 200 && ackStatus !== 204) {
          logger.warn('play subscription ack failed', {
            userId,
            ackStatus,
            purchaseToken: input.purchaseToken.slice(0, 16),
          });
        }
      }

      const orderId = purchase.orderId ?? input.purchaseToken.slice(0, 24);

      // Update Firestore
      await db.collection('quotas').doc(userId).set(
        {
          plan,
          planExpiry: expiresAt.toISOString(),
          orderId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // Firebase custom claims — client reads these on next getIdTokenResult()
      await auth.setCustomUserClaims(userId, { plan, planExpiry: expiresAt.toISOString() });

      logger.info('play purchase verified', {
        userId,
        plan,
        orderId,
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });

      await db.collection('auditLogs').add({
        userId,
        action: 'payment_play_ok',
        plan,
        source: requestMeta.source,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
        ts: FieldValue.serverTimestamp(),
      });

      return {
        plan,
        planExpiry: expiresAt.toISOString(),
        orderId,
      };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      logger.error('verifyGooglePlayPurchase error', {
        userId,
        err: String(err),
        ipHash: requestMeta.ipHash,
        durationMs: Date.now() - startedAt,
      });
      await db.collection('auditLogs').add({
        userId,
        action: 'payment_play_fail',
        err: String(err),
        source: requestMeta.source,
        ipHash: requestMeta.ipHash,
        userAgent: requestMeta.userAgent,
        durationMs: Date.now() - startedAt,
        ts: FieldValue.serverTimestamp(),
      });
      throw new HttpsError('internal', 'Purchase verification failed');
    }
  },
);
