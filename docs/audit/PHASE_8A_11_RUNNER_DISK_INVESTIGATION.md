# Phase 8A-11 — Runner Disk-Exhaustion Investigation

Implements: "Investigate the runner disk-exhaustion failure" — the
finding recorded in `docs/audit/PHASE_8A_10_CI_RERUN_VERIFICATION.md`
(run `#429`, `34512301237`), where the `E2E Tests (Maestro)` job died
with `No space left on device` while installing the Android emulator
system image, before Maestro ever ran. **Investigation only — no
`ci.yml` change, retry, dispatch, or merge is performed by this
document.** Remediation requires its own separate authorization.

## 1. Scope and what this is not

This is a different resource, and a different failure mode, from the
one this audit chain just fixed:

| | Artifact-storage quota (fixed) | This finding |
|---|---|---|
| Resource | GitHub Actions artifact storage — account-level, cloud-side | The `ubuntu-latest` runner's own local ephemeral disk — per-job, VM-local, gone when the job ends |
| Evidence | `##[error]Failed to CreateArtifact: Artifact storage quota has been hit` | `Warning: An error occurred while preparing SDK package ... No space left on device` |
| Fixed by `retention-days`/opt-in-upload change? | Yes | No — unrelated mechanism |

Nothing in `.github/workflows/ci.yml`'s prior two commits
(`a699ff4`, `a48940f`) touches local runner disk usage at all, so
their absence here is expected, not a regression of that fix.

## 2. Direct evidence from the failing run (`34512301237`, job `102990191309`)

Verbatim from the job log (`Setup Android emulator` step,
`18:23:07Z`–`18:23:56Z`, 49 seconds total):

```
2026-09-10T18:23:29.5062299Z [command]/usr/bin/sh -c \sdkmanager --install 'system-images;android-31;google_apis;x86_64' --channel=0 > /dev/null
2026-09-10T18:23:30.2500800Z Warning: This version only understands SDK XML versions up to 3 ...
2026-09-10T18:23:55.4078377Z Warning: An error occurred while preparing SDK package Google APIs Intel
   x86_64 Atom System Image: No space left on device.
2026-09-10T18:23:55.8150894Z ##[endgroup]
2026-09-10T18:23:55.8160484Z ##[group]Terminate Emulator
2026-09-10T18:23:56.0203211Z error: could not connect to TCP port 5554: Connection refused
2026-09-10T18:23:56.0236509Z ##[error]The process '/usr/bin/sh' failed with exit code 1
```

The disk filled during `sdkmanager --install
'system-images;android-31;google_apis;x86_64'` — one of the largest
single packages this workflow installs (a full Android system image,
commonly 1-1.5 GB compressed, larger unpacked) — installed fresh on
every run (`force-avd-creation: false` only controls AVD re-creation,
not whether the underlying SDK packages are (re)downloaded; there is
no persistent cache for the Android SDK/emulator packages in this
workflow, unlike Gradle).

Immediately preceding it in the same step's log, `sdkmanager` also
freshly installed `build-tools;37.0.0`, `platform-tools`,
`platforms;android-31`, and the `emulator` package itself — all
uncached, all landing on the same local disk, in the ~48 seconds
before the system image install exhausted it.

## 3. What made this run different: a cold Gradle cache, and why

The `Cache Gradle` step (`actions/cache@v4`, keyed on
`hashFiles('android/**/*.gradle*', 'android/gradle.properties')`)
reported, verbatim:

```
Cache not found for input keys: gradle-24f52224735224a38fd42a26e740dc6d4deff5a716b52abffb7a00cf02c2d47a, gradle-
```

**Both the exact key and the `gradle-` restore-key prefix missed** —
there was no Gradle cache at all for this repository to fall back to,
not even a stale one. This forced the `Build debug APK` step to
download the Gradle 8.12 distribution from scratch
(`gradle-8.12-all.zip`) and re-resolve the entire native dependency
graph (React Native, ten-plus `@react-native-firebase/*` modules each
pulling their own Firebase BOM / Play Services artifacts, AndroidX) —
all uncached, all written to `~/.gradle/caches` on the same local
disk, alongside `node_modules` from `npm ci`.

```
$ git log -3 --oneline -- android/gradle.properties android/build.gradle android/app/build.gradle
e1fc2c0 ...
3db4c65 ...
```

The cache key's own inputs (`android/**/*.gradle*`,
`android/gradle.properties`) have not changed in this audit chain's
90+ commits or in the two promotions to `main` — so this was not a
key change causing an expected first-time miss. It is a **cache that
existed before and is now gone**: consistent with GitHub Actions'
per-repository cache eviction (a documented ~10 GB cap with
least-recently-used eviction, and/or a 7-day-unused eviction — this
session's tools cannot query the account's actual Actions-cache
inventory or size to confirm which; see §5).

### 3a. A compounding pattern, not a one-off

Comparing this run against two others on the same job:

| Run | Cache Gradle result | Build debug APK duration | E2E outcome |
|---|---|---|---|
| `#416` (`34023746713`, 2026-09-06, last full green run) | hit (39s step) | 5 min | ✅ succeeded — emulator booted, Maestro ran, 13 min |
| `#428` (`34385617156`, 2026-09-09, prior promotion's first CI) | hit (54s step) | 8.5 min | did not reach emulator — failed earlier at the *artifact-quota* upload step |
| `#429` (`34512301237`, 2026-09-10, this finding) | **total miss** | **13 min (longest observed)** | ❌ failed 49s into emulator setup — disk exhausted |

And in **both** failed runs (`#428`, `#429`), the `Post Cache Gradle`
step (the cache *save*) shows `skipped` — meaning neither failing run
saved a Gradle cache afterward either. If this pattern holds
(evidence from 2 data points, not a certainty), a failing E2E run
does not just fail once — it also forfeits the chance to warm the
cache for the *next* run, so a run that fails for any reason
downstream of `Cache Gradle` makes the next run's cold-cache risk
worse, not better.

## 4. Why the disk fills specifically at the system-image install, not earlier

`sdkmanager` installs packages in the order listed in the workflow's
own `Install Android SDK` step: licenses → `build-tools;37.0.0` +
`platform-tools` + `platforms;android-31` → `emulator` → **system
image** (largest single package, installed last). A tight but
adequate disk budget would fail on whichever package tips it over —
here, that was the system image, simply because it came last and was
large, not because it is unusually oversized itself. Combined with:

- A cold Gradle cache (§3) having just written several GB into
  `~/.gradle/caches`,
- `node_modules` already on disk from `npm ci`,
- The Android SDK components the `ubuntu-latest` image ships
  pre-installed (a substantial baseline on its own), plus this
  workflow's own additional installs (`build-tools;37.0.0`, a second
  `emulator` channel, `platforms;android-31`),

...the sequence is consistent with the local disk simply being closer
to full than usual on this run, tipping over during the last (and
one of the largest) install in the chain — rather than the system
image being anomalous in size.

## 5. Explicit verification boundaries — labeled, not silently assumed

- **This session's tools cannot query the `ubuntu-latest` runner's
  actual free-disk-space at any point during the run.** No `df -h` (or
  equivalent) step exists anywhere in `ci.yml` — there is no
  instrumentation to directly observe available disk space before,
  during, or after any step. Everything in §2–§4 is inferred from
  step durations, log content, and known `sdkmanager`/Gradle
  behavior, not measured directly. **Not Verified: exact free-disk
  figures at time of failure.**
- **This session's tools cannot query GitHub's Actions-cache
  inventory** (no cache-listing/size/eviction-reason API is exposed
  by this session's GitHub MCP surface — the same capability gap
  documented for artifact billing in
  `PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md` §2). Whether the
  missing Gradle cache was evicted by the 10 GB per-repo cap, a 7-day
  inactivity rule, or some other cause is inferred from the "total
  miss on a stable key" pattern (§3), not directly confirmed. **Not
  Verified: exact eviction cause/timestamp for the Gradle cache.**
- The runner's actual total/free disk allocation for `ubuntu-latest`
  (commonly cited publicly as ~14 GB usable free space out of a
  larger total, after GitHub's own pre-installed tooling) is public
  GitHub documentation, not something this session measured on the
  actual runner that failed. **Not Verified against this specific
  run** — cited only as context for why an Android+RN build is a
  known-tight fit on this runner class, not as a confirmed number for
  `34512301237` specifically.

## 6. Hypotheses ranked by evidentiary support

1. **(Best supported)** A cold Gradle cache on this run (§3, directly
   confirmed by the log) caused materially more data to be written to
   the runner's local disk than on a cache-hit run, narrowing the
   remaining headroom enough that the last (and large)
   `sdkmanager` package tipped it over. Directly evidenced by the
   "total miss" log line and the correlated build-duration comparison
   in §3a.
2. **(Plausible, not directly confirmed)** The `ubuntu-latest` image's
   baseline disk usage (pre-installed toolchains unrelated to this
   project — Docker images, other language runtimes/SDKs GitHub ships
   by default) leaves less headroom than assumed, making this
   workflow's own Android/Gradle footprint tight even on a cache-hit
   run, with this run's cache miss being what pushed it over the edge
   specifically today. Consistent with §4 but not measurable from
   available evidence (§5).
3. **(Unsupported by evidence gathered)** A one-off runner-side
   infrastructure anomaly (a smaller-than-usual disk allocation on
   this particular VM instance) unrelated to this repository's own
   behavior. Nothing in the log rules this out, but nothing supports
   it either, and it does not explain why the cold-cache run was also
   the slowest/heaviest of the three sampled — treated as the
   least-supported explanation, not excluded.

## 7. Remediation options — enumerated, not authorized or implemented

Listed for the owner's review; **no code change is made by this
document**.

- **a. Restore/protect the Gradle cache.** Investigate why the cache
  was fully evicted (owner-level access to the repo's Actions-cache
  settings/usage, which this session cannot query, would confirm
  whether the 10 GB cap or 7-day inactivity is the cause) and/or
  change `save-always: true` on the `actions/cache@v4` step so a
  cache is saved even when a later step in the same job fails
  (addressing the compounding pattern in §3a directly).
- **b. Free disk space before the emulator step.** A `df -h` diagnostic
  step (cheap, pure observability — directly closes the §5 gap) and/or
  a disk-cleanup step (e.g. removing `ubuntu-latest`'s pre-installed
  Docker images / unused language toolchains before the Android SDK
  install — a widely-used pattern for Android CI on GitHub-hosted
  runners) would both directly test hypothesis 1/2 and increase
  headroom regardless of which hypothesis is correct.
- **c. Reduce what this run downloads fresh.** Pinning/caching the
  Android SDK/emulator packages the same way Gradle is cached (there
  is currently no cache for `~/.android/` or the SDK
  manager's installed packages at all) would remove the largest
  uncached download from every run, not just cache-miss ones.
- **d. Move to a larger runner.** GitHub-hosted larger runners offer
  more disk; this trades cost for headroom without diagnosing the
  actual consumption, so it is listed as a fallback, not a preferred
  first option.

No ranking/recommendation among these is being issued as a decision
by this document — they are options for a separate remediation
authorization to choose from, consistent with this audit chain's
standing "recommendation is not authorization" discipline.

## 8. Hard-stop / next-step determination

No P0/P1-class finding is raised by this investigation — this is a CI
reliability issue (blocks E2E verification, does not itself indicate a
production security/correctness defect in the application). Per
standing instruction, this remains a stop-and-diagnose condition:
**Maestro still has not executed on `main`'s current tip**, and
re-running CI without a change would very likely reproduce the same
disk-exhaustion failure, since nothing investigated here has been
fixed yet.

## 9. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unchanged at `2229c5d`.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed to
  it, adding one new commit. Working tree clean before and after.
- No `ci.yml`, application, test, or deployment-configuration file is
  touched by this document.

---

## Status

**PHASE 8A-11 RUNNER DISK-EXHAUSTION INVESTIGATION: COMPLETE
(diagnostic record; no remediation implemented).**

| Layer | Status |
|---|---|
| Root-cause evidence gathered | ✅ Cold Gradle cache (total miss, log-confirmed) correlated with longest observed build time and the disk-exhaustion failure |
| Distinct from the artifact-quota finding | ✅ Confirmed — different resource (runner-local disk vs. account-level Actions storage), different step, unaffected by the prior fix |
| Compounding-failure pattern | ✅ Observed across 2 failed runs — cache save also skipped on failure |
| Exact free-disk figures | 🔲 Not Verified — no `df -h`/equivalent instrumentation exists in `ci.yml` |
| Actions-cache eviction cause | 🔲 Not Verified — no cache-inventory tool available to this session |
| Remediation options | ✅ Enumerated (§7) — none selected or implemented |
| CI rerun | 🔲 Not attempted — would likely reproduce the same failure without a fix |
| Production readiness | ❌ NOT READY — unchanged, no verdict rendered here |

Awaiting a separate, explicit remediation authorization before any
`ci.yml` change is made.
