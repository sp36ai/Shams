# Shams al-Asrār — Production Roadmap (living tracker)

This is the single tracker for taking the app to production. It combines
the historic audit chain (`docs/audit/PHASE_*.md`, Phases 0 → 8A-10) with
what is still left to do. **Update this file whenever an item changes
state**, citing the evidence (commit SHA, CI run number, PR/issue).

Legend: ✅ done · ❌ to do · ⚠️ done in code, not yet live in production ·
👤 needs the owner (a credential, console access, or a decision)

Last verified: 2026-09-24 against `main` @ `210555a` (PR #146 merged) and GitHub Actions history.

> **Blocking fact:** production Cloud Functions still run `ce536bc`
> (deploy run #50, 2026-09-06). Every `Deploy Cloud Functions` run since
> the Phase 8A merge (runs #51–#76) was **skipped** because CI on `main`
> is red. The deploy gate from Phase 6D-1 is working as designed. Until CI
> is green, none of the ⚠️ items below are live.

---

## Part A — Historic audit roadmap (completed phases)

### Phase 0 — Baseline & forensic starting point
- ✅ Freeze + forensic baseline, no fixes (`PHASE_0_BASELINE.md`)
- ✅ Dead KP code and orphaned `judgeHorary` test identified

### Phase 1 — Architecture map & golden corpus
- ✅ Canonical flow mapped (`askWatchOracle` → `judgeWatchChart` → `diagnose`)
- ✅ Authority resolution (`AUTHORITY_MATRIX.md`, `DUPLICATE_AUTHORITY_MAP.md`)
- ✅ Golden corpus created

### Phase 2 — Engine purification
- ✅ 2A infrastructure & authority stabilization
- ✅ 2B RKP made the single engine authority; KP judgment removed (`18232d7`); engine mirror kept in sync
- ✅ Remedy selection moved under RKP authority (`REMEDY_MIGRATION_PLAN.md`)

### Phase 3 — Output contract
- ✅ Current output inventory
- ✅ Claim surface definition
- ✅ Immutable reading contract
- ✅ Architectural review gate

### Phase 4 — Oracle safety validator
- ✅ Historical validator analysis
- ✅ Deterministic safety validator implemented
- ✅ 4A surgical hardening — PASS
- ✅ Forensic review gate — PASS

### Phase 5 — Adversarial verification & hardening (formally closed)
- ✅ 5A adversarial input & question resolution
- ✅ 5B / 5B-R / 5B-R2 engine boundary, mirror integrity, golden baseline
- ✅ 5C / 5C-R narration fuzzing, Unicode/obfuscation fixes
- ✅ 5D / 5D-R validator obfuscation hardening
- ✅ 5E + R/R2/R3/R4 structural-claim fabrication, false positives, "misfortune" bypass
- ✅ 5F / 5F-R2 discussion surface, comparison-reading trust boundary
- ✅ 5G reconnaissance, no P0/P1
- ✅ 5H / 5H-R / 5H-R2 TTS post-validation boundary
- ✅ 5I adversarial Oracle / production behaviour
- ✅ Residual disposition gate — Phase 5 formally closed

Evidence (7A/7B): golden corpus 111/111, replay-check 24/24, adversarial
harness 11,923/11,923 with 0 false negatives and 0 false positives.

### Phase 6 — Production infrastructure hardening
| Item | Audit status | Live in production |
|---|---|---|
| 6A-F1 / 6A-R1 ownership & entitlement boundary | ✅ CLOSED | ⚠️ not deployed |
| 6B infrastructure reconnaissance (Findings 1–7) | ✅ CLOSED | n/a |
| 6C-1 Finding 1: Firestore rules tests enforced by CI | ✅ CLOSED | ✅ active in CI (plus #115 deploy gate) |
| 6C-2 Finding 2: rate limiting on 5 callables | ✅ CLOSED | ⚠️ **not deployed** |
| 6D-1 Finding 3 Option C: CI-gated deploy | ✅ CLOSED | ✅ active |
| Finding 3 Options A/B: staging project / approval gate | ❌ 👤 on hold for owner decision | ❌ |
| 6D-2 Finding 4: app dependency audit | ✅ closed, no change needed | n/a |
| 6D-3 Finding 5: `functions/` dependency audit | ✅ closed, no change needed | n/a |
| 6D-4 Finding 6: App Check guard on 5 of 7 client sites | ✅ CLOSED | ⚠️ **not deployed** |
| 6D-5 Finding 7: 3 manual casts bypassing Zod | ✅ closed, no code change | n/a |

### Phase 7 — Production-readiness decision
- ✅ 7A reconnaissance
- ✅ 7B independent review — PASS
- ✅ 7C final decision: deployed system NOT READY; hardened branch "READY
  WITH ACCEPTED RISKS" only after merge + deploy + three owner decisions (see R5)

### Phase 8A — Promotion to production
- ✅ 8A-1 … 8A-5 narration safety validation gap on `main` — CLOSED
- ✅ 8A reconnaissance (resumed) + 8A-7 review — PASS
- ✅ 8A-8 hardened branch merged to `main` (`61ddf4a`, 2026-09-09)
- ✅ 8A-9 / 8A-10 post-merge verification documented (CI failed; deploy correctly skipped)
- ✅ 8A-10 CI artifact quota: `retention-days` + opt-in debug APK on `main`; #111 AAB retention 3d
- ❌ **8A-10 verified deploy of the merged commit — not done** (26 consecutive skipped deploys)

---

## Part B — Remaining roadmap (critical path, in order)

### R1 — Get CI green on `main`
- ✅ 👤 #119 GitHub Actions minutes / spending limit — **resolved** by the owner (billing fixed ~2026-09-23 14:57 UTC). CI runs normally since.
- ✅ #142 merged (`cf513e9`): widened the "Grant location access" wait 30s → 90s in `02_signup_journey.yaml`.
- ✅ #145 merged: E2E now runs only on `main`, ready (non-draft) PRs, and manual dispatch; superseded PR runs auto-cancel. Production/`main` CI unaffected.
- ✅ #146 merged (`210555a`): emulator resolution/density lowered (1080×2400→720×1600, density 420→280) to cut per-frame host CPU. **Confirmed applied correctly** on its own CI run (`Physical size: 720x1600`, `Override density: 280` logged by both E2E jobs) but **did not resolve the runner saturation**: load average held at 3.87–4.72 and `qemu-system-x86_64` at 169–180% CPU throughout, essentially unchanged from the pre-fix baseline (load 3.3–5.0, qemu 150–167%). `signup-journey` still lost its emulator after 14m14s ("Android driver unreachable").
- ❌ #124 E2E emulator adb drops / driver-unreachable under sustained load — **the free/software fixes are exhausted** (1-core cap #137, resolution/density cut #146). Both applied correctly but load stays above ~4.
  - 👤 **Owner decision needed:** upgrade to a paid 4-core GitHub Actions runner for the E2E job, or accept intermittent `signup-journey`/`settings-signout` E2E failures as a known runner-capacity limit (the app-quality/build/security jobs are unaffected and pass reliably).
- ❌ #132 signup never reaches "Grant location access" — possibly a real user-facing bug, still unresolved
  - ✅ Code traced (signUp → onAuthStateChanged → RootNavigator gate → screen label): no blocking path found, same logic at `ce536bc`
  - ⚠️ #142 (wait 30s→90s) is merged, but `signup-journey` in #146's own run failed on emulator/driver loss (not a wait-timeout), so this remains unconfirmed either way
  - ❌ 👤 Manual sign-up on a real phone, fresh install — decides whether real users are affected
  - ❌ 👤 Check Firebase Console → Authentication → Users for an `e2e-…@e2e.shamsalasrar.test` account created ~16:41 UTC 23 Sep — would confirm signup itself completes even when the E2E driver is lost
- ❌ #131 E2E creates real accounts in production Firebase Auth (#133/#136 moved to a controlled test domain; underlying prod-project targeting remains)
- ❌ 👤 `E2E_TEST_ACCOUNT_EMAIL` / `E2E_TEST_ACCOUNT_PASSWORD` GitHub secrets + matching pre-onboarded free-plan account (needed by `03_settings_and_signout`, #130). **Confirmed still unset**: #146's own CI run shows `MAESTRO_E2E_TEST_ACCOUNT_EMAIL`/`MAESTRO_E2E_TEST_ACCOUNT_PASSWORD` both empty in the job env, and `settings-signout` fails on `id: settings-gear-btn is visible` (never reaches Settings, consistent with no test account).
- ❌ Evidence: CI run on `main` with every job green (still blocked on the 4-core-runner decision and the two 👤 items above)

### R2 — Verified production deploy (finishes Phase 8A-10)
- ❌ `Deploy Cloud Functions` runs (not skipped) at the green `main` SHA
- ❌ `Deploy Firebase Hosting` and `Release to Play Store` checked against the same SHA
- ❌ Confirm in production that rate limiting (Finding 2), App Check (Finding 6), 6A-R1 ownership and 8A-3 narration validation are live
- ❌ Record in a `PHASE_8A_11_DEPLOY_VERIFICATION.md`

### R3 — Firestore rules parity
- ❌ 👤 Confirm the live Firestore rules match the committed `firestore.rules` (they are deployed by hand, so this has never been checked)

### R4 — Backup / disaster recovery
- ❌ 👤 Enable scheduled Firestore backups and run one restore drill (needs GCP console access; see `BACKUP_AND_DISASTER_RECOVERY.md`)

### R5 — Owner risk decisions (from Phase 7C)
- ❌ 👤 (a) accept Backup/DR as a residual risk, or complete R4
- ❌ 👤 (b) accept Finding 3 Option C alone, or choose Option A (staging project) / B (Environment approval gate)
- ❌ 👤 (c) accept branch-protection state as unverifiable from these sessions, or verify it manually
- ❌ 👤 (d) new: accept intermittent E2E failures under runner CPU saturation, or fund a paid 4-core Actions runner (see R1 / #124)

### R6 — Re-issued production-readiness verdict
- ❌ New decision document superseding 7C, based on R1–R5 evidence

---

## Part C — Release backlog outside the audit chain
- ❌ #43 Google Play Billing Library 8 upgrade — **31 Aug 2026 deadline has passed**; needs New Architecture migration
  - ⚠️ Step 1: RN 0.78.3 → 0.79.7, New Arch OFF — draft PR #141, branch updated onto `main`@`210555a`; local typecheck/lint/jest 306/306 + release bundle ✅; Gradle build, E2E and device test not yet verified
  - ❌ Step 2: `@react-native-firebase/*` 19.3.0 → v21+ (all six together), New Arch OFF
  - ❌ Step 3: enable New Architecture, full native-module regression
  - ❌ Step 4: `react-native-iap` → 15.x + `react-native-nitro-modules`, rewrite `src/hooks/usePurchase.ts`, verify Billing 8 in merged manifest, on-device purchase + restore
  - ❌ 👤 Play Console "Request more time" extension (to 1 Nov 2026), if not already granted
- ❌ #129 Razorpay entitlement binding trusts an unauthenticated payload field — blocks enabling Razorpay (not release-blocking)
  - ⚠️ Item 3 (webhook): PR #143 grants only for orders/subscriptions in this system's own ledger, fails closed; branch updated onto `main`@`210555a`; functions lint + 558/558 tests ✅
  - ❌ 👤 Items 1-2 (Auth-gated order-creation callable writing the ledger): needs plan prices, orders-vs-subscriptions decision, and Razorpay API keys (only after account approval)
- ❌ 👤 #67 manual/infra release checklist (google-services.json, secrets, dashboards)
- ❌ #121 raise functions/engine coverage thresholds back toward 95%
- ❌ #135 react-native-tts / Firebase deprecated `onCatalystInstanceDestroy`

## Part D — Product priority (not in the audit chain)
- ✅ Gap analysis (2026-09-23): text + voice via one `sendMessage` → `askWatchOracle`/`discussReading`, server-rendered verdict cards, TTS of server-validated `speakableText`, continuation, MMKV history, loading/error/retry — already built in `ReadingScreen`/`ChatBubble`
- ⚠️ Draft PR #144: bubble timestamps, day separators, long-press copy, narration progress bar; app jest 335/335 ✅; branch updated onto `main`@`210555a`; needs on-device check
- ❌ Possible next: hold-to-record mic (WhatsApp-style) — interaction change, needs device testing
- ❌ Premium WhatsApp-style Oracle conversation UI: text + voice questions,
  Oracle responses, audio playback, continuation, history, loading/error/retry
  states. Voice goes through speech-to-text into the same `askWatchOracle`
  pipeline; audio is only TTS of the composed text. No client-side judgment.

---

## Change log
- 2026-09-24 — #146 merged to `main` (emulator resolution/density fix): confirmed applied correctly but did not resolve E2E runner saturation (load 3.87–4.72, qemu 169–180% CPU, unchanged from baseline). `main` merged into #140/#141/#143/#144/#145 branches. Owner decision needed on a paid 4-core runner (R1/R5).
- 2026-09-23 — Oracle conversation gap analysis; polish in draft PR #144.
- 2026-09-23 — #129 webhook-side fix in PR #143 (fail-closed ledger binding).
- 2026-09-23 — #132 traced; test-timeout fix in PR #142 (merged `cf513e9`). CI billing (#119) resolved by owner ~14:57 UTC.
- 2026-09-23 — #43 step 1 (RN 0.79.7) opened as draft PR #141.
- 2026-09-23 — R1: run #540 blocked by the Actions minutes quota again (#119); no code signal available.
- 2026-09-23 — Tracker created from the Phase 0 → 8A-10 audit records and live Actions history.
