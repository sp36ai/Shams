# Phase 8A-27 — CI Verification: Run `#436` (Resource-Constraint Diagnostic, First Exercise)

Implements the scheduled check-in on "CI Rerun Authorization —
checkpoint `b9a3e41`" — the first run to exercise the Phase 8A-26
resource-constraint diagnostic (memory/CPU sampler + `dmesg` OOM
check). **Read-only — no application, test, or workflow file is
changed by this document. No retry, no dispatch, no merge to `main`,
no config change (including no RAM/CPU bump), no remediation of
Finding A or B.** No production-readiness verdict change.

## 1. Run identification

- Run `#436`, id `34627268358`, event `workflow_dispatch`.
- `head_branch`: `claude/shams-phase-0-baseline-lnlmy6`. `head_sha`:
  `b9a3e41` — confirmed exact match via job metadata.
- Final `status`: `completed`. Final `conclusion`: `failure`.
- `Functions Quality`: ✅ success. `App Quality`: ✅ success.
  `E2E Tests (Maestro)`: ❌ failure.

## 2. A tooling limitation discovered this run: only the log's final ~4999 lines are retrievable

Before the findings below, a material limitation must be recorded
plainly, because it directly bears on which of the eight queued items
could actually be answered.

`get_job_logs` was called against the E2E job (id `103355864987`)
with `tail_lines` set to `8000`, then `20000`, then `6061` — **all
three calls returned the byte-for-byte identical payload**: 564,876
characters, exactly 4999 lines, spanning only `17:39:13Z`–`17:41:07Z`.
A control call with `tail_lines=200` correctly returned exactly 200
lines, confirming the tool's `tail_lines` parameter itself works — the
truncation is a separate, silent cap (observed here at ~565,000
characters / ~4999 lines) applied to the *response payload* on top of
whatever `tail_lines` requests, always keeping the portion nearest the
end of the log. Fetching the raw log directly via the signed Azure
blob URL (`get_job_logs` with `return_content: false`) was attempted
as a workaround and failed identically to the pattern already recorded
earlier in this audit chain: `CONNECT tunnel failed, response 403`
(egress proxy policy blocks `productionresultssa3.blob.core.windows.net`).

The job's own step timings (obtained separately via
`actions_list`/`list_workflow_jobs`, not subject to this cap) show the
`Show logcat and preserved Maestro debug artifacts` step — which
inlines full Maestro view-hierarchy JSON dumps — ran within the same
single wall-clock second (`17:39:13Z`) as `Show runner resource usage
and OOM check` and `Capture Android SDK/emulator toolchain versions`,
but evidently emitted enough raw log volume on its own to consume the
entire retrievable tail window. As a direct result: **the resource
sampler, the `dmesg` output, the toolchain-version capture, and the
post-setup disk-usage figures — all of which log chronologically
before `17:39:13Z` — are outside the window this session could
retrieve for this run.** This is recorded as an evidentiary gap for
this run specifically, not a finding that the diagnostic failed to
run (the job metadata confirms `Show runner resource usage and OOM
check` completed with `conclusion: "success"`, i.e. it ran and
produced *some* output — only its content is unretrievable here).

## 3. Item (d): whether all 3 flows failed with the visibility-timeout pattern — Confirmed via `dorny/test-reporter` output, which fell inside the retrievable window

```
Summary content:
![Tests failed](https://img.shields.io/badge/tests-3%20failed-critical)
maestro-results.xml | | 3 ❌ | | 186s
3 tests were completed in 186s with 0 passed, 3 failed and 0 skipped.

Journey — sign up through onboarding to the Oracle
  ❌ Journey — sign up through onboarding to the Oracle
    Assertion is false: id: auth-tab-signup is visible
Auth — Sign In flow
  ❌ Auth — Sign In flow
    Assertion is false: id: auth-tab-signin is visible
Settings — plan display and sign out
  ❌ Settings — plan display and sign out
    Assertion is false: id: settings-gear-btn is visible
```

**This is exactly the same deterministic pattern** observed in `#429`,
`#431`, `#432`×2, `#433`, and `#435` — the same three testIDs, the
same assertion-false failure class, no emulator/ADB-death signature
(the `#434` outlier's `device 'emulator-5554' not found` /
"Android driver unreachable" text does not appear anywhere in this
run's retrievable log). Combined duration for all three flows:
**186 seconds** — consistent with the 30–42s-per-flow range this audit
chain has established (186s / 3 ≈ 62s average, on the higher end but
not anomalous; no per-flow timestamps were retrievable to break this
down further, per §2).

This also resolves an apparent contradiction worth naming explicitly:
the `Setup Android emulator` step's own `conclusion` is `"failure"`
in the job metadata (§4). That is **not** a new, distinct failure mode
— the Maestro test run itself executes inside that step's `script:`
block, so a failing Maestro assertion (as confirmed above) is
sufficient on its own to make the whole step's exit code, and
therefore its conclusion, `"failure"`. No evidence of an emulator-boot
or setup-level failure distinct from the Maestro assertion failures
was found.

## 4. Item (h) and remaining items: overall conclusion, Finding B, Option A

**Overall CI conclusion: FAILURE**, driven entirely by
`E2E Tests (Maestro)`. Confirmed step-by-step timings via job metadata:

| Step | Started | Completed | Duration | Conclusion |
|---|---|---|---|---|
| Setup Android emulator | 17:32:08Z | 17:39:11Z | 7m 3s | failure (Maestro assertions, per §3) |
| Disk usage after Android SDK/emulator setup | 17:39:11Z | 17:39:12Z | 1s | success |
| Show runner resource usage and OOM check | 17:39:12Z | 17:39:13Z | 1s | success (content unretrievable, §2) |
| Capture Android SDK/emulator toolchain versions | 17:39:13Z | 17:39:13Z | <1s | success (content unretrievable, §2) |
| Show logcat and preserved Maestro debug artifacts | 17:39:13Z | 17:39:13Z | <1s | success |
| Upload Maestro results | 17:39:13Z | 17:39:14Z | 1s | **failure** |
| Publish test report | 17:39:14Z | 17:39:14Z | <1s | failure |
| Save Gradle cache | 17:39:14Z | 17:41:06Z | 1m 52s | **success** |

**Item (f) — Finding B**: recurred identically, confirmed directly in
the retrievable log:

```
##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
   Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

Unchanged from every prior sampled run. `Publish test report` failed
as a direct consequence (`dorny/test-reporter` correctly found and
reported the 3 failed tests per §3, then exited non-zero itself
because `fail-on-error` is set and failures were found — this is the
action behaving as configured, not a separate defect).

**Item (g) — Option A**: `Save Gradle cache` succeeded again
(`17:39:14Z`–`17:41:06Z`), running after the job's failure exactly as
designed. This is the **seventh** independent confirmation across
seven post-fix runs (`#432`×2, `#433`, `#434`, `#435`, `#436`).

## 5. Items (a), (b), (c), (e) — not established this run

Per §2, the memory/CPU sample timeline, the `dmesg` OOM-killer check,
whether the SystemUI ANR recurred, and toolchain/disk-headroom figures
could not be retrieved for run `#436` within this session's tooling.
**This is not evidence against the resource-constraint theory** —
it is an absence of data, not contrary data. The Phase 8A-26
diagnostic did run (job metadata confirms both relevant steps
completed successfully) and did presumably capture this information in
the job's full log; it simply falls outside the last-~4999-line window
`get_job_logs` can return for a job whose later steps emit enough raw
JSON to fill that budget on their own. This is a materially different
problem from what Phase 8A-26 was designed to solve, and would need
either a different retrieval path (not currently available — the raw
blob URL is proxy-blocked, per §2) or a future workflow change that
either shrinks the inlined-hierarchy-dump volume or emits the resource
sampler/dmesg output to a step that runs later in the job (after the
large inlined dumps) so it survives inside the retrievable tail.
**Neither change is made here** — recorded as an open follow-up for a
separate, explicit authorization.

## 6. What this run does and does not establish

**Does:**
- Reconfirm the deterministic visibility-timeout pattern for all three
  flows, identical to five of the six previously-sampled runs — `#436`
  is now the sixth confirmation of this pattern out of seven total
  sampled runs (`#434`'s emulator-death event remains the sole
  outlier).
- Rule out a recurrence of `#434`'s emulator/ADB-death failure mode.
- Reconfirm Finding B and Option A behave exactly as established.
- Surface a genuine, previously-unknown tooling limitation (§2) that
  determines what future runs' diagnostics can actually report on.

**Does not:**
- Confirm or refute the resource-constraint theory from
  `PHASE_8A_25_FINDING_A_ROOT_CAUSE_CORRECTION.md` — the specific
  data (resource sampler, `dmesg`) that would test it was not
  retrievable this run.
- Confirm or refute whether the SystemUI ANR recurred this run.
- Change emulator resource allocation or any other remediation.
- Address Finding B.
- Change the production-readiness verdict, which remains unchanged.

## 7. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  document.

---

## Status

**PHASE 8A-27 CI VERIFICATION (run `#436`): COMPLETE.**

| Layer | Status |
|---|---|
| Visibility-timeout pattern (all 3 flows) | ❌ Recurred — 6th confirmation across 7 sampled runs |
| `#434`'s emulator-death mode | ✅ Did NOT recur |
| `Setup Android emulator` step `conclusion: failure` | ✅ Explained — reflects the Maestro assertion failures inside its own script, not a distinct setup-level fault |
| Resource sampler (Phase 8A-26) | 🔲 Ran successfully; content unretrievable this session (§2/§5) |
| `dmesg` OOM check (Phase 8A-26) | 🔲 Ran successfully; content unretrievable this session (§2/§5) |
| SystemUI ANR recurrence | 🔲 Not established this run |
| Toolchain versions / disk headroom | 🔲 Not established this run |
| Finding B | ❌ Recurred — identical, still open |
| Option A (Gradle cache save) | ✅ 7th independent confirmation |
| CI conclusion | ❌ FAILURE |
| Production readiness | ❌ NOT READY — unchanged |

A genuine log-retrieval limitation (§2) is now on record. Awaiting a
separate, explicit authorization for the next step — a way to work
around the retrieval gap (e.g. relocating the diagnostic steps later
in the job, or reducing the inlined hierarchy-dump volume), a further
rerun as-is, a remediation attempt, Finding B's own next step, or any
other action the owner chooses.
