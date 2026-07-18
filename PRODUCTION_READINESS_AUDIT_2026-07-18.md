# Shams al-Asrār — Production Readiness Audit

**Date:** 2026-07-18
**Auditor role:** Principal Architect / RN Engineer / QA / Security / Performance / DevOps / Store Reviewer
**Commit audited:** `e5d2c22` (branch `claude/production-readiness-audit-iuisqu`)
**Scope:** Full repository — `src/` (23.5k LOC), `functions/`, `android/`, Firebase config, CI/CD, store assets.

> **Method note:** This is a fresh source-level audit. Prior checkpoint notes in `AUDIT_PROGRESS.md` were **not trusted** — they were found to be stale (they describe RN 0.74.5 with no Firestore and a `dummy_token` payment stub; the current tree is RN 0.78.3 with Firestore, `react-native-iap`, Crashlytics, and a real IAP flow). Dynamic checks that require a device, a signed build, or live Firebase/Play/Anthropic services **could not be run from the repository** and are listed explicitly in §"Artifacts Required".

---

## 1. Executive Summary

Shams al-Asrār is a mature, unusually well-engineered React Native horary-astrology app. The server-authoritative architecture is genuinely strong: the proprietary RKP judgment engine and all quota/entitlement enforcement run in Cloud Functions behind Firebase Auth + App Check, Firestore rules are deny-by-default with no client-writable privileged fields, inputs are Zod-validated, the Razorpay webhook uses constant-time HMAC verification, and there are no secrets or API keys committed to the repo. Client code quality is high — TypeScript strict, Zustand stores, an error boundary wired to Crashlytics, a boot-time integrity gate, trilingual i18n (en/ur/hi) at parity, and partial accessibility labelling. CI/CD is comprehensive (lint, typecheck, unit tests, dead-code guard, Maestro E2E on an emulator, and a signed-AAB pipeline with bundletool verification and staged rollout).

The project is **not** blocked by sprawl, dead code, or obvious crashes. It **is** blocked, for a *monetized* launch, by one concrete correctness defect in the Google Play subscription-verification function and by the absence of verifiable release-build/device evidence. A free (no-IAP) soft launch would be much closer to ready.

**Single most important finding:** `verifyGooglePlayPurchase` checks a `purchaseState` field that does not exist on Google Play's `purchases.subscriptions` v3 resource, so every genuine subscription verification will throw and no user can complete an upgrade (Critical, §"Critical Blockers" #1).

---

## 2. Release Score: **70 / 100**

Weighted for a production Play Store launch *with subscriptions enabled*. For a free/no-IAP launch the effective score is ~84.

| Dimension | Score | One-line rationale |
|---|---|---|
| **Security** | 82 | Excellent rules/authz/validation; loses points for entitlement-replay exposure and no native SSL pinning. |
| **Performance** | 78 | Strong client render hygiene; two sequential LLM calls per reading; device metrics unverified. |
| **Code Quality** | 85 | Typed, linted, tested, error-handled; minor engine duplication and doc drift. |
| **UX** | 75 | Polished, trilingual, partial a11y; dark/landscape/tablet/offline unverified on device. |
| **Architecture** | 80 | Clean server-authoritative design; duplicate engine trees + stale docs. |

---

## 3. Critical Blockers

### C1 — Google Play subscription verification is structurally broken *(BLOCKS RELEASE — monetized)*
- **File:** `functions/src/functions/payments/googlePlay.ts:43-49, 193-198`
- **Root cause:** The code queries the subscriptions endpoint (`/purchases/subscriptions/{productId}/tokens/{token}`) and then checks `purchase.purchaseState !== 0`. The Play Developer API v3 `SubscriptionPurchase` resource has **no `purchaseState` field** — that field belongs to the *products* resource. The declared `SubscriptionPurchase` interface invents it. At runtime `purchase.purchaseState` is `undefined`, so `undefined !== 0` is always `true` and the function throws `HttpsError('failed-precondition', 'Subscription is not in an active state')`.
- **Why it matters:** Every real subscription purchase (`mureed_monthly`, `khass_annual`, etc.) fails verification → no user can ever be upgraded to a paid plan → the entire monetization path is dead, while `usePurchase.ts` reports `verification_failed` to the buyer *after* Google has charged them.
- **Exact fix:** Validate the fields the subscriptions resource actually returns:
  ```ts
  interface SubscriptionPurchase {
    paymentState?: number;      // 1 = received, 2 = free trial
    expiryTimeMillis: string;
    acknowledgementState: number;
    orderId: string;
    startTimeMillis: string;
  }
  // Active if the subscription is paid/trial AND not expired:
  const active = purchase.paymentState === 1 || purchase.paymentState === 2;
  if (!active) throw new HttpsError('failed-precondition', 'Subscription is not active');
  ```
  (The existing `expiryTimeMillis > now` check on line 201-204 is correct and should stay.)
- **Blocks release:** **Yes** for any build with IAP. **Must be confirmed end-to-end against a Play Console sandbox purchase** — this defect is derivable from Google's API schema but should be proven with a real token before shipping.

---

## 4. High Priority Fixes

### H1 — No purchase-token → user binding (entitlement/subscription-sharing bypass)
- **File:** `functions/src/functions/payments/googlePlay.ts:157-231`
- **Root cause:** `verifyGooglePlayPurchase` accepts any `purchaseToken` from any authenticated user and upgrades **that caller**. There is no record that a given token has already been claimed, and no check of `obfuscatedExternalAccountId` against the caller's UID.
- **Why it matters:** One valid purchase token (shared, leaked, or from a refunded/again-used purchase) can be replayed to upgrade multiple distinct accounts. Direct revenue leakage.
- **Exact fix:** On success, write `/purchaseTokens/{token} = { userId, orderId }` in the same transaction; reject if the token already maps to a **different** `userId`. Additionally set `obfuscatedExternalAccountId` = Firebase UID when launching `requestSubscription` on the client, and verify it matches server-side.
- **Blocks release:** Strongly recommended before a monetized launch; not a startup blocker.

### H2 — Quota is consumed before the reading is computed
- **File:** `functions/src/functions/askOracle.ts:355-372` (quota claimed at step 5, chart/judge at 6-8)
- **Root cause:** `claimQuotaSlot()` atomically decrements the daily quota *before* `buildChart()`/`judgeHorary()` run. If either throws, control reaches the outer `.catch` which returns `HttpsError('internal', …)` — but the quota slot is already gone.
- **Why it matters:** A transient engine/ephemeris error costs a free user one of their 3 daily questions and returns only a generic failure. Erodes trust and generates support load.
- **Exact fix:** Either (a) move the quota decrement to *after* a successful `judgeHorary()` and reading persist, or (b) on failure, run a compensating transaction that refunds the slot (`used - 1` for the current `dayKey`). Option (a) is cleaner.
- **Blocks release:** No, but user-facing enough to fix pre-launch.

### H3 — Per-reading LLM cost/latency (billing risk)
- **File:** `functions/src/functions/askOracle.ts:474-497`, `functions/src/functions/safetyValidator.ts:145-182`
- **Root cause:** Each `askOracle` call makes **1 Claude Opus call** (`claude-opus-4-7`, `max_tokens: 4096`) followed by **4 parallel Claude Haiku calls** (one per validated field). That is 5 model calls per reading, on the *free* tier (3/day) as well as paid.
- **Why it matters:** At scale this is the dominant cost centre and is unbounded per-user beyond the quota gate. Opus at 4096 output tokens per free reading is a real monthly-bill risk; a spike or abuse pattern (within the 10/min rate limit) compounds it. Latency is also ~25s worst-case for synthesis before the 4 validators.
- **Exact fix:** (1) Add a per-user/day *cost* ceiling in addition to the count quota. (2) Consider collapsing the 4 per-field Haiku validations into a single Haiku call with all four fields in one prompt (¼ the request count). (3) Confirm Anthropic spend alerting is configured. Model IDs themselves are valid/active (`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) — no change required there, though `claude-opus-4-8`/`claude-sonnet-5` are the current-generation successors.
- **Blocks release:** No — but set billing alarms before public launch.

### H4 — Store listing assets incomplete (Play compliance)
- **File:** `android/fastlane/metadata/android/en-US/` (has `title.txt`, `full_description.txt`, `short_description.txt`, `changelogs/`) — **no `images/` (screenshots, feature graphic, phone/tablet screenshots)**.
- **Root cause:** The `r0adkll/upload-google-play` step only uploads what fastlane metadata contains. Screenshots and the 1024×500 feature graphic are absent.
- **Why it matters:** Play Console **requires** a feature graphic + ≥2 phone screenshots to publish to production. The release pipeline will push the AAB but the *listing* cannot go live until these are added.
- **Exact fix:** Add `fastlane/metadata/android/en-US/images/featureGraphic.png` and `images/phoneScreenshots/*.png` (and tablet if targeting tablets — the manifest declares `gps` as `required=false` specifically to allow tablets), or complete the listing manually in Play Console.
- **Blocks release:** Yes for the *store listing* (not the binary).

---

## 5. Medium Priority Fixes

| ID | Finding | File | Fix |
|---|---|---|---|
| M1 | Oracle voice + manzila are returned to the client but **not persisted** to the reading doc. Re-opening History shows the verdict but loses the AI prose the user paid for. | `functions/src/functions/askOracle.ts:376-399` (persist happens before synthesis at 474-497) | Persist `oracle`/`manzila` onto `/readings/{id}` after synthesis, or accept a documented limitation. |
| M2 | No Firebase Analytics / product event tracking — only Crashlytics (via `ErrorBoundary`). Release-readiness "Analytics" item unmet; you'll be blind to funnel/conversion. | `src/**` (no `analytics()`/`logEvent` usage; dep absent) | Add `@react-native-firebase/analytics` + key events (sign-up, ask, paywall-view, purchase) or explicitly defer. |
| M3 | No `storage.rules` file and no `storage` block in `firebase.json`. If a Storage bucket exists it falls back to default rules. | `firebase.json`, repo root | Confirm Storage is unused/disabled, or add a deny-by-default `storage.rules`. |
| M4 | Client vs server quota period may diverge. Server enforces **3 per UTC day** (`config.ts` `FREE_LIMIT`, `todayKey`). Confirm the client `quotaStore` uses the same period/anchor, or the UI count will disagree with server enforcement near boundaries. | `functions/src/config.ts:12-19` vs `src/stores/quotaStore.ts` | Align client period/anchor to server (UTC daily). Server is authoritative — this is a display-consistency fix. |
| M5 | No connectivity detection (`@react-native-community/netinfo` not a dependency) despite `ACCESS_NETWORK_STATE` being declared. Free/local modules work offline via MMKV, but `askOracle` failures surface as generic errors with no "you're offline" state. | `src/**`, `AndroidManifest.xml` | Add NetInfo and an offline banner on the Oracle/Premium screens, or document the degraded UX. |
| M6 | Engine exists in two near-identical trees (`src/astrology/**` and `functions/src/engine/**`) kept in sync by a build script. Judgment runs server-side only (correct), but the client bundles primitives (`julianDay`, `rulingPlanets`, `ayanamsa`, `siderealTime`) for the free SkyClock/timing strip. | both trees, `scripts/` | Determinism is centralized server-side (good). Keep a CI check that the shared primitives stay byte-identical to prevent client/server timing divergence. |

---

## 6. Low Priority Improvements

| ID | Finding | File |
|---|---|---|
| L1 | Native SSL pinning (OkHttp `CertificatePinner`) not wired; protection is App Check + TLS + `network_security_config.xml` only. Acceptable for v1; add for defense-in-depth. | `android/.../MainApplication.kt` |
| L2 | Boot-time integrity gate hard-blocks on Hermes/root/Frida with no override path. Low false-positive risk, but an unusual device that fails `HermesInternal` detection is permanently locked out. | `src/utils/security.ts:47-64` |
| L3 | Stray empty files: root `dasha.ts` (0 bytes) and `docs/timing.ts`. Dead files. | repo root, `docs/` |
| L4 | Heavy documentation drift: ~20 root `*.md` files, several stale (`AUDIT_PROGRESS.md` describes RN 0.74 / no Firestore / `dummy_token`). Misleads new engineers. | repo root |
| L5 | No deep-link / App Links intent filters in the manifest. Fine unless marketing needs them. | `AndroidManifest.xml` |
| L6 | `versionName "0.1.2"` / default `versionCode 4` — confirm this is the intended first public version string (0.x reads as pre-release to some reviewers). | `android/app/build.gradle` |

---

## 7. Category Findings (18-point sweep)

1. **Architecture** — Clean feature/layer separation; no circular deps flagged (CI runs `madge --orphans`); state via Zustand + MMKV is consistent; navigation is a single reactive root state machine (Splash→Auth→Location→Onboarding→Main). Concerns: duplicate engine trees (M6), doc drift (L4), stray files (L3). **Solid.**
2. **Source Code Quality** — TS strict, null-guarded (`?? ''`, `?.`), async paths use AbortController timeouts, no infinite loops observed, promise handling explicit, structured logger strips debug/info in release. Classify-question always returns a valid `HOUSE_MATRIX` key (`general` default) — no crash on unknown category. **Strong.**
3. **React Native Best Practices** — `useMemo` for nav theme & static rings, `setInterval`+cleanup (not RAF) in `CosmicClock`, `FlatList` with `keyExtractor` in Oracle/History, `KeyboardAvoidingView` + `keyboardShouldPersistTaps`. `useEffect` deps look correct in `RootNavigator`/`usePurchase`. **Good.**
4. **UI/UX** — Trilingual (i18n at parity), themed light/dark palette, error/loading/empty states present in Auth/History. **Pixel/landscape/tablet/dark rendering not verifiable from source — needs device screenshots.**
5. **Navigation** — Reactive gating, auth guard enforced on cold start via `bootstrap()`, modal paywall, no duplicate routes. `gestureEnabled:false` on the root disables swipe-back (intentional for a gated flow). No deep links (L5).
6. **Performance** — Client render hygiene good; two sequential Anthropic calls per reading add latency (H3). **Bundle size / startup / FPS / memory not measurable from source — needs a profiled build.**
7. **Security** — App Check enforced (`enforceAppCheck` per function), Auth enforced, Zod strict schemas, no committed secrets/keys, Razorpay HMAC constant-time verify, cleartext disabled, `allowBackup=false`. Gaps: entitlement replay (H1), no native pinning (L1). **Strong.**
8. **Backend Integration** — Consistent callable pattern, 25s/6s timeouts with AbortController, LLM fail-open to `ORACLE_FALLBACK`, response validated field-by-field. Retry/backoff on the *client* IAP path is minimal (verify-once). **Good.**
9. **Firebase** — Rules deny-by-default, privileged writes Admin-SDK-only, indexes defined for `readings`/`auditLogs`, rate-limit TTL field configured. Storage rules absent (M3). Functions region `asia-south1`, node 22. **Strong.**
10. **Database** — Reading writes go through Cloud Functions only; audit logs hash question text (no PII); rate-limit docs TTL-cleaned. Missing: purchase-token dedupe (H1). Indexes present for known query shapes.
11. **Build System** — Gradle: minSdk 24 / targetSdk 35 / compileSdk 35, Hermes ON, New Arch OFF, R8 full mode, `minifyEnabled`+`shrinkResources`, release signing gated on secrets with a fail-fast guard, ProGuard log-stripping, ABI `arm64-v8a`+`x86_64`. Release build config is textbook. **AAB not built/verified here (see Artifacts).**
12. **Dependencies** — RN 0.78.3, RNFirebase 19.3.0 suite, `react-native-iap` 12, Zustand 4, MMKV 2.12, Reanimated 3.19. No committed vulnerabilities scan available; run `npm audit`/`osv-scanner` in CI to close the loop. No obviously deprecated libs.
13. **Testing** — Unit tests present (`judgeHorary`, `quotaSelectors`, `rankCandidates`, `remedySelector`, `safetyValidator`), Firestore rules tests (`firestore.rules.test.ts`), Maestro E2E flows (auth, signup, settings). No coverage number verifiable here. Payment path (`googlePlay.ts`) has **no unit test** — which is why C1 slipped through.
14. **Accessibility** — 23 `accessibilityLabel` + roles/hints across all major screens. Partial but real. Color-contrast / dynamic-font-scaling / screen-reader traversal need on-device verification.
15. **Store Readiness** — Privacy policy present (`privacy-policy.html` + hosting), permissions minimal and justified, adaptive launcher icons present, splash theme configured, changelogs present. **Missing screenshots + feature graphic (H4).**
16. **Release Readiness** — Crashlytics + ErrorBoundary wired; release config hardened; staged 10% rollout in the release workflow. Gaps: no product analytics (M2), no feature-flag system, backup/rollback = re-deploy prior AAB (implicit). **Crash-free startup unverified on device.**
17. **AI Code Audit** — Very low dead code (only 6 TODO-class markers, `dummy_token` removed, orphan guard in CI). Anti-patterns: quota-before-compute (H2), fire-and-forget audit writes (acceptable), reading persisted before enrichment (M1). Technical debt is modest and mostly documentation drift.
18. **This Final Report** — below.

---

## 8. Shams-specific Extended Audits

- **Oracle engine correctness / determinism** — Engine runs **server-side only**; `classifyQuestion` is deterministic with a safe `general` default that is guaranteed present in `HOUSE_MATRIX`; chart built from server time + client lat/lon. Determinism is centralized (good). *Numerical correctness of the RKP/ephemeris math was not re-derived here* — covered by `judgeHorary.test.ts`; recommend a golden-vector regression suite over a fixed set of (time, lat, lon) → verdict.
- **Cloud Function latency/retries/failure** — Synthesis 25s timeout + fallback, validators 6s + fail-open, `askOracle` 120s function timeout for cold-start + 2 LLM stages. No client retry on `askOracle` failure (single attempt) — acceptable but consider one retry on `internal`.
- **Prompt engineering / AI response validation** — JSON parsed defensively, every field `String()`-coerced with fallbacks, safety validator gates medical/financial/legal/certainty claims (fail-open by design). Reasonable.
- **Islamic content accuracy** — Quranic verses, Asma, du'a, manzila descriptors are hard-coded in `ORACLE_FALLBACK` / `manazil.ts`. **Requires a qualified human/scholarly review** — cannot be validated by code audit.
- **Offline for free modules** — SkyClock/timing/history read from MMKV and bundled primitives → work offline. But no connectivity UX (M5).
- **Premium entitlement / bypass resistance** — Server-authoritative via custom claims + Firestore, rules block client writes to plan/quota. **But** C1 breaks the happy path and H1 leaves a replay hole — both must be closed for a trustworthy paywall.
- **Firestore read/write cost** — Per `askOracle`: 1 rate-limit txn + 1 quota txn + 1 reading write + 1 audit write ≈ 4-5 ops. Reasonable; rate-limit docs are TTL-reaped. No unbounded fan-out.
- **Battery / animations / memory on low-end Android** — `CosmicClock` uses 1s `setInterval` with cleanup (not a RAF loop) — battery-friendly. **Actual battery/memory profiling on a low-end device is required (see Artifacts).**
- **End-to-end signed AAB / pre-launch / crash-free startup** — Pipeline exists and looks correct; **no evidence it has produced a passing signed AAB, a green Play pre-launch report, or a crash-free cold start on a physical device.**

---

## 9. Artifacts Required (cannot be verified from the repository)

1. A **signed release AAB** built by `release-play-store.yml` + its bundletool manifest dump (targetSdk/versionCode).
2. **Play Console pre-launch report** (crawler crashes, accessibility, security warnings).
3. **Crash-free cold-start** proof on ≥1 physical low-end Android device (Crashlytics dashboard or logcat).
4. **A real/sandbox Google Play subscription purchase** exercised end-to-end through `verifyGooglePlayPurchase` — this is what will confirm or refute C1.
5. **Deployed Firestore + Storage rules** state, and confirmation Storage is either unused or protected.
6. **`npm audit` / `osv-scanner`** output for `package-lock.json` and `functions/package-lock.json`.
7. **Anthropic API spend dashboard** + billing alarms; measured p95 latency of `askOracle`.
8. **APK/AAB size, cold-start time, JS-thread FPS, and memory** from a profiled release build.
9. **Store screenshots + 1024×500 feature graphic** (currently absent).
10. Confirmation that CI secrets (`GOOGLE_SERVICES_JSON`, keystore, `ANTHROPIC_API_KEY`, Play service account, Razorpay/Play secrets) are provisioned.

---

## 10. Release Recommendation

### With subscriptions enabled: **Needs Major Fixes**
Driven by **C1 (broken subscription verification — hard blocker)**, **H1 (entitlement replay)**, and the absence of verified signed-AAB / pre-launch / device evidence and store imagery (H4). None of these are deep — C1 is a ~10-line fix — but the monetized path cannot ship until C1 is fixed *and proven against a sandbox purchase*.

### As a free / no-IAP soft launch: **Ready with Minor Fixes**
If IAP is gated off, the remaining blockers dissolve: the architecture is sound, security is strong, crash handling is in place, and CI is mature. Close H2 (quota refund), M4 (quota display alignment), and produce the release-build/device artifacts, and a free soft launch is defensible.

**Recommended sequence:** Fix C1 → add a `googlePlay.ts` unit/integration test that would have caught it → close H1 & H2 → set Anthropic + Play billing alarms (H3) → complete store imagery (H4) → run one full `release-play-store.yml` to an internal track → validate the Play pre-launch report and a physical-device cold start → promote.
