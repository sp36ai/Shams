# Phase 6B — Production Infrastructure Reconnaissance

Read-only reconnaissance, per the separately issued Phase 6B
Reconnaissance Authorization. Baseline: `b884452` (the 6A-R1 closure
checkpoint). No production code, test, Firestore rule, deployment
configuration, dependency, or payment file was modified. No remediation
was performed. `git status --porcelain` is empty at the start and end of
this reconnaissance.

## 1. Methodology

Every claim below is traced to a specific file, line, or command output —
not asserted from documentation or prior-phase summaries. Where a claim
could not be independently verified from this environment (no live
credentials to the deployed Firebase project, no access to GitHub's own
secret store or branch-protection configuration), it is explicitly listed
as **not verified** in §14 rather than assumed either way. Findings are
classified into exactly one of:

- **Confirmed defect** — demonstrated, reproducible, incorrect behavior.
- **Confirmed weakness** — a real, evidenced gap in a control (missing
  rate limit, missing test coverage, inconsistent pattern application),
  not by itself a demonstrated exploit.
- **Documented boundary** — a limitation the codebase's own comments or
  architecture already disclose and appear to accept deliberately.
- **Untested external dependency** — something this reconnaissance could
  not verify because it depends on state outside this repository (a live
  deployed project, a third-party service, a CI secret store).

## 2. Complete live callable / endpoint inventory

Every export from `functions/src/index.ts`, independently re-confirmed
against each function's own source, not copied from the file's own
header comment:

| Export | Trigger | Auth | App Check | Rate limit | Zod validation | Purpose |
|---|---|---|---|---|---|---|
| `askWatchOracle` | `onCall` | `verifyAuth` | enforced (prod) | yes | strict | Cast + judge a reading |
| `discussReading` | `onCall` | `verifyAuth` | enforced (prod) | yes | strict | Follow-up conversation |
| `activateTrial` | `onCall` | `verifyAuth` | enforced (prod) | **no** | n/a (no body fields) | Register the free trial |
| `getQuota` | `onCall` | `verifyAuth` | enforced (prod) | **no** | n/a (read-only) | Report quota status |
| `syncReadings` | `onCall` | `verifyAuth` | enforced (prod) | **no** | strict | Bulk-upsert local readings |
| `deleteReading` | `onCall` | `verifyAuth` | enforced (prod) | **no** | strict | Delete one reading, owner-only |
| `deleteAccount` | `onCall` | `verifyAuth` | enforced (prod) | yes | n/a (no body fields) | Full account + data deletion |
| `verifyGooglePlayPurchase` | `onCall` | `verifyAuth` | enforced (prod) | yes | strict | Verify IAP, grant entitlement |
| `razorpayWebhook` | `onRequest` | HMAC signature (no Firebase Auth) | n/a | yes (per-IP, 30/min) | manual field checks | Payment webhook → entitlement |
| `health` | `onRequest` | none (intentional) | n/a | none | n/a | Liveness/readiness probe |
| `setAdminClaim` | `onCall` | `request.auth.token.admin === true` (manual, not `verifyAuth`) | enforced (prod) | **no** | manual field checks (no Zod) | Grant/revoke admin claim |
| `classifyQuestion` | `onCall` | `verifyAuth` | enforced (prod) | yes | n/a | AI-based question gate — **confirmed still unreferenced by any client code** (re-checked: `grep -rln "classifyQuestion" src/` returns only the unrelated deterministic matcher file) |
| `inferProfile` | `onCall` | `verifyAuth` | enforced (prod) | yes | manual field checks (no Zod) | Onboarding profile inference |

All 11 `onCall` exports apply `enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true'` identically — confirmed by direct grep across every file, not sampled. `razorpayWebhook`/`health` are `onRequest`, outside the App Check callable mechanism by design.

## 3. Authentication and authorization

- `verifyAuth()` (`functions/src/middleware/auth.ts`) is the single
  shared authentication primitive used by every `onCall` export except
  `setAdminClaim`, which manually inlines an equivalent
  `if (!request.auth || ...)` check rather than reusing `verifyAuth()` —
  functionally equivalent (both reject when `request.auth` is absent),
  but a style inconsistency worth noting: a future change to
  `verifyAuth()`'s behavior would not automatically apply to
  `setAdminClaim`. **Confirmed weakness (P3), not a defect** — both
  paths currently enforce the same thing.
- `verifyAuth()`'s emulator bypass (`FUNCTIONS_EMULATOR === 'true'`
  returns a synthetic `dev-test-user` identity) is gated on an
  environment variable Cloud Functions itself sets, not client-controlled
  — confirmed this cannot be spoofed by a request, only by the actual
  deployment environment. Whether `FUNCTIONS_EMULATOR` is ever
  accidentally set `true` in a real deployed environment is a deployment-
  configuration question this reconnaissance cannot verify from the
  repository alone — **untested external dependency**, §14.
- `firestore.rules`' `isAdmin()` and `functions/src/functions/admin.ts`'s
  authorization both key off the same custom claim (`request.auth.token.admin`),
  confirmed consistent — no second, divergent admin-check mechanism
  exists.
- Ownership checks specific to `syncReadings`/`deleteReading`/`discussReading`
  were independently re-verified as part of Phase 6A-R1
  (`docs/audit/PHASE_6A_R1_REVIEW.md`) and are not re-litigated here —
  this reconnaissance re-confirms only that no NEW client-influenceable
  write path has appeared since that review (§2's inventory above is
  unchanged from 6A-F1's own, with no new callable added).

## 4. App Check enforcement — server-side vs. client-side

**Server-side: consistent (§2).** All 11 callables enforce App Check
identically in production.

**Client-side: inconsistent — confirmed weakness (P3).** The client must
`await ensureAppCheckReady()` (`src/firebase/appCheck.ts`) before a
callable invocation to avoid a real, documented race: on a fast cold
start, Firebase Auth's token is typically already available while Play
Integrity's first App Check exchange is not, so a callable fired in that
window is sent with no App Check token attached — not a bypass (the
server-side enforcement still rejects it), a **reliability** failure the
codebase's own comments describe having caused real production symptoms
("please sign in" shown to an already-signed-in user).

Traced every client-side `httpsCallable()` call site
(`grep -rln "httpsCallable" src/`):

| Call site | Callable | Awaits `ensureAppCheckReady()`? |
|---|---|---|
| `src/firebase/watchOracle.ts` | `askWatchOracle` | **yes** |
| `src/firebase/oracleDiscussion.ts` | `discussReading` | **yes** |
| `src/firebase/account.ts` | `deleteAccount` | **no** |
| `src/firebase/trial.ts` | `activateTrial` | **no** |
| `src/hooks/useQuota.ts` | `getQuota` | **no** |
| `src/hooks/usePurchase.ts` | `verifyGooglePlayPurchase` | **no** |
| `src/screens/OnboardingScreen.tsx` | (profile/classification call) | **no** |

Only the two call sites that the codebase's own comments describe having
already suffered this exact bug were fixed; the fix was not applied
systemically to the other five. Practical severity is narrow — the race
window is specifically the first 1-2 seconds after a cold app launch,
and several of the unguarded call sites (`deleteAccount`, a deep-menu
action) are unlikely to be invoked in that window — but `activateTrial`
(a plausible early-onboarding action) and `usePurchase`'s
`verifyGooglePlayPurchase` are more plausible candidates for the same
symptom recurring.

## 5. Firestore rules and Admin SDK write/read surfaces

Full text of `firestore.rules` read and traced collection-by-collection
(11 `match` blocks plus the deny-all catch-all). Findings:

- **Deny-by-default confirmed structurally**: the final
  `match /{document=**} { allow read, write, delete: if false; }` catches
  every collection not explicitly matched above it.
- **Every privileged write path is `allow write: if false`** (`quotas`,
  `trials`, `rateLimits`, `auditLogs`, `securityEvents`, `purchaseTokens`,
  `webhookEvents`, `idempotencyKeys`) — confirmed these are written
  exclusively via the Admin SDK from the corresponding Cloud Functions
  (cross-checked against §2's inventory; no client-reachable path writes
  any of these collections).
- **`hasNoPrivilegedFields()`** on `/users/{userId}` blocks a client from
  setting `plan`, `planExpiry`, `monthlyQuota`, `isPremium`, `admin`, or
  `used` via a direct client write — confirmed the field list matches
  every privileged field this reconnaissance found referenced elsewhere
  in the codebase (`config.ts`'s `PlanTier`, custom claims shape).
- **`/readings/{readingId}`**: client `create`/`update` both `false` —
  the ONLY way a reading document is created or its content fields
  changed is via a Cloud Function (Admin SDK, bypasses these rules
  entirely by Firestore's own platform design — the rules therefore
  provide zero protection against `syncReadings`'s own logic, which is
  exactly why 6A-R1's ownership-check fix had to live in application
  code, not in a rule).
- **Confirmed weakness (P2), not a defect**: `firestore.rules.test.ts` —
  a real, well-constructed behavioral test suite using
  `@firebase/rules-unit-testing` against a live Firestore emulator,
  exercising `isOwner`/`isAdmin`/deny-by-default per collection — exists
  in the repository and is wired to a dedicated `npm run test:rules`
  script, but **the CI workflow that runs on every push/PL touching
  `firestore.rules` (`.github/workflows/firestore-rules-tests.yml`) does
  NOT execute this test suite.** It runs only a superficial shell-script
  check: file exists, contains the literal strings `rules_version = '2'`
  and `service cloud.firestore`, and has balanced brace counts. None of
  this would catch a real authorization-logic regression — e.g.,
  `allow read: if isOwner(userId) || isAdmin();` accidentally changed to
  `allow read: if true;` would still pass every check this workflow
  actually runs. The real behavioral suite only runs if a developer
  invokes `npm run test:rules` locally (which requires the Firestore
  emulator, not present in this reconnaissance's own environment — the
  suite's own assertions were read but not executed here; see §14).

## 6. Callable validation and authorization boundaries

- 9 of 11 callables validate their input via the shared, strict Zod
  schemas in `middleware/validate.ts` (confirmed: `AskWatchOracleSchema`,
  `DiscussReadingSchema`, `SyncReadingsSchema`, `DeleteReadingSchema`,
  `VerifyGooglePlaySchema`, all `.strict()`).
- **Confirmed weakness (P3)**: `setAdminClaim` and `inferProfile` do not
  use this pattern — both manually cast `request.data` and perform ad
  hoc truthy/type checks instead. Neither was found to be exploitable
  from this: `setAdminClaim` is gated on the caller's own pre-existing
  admin claim before `request.data` is ever read (a non-admin cannot
  reach the parsing code at all); `inferProfile` bounds its inputs
  manually (`.slice(0,3)`, `.slice(0,200)`) and writes nothing to
  Firestore. Recorded as a pattern-consistency gap, not a live defect.

## 7. Quotas, rate limiting, abuse controls, idempotency

**Confirmed weakness (P2)** — rate limiting is inconsistently applied.
`enforceRateLimit()` is called by `account.ts`, `askWatchOracle.ts`,
`classifyQuestion.ts`, `discussReading.ts`, `inferProfile.ts`, and
`payments/googlePlay.ts` — confirmed by direct grep, not all 11
callables. **`activateTrial`, `admin.ts` (`setAdminClaim`), `quota.ts`
(`getQuota`), and both exports of `readings.ts` (`syncReadings`,
`deleteReading`) have no per-user rate limit at all.** `syncReadings`
and `deleteReading` are the most consequential of these: both perform
real Firestore reads/writes per call (`syncReadings` up to 100 documents
via a batch write plus, since 6A-R1, a `getAll()` ownership pre-check;
`deleteReading` a `.get()` + `.delete()`), and an authenticated,
App-Check-passing caller could invoke either in an uncapped loop,
producing genuine backend cost/resource pressure — not a data-exposure
issue (ownership checks remain correct per 6A-R1), a resource-abuse gap.
`getQuota` and `activateTrial` are lower-severity (2 reads; an
idempotent existence-check respectively) but share the same structural
gap. `setAdminClaim`'s caller pool is already restricted to existing
admins, narrowing its practical exposure.

**Idempotency** — re-confirmed from source, not merely cited:
`askWatchOracle`/`discussReading` use `utils/idempotency.ts`'s
claim/complete/release pattern, scoped to `${userId}__${requestId}`, with
`requestId` optional (a pre-idempotency client still works, without
deduplication). `razorpayWebhook` uses a separate,
`webhookEvents/{eventType}:{id}` transactional claim
(`claimWebhookEvent()`), confirmed applied to both `payment.captured`
and `subscription.activated` (6A-R1 review already verified this).
`enforceRateLimit()` itself (`middleware/rateLimit.ts`) is a Firestore
transaction (`db.runTransaction`), confirmed atomic — no separate
finding here.

## 8. Payments, entitlements, and webhook trust boundaries

Re-confirmed, not restated: `verifyGooglePlayPurchase` binds a purchase
token to its redeeming account via a transactional first-claim
(`purchaseTokens/{hash(token)}`), rejecting a second account's attempt
to redeem an already-bound token. `razorpayWebhook`'s entitlement
write-ordering defect (`upgradePlan()` writing before verifying the
target uid) was found and closed under 6A-R1
(`docs/audit/PHASE_6A_R1_CLOSURE.md`) — not reopened here.

**Documented boundary, carried forward unresolved (not a new finding —
restated per this reconnaissance's own scope, which explicitly names
it):** `notes.userId` in a Razorpay webhook payload is still not bound
to a verified payer/order relationship, because no order-creation
integration exists anywhere in this repository
(`docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md` §5, re-confirmed
again this pass: `grep -rln "razorpay"` across `src/`, `package.json`,
and the Android project returns nothing beyond a deploy-config
reference).

## 9. Secrets, configuration, and environment separation

- **Confirmed clean**: no `.env`, keystore, service-account JSON, or
  other credential file is committed to the repository
  (`git ls-files | grep -iE "\.env$|keystore|google-services\.json$|serviceAccount|\.pem$|\.key$"`
  returns only `.env.example`, `functions/.env.example`, and
  `functions/.env.shams-app-4d0e7` — the last one read in full and
  confirmed to contain exactly one non-secret parameter,
  `RATE_LIMIT_PER_MINUTE=10`, matching its own comment's claim).
- Real secrets (`RAZORPAY_WEBHOOK_SECRET`, `GOOGLE_PLAY_CLIENT_EMAIL`,
  `GOOGLE_PLAY_PRIVATE_KEY`, `ANTHROPIC_API_KEY`) are declared via
  `defineSecret()` (`config.ts`) and bound per-function in `firebase.json`'s
  `functions[0].secrets` array — confirmed the two lists match exactly.
- Android release signing and the Play Store service-account JSON are
  supplied via GitHub Actions secrets (`BASE64_KEYSTORE`/`SHAMS_UPLOAD_KEYSTORE`,
  `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_SERVICES_JSON`) —
  confirmed referenced only as `${{ secrets.* }}` in workflow YAML, never
  hardcoded. The actual GitHub Secrets store's contents/access
  configuration cannot be inspected from this repository — **untested
  external dependency**, §14.
- **Documented boundary, confirmed**: `functions/src/config.ts`'s
  `FREE_LIMIT`/`TRIAL_DAILY_LIMIT` are both set to 50, with an explicit
  comment stating this is "TEMPORARY — raised from 3/5 to 50/50 for
  internal testing... Revert both this file and
  src/stores/quotaStore.ts to 3/5 once testing concludes." Confirmed
  the client-side `quotaStore.ts` mirror value was not independently
  re-verified in this pass (not required by this reconnaissance's own
  scope items, but flagged since it is exactly the kind of "accepted
  configuration state that needs an explicit owner decision" this
  project's discipline has repeatedly surfaced elsewhere — e.g. P5A-2).
- **Environment separation**: exactly one real Firebase Cloud project
  exists (`shams-app-4d0e7`, `.firebaserc`'s only alias, "default"; also
  the sole `projectId` in `firebase.json`). `firebase.test.json` (used
  for the rules-test emulator run) and `firebase-emulator.json` (local
  dev) both declare emulator ports only, no distinct project id — local
  development runs emulators against this same project id, not a
  separate staging cloud project. There is no evidence anywhere in this
  repository of a second, staging Firebase project. **Confirmed
  weakness/documented boundary (P2)**: every automated deploy (§10)
  therefore targets the single production project directly; there is no
  environment gate a change passes through before reaching real user
  data.

## 10. Deployed-vs-repository drift

This reconnaissance has **no live credentials to the deployed Firebase
project** in this environment, so it cannot directly compare deployed
Cloud Functions/Firestore rules/config against the committed source at
this exact moment — this is stated plainly as an **untested external
dependency** (§14), not glossed over.

What could be independently confirmed from the repository itself:

- **`deploy-functions.yml`** deploys to production
  (`--project shams-app-4d0e7`) automatically on every push to `main`
  touching `functions/**` or `src/astrology/**` — no manual approval gate
  or separate environment is referenced in the workflow file. A
  post-deploy health check (`curl` against the deployed `health`
  endpoint) is the only automated verification that the deploy actually
  succeeded.
- **`release-play-store.yml`** builds and uploads an Android release
  automatically on every push to `main` touching `android/**`, `src/**`,
  or `package.json` — but confirmed (not assumed) to default to the
  `internal` Play Store track (`tracks: ${{ github.event.inputs.track ||
  'internal' }}`) for a plain push trigger; a `production` release
  requires an explicit, manually-dispatched `workflow_dispatch` naming
  that track. This is a genuine, evidenced safety control, not a gap.
- **Historical evidence of real drift-verification concern**: `origin/main`'s
  own recent history includes commits titled *"Force Cloud Functions
  redeploy to verify mystical Oracle prompt deployment,"* *"Trigger Play
  Store release retry after API recovery,"* and *"Trigger Play Store and
  Functions deployment retry"* — trivial/empty commits made specifically
  to re-trigger CI/CD after a suspected or confirmed deployment issue.
  This confirms deployment reliability and deployed-state uncertainty
  have been real, recurring operational concerns in this project's
  actual history, not a hypothetical risk this reconnaissance is
  inventing.
- **Engine-mirror drift** (`functions/src/engine/` vs. `src/astrology/`)
  is already covered by its own, separate, CI-enforced check
  (`verify-engine-sync`, confirmed present in `ci.yml`'s
  `functions-quality` job) and by the runtime `vitest` `globalSetup`
  hook established in Phase 5B-R — not re-litigated here.

## 11. Android production build, signing, and release configuration

- **Confirmed correct, not a gap**: `android/app/build.gradle`'s release
  `buildType` throws a `GradleException` — failing the build outright —
  if a release Gradle task is invoked (`assembleRelease`/`bundleRelease`)
  without the upload-signing properties (`SHAMS_UPLOAD_STORE_FILE`, etc.)
  present. The apparent fallback to debug signing
  (`signingConfig hasReleaseSigning ? signingConfigs.release :
  signingConfigs.debug`) is unreachable for any genuine release-task
  invocation, since the exception fires first — traced precisely, not
  assumed from the comment alone.
- `debuggable false` and minification/resource-shrinking are both
  confirmed set for the release build type; no JS source map is bundled
  in release builds.
- No release keystore or its passwords are committed
  (`git ls-files android/` returns no `.keystore`/`.jks` file); the debug
  keystore used for CI/E2E builds is generated fresh in `ci.yml`
  (`keytool -genkeypair`, not committed either).
- **Untested external dependency**: whether the actual GitHub Secrets
  (`BASE64_KEYSTORE`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`) are correctly
  scoped (e.g., environment-restricted, limited to specific branches)
  cannot be verified from this repository.

## 12. Logging, monitoring, error exposure, and operational safeguards

- **Confirmed real, live monitoring**: `@react-native-firebase/crashlytics`
  is a genuine dependency (`package.json`), used at 8 call sites
  (`grep -rl "crashlytics" src/`), including the App Check init/token
  failure paths (`src/firebase/appCheck.ts`) — these were themselves
  found and fixed in this codebase's own prior history (per that file's
  own doc comments) specifically because an earlier version silently
  swallowed these exact failures with no Crashlytics record at all.
- **Confirmed stale reference, not live monitoring (P3)**: `SENTRY_DSN`
  appears in `.env.example` and is referenced in `src/utils/logger.ts`'s
  comments (*"In PROD, it buffers for Sentry"*, a literal commented-out
  `// Phase 5: Sentry.addBreadcrumb(...)` line) — but `grep -rn "sentry"
  package.json src/` (excluding the comments themselves) confirms Sentry
  is not an actual dependency and is never called anywhere. This is the
  same class of documentation-vs-reality gap this project's audit trail
  has repeatedly found and recorded elsewhere (e.g. P5A-8, P5B-3) — the
  comment's own claim ("wired in Phase 5") did not happen; Crashlytics is
  the actual, sole live error-monitoring tool.
- **Server-side logging** (`functions/src/utils/logger.ts`) is
  structured JSON to stdout (Cloud Logging auto-ingests this), with an
  explicit, stated policy against logging raw PII — question text is
  FNV-1a hashed before logging, user ids (opaque UUIDs) are logged
  freely. Confirmed consistent across every callable this reconnaissance
  read.
- **Confirmed weakness (P3)**: `middleware/telemetry.ts`'s `measure()`
  wrapper has no `try`/`finally` — if the wrapped function throws, the
  `logger.info('perf:${name}', ...)` duration line never executes. A
  failed call is therefore invisible to this specific performance-timing
  instrument (though the underlying function's own `logger.warn`/`error`
  calls still fire independently) — a narrow observability gap, not a
  security issue.
- No request-correlation id is threaded through log lines beyond
  `userId` — Cloud Functions/Cloud Logging attaches its own per-invocation
  execution id at the platform level (not verifiable from this repository
  alone; standard GCP behavior), so multi-line correlation for a single
  request is possible via that platform mechanism even without an
  application-level trace id — not a confirmed gap, recorded for
  completeness.

## 13. Dependencies capable of changing security boundaries

`npm audit --omit=dev` run in both the app root and `functions/` (both
read-only, no `--fix`, nothing installed or changed):

- **App root: 33 vulnerabilities (1 critical, 11 high, 20 moderate, 1
  low).** All of the critical/high findings trace to a single transitive
  chain: `xmldom` (`<=0.6.0`, multiple advisories including
  GHSA-crh6-fp67-6883, CVSS 9.8) pulled in via `@expo/plist`. Traced
  reachability: `@expo/plist` is Expo build-tooling (`.plist`/manifest
  parsing), not a dependency exercised by the shipped app's own runtime
  code or by the deployed Cloud Functions — exploitation would require a
  malicious file being parsed by local/CI build tooling, not something a
  remote attacker or end user reaches through the running production
  app. **Confirmed weakness, not a confirmed live defect** — real, and
  worth remediating, but not reachable from any production request path
  this reconnaissance traced.
- **`functions/`: 12 moderate vulnerabilities**, all tracing to
  `teeny-request`/`retry-request` transitively via `@google-cloud/storage`
  — a Google Cloud SDK dependency. This chain IS part of the actual
  deployed Functions runtime dependency tree, unlike the app-root
  finding above — moderate severity, no further detail captured in this
  pass beyond the advisory count; a full advisory-by-advisory read was
  not performed (see §14).
- `npm audit fix --force` was **not** run (would modify
  `package-lock.json`/`functions/package-lock.json`, explicitly
  prohibited by this authorization's MUST NOT list) — this reconnaissance
  only observed the current state.

## 14. Explicitly not verified

- The actual, currently-deployed state of Cloud Functions, Firestore
  rules, and Remote Config/params in the live `shams-app-4d0e7` project
  — this environment has no credentials to query it. §10's findings are
  necessarily limited to what the deploy pipeline's own configuration
  can establish, not a live comparison.
- GitHub Actions' own secret store contents, access scoping, and branch
  protection rules for `main` (required reviewers, required status
  checks) — not inspectable from repository contents alone.
- Whether `FUNCTIONS_EMULATOR` could ever be unintentionally `true` in a
  real deployed Cloud Functions instance — a platform/deployment
  question, not a repository-code question.
- `firestore.rules.test.ts`'s actual pass/fail result — read in full and
  found well-constructed, but not executed (would require a live
  Firestore emulator not available in this reconnaissance's own
  environment); its CI non-execution (§5) is confirmed, but the
  suite's own current correctness against the current `firestore.rules`
  is not independently re-confirmed by running it.
- The 12 moderate `functions/` dependency advisories (§13) were counted
  and their package chain identified, but not individually read for
  CVSS/reachability detail the way the app-root critical/high findings
  were.
- Whether `src/stores/quotaStore.ts`'s client-side quota constants still
  mirror `functions/src/config.ts`'s temporarily-raised 50/50 values
  (§9) was not independently re-checked in this pass.
- Cost/billing exposure from the missing rate limits (§7) in real
  production traffic terms (this reconnaissance establishes the gap
  exists in code, not its financial magnitude).

## 15. Hard-stop determination

**No hard-stop condition was triggered.** None of the findings above
constitute: a P0/P1 security or authorization failure; cross-user data
exposure or mutation (6A-R1 already closed the one confirmed instance of
this class, and this reconnaissance found no new one); an
authentication/App Check bypass (the App Check gap in §4 is a
reliability race, not a bypass — server-side enforcement is unweakened);
unauthorized entitlement/payment mutation (6A-R1 closed the one
confirmed instance; the residual Razorpay boundary in §8 is a disclosed,
carried-forward limitation, not a newly demonstrated mutation path);
production secret exposure (§9 confirmed none committed); an exploitable
Admin SDK trust-boundary failure; a deployed callable permitting
unauthorized privileged behavior (`setAdminClaim` remains gated on a
pre-existing admin claim); or material deployed-vs-source divergence
affecting security (§10's findings are about deploy-pipeline gates and
historical reliability concerns, not a demonstrated current divergence).

This reconnaissance therefore ran to completion across its full
authorized scope rather than stopping partway.

## 16. Summary of findings by severity

| # | Finding | Area | Severity | Classification |
|---|---|---|---|---|
| 1 | `firestore.rules.test.ts` never executed in CI — only a superficial syntax check runs | §5 | P2 | Confirmed weakness |
| 2 | Rate limiting missing on `syncReadings`, `deleteReading`, `activateTrial`, `getQuota`, `setAdminClaim` | §7 | P2 | Confirmed weakness |
| 3 | No staging Firebase project — every automated deploy targets production directly | §9, §10 | P2 | Documented boundary / confirmed weakness |
| 4 | App-root `npm audit`: 1 critical + 11 high, all via `@expo/plist`→`xmldom`, build-tooling only, not production-request-reachable | §13 | P2 (real, not live-reachable) | Confirmed weakness |
| 5 | `functions/` `npm audit`: 12 moderate, via `@google-cloud/storage`'s transitive deps, in the actual deployed runtime tree | §13 | P3 | Confirmed weakness |
| 6 | App Check readiness not awaited at 5 of 7 client callable-invocation sites | §4 | P3 | Confirmed weakness |
| 7 | `setAdminClaim`/`inferProfile` bypass the shared Zod validation pattern | §6 | P3 | Confirmed weakness |
| 8 | `FREE_LIMIT`/`TRIAL_DAILY_LIMIT` temporarily raised to 50/50, owner revert decision still pending | §9 | P3 | Documented boundary (already self-disclosed in code) |
| 9 | Sentry referenced in comments/env but never actually integrated; Crashlytics is the real tool | §12 | P3 | Documented boundary (stale reference) |
| 10 | `measure()` telemetry wrapper has no try/finally — a thrown call logs no duration line | §12 | P3 | Confirmed weakness |
| 11 | `verifyAuth()`/`setAdminClaim` auth-check style inconsistency (functionally equivalent) | §3 | P3 | Confirmed weakness |
| — | Razorpay `notes.userId` payer-binding boundary | §8 | — | Documented boundary, already tracked (6A-F1/6A-R1) — restated, not new |

No P0 or P1 finding was established anywhere in this reconnaissance's
scope.

## 17. Recommended next authorization(s)

Per this authorization's own sequencing rule, none of the following is
authorized by this document — each would need its own narrowly scoped
authorization, in whatever order the project owner chooses:

1. Wire the real `firestore.rules.test.ts` suite into CI (replace or
   supplement the current syntax-only check) — closes finding #1, the
   only finding this reconnaissance would itself flag as worth
   prioritizing first, since it is a gap in the safety net around every
   other Firestore-security claim this and prior phases have made.
2. Apply `enforceRateLimit()` to the five currently-uncapped callables
   (#2), starting with `syncReadings`/`deleteReading` as the highest-cost
   two.
3. Dependency remediation for the app-root critical/high advisories (#4)
   — likely an `@expo/plist`/`xmldom` version bump or replacement: scope
   and test impact before touching `package-lock.json`.
4. Dependency remediation for the `functions/` moderate advisories (#5).
5. App Check readiness guard applied to the remaining five client call
   sites (#6), mirroring the existing `askWatchOracle`/`discussReading`
   pattern.
6. An explicit owner decision on the temporary 50/50 quota limits (#8)
   and on whether/when a staging Firebase project (#3) is worth the
   added deployment complexity for this project's actual scale.
7. Continued Phase 6 work on the areas this reconnaissance could not
   verify from repository contents alone (§14) — live deployed-state
   comparison, GitHub branch-protection/secret-scoping review — would
   require credentials or access this environment does not have.

None of these should be inferred as authorized by this document itself.

---

## Status

**PHASE 6B RECONNAISSANCE: COMPLETE.**

No hard-stop was triggered. No production code, test, rule, deployment,
dependency, or payment file was modified. `git status --porcelain` is
empty. This document is the sole file this reconnaissance adds. Awaiting
independent review, per the standing sequence
(`b884452 → Phase 6B reconnaissance → independent review → closure →
next narrowly scoped authorization`).
