# Phase 8A-29 — CI Verification: Run `#437` (Diagnostic Relocation, First Full Exercise)

Implements: "CI Rerun Authorization — checkpoint `a1c4790`." First run
to exercise the Phase 8A-28 diagnostic relocation, and the first run
in this audit chain where the Phase 8A-26 resource/OOM diagnostic and
the Phase 8A-20 toolchain-capture diagnostic are both retrievable
end-to-end. **Read-only — no application, test, or workflow file is
changed by this document. No retry, no dispatch, no merge to `main`,
no config change, no remediation of Finding A or B.** No
production-readiness verdict change.

## 1. Run identification

- Run `#437`, id `34639974238`, event `workflow_dispatch`.
- `head_branch`: `claude/shams-phase-0-baseline-lnlmy6`. `head_sha`:
  `a1c4790` — confirmed exact match via job metadata before and after
  triggering.
- Final `status`: `completed`. Final `conclusion`: `failure`.
- `Functions Quality`: ✅ success. `App Quality`: ✅ success.
  `E2E Tests (Maestro)`: ❌ failure.

## 2. The relocation worked: all Phase 8A-28/8A-26/8A-20 diagnostics are now retrievable

This run's total raw job log is 6,409 lines (per `get_job_logs`'s
`original_length` field) — smaller than run `#436`'s 11,060 — and the
retrievable tail (the same ~4999–5000-line/~756KB cap observed before)
now comfortably spans from `19:58:26Z` (the start of `Show logcat and
preserved Maestro debug artifacts`) through the job's end
(`19:59:24Z`). Confirmed via the job's step list that the relocated
steps now run in the intended order:

```
Show logcat and preserved Maestro debug artifacts   19:58:26–19:58:27  success
Show runner resource usage and OOM check              19:58:27–19:58:27  success
Capture Android SDK/emulator toolchain versions        19:58:27–19:58:27  success
Upload Maestro results                                  19:58:27–19:58:27  failure
Publish test report                                     19:58:27–19:58:28  failure
Save Gradle cache                                       19:58:28–19:59:24  success
```

Both diagnostic steps' full output is present in the retrievable log
this time — the specific gap `PHASE_8A_27` recorded is closed for
this run.

## 3. Item — memory/CPU sampler: real, sustained memory pressure; no OOM-killer event

Full 10-second-interval samples recovered, `19:55:41Z`–`19:58:23Z`
(the sampler's last write before the emulator step tore down):

| Time (UTC) | Available mem | Swap used | qemu RSS | qemu %CPU |
|---|---|---|---|---|
| 19:55:41 | 4.0Gi | 48Ki | 2.98GB | 165% |
| 19:55:51 | 3.8Gi | 48Ki | 2.98GB | 162% |
| 19:56:01 | 3.8Gi | 48Ki | 2.98GB | 163% |
| 19:56:11 | 3.8Gi | 48Ki | 2.99GB | 164% |
| 19:56:21 | 3.7Gi | 48Ki | 3.04GB | 165% |
| 19:56:31 | 3.7Gi | 48Ki | 3.07GB | 167% |
| 19:56:41 | 3.6Gi | 48Ki | 3.12GB | 168% |
| 19:56:51 | 3.7Gi | 48Ki | 3.12GB | 168% |
| 19:57:02 | 3.6Gi | 48Ki | 3.12GB | 169% |
| 19:57:12 | 3.6Gi | 48Ki | 3.12GB | 170% |
| 19:57:22 | 3.6Gi | 48Ki | 3.12GB | 171% |
| 19:57:32 | 3.6Gi | 48Ki | 3.13GB | 171% |
| 19:57:42 | 3.6Gi | 48Ki | 3.14GB | 172% |
| 19:57:52 | 3.6Gi | 48Ki | 3.14GB | 173% |
| 19:58:02 | 3.6Gi | 48Ki | 3.14GB | 174% |
| 19:58:12 | 3.8Gi | 48Ki | 3.01GB | 174% |
| 19:58:23 | 4.2Gi | 278Mi | 2.82GB | 169% |

(The "available" column above is the `free -h` **available** figure,
already accounting for reclaimable buffer/cache — distinct from the
raw "free" figure, which sat far lower, around 190–270Mi for most of
the run, before recovering at `19:58:12`/`19:58:23` as `emulator -kill
3901 -sleep 20` appears in the process list — i.e. exactly the
emulator's own teardown.)

**What this shows:**
- The `qemu-system-x86_64-headless` process consumes **more than one
  full CPU core throughout** (165–174%, on the AVD's own configured
  `hw.cpu.ncore = 2`) and its resident memory climbs steadily
  (2.98GB → 3.14GB) across the ~2.5-minute sampled window before the
  run ends and the emulator is killed.
- **Buffer/cache stayed consistently high (~3.6–3.8Gi)** throughout,
  meaning the "available" figure (which counts reclaimable cache) never
  collapsed the way it would under true memory exhaustion — this
  system was not on the edge of an actual out-of-memory condition by
  this measure.
- **Swap was essentially untouched (`48Ki` used) for the entire
  sampled run**, only rising to `278Mi` at the very last sample
  (`19:58:23`), which coincides with the emulator teardown process
  itself, not a mid-run event.
- **`dmesg` found no OOM-killer or memory-pressure lines**:
  ```
  ##[group]dmesg -- OOM-killer / memory-pressure evidence
  no OOM-related dmesg lines found (or dmesg unavailable)
  ##[endgroup]
  ```

**This is a material, precision-improving correction to the Phase
8A-25 resource-constraint theory, not a confirmation of it as
originally framed.** There is real, sustained resource pressure —
sustained multi-core CPU saturation by the emulator process and a
steadily growing memory footprint on a runner configured for a
2-vCPU/1536M AVD — but **no evidence of an actual out-of-memory
condition**: no kernel OOM-kill, no meaningful swap usage, and ample
reclaimable buffer/cache headroom throughout. The theory should now be
understood as **sustained CPU contention** (the emulator process alone
consuming more than 1.6 CPU cores continuously) as the more
directly-evidenced mechanism, with memory pressure present but not
shown to be the proximate cause of any hang. Correlating this
precisely against the SystemUI ANR's own on-screen timing is not
possible from this data — the ANR text is embedded in Maestro's static
hierarchy-dump JSON, which carries no independent on-device timestamp
of its own (only the log-ingestion timestamp, `19:58:27Z`, well after
the fact); the ANR is known to have occurred sometime during the
Maestro run (`19:52:13Z`–`19:58:26Z` per the `Setup Android emulator`
step's span), which fully contains the sampled high-CPU/low-headroom
window above, but no finer correlation than that is possible with the
data available.

## 4. Item — toolchain versions and AVD configuration: unchanged

```
platform-tools Pkg.Revision=37.0.1
emulator Pkg.Revision=37.1.11 (Pkg.BuildId=15917651)
hw.cpu.ncore = 2
hw.ramSize = 1536M
```

Identical to every run sampled since `#433`. No toolchain or AVD
config drift explains this run's outcome.

## 5. Item — SystemUI ANR: recurred, now confirmed in all three flow snapshots

```
Occurrence 1 (line 1121): "text": "System UI isn't responding"
Occurrence 2 (line 2532): "text": "System UI isn't responding"
Occurrence 3 (line 3909): "text": "System UI isn't responding"
```

**Three occurrences this run**, one per flow — closing the open gap
`PHASE_8A_25` §2 left unresolved (that run's log only captured 2 of 3
snapshots inline). This further corroborates the SystemUI-ANR finding
as the consistent, recurring on-screen state at assertion-failure
time across this audit chain's runs.

## 6. Item — Maestro flow results: same deterministic pattern, faster this run

Via `dorny/test-reporter`'s summary (fell inside the retrievable
window this run):

```
3 tests were completed in 107s with 0 passed, 3 failed and 0 skipped.
  Assertion is false: id: auth-tab-signup is visible
  Assertion is false: id: auth-tab-signin is visible
  Assertion is false: id: settings-gear-btn is visible
```

Identical failure signature to `#429`, `#431`–`#433`, `#435`, `#436` —
the 7th confirmation of this pattern across 8 sampled runs (`#434`'s
emulator-death outlier remains the sole exception). 107s combined
duration is on the faster end of this chain's observed range (vs.
186s in `#436`).

## 7. Finding B and Option A

```
##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
   Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
Cache saved with key: gradle-c79d1ef78f20154321ce409927e7c7dbb356d527f6373b943fd9a2db7312573a
```

Finding B recurred identically — unaffected by anything in this run.
`Save Gradle cache` succeeded again — the **eighth** independent
confirmation of the Option A fix.

## 8. What this run does and does not establish

**Does:**
- Confirm the Phase 8A-28 relocation achieves its purpose: the
  resource/OOM and toolchain diagnostics are now retrievable alongside
  the SystemUI-ANR evidence, in the same run, for the first time in
  this audit chain.
- Materially refine the resource-constraint theory: sustained CPU
  contention (the emulator process alone consuming 165–174% of a
  single core) and a steadily growing memory footprint are directly
  evidenced; a genuine out-of-memory condition is not — no OOM-kill,
  negligible swap use, and high reclaimable buffer/cache throughout.
- Close the "third flow" evidence gap from `PHASE_8A_25` — the
  SystemUI ANR is now confirmed present in all three flows' captured
  snapshots on this run.
- Reconfirm the deterministic visibility-timeout pattern, Finding B,
  and Option A all behave exactly as established.

**Does not:**
- Pinpoint the SystemUI ANR's exact on-screen timing against a
  specific resource sample — the data does not support finer
  correlation than "within the same multi-minute window."
- Establish CPU contention (as opposed to memory) as a *proven* root
  cause of the ANR — it is the better-evidenced mechanism now
  available, not a demonstrated causal link.
- Change emulator resource allocation or any other remediation.
- Address Finding B.
- Change the production-readiness verdict, which remains unchanged.

## 9. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  document.

---

## Status

**PHASE 8A-29 CI VERIFICATION (run `#437`): COMPLETE.**

| Layer | Status |
|---|---|
| Diagnostic relocation (Phase 8A-28) | ✅ Confirmed effective — resource/OOM and toolchain output now retrievable |
| Resource sampler | ✅ Retrieved — sustained CPU saturation (165–174%) and growing emulator memory footprint |
| `dmesg` OOM check | ✅ Retrieved — no OOM-killer evidence found |
| Resource-constraint theory | 🟠 Refined, not confirmed — CPU contention evidenced; true OOM/memory-exhaustion not evidenced |
| Toolchain / AVD config | ✅ Unchanged from all prior sampled runs |
| SystemUI ANR | ✅ Recurred — now confirmed in all 3 flow snapshots (gap from `PHASE_8A_25` closed) |
| Visibility-timeout pattern (all 3 flows) | ❌ Recurred — 7th confirmation across 8 sampled runs |
| Finding B | ❌ Recurred — identical, still open |
| Option A (Gradle cache save) | ✅ 8th independent confirmation |
| CI conclusion | ❌ FAILURE |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — further
work on the CPU-contention angle (e.g. considering a larger runner or
different emulator flags as a narrow CI-only lever), a remediation
attempt for Finding A more broadly, Finding B's own next step, or any
other action the owner chooses.
