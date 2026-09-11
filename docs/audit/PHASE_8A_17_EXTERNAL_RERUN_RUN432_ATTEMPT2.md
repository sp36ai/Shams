# Phase 8A-17 — External Rerun: Run `#432` Attempt 2

Records an externally-triggered rerun of CI run `#432` (id
`34567267926`), discovered on reconnection of this session's GitHub
MCP access after an outage. **This attempt was not initiated by this
session, was not requested by the user in this conversation, and does
not constitute or imply any new CI Rerun Authorization.** It is
recorded here because it produced new, independently-useful
verification evidence for the Phase 8A-15 Option A remediation — not
because it was itself an authorized action.

## 1. What happened

- Checkpoint: `3d73998` (unchanged — this is the same commit run
  `#432`'s attempt 1 already ran against, per
  `PHASE_8A_16_CI_VERIFICATION_RUN432.md`).
- Run `#432`, id `34567267926`, now shows **`run_attempt: 2`**,
  executed `2026-09-11T08:03:49Z`–`08:19:28Z`.
- Cause: **external** — this session's GitHub MCP connection was
  disconnected for an extended window immediately before this attempt
  appeared; no `rerun_workflow_run` or `rerun_failed_jobs` call was
  made by this session at any point. The attempt was discovered only
  on reconnection, already completed.
- Shape of the rerun: a **"Re-run failed jobs"** action, not a full
  workflow rerun — `Functions Quality` and `App Quality` both retain
  their original attempt-1 timestamps (`05:46`–`05:48Z`) unchanged;
  only `E2E Tests (Maestro)` — the job that failed in attempt 1 —
  actually re-executed, with entirely new timestamps.

## 2. Results — a second independent confirmation of Option A

**`Save Gradle cache` executed and saved successfully a second time**,
on a run this session did not trigger and had no chance to influence
in advance — a genuinely independent data point, not a repeat of the
same test:

```
2026-09-11T08:19:26.4435864Z Cache saved with key: gradle-5116720148d99378d79c6eaa3923cff1b87600f8322d3dd119fa3854220545ca
```

This ran after the same failure sequence as attempt 1
(`Setup Android emulator` → `failure`, `Upload Maestro results` →
`failure`, `Publish test report` → `failure`) — reconfirming
`PHASE_8A_15_OPTION_A_REMEDIATION.md`'s fix holds on the failure path,
independent of who or what triggers the run.

**Option A is now verified by two independent runs (attempt 1 and
attempt 2 of `#432`), the second entirely outside this session's
control** — the strongest evidence available in this audit chain that
the fix is not order-of-operations-sensitive or specific to a single
triggering context.

## 3. Findings A and B — recurred, identical pattern (third occurrence)

```
2026-09-11T08:17:08.9257264Z [Failed] Journey — sign up through onboarding to the Oracle (38s) (Assertion is false: id: auth-tab-signup is visible)
2026-09-11T08:17:40.4858743Z [Failed] Auth — Sign In flow (32s) (Assertion is false: id: auth-tab-signin is visible)
2026-09-11T08:18:10.3177284Z [Failed] Settings — plan display and sign out (30s) (Assertion is false: id: settings-gear-btn is visible)
2026-09-11T08:18:10.3276025Z 3/3 Flows Failed
...
2026-09-11T08:18:37.7499404Z ##[error]Failed to CreateArtifact: Artifact storage quota has been hit. Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

Identical to both run `#431` and run `#432` attempt 1 — same three
flows, same three assertions, same quota error text verbatim. Neither
finding is remediated or further diagnosed here, per standing scope.
Emulator again booted successfully (`Boot completed in 71372 ms`),
consistent with the disk-exhaustion fix (Phase 8A-12) continuing to
hold on a third independent run.

## 4. Noted anomaly — not investigated

Attempt 1 and attempt 2 saved the Gradle cache under two **different**
key hashes for what should be the identical `hashFiles(...)` input on
the same commit (`3d73998`):

| Attempt | Saved key |
|---|---|
| 1 | `gradle-22c50f7ea7f3818d3d09372bb16d965f3648dd8bb0605ba1d1d88f6a3c8eacd2` |
| 2 | `gradle-5116720148d99378d79c6eaa3923cff1b87600f8322d3dd119fa3854220545ca` |

`hashFiles()` should be deterministic for identical file content
regardless of run or attempt. **This is recorded as an observation
only** — per the standing instruction, it is not chased now, since
current evidence does not show it caused or relates to any failure
(both attempts' `Setup Android emulator` failures and their
downstream cascades are already fully explained by Finding A). Left
for its own separate investigation only if it becomes relevant.

## 5. What this does and does not establish

**Does:**
- Provide a second, genuinely independent confirmation that Option A's
  fix works — not just on this session's own trigger, but on an
  externally-initiated rerun this session had no advance knowledge of.
- Reconfirm Findings A and B as stable, reproducible patterns across a
  third data point.

**Does not:**
- Constitute or imply a new CI Rerun Authorization. No further action
  (retry, remediation of Finding A/B, merge, or deployment) is
  authorized by this event.
- Change the production-readiness verdict, which remains unchanged.

## 6. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unchanged, confirmed at `2229c5d`.
- `claude/shams-phase-0-baseline-lnlmy6`: unchanged at `5f9c27c` prior
  to this document; this document adds one new commit. Working tree
  clean before and after.
- No file other than this document is touched. No code, workflow, or
  configuration change is made here.

---

## Status

**PHASE 8A-17 EXTERNAL RERUN RECORD: COMPLETE.**

| Layer | Status |
|---|---|
| Option A | ✅ Verified — now confirmed by two independent runs, the second externally triggered |
| Finding A (Maestro/UI) | ❌ Still open — recurred identically, third occurrence |
| Finding B (artifact quota) | ❌ Still open — recurred identically, third occurrence |
| Cache-key hash anomaly | 🔲 Observed, not investigated — no evidence it caused a failure |
| CI conclusion (attempt 2) | ❌ FAILURE |
| `main` | Unchanged — `2229c5d` |
| Feature branch | Unchanged prior to this commit — `5f9c27c` |
| New authorization implied by this event | ❌ None — explicitly not inferred |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting separate, explicit authorization for the next action —
remediation of Finding A, Finding B, or any other next step the owner
chooses.
