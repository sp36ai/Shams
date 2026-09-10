# Phase 8A-10 — CI Artifact-Quota Investigation

Narrowly scoped investigation per "Phase 8A-10 CI Artifact-Quota
Investigation Authorization — baseline afc3263." Purpose: restore
CI's ability to complete the E2E job, without modifying application
code, dependencies, Firebase rules, architecture, or Finding 3 A/B, and
without weakening or bypassing the E2E artifact step to force a green
result. **This investigation concludes at a hard-stop condition the
authorization itself named in advance — see §5. No repository file is
modified by this document; no CI run was triggered, retried, or
cancelled.**

## 1. Current GitHub Actions artifact/storage state

The exact failure this investigation traces:

```
##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

No tool available in this session exposes an aggregate,
repository-level storage-usage figure (percentage used, GB consumed,
plan limit) — GitHub's billing/storage-usage API is outside the
GitHub MCP tool surface this session has. What **is** directly
observable, and sufficient to characterize the problem precisely: the
`Merge Phase 0-8A hardening chain` run (`34385617156`) itself produced
**zero artifacts** (`list_workflow_run_artifacts` → `total_count: 0`)
— consistent with the log evidence that the APK upload failed outright
and the Maestro-results upload found nothing to upload.

## 2. What is actually consuming the quota — characterized from real artifact sizes, not guessed

Sampled two recent, successful `CI` runs directly:

| Run | `app-debug-apk` | `maestro-results` | Retention |
|---|---|---|---|
| `34034026624` (run #426) | **34,632,715 bytes (~33 MB)** | 377,354 bytes | expires ~90 days from creation |
| `34026041318` (run #421) | **34,632,720 bytes (~33 MB)** | 223,406 bytes | expires ~90 days from creation |

`ci.yml`'s two `actions/upload-artifact@v4` steps (lines 152, 192) set
**no `retention-days` input** — confirmed directly:

```
$ grep -n "retention-days\|upload-artifact" .github/workflows/ci.yml
152:        uses: actions/upload-artifact@v4
192:        uses: actions/upload-artifact@v4
```

With no explicit override, both artifacts fall back to the
account/repository's default retention (commonly 90 days on GitHub's
standard defaults). **Every successful `CI` run has been uploading a
~33 MB debug APK, retained for roughly three months, on top of a
smaller Maestro-results artifact.** `list_workflow_runs` for `ci.yml`
alone reports **423 total runs** for this repository, accumulated
since the workflow was first created (`2026-05-10`). Even accounting
for failed/skipped runs not producing an APK, the arithmetic is
unambiguous: a few dozen successful runs within any 90-day retention
window is already enough (dozens × ~33 MB) to exhaust a modest
GitHub-plan storage allowance — this is a naturally accumulating,
structural consequence of the workflow's own unbounded retention
setting, not a one-off spike caused by this specific merge.

## 3. Can this be resolved through repository/workflow configuration alone?

**Two distinct questions, answered separately, because the
authorization itself distinguishes them:**

- **Preventing the problem from recurring** (lowering
  `retention-days` on both `upload-artifact@v4` steps so future
  successful runs stop accumulating months of ~33 MB APKs): **yes,
  this is a legitimate workflow-configuration change** available in
  principle. It was **not made by this investigation** — see §5;
  making it now, mid-investigation, without the owner's explicit
  go-ahead on that specific change, would exceed a narrowly-scoped
  "investigate and report" mandate, and more importantly would not by
  itself solve the immediate blocker described next.
- **Freeing the storage already consumed, today, so the next CI run
  can complete**: **no tool available to this session can do this.**
  A systematic search of this session's entire GitHub tool surface
  (`ToolSearch` for delete/artifact/storage/billing capability) found
  no artifact-deletion method of any kind. The closest adjacent
  capability, `delete_workflow_run_logs` (via `actions_run_trigger`),
  deletes **logs**, a separate GitHub resource from artifact storage,
  and would not free any of the megabytes actually implicated here.
  GitHub's own error message states usage recalculates on a 6–12 hour
  cycle — implying the *existing* quota-exhausting artifacts must
  either expire on their own 90-day schedule or be manually deleted by
  someone with the access this session lacks; neither path is
  something a repository/workflow-file edit can accomplish today.

**Conclusion: resolving the immediate blocker requires GitHub
account/billing-owner access this session does not have** — either to
delete existing artifacts directly (via the GitHub web UI, which has a
manual per-artifact and bulk-delete capability this session's tool
surface does not expose), or to increase the account's storage
allowance.

## 4. Explicitly not done, per the authorization's own boundary

- **No change to the E2E artifact upload step.** The debug APK and
  Maestro-results uploads remain exactly as authored — not weakened,
  bypassed, or removed to force a green CI result.
- **No `retention-days` addition made.** Identified as a legitimate
  *future-prevention* lever in §3, but not applied — it would not
  resolve today's blocker (§3), and applying a workflow-configuration
  change mid-investigation, before reporting the hard-stop this
  authorization itself anticipated, would overreach this phase's
  narrow scope.
- **No application code, dependency, Firebase-rule, or architectural
  change.** No touch to Finding 3 Options A/B.
- **No CI rerun, retry, dispatch, or cancellation attempted** — a
  rerun now would fail identically, for the same reason, and the
  authorization's own step 5 ("If the quota can be legitimately
  resolved, rerun the normal CI") is conditioned on resolution first.
- **No workaround of any kind proposed or attempted** for the missing
  deletion capability (e.g., no attempt to call an unexposed GitHub
  REST endpoint directly, no attempt to script around the tool
  surface) — the absence of the capability is reported as a boundary,
  not routed around.

## 5. Hard-stop determination

**Triggered — exactly the first hard-stop condition the authorization
itself named in advance**: *"inability to resolve the quota without
owner/billing access."* Confirmed precisely, not assumed:

- No tool in this session's surface can delete a GitHub Actions
  artifact or query account-level storage usage/billing.
- The one configuration lever available (`retention-days`) addresses
  recurrence, not the already-consumed quota blocking the very next
  run.
- GitHub's own error message frames resolution as either time-bound
  (a 6–12 hour recalculation cycle, but only once artifacts naturally
  age past their retention window — up to 90 days out for the
  artifacts sampled in §2) or requiring direct account-level artifact
  deletion — both outside this session's reach.

**This investigation stops here, as instructed, and reports rather
than routes around the boundary.**

## 6. What the owner would need to do, stated factually, not as a recommendation this document authorizes

Two independent paths exist, either of which resolves the immediate
blocker; this document does not choose between them or authorize
either:

1. **Delete old artifacts manually** via the GitHub web UI (repo →
   Actions → an individual run's Artifacts section, or the
   organization/account-level storage settings page) — something only
   a human with the right GitHub permissions, outside this session's
   own access, can do.
2. **Increase the account's Actions storage allowance** (a
   billing-plan change) — also outside this session's access.

Separately, and only if the owner wants it, **adding
`retention-days: <N>` to both `upload-artifact@v4` steps in
`ci.yml`** would slow future re-accumulation — laid out here as an
identified option, not applied, and explicitly not a substitute for
resolving today's already-consumed quota.

## 7. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this investigation is written against: `afc3263`
  (Phase 8A-10 post-merge verification).
- `main` (`origin/main`): unchanged.
- Working tree: clean before and after this document.
- No `.github/workflows/` file, application code, dependency manifest,
  or Firebase-rule file is touched — the only file this phase adds is
  this document. No GitHub Actions run was triggered, retried,
  cancelled, or had its logs deleted.

---

## Status

**PHASE 8A-10 CI ARTIFACT-QUOTA INVESTIGATION: HARD-STOPPED, AS ANTICIPATED BY ITS OWN AUTHORIZATION.**

| Layer | Status |
|---|---|
| Artifact/storage state characterized | ✅ Complete — root cause is cumulative ~33 MB debug-APK uploads across 423 CI runs with unbounded default retention |
| Safely expirable artifacts identified | ✅ Identified in principle (old runs' APK artifacts) — **cannot be deleted from this session; no tool provides that capability** |
| Config-only resolution possible? | ⚠️ Partial — `retention-days` prevents recurrence but cannot free already-consumed quota |
| Billing/owner access required? | ✅ **Confirmed required** — hard-stop condition met |
| E2E artifact step weakened/bypassed | ❌ No — untouched |
| Application code / dependencies / Firebase rules / architecture | ❌ Untouched |
| Finding 3 (Options A/B) | 🔲 Untouched, not reopened |
| CI rerun | 🔲 Not attempted — resolution precondition not met |
| Remaining Phase 8A-10 production verification | 🔲 Still pending — blocked on this quota resolution |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting the owner's own action outside this session (artifact
deletion or storage-plan increase) and, separately, a decision on
whether to authorize a `retention-days` workflow-configuration change.
Once genuinely resolved, a fresh, separately authorized CI rerun
(governed by the existing `workflow_run` gate, not a new deployment
authorization) is the correct next step — not before.
