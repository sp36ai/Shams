# Shams al-Asrār — Owner-Only Actions

Every item here requires a human credential, console access, billing
decision, or business judgment that a Claude Code session genuinely
cannot exercise. Each entry gives the exact console/menu/setting so it's
a checklist, not a research task. Engineering work that does **not**
depend on these continues in parallel — see `docs/PRODUCTION_BLOCKERS.md`
for what's already moving.

---

## 1. Confirm the #132 E2E signup account (decides whether #132 is a real bug)

**Why:** `signup-journey`'s E2E run lost its emulator (`Android driver
unreachable`) before ever reaching the location-permission assertion, so
that run proves nothing about whether the app actually navigates there
after a real signup. The one piece of evidence that narrows this down is
whether the Firebase Auth account the test tried to create actually got
created.

**Where:** Firebase Console → your project → **Authentication → Users**.

**What to look for:** an account with an email matching
`e2e-…@e2e.shamsalasrar.test`, created around **16:41 UTC on 23 Sep 2026**.

**What each outcome means:**
- **Found:** signup itself completes even under CI load. If real users
  ever get stuck on the location screen, the bug is downstream of account
  creation (navigation/state), and Claude should instrument
  `RootNavigator`/`LocationPermissionScreen` next.
- **Not found:** something between "tap submit" and "account created" is
  failing only in CI — most likely Firebase App Check rejecting the debug
  token (logs show `debugToken: [DEFAULT]/debug/null`). That's a
  test-environment fix (registering a real App Check debug token for CI),
  not a production code change, and Claude can do that once told the
  answer here.

**Report back:** just "found" or "not found" is enough for Claude to
continue.

---

## 2. Set up the E2E test account (`settings-signout`, issue #130)

**Why:** `settings-signout`'s Maestro flow needs to sign in as an existing
account to reach Settings. The job environment already confirms
`MAESTRO_E2E_TEST_ACCOUNT_EMAIL` / `MAESTRO_E2E_TEST_ACCOUNT_PASSWORD` are
empty — the secrets were never created.

**Steps:**
1. In Firebase Console → Authentication → Users, create (or designate) one
   dedicated test account — **not** a real user's account. Suggested
   pattern to match the existing `@e2e.shamsalasrar.test` convention used
   by the signup tests, e.g. `settings-e2e@e2e.shamsalasrar.test`.
2. Complete onboarding for that account once by hand (or via the app) so
   it's on the **free plan** and fully onboarded — the test only checks
   plan display and sign-out, it doesn't run onboarding itself.
3. In GitHub → this repo → **Settings → Secrets and variables → Actions**,
   add two repository secrets:
   - `E2E_TEST_ACCOUNT_EMAIL` = that account's email
   - `E2E_TEST_ACCOUNT_PASSWORD` = that account's password
4. Do not commit these values anywhere in the repo — they're consumed by
   `ci.yml` as `MAESTRO_E2E_TEST_ACCOUNT_EMAIL`/`PASSWORD` env vars at
   test-run time only.

**Verification:** the next `settings-signout` CI run should get past
`id: settings-gear-btn is visible` instead of failing there. Claude will
confirm this on the next CI run once the secrets exist.

---

## 3. Verify live Firestore rules match `firestore.rules`

**Why:** the rules in source control have never been confirmed to match
what's actually deployed — they were deployed by hand at some point, and
there's no CI step that deploys or diffs them.

**Where:** Firebase Console → your project → **Firestore Database → Rules**
tab (shows the currently active ruleset and when it was published), or
run `firebase firestore:rules get` from an authenticated `firebase` CLI
session (this session has neither the CLI installed nor credentials).

**What to check:** copy the live ruleset and diff it against
`firestore.rules` on `main` at `210555a`. Report whether they match.

**If they don't match:** tell Claude what's different — Claude can then
redeploy the source version (once given deploy credentials) or explain
why the live version differs (e.g., an emergency hand-patch that source
never caught up to).

---

## 4. Firestore Backup / Disaster Recovery

**Why:** no evidence exists that scheduled backups are enabled, and no
restore drill has ever been run (`docs/audit/BACKUP_AND_DISASTER_RECOVERY.md`
flags this as open).

**Where:** GCP Console → your project → **Firestore → Backups** (or
**Firestore → Import/Export** for older-style scheduled exports).

**Steps:**
1. Check whether a backup schedule already exists. If not, create one —
   daily is a reasonable starting point for this app's write volume.
2. Note the retention period and region.
3. At least once, actually restore a backup into a **separate, non-
   production** Firestore instance or export target to prove the restore
   path works, not just the backup path.

**Report back:** schedule (or "none"), retention, region, and whether a
restore has been tested. This feeds directly into Decision A in
`docs/PRODUCTION_BLOCKERS.md`.

---

## 5. GitHub Actions runner decision (#124, E2E flakiness)

**Why:** both free mitigations (`-cores 1`, and cutting emulator
resolution/density in #146) are merged and *confirmed* not to have fixed
the underlying 2-core runner saturation — load average stays at 3.9–4.7
and `qemu-system-x86_64` at ~170% CPU throughout the E2E run regardless.

**Where:** GitHub → this repo (or org) → **Settings → Actions → Runners**,
or **Settings → Billing → Plans and usage** to check what larger runner
tiers are available on the current plan.

**Decision:**
- **Upgrade** the E2E job to a larger (e.g. 4-core) hosted runner. Concrete
  cost impact: GitHub's larger Linux runners are billed per-minute at a
  higher multiplier than the free 2-core runner; the E2E job currently
  runs ~15-20 minutes per PR when it doesn't time out. Check GitHub's
  current published per-minute rate for the runner size you're
  considering before deciding.
- **Accept** intermittent `signup-journey`/`settings-signout` E2E failures
  as a known runner-capacity limit. The app-quality, functions-quality,
  build, and security jobs are unaffected and pass reliably regardless —
  only these two multi-minute emulator flows are at risk.

**Report back:** which option, so Claude can either update `ci.yml`'s
`runs-on` for the E2E job (if a specific self-hosted or larger runner
label exists) or update the roadmap to record the accepted risk.

---

## 6. Play Console — Billing Library 8 deadline extension

**Why:** #43's 31 Aug 2026 deadline has passed; the migration (RN 0.79.7
→ Firebase v21+ → New Architecture → react-native-iap 15.x) is a multi-step
process still in progress (step 1 in draft PR #141).

**Where:** Google Play Console → your app → **App content** or the Billing
Library policy notice you received.

**Action:** if an extension is available and not already granted, request
one via the Play Console's own "Request more time" flow tied to that
policy notice.

**Report back:** new deadline (if granted), so Claude can pace the
remaining steps accordingly.

---

## 7. Razorpay — plan prices and API keys (#129, items 1–2)

**Why:** the order-creation callable (the other half of #129, beyond the
webhook fix already in PR #143) needs real plan prices and a decision on
one-time orders vs. subscriptions — both business decisions, not
technical ones. It also needs live Razorpay API keys, which don't exist
until Razorpay approves the account.

**Action:**
1. Decide plan prices and billing model (one-time / subscription / both).
2. Once the Razorpay account is approved, get `key_id`/`key_secret` and
   add them to Secret Manager (not to the repo).

**Report back:** the prices/model decision, and confirmation once keys
exist, so Claude can implement the Auth-gated order-creation callable.

---

## 8. Branch protection on `main`

**Why:** Claude cannot currently confirm from the tools available in this
session whether `main` actually requires CI to pass before merge.

**Where:** GitHub → this repo → **Settings → Branches** → rule for `main`.

**What to confirm:** "Require status checks to pass before merging" is
enabled, and it lists the CI workflow's job names (and, if used, the
Claude Approvals check).

**Report back:** yes/no, so Claude can mark Phase 7C Decision C in the
roadmap.

---

## Change log
- 2026-09-24 — Created alongside `docs/PRODUCTION_BLOCKERS.md`.
