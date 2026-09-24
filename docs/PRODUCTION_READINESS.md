# Shams al-Asrār — Production Readiness Gate

The authoritative evidence-gated checklist. Every row's status is backed
by a citation in this same row — no status is upgraded without one.
Companion to `docs/PRODUCTION_ROADMAP.md` (phase history + critical path)
and `docs/PRODUCTION_BLOCKERS.md` / `docs/OWNER_ACTIONS.md` (blocker
detail). This file exists to answer one question precisely: **is it
actually ready, gate by gate, with evidence — not "should be."**

Status vocabulary (used strictly):
- **PASS** — evidence directly confirms this gate.
- **FAIL** — evidence directly shows this gate is broken.
- **BLOCKED** — cannot be evaluated without an external dependency (owner
  credential/console access) this session does not have.
- **PENDING** — a fix exists but hasn't been verified yet.
- **NOT VERIFIED** — no evidence either way has been gathered.
- **NOT APPLICABLE** — doesn't apply to current scope.

**"READY" is never used as a status on any individual gate below.**

Last verified: 2026-09-24, `main` @ `d9a463c` (pre-#145/#146 merge state
as checked out for this audit; see `docs/PRODUCTION_ROADMAP.md` for the
current `main` SHA, which has since advanced past this).

---

## Gate table

| Gate | Status | Evidence |
|---|---|---|
| Engine integrity (RKP sole authority, no KP) | PASS | `docs/audit/PHASE_2B_ENGINE_MIGRATION.md`, `docs/audit/PHASE_5B_REMEDIATION.md` — KP judgment removed at `18232d7`; `scripts/sync-engine.mjs --check` + `vitestGlobalSetup.mjs` enforce byte-identical `functions/src/engine/` ↔ `src/astrology/` on every test run, still in place and exercised this session (PR #148's `manazil.ts` work ran through this gate without modifying either side independently) |
| Golden corpus | PASS (historic, not re-run this session) | `docs/audit/PHASE_7A_RECONNAISSANCE.md` / `PHASE_7B_REVIEW.md`: 111/111. Not independently re-executed in this session — no code change this session touches `functions/scripts/generate-golden-corpus.ts` or its inputs, so no reason to expect drift, but this is a historic citation, not a fresh run |
| Adversarial narration harness | PASS (historic, not re-run this session) | Same as above: 11,923/11,923, 0 false negatives/positives, `docs/audit/PHASE_5_FINAL_RESIDUAL_GATE.md`. Not re-run this session for the same reason |
| CI on `main` | PENDING | `#119` (billing) resolved 2026-09-23 ~14:57 UTC; `#146`/`#145` merged since. No single `main` CI run has yet gone fully green end-to-end — `signup-journey`/`settings-signout` still fail on every PR checked this session (7+ independent `Android driver unreachable` / Firebase-Auth-rejection occurrences logged). See R1 in the roadmap |
| CI policy (no false green) | PASS, with one documented gap | Directly audited the merged `ci.yml` (not assumed): no `continue-on-error` anywhere in the file; Maestro's `fail-on-error: true` genuinely fails a job on a failed E2E assertion; `app-quality`/`functions-quality` have no conditional `if:` and always run; deploy workflows gate on `github.event.workflow_run.conclusion == 'success'`. Gap: `e2e-build` only conditions on PR draft status, not file path — a ready docs-only PR still runs full E2E (observed directly on #147/#148) |
| E2E — `auth-signin` | PASS | Passed cleanly on #145's own run and on #144's re-run (job 107537145085, completed 2026-09-24T07:44:20Z). Confirms this specific flow is not broken by #124 or #132 when the runner isn't saturated |
| E2E — `signup-journey` | FAIL, root-caused, fix PENDING owner action | Root cause confirmed via #149's diagnostic logging (verbatim): `createUserWithEmailAndPassword rejected` — `Requests from this Android client application com.astrosarfaraz.shamsalasrar are blocked`. CI's debug keystore was regenerated every run, so its SHA-1 could never be registered in Firebase's Android API key restrictions. Fix (stable committed keystore) in PR #150; **BLOCKED** on owner registering the resulting SHA-1 (`07:0B:A6:7E:A3:A0:A7:8C:70:18:45:CE:5C:A5:B5:99:CF:08:18:2E`) in Firebase Console — `docs/OWNER_ACTIONS.md` §1. Separately, also intermittently hits #124 (`Android driver unreachable`, runner saturation) — 7 independent occurrences this session across unrelated PRs |
| E2E — `settings-signout` | FAIL, BLOCKED on owner action | `E2E_TEST_ACCOUNT_EMAIL`/`PASSWORD` GitHub secrets confirmed empty in job env on every PR checked this session; fails on `id: settings-gear-btn is visible` (never reaches Settings). `docs/OWNER_ACTIONS.md` §2. Will also need §1's SHA-1 fix, since creating the dedicated test account hits the same Auth rejection otherwise |
| Firebase Auth (production) | NOT VERIFIED | No Firebase Console/CLI access in this session (`which firebase` → not found, no service-account credentials in env, confirmed directly). Cannot independently confirm signup/signin/signout behavior against the live project |
| App Check (production) | NOT VERIFIED | Same access limitation. Code-level: App Check guard exists on 5 of 7 client call sites per Phase 6D-4 (`docs/audit/PHASE_6D_4_CLOSURE.md`), merged but **not deployed** (production Cloud Functions still run `ce536bc`, pre-dating this). CI-only finding: App Check debug token logs as `null`/unregistered in every CI run checked this session — separate from, but likely related to, the production App Check debug-token setup question in `docs/OWNER_ACTIONS.md` |
| Firestore rules (production parity) | NOT VERIFIED | `docs/PRODUCTION_ROADMAP.md` R3 — rules are deployed by hand historically, never diffed against `firestore.rules` in source. No CLI/console access this session. `docs/OWNER_ACTIONS.md` §3 |
| Cloud Functions (deployed revision) | FAIL (stale) | `docs/PRODUCTION_ROADMAP.md`: production still runs `ce536bc` (deploy run #50, 2026-09-06). 26+ consecutive `Deploy Cloud Functions` runs skipped since because `main`'s CI has been red. Rate limiting (Finding 2), App Check guard (Finding 6), 6A-R1 ownership fixes, and 8A-3 narration validation are all merged to `main` but **not live** |
| Hosting | NOT VERIFIED | Same deploy-skip situation as Cloud Functions; no live check performed (no console/CLI access) |
| Rate limiting (production) | NOT VERIFIED (code merged, not deployed) | `docs/audit/PHASE_6C_2_CLOSURE.md` — merged to `main`, unit-tested (`functions/src/functions/__tests__/quota.test.ts`, `activateTrial.test.ts` — rate-limit-aware tests pass locally per this session's `npm test` runs), but not live per the Cloud Functions row above |
| Entitlements / ownership boundary | NOT VERIFIED (code merged, not deployed) | Phase 6A-R1, same deploy-skip situation |
| Play Billing (#43) | PENDING | Step 1 (RN 0.79.7) in draft PR #141, branch up to date with `main`; local typecheck/lint/jest clean; Gradle build and on-device verification **not done** (no Android device/emulator-with-play-services in this session). Steps 2–4 (Firebase v21+, New Architecture, react-native-iap 15.x) not started. Play Console deadline extension status: NOT VERIFIED (owner action) |
| Razorpay (#129) | PARTIAL — item 3 PENDING, items 1–2 BLOCKED | PR #143: webhook now grants only for orders/subscriptions in this system's own ledger (fail-closed), 15 new + 6 updated tests, all passing locally — but **not merged to `main`**, and not deployed. Items 1–2 (Auth-gated order-creation callable) genuinely blocked on owner decisions (plan prices, orders-vs-subscriptions) and Razorpay API keys (post account-approval). Razorpay isn't live in production regardless (no keys, no webhook configured, ₹0 transactions per the original #129 investigation) — so this gate carries no current production risk |
| Backup / Disaster Recovery | NOT VERIFIED | No evidence gathered this session that scheduled backups are enabled or a restore has ever been tested. `docs/audit/BACKUP_AND_DISASTER_RECOVERY.md` flags this as open historically. `docs/OWNER_ACTIONS.md` §4 — requires GCP Console access this session doesn't have |
| Security sweep (code-level) | PASS | Grepped `functions/src` and `src` for `TODO\|FIXME\|bypass\|skip.?auth\|debug.?mode\|mock\|stub\|hardcoded\|allow.?unauthenticated` this session. Every hit was either: defensive-security documentation describing an *attack* being blocked (`textSecurity.ts`, `narrationValidator.ts` obfuscation-bypass docs), a safely-gated emulator-only Auth bypass (`middleware/auth.ts`, gated on `FUNCTIONS_EMULATOR`, a Google-controlled env var never true in deployed Functions), or unrelated test-utility/comment noise. No hardcoded secrets, no unguarded debug paths, no unauthenticated-access shortcuts found |
| Coverage (#121) | PENDING (partial progress) | PR #148: closed the largest single gap in `functions/` (`engine/manazil.ts`, confirmed mirror/dead-code per PHASE 5B-R, 0%→100%), overall stmts/lines 87.08%→95.16%. Branch (86.48%) and function (74.82%) coverage remain below the 95% threshold in `angles.ts`, `houseMatrix.ts`, `nakshatras.ts`, `vimshottari.ts`, and others — not yet addressed. Note: this threshold isn't currently CI-enforced (`ci.yml`'s Functions Quality job runs `npm test -- --run`, not `--coverage`) |
| Production deployment — exact SHA verification | BLOCKED | Cannot be established: no Firebase/GCP CLI or credentials this session, and `main`'s own CI hasn't gone green yet (see CI row) so there is nothing new to verify a deploy of. The last known-good production SHA is `ce536bc`, unchanged since 2026-09-06 |
| Rollback procedure | PARTIAL — documented, but stale | `DEPLOYMENT.md` §"Rollback" exists (`firebase deploy --only functions,firestore` from a previous good state, or promote a previous revision via Firebase Console → Functions) but references the function name `askOracle`, which no longer exists in the codebase — the current exported callable is `askWatchOracle` (`functions/src/functions/askWatchOracle.ts`). The procedure's mechanism is sound; the specific example command/name is stale and should be corrected before relying on it verbatim |
| Observability / monitoring | NOT VERIFIED | `DEPLOYMENT.md` documents `gcloud functions logs read` / Cloud Logging Console access patterns, but no live check was performed this session (no credentials) |

---

## What this table does NOT yet cover

Per the mission's own scope, live production smoke-testing (§26 of the
mission brief: real signup, unauthorized-request rejection, Firestore
authorization, App Check behavior, rate-limit behavior, audit logging,
response validation, end-to-end against the deployed environment) is
**entirely blocked** on the Cloud Functions deployment happening at all,
which is itself blocked on `main`'s CI going green, which is itself
blocked on the three items in `docs/OWNER_ACTIONS.md` (§1 SHA-1
registration, §2 E2E secrets, §5 runner decision). There is no live
environment to smoke-test yet beyond the stale `ce536bc` deploy from
2026-09-06, and re-testing that specific stale revision would not answer
whether the *current* hardened source is safe — it would only describe
a known-old state.

---

## Final status

> **NOT READY.**

This is not a judgment call — it follows directly from the table: the
CI, Cloud Functions, Firestore rules, App Check, Backup/DR, and
production-deployment-SHA-verification gates are FAIL, BLOCKED, or NOT
VERIFIED, and per this project's own rule (`docs/PRODUCTION_ROADMAP.md`'s
header), none of the ⚠️/merged-but-undeployed items are live until CI is
green on `main`.

**Path to a genuine READY (or READY WITH EXPLICITLY ACCEPTED RISKS)
verdict**, in order:
1. Owner completes `docs/OWNER_ACTIONS.md` §1 (SHA-1 registration) → verify `signup-journey` on PR #150.
2. Owner completes §2 (E2E secrets) → verify `settings-signout`.
3. Owner decides §5 (4-core runner vs. accepted #124 risk).
4. A `main` CI run goes fully green → `Deploy Cloud Functions`/`Deploy Firebase Hosting` actually run (not skipped) → record the deployed revision/SHA here.
5. Owner completes §3 (Firestore rules parity check) and §4 (Backup/DR) — or explicitly accepts them as residual risk per Phase 7C Decision A.
6. Live smoke test against the newly deployed revision (this doc's "What this table does NOT yet cover" section).
7. Re-issue this table with every row citing fresh, post-deploy evidence.

---

## Change log
- 2026-09-24 — Created. First full evidence-gated pass across all 21 mission-specified gates.
