# Phase 8A-12 — Runner Disk-Exhaustion Remediation (Options A + B)

Implements: "Remediation Authorization — Options A and B, checkpoint
ac0c454." Addresses the finding in
`docs/audit/PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md` — run `#429`'s
`E2E Tests (Maestro)` job exhausting the runner's local disk while
installing the Android emulator system image, before Maestro ever ran.

Per the authorization's own explicit scope: **Options A and B only**.
Option C (Android SDK/emulator caching) and Option D (a larger runner)
are deliberately not implemented here, per the standing instruction
not to choose them "merely because #429 ran out of disk" — they
remain open, contingent on what B's measurements show.

## 1. What was changed

All changes are confined to `.github/workflows/ci.yml`'s `e2e` job.
Neither the `app-quality` job, the `functions-quality` job, nor any
other file is touched.

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 57 +++++++++++++++++++++++++++++++++
 1 file changed, 57 insertions(+)
```

**Purely additive** — zero lines removed, zero existing step's
behavior altered. Four new pieces, in the order they appear in the
job:

### 1a. Option A — protect Gradle cache warming (`save-always: true`)

```diff
+      # save-always: PHASE 8A-11 found that on both sampled failing runs, the
+      # cache-save (post-job) step was skipped along with the rest of the
+      # job -- so a run that fails downstream of this step never warms the
+      # cache, making the *next* run's cold-cache risk worse, not better.
+      # save-always makes the save happen regardless of later step outcome,
+      # breaking that failure -> no-cache-warm -> another cold run loop.
       - name: Cache Gradle
         uses: actions/cache@v4
         with:
           path: |
             ~/.gradle/caches
             ~/.gradle/wrapper
           key: gradle-${{ hashFiles('android/**/*.gradle*', 'android/gradle.properties') }}
           restore-keys: gradle-
+          save-always: true
```

Directly targets the §3a compounding pattern from
`PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md`: both sampled failing runs
(`#428`, `#429`) skipped the cache-save post-step, so each failure was
also forfeiting the chance to warm the cache for the next run.
`save-always` makes the save happen in the job's post-step regardless
of what any later step in the job does.

### 1b. Option B — pre-build disk cleanup ("Free disk space")

Added immediately after `Checkout`, before any download (`npm ci`,
Gradle, Android SDK) begins, so freed space is available to
everything that follows, not just the step that failed:

```yaml
      - name: Free disk space (pre-build)
        run: |
          echo "::group::Disk usage before cleanup"
          df -h
          echo "::endgroup::"
          sudo rm -rf /usr/share/dotnet || true
          sudo rm -rf /opt/ghc /usr/local/.ghcup || true
          sudo rm -rf /usr/local/share/boost || true
          sudo rm -rf /opt/hostedtoolcache/CodeQL || true
          docker image prune --all --force || true
          echo "::group::Disk usage after cleanup"
          df -h
          echo "::endgroup::"
```

**Deliberately conservative**, per the standing instruction not to
weaken the emulator/Maestro path: every path removed is a toolchain
this job has no dependency on at all —

| Removed | Why it is safe for this job |
|---|---|
| `/usr/share/dotnet` (.NET SDK) | This job builds Android/React Native/Node only; no `.csproj`/`dotnet` invocation anywhere in this workflow or the repo's Android/JS build. |
| `/opt/ghc`, `/usr/local/.ghcup` (Haskell) | Same — no Haskell toolchain used anywhere in this repo. |
| `/usr/local/share/boost` | C++ library, unrelated to this job's Kotlin/Java/JS/Gradle build. |
| `/opt/hostedtoolcache/CodeQL` | A security-scanning bundle this job never invokes (this repo's own CodeQL workflow, if any, runs as a separate job with its own runner and would restore its own copy). |
| Docker images (`docker image prune`) | This job never runs a container — `runs-on: ubuntu-latest` with no `services:` or `container:` block. |

**Explicitly NOT removed**, because they are load-bearing for this
exact job: any Android SDK component (`/usr/local/lib/android/sdk/*`,
including the NDK — some `@react-native-firebase`/native modules may
depend on it and this was not independently verified either way, so
it is left untouched rather than risk it), `$AGENT_TOOLSDIRECTORY`
(the Node/Java hosted-tool cache `setup-node`/`setup-java` rely on),
and Gradle's own caches (protected, not removed, by Option A). No
step in the emulator/Maestro path itself was touched, shortened, or
made conditional — the acceptance chain (build → emulator usable →
Maestro executes → Maestro passes) is unchanged.

### 1c. Option B — before/after disk-usage instrumentation

Two new steps bracket exactly the step that failed in `#429`
(`Setup Android emulator`'s own SDK-package install), both
`if: always()` so they still run — and this run's numbers are still
captured — even if an earlier step in the job already failed:

```yaml
      - name: Disk usage before Android SDK/emulator setup
        if: always()
        run: |
          echo "::group::Disk usage"
          df -h
          echo "::endgroup::"
          echo "::group::Known large directories"
          du -sh ~/.gradle 2>/dev/null || true
          du -sh "$GITHUB_WORKSPACE/node_modules" 2>/dev/null || true
          du -sh /usr/local/lib/android/sdk 2>/dev/null || true
          echo "::endgroup::"
```

placed right after `Upload debug APK` / before `Enable KVM`, and:

```yaml
      - name: Disk usage after Android SDK/emulator setup
        if: always()
        run: df -h
```

placed right after the `Setup Android emulator` step / before
`Upload Maestro results`.

This directly converts `PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md` §5's
labeled boundary — "no `df -h` instrumentation exists; exact free-disk
figures are inferred, not measured" — into real, observable numbers on
every future run, not just this one. It does not itself fix anything;
it is deliberately observability-only, matching Option B's own scope.

## 2. Verification performed

### 2a. Syntax and scope

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 57 +++++++++++++++++++++++++++++++++
 1 file changed, 57 insertions(+)
```

Confirmed: valid YAML, purely additive, confined to the `e2e` job.
`app-quality` and `functions-quality` are byte-for-byte unchanged
(verified by the diff itself showing no touched lines outside the
`e2e` job's step list).

### 2b. What could and could not be verified from this environment

A GitHub Actions workflow has no local unit-test harness — unlike the
application/functions code this audit chain's remediations have
otherwise mutation-tested, there is no test suite to run a
break-it/restore-it cycle against for YAML step behavior. The
equivalent rigor applied here:

- Every removed path (§1b) was checked against this specific job's
  actual dependencies (Android SDK, Gradle, Node/npm, Java/Temurin,
  Maestro) before being added to the cleanup list — nothing this job
  touches was removed.
- `save-always` is a documented input of `actions/cache@v4` (available
  since that action's `v4.2.0` release). This workflow pins the
  floating major tag `actions/cache@v4`, which GitHub resolves to the
  latest `v4.x` release at run time — **Not Verified from this
  environment**: the exact resolved version at the next run's actual
  execution time was not and cannot be confirmed here; if GitHub ever
  resolved `@v4` to something older than `4.2.0` (not expected, but
  not directly checked), `save-always` would need to be revisited.
- **The only real proof that any of this works is an actual CI run**,
  observing whether the emulator step now succeeds and whether the new
  `df -h`/`du -sh` output shows materially more headroom than the
  failing run. That is explicitly not performed by this document —
  per standing practice, it requires its own separate, explicit CI
  Rerun Authorization, exactly as after the previous (artifact-quota)
  remediation.

## 3. What this remediation does and does not establish

**Does:**
- Implement Options A and B exactly as authorized, confined to the
  `e2e` job, purely additive.
- Give the next CI run a chance to retain a warm Gradle cache even if
  it fails downstream of the cache step (Option A), and free
  meaningful, safely-identified disk headroom before any download
  begins (Option B cleanup).
- Instrument the exact failure point with real before/after
  measurements, closing the observability gap the investigation
  flagged, for this run and every run after it.

**Does not:**
- Implement or select Option C or D — both remain open, per the
  authorization's own instruction to defer them until B's actual
  numbers justify them.
- Constitute proof the disk-exhaustion failure is resolved. That
  requires an actual CI run — not performed here.
- Change the production-readiness verdict, which remains unchanged.
- Weaken, shorten, or make conditional any step in the
  build → emulator → Maestro acceptance chain — confirmed by the diff
  itself, which touches no line in that chain.

## 4. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — this commit is on the feature
  branch only, not yet promoted.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here. Working tree clean before and after.
- No merge to `main` and no CI rerun is performed or requested by this
  document.

---

## Status

**PHASE 8A-12 RUNNER DISK-EXHAUSTION REMEDIATION (Options A + B): COMPLETE.**

| Layer | Status |
|---|---|
| Option A (Gradle cache `save-always`) | ✅ Implemented |
| Option B (pre-build cleanup) | ✅ Implemented — conservative, verified against this job's actual dependencies |
| Option B (before/after disk instrumentation) | ✅ Implemented — brackets the exact failing step |
| Option C (SDK/emulator caching) | 🔲 Deliberately deferred, per authorization |
| Option D (larger runner) | 🔲 Deliberately deferred, per authorization |
| YAML validity / diff scope | ✅ Verified — valid, purely additive, `e2e` job only |
| Actual effectiveness against the failure | 🔲 Not Verified — requires a separate CI Rerun Authorization |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun on this branch, a promotion to `main`, or further remediation.
