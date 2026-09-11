# Phase 8A-13 — CI Verification: Run `#431` (Disk-Remediation Test)

Implements: "CI Rerun Authorization — ISSUED" for checkpoint `c337180`
(items 1–5 of that authorization's scope). Verifies whether the Phase
8A-12 disk-exhaustion remediation (Options A + B) actually resolves
the failure documented in
`docs/audit/PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md`. **Read-only —
no retry, dispatch, merge to `main`, or config change is performed by
this document.** No production-readiness verdict is rendered here.

## 1. Run identification

- Run `#431`, id `34556644460`, event `workflow_dispatch`.
- `head_branch`: `claude/shams-phase-0-baseline-lnlmy6`. `head_sha`:
  `c337180` — confirmed exact match to the authorized checkpoint
  before triggering.
- Final `status`: `completed`. Final `conclusion`: **`failure`**.

## 2. Disk-instrumentation evidence (Option B)

Both new before/after brackets around the exact step that failed in
run `#429` ran successfully and produced measured numbers:

**Before Android SDK/emulator setup** (`03:13:47Z`):

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/root        72G   55G   17G  77% /
```
```
5.1G	/home/runner/.gradle
1.6G	/home/runner/work/Shams/Shams/node_modules
13G	/usr/local/lib/android/sdk
```

**After Android SDK/emulator setup** (`03:19:24Z`, i.e. after the
system-image install, full emulator boot, and the entire Maestro run):

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/root        72G   63G  8.8G  88% /
```

**17 GB free before the SDK/emulator step; 8.8 GB still free
afterward** — the step that exhausted disk to 0 in run `#429`
consumed roughly 8.2 GB here and finished with comfortable headroom
remaining. This is the first *measured* (not inferred) confirmation
that Option B's cleanup gave this job materially more room than it
had in `#429`, closing the "Not Verified: exact free-disk figures"
boundary `PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md` §5 flagged.

**Not retrievable this session**: the "Free disk space (pre-build)"
step's own before/after numbers (run `03:00:06Z`–`03:00:27Z`) fell
outside the tail-truncated log this session's log-fetch tool returns
for large jobs, and a direct fetch of the full log from GitHub's blob
storage was blocked by this environment's outbound proxy policy
(`productionresultssa4.blob.core.windows.net` is not on the allowed
egress list). **Not Verified**: the exact space reclaimed by the
`.NET`/Haskell/Boost/CodeQL/Docker cleanup specifically, as opposed to
the job's overall headroom at the SDK-install bracket, which *is*
measured above.

## 3. Gradle cache result (Option A)

The `Cache Gradle` step completed in the job's step list, but its
exact "hit" vs. "miss" log line falls in the same untrieved portion of
the log as §2's gap — **Not Verified** which it was this run.

What *is* directly observed: `Post Cache Gradle` (the save step)
again shows `conclusion: "skipped"` in the job's step list, the same
as both previously-sampled failing runs, **despite `save-always: true`
now being set**. This means Option A's intended fix — breaking the
"failure forfeits a cache save" pattern found in
`PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md` §3a — is **not confirmed
working as intended** by this run. This is flagged honestly as an open
question, not asserted as fixed: either `save-always`'s actual
semantics don't cover this run's specific failure path (the option's
job-status behavior was inferred, not confirmed against
`actions/cache@v4`'s real source in §2b of the prior remediation
doc), or something else suppressed the save. Determining which needs
its own follow-up, not assumed here.

## 4. Emulator boot — SUCCEEDED (the primary thing being tested)

```
2026-09-11T03:16:23.0693342Z 1
2026-09-11T03:16:23.0766021Z Emulator booted.
2026-09-11T03:16:31.6525029Z INFO | Boot completed in 77073 ms
```

The `Setup Android emulator` step ran for **5 minutes 9 seconds**
(`03:14:14Z`–`03:19:23Z`) before failing — compare run `#429`, which
died in **49 seconds**, before the emulator ever booted, on
`No space left on device`. **This run got past disk exhaustion, past
emulator boot, past APK install, and into the actual test run.** This
is the direct, primary evidence that Options A/B resolved the specific
failure they targeted.

## 5. Maestro execution — ACTUALLY RAN (the E2E acceptance criterion)

```
2026-09-11T03:16:51.2135695Z [command]/usr/bin/sh -c "$HOME/.maestro/bin/maestro" test --format junit --output maestro-results.xml .maestro/ci/
2026-09-11T03:16:52.5115361Z CI detected, analytics was automatically enabled.
2026-09-11T03:17:20.1530236Z Waiting for flows to complete...
2026-09-11T03:17:55.5821687Z [Failed] Journey — sign up through onboarding to the Oracle (34s) (Assertion is false: id: auth-tab-signup is visible)
2026-09-11T03:18:27.8092479Z [Failed] Auth — Sign In flow (32s) (Assertion is false: id: auth-tab-signin is visible)
2026-09-11T03:19:00.8819741Z [Failed] Settings — plan display and sign out (33s) (Assertion is false: id: settings-gear-btn is visible)
2026-09-11T03:19:00.8974985Z 3/3 Flows Failed
```

Maestro installed, launched, ran all three configured CI flows to
completion (each took 32–34 seconds, consistent with real UI
interaction rather than an immediate crash), and produced a genuine
result. **This satisfies the standing acceptance criterion — "Maestro
actually executes" — for the first time across every run examined in
this audit chain's promotion/CI-rerun history.**

## 6. Maestro result — FAIL (3/3 flows)

All three flows failed on the same class of assertion: an expected UI
element was not visible —

| Flow | Failure |
|---|---|
| Journey — sign up through onboarding to the Oracle | `Assertion is false: id: auth-tab-signup is visible` |
| Auth — Sign In flow | `Assertion is false: id: auth-tab-signin is visible` |
| Settings — plan display and sign out | `Assertion is false: id: settings-gear-btn is visible` |

**This is a genuine application/test-flow finding, not an
infrastructure failure.** All three missing elements are
authentication/settings-entry UI (`auth-tab-signup`,
`auth-tab-signin`, `settings-gear-btn`) — consistent with either a
real UI regression, a test-fixture/flow drift (the `.maestro/ci/`
flows expecting element IDs that changed), or an environment
difference specific to the CI mock (`google-services.json.ci`,
noted in `ci.yml`'s own comment as expected to fail live Firebase
calls, though these three assertions are about UI visibility, not
Firebase calls). **Root-causing which of these it is is explicitly
out of scope for this document** — per the standing instruction, this
report is evidence only, not a diagnosis or a fix.

## 7. Secondary finding: the artifact-storage quota error resurfaced

```
2026-09-11T03:19:24.3870606Z ##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
   Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

The `Upload Maestro results` step failed with the **same account-level
Actions artifact-storage quota error** this audit chain investigated
and remediated in Phase 8A-10 (`PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md`,
owner-side deletion of 91 obsolete artifacts, ~3.03 GiB freed,
independently verified at the time). This is a small (`maestro-results.xml`
is a few KB), previously-clean upload path (it worked without a quota
error on every sampled run since the fix, including run `#429`, which
reached this same step and uploaded successfully). Two explanations,
neither confirmed from available evidence:

- The account's Actions storage has filled again since the prior
  cleanup (new artifacts accumulating across the repository's many
  workflows), or
- GitHub's own usage-recalculation lag (the error text itself states
  "Usage is recalculated every 6-12 hours") means the previously
  freed space had not yet been credited back at the time of this run.

**Not investigated further here** — flagged as a distinct, secondary
finding for a separate authorization, not conflated with the
disk-exhaustion finding this run was specifically testing. `Publish
test report` also shows `failure`, but that is the expected,
by-design consequence of 3 real Maestro failures under
`fail-on-error: true` (§6), not a new/separate problem.

## 8. Overall CI conclusion

**FAILURE.** `Functions Quality` ✅ and `App Quality` ✅ both passed
(unchanged from every prior run). `E2E Tests (Maestro)` ❌ failed —
but for the first time in this audit chain's history, it failed
*because Maestro actually ran and found real test failures*, not
because of an infrastructure problem preventing it from running at
all.

| Failure mode | Run |
|---|---|
| Artifact-storage quota, before Maestro could even attempt to run | `#428` |
| Runner disk exhaustion, before the emulator booted | `#429` |
| **Maestro executed, ran to completion, found 3 real test failures** | **`#431` (this run)** |

## 9. Deploy-gate applicability

**Structurally not applicable, confirmed empirically.** All three
deploy workflows (`deploy-functions.yml`, `deploy-firebase-hosting.yml`,
`release-play-store.yml`) filter their `workflow_run` trigger to
`branches: [main]`. `c337180` and this run both live on
`claude/shams-phase-0-baseline-lnlmy6`. Checked directly: the most
recent `Deploy Cloud Functions` run is still `#53`
(`34514084743`, from the prior `main` CI run on `2229c5d`) —
**no new deploy-workflow run was triggered by `#431` at all**, not a
fired-and-skipped instance. This is expected branch-filter behavior,
not a gate failure, and this CI failure (real Maestro assertion
failures) would in any case have kept the gate closed if it had been
eligible to fire.

## 10. What this run does and does not establish

**Does:**
- Provide the first measured (not inferred) evidence that the Phase
  8A-12 disk-exhaustion remediation materially increased headroom at
  the exact point that previously failed (17 GB free before → 8.8 GB
  free after, vs. 0 free / `No space left on device` in `#429`).
- Confirm, for the first time in this audit chain, that Maestro can
  actually execute on this branch's current state.
- Surface a genuine application-level finding (3/3 E2E flows failing
  on missing auth/settings UI elements) that requires its own
  investigation — separate from, and unblocked by, the infrastructure
  work this audit chain has been doing.
- Surface a secondary, unresolved finding (artifact-quota error
  recurring on a previously-clean upload path) that also requires its
  own investigation.

**Does not:**
- Establish that Option A (`save-always`) works as intended — the
  cache-save step was still skipped this run; this needs its own
  follow-up, not an assumption either way.
- Constitute a CI pass. `E2E Tests (Maestro)` failed.
- Change the production-readiness verdict, which remains unchanged.
- Diagnose or fix the Maestro assertion failures or the recurring
  quota error — both are reported as evidence only, per this
  authorization's explicit scope.

## 11. Hard-stop / next-step determination

No P0/P1-class finding is raised by this document. The Maestro
assertion failures are an application/test-flow correctness question
requiring its own investigation and authorization — not a security or
production-data-integrity finding on the evidence gathered here. Per
standing practice, this remains a stop point: CI did not pass, so no
promotion, deployment, or readiness-verdict change follows from this
run. Two independent threads now need separate authorization before
any further CI rerun would be expected to reach a clean pass: (a) the
Maestro assertion failures (§6), and (b) the recurring artifact-quota
error (§7).

## 12. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — confirmed no new deploy-workflow
  run fired (§9); `c337180` was never merged.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No `ci.yml`, application, test, or deployment-configuration file is
  touched by this document.

---

## Status

**PHASE 8A-13 CI VERIFICATION (run `#431`): COMPLETE (evidence record; no verdict rendered).**

| Layer | Status |
|---|---|
| Disk-exhaustion remediation (Options A+B) — measured | ✅ Confirmed working — 17 GB → 8.8 GB free across the SDK/emulator step, vs. 0 free in `#429` |
| Option A (`save-always`) — cache-save behavior | 🔲 Not confirmed — `Post Cache Gradle` still skipped this run |
| Emulator boot | ✅ Succeeded (`Boot completed in 77073 ms`) — first success in this audit chain's sampled history |
| Maestro execution | ✅ Actually ran, all 3 flows to completion — acceptance criterion met for the first time |
| Maestro result | ❌ 3/3 flows failed — genuine application/test-flow finding, not infra |
| Artifact-storage quota | ❌ Recurred on `Upload Maestro results` — secondary, unresolved finding |
| CI conclusion | ❌ FAILURE |
| Deploy gate | N/A — structurally, confirmed empirically (no run fired) |
| Production readiness | ❌ NOT READY — unchanged, no verdict rendered here |

Awaiting separate, explicit authorization for either open thread: (a)
investigating the Maestro assertion failures, or (b) investigating the
recurring artifact-storage quota error — or any other next action the
owner chooses.
