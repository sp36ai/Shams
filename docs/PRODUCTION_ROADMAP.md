# Shams al-Asrār — Production Roadmap (living tracker)

This is the single tracker for taking the app to production. It combines
the historic audit chain (`docs/audit/PHASE_*.md`, Phases 0 → 8A-10) with
what is still left to do. **Update this file whenever an item changes
state**, citing the evidence (commit SHA, CI run number, PR/issue).

Legend: ✅ done · ❌ to do · ⚠️ done in code, not yet live in production ·
👤 needs the owner (a credential, console access, or a decision)

Last verified: 2026-09-24 against `main` @ `835887d` (PR #145 merged) and GitHub Actions history.

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
- ✅ #145 merged (`835887d`): E2E now runs only on non-draft PRs, plus `main`/manual dispatch; superseded PR runs auto-cancel. Production/`main` CI unaffected. **CI policy audit performed against the merged `ci.yml`** (not assumed): confirmed draft PRs skip E2E, ready PRs and `main` always run it, no `continue-on-error` anywhere, deploy gate correctly requires `conclusion == 'success'`. **One gap found**: it gates on draft status only, not file path — a ready, docs-only PR (e.g. #147/#148) still runs full E2E. Not yet fixed; open follow-up if wanted.
- ✅ #146 merged (`210555a`): emulator resolution/density lowered (1080×2400→720×1600, density 420→280) to cut per-frame host CPU. **Confirmed applied correctly** but **did not resolve the runner saturation** (load 3.87–4.72, qemu 169–180% CPU, unchanged from baseline). Corroborated 6 more times since across #140/#143/#144/#145/#147 — `Android driver unreachable` is a well-established, reproducible pattern independent of PR content.
- ✅ **#132 ROOT-CAUSED (2026-09-24)** — was never a navigation bug. PR #149 added stage-tagged diagnostics (`signUp()` resolve/reject, `RootNavigator` gate logging); its own CI run captured the actual cause directly:
  ```
  [Auth] signUp(): createUserWithEmailAndPassword rejected
  { message: '[auth/unknown] ... Requests from this Android client
    application com.astrosarfaraz.shamsalasrar are blocked.' }
  ```
  CI's debug keystore was regenerated fresh every run (`keytool -genkeypair`), giving it a different SHA-1 every time — Firebase's Android API key restrictions authorize by SHA-1, so a constantly-changing fingerprint can never be registered, and every CI signup was structurally rejected before the app's own logic ran. `RootNavigator`'s gate never advanced past `Auth` because there was never an authenticated user — confirmed by the `[Nav]` diagnostic logging. Fix in PR #150: commit a stable `android/app/debug.keystore` (Android's standard debug-only convention, never a secret) so CI has one fixed SHA-1.
  - ❌ 👤 **Still needs:** register that SHA-1 in Firebase Console (`docs/OWNER_ACTIONS.md` §1) — the fix in #150 makes registration *possible*, doesn't complete it. `signup-journey`/`settings-signout` keep failing identically until then.
  - This also explains the "Grant location access" assertion failures seen independently on #140/#141/#148 (three unrelated PRs — docs, RN upgrade, functions test) — all the same upstream cause, not three separate bugs.
- ❌ #124 E2E emulator adb drops / driver-unreachable under sustained load — **separate problem from #132 above, still unresolved**. Free software fixes exhausted (1-core cap #137, resolution/density cut #146); 6 independent reproductions this session.
  - 👤 **Owner decision needed:** paid 4-core GitHub Actions runner, or accept intermittent failures as a known limit (`docs/OWNER_ACTIONS.md` §5). Recommend deferring this decision until #132's fix (SHA-1 registration) is in and its effect on pass rate is observed — some of what looked like #124 may partly have been #132 all along on runs that didn't lose the driver.
- ❌ #131 E2E creates real accounts in production Firebase Auth (#133/#136 moved to a controlled test domain; underlying prod-project targeting remains) — unaffected by the #132 fix, still open
- ❌ 👤 `E2E_TEST_ACCOUNT_EMAIL` / `E2E_TEST_ACCOUNT_PASSWORD` GitHub secrets + matching pre-onboarded free-plan account (needed by `settings-signout`, #130). Confirmed still unset (empty in every job env checked this session). `docs/OWNER_ACTIONS.md` §2 — note it now also depends on §1's SHA-1 fix, since creating that account hits the same rejection otherwise.
- ❌ Evidence: CI run on `main` with every job green (blocked on the SHA-1 registration, the 4-core-runner decision, and the E2E secrets)

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
- ❌ 👤 (d) accept intermittent E2E failures under runner CPU saturation, or fund a paid 4-core Actions runner (see R1 / #124) — recommend deciding after #132's SHA-1 fix lands

### R6 — Re-issued production-readiness verdict
- ❌ New decision document superseding 7C, based on R1–R5 evidence

---

## Part C — Release backlog outside the audit chain
- ❌ #43 Google Play Billing Library 8 upgrade — **31 Aug 2026 deadline has passed**; needs New Architecture migration
  - ⚠️ Step 1: RN 0.78.3 → 0.79.7, New Arch OFF — draft PR #141, branch updated onto `main`; local typecheck/lint/jest 306/306 + release bundle ✅; Gradle build, E2E and device test not yet verified
  - ❌ Step 2: `@react-native-firebase/*` 19.3.0 → v21+ (all six together), New Arch OFF
  - ❌ Step 3: enable New Architecture, full native-module regression
  - ❌ Step 4: `react-native-iap` → 15.x + `react-native-nitro-modules`, rewrite `src/hooks/usePurchase.ts`, verify Billing 8 in merged manifest, on-device purchase + restore
  - ❌ 👤 Play Console "Request more time" extension (to 1 Nov 2026), if not already granted
- ❌ #129 Razorpay entitlement binding trusts an unauthenticated payload field — blocks enabling Razorpay (not release-blocking)
  - ⚠️ Item 3 (webhook): PR #143 grants only for orders/subscriptions in this system's own ledger, fails closed; branch updated onto `main`; functions lint + 558/558 tests ✅
  - ❌ 👤 Items 1-2 (Auth-gated order-creation callable writing the ledger): needs plan prices, orders-vs-subscriptions decision, and Razorpay API keys (only after account approval)
- ❌ 👤 #67 manual/infra release checklist (google-services.json, secrets, dashboards)
- ⚠️ #121 raise functions/engine coverage thresholds back toward 95% — PR #148: closed the largest single gap (`engine/manazil.ts`, 0%→100%, confirmed mirror/dead-code server-side per PHASE 5B-R sync invariant, not authoritative judgment logic); overall stmts/lines 87.08%→95.16%. Branch (86.48%) and function (74.82%) coverage still below threshold elsewhere (`angles.ts`, `houseMatrix.ts`, `nakshatras.ts`, `vimshottari.ts`, etc.) — remainder of #121, not yet started.
- ❌ #135 react-native-tts / Firebase deprecated `onCatalystInstanceDestroy`

## Part D — Product priority (not in the audit chain)
- ✅ Gap analysis (2026-09-23): text + voice via one `sendMessage` → `askWatchOracle`/`discussReading`, server-rendered verdict cards, TTS of server-validated `speakableText`, continuation, MMKV history, loading/error/retry — already built in `ReadingScreen`/`ChatBubble`
- ⚠️ Draft PR #144: bubble timestamps, day separators, long-press copy, narration progress bar; app jest 335/335 ✅; branch updated onto `main`; needs on-device check
- ❌ Possible next: hold-to-record mic (WhatsApp-style) — interaction change, needs device testing
- ❌ Premium WhatsApp-style Oracle conversation UI: text + voice questions,
  Oracle responses, audio playback, continuation, history, loading/error/retry
  states. Voice goes through speech-to-text into the same `askWatchOracle`
  pipeline; audio is only TTS of the composed text. No client-side judgment.

---

## Change log
- 2026-09-24 — **#132 root-caused**: CI's debug keystore was regenerated every run, giving it an unregistrable SHA-1, so Firebase Auth structurally rejected every CI signup — never a navigation bug. Diagnostics in PR #149, fix in PR #150. Explains the "Grant location access" failures independently seen on #140/#141/#148. Still needs owner SHA-1 registration to take effect.
- 2026-09-24 — #121: PR #148 closed the largest functions/ coverage gap (`manazil.ts` 0%→100%), confirmed as mirror/dead-code (PHASE 5B-R sync invariant), not authoritative logic. Overall stmts/lines 87.08%→95.16%.
- 2026-09-24 — #145 merged: CI-scoping fix live. Ran a 6-point policy audit against the merged workflow; found one real gap (no path-based E2E skip, draft-only).
- 2026-09-24 — #146 merged to `main`: emulator resolution/density fix confirmed applied but insufficient for #124 (load/CPU unchanged). `main` merged into #140/#141/#143/#144/#145 branches. `docs/PRODUCTION_BLOCKERS.md` and `docs/OWNER_ACTIONS.md` created (PR #147).
- 2026-09-23 — Oracle conversation gap analysis; polish in draft PR #144.
- 2026-09-23 — #129 webhook-side fix in PR #143 (fail-closed ledger binding).
- 2026-09-23 — #132 traced; test-timeout fix in PR #142 (merged `cf513e9`). CI billing (#119) resolved by owner ~14:57 UTC.
- 2026-09-23 — #43 step 1 (RN 0.79.7) opened as draft PR #141.
- 2026-09-23 — R1: run #540 blocked by the Actions minutes quota again (#119); no code signal available.
- 2026-09-23 — Tracker created from the Phase 0 → 8A-10 audit records and live Actions history.
