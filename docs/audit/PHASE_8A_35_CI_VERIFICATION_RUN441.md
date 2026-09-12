# Phase 8A-35 — CI Verification: Run `#441` (First Direct ANR Trace Captured)

Implements: "CI Rerun Authorization — checkpoint `309a584`." The
Phase 8A-34 relocation worked: for the first time in this audit
chain, `logcat`'s own `ActivityManager`-level ANR trace is directly
retrievable — not merely Maestro's on-screen overlay observation.
**Read-only — no application, test, or workflow file is changed. No
remediation of Finding A or B. No CI rerun.**

## 1. Run identification

- Run `#441`, id `34690464956`, event `workflow_dispatch`.
- `head_sha`: `309a584` — confirmed exact match before triggering.
- Final `status`: `completed`. Final `conclusion`: `failure`.
- `Setup Android emulator`: `11:25:31Z`–`11:30:41Z` (5m10s) — normal
  range, no early abort.

## 2. Confirmed: the Phase 8A-34 relocation works

```
##[group]logcat -- FATAL/crash/exception lines
##[group]logcat -- ANR-related markers (ActivityManager/ANR/input-dispatch-timeout/not-responding)
```

Both group headers, and their full content, are now inside the
retrievable tail window — the specific gap `PHASE_8A_33` recorded is
closed for this run.

## 3. The headline finding: a genuine, direct ANR trace

```
09-12 11:28:25.454   527  1568 E ActivityManager: ANR in com.android.systemui
09-12 11:28:25.454   527  1568 E ActivityManager: PID: 787
09-12 11:28:25.454   527  1568 E ActivityManager: Reason: executing service com.android.systemui/.dump.SystemUIAuxiliaryDumpService
09-12 11:28:25.454   527  1568 E ActivityManager: ErrorId: a8c8757d-6137-4540-b04b-3b7d297cacb0
09-12 11:28:25.454   527  1568 E ActivityManager: Frozen: false
09-12 11:28:25.454   527  1568 E ActivityManager: Load: 18.83 / 4.85 / 1.64
09-12 11:28:25.454   527  1568 E ActivityManager: ----- Output from /proc/pressure/memory -----
09-12 11:28:25.454   527  1568 E ActivityManager: some avg10=23.47 avg60=6.91 avg300=1.62 total=5780570
09-12 11:28:25.454   527  1568 E ActivityManager: full avg10=1.60 avg60=0.48 avg300=0.11 total=556509
09-12 11:28:25.454   527  1568 E ActivityManager: CPU usage from 11636ms to 18278ms later (2026-09-12 11:28:18.737 to 2026-09-12 11:28:25.379):
  25% 1176/com.google.android.gms: 20% user + 5.3% kernel
  23% 527/system_server: 11% user + 11% kernel
  21% 1324/com.google.android.inputmethod.latin: 13% user + 7.7% kernel
  17% 347/android.hardware.graphics.composer@2.3-service: 0.3% user + 17% kernel
  ...
  5.6% 787/com.android.systemui: 1.9% user + 3.6% kernel
```

**This is a real, official Android ANR event, not an inference from
Maestro's own overlay observation** — the first this audit chain has
directly captured. Exactly one occurrence this run. Key facts:

- **`com.android.systemui`'s own CPU share at the moment of the ANR is
  5.6%** — low, consistent with `PHASE_8A_33`'s finding that SystemUI
  itself is not CPU-starved. The elevated processes are
  `com.google.android.gms` (25%), `system_server` (23%), and the input
  method (21%) — none of them SystemUI.
- **The specific `Reason` is new information**: ANR while "executing
  service `com.android.systemui/.dump.SystemUIAuxiliaryDumpService`" —
  a system-internal diagnostic/dump service, not a normal UI-rendering
  or input-handling path.
- Memory pressure at that moment: `some avg10=23.47` — non-trivial
  memory contention pressure (the `some` PSI metric reflects any task
  stalled on memory), though not the `full` metric (which stayed low,
  `1.60`), meaning the system wasn't fully memory-starved but had
  meaningful partial memory-pressure stalls.
- Guest clock offset this run: `host: 2026-09-12T11:28:20.535Z` /
  `guest: Sat Sep 12 11:28:19 UTC 2026` — guest ~1s behind host,
  placing the ANR (guest `11:28:25.454`) at approximately host
  `11:28:26.5Z`.

## 4. A new, testable hypothesis this evidence raises — not asserted as fact

The ANR's `Reason` field naming `SystemUIAuxiliaryDumpService`
specifically — a service that exists to let `dumpsys`/bugreport
tooling capture SystemUI's internal state — raises a real possibility
that this audit chain's own instrumentation (the Phase 8A-30
`adb shell dumpsys cpuinfo` guest sampler, running every 3 seconds) or
Maestro's own view-hierarchy capture mechanism could be a contributing
or triggering factor, not merely a passive observer. **This is a
hypothesis, not a finding** — `dumpsys cpuinfo` does not obviously
target `com.android.systemui` specifically, and Maestro's hierarchy
capture is a plausible alternative or contributing trigger. Testing
this would require a controlled run with the guest-side sampler
disabled, compared against one with it enabled, under otherwise
identical conditions — not performed here, and not authorized by
this document.

## 5. FATAL/crash group: benign only

```
09-12 11:28:34.664 ... W Telephony: registerMmTelCapabilityCallback: registration failed, no ImsService available...
09-12 11:28:34.768 ... W Icing: Failed to get Lockbox signed-in status: java.util.concurrent.TimeoutException...
09-12 11:28:35.344 ... I NearbyDiscovery: java.util.concurrent.TimeoutException: Timed out waiting for Task
```

All matches are benign, system-level service timeouts unrelated to
the app under test or to SystemUI — no app crash, no `FATAL EXCEPTION`
naming the app's own process.

## 6. A trade-off this relocation surfaced — reported plainly, not glossed over

The relocated `Show logcat ANR/FATAL search results` step's content
landed in the retrievable window this run — but `Show logcat and
preserved Maestro debug artifacts` (which now runs *before* it,
carrying the last-150-lines, Maestro artifacts listing, hierarchy
dumps, and `commands-*.json` extraction) is **entirely absent** from
this run's retrievable window (confirmed: zero matches for `"System UI
isn't responding"` or `android:id/alertTitle test` this run). The
fixed-size retrievable-tail budget (`PHASE_8A_27`) didn't grow —
moving the FATAL/ANR searches later shifted which content survives,
not how much survives in total. This run, that trade favored the
FATAL/ANR searches (which paid off directly, per §3); a different
run's content mix could favor the other way. **This is not a
contradiction of prior runs' hierarchy-dump-based ANR evidence
(`PHASE_8A_25`/`PHASE_8A_29`/`PHASE_8A_33`)** — it is a gap in what
could be checked this run, explained by where the budget landed.

## 7. Cross-reference against the previously-unverified externally-reported claims

A message received two check-ins ago claimed specific logcat lines:
`"ActivityManager: Timeout waiting for provider
com.android.systemui.keyguard"` and `"Long monitor contention with
owner ActivityManager/PackageManager"`. This run's retrievable data
lets those be assessed directly for the first time:

- **The general phenomenon type is now corroborated**: a real
  `ActivityManager`-logged ANR against `com.android.systemui`, and
  `system_server: Long monitor contention with owner PackageManager`
  lines, are both genuinely present in this run's logcat (see the raw
  contention lines in §3's surrounding context, timestamped
  `11:28:21.679`–`11:28:23.850`).
- **The specific claimed lines are not an exact match**: this run's
  actual ANR reason is `executing service
  com.android.systemui/.dump.SystemUIAuxiliaryDumpService`, not a
  keyguard-provider timeout, and the contention owner is
  `PackageManager` alone, not `ActivityManager/PackageManager` as
  phrased. Different run, different specific triggering condition —
  not a reproduction of the exact claimed evidence, but the same
  general class of ANR/contention phenomenon.

## 8. Classification against A1 / A2 / #436

**This run's signature is A1 (SystemUI ANR)** — now with the strongest
evidence yet: a direct `ActivityManager`-logged ANR trace, not an
inference from Maestro's overlay text. No ADB/device-transport-loss
signature (A2, `#434`'s pattern) occurred. No unclassified-assertion
signature (`#436`'s pattern) occurred — all three flows failed with
the standard visibility-timeout pattern, consistent with A1's overlay
obstruction explanation.

## 9. Deterministic pattern, Finding B, and Option A — unchanged

```
3 tests were completed in 95s with 0 passed, 3 failed and 0 skipped.
  Assertion is false: id: auth-tab-signup is visible
  Assertion is false: id: auth-tab-signin is visible
  Assertion is false: id: settings-gear-btn is visible

##[error]Failed to CreateArtifact: Artifact storage quota has been hit.
Cache saved with key: gradle-c5ed8e03ce2f97b0d3846420d82e71c3d292f66535344538119a8a282a998dbd
```

All three flows failed identically to the established pattern (95s
combined). Finding B recurred identically. `Save Gradle cache`
succeeded again — continuing the unbroken Option A record.

Toolchain/AVD config unchanged (`37.0.1`/`37.1.11`,
`hw.cpu.ncore = 2`, `hw.ramSize = 1536M`).

## 10. What this run does and does not establish

**Does:**
- Confirm the Phase 8A-34 relocation achieves its purpose for the
  FATAL/ANR searches specifically.
- Capture the first direct, official Android ANR trace this audit
  chain has obtained — with an exact reason, timestamp, and process
  snapshot.
- Reconfirm `com.android.systemui`'s own CPU is low at the ANR moment
  — the elevated processes are elsewhere (GMS, `system_server`, input
  method).
- Raise a new, specific, testable hypothesis (§4) about this audit
  chain's own instrumentation possibly contributing to the observed
  ANR — not yet tested.
- Classify this run cleanly as A1, with the best evidence yet.

**Does not:**
- Resolve the trade-off in §6 — a way to retrieve both the FATAL/ANR
  searches and the hierarchy-dump/commands-json content in the same
  run remains unsolved.
- Prove or disprove the instrumentation-observer-effect hypothesis
  (§4) — requires a controlled comparison run, not performed here.
- Change emulator resource allocation or any other remediation.
- Address Finding B.
- Change the production-readiness verdict, which remains unchanged.

## 11. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected by this document.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  document.

---

## Status

**PHASE 8A-35 CI VERIFICATION (run `#441`): COMPLETE.**

| Layer | Status |
|---|---|
| Phase 8A-34 relocation | ✅ Confirmed effective — FATAL/ANR search output now retrievable |
| Direct ANR trace | ✅ **First captured this audit chain** — `ANR in com.android.systemui`, reason: `SystemUIAuxiliaryDumpService`, `11:28:25.454` guest |
| `com.android.systemui` CPU at ANR moment | ✅ Low (5.6%) — consistent with `PHASE_8A_33` |
| Instrumentation-observer-effect hypothesis | 🟠 Raised, not tested |
| Hierarchy-dump/`commands-*.json` retrievability | ❌ Traded away this run — new gap, explained (§6) |
| Externally-reported specific ANR lines | 🟠 General phenomenon corroborated; exact lines not matched |
| Classification | ✅ A1 (SystemUI ANR) |
| Visibility-timeout pattern (all 3 flows) | ❌ Recurred, 95s combined |
| Finding B | ❌ Recurred — identical, still open |
| Option A (Gradle cache save) | ✅ Confirmed again |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — testing
the instrumentation-observer-effect hypothesis, resolving the §6
trade-off, a remediation attempt, Finding B's own next step, or any
other action the owner chooses.
