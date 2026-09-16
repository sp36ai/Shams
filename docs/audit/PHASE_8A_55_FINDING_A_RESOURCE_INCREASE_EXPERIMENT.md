# Phase 8A-55 — Finding A remediation experiment: raise emulator cores/RAM

`PHASE_8A_25` established Finding A's best-supported working theory: the Android emulator's own SystemUI process becomes unresponsive mid-run (a native "System UI isn't responding" ANR dialog covers the screen), causing Maestro's assertions to fail against that overlay regardless of the app's own state. This is why nearly every CI run in this audit — including fast, baseline-duration ones — shows `failure`, independent of A2. That document named the AVD's tight resource budget (`hw.cpu.ncore=2`, RAM auto-bumped only to 2048MB from a lower profile default) under CI-runner-shared contention as the leading candidate, and explicitly offered "increased emulator RAM/cores as a narrow CI-only lever" as a next step requiring its own separate, explicit authorization. That authorization was given directly by the user in this session ("Fix finding A").

## 1. The change

In `.github/workflows/ci.yml`'s `E2E Tests (Maestro)` job, the `Setup Android emulator` step (`reactivecircus/android-emulator-runner@v2`) previously specified no `cores` or `ram-size` inputs, so the emulator ran with whatever its own defaults produced — observed directly in earlier run logs as `hw.cpu.ncore=2` (via the action's own internal `config.ini` write) and a runtime RAM auto-bump to only 2048MB. This adds explicit overrides:

```diff
           force-avd-creation: false
+          cores: 3
+          ram-size: 3072M
           emulator-options: -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
```

## 2. Why these specific values

GitHub's standard `ubuntu-latest` hosted Linux runners are documented at 4 vCPU / 16GB RAM. This session could not directly confirm that figure from this repository's own job logs — the `free -h` output captured by the `Show runner resource usage and OOM check` step fell outside every retrievable log window attempted (the same tail-window limitation documented in `PHASE_8A_54`), so this is public GitHub documentation, not this session's own measurement.

Given that budget: `cores: 3` leaves 1 core headroom for the host OS, Gradle daemon, Node/Maestro, adb, and the background diagnostic samplers that all run concurrently; `ram-size: 3072M` leaves roughly 13GB headroom on a 16GB runner. Both are increases over the previously observed effective budget (2 cores, ~2048MB), directly targeting `PHASE_8A_25`'s and `PHASE_8A_29`'s (sustained qemu CPU contention, 165–174% of a single core) resource-constraint theory, without requesting the job's entire `runs-on` tier be upgraded (a separate, cost-affecting decision not made here).

## 3. What this does and does not establish

**Does:** Implements the specific remediation lever `PHASE_8A_25` named as the most plausible next step, directly authorized by the user. Confined to the one step's resource inputs — no AVD profile, API level, architecture, or Maestro flow changed.

**Does not:**
- Confirm the theory. `PHASE_8A_25` was explicit that the resource-constraint explanation for Finding A is "best-supported, not fully proven" — this change tests that theory; it does not retroactively prove it.
- Guarantee the SystemUI ANR stops recurring. If the actual cause is unrelated to CPU/RAM headroom (e.g., a genuine SystemUI/emulator-image bug independent of resource pressure), this change will not help, and that would itself be informative evidence against the resource-constraint theory.
- Touch Finding B or A2 — both are separate, independently tracked issues (`PHASE_8A_36`/`37` and `PHASE_8A_43`–`54` respectively), untouched by this document.
- Change the production-readiness verdict pre-validation.

## 4. Validation performed so far

- `git diff --stat`: confined to `.github/workflows/ci.yml`, 11 insertions, 0 deletions — no other file touched.
- `python3 -c "import yaml; yaml.safe_load(...)"`: confirms `ci.yml` remains valid YAML after the edit.
- **Not yet performed:** a live CI run to confirm the emulator actually launches with the requested cores/RAM (the `Configure emulator` step's own log output, which previously printed `Cores: 2` / blank RAM, is the direct way to verify this) and whether the "System UI isn't responding" ANR still recurs. That is the necessary next step and is pending a triggered validation run.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Files changed: `.github/workflows/ci.yml` (the resource-increase experiment) and this document.
- No application code, Maestro flow, or judgment-engine file touched.
- No open or merged PR exists for this branch.

---

## Status

**PHASE 8A-55: FINDING A RESOURCE-INCREASE EXPERIMENT APPLIED (cores 2→3, RAM ~2048MB→3072MB) — DIRECTLY AUTHORIZED, TARGETS THE PHASE_8A_25 WORKING THEORY, NOT YET VALIDATED BY A LIVE RUN.**

| Layer | Status |
|---|---|
| Change implemented | ✅ `cores: 3`, `ram-size: 3072M` added to `Setup Android emulator` step |
| Targets established working theory | ✅ Directly addresses `PHASE_8A_25`'s resource-constraint hypothesis for the SystemUI ANR |
| Theory proven | 🔲 Not proven — this is the test of it, not confirmation |
| Runner spec (4 vCPU/16GB) | 🟠 Public GitHub documentation, not independently measured from this repo's own logs |
| YAML validity | ✅ Confirmed |
| Diff scope | ✅ Confined to `ci.yml` + this doc |
| Finding B / A2 | ✅ Untouched, separate |
| Live CI validation | 🔲 Not yet performed — pending a triggered run |
| Production readiness | ❌ NOT READY — unchanged |
