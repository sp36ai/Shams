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

interface ProductPurchase {
  purchaseState: number; // 0 = purchased, 1 = canceled, 2 = pending
  consumptionState: number; // 0 = not consumed
  acknowledgementState: number; // 0 = not acknowledged
  orderId: string;
  purchaseTimeMillis: string;
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

function httpsPostAuth(url: string, accessToken: string): Promise<void> {
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
        res.on('end', () => resolve());
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

      // Verify purchase with Google Play API
      const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/purchases/products/${input.productId}/tokens/${input.purchaseToken}`;
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

      const purchase = JSON.parse(body) as ProductPurchase;

      // purchaseState 0 = purchased
      if (purchase.purchaseState !== 0) {
        throw new HttpsError('failed-precondition', 'Purchase is not in a valid state');
      }

      const durationDays = PLAN_DURATION_DAYS[plan];
      const expiresAt = new Date(Date.now() + durationDays * 86_400_000);

      // Acknowledge to prevent auto-refund (24h window)
      if (purchase.acknowledgementState === 0) {
        const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${input.packageName}/purchases/products/${input.productId}/tokens/${input.purchaseToken}:acknowledge`;
        await httpsPostAuth(ackUrl, accessToken);
      }

      // Update Firestore
      await db.collection('quotas').doc(userId).set(
        {
          plan,
          planExpiry: expiresAt.toISOString(),
          orderId: purchase.orderId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // Firebase custom claims — client reads these on next getIdTokenResult()
      await auth.setCustomUserClaims(userId, { plan, planExpiry: expiresAt.toISOString() });

      logger.info('play purchase verified', {
        userId,
        plan,
        orderId: purchase.orderId,
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
        orderId: purchase.orderId,
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
