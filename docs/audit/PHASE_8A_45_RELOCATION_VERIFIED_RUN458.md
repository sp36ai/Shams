# Phase 8A-45 — Run #458 verifies the Phase 8A-44 relocation; new post-teardown-noise finding

Run `#458` (id `35066531851`, head `1c64fac`, the `PHASE_8A_44`
relocation commit) was triggered specifically to test that fix and
observed live in this session.

## 1. Relocation confirmed working

The `Show ADB transport-layer state` group is now **fully retrievable**
via `get_job_logs`: both its `##[group]` and `##[endgroup]` markers
fall within the ~4999-line tail (lines 4418–4970 of 4999), with margin
to spare, unlike `#457` where the same group was cut off mid-content.
`PHASE_8A_44`'s fix works as intended.

## 2. This run did not hit the A2 duration band

`Setup Android emulator`: `07:13:48Z` → `07:19:49Z` = **6m01s (361s)**
— squarely in the normal baseline (`PHASE_8A_42`: 300–460s), not the
A2 band (1409–1652s). The job still failed overall (standard
visibility-timeout pattern, not A2). This run does not test the
relocation against a live A2 occurrence — that remains pending.

## 3. New finding: not every `LOST` sample is an in-test event

The full, complete sample sequence for this run:

- `07:17:04Z`–`07:19:36Z` (47 consecutive samples): **all reachable**
  (`transport_id` stable, no losses).
- `07:19:36Z` → `07:19:52Z`: a 16-second gap (vs. the normal 3s
  cadence) — several samples missing, not captured as either OK or
  LOST.
- `07:19:52Z` onward (16 consecutive samples, through `07:20:37Z`
  where the capture window ends): **all `device 'emulator-5554' not
  found`**, no recovery.

Cross-referencing against the job's own step timestamps
(`list_workflow_jobs`, independent of this log content): `Setup
Android emulator` completed at `07:19:49Z` — **3 seconds before** the
first `LOST` sample. Every `OK` sample in this run falls before the
step's own completion; every `LOST` sample falls after it.

**Conclusion: this run's "not found" samples are post-teardown noise,
not an in-test transport-loss event.** The `adb-state.txt` sampler is
started via `nohup` inside `Setup Android emulator` and is not
explicitly stopped when that step ends — it keeps sampling through the
rest of the job (`Disk usage after...`, `Show logcat...`, `Upload
Maestro results`, `Publish test report`, `Save Gradle cache`) and
correctly reports "not found" once the runner has torn down the
emulator process, which is expected, benign cleanup behavior, not a
failure symptom. **Zero genuine in-test transport losses occurred in
this run.**

## 4. Why this matters for interpreting `#457` and future occurrences

This does **not** retract `PHASE_8A_43`'s finding for `#457` — that
run's single `LOST` sample (`06:40:18Z`, `transport_id` 1→2) occurred
at `06:40:18Z`, well inside `Setup Android emulator`'s own
`06:25:11Z`–`06:52:43Z` window, so it remains a genuine in-test event,
not teardown noise.

It does mean **future `adb-state.txt` analysis must filter samples
against the step's own `started_at`/`completed_at`** (cheaply
available via `list_workflow_jobs`, no log content needed) before
counting `LOST` samples as evidence of anything — a raw "N of M
samples lost" count, without that filter, will be dominated by benign
post-teardown noise on every run, A2 or not, and would have made
`#458`'s 16 lost samples look alarming when they are not.

## 5. What this does and does not establish

**Does:**
- Confirms `PHASE_8A_44`'s relocation fix works.
- Establishes a correction to how `adb-state.txt` should be read going
  forward (filter by step window).

**Does not:**
- Test the relocation against a live A2 occurrence — still pending.
- Change A2's root-cause status — still open.
- Touch `ci.yml`, AVD/emulator config, RAM/CPU, application code, or
  the judgment engine.
- Change the production-readiness verdict.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Run `#458` (id `35066531851`) was triggered in this session via
  `workflow_dispatch`, explicitly to test `PHASE_8A_44`.

---

## Status

**PHASE 8A-45: PHASE_8A_44 RELOCATION VERIFIED WORKING; POST-TEARDOWN-NOISE CORRECTION ESTABLISHED.**

| Layer | Status |
|---|---|
| `PHASE_8A_44` relocation | ✅ Confirmed — full group retrievable, both markers within tail |
| This run's transport integrity | ✅ Clean — zero in-test losses, all `LOST` samples are post-step teardown noise |
| Analysis correction | ✅ Future reads must filter `adb-state.txt` samples by the step's own `started_at`/`completed_at` |
| `#457` finding | ✅ Unaffected — its single `LOST` sample was inside the step window, still a genuine in-test event |
| Relocation vs. a live A2 occurrence | 🔲 Not yet tested — this run was normal-duration, not A2-band |
| A2 root cause | 🔲 Still open |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |
