# Shams al-Asrar — Present Status (May 5, 2026)

## 1) Executive Summary

Current state: **feature-rich beta / pre-production**.

- Core app experience (Ask, Sky Clock, History, Settings) is implemented and usable.
- Cloud oracle pipeline and security controls exist on backend.
- Full commercial production readiness is **not yet achieved** due to payment wiring gaps, hardening toggles still disabled, and incomplete verification signal from tests in this environment.

---

## 2) Current Product Surface (What Exists Now)

### Mobile App (React Native)

Implemented screens and flows:

1. **Splash + Security Gate**
   - Splash with animation and min duration.
   - Integrity checks before mounting app.

2. **Auth**
   - Email/password sign-in and sign-up.
   - Google sign-in integration in UI/store.
   - Auth bootstrap and session restore via Firebase Auth.

3. **Location Permission Onboarding**
   - Android runtime permission flow.
   - Capture and persistence of last known coordinates.

4. **Oracle (Primary Ask Surface)**
   - Chat-style question flow.
   - Calls `askOracle` cloud function.
   - Verdict narration + confidence + timing/remedy/reasoning display.
   - Follow-up intents (timing/why/remedy/new question).
   - Quota gating in UI.

5. **Sky Clock**
   - Rotating visual clock + live cards.
   - Planet/sign/nakshatra display logic and local calculations.

6. **History**
   - Persisted local reading cache (MMKV).
   - Filter/sort/list/detail modal.
   - Local delete.

7. **Settings**
   - Theme switching.
   - Language switching (EN/UR/HI).
   - Profile snapshot + location/settings actions.
   - Reading stats.

8. **Premium Screen**
   - Pricing tiers and paywall UI present.
   - Purchase action currently placeholder alert.

---

## 3) Backend / Cloud Functions Status

Implemented functions:

1. **`askOracle`** (callable)
   - Auth verify.
   - Input validation (Zod).
   - Rate limiting.
   - Quota claim/decrement.
   - Server-side chart build + question classification + RKP judgment.
   - Reading persistence.
   - Audit logging.

2. **`getQuota`** (callable)
   - Returns plan/usage/remaining.

3. **`syncReadings` / `deleteReading`** (callable)
   - Server-side sync/delete APIs exist.

4. **Payments**
   - `verifyGooglePlayPurchase` callable implemented.
   - `razorpayWebhook` HTTP webhook implemented.

5. **`health`** endpoint
   - Readiness/liveness style status endpoint.

Security and platform controls present:

- App Check enforcement is enabled outside development.
- Firestore rules are deny-by-default with owner checks and privileged-write protection.
- Rate limit and audit log plumbing exists.

---

## 4) Functional Wiring Status

### Working End-to-End

- Auth -> onboarding -> main tabs
- Ask question -> cloud judgment -> local history persistence
- Local history browsing/filter/delete
- Theme/language persistence

### Implemented but Not Fully Wired / Not Production Complete

1. **Premium purchase UX -> real purchase flow**
   - Premium screen CTA is placeholder (no direct purchase trigger from UI).

2. **Cloud support functions not fully consumed by app shell**
   - `getQuota`, `syncReadings`, `deleteReading`, payment verification paths exist but are not comprehensively wired in visible client workflows.

3. **Security hardening toggles**
   - Certificate pinning config is present but disabled and uses placeholder hashes.

4. **State/documentation drift**
   - `README` claims local-only shell, while app currently includes auth, premium, quota, sky clock, and cloud function calls.
   - Firestore rules comments still reference Supabase auth model, but active client auth flow is Firebase Auth.

---

## 5) Testing & Verification Status (From This Audit Session)

Available tests in repo:

- Client tests: `src/__tests__/judgeHorary.test.ts`, `src/__tests__/quotaSelectors.test.ts`
- Functions/engine tests: `functions/src/engine/__tests__/...`

Execution result in this environment:

- Root Jest suite attempts **timed out** under current environment constraints.
- Functions suite failed to start because `vitest` binary is unavailable in current `functions` environment (`'vitest' is not recognized`).

Implication:

- Automated validation signal is currently incomplete in this machine/session.

---

## 6) Production-Level Assessment

### Overall Product Level

**Level: Beta / Pre-Production**

### By Domain

1. **Core UX & app navigation**: **High beta maturity**
2. **Cloud judgment backend**: **Strong beta maturity**
3. **Payments/subscriptions commercialization**: **Partial**
4. **Security hardening**: **Good base, incomplete final hardening**
5. **Testing/release confidence**: **Insufficient final signal in current environment**

---

## 7) What Is Needed for “Production” Classification

1. Wire premium CTA to real purchase flow (Play/Razorpay path by platform).
2. Complete and verify certificate pinning (real SPKI pins, enable enforcement).
3. Run and pass full test suites in CI and local release environment.
4. Align docs/rules comments with actual auth/data architecture.
5. Finalize release playbook (build, smoke, rollback, monitoring, alerting).

---

## 8) Recommended Label Right Now

Use this label externally:

**“Private beta with production-style backend controls; payments and final hardening in progress.”**
