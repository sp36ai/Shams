# Phase 8A-20 — Finding A Diagnostic Implementation

Implements: "Finding A Diagnostic Authorization — ISSUED", checkpoint
`d54a12a`. Adds exactly the five authorized observability-only
additions to `.github/workflows/ci.yml`'s `e2e` job. **No application
behavior change, no Maestro assertion change, no emulator/platform-
tools pinning, no dependency change, no Finding B remediation or
artifact-quota workaround, no CI rerun, no merge/promotion/deployment
— all explicitly excluded by the authorization and none performed
here.**

## 1. What was changed

Confined entirely to the `e2e` job:

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 64 ++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 64 insertions(+)
```

**Purely additive — zero lines removed.** Four pieces, mapped
directly to the five authorized items:

### 1a. Items 1+2 — resolved emulator and platform-tools versions

New step `Capture Android SDK/emulator toolchain versions`, placed
after `Disk usage after Android SDK/emulator setup`, `if: always()`.
Reads `source.properties` for both packages (the standard Android SDK
manifest file each installed package carries, containing
`Pkg.Revision`) and calls `emulator -version` directly — pure reads,
nothing installed, pinned, or changed.

### 1b. Item 3 — relevant emulator configuration

Same step also `cat`s the AVD's own `config.ini`
(`~/.android/avd/shams_test.avd/config.ini`) — the file `ci.yml`
itself already appends `hw.cpu.ncore=2` to earlier in the job, now
read back in full for the record.

### 1c. Item 4 — logcat/crash capture during the E2E run

Two-part implementation, required because the emulator is only alive
during the third-party `reactivecircus/android-emulator-runner@v2`
action's own `script:` block:

- **Start** (inside that action's `script:`, immediately after the
  Maestro CLI install, before `maestro test` runs):
  ```yaml
  adb logcat -c
  nohup adb logcat -v threadtime > "$HOME/logcat.txt" 2>&1 &
  ```
  `nohup ... &` is deliberate: the action's own documented behavior
  (and this workflow's existing comment) is that each `script:` line
  runs in its own separate shell — a plain `&` without `nohup` risks
  the background process being lost when that line's shell exits.
  `nohup` protects it from the resulting `SIGHUP`.
- **Surface** (a new step after the emulator step concludes,
  `if: always()`): greps the captured file for
  `FATAL|AndroidRuntime|Exception|chromium` and separately tails the
  last 150 lines for general context — both printed directly into the
  job's own log output.

### 1d. Item 5 — preserve UI hierarchy/screenshots on failure

Maestro already writes screenshots and view-hierarchy dumps to
`~/.maestro/tests/` on a failed assertion — this is Maestro's own
existing, built-in behavior, not new capture logic this change adds.
That directory was also already in the `Upload Maestro results` step's
upload path before this change. **What was missing was visibility
when that upload fails** (Finding B, currently open on every sampled
run) — the new step lists every file captured there and inlines the
content of any small (`<50KB`) text/XML/JSON hierarchy dump directly
into the job log.

## 2. Why the delivery mechanism is the job log, not the artifact upload

This is the load-bearing design decision, and it is deliberate: **all
four pieces of new diagnostic data are printed to the job's own
`stdout`/log output**, retrievable via `get_job_logs` independent of
the GitHub Actions artifact-storage quota entirely. `logcat.txt` was
also added to the existing `Upload Maestro results` artifact's path
list, but this is explicitly *not* the primary delivery mechanism —
Finding B has failed that upload on every run sampled since it was
first observed, and this authorization explicitly excludes any
Finding B remediation or quota workaround. Adding one filename to an
already-existing, already-authorized upload step is not a workaround
of that problem; the log-visible steps are what actually make this
diagnostic authorization useful regardless of whether Finding B is
ever resolved.

## 3. Explicit confirmation of exclusions

| Exclusion (from the authorization) | Status |
|---|---|
| No application behavior changes | ✅ Zero files outside `.github/workflows/ci.yml` touched |
| No Maestro assertion changes | ✅ No `.maestro/ci/*.yaml` file touched |
| No emulator/platform-tools pinning | ✅ `sdkmanager` install commands (internal to the third-party action) are untouched; nothing here changes what version gets installed |
| No dependency changes | ✅ `package.json`/`package-lock.json`/`android/` untouched |
| No Finding B remediation | ✅ No change to retention policy, upload conditions, or quota-adjacent behavior — see §2 |
| No artifact-quota workaround | ✅ The one new artifact-path addition (`~/logcat.txt`) is incidental, not the delivery mechanism — see §2 |
| No CI rerun | ✅ Not triggered by this document |
| No merge, promotion, or deployment | ✅ Not performed |

## 4. Verification performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
$ git diff .github/workflows/ci.yml | grep "^-[^-]"
(no output — zero real deletions, confirmed purely additive)
```

Same class of boundary as every prior CI-config change in this audit
chain: no local harness can execute a GitHub Actions job, so the only
real proof this instrumentation works as intended is an actual CI
run — **not performed here**, and explicitly excluded from this
authorization's scope. The next CI Rerun Authorization (a separate,
future authorization) will be the first opportunity to observe this
diagnostic data in practice.

## 5. What this does and does not establish

**Does:**
- Implement exactly the five authorized items, confined to
  observability.
- Give the next CI run (once separately authorized) a chance to
  produce the exact evidence `PHASE_8A_18_FINDING_A_DEEPER_INVESTIGATION.md`
  §4 identified as missing: resolved toolchain versions, and
  crash/exception visibility independent of Finding B.

**Does not:**
- Prove anything about Finding A's actual cause — no run has
  exercised this instrumentation yet.
- Address Finding B in any way.
- Change the production-readiness verdict, which remains unchanged.

## 6. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — this commit is on the feature
  branch only, not yet promoted.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here. Working tree clean before and after.
- No merge to `main` and no CI rerun is performed or requested by this
  document.

---

## Status

**PHASE 8A-20 FINDING A DIAGNOSTIC IMPLEMENTATION: COMPLETE.**

| Layer | Status |
|---|---|
| Item 1 — resolved emulator version | ✅ Implemented |
| Item 2 — resolved platform-tools version | ✅ Implemented |
| Item 3 — relevant emulator configuration | ✅ Implemented |
| Item 4 — logcat/crash capture | ✅ Implemented |
| Item 5 — UI hierarchy/screenshot preservation | ✅ Implemented (surfaced via log, independent of Finding B) |
| All explicit exclusions honored | ✅ Confirmed (§3) |
| YAML validity / diff scope | ✅ Verified — valid, purely additive, `e2e` job only |
| Actual diagnostic value | 🔲 Not yet observed — requires a separate CI Rerun Authorization |
| Finding A root cause | 🔲 Still not confirmed |
| Finding B | 🔲 Untouched, still open |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun to exercise this instrumentation, Finding B's own next step, or
any other action the owner chooses.
