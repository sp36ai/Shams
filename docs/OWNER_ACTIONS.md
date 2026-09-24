# Shams al-Asrār — Owner-Only Actions

Every item here requires a human credential, console access, billing
decision, or business judgment that a Claude Code session genuinely
cannot exercise. Each entry gives the exact console/menu/setting so it's
a checklist, not a research task. Engineering work that does **not**
depend on these continues in parallel — see `docs/PRODUCTION_BLOCKERS.md`
for what's already moving.

---

## 1. Register CI's debug keystore SHA-1 in Firebase Console (#132 — root-caused)

**Why:** #132 is now root-caused, not just traced — see PR #149's diagnostic
logging and PR #150's fix. CI's debug keystore used to be regenerated fresh
on every run (`keytool -genkeypair`), so its SHA-1 fingerprint was different
every time. Firebase's Android API key restrictions authorize by SHA-1, so
a fingerprint that changes every run can **never** be registered — every
CI signup was structurally rejected by Firebase Auth before the app's own
signup/navigation logic ever ran. Confirmed directly from #149's logcat:
```
[Auth] signUp(): createUserWithEmailAndPassword rejected
{ message: '[auth/unknown] An internal error has occurred.
  [ Requests from this Android client application
  com.astrosarfaraz.shamsalasrar are blocked. ]' }
```
`RootNavigator`'s gate logic was never the problem — it never advanced past
`Auth` because there was never an authenticated user to gate on. **This was
never a navigation bug.**

PR #150 commits a stable `android/app/debug.keystore` (Android's standard
debug-only convention — password `android`, never used for release
signing, never a secret) so CI now signs with the **same** identity every
run, giving it one SHA-1 that can be registered once.

**Where:** Firebase Console → Project Settings → your apps → the Android
app (`com.astrosarfaraz.shamsalasrar`) → **Add fingerprint**.

**Exact SHA-1 to add:**
```
07:0B:A6:7E:A3:A0:A7:8C:70:18:45:CE:5C:A5:B5:99:CF:08:18:2E
```

**Verification:** once registered, the next `signup-journey` CI run
(PR #149, still open, carries the diagnostic logging) should show
`signUp(): createUserWithEmailAndPassword resolved` instead of `rejected`,
and the `[Nav] RootNavigator gate` log should progress to
`LocationPermission`. Claude will confirm this on the next CI run once
the fingerprint is registered — report back once done and a re-run can
be triggered.

**Also unblocks:** #131 (E2E creates real accounts) is unaffected by this —
that's a separate, still-open concern about which Firebase project E2E
targets, not about whether the request is authorized at all.

---

## 2. Set up the E2E test account (`settings-signout`, issue #130)

**Why:** `settings-signout`'s Maestro flow needs to sign in as an existing
account to reach Settings. The job environment already confirms
`MAESTRO_E2E_TEST_ACCOUNT_EMAIL` / `MAESTRO_E2E_TEST_ACCOUNT_PASSWORD` are
empty — the secrets were never created. **Note:** this account will also
need item 1's SHA-1 fix in place first, or its own signup/creation will
hit the same rejection.

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
This is a **separate** problem from #132 above: #124 is why
`signup-journey`/`auth-signin` intermittently lose the emulator entirely
(`Android driver unreachable`); #132 was why, on the runs that *don't*
hit that, signup itself was rejected. Fixing #132 (item 1) will not fix
#124, and vice versa — both may need to be addressed for `signup-journey`
to pass reliably.

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
- 2026-09-24 — #132 root-caused (CI debug keystore SHA-1 instability blocking Firebase Auth); item 1 replaced with the SHA-1 registration it actually needs. See PR #149 (diagnostics) and PR #150 (fix).
- 2026-09-24 — Created alongside `docs/PRODUCTION_BLOCKERS.md`.
