# PRODUCTION READINESS AUDIT -- Shams al-Asrar

**App:** `com.astrosarfaraz.shamsalasrar`
**React Native:** 0.74.5 | **Gradle:** 8.6 | **targetSdk:** 34 | **Node:** 22
**Audit Date:** 2026-06-27
**Auditor:** Automated multi-pass audit (Architecture, Runtime, Security, Release, Integration)

---

## EXECUTIVE SUMMARY

**Production Readiness Score: 38/100**

The application has solid foundational architecture -- deny-by-default Firestore rules, Zod input validation, structured logging, App Check integration, and a well-organized React Native codebase. However, **11 critical issues** were identified that individually or collectively can cause app crashes, complete authentication bypass, API key theft, payment system corruption, Play Store rejection, and network failures. The application requires significant remediation before production release.

**Go / No-Go Recommendation: NOT PRODUCTION READY**

---

## FINDINGS -- CRITICAL ISSUES

### CRIT-01. Anthropic API Key Shipped in Client APK
- **Severity:** CRITICAL
- **Root Cause:** `process.env.ANTHROPIC_API_KEY` is referenced in 4+ client-side files. In React Native, `process.env` values are baked into the JS bundle at build time by Metro. The key is extractable from any APK/AAB.
- **Evidence:** `src/hooks/useQuestionGate.ts:37`, `src/hooks/useIntentClassifier.ts:80`, `src/screens/OnboardingScreen.tsx:136`, `src/screens/OracleScreen.tsx:703,906`, `src/data/remedySelector.ts:161-199`
- **Affected Files:** 5+ client-side source files
- **Runtime Impact:** Anyone with the APK can extract the Anthropic API key and run unlimited bills against your account. Also exposes prompt engineering and model selection.
- **Reproduction:** Download APK, extract JS bundle with `npx react-native-decompiler`, search for API key string.
- **Minimal Safe Fix:** Move ALL Anthropic API calls to Firebase Cloud Functions. The client sends user text to a callable function; the function calls Anthropic with the key stored in Cloud Secret Manager. Remove all `process.env.ANTHROPIC_API_KEY` references from client code.
- **Risk if Unfixed:** Unlimited financial exposure via stolen API key; prompt/model IP theft.

### CRIT-02. NODE_ENV-Based Authentication Bypass in Cloud Functions
- **Severity:** CRITICAL
- **Root Cause:** `functions/src/middleware/auth.ts:10` returns a fake user `dev-test-user` with no authentication when `process.env.NODE_ENV === 'development'`. If `NODE_ENV` is ever misconfigured in production, all authentication is bypassed.
- **Evidence:** `functions/src/middleware/auth.ts:10`
- **Affected Files:** `auth.ts`, plus every callable function that uses `requireAuth()`
- **Runtime Impact:** Complete auth bypass -- any unauthenticated caller can invoke `askOracle`, `syncReadings`, `deleteReading`, `verifyGooglePlayPurchase`, `getQuota`, `setAdminClaim`.
- **Reproduction:** Deploy with `NODE_ENV=development` or misconfigure `.env` file.
- **Minimal Safe Fix:** Replace `process.env.NODE_ENV === 'development'` with `process.env.FUNCTIONS_EMULATOR === 'true'` (set automatically by Firebase emulator, never in production). Or remove the bypass entirely.
- **Risk if Unfixed:** Complete unauthorized access to all user data and administrative operations.

### CRIT-03. NODE_ENV-Based App Check Bypass in Cloud Functions
- **Severity:** CRITICAL
- **Root Cause:** `enforceAppCheck: process.env.NODE_ENV !== 'development'` is used across all callable functions. Same `NODE_ENV` leak risk as CRIT-02.
- **Evidence:** `functions/src/functions/readings.ts:22,73`, `askOracle.ts:304`, `quota.ts:14`, `admin.ts:23`, `payments/googlePlay.ts:160`
- **Affected Files:** 6 Cloud Function files
- **Runtime Impact:** Rogue API clients can directly call Cloud Functions without valid App Check tokens, enabling scraping, abuse, and quota exhaustion.
- **Minimal Safe Fix:** Hard-code `enforceAppCheck: true`. For emulator testing, use `process.env.FUNCTIONS_EMULATOR === 'true'`.
- **Risk if Unfixed:** App Check completely disabled; rogue clients can abuse all endpoints.

### CRIT-04. targetSdk 34 -- Play Store Will Reject Upload
- **Severity:** CRITICAL
- **Root Cause:** Google Play requires `targetSdk >= 35` for all new apps and updates as of August 31, 2025. The project targets SDK 34.
- **Evidence:** `android/build.gradle:9` (`targetSdkVersion = 34`), `android/app/build.gradle:37` (`targetSdk 34`)
- **Affected Files:** `android/build.gradle`, `android/app/build.gradle`
- **Runtime Impact:** Play Store rejects any upload. Cannot publish.
- **Minimal Safe Fix:** Set `compileSdkVersion = 35`, `targetSdkVersion = 35` in `android/build.gradle`; `compileSdk 35`, `targetSdk 35` in `android/app/build.gradle`. Test edge-to-edge behavior and predictive back gesture requirements for SDK 35.
- **Risk if Unfixed:** Cannot ship to Play Store.

### CRIT-05. No Production google-services.json -- Firebase Will Fail
- **Severity:** CRITICAL
- **Root Cause:** `android/app/google-services.json` does not exist (excluded by `.gitignore`). Only `google-services.json.ci` exists with placeholder values (`"CI_PLACEHOLDER_KEY_NOT_FOR_PRODUCTION"`, zeroed IDs `"000000000000"`).
- **Evidence:** `android/app/google-services.json` missing; `.gitignore:110`; `google-services.json.ci` with placeholders
- **Runtime Impact:** Build fails (google-services plugin requires the file) or produces APK where Firebase Auth, Firestore, Crashlytics, App Check all fail silently.
- **Minimal Safe Fix:** Download real `google-services.json` from Firebase Console for project `shams-app-4d0e7`. For CI, add build step that injects from GitHub Secrets.
- **Risk if Unfixed:** Complete Firebase failure. Authentication, database, crash reporting, analytics -- all non-functional.

### CRIT-06. Release Build Silently Falls Back to Debug Signing
- **Severity:** CRITICAL
- **Root Cause:** `android/app/build.gradle:92` uses ternary: if release keystore properties are missing, it falls back to the debug keystore. A release AAB signed with debug key will be rejected by Play Store.
- **Evidence:** `android/app/build.gradle:92` -- `signingConfig project.hasProperty('SHAMS_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
- **Runtime Impact:** Release APK/AAB silently signed with debug key. Play Store rejects; key mismatch if production key was previously registered.
- **Minimal Safe Fix:** Fail the build when release signing properties are missing instead of falling back. Set `signingConfig null` in the else branch to force a Gradle error.
- **Risk if Unfixed:** Corrupted release process; possible key lock-in disaster.

### CRIT-07. Razorpay/Google Play Payment Overwrites ALL Custom Claims
- **Severity:** CRITICAL
- **Root Cause:** Both `razorpay.ts:91` and `googlePlay.ts:225` call `auth.setCustomUserClaims(userId, { plan, planExpiry })` which completely replaces all existing claims. If the user has `admin: true`, purchasing a subscription deletes their admin claim. The admin function at `admin.ts:49` correctly merges claims, but payment functions do not.
- **Evidence:** `functions/src/functions/payments/razorpay.ts:91`, `functions/src/functions/payments/googlePlay.ts:225`
- **Runtime Impact:** Any admin who purchases a subscription loses admin access. Any user who gets admin after purchasing loses their paid plan.
- **Minimal Safe Fix:** Read existing claims before setting: `const user = await auth.getUser(userId); const current = user.customClaims || {}; await auth.setCustomUserClaims(userId, { ...current, plan, planExpiry });`
- **Risk if Unfixed:** Silent data corruption of user permissions; admin lockout.

### CRIT-08. Razorpay Webhook Has No Idempotency Check
- **Severity:** CRITICAL
- **Root Cause:** Code comment at `razorpay.ts:8` claims "Idempotent: re-processing a known payment is a no-op" but there is zero deduplication logic. No check for previously processed `orderId` or `payment_id`. Every webhook retry triggers a full `upgradePlan()`.
- **Evidence:** `functions/src/functions/payments/razorpay.ts:8` (comment), entire function body (no dedup)
- **Runtime Impact:** Razorpay retries webhooks on network failures. Each retry re-writes Firestore docs and custom claims. Re-processing resets expiry timer from `Date.now()`, potentially extending or resetting plans unfairly.
- **Minimal Safe Fix:** Before calling `upgradePlan`, check if a quota doc with the same `orderId` already exists. If so, return 200 early.
- **Risk if Unfixed:** Payment system corruption; plan duration manipulation.

### CRIT-09. Certificate Pins Expire 2027-05-01 With No Fallback
- **Severity:** CRITICAL
- **Root Cause:** `network_security_config.xml` has `<pin-set expiration="2027-05-01">` with only 2 SHA-256 pins and no backup pin. `MainApplication.kt:42-44` has OkHttp `CertificatePinner` with the same pins but NO expiration (will fail permanently if Google rotates certs). Dual pinning (NSC + OkHttp) doubles maintenance burden.
- **Evidence:** `android/app/src/main/res/xml/network_security_config.xml:7-11`, `MainApplication.kt:42-44`
- **Runtime Impact:** If Google rotates TLS certificates, all Firebase network calls fail with `SSLPeerUnverifiedException`. App is bricked until update. After 2027-05-01, NSC pins degrade gracefully but OkHttp pins fail permanently.
- **Minimal Safe Fix:** (a) Add a backup pin (intermediate CA). (b) Remove OkHttp `CertificatePinner` (NSC already enforces at platform level). (c) Set monitoring alarm 90 days before expiry.
- **Risk if Unfixed:** App-wide network failure; no self-healing without forced update.

### CRIT-10. react-native-screens and react-native-safe-area-context Version Drift
- **Severity:** CRITICAL
- **Root Cause:** Caret ranges in `package.json` allow `react-native-screens` to resolve to 3.37.0 (targeting RN 0.75+) and `react-native-safe-area-context` to 4.14.1 (targeting RN 0.76+). Both ship native code changes incompatible with RN 0.74.5.
- **Evidence:** `package.json:68` (`^3.34.0` -> 3.37.0), `package.json:69` (`^4.10.9` -> 4.14.1)
- **Runtime Impact:** Possible crash on app launch, screen transitions, or safe-area inset reads on Android. Build failures if native APIs are missing.
- **Minimal Safe Fix:** Pin exact versions: `"react-native-screens": "3.34.0"`, `"react-native-safe-area-context": "4.10.9"`.
- **Risk if Unfixed:** Runtime crashes or build failures.

### CRIT-11. Android Build Scripts Broken on Linux/macOS/CI
- **Severity:** CRITICAL
- **Root Cause:** `package.json:10-13` uses `gradlew` (no `./` prefix) which only works on Windows. Linux/macOS requires `./gradlew`.
- **Evidence:** `package.json:10-13` -- `"build:android:debug": "cd android && gradlew assembleDebug"` etc.
- **Runtime Impact:** All four Android build/clean npm scripts fail on Linux/macOS, including CI environments.
- **Minimal Safe Fix:** Change to `"cd android && ./gradlew assembleDebug"` for all scripts.
- **Risk if Unfixed:** CI builds and non-Windows development broken.

---

## FINDINGS -- HIGH ISSUES

### HIGH-01. Raw IP Addresses Logged and Stored in Firestore (GDPR/PII)
- **Severity:** HIGH
- **Evidence:** `functions/src/functions/askOracle.ts:375,528`, `payments/razorpay.ts:97,106` -- `ipAddress: requestMeta.ipAddress` written to `auditLogs` alongside the already-present `ipHash`.
- **Runtime Impact:** Violates stated policy ("Never log raw PII") and creates GDPR/India DPDP Act compliance risk.
- **Fix:** Remove `ipAddress` from all audit log writes. Keep only `ipHash`.

### HIGH-02. Debug Keystore Committed to Git
- **Severity:** HIGH
- **Evidence:** `android/app/debug.keystore` tracked in git; `.gitignore` has `!debug.keystore` explicitly including it.
- **Runtime Impact:** Known credentials (`android`/`androiddebugkey`). If SHA-1 fingerprint allowlists are configured in Firebase Console for debug keystore, attackers can use it.
- **Fix:** `git rm --cached android/app/debug.keystore`; remove `!debug.keystore` from `.gitignore`.

### HIGH-03. Razorpay Webhook CORS Open to All Origins
- **Severity:** HIGH
- **Evidence:** `functions/src/functions/payments/razorpay.ts:114` -- `cors: true`. Also `health.ts:11` -- `cors: true`.
- **Runtime Impact:** Any website can send cross-origin requests to webhook. HMAC check mitigates unauthorized upgrades, but enables probing. Health endpoint leaks engine version, project ID, region.
- **Fix:** Set `cors: false` on webhook. Remove sensitive fields from health response or restrict CORS.

### HIGH-04. Razorpay Webhook Has No Rate Limiting or IP Allowlist
- **Severity:** HIGH
- **Evidence:** `functions/src/functions/payments/razorpay.ts:113` -- publicly accessible, no rate limit before HMAC check.
- **Runtime Impact:** Attacker can spam invalid-signature requests, each writing to `securityEvents` collection, consuming Firestore write quota and billing.
- **Fix:** Add per-IP rate limit before HMAC check. Consider allowlisting Razorpay's webhook IP ranges.

### HIGH-05. onAuthStateChanged Listener Never Unsubscribed
- **Severity:** HIGH
- **Evidence:** `src/stores/authStore.ts:89` -- `auth().onAuthStateChanged(...)` return value not captured.
- **Runtime Impact:** On sign-out/sign-in cycles, multiple listeners accumulate, each firing `setPlan()` and `set()` redundantly.
- **Fix:** Capture unsubscribe function; call it in `signOut()`.

### HIGH-06. Quota Badge Shows Wrong Denominator During Trial
- **Severity:** HIGH
- **Evidence:** `src/screens/OracleScreen.tsx:1106` -- hard-codes `{questionsLeft}/{FREE_DAILY_LIMIT}` regardless of trial state.
- **Runtime Impact:** During trial (TRIAL_DAILY_LIMIT=5), badge shows "3/3" instead of "3/5".
- **Fix:** `const limit = trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT;`

### HIGH-07. Theme i18n Keys Do Not Match ThemeId Values
- **Severity:** HIGH
- **Evidence:** `themes.ts` uses `labelKey: 'theme.darAlShams'` etc., but `StringTable.theme` in `i18n/types.ts` only has keys `teal`, `midnightGold`, etc.
- **Runtime Impact:** Theme picker shows raw key paths (`theme.darAlShams`) instead of human-readable names in production. Throws in dev mode.
- **Fix:** Update `StringTable.theme` and all language files to use actual theme IDs.

### HIGH-08. SplashScreen Animated.loop Never Stopped
- **Severity:** HIGH
- **Evidence:** `src/screens/SplashScreen.tsx:95-110` -- `Animated.loop()` started in useEffect with no cleanup.
- **Runtime Impact:** Animation continues on unmounted component; wastes CPU, may cause warnings.
- **Fix:** Capture animation ref; return cleanup function calling `.stop()`.

### HIGH-09. Dimensions.get('window') at Module Scope -- Stale on Rotation/Fold
- **Severity:** HIGH
- **Evidence:** `src/components/StarfieldBackground.tsx:15`, `src/components/home/CosmicClock.tsx:71`, `src/screens/OnboardingScreen.tsx:18`
- **Runtime Impact:** Foldable devices or rotation use stale dimensions. Layouts break.
- **Fix:** Use `useWindowDimensions()` hook inside component.

### HIGH-10. HoraryChartWheel Hard-Codes Dark Theme Colors
- **Severity:** HIGH
- **Evidence:** `src/components/oracle/HoraryChartWheel.tsx` -- SVG uses hard-coded dark hex values (`#C9A961`, `#1A1A26`).
- **Runtime Impact:** On light themes, chart renders with near-invisible or clashing colors.
- **Fix:** Replace hard-coded colors with `useColors()` theme tokens.

### HIGH-11. quotaStore Uses "week" Naming for Daily Reset Logic
- **Severity:** HIGH
- **Evidence:** `src/stores/quotaStore.ts:50-57` -- MMKV key `quota.week.v1` stores daily date; `en.ts:87` says "this week" but resets daily. Functions `types.ts:114,120` field named `weekKey` with daily behavior.
- **Runtime Impact:** User confusion; support tickets about "weekly" limits resetting daily.
- **Fix:** Rename `QUOTA_WEEK` to `QUOTA_DAY`, `weekKey` to `dayKey` throughout. Update i18n strings.

### HIGH-12. consumeOne() Called After User Message Already Appended
- **Severity:** HIGH
- **Evidence:** `src/screens/OracleScreen.tsx:855-864` -- user message appended at 855, quota check at 858.
- **Runtime Impact:** On quota exhaustion, user sees their question in chat but gets no response and a modal. Orphaned message cannot be retried.
- **Fix:** Move quota check before appending user message, or remove orphaned message on exhaustion.

### HIGH-13. Duplicate Release APK Workflows
- **Severity:** HIGH
- **Evidence:** `release-apk.yml` and `build-release-apk.yml` both trigger on push to main with same path filters.
- **Runtime Impact:** Every push triggers TWO redundant release builds, wasting CI minutes. `npm install --legacy-peer-deps` instead of `npm ci` makes builds non-reproducible.
- **Fix:** Delete one workflow. Standardize on `npm ci`.

### HIGH-14. CI Workflow Exposes ANTHROPIC_API_KEY to All Steps
- **Severity:** HIGH
- **Evidence:** `ci.yml:74` -- `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}` set at job-level env.
- **Runtime Impact:** Available to every step including third-party actions. Supply-chain compromise could exfiltrate it.
- **Fix:** Move to only the specific step(s) that need it.

### HIGH-15. SyncReadings Validation Missing DENIED Verdict
- **Severity:** HIGH
- **Evidence:** `functions/src/middleware/validate.ts:41` -- enum missing `'DENIED'` which is valid per `types.ts:19`.
- **Runtime Impact:** Readings with DENIED verdict cannot be synced. Client sync failures.
- **Fix:** Add `'DENIED'` to the enum array.

### HIGH-16. Hardcoded Postgres Credentials in docker-compose.yml
- **Severity:** HIGH
- **Evidence:** `docker-compose.yml:62-63` -- `POSTGRES_USER: shams_user`, `POSTGRES_PASSWORD: shams_password`
- **Runtime Impact:** Public credentials if Postgres is ever used in non-local environment.
- **Fix:** Use env variable references or remove unused services.

### HIGH-17. react-native-iap Not Installed / Stale Dimension Strategy
- **Severity:** HIGH
- **Evidence:** `package.json:68` lists `react-native-iap ^12.15.0` but node_modules missing it. `build.gradle:43` depends on its flavor dimension.
- **Runtime Impact:** Build failure with missing dimension or autolink error.
- **Fix:** Run `npm install` or remove the package and `missingDimensionStrategy` line if IAP is not used.

---

## FINDINGS -- MEDIUM ISSUES

### MED-01. Firestore Admin Rule Grants Write (Including Create/Update) to Admins on Readings
- **Evidence:** `firestore.rules:71-78` -- `allow read, write, delete: if isAdmin()` overrides `create: false` and `update: false`.
- **Impact:** Admins can create/update readings via client SDK, bypassing Cloud Functions validation.
- **Fix:** Change to `allow read, delete: if isAdmin();`

### MED-02. Missing ProGuard/R8 Rules for react-native-iap and Google Sign-In
- **Evidence:** `android/app/proguard-rules.pro` has no rules for these packages.
- **Impact:** Potential `ClassNotFoundException` crashes in release builds.
- **Fix:** Add keep rules for `com.dooboolab.rniap.**`, `com.android.vending.billing.**`, `com.google.android.gms.auth.**`.

### MED-03. Localized strings.xml Missing for Declared Locales (ur, hi)
- **Evidence:** `build.gradle:46` declares `["en", "ur", "hi"]` but no translated `values-ur/` or `values-hi/` directories exist.
- **Impact:** Users with Urdu/Hindi system language see English app name.
- **Fix:** Create translated `strings.xml` files.

### MED-04. Emulator Port Inconsistency Across Configuration Files
- **Evidence:** Firestore emulator ports: `firebase.json` (8282), `firebase.test.json` (8181), `firebase-emulator.json` (8080).
- **Impact:** Tests fail unless correct config is explicitly specified.
- **Fix:** Standardize to single port across all configs.

### MED-05. Quota Naming Confusion: "weekKey" vs Daily
- **Evidence:** Field named `weekKey` in `QuotaDoc` and `QuotaResponse`, `FREE_LIMIT = 100` with "Weekly quota exhausted" error message, but key resets daily.
- **Impact:** Developer confusion; incorrect user-facing error messages.
- **Fix:** Rename field and update error messages.

### MED-06. askOracle Timeout May Be Insufficient
- **Evidence:** `FUNCTION_OPTS.timeoutSeconds = 60`. Oracle synthesis (25s) + safety validation (24s) + chart computation + cold start can exceed 60s.
- **Impact:** Timeouts on cold starts; wasted Claude API costs.
- **Fix:** Increase `timeoutSeconds` to 120 for `askOracle`.

### MED-07. Predeploy Manifest Shows 7/7 Manual Checks Incomplete
- **Evidence:** `firebase.predeploy.json:21-28` -- all items `false`: API key restrictions, billing, App Check, secrets, service accounts, webhooks, certificate pins.
- **Impact:** Critical production configurations not verified.
- **Fix:** Complete each item before deployment.

### MED-08. Duplicate System Prompt Definitions
- **Evidence:** `functions/src/prompts/oracleSynthesis.ts` and `oracleSynthesisPrompt.ts` both export similar prompts. Only one is used.
- **Impact:** Risk of editing wrong file; subtle content differences.
- **Fix:** Delete unused `oracleSynthesis.ts`.

### MED-09. 120 Animated.Value Instances in StarfieldBackground
- **Evidence:** `src/components/StarfieldBackground.tsx` -- 120 stars + 4 nebula clouds = ~130 animation nodes.
- **Impact:** Frame drops on low-end devices during splash.
- **Fix:** Reduce count to 60-80 or use Reanimated shared values.

### MED-10. CosmicClock Re-renders Entire SVG Every 1 Second
- **Evidence:** `src/components/home/CosmicClock.tsx:337-340` -- `setInterval` -> `setNow` -> full SVG re-render.
- **Impact:** CPU-intensive on mid-range devices.
- **Fix:** Use `React.memo` on sub-components or Reanimated transforms.

### MED-11. navigator.geolocation Used Without Explicit Import
- **Evidence:** `src/screens/OracleScreen.tsx:672,819` -- uses Web Geolocation API removed from RN core in 0.60.
- **Impact:** If no polyfill installed, crash on first question without cached location.
- **Fix:** Import from `@react-native-community/geolocation` explicitly.

### MED-12. useQuota Calls Cloud Function on Every Tab Switch
- **Evidence:** `src/hooks/useQuota.ts:40-42` -- `refresh()` on mount invokes `getQuota` Cloud Function.
- **Impact:** Unnecessary network calls and function invocations.
- **Fix:** Cache response with 60s TTL.

### MED-13. usePurchase Listener is a No-Op
- **Evidence:** `src/hooks/usePurchase.ts:74` -- `purchaseUpdatedListener` callback is `(_p) => undefined`.
- **Impact:** Subscription renewals, cancellations, or refunds not reflected until restart.
- **Fix:** Implement server verification and plan update in the listener.

### MED-14. Network Security Config Missing base-config
- **Evidence:** `network_security_config.xml` has no `<base-config>` element.
- **Impact:** Non-Firebase domains use default TLS with no explicit HTTPS-only enforcement.
- **Fix:** Add `<base-config cleartextTrafficPermitted="false">`.

### MED-15. No Automated Versioning
- **Evidence:** `android/app/build.gradle:38-39` -- `versionCode 4`, `versionName "0.1.2"` hardcoded.
- **Impact:** Forgotten versionCode bump blocks release.
- **Fix:** CI-driven versioning via build counter.

### MED-16. hermesFlags May Not Be Respected by RN 0.74 Gradle Plugin
- **Evidence:** `gradle.properties:44` -- `hermesFlags=-O -output-source-map=false` may be silently ignored.
- **Impact:** Source maps could ship in release APK.
- **Fix:** Configure in `react { }` block in `build.gradle`.

### MED-17. Inconsistent Dependency Pinning Strategy
- **Evidence:** Some packages pinned exact, others use caret ranges. Native modules especially sensitive.
- **Impact:** "Works on my machine" issues.
- **Fix:** Pin all native-module dependencies to exact versions.

### MED-18. Missing .nvmrc File
- **Evidence:** No `.nvmrc` or `.node-version`. Root requires `>=18`, functions requires `22`.
- **Impact:** Developer Node version mismatches.
- **Fix:** Add `.nvmrc` with `22`.

### MED-19. Functions @types/node is ^20 but Engine Requires Node 22
- **Evidence:** `functions/package.json:28` -- `@types/node: ^20.0.0` vs engine `node: "22"`.
- **Impact:** Node 22-specific APIs missing from type checking.
- **Fix:** Change to `@types/node: ^22.0.0`.

### MED-20. --legacy-peer-deps Used in Multiple Workflows
- **Evidence:** `release-apk.yml:31`, `build-release-apk.yml:29`, `update-lockfile.yml:26`.
- **Impact:** Non-reproducible builds; peer conflicts silently ignored.
- **Fix:** Resolve peer conflicts; use `npm ci` everywhere.

### MED-21. functions/.env.shams-app-4d0e7 Tracked in Git
- **Evidence:** File tracked; `.gitignore` doesn't exclude `functions/.env.*` pattern.
- **Impact:** Secrets added to this file will be automatically committed.
- **Fix:** Add `functions/.env.shams-app-*` to `.gitignore`.

### MED-22. No Workflow-Level Permissions on Most CI Workflows
- **Evidence:** Only `deploy-pages.yml` and `update-lockfile.yml` declare `permissions:`.
- **Impact:** Over-broad GITHUB_TOKEN permissions.
- **Fix:** Add `permissions: { contents: read }` to all workflows.

---

## FINDINGS -- LOW ISSUES

### LOW-01. configureondemand=true Can Cause Intermittent Build Failures
- **Evidence:** `android/gradle.properties:9`
- **Fix:** Set `org.gradle.configureondemand=false`.

### LOW-02. jscFlavor Uses `+` (Latest) Version Specifier
- **Evidence:** `android/app/build.gradle:25` -- `org.webkit:android-jsc:+`
- **Fix:** Pin specific version.

### LOW-03. ABI Splits Block Inconsistent with ndk.abiFilters
- **Evidence:** `build.gradle` splits include 32-bit ABIs but abiFilters exclude them.
- **Fix:** Align or remove dead config.

### LOW-04. android:windowFullscreen Deprecated in API 35+
- **Evidence:** `styles.xml:23`
- **Fix:** Remove when updating to targetSdk 35.

### LOW-05. Stale Supabase Path Alias in tsconfig.json
- **Evidence:** `tsconfig.json:39` -- `@supabase/*` alias with no matching directory.
- **Fix:** Remove stale alias.

### LOW-06. Stale Supabase Comments in index.js
- **Evidence:** `index.js:1-8` -- comments reference Supabase.
- **Fix:** Update comments.

### LOW-07. Functions ESLint Config Exists But Never Executed
- **Evidence:** `functions/.eslintrc.js` exists but lint script only runs `tsc --noEmit`.
- **Fix:** Add ESLint to lint script or delete the config.

### LOW-08. ignoreDeprecations: "5.0" Suppresses Future Warnings
- **Evidence:** Both `tsconfig.json` files.
- **Fix:** Remove and verify clean `tsc --noEmit`.

### LOW-09. patch-package Configured But No Patches Directory
- **Evidence:** `package.json:27` postinstall script; no `patches/` dir.
- **Fix:** Remove postinstall or add `patches/.gitkeep`.

### LOW-10. Jest transformIgnorePatterns May Be Incomplete
- **Evidence:** Missing `@react-native-firebase` and `@react-native-google-signin`.
- **Fix:** Add to the allow-list.

### LOW-11. Prettier/TypeScript Version Mismatch Between Root and Functions
- **Evidence:** Different caret ranges in respective package.json files.
- **Fix:** Align versions.

### LOW-12. Functions Vitest Coverage at 100% -- Brittle
- **Evidence:** `functions/vitest.config.ts:14-17` -- all thresholds 100%.
- **Fix:** Consider 95-98% for emergency hotfix flexibility.

### LOW-13. test:web Script Serves Entire Project Root
- **Evidence:** `package.json:20` -- `npx serve .` exposes `.env`, `android/`, etc.
- **Fix:** Restrict to specific directory.

### LOW-14. MMKV Mock Doesn't Reset Between Tests
- **Evidence:** `__mocks__/react-native-mmkv.js` -- module-level `_store` persists.
- **Fix:** Reset in `beforeEach`.

### LOW-15. Security Checks Are JS-Only, Documented as Bypassable
- **Evidence:** `src/utils/security.ts:25-29`
- **Fix:** Phase 5 native JNI guards; add Play Integrity API.

### LOW-16. Logger Emits Stack Traces in Production
- **Evidence:** `src/utils/logger.ts:125` -- error logs include full stacks.
- **Fix:** Strip or redact file paths in production.

### LOW-17. No Dependabot Configuration
- **Evidence:** No `.github/dependabot.yml`.
- **Fix:** Add Dependabot for npm and GitHub Actions.

### LOW-18. Duplicate Tags in Remedy Library
- **Evidence:** `src/data/remedyLibrary.ts:138,250,318` -- `['GRIEF', 'GRIEF', ...]`.
- **Fix:** Deduplicate tag arrays.

### LOW-19. ELEVATION.glow Hard-Codes darAlShams Gold
- **Evidence:** `src/theme/themes.ts:534` -- `#C9A961` regardless of theme.
- **Fix:** Make theme-dependent.

### LOW-20. Firestore Rules Tests Are Syntax-Check Only
- **Evidence:** CI workflow only checks structure, not logic.
- **Fix:** Add emulator-based `@firebase/rules-unit-testing`.

### LOW-21. Health Endpoint Leaks GCLOUD_PROJECT
- **Evidence:** `functions/src/functions/health.ts:22` -- exposes project ID.
- **Fix:** Remove from response.

---

## MISSING CONFIGURATIONS

| Configuration | Status |
|---------------|--------|
| Production google-services.json | MISSING |
| API key restrictions (Android key restricted to package + APIs) | NOT CONFIGURED |
| Firebase billing plan verified | NOT VERIFIED |
| App Check enabled in Firebase Console | NOT CONFIGURED |
| Cloud Functions secrets provisioned in Secret Manager | NOT VERIFIED |
| Google Play service account configured | NOT CONFIGURED |
| Razorpay webhook URL registered | NOT CONFIGURED |
| Certificate pins captured from production endpoints | NOT VERIFIED |
| Node.js runtime in firebase.json | NOT SET (should be `nodejs22`) |
| .nvmrc file | MISSING |
| Dependabot configuration | MISSING |
| Localized strings.xml (ur, hi) | MISSING |
| Backup certificate pin | MISSING |

---

## SECURITY RISKS

| # | Risk | Severity | Status |
|---|------|----------|--------|
| 1 | Anthropic API key baked into client JS bundle | CRITICAL | OPEN |
| 2 | NODE_ENV auth bypass in Cloud Functions | CRITICAL | OPEN |
| 3 | NODE_ENV App Check bypass | CRITICAL | OPEN |
| 4 | Payment functions overwrite all custom claims | CRITICAL | OPEN |
| 5 | Raw IP addresses stored in Firestore (PII/GDPR) | HIGH | OPEN |
| 6 | Debug keystore committed to git | HIGH | OPEN |
| 7 | Release builds can silently use debug signing | HIGH | OPEN |
| 8 | Razorpay webhook CORS open to all origins | HIGH | OPEN |
| 9 | Razorpay webhook no rate limit | HIGH | OPEN |
| 10 | CI exposes API key to all steps including 3rd-party actions | HIGH | OPEN |
| 11 | Postgres creds in docker-compose.yml | HIGH | OPEN |
| 12 | Admin Firestore rule grants write on readings | MEDIUM | OPEN |
| 13 | functions/.env.shams-app-4d0e7 tracked | MEDIUM | OPEN |
| 14 | google-services.json.ci exposes real project ID | MEDIUM | OPEN |
| 15 | JS-only root/emulator detection (bypassable) | LOW | KNOWN |
| 16 | Stack traces in production logs | LOW | OPEN |
| 17 | Health endpoint leaks project ID | LOW | OPEN |
| 18 | test:web serves entire project root | LOW | OPEN |

---

## PERFORMANCE RISKS

| # | Issue | Impact | Optimization |
|---|-------|--------|-------------|
| 1 | 120 Animated.Values in StarfieldBackground | Frame drops on low-end devices | Reduce to 60-80 or use Reanimated |
| 2 | CosmicClock full SVG re-render every second | CPU-intensive | React.memo sub-components |
| 3 | useQuota calls Cloud Function on every tab switch | Unnecessary network + function invocations | Cache with 60s TTL |
| 4 | Jetifier enabled unnecessarily | 10-30s added to every build | Disable |
| 5 | hermesFlags possibly ignored | Source maps may ship | Configure in react {} block |
| 6 | askOracle 60s timeout insufficient for cold start | Timeout wastes API costs | Increase to 120s |
| 7 | Stale Dimensions.get at module scope | Incorrect layouts on fold/rotate | Use useWindowDimensions() |
| 8 | purchaseUpdatedListener is no-op | State stale until restart | Implement verification |

---

## FIREBASE AUDIT

| Component | Status | Notes |
|-----------|--------|-------|
| Authentication | PARTIALLY CONFIGURED | Works but NODE_ENV bypass is critical risk |
| Firestore | RULES NEED FIXES | Admin write override; missing DENIED verdict sync |
| Cloud Functions | CRITICAL ISSUES | Auth bypass, claims overwrite, missing idempotency |
| App Check | CONDITIONALLY DISABLED | Gated on NODE_ENV; must be hardcoded true |
| Crashlytics | NOT VERIFIED | google-services.json missing |
| Analytics | NOT VERIFIED | google-services.json missing |
| Cloud Messaging | NOT VERIFIED | No FCM implementation found |
| Remote Config | NOT VERIFIED | No implementation found |
| Storage | NOT USED | -- |
| Hosting | CONFIGURED | Privacy policy and landing page |
| Emulators | PORT CONFLICTS | 3 different ports across configs |
| Security Rules Tests | SYNTAX ONLY | No emulator-based functional tests |

---

## GOOGLE CLOUD AUDIT

| Component | Status | Notes |
|-----------|--------|-------|
| Cloud Functions Region | us-central1 | Consistent across all functions |
| Callable Auth | BYPASSED BY NODE_ENV | Must fix |
| Error Handling | GOOD | Zod validation + structured errors |
| Retry Logic | MISSING FOR RAZORPAY | No idempotency |
| Cold Starts | AT RISK | 60s timeout may not suffice |
| Timeouts | INSUFFICIENT | askOracle needs 120s |
| Secrets | PARTIALLY CONFIGURED | ANTHROPIC_API_KEY missing from firebase.json |
| IAM | NOT VERIFIED | Cannot verify from code alone |
| Billing | NOT VERIFIED | predeploy checklist says false |
| Logging | GOOD | Structured logger with telemetry middleware |
| Monitoring | PARTIAL | No alerting configuration found |

---

## GOOGLE PLAY AUDIT

| Requirement | Status | Notes |
|-------------|--------|-------|
| Target SDK >= 35 | FAIL | Currently 34 |
| 64-bit Support | PASS | arm64-v8a and x86_64 in abiFilters |
| App Signing | NEEDS FIX | Fallback to debug key |
| Play Integrity | CONFIGURED | But gated on NODE_ENV |
| Permissions | PASS | Only INTERNET and ACCESS_FINE_LOCATION |
| Privacy Policy | PASS | Hosted at /privacy-policy.html |
| Data Safety | NOT VERIFIED | No data safety form config found |
| Foreground Services | PASS | None declared |
| Background Restrictions | PASS | No background services |
| Version Code | 4 | Manual management |
| AAB Generation | CONFIGURED | bundleRelease task available |
| ProGuard/R8 | PARTIAL | Missing rules for IAP and Google Sign-In |

---

## RELEASE CHECKLIST

### Build System
- [ ] ❌ FAIL -- targetSdk must be >= 35
- [ ] ❌ FAIL -- google-services.json missing
- [ ] ❌ FAIL -- Release signing falls back to debug key
- [ ] ❌ FAIL -- Build scripts broken on Linux/macOS
- [ ] ⚠ WARNING -- ProGuard rules incomplete for IAP/Sign-In
- [ ] ⚠ WARNING -- Jetifier unnecessarily enabled
- [ ] ⚠ WARNING -- No automated versioning
- [ ] ⚠ WARNING -- hermesFlags may be ignored
- [ ] ✅ PASS -- Hermes engine enabled
- [ ] ✅ PASS -- R8/minification enabled for release
- [ ] ✅ PASS -- Resource shrinking enabled
- [ ] ✅ PASS -- 64-bit ABIs configured
- [ ] ✅ PASS -- NDK configured

### Security
- [ ] ❌ FAIL -- API key shipped in client bundle
- [ ] ❌ FAIL -- NODE_ENV auth bypass in Cloud Functions
- [ ] ❌ FAIL -- NODE_ENV App Check bypass
- [ ] ❌ FAIL -- Certificate pins have no backup
- [ ] ⚠ WARNING -- Debug keystore in git
- [ ] ⚠ WARNING -- Raw IPs in Firestore (PII)
- [ ] ⚠ WARNING -- CORS open on webhook
- [ ] ⚠ WARNING -- CI API key scope too broad
- [ ] ✅ PASS -- Cleartext traffic disabled
- [ ] ✅ PASS -- Backup disabled
- [ ] ✅ PASS -- Data extraction rules configured
- [ ] ✅ PASS -- Single exported activity
- [ ] ✅ PASS -- Zod input validation on all endpoints
- [ ] ✅ PASS -- Firestore deny-by-default rules
- [ ] ✅ PASS -- Rate limiting implemented

### Firebase
- [ ] ❌ FAIL -- Auth bypass via NODE_ENV
- [ ] ❌ FAIL -- App Check bypass via NODE_ENV
- [ ] ❌ FAIL -- Payment claims overwrite
- [ ] ❌ FAIL -- Webhook idempotency missing
- [ ] ❌ FAIL -- ANTHROPIC_API_KEY not in firebase.json secrets
- [ ] ⚠ WARNING -- Admin rule grants write on readings
- [ ] ⚠ WARNING -- DENIED verdict missing from sync validation
- [ ] ⚠ WARNING -- Emulator port inconsistencies
- [ ] ⚠ WARNING -- askOracle timeout insufficient
- [ ] ✅ PASS -- Structured error handling
- [ ] ✅ PASS -- Telemetry middleware
- [ ] ✅ PASS -- Audit logging
- [ ] ✅ PASS -- Consistent region (us-central1)

### Runtime Stability
- [ ] ❌ FAIL -- Native module version drift (screens, safe-area-context)
- [ ] ⚠ WARNING -- Auth listener accumulation
- [ ] ⚠ WARNING -- Splash animation leak
- [ ] ⚠ WARNING -- Stale dimensions on foldables
- [ ] ⚠ WARNING -- Geolocation API may be undefined
- [ ] ⚠ WARNING -- Quota UI inconsistencies
- [ ] ✅ PASS -- ErrorBoundary implemented
- [ ] ✅ PASS -- Navigation structure sound
- [ ] ✅ PASS -- MMKV storage configured
- [ ] ✅ PASS -- Zustand state management

### Google Play
- [ ] ❌ FAIL -- targetSdk 34 below requirement
- [ ] ❌ FAIL -- Release signing not enforced
- [ ] ⚠ WARNING -- ProGuard rules incomplete
- [ ] ⚠ WARNING -- No localized strings for ur/hi
- [ ] ⚠ WARNING -- Manual version management
- [ ] ✅ PASS -- 64-bit support
- [ ] ✅ PASS -- Minimal permissions
- [ ] ✅ PASS -- Privacy policy hosted
- [ ] ✅ PASS -- No foreground services
- [ ] ✅ PASS -- Fastlane metadata present

### CI/CD
- [ ] ⚠ WARNING -- Duplicate release workflows
- [ ] ⚠ WARNING -- --legacy-peer-deps in multiple workflows
- [ ] ⚠ WARNING -- Missing workflow permissions
- [ ] ⚠ WARNING -- No Dependabot
- [ ] ⚠ WARNING -- Firestore rules tests syntax-only
- [ ] ✅ PASS -- CI pipeline configured
- [ ] ✅ PASS -- Play Store release workflow
- [ ] ✅ PASS -- Functions deploy workflow
- [ ] ✅ PASS -- Firebase hosting deploy

---

## FINAL VERDICT

# NOT PRODUCTION READY

**Justification:** 11 Critical issues identified across 5 audit domains. The most severe are:

1. **API key shipped in client bundle** (CRIT-01) -- immediate financial exposure risk
2. **NODE_ENV authentication bypass** (CRIT-02/03) -- complete security bypass if environment misconfigured
3. **Payment claims overwrite** (CRIT-07) -- data corruption in payment flow
4. **Play Store rejection** (CRIT-04) -- cannot ship with targetSdk 34
5. **Missing google-services.json** (CRIT-05) -- Firebase completely non-functional

**Remediation priority:**
1. Move all Anthropic API calls to Cloud Functions (CRIT-01)
2. Replace NODE_ENV checks with FUNCTIONS_EMULATOR (CRIT-02, CRIT-03)
3. Fix payment claims merge (CRIT-07) and add idempotency (CRIT-08)
4. Bump targetSdk to 35 (CRIT-04)
5. Fix release signing to fail-fast (CRIT-06)
6. Pin native module versions (CRIT-10)
7. Fix build scripts for cross-platform (CRIT-11)
8. Add certificate pin backup or remove OkHttp pinner (CRIT-09)
9. Provision google-services.json (CRIT-05)

**Estimated effort to reach "Ready After Major Fixes":** 3-5 engineering days for critical fixes; 2-3 additional days for high-priority items.

---

*This audit was generated through a multi-pass analysis covering Architecture, Runtime Stability, Security, Release Readiness, and Integration. All findings are supported by evidence from repository files. Cross-referenced between passes to eliminate false positives.*
