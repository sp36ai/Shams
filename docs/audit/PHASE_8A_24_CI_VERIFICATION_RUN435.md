# Phase 8A-24 — CI Verification: Run `#435` (Emulator-Death Recurrence Check)

Implements: "Rerun CI once more to see if it recurs" — a plain,
observational rerun on checkpoint `607f8a0` with no new
instrumentation, to determine whether run `#434`'s emulator/ADB-death
failure mode (`PHASE_8A_23_CI_VERIFICATION_RUN434.md`) was a
recurring infrastructure problem or an isolated event. **Read-only —
no remediation of any finding.** No production-readiness verdict is
rendered here.

## 1. Run identification

- Run `#435`, id `34623441557`, event `workflow_dispatch`.
- `head_sha`: `607f8a0` — confirmed exact match before triggering.
- Final `conclusion`: `failure`.

## 2. The decisive question: does `#434`'s new failure mode recur?

**No. It reverted cleanly to the established pattern.**

```
16:56:16  [Failed] Journey — sign up through onboarding to the Oracle (33s)
              (Assertion is false: id: auth-tab-signup is visible)
16:56:47  [Failed] Auth — Sign In flow (30s)
              (Assertion is false: id: auth-tab-signin is visible)
16:57:19  [Failed] Settings — plan display and sign out (32s)
              (Assertion is false: id: settings-gear-btn is visible)
3/3 Flows Failed
```

**No occurrence of `device 'emulator-5554' not found` or "Android
driver unreachable" anywhere in this run's log.** All three flows
failed with the same visibility-timeout assertion pattern seen in
`#429`, `#431`, `#432`×2, and `#433` — and all three durations
(33s/30s/32s) fall squarely within the range those runs also showed
(29–42s).

## 3. Timing comparison against `#434`

| | `#434` | `#435` |
|---|---|---|
| `Setup Android emulator` total | 23m 29s | **4m 58s** |
| Emulator boot | `Boot completed in 86923 ms` | `Boot completed in 71379 ms` |
| Flow 1 duration | 72s (slower than usual) | 33s (normal range) |
| Flow 2 duration | 14m 40s (driver unreachable) | 30s (normal, assertion-false) |
| Flow 3 duration | 4m 6s (driver unreachable) | 32s (normal, assertion-false) |
| Device/driver-loss error | Present | **Absent** |

This run's timing profile is indistinguishable from the established
pre-`#434` pattern across every measure.

## 4. Toolchain and disk — unchanged

```
platform-tools Pkg.Revision=37.0.1
emulator Pkg.Revision=37.1.11
/dev/root 72G 63G 8.8G Avail 88% Use%
```

Identical to `#433` and `#434`. No toolchain drift between any of the
three most recent runs; disk headroom consistent throughout.

## 5. Finding B and Option A

```
##[error]Failed to CreateArtifact: Artifact storage quota has been hit. ...
Cache saved with key: gradle-79ba61aedf1f5ca553b9d2ddc02d94801c29df8a2799eaa6cbaa789da4193ac0
```

Finding B recurred identically — unaffected by anything in this run.
`Save Gradle cache` succeeded again — the **sixth** independent
confirmation of the Option A fix.

## 6. What this run does and does not establish, per the pre-agreed decision tree

Per the decision tree already agreed before this run: *"If #435
returns to the earlier visibility-timeout pattern: treat #434's
emulator death as likely intermittent and focus Finding A back on the
deterministic UI/readiness failure."*

**That is exactly what happened.** This is one data point (2 of 5
sampled runs showed the visibility-only pattern before `#434`; now 5
of 6 total sampled runs show it, with `#434` as the sole outlier) —
consistent with `#434`'s emulator death being an intermittent,
lower-frequency event rather than a persistent, reproducible
infrastructure failure. This does **not** rule out recurrence in the
future, and does not by itself explain what caused `#434`'s event —
only that it did not repeat under the same conditions (same commit,
same toolchain versions, same disk headroom) on the very next attempt.

**The deterministic, reproducible problem remains the visibility
timeout** — now observed identically in 5 of 6 sampled runs, and the
one this audit chain has the most evidence for. Per the same
pre-agreed framing, Finding A's focus reverts to that as the primary,
addressable question; the emulator-death event from `#434` is kept on
record as a separate, lower-priority, not-yet-recurring observation
rather than elevated to a second active investigation track.

## 7. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  document.

---

## Status

**PHASE 8A-24 CI VERIFICATION (run `#435`): COMPLETE.**

| Layer | Status |
|---|---|
| `#434`'s emulator-death mode | ✅ Did NOT recur |
| Visibility-timeout pattern | ❌ Recurred — 5th occurrence across 6 sampled runs, now the dominant/established pattern |
| Toolchain versions | ✅ Unchanged (`37.0.1` / `37.1.11`) |
| Disk headroom | ✅ Consistent (`8.8G` / `88%`) |
| Finding B | ❌ Recurred — identical, still open |
| Option A (Gradle cache save) | ✅ 6th independent confirmation |
| CI conclusion | ❌ FAILURE |
| Production readiness | ❌ NOT READY — unchanged |

Per the pre-agreed decision tree, Finding A's focus returns to the
deterministic visibility-timeout pattern; `#434`'s emulator-death
event is retained as a distinct, non-recurring observation. Awaiting a
separate, explicit authorization for the next step.
