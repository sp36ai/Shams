# Phase 8A-21 — CI Verification: Run `#433` (Finding A Diagnostics)

Implements: "CI Rerun Authorization — checkpoint 214a230." First run
to exercise the Phase 8A-20 Finding A diagnostic instrumentation.
**Read-only — no application, test, or workflow file is changed. No
remediation of Finding A or B is performed based on what the
diagnostics show.** No production-readiness verdict is rendered here.

## 1. Run identification

- Run `#433`, id `34616207442`, event `workflow_dispatch`.
- `head_branch`: `claude/shams-phase-0-baseline-lnlmy6`. `head_sha`:
  `214a230` — confirmed exact match before triggering.
- Final `status`: `completed`. Final `conclusion`: `failure` (expected
  — Findings A and B remain unremediated).
- **Environment note**: this job's log was large enough that this
  session's default log-fetch window (last 500 lines) cut off *all*
  diagnostic output — the raw logcat dump alone filled it. Re-fetched
  with `tail_lines: 5000` to recover the full picture; noted here
  since it is a real capability boundary, not silently worked around.

## 2. Item (a): resolved emulator/toolchain versions — SUCCESSFULLY CAPTURED

```
platform-tools source.properties:
  Pkg.UserSrc=false
  Pkg.Revision=37.0.1

emulator package source.properties:
  Pkg.UserSrc=false
  Pkg.Revision=37.1.11
  Pkg.Path=emulator
  Pkg.Desc=Android Emulator
  Pkg.BuildId=15917651
```

**`emulator -version` itself returned "not available"** — the direct
binary invocation in the new step didn't resolve correctly (a minor
implementation gap in this diagnostic step, not a finding about the
emulator itself; `Pkg.Revision=37.1.11` above already gives the
resolved version via the more reliable `source.properties` read).

AVD `config.ini` was fully captured (full key/value dump, ~110 lines).
Notable line: `hw.gpu.enabled = no` — the AVD's own static config
disables GPU, though `ci.yml`'s `emulator-options: -gpu
swiftshader_indirect` overrides this at launch time; not flagged as
significant on its own, but recorded for completeness.

**This is the first time in this audit chain's history that these
values have been directly observed**, closing part of the
verification boundary `PHASE_8A_18_FINDING_A_DEEPER_INVESTIGATION.md`
§4 flagged. Whether `37.0.1`/`37.1.11` differ from what `#416`
(2026-09-06, the last passing run) had installed **cannot be
determined** — that run predates this instrumentation and no
equivalent capture exists for it. This closes the *forward-looking*
half of the toolchain-drift hypothesis's evidence gap, not the
*retrospective* half.

## 3. Item (b): logcat — no crash/exception evidence found

Searched the full captured logcat (both the targeted grep and the
last-150-lines tail): **zero occurrences of `FATAL EXCEPTION` or
`AndroidRuntime`** — no native or JS crash. The `Exception`/`chromium`
grep matched exclusively unrelated system-app noise (Google Play
Services timeouts, the pre-installed Messages app's `Bugle` auth
failures, `ModelWriter` launcher housekeeping) — none from this app's
own process.

This app's own process (confirmed by PID correlation — `ReactNativeJNI`
and `RNFBCrashlyticsInit` lines under PID `3372`, later PIDs for
subsequent flow launches) is alive and executing JS:

```
15:41:51.868  RNFBCrashlyticsInit: isCrashlyticsJavascriptExceptionHandlerChainingEnabled via RNFBMeta: true
15:41:51.868  RNFBCrashlyticsInit: isCrashlyticsJavascriptExceptionHandlerChainingEnabled final value: true
```

The repeated `ReactNativeJNI: ... Failed to connect to /10.0.2.2:8081`
lines are **expected and benign** — this is a `-Pe2eBundleJs=true`
embedded-bundle build with no Metro packager running by design; the
app retries the dev-server connection on an interval regardless, per
standard React Native behavior, and this does not block rendering.

**This is a materially new, positive finding: it rules out a native
or unhandled-JS crash as Finding A's cause.** The app process is
alive and running, not crashing — whatever prevents
`auth-tab-signup`/`auth-tab-signin`/`settings-gear-btn` from becoming
visible within the timeout is not a hard crash.

## 4. Item (c): preserved UI artifacts — captured, only partially inlined

```
/home/runner/.maestro/tests/2026-09-11_154119/
  ai-(01_auth_validation).json
  ai-(02_signup_journey).json
  ai-(03_settings_and_signout).json
  ai-report-01_auth_validation.html
  ai-report-02_signup_journey.html
  ai-report-03_settings_and_signout.html
  commands-(Auth — Sign In flow).json
  commands-(Journey — sign up through onboarding to the Oracle).json
  commands-(Settings — plan display and sign out).json
  maestro.log
  screenshot-❌-1789141339579-(Journey — sign up through onboarding to the Oracle).png
  screenshot-❌-1789141372045-(Auth — Sign In flow).png
  screenshot-❌-1789141402336-(Settings — plan display and sign out).png
```

**Confirms Phase 8A-20 §1d's premise**: Maestro does capture a
screenshot and a command trace per failure, exactly as expected.
**The `ai-(*).json` files inlined successfully but turned out to be
near-empty** (just `flow_name`/`flow_file_path` — not the rich
AI-analysis output their name suggested). **The more likely useful
file, each flow's `commands-(*).json` trace, did not get inlined** —
it exceeded this step's own `<50KB` size filter. This is a real,
named limitation of the Phase 8A-20 implementation, not a new
finding about the application: the data exists, this diagnostic pass
just didn't surface all of it. Screenshots (binary PNG) remain
unviewable via log text regardless of size, by design — that
limitation was already understood when Phase 8A-20 was authorized.

## 5. Item (d): Finding A — recurred, fourth identical occurrence

```
[Failed] Journey — sign up through onboarding to the Oracle (42s) (Assertion is false: id: auth-tab-signup is visible)
[Failed] Auth — Sign In flow (31s) (Assertion is false: id: auth-tab-signin is visible)
[Failed] Settings — plan display and sign out (30s) (Assertion is false: id: settings-gear-btn is visible)
3/3 Flows Failed
```

Same three flows, same three assertions, same overshoot-beyond-20s
pattern documented in `PHASE_8A_18_FINDING_A_DEEPER_INVESTIGATION.md`
§3. Emulator again booted successfully (`Boot completed in 76977 ms`)
— the disk-exhaustion fix continues to hold on a fourth independent
run.

## 6. Item (e): Finding B — recurred, identical error text

```
##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
   Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

Unchanged from every prior sampled run. Not investigated further here
— out of this authorization's scope.

## 7. Item (f): overall CI conclusion

**FAILURE.** `Functions Quality` ✅ and `App Quality` ✅ both passed.
`E2E Tests (Maestro)` ❌ failed, for the same two already-tracked,
not-yet-remediated reasons (Findings A and B). No new failure mode.
`Save Gradle cache` **succeeded again** (`if: always()` step,
unaffected by the job's failure) — a fourth independent confirmation
that the Phase 8A-15 Option A fix continues to hold.

## 8. What this run does and does not establish

**Does:**
- Successfully exercise all five Phase 8A-20 diagnostic additions —
  each produced real output.
- **Rule out a native/JS crash as Finding A's cause** — the strongest
  new, positive finding from this run.
- Capture the resolved emulator (`37.1.11`) and platform-tools
  (`37.0.1`) versions for the first time in this audit chain, for
  future comparison if a prior or future run's versions ever become
  knowable.
- Confirm Maestro's own debug-artifact capture works as expected;
  identify a real, named gap in this diagnostic pass's own inlining
  (the `<50KB` filter excluded the more informative `commands-*.json`
  traces).

**Does not:**
- Identify Finding A's actual root cause — ruling out a crash narrows
  the space (toward a hang/timing/render-logic issue in the app's own
  JS, rather than a fatal error) but does not pinpoint it.
- Confirm or refute the toolchain-drift hypothesis specifically — no
  comparable version data exists for `#416` to compare against.
- Address Finding B in any way.
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

**PHASE 8A-21 CI VERIFICATION (run `#433`): COMPLETE.**

| Layer | Status |
|---|---|
| Diagnostic instrumentation (all 5 items) | ✅ Exercised successfully |
| Resolved emulator/platform-tools versions | ✅ Captured (`37.1.11` / `37.0.1`) — no prior-run baseline to compare against |
| Crash/exception evidence | ✅ **None found** — rules out a native/JS crash |
| UI hierarchy/screenshot preservation | ✅ Confirmed captured; partially inlined (gap noted, not a new app finding) |
| Finding A | ❌ Recurred — 4th identical occurrence, still open |
| Finding B | ❌ Recurred — identical, still open |
| Option A (Gradle cache save) | ✅ 4th independent confirmation |
| CI conclusion | ❌ FAILURE |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step —
further Finding A diagnostics (e.g. a smaller size filter or a
dedicated step to inline `commands-*.json`), a remediation attempt,
Finding B's own next step, or any other action the owner chooses.
