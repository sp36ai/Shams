# Payments & Subscription Lifecycle — Audit

Scope: `functions/src/functions/payments/googlePlay.ts`, `.../razorpay.ts`,
`functions/src/functions/quota.ts`, `src/hooks/usePurchase.ts`.

## What is solid

- **Google Play verify** (`verifyGooglePlayPurchase`): App Check + Auth, calls
  the Play Developer API with a service-account JWT, checks `purchaseState==0`,
  uses Play's **authoritative `expiryTimeMillis`**, binds the purchase token to
  one account (sha256 → `playPurchaseTokens`, replay-proof), acknowledges to
  avoid auto-refund, and merges custom claims (never clobbers `admin`).
- **Razorpay webhook**: HMAC-SHA256 signature verified against `rawBody`,
  per-IP rate limit before HMAC, invalid signatures logged to `securityEvents`,
  idempotency via `razorpayPaymentId`, always 200 so Razorpay stops retrying.
- **Expiry downgrade** is lazy and correct: `quota.ts` / `askOracle` drop a plan
  to `free` once `planExpiry` has passed, so a cancelled/expired subscriber
  loses premium at period end without any extra machinery.

## Findings

### 1. Razorpay renewals were not handled — FIXED
`subscription.charged` (the recurring debit each cycle) was ignored, so a
Razorpay subscriber's `planExpiry` — set once at `subscription.activated` —
never advanced, and the lazy downgrade wrongly dropped a *paying* subscriber to
free at the first renewal boundary. **Now handled** (with idempotency), and
`subscription.cancelled` / `halted` are logged (access left to lapse naturally
at period end). No client or infra change needed — just ensure these events are
enabled on the Razorpay webhook.

### 2. Google Play renewals are not handled server-side — OPEN (needs infra)
Same root problem, no equally-safe in-repo fix:
- Entitlement is written once at purchase with a fixed `planExpiry`.
- The only refresh paths are (a) the client `purchaseUpdatedListener`, which is
  mounted **only on the Premium screen** (`usePurchase` is used there alone), so
  it's inactive during normal use; and (b) a **manual** "Restore purchase" tap.
- A subscriber who renews but doesn't revisit Premium keeps a stale expiry and
  is wrongly downgraded at the original period end until they manually restore.

**Correct fix — Real-time Developer Notifications (RTDN):**
1. Play Console → Monetization setup → create a Pub/Sub topic for RTDN.
2. Add an `onMessagePublished` Cloud Function subscribed to that topic. The
   building blocks already exist and can be reused:
   - decode the base64 `subscriptionNotification` (has raw `purchaseToken`,
     `subscriptionId`, `notificationType`);
   - `sha256(purchaseToken)` → look up the owning user in `playPurchaseTokens`
     (the mapping we already maintain);
   - re-run the existing Play API `GET …/subscriptions/{id}/tokens/{token}`
     (extract `getGoogleAccessToken` + the fetch from `googlePlay.ts`);
   - on RENEWED/RECOVERED → update `quotas/{uid}.planExpiry` + claims;
     on EXPIRED/REVOKED → set `plan: 'free'`.
3. This keeps entitlement always-current with zero client dependence.

**Interim client mitigation (until RTDN ships):** move `initConnection` +
`purchaseUpdatedListener` to a root-level effect and run a silent `restore()`
once on launch when the user is signed in, so a returning subscriber's expiry
re-syncs on every app open. Needs on-device IAP testing — not done here to
avoid shipping unverified IAP-init changes blind.

## Residual notes
- Razorpay `upgradePlan` sets `expiry = now + PLAN_DURATION_DAYS` (fixed) rather
  than Razorpay's authoritative period end. Acceptable for fixed-term plans;
  revisit if variable terms are introduced.
- Local client `plan` (quotaStore) is a display cache; `quotas/{uid}` in
  Firestore is authoritative for all gating. No privilege drift risk.
