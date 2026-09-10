# Phase 8A-10 — CI Rerun Verification (run `#429`, `34512301237`)

Implements: "CI Rerun Authorization — checkpoint 2229c5d." Verifies the
first CI run against `main`'s new tip after the artifact-quota
remediation promotion (`docs/audit/PHASE_8A_10_PROMOTION.md`, merge
commit `2229c5d`). **Read-only — no retry, dispatch, config change, or
further merge is performed by this document.**

## 1. Run identification

- Run: `#429`, id `34512301237`, event `push` (the ordinary push that
  landed the merge commit — not the manual `workflow_dispatch` I also
  triggered and then cancelled as redundant; see prior status updates
  in-conversation for that housekeeping).
- `head_branch`: `main`. `head_sha`: `2229c5d` (the promotion merge
  commit) — confirmed exact match, not inferred.
- Final `status`: `completed`. Final `conclusion`: **`failure`**.

## 2. Findings, in the order specified by standing instruction

### 2a. Artifact step (the thing this whole detour was meant to fix)

| Step | Conclusion | Notes |
|---|---|---|
| Upload debug APK | **`skipped`** | Correct — this is a `push` event, not `workflow_dispatch`, so the new `if: always() && github.event_name == 'workflow_dispatch' && inputs.upload_debug_apk == true` condition correctly did not fire. |
| Upload Maestro results | `success` | Ran without a quota error. Uploaded nothing (`if-no-files-found: warn`) because `maestro-results.xml` was never produced — see §2b. |

`list_workflow_run_artifacts` on this run returns `total_count: 0` —
consistent with "ran cleanly, nothing to upload," not a quota failure.

**No artifact-storage-quota error occurred anywhere in this run.** The
retention-days + opt-in-upload fixes behaved exactly as designed. This
detour's original problem is not reproduced here.

### 2b. Maestro execution — did NOT happen

The `E2E Tests (Maestro)` job's `Setup Android emulator` step (which
embeds `adb install` → Maestro CLI install → `maestro test` in its
`script:` block) failed after only 49 seconds
(`18:23:07Z`–`18:23:56Z`), during Android SDK/system-image
installation — before the emulator ever booted, and therefore before
Maestro was ever invoked. Verbatim from the job log:

```
2026-09-10T18:23:55.4078377Z Warning: An error occurred while preparing SDK package
   Google APIs Intel x86_64 Atom System Image: No space left on device.
2026-09-10T18:23:55.8150894Z ##[endgroup]
2026-09-10T18:23:55.8160484Z ##[group]Terminate Emulator
2026-09-10T18:23:55.8175365Z [command]/usr/local/lib/android/sdk/platform-tools/adb -s emulator-5554 emu kill
2026-09-10T18:23:56.0203211Z error: could not connect to TCP port 5554: Connection refused
2026-09-10T18:23:56.0212591Z The process '/usr/local/lib/android/sdk/platform-tools/adb' failed with exit code 1
2026-09-10T18:23:56.0236509Z ##[endgroup]
2026-09-10T18:23:56.0236509Z ##[error]The process '/usr/bin/sh' failed with exit code 1
```

**Root cause: the GitHub Actions runner's local ephemeral disk ran out
of space** while `sdkmanager` was installing the Android emulator
system image (`system-images;android-31;google_apis;x86_64`). This is
distinct in kind from the original finding:

| | Original quota finding (`PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md`) | This run's failure |
|---|---|---|
| Resource | GitHub Actions **artifact storage** (account-level, cloud-side) | Runner's **local disk** (ephemeral, per-job, VM-local) |
| Failed at | `Upload debug APK` step | `Setup Android emulator` step, during SDK/system-image install |
| Fixed by this promotion? | Yes — no quota error occurred | No — unrelated resource, not addressed by retention-days or the opt-in-upload change |

`No test report files were found` on "Publish test report" is a
downstream cascade of §2b, not an independent failure: no
`maestro-results.xml` was ever produced because Maestro never started.

### 2c. Maestro result

**Not applicable — Maestro did not execute.** Per the standing
instruction, this is not treated as a Maestro failure to diagnose; it
is treated as "Maestro never ran," a distinct and prior-stage problem.

### 2d. CI conclusion

**FAILURE.** `App Quality` ✅ and `Functions Quality` ✅ (543/543) both
passed; `E2E Tests (Maestro)` ❌ failed before Maestro executed, for
the runner-disk-space reason in §2b.

### 2e. `workflow_run` deploy workflows

All three fired (twice each — once for the manually-dispatched run I
cancelled as redundant, once for this run's conclusion) against
`head_sha` `2229c5d`, and all six fired instances concluded
**`skipped`**:

| Workflow | Run | Conclusion |
|---|---|---|
| Deploy Cloud Functions | `#53` (`34514084743`) | `skipped` |
| Deploy Firebase Hosting | `#10` (`34514084762`) | `skipped` |
| Release to Play Store | `#120` (`34514084696`) | `skipped` |

**Option C's `workflow_run` deploy gate held correctly against this
CI failure**, exactly as it did for the previous (quota-caused)
failure documented in `PHASE_8A_9/10_POST_MERGE_VERIFICATION.md`. This
is now the second independent live confirmation of the gate under a
real failure.

### 2f. Deployed SHA / production verification

Not performed — no deploy workflow ran to completion, so there is
nothing new to verify. Deployed SHAs remain unchanged from the last
confirmed state (`PHASE_8A_10_POST_MERGE_VERIFICATION.md`).

### 2g. Readiness decision

**Not rendered by this document.** No readiness verdict change is
implied or claimed here — this document is a diagnostic record only,
per standing instruction that a readiness decision is its own separate
authorization.

## 3. What this run does and does not establish

**Does:**
- Confirm the artifact-storage-quota remediation (retention-days +
  opt-in-only debug-APK upload) works as designed: no quota error, the
  APK correctly wasn't uploaded on this ordinary push run, and the
  Maestro-results upload step ran cleanly.
- Confirm, a second time, that Option C's deploy gate correctly holds
  deployment when CI fails — including under two fired instances
  against the same commit.

**Does not:**
- Establish that E2E/Maestro can complete on `main` — a new, unrelated
  failure (runner local-disk exhaustion during Android SDK/system-image
  installation) prevented Maestro from ever starting.
- Change the production-readiness verdict in any direction.
- Constitute a CI pass by any reading — `App Quality` and
  `Functions Quality` passing does not substitute for `E2E`.

## 4. Hard-stop determination

Per the standing instruction ("If Maestro never starts again, we
should stop and diagnose that separately rather than call CI
successful"): **this is a stop condition.** The runner-disk-space
failure is a new, distinct problem, unrelated to and not caused by the
artifact-quota remediation just promoted. It requires its own separate
investigation/remediation authorization before any further CI rerun is
attempted — re-running without change would very likely reproduce the
same failure, since nothing in this run's diff addressed local runner
disk usage.

No retry, dispatch, config change, or further merge is performed by
this document.

## 5. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unchanged at `2229c5d` — this run did not
  and could not alter it (no deploy fired, no code pushed).
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed to
  it, adding one new commit. Working tree clean before and after.
- No production, test, Firestore-rule, CI-workflow, or
  deployment-configuration file is touched by this document.

---

## Status

**PHASE 8A-10 CI RERUN VERIFICATION: COMPLETE (as a diagnostic record).**

| Layer | Status |
|---|---|
| Artifact-quota remediation (this promotion's actual purpose) | ✅ Confirmed working — no quota error, opt-in policy correct |
| App Quality / Functions Quality | ✅ Both passed |
| E2E / Maestro execution | ❌ Did not start — runner local-disk exhaustion during Android SDK install, a new/unrelated failure |
| CI conclusion | ❌ FAILURE |
| `workflow_run` deploy gate | ✅ Held correctly (skipped, 2nd live confirmation) |
| Deployed SHA | Unchanged |
| Production readiness | ❌ NOT READY — unchanged, no verdict rendered here |

**Hard stop.** Awaiting a separate, explicit authorization to
investigate the runner local-disk-exhaustion failure before any further
CI rerun is attempted.
