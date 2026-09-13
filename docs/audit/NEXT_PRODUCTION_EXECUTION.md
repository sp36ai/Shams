# NEXT_PRODUCTION_EXECUTION — Handoff for the Next Claude Code Session

**Read this file first, before doing anything else.** Then run:
```
git status
git branch --show-current
git rev-parse HEAD
```
and confirm they match §1 below before trusting anything else in this
document.

## 1. Current state (authoritative as of this commit)

- Repository: `sp36ai/shams`.
- Active branch: `claude/shams-phase-0-baseline-lnlmy6`.
- `main`: includes PR #111 (Finding B retention fix) merged at `56a5c9e`.
  Does **not** include any of this branch's Phase 8A diagnostic/audit
  work — that all lives on the feature branch, unmerged.
- PR #109: **closed**, superseded by #110 (was corrupted invalid
  YAML — do not resurrect, do not repair).
- PR #110: **merged** — the clock-offset fix.
- PR #111: **merged** — `retention-days: 30 → 3` for
  `release-play-store.yml`'s AAB artifact.
- **Production readiness: NOT READY.** Nothing in this document
  changes that.

## 2. The four parallel workstreams and their exact state

### Finding A — E2E test failures, split into three independent signatures

**A1 — SystemUI ANR.**
- **Confirmed real** via a direct, official Android ANR trace,
  captured once so far: run `#441` —
  `ANR in com.android.systemui`, PID 787, Reason:
  `executing service com.android.systemui/.dump.SystemUIAuxiliaryDumpService`
  (`docs/audit/PHASE_8A_35_CI_VERIFICATION_RUN441.md`).
- An observer-effect hypothesis was raised (does this audit chain's
  own `adb shell dumpsys cpuinfo` polling contribute to/trigger this
  ANR?) and **tested** via a `disable_observer` workflow input
  (`PHASE_8A_38`) across 6 runs (`#444`–`#449`, 3 control/3 treatment,
  all at checkpoint `782d92e`/`a50b354`).
- **Result: inconclusive, leaning against the hypothesis.** Zero
  formal ANR occurred in either condition across all 6 runs
  (`PHASE_8A_39` covers `#444`/`#445`; `#446`–`#449` were pulled in
  this session but not yet written up as their own numbered doc —
  raw grep results are in this document, §3, and should be turned
  into `PHASE_8A_41` by whoever picks this up next if a formal record
  is wanted).
- **Current engineering judgment**: the underlying ANR event has a
  low, intermittent base rate (1 confirmed occurrence in ~10 sampled
  runs with this diagnostic active). 6 further runs showing zero
  occurrences in either condition does not prove the observer
  contributes to it, nor does it disprove it cleanly — it just means
  this experiment design has hit diminishing returns for now. **Do
  not increase RAM/CPU or change the AVD based on this alone.**
  Recommended next move for A1 specifically: either (a) accept A1 as
  a documented, rare, evidenced-but-not-yet-causally-explained
  phenomenon and deprioritize it below A2/`#436` (which occur far
  more consistently), or (b) if resuming, examine `system_server`/
  `PackageManager` lock contention directly (present in nearly every
  run, ANR or not) as the more promising causal thread, independent of
  this audit chain's own instrumentation.

**A2 — ADB/device transport loss.**
- First seen in run `#434` (`device 'emulator-5554' not found`,
  "Android driver unreachable").
- **Recurred again in this session's run `#448`** (a control run,
  `disable_observer=true` — the guest-cpuinfo sampler was OFF, so
  this rules out that specific instrumentation as A2's cause). Test
  duration was 1204s (vs. the normal ~100–220s) with the failure
  message `Android driver unreachable` / `Unable to launch app
  com.astrosarfaraz.shamsalasrar: Android driver unreachable`.
- **Not yet investigated as its own thread.** This is the next
  concrete, evidenced piece of work: trace ADB server state → USB/TCP
  transport → emulator process liveness → Android boot/`sys.boot_completed`
  state → Maestro driver reconnection attempts, with timestamps, the
  same way A1's ANR trace was pinned down. The existing `logcat.txt`
  capture and `resource-usage.txt`/`guest-cpuinfo.txt` samplers
  already exist in `ci.yml`; what's missing is a targeted ADB-state
  sampler (`adb get-state`, `adb devices -l`, `adb shell getprop
  sys.boot_completed`, `adb shell uptime` — sampled on the same 3s
  cadence, same host-UTC clock as the existing samplers) to build a
  causal chain instead of a single top-level error message.

**`#436` — unclassified assertion failure.**
- Original evidence: `auth-tab-signin` visibility assertion failed
  with a `kotlinx.coroutines.scheduling.CoroutineScheduler$Worker`
  frame in the stack — neither the A1 nor A2 signature.
- **Not reproduced since**, and **not yet independently
  re-investigated** in this session. Treat the coroutine frame as
  probably just where async work happened to be executing when the
  timeout fired, not the root cause — the real question (per the
  standing plan) is where in the tap → RN event → auth-state update →
  native UI transition → render → Maestro-assertion chain the delay
  actually occurred. Not started.

### Finding B — Artifact storage quota

- **Root cause established and independently verified this session**:
  `release-play-store.yml` uploaded a uniquely-named (never-
  overwriting), ~24MB AAB per release run, 30-day retention. 23
  successful release runs in a 30-day window ≈ 552MB — over a 500MB
  cap on its own (`PHASE_8A_36`).
- **Preventive fix merged**: PR #111, `retention-days: 30 → 3`
  (`c56a5c9e` on `main`).
- **NOT resolved**: existing stored artifacts under the old 30-day
  retention are still consuming quota and will continue to until they
  individually age out (up to ~30 more days from whenever they were
  uploaded) or are explicitly deleted. **No deletion has been
  performed** — this needs its own explicit authorization before
  acting, per this audit's standing discipline around destructive
  actions. The quota-exhaustion error (`Failed to CreateArtifact:
  Artifact storage quota has been hit`) will likely keep recurring on
  every CI run's `Upload Maestro results` step until that inventory
  is addressed.

### CI diagnostic infrastructure — hardening status

- The `#438` self-inflicted defect (multi-line shell block breaking
  under `reactivecircus/android-emulator-runner`'s per-line-`sh -c`
  execution model) is fixed and merged (PR #110).
- All diagnostics currently live inline in `ci.yml`'s `script:` blocks
  as single self-contained lines — this works but is fragile by
  nature (as `#438` demonstrated). **Not yet done**: moving complex
  diagnostic logic into checked-in `.github/scripts/e2e/*.sh` files
  invoked as a single command, which would make future diagnostic
  additions much safer. This is a real, but lower-priority,
  improvement — do not attempt it before A2/`#436` are further along,
  since it would touch the same script blocks currently under active
  experimentation.

## 3. Raw evidence from this session's last 4 experiment runs (#446–449)

Pulled and grepped, not yet written up as a formal numbered doc:

| Run | Mode (empirically confirmed via guest-cpuinfo.txt) | Duration | Result |
|---|---|---|---|
| `#446` (id `34706068685`) | Control (absent) | 219s | Standard 3-flow visibility-timeout pattern, no ANR |
| `#447` (id `34706071603`) | Treatment (72 samples) | 200s | Standard pattern, no ANR |
| `#448` (id `34706084102`) | Control (absent) | **1204s** | **A2 signature** — `Android driver unreachable` |
| `#449` (id `34706085177`) | Treatment (72 samples) | 187s | Standard pattern, no ANR |

Combined with `#444`/`#445` (`PHASE_8A_39`): **3 control runs, 3
treatment runs, 0 ANR occurrences in either condition, 1 A2 occurrence
(control only)**. `git diff` for `ci.yml` at this state is unchanged
since `782d92e` (the `disable_observer` input) — no further workflow
edits happened during this experiment.

**Recommended immediate next step for whoever resumes**: write up
`PHASE_8A_41_A2_RUN448_INVESTIGATION.md` from run `#448`'s job log
(id `103586578172`) — the full ADB-driver-unreachable timeline is
already sitting in that job's log, just not yet extracted and
correlated the way `#441`'s A1 evidence was. This is likely the
highest-value single next action.

## 4. Exact commands to resume (verified working this session)

```bash
# Confirm state
git fetch origin claude/shams-phase-0-baseline-lnlmy6
git checkout claude/shams-phase-0-baseline-lnlmy6
git status --porcelain=v1 -b
git rev-parse HEAD

# List recent CI runs
# (via mcp__github__actions_list, method: list_workflow_runs,
#  resource_id: "ci.yml", workflow_runs_filter: {"branch":
#  "claude/shams-phase-0-baseline-lnlmy6", "event": "workflow_dispatch"})

# Pull a job's log (large logs get saved to a file; original_length
# in the JSON tells you the true total line count — get_job_logs
# reliably returns only roughly the final ~5000 lines regardless of
# tail_lines requested, a known limitation documented in PHASE_8A_27)

# Trigger a new run (workflow_dispatch, optionally with
# {"disable_observer": true|false} to continue the A1 experiment)
```

## 5. What NOT to do without fresh, explicit authorization

- Do not merge anything further to `main` without checking `git log
  origin/main` first for what's already there.
- Do not delete any AAB artifacts (Finding B's remaining cleanup) —
  destructive, needs its own go-ahead.
- Do not change `hw.ramSize`/`hw.cpu.ncore` or any AVD/emulator
  resource allocation — no evidence supports it yet (see A1 above).
- Do not touch the judgment engine, oracle composer, or any
  RKP/astrology calculation code — none of this audit chain has
  touched that, and nothing here implies it should.
- Do not declare production readiness. The criteria for that (all
  three Finding-A threads resolved or explicitly accepted as known
  limitations, Finding B's existing inventory cleared, a clean E2E
  run, and the standard release-candidate checks) are not yet met.

## 6. Full audit trail (chronological, for anyone wanting the detail behind any line above)

`docs/audit/PHASE_8A_10_*` through `PHASE_8A_40` (this document
supersedes none of them — it's a summary/index, not a replacement).
Notable checkpoints: `PHASE_8A_25` (first SystemUI-ANR evidence via
Maestro overlay), `PHASE_8A_29` (host-side CPU contention data),
`PHASE_8A_31`/`32` (the `#438` defect and its fix), `PHASE_8A_35`
(first direct logcat ANR trace), `PHASE_8A_36` (Finding B root cause),
`PHASE_8A_38`/`39` (the observer-effect experiment and its first
result pair).

---

**Status when this document was written**: Finding A open (A1
inconclusive/deprioritized pending better evidence, A2 has fresh
unanalyzed evidence in `#448`, `#436` not reproduced/re-investigated),
Finding B open (fix merged, existing inventory not cleared), CI
diagnostics stable but not yet hardened into checked-in scripts,
production NOT READY.
