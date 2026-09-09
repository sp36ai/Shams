# Phase 8A-10 — Post-Merge CI & Deployment Verification

Read-only verification of the actual GitHub Actions state following
the Phase 8A-8 merge, resuming and completing
`docs/audit/PHASE_8A_9_POST_MERGE_VERIFICATION.md` once CI reached a
conclusion. Baseline: `7770a35` / `origin/main` `61ddf4a`. **No code
was modified, no merge performed, no deployment triggered, retried, or
dispatched, and no configuration altered by this document.**

## 1. Final CI conclusion for `61ddf4a`

```
Workflow: CI (ci.yml), run #428, id 34385617156
head_sha: 61ddf4a913600c35ac66aae09fd5795a2537698b
status:   completed
conclusion: FAILURE
created:  2026-09-09T17:52:54Z
completed: 2026-09-09T18:07:39Z   (~15 minutes total)
```

| Job | Conclusion |
|---|---|
| Functions Quality | ✅ **success** |
| App Quality | ✅ **success** |
| E2E Tests (Maestro) | ❌ **failure** |

**Overall CI conclusion: FAILURE**, caused entirely by the E2E job.

## 2. Root cause of the E2E job failure — read from the actual job logs, not inferred

The debug APK build itself **succeeded** (`Build debug APK (embedded
JS bundle)`, 17:58:57Z–18:07:35Z, ~8.5 minutes, `conclusion: success`).
The failure occurred one step later:

```
##[group]Run actions/upload-artifact@v4
  name: app-debug-apk
  path: android/app/build/outputs/apk/debug/app-debug.apk
...
##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

**This is a GitHub Actions billing/storage-quota exhaustion, not a
code defect.** The repository's GitHub Actions artifact storage quota
has been hit; GitHub's own message states usage recalculates on a
6–12 hour cycle. Everything downstream of that single failed step
cascaded predictably and is fully explained by it, not by independent
new failures:

- `Enable KVM` / `Setup Android emulator` — both `skipped` (the job
  never reached the point of needing an emulator, since the APK upload
  step failed first).
- `Upload Maestro results` — `success`, but with a warning: *"No files
  were found with the provided path: maestro-results.xml... No
  artifacts will be uploaded"* — expected, since Maestro itself never
  ran (no emulator was ever set up).
- `Publish test report` — `failure`, because `dorny/test-reporter`
  found no `maestro-results.xml` to parse (`##[error]No test report
  files were found`) — again, a direct, mechanical consequence of the
  same root cause, not a second independent defect.

**No Maestro E2E flow (`01_auth_validation`, `02_signup_journey`,
`03_settings_and_signout`) ever executed against the merged code.**
This CI failure provides zero evidence, positive or negative, about
whether the merged application code itself would pass those flows —
it is an infrastructure ceiling that stopped the job before the tests
could run, entirely orthogonal to the 91-commit hardening chain's own
content. `Functions Quality` and `App Quality` — the two jobs that
exercise the actual regression suites this audit chain has run
repeatedly throughout (543/543 functions, 306/306 app) — both passed
cleanly against this exact merge commit.

**Per the branching rule this phase was authorized under ("CI fails:
stop... investigate the failure as a separate authorization"), this
document stops here on the investigation. Root-causing or fixing an
Actions storage-quota exhaustion is an account/billing-level action
this session has no visibility into or authority over — as
environment-blocked as GCP Console access has been throughout this
audit chain — not a code remediation.**

## 3. Did each of the three `workflow_run` deploy workflows fire?

**Yes — and each correctly self-skipped rather than deploying.** This
is the first live confirmation of the full Option C mechanism,
completing what `PHASE_8A_9_POST_MERGE_VERIFICATION.md` §4 could only
partially observe (that no deploy fired *while CI was still running*).
Now that CI has concluded, the picture is complete:

| Workflow | Run | Event | Conclusion |
|---|---|---|---|
| Deploy Cloud Functions | run #51, id `34387114605` | `workflow_run` | **skipped** |
| Deploy Firebase Hosting | run #8, id `34387114663` | `workflow_run` | **skipped** |
| Release to Play Store | run #118, id `34387114577` | `workflow_run` | **skipped** |

All three fired at `18:07:42`–`18:07:43Z` — within seconds of CI's own
`18:07:39Z` completion, confirming the `workflow_run` trigger correctly
activated the instant the named `CI` workflow completed. All three
carry `head_sha: 61ddf4a` (the merge commit) and all three show
`conclusion: skipped` — each workflow's own `if:` condition (checking
`github.event.workflow_run.conclusion == 'success'`) correctly
evaluated false given CI's failure, and each job body never executed
at all.

**This is exactly the behavior Finding 3 Option C was built and
reviewed to produce, now confirmed under a real failure, not just a
real success or a theoretical case**: a commit whose CI failed did
**not** reach any of the three production deploy targets.

## 4. Exact deployed SHA for each target

**Unchanged from before this merge — confirming nothing new deployed:**

- **Cloud Functions**: still `ce536bc` (run #50, the pre-merge
  commit — last touched in this session's own Phase 7C §4
  verification).
- **Firebase Hosting**: still `7df767f` (run #7, pre-merge, stale for
  the same path-filtering reasons already documented).
- **Play Store**: still `b9c8f943f` (run #117, pre-merge).

## 5. Cloud Functions revision / Hosting version / Play Store release state actually serving traffic

**Not applicable to check further — nothing changed to check.** Since
§3–§4 establish that none of the three deploy workflows executed
their deploy steps at all (each `skipped` before running any command
that would touch Firebase or Google Play), the revision/version
actually serving traffic is, by direct logical consequence, identical
to what `PHASE_7C_FINAL_DECISION.md` §4 already independently verified
for the pre-merge state. This document does not re-query Firebase
Console or the Play Console (both remain environment-blocked, as
throughout this entire audit chain) because the GitHub Actions
evidence in §3 is already conclusive on this specific question: no new
deployment attempt was made, successful or otherwise.

## 6. Post-deployment regression/health verification

**Not performed, and not applicable.** No deployment reached
production as a result of this merge — there is no "resulting state"
distinct from the pre-merge state to verify. Re-running health checks
against Cloud Functions/Hosting/Play Store at this point would only
re-confirm what `PHASE_7C_FINAL_DECISION.md` §4 already established
for `ce536bc`, and would not test anything about `61ddf4a`, since
`61ddf4a` was never deployed.

## 7. Can the production-readiness verdict change from NOT READY?

**No.** Restating the causal chain plainly:

```
Merged → CI FAILED → deployment correctly withheld → nothing new deployed
```

`main` at `61ddf4a` contains the full Phase 0–8A-5 hardening chain in
its committed source — that fact is unchanged and remains true
regardless of this CI outcome. But **the running production system is
still exactly what it was before this merge**: Cloud Functions,
Hosting, and Play Store are all still serving the pre-merge commits.
None of Findings 1, 2, 3(C), or 6's fixes — nor the narration-safety-
validation remediation from Phase 8A-1–8A-5 — are live in production.
**Production readiness remains NOT READY, unchanged from
`PHASE_7C_FINAL_DECISION.md`'s original verdict**, for the same
reasons as before this merge attempt, not new ones.

## 8. What this phase does not do, per its own authorized boundary

- Does not merge anything further.
- Does not dispatch, retry, or re-run the failed CI run or any deploy
  workflow.
- Does not redeploy anything.
- Does not alter any workflow, quota, or repository configuration.
- Does not reopen Finding 3 Options A/B — unaffected by this outcome,
  still recorded residual/owner decisions. (Worth noting for the
  record: this CI failure is unrelated to the trust-boundary question
  Options A/B address — it is a storage-quota ceiling, not a
  bad-deploy-reaching-production scenario Options A/B would guard
  against. Option C's own behavior, independent of A/B, is what
  correctly prevented any deployment here.)
- Does not fix the artifact-storage-quota condition — flagged for a
  separate, explicit authorization (most plausibly an owner-level
  billing/storage action, or a CI-workflow change to stop uploading
  the APK artifact when it isn't needed downstream, if the owner wants
  a code-level mitigation instead).

## 9. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this verification is written against: `7770a35`
  (Phase 8A-9 interim verification).
- `main` (`origin/main`): unchanged at `61ddf4a` — this document
  neither advances nor alters it.
- Working tree: clean before and after this document.
- No file outside `docs/audit/` is touched. No GitHub Actions run was
  triggered, cancelled, retried, or re-run by this phase — only
  read-only `list_workflow_runs`, `get_workflow_run`,
  `list_workflow_jobs`, and `get_job_logs` calls were used.

---

## Status

**PHASE 8A-10 POST-MERGE VERIFICATION: COMPLETE.**

| Layer | Status |
|---|---|
| Phase 8A-8 Merge | ✅ Complete (`61ddf4a`, in `main`'s committed source) |
| CI on merge commit | ❌ **FAILED** — E2E job, root cause: GitHub Actions artifact storage quota exhausted (infrastructure, not code) |
| Functions Quality / App Quality | ✅ Both passed |
| Deploy Cloud Functions | ⛔ Correctly **skipped** — gate behaved exactly as designed |
| Deploy Firebase Hosting | ⛔ Correctly **skipped** |
| Release to Play Store | ⛔ Correctly **skipped** |
| Deployed SHAs (all 3 targets) | Unchanged from pre-merge |
| `workflow_run` gate (Finding 3 Option C) | ✅ **Fully confirmed correct** under a real failure — first complete live behavioral evidence |
| Production readiness | ❌ **NOT READY — unchanged** |
| Finding 3 (Options A/B) | 🔲 Untouched, not reopened |

Awaiting a separate, explicit authorization for whichever next step
the owner chooses: investigating/remediating the CI artifact-storage-
quota condition, re-triggering CI once the quota clears, or any other
action. This document performs and recommends none of them.
