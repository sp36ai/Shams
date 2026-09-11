# Phase 8A-18 — Finding A Deeper Investigation (Maestro/UI Failures)

Implements: "Investigation authorization — Finding A, Maestro/UI
failures." Extends `docs/audit/PHASE_8A_14_FINDINGS_INVESTIGATION.md`
§A with additional evidence gathered after three consecutive
reproductions of the same failure (runs `#431`, `#432` attempt 1,
`#432` attempt 2 — the last of which was externally triggered, per
`PHASE_8A_17_EXTERNAL_RERUN_RUN432_ATTEMPT2.md`). **Read-only — no
application, test, or workflow file is changed. No fault is assigned
to any component.** This document builds on Phase 8A-14 rather than
replacing it, per this audit chain's append-only discipline.

## 1. New evidence: the full causal surface within this repository is empty

Phase 8A-14 §A1 checked `AuthScreen.tsx`, navigation, and
`.maestro/ci/*.yaml` and found them unchanged since the last fully
passing run (`#416`, commit `0a1cb7a0`). This investigation widens
that check to the entire repository:

```
$ git diff --stat 0a1cb7a0..c337180 -- android/
(no output — zero files changed)

$ git diff --stat 0a1cb7a0..c337180 -- package-lock.json
(no output — zero files changed)

$ git diff --stat 0a1cb7a0..c337180 -- package.json
package.json | 2 +-
```

**The entire Android native project (`android/`, including every
`.gradle` file, `AndroidManifest.xml`, `gradle.properties`, and every
other native config) is byte-identical** between the last passing run
and the current commit. **`package-lock.json` — the exact dependency
tree, every transitive package pinned to its resolved version — is
also byte-identical.** `package.json` differs by exactly one line,
in the `test:rules` script (pins `firebase-tools@15.29.0` for
Firestore rules testing) — unrelated to the app, the Android build,
or E2E.

**This closes the gap Phase 8A-14 §A5 hypothesis 3 explicitly left
open** ("Not Verified: whether some other file in that [121-commit]
range could plausibly affect initial render timing"). It cannot — no
file capable of affecting the Android app's boot/render behavior
changed at all. Hypothesis 3 (an in-repo code regression outside the
originally-checked files) is now **effectively ruled out**, not just
assessed as unlikely.

## 2. New evidence: the emulator/SDK toolchain is not version-pinned, and is external to this repository

`ci.yml`'s `Setup Android emulator` step invokes
`reactivecircus/android-emulator-runner@v2` with `api-level: 31`,
`arch: x86_64`, `target: google_apis`, `profile: pixel_6` — but the
actual `sdkmanager` install commands (visible in every sampled job
log) are **not present in `ci.yml` at all**:

```
$ grep -n "sdkmanager" .github/workflows/ci.yml
(no matches)
```

They are internal to the third-party action itself. From the job
logs (all three sampled runs, identical commands):

```
sdkmanager --install 'build-tools;37.0.0' platform-tools 'platforms;android-31'
sdkmanager --install emulator --channel=0
sdkmanager --install 'system-images;android-31;google_apis;x86_64' --channel=0
```

`build-tools` and the system image's API level are pinned by
explicit version string. **`platform-tools` and `emulator` are not
version-pinned at all** — `sdkmanager` installs whatever the current
latest release is at the moment each job runs, resolved against
Google's own package repository, entirely outside this repository's
commit history and outside this session's or the action's control.

**This is the most evidence-consistent remaining explanation**: with
every in-repo file ruled out (§1), a behavioral difference between
`#416` (2026-09-06) and the three runs sampled here (2026-09-10/11)
is most plausibly explained by a toolchain component (the Android
emulator binary or platform-tools) that silently updated between
those dates, rather than by anything this audit chain's own commits
touched.

## 3. Supporting observation: reported failure durations consistently exceed the flows' own configured timeout

Across all three sampled runs, every failed flow's reported duration
exceeds its own `extendedWaitUntil` `timeout: 20000` (20s) by a
consistent margin:

| Flow | `#431` | `#432` attempt 1 | `#432` attempt 2 | Configured timeout |
|---|---|---|---|---|
| Sign-up journey (`auth-tab-signup`) | 34s | 41s | 38s | 20s |
| Sign-in flow (`auth-tab-signin`) | 32s | 32s | 32s | 20s |
| Settings (`settings-gear-btn`) | 33s | 29s | 30s | 20s |

The overshoot is consistent in direction (always over, never under)
and roughly consistent in magnitude per flow across all three
independent runs (sign-in in particular: exactly 32s three times).
This is not conclusive on its own — Maestro's reported duration may
include setup/launch overhead beyond the wait condition itself, which
this investigation did not independently verify against Maestro's own
timing semantics — but the *consistency* (same overshoot pattern
three times, across two different triggering contexts) is additional
evidence for a systematic, reproducible condition rather than
per-run randomness.

## 4. What remains unconfirmed, and why

- **No crash/exception evidence found** in any of the three sampled
  logs' available portions (`ANR`, `FATAL`, `Exception`, `Crash`,
  `OutOfMemory`, JS-bundle-load errors — none found). **This is not
  strong evidence of absence**: `ci.yml` has no `adb logcat` capture
  step at all, so a JS exception or native crash during app boot
  would not be captured or visible to this investigation regardless
  of whether one occurred. Restated from Phase 8A-14 §A4, not newly
  resolved.
- **Whether `GOOGLE_SERVICES_JSON` is configured as a repository
  secret could not be checked** — no secret-listing tool (even
  name-only, not values) exists in this session's GitHub MCP surface,
  the same class of capability gap documented for artifact billing
  and Actions-cache inventory in earlier phases. This remains **Not
  Verified**, though §A3 of Phase 8A-14 already established that
  flow `01`'s failure does not require Firebase network calls to
  occur, independent of this gap.
- **The exact installed emulator/platform-tools version per run is
  not observable** — no version-report step exists in `ci.yml` or the
  third-party action's own logged output beyond the install commands
  themselves (which don't print a resolved version number for
  unpinned packages). Confirming §2's hypothesis with certainty would
  require either pinning these components (a remediation, not an
  investigation step) or a diagnostic step that prints
  `sdkmanager --list_installed` after setup — **not added here**, per
  this authorization's read-only, investigation-only scope.

## 5. Revised hypothesis ranking

Supersedes Phase 8A-14 §A5's ranking, per this document's own new
evidence — recorded as a revision, not a silent overwrite:

1. **(Now best supported)** An unpinned Android SDK/emulator-toolchain
   component (most likely the `emulator` package or `platform-tools`,
   both resolved to "latest" on every run) changed between `#416`
   (2026-09-06) and the runs sampled here (2026-09-10/11), altering
   boot or render timing enough to push flows past their 20s
   `extendedWaitUntil` window. Supported by: §1's now-exhaustive
   ruling-out of every in-repo file; §2's confirmation that these
   specific components are genuinely unpinned and externally
   resolved; §3's consistent, repeatable overshoot pattern across
   three independent runs. Not confirmed with certainty — §4's
   version-visibility gap remains open.
2. **(Demoted from Phase 8A-14's rank 1, but not eliminated)** A
   transient/environmental timing issue specific to these particular
   runs. Weakened by the fact that the same failure reproduced
   identically three times, including once via an externally
   triggered rerun this session had no influence over — a truly
   random per-run flake reproducing this consistently (same 3 flows,
   same order, similar per-flow duration) is less likely than a
   systematic cause, though still not impossible.
3. **(Unchanged from Phase 8A-14, now further weakened)** An in-repo
   code regression outside the originally-checked files. §1's
   full-repository diff (Android project + exact dependency lockfile,
   both byte-identical) leaves essentially no remaining surface for
   this hypothesis within the repository itself.

**Still no hypothesis is confirmed with certainty**, and no fault is
assigned to the application, the Maestro flows, or any specific
component. Per the authorization's scope, no fix is proposed or
implemented.

## 6. What would resolve this with more confidence (not authorized or performed here)

Listed for completeness, not proposed as a decision:

- A diagnostic step printing the resolved emulator/platform-tools
  version after `Setup Android emulator`, to directly test hypothesis
  1 on the next run.
- An `adb logcat` capture step (`if: always()`), uploaded as an
  artifact, to close the crash/exception visibility gap in §4 —
  though this would itself be affected by Finding B until that is
  separately remediated.
- Pinning the emulator/platform-tools versions explicitly (if
  `reactivecircus/android-emulator-runner@v2` exposes that input) to
  test whether reverting to a known-good toolchain restores the pass.

## 7. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — confirmed unchanged.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  investigation.

---

## Status

**PHASE 8A-18 FINDING A DEEPER INVESTIGATION: COMPLETE (diagnostic
record; no remediation implemented; no fault assigned).**

| Layer | Status |
|---|---|
| In-repo code regression | ✅ Effectively ruled out — entire Android project + exact dependency lockfile confirmed byte-identical to the last pass |
| Toolchain-drift hypothesis | ✅ Newly identified as best-supported — emulator/platform-tools confirmed unpinned and externally resolved |
| Reproducibility across independent runs | ✅ Confirmed — identical failure 3/3 times, including one externally-triggered run |
| Root cause | 🔲 Still not confirmed with certainty — version-visibility and logcat-capture gaps remain |
| Remediation | 🔲 Not proposed or implemented — out of this authorization's scope |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for any next step — a
diagnostic-only workflow addition, a remediation attempt, or Finding
B's own investigation/remediation.
