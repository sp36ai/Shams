# Shams al-Asrār — Production Blocker Matrix

Companion to `docs/PRODUCTION_ROADMAP.md`. That file tracks the roadmap by
phase; this one tracks every currently-open item that blocks a verified
production release, classified so it's clear what a Claude session can
close by itself and what needs the owner.

**This session's actual access** (so the "Can Claude fix?" column is
honest, not aspirational): GitHub (repo read/write, Actions, PRs/issues)
via MCP tools, and a local checkout with no Firebase CLI, no `gcloud`, and
no service-account credentials in the environment (`which firebase gcloud`
→ not found; `env | grep -i firebase\|gcloud` → empty). So anything that
needs the Firebase Console, GCP Console, Play Console, or Actions
billing/runner settings is **not fixable by Claude in this session**,
regardless of how simple the fix looks in code.

Last verified: 2026-09-24, against `main` @ `210555a`.

| Blocker | Evidence | Root cause | Owner | Can Claude fix? | Fix | Verification | Status |
|---|---|---|---|---|---|---|---|
| CI on `main` was fully red | CI run #540 on `d9a463c` failed every job in ~3s, no logs (HTTP 404 pattern) | GitHub Actions minutes/spending limit exhausted (#119) | Owner (billing) | No — billing console only | Owner fixed billing ~2026-09-23 14:57 UTC | Runs since then have real `runner_id`s and execute >10s (e.g. run 35966757053) | ✅ RESOLVED |
| `signup-journey` E2E lost its emulator mid-run | #146 job 107278594916: `Android driver unreachable` after 14m14s; resource watchdog shows load 3.87–4.72, qemu CPU 169–175% throughout | 2-core GitHub-hosted runner saturated by the Android emulator + Maestro; confirmed **not** fixed by `-cores 1` (#137) or by cutting render resolution 1080×2400→720×1600 (#146) — both applied correctly, load stayed the same | Owner (billing, for a paid runner) | Partially — free software fixes are exhausted and proven insufficient | `#137` (core cap), `#146` (resolution/density) both merged; no further free lever identified | Watchdog data from #146's own CI run (quoted above) | ❌ OPEN — needs owner decision (R5-d) |
| `settings-signout` E2E fails at `id: settings-gear-btn is visible` | #146 job 107278595195; job env shows `MAESTRO_E2E_TEST_ACCOUNT_EMAIL` / `MAESTRO_E2E_TEST_ACCOUNT_PASSWORD` both empty | `E2E_TEST_ACCOUNT_EMAIL`/`PASSWORD` GitHub secrets were never set, so the flow has no account to sign in with and never reaches Settings | Owner (repo secrets + a real test account) | No — Claude cannot create GitHub Actions secrets or a Firebase Auth account without credentials | See `docs/OWNER_ACTIONS.md` §2 for the exact one-time setup | Re-run `settings-signout` after the secrets exist; expect it to reach the gear icon | ❌ OPEN |
| #132 — does signup reach "Grant location access"? | Code traced end-to-end (signUp → onAuthStateChanged → RootNavigator gate → screen), no blocking path found in source, same logic as production `ce536bc`. #142 (wait 30s→90s) is merged. But in #146's own run, `signup-journey` failed on emulator/driver loss (`Android driver unreachable`), not a UI wait-timeout — so this run gives **no signal either way** on #132 | Undetermined: could be (a) a real client navigation bug, or (b) purely a byproduct of the runner-saturation problem above, since the driver was lost before the assertion could even run | Owner (Firebase Console read) + Claude (code trace, already done) | Partially — code trace is done; the deciding evidence (did the Auth account get created?) requires Firebase Console access this session doesn't have | See `docs/OWNER_ACTIONS.md` §1 | 👤 Owner checks Firebase Console → Authentication → Users for `e2e-…@e2e.shamsalasrar.test` created ~16:41 UTC 23 Sep. Found → signup itself works, the bug (if any) is post-account, in navigation — Claude can then instrument and fix it. Not found → App Check or a network call is failing in CI only, which is a test-environment fix, not a production one | ❌ OPEN — blocked on one console lookup |
| #131 — E2E creates real accounts in production Firebase Auth | `.maestro/ci/` flows sign up fresh emails each run | Tests point at the production Firebase project, not an isolated test project | Owner (Firebase project/console decision) | Partially — #133/#136 already moved test emails to an `@e2e.shamsalasrar.test` domain to make them identifiable/cleanable; the underlying prod-project targeting is unchanged | None proposed yet — needs an owner decision on whether a dedicated Firebase test project is worth the cost/complexity, or whether identifiable+cleanable accounts in prod is an accepted risk | N/A until decided | ❌ OPEN — needs an owner decision, not yet on the roadmap as R5 item |
| Deploy Cloud Functions still skipped | 26 consecutive skipped `Deploy Cloud Functions` runs since the Phase 8A merge (`61ddf4a`); last real deploy run #50 on `ce536bc`, 2026-09-06 | `workflow_run` deploy gate (Phase 6D-1) only fires on a **successful** CI run on `main`; `main`'s CI has been red until #119 was fixed and #146 merged | Owner (needs the fixes above to land, then a verified deploy) | Yes, to verify once CI is green — Claude can watch the `Deploy Cloud Functions` workflow run and report its outcome via GitHub Actions API | Nothing to fix in code; this resolves itself once a CI run on `main` goes fully green | Watch the next green `main` CI run for the paired `Deploy Cloud Functions` run and record its conclusion + deployed revision id in the roadmap | ❌ OPEN — waiting on CI, see R1 |
| Live Firestore rules vs. `firestore.rules` in source | `docs/PRODUCTION_ROADMAP.md` R3: rules are deployed by hand, never verified against source | No CI/CD step deploys or diffs Firestore rules against production | Owner (Firebase Console or `firebase deploy --only firestore:rules --dry-run` with credentials) | No — this session has no Firebase CLI, no service-account key, and no console access | See `docs/OWNER_ACTIONS.md` §3 | Owner runs `firebase firestore:rules get` (or checks Console → Firestore → Rules) and diffs it against `firestore.rules` on `main` | ❌ OPEN |
| Firestore Backup/DR unverified | `docs/audit/BACKUP_AND_DISASTER_RECOVERY.md` (per roadmap R4) — no evidence backups are enabled, no restore drill on record | Requires GCP Console (Firestore → Backups) access this session doesn't have | Owner (GCP Console) | No | See `docs/OWNER_ACTIONS.md` §4 | Owner enables scheduled backups if not already on, runs one restore drill, records the result | ❌ OPEN |
| Phase 7C risk decisions (a)(b)(c) | `docs/PRODUCTION_ROADMAP.md` R5 | Three judgment calls that were deliberately left to the owner in the original audit (accept Backup/DR risk vs. fix it; Finding 3 Option C alone vs. A/B; branch-protection state unverifiable vs. verify manually) | Owner | No — explicitly owner judgment, not a technical fix | N/A | Owner states a decision for each; Claude records it and moves R6 forward | ❌ OPEN, decision sheet below |
| #43 Play Billing 8 — steps 2–4 not started | Step 1 (RN 0.79.7) is in draft PR #141, branch updated onto `main`@`210555a`; not yet on-device verified. Steps 2 (Firebase v21+), 3 (New Architecture), 4 (`react-native-iap` 15.x + `usePurchase.ts` rewrite) not started | Deliberately sequenced — each step is a real compatibility risk to the RKP/Oracle native stack (TTS, voice, Firebase) and needs independent verification, not a batched upgrade | Claude (code) + Owner (on-device verification, Play Console deadline extension) | Yes for code; No for on-device smoke test and Play Console action | Claude can implement steps 2–4 incrementally once step 1 is verified | Each step: typecheck/lint/jest clean + a real on-device smoke test (auth, an Oracle question, voice, TTS, purchase screen) | ❌ OPEN — step 1 awaiting device verification before continuing |
| #129 Razorpay — items 1–2 not started | PR #143 (webhook fail-closed fix) merged into `main`-based branch, not yet merged to `main`. Order-creation callable (items 1–2) not started | Blocked on owner decisions (plan prices, orders vs. subscriptions) and Razorpay API keys, which don't exist until the Razorpay account is approved | Owner (business decision + external account approval) | No — Claude explicitly will not invent prices or a billing model | N/A until owner decides | Once keys + prices exist, Claude implements the Auth-gated callable and the regression tests proving client-supplied identity is never trusted | ❌ OPEN |
| #121 functions/engine coverage below 95% target | Tracked in roadmap Part C, no PR yet | Coverage regressed during recent hardening work and was never brought back up | Claude | Yes | Not yet started this session | `npm test -- --coverage` in `functions/`, compare against the 95% target | ❌ OPEN — next candidate for Claude to pick up |
| #135 deprecated `onCatalystInstanceDestroy` | Confirmed still present and in use by react-native-tts, voice, Firebase 19.3.0, react-native-iap (per #141's compatibility check) | Upstream dependencies haven't migrated off the deprecated RN lifecycle API yet | Claude, but gated on upstream libraries | Partially — nothing to fix until the dependencies (react-native-tts etc.) ship a replacement API | None available yet | Re-check each dependency's changelog when bumping versions (e.g. during #43 step 2) | ❌ OPEN — no action possible yet |

---

## Decision sheet for the owner (Phase 7C, roadmap R5)

### Decision A — Backup/DR
- **Option 1:** Enable scheduled Firestore backups now (Console → Firestore → Backups) and run one restore drill before launch. Removes the residual risk entirely.
- **Option 2:** Accept the current no-verified-backup state as a launch risk, revisit post-launch.
- **Risk if Option 2:** total data loss on a Firestore-level incident with no tested recovery path.
- **Effort for Option 1:** a few minutes in Console to enable; a restore drill needs a maintenance window against a non-production Firestore instance or export/import test.
- **Evidence needed either way:** screenshot/export of the Backups page state, or a written risk acceptance.

### Decision B — Finding 3 (deploy approval gate)
- **Option C (current, ✅ closed):** CI-gated deploy — a red CI run blocks the deploy workflow automatically. Already live.
- **Option A:** A fully separate staging Firebase project, promoted to prod only after manual sign-off. More isolation, more infra to maintain.
- **Option B:** A GitHub Environment with a required-reviewer approval gate in front of the existing deploy workflow. Cheaper than Option A, adds a manual click before every deploy.
- **Recommendation basis:** Option C already prevents red code from deploying automatically; A/B add a *human* checkpoint on top of that, trading deploy speed for an extra layer against merged-but-wrong code.

### Decision C — Branch protection
- **What Claude can verify:** nothing — branch protection rules aren't exposed through the standard PR/Actions API calls this session has used; a dedicated repo-settings read would be needed. Claude has not attempted to read the repo's branch protection settings this session because doing so is out of the scope of every task requested so far, not because it was tried and failed. If asked to verify it, the concrete check is: GitHub → Settings → Branches → `main` → confirm "Require status checks to pass" is on and lists the CI job names.
- **What the owner should confirm:** that `main` requires the CI check to pass before merge, and (ideally) requires the "Claude Approvals" check if the repo uses it.

---

## Change log
- 2026-09-24 — Matrix created from current session evidence (main @ `210555a`) and the existing roadmap.
