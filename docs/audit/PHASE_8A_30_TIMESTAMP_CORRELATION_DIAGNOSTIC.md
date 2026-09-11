# Phase 8A-30 — Timestamp-Correlation Diagnostic Implementation

Implements: "Authorize the timestamp-correlation diagnostic on
ci.yml." Directly targets the specific gap `PHASE_8A_29` §3 left open:
sustained host-side CPU contention was evidenced (the qemu emulator
process alone at 165–174% of a core), but neither SystemUI's own
guest-OS CPU usage nor a precise correlation between that contention
and the SystemUI ANR's actual on-screen timing could be established.
**Observability only. AVD configuration, emulator options, and the
three Maestro flows are all explicitly unchanged — confirmed below. No
remediation of Finding A or B. No CI rerun.**

## 1. What was changed

Confined to the `e2e` job in `.github/workflows/ci.yml`:

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 73 ++++++++++++++++++++++++++++++++++++++++++++----
 1 file changed, 67 insertions(+), 6 deletions(-)
```

The 6 deletions are all replaced-in-place (a tightened sampling
interval and its accompanying comment/group-label text) — verified
below that nothing outside the diagnostic instrumentation is touched.

### 1a. Host-side resource sampler tightened from 10s to 3s

`PHASE_8A_29`'s 10-second sampling could only bound the ANR's timing to
a multi-minute window. Tightening to 3s gives materially finer
resolution for the same purpose, at the cost of roughly 3x more log
volume — judged acceptable given `#437`'s total job log (6,409 lines)
had ample headroom under the retrievable-tail limit `PHASE_8A_27`
documented.

### 1b. New guest-side per-process CPU sampler (`dumpsys cpuinfo`)

```bash
nohup bash -c 'while true; do date -u +%FT%TZ; adb shell dumpsys cpuinfo 2>&1; echo; sleep 3; done' > "$HOME/guest-cpuinfo.txt" 2>&1 &
```

The host's `ps`/`top` (used by the existing sampler) can only see the
single `qemu-system-x86_64-headless` process — SystemUI's own CPU
consumption is a guest-OS-internal concept, invisible from the host
entirely. `dumpsys cpuinfo` is Android's own per-process CPU
accounting, run from inside the guest via `adb shell`, and reports a
`TOTAL` line plus a named breakdown that includes
`com.android.systemui` and this app's own process — the only way to
directly answer the user's stated open question ("is SystemUI itself
CPU-starved, not just the host process busy"). Same 3s cadence and the
same `date -u` (host clock) timestamp source as the host sampler, so
the two files can be read side by side on one shared timeline without
a conversion step.

### 1c. One-time host/guest clock-offset capture

```bash
{
  echo "host (date -u):  $(date -u +%FT%T.%3NZ)"
  echo "guest (adb shell date -u): $(adb shell date -u 2>&1)"
} > "$HOME/clock-offset.txt"
```

Both samplers above are host-clock-stamped, but `logcat`'s own
`threadtime` format is stamped with the **guest's** local clock — the
only place a genuine on-device ANR trace timestamp could appear (see
1d). Without knowing the offset between the two clocks, any attempt to
line up a guest-clock-stamped logcat line against the host-clock-stamped
resource samples would be a guess. This captures both clocks once,
immediately after both sampler loops are already running, so the offset
(if any) is on record.

### 1d. Broader ANR-marker search in logcat

```bash
grep -iE "ActivityManager|ANR in|Input dispatching timed out|Not responding" "$HOME/logcat.txt"
```

Added as its own diagnostic group, alongside (not replacing) the
existing FATAL/crash/exception grep. A prior review found zero matches
for the literal substring `"ANR"` in logcat — correctly not a
contradiction of `PHASE_8A_25`'s SystemUI-ANR finding, since that
evidence came from Maestro's own hierarchy dump, not logcat — but it
also does not rule out an ANR trace existing under one of Android's
actual standard log markers, which this searches for directly. If any
line matches, its `threadtime` timestamp (via 1c) is the most direct
timing evidence available for the correlation the user's plan asks
for.

### 1e. Display step extended

`Show runner resource usage and OOM check` now also surfaces
`guest-cpuinfo.txt` and `clock-offset.txt`, alongside the existing
host sampler and `dmesg` output — all four are observability groups,
none change behavior.

## 2. What was deliberately NOT changed, and verification performed

Per the user's explicit "what I would not do yet" and the plan's own
constraints:

```
$ git diff --stat .maestro/
(no output — the three flows are byte-identical)

$ git diff .github/workflows/ci.yml | grep -E "emulator-options|avd-name|profile:"
(no output — AVD/emulator config lines are byte-identical)

$ git diff --stat android/
(no output — application/build config untouched)

$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
```

No RAM/CPU/image/toolchain change is made. No flow is modified. This
is instrumentation only, exactly as authorized.

## 3. Why this design answers the plan's specific asks

The user's forensic plan asked for five things; each is addressed
directly, with one explicit limitation noted:

- **"Increase resource sampling granularity"** — done (§1a, 10s → 3s).
- **"Capture CPU utilization for: emulator process, SystemUI, the
  test/app process, host CPU"** — the emulator process and host CPU
  are already covered by the existing host sampler (top-8 by CPU
  reliably surfaces the single qemu process); SystemUI and the app
  process are now covered by the new guest-side `dumpsys cpuinfo`
  sampler (§1b), which reports every running process by name,
  including both `com.android.systemui` and
  `com.astrosarfaraz.shamsalasrar`.
- **"Capture timestamps from the same clock/source for: flow action,
  ANR occurrence, CPU samples, logcat/SystemUI evidence"** —
  **partially achievable, and the limitation is real, not
  implementation-deferred.** Flow actions (Maestro's `commands-*.json`
  traces) and CPU samples (both host and guest, §1a/1b) already share
  or now share a common host-UTC clock. The ANR's own on-screen
  timing, however, is only directly knowable from Maestro's static
  hierarchy-dump JSON (no independent timestamp of its own) unless a
  genuine logcat ANR trace exists (§1d) — if §1d's search finds
  nothing, as the literal-"ANR" search already found nothing, the ANR's
  exact moment will remain boundable only to the flow's overall
  duration, not further. This diagnostic maximizes the chance of
  closing that gap; it cannot guarantee doing so, because it depends on
  whether Android actually logged a formal ANR event for this specific
  failure mode (a `SystemUI`-scoped ANR dialog does not always route
  through the same `ActivityManager`/`am_anr` logging path as an
  app-level ANR).
- **"Determine whether CPU contention precedes/coincides with each
  ANR"** and **"compare the three flows"** — both are analysis to
  perform once a run's data is retrieved (the next CI Rerun
  Authorization + review), not something implementable in the
  instrumentation itself; this document sets up the data this
  analysis will need.

## 4. What this document does and does not establish

**Does:**
- Implement exactly the authorized diagnostic: tightened host sampling,
  a new guest-side per-process CPU sampler, a clock-offset capture, and
  a broader ANR-marker logcat search.
- Confirm the change is confined to observability instrumentation —
  flows, AVD config, and application code are all verified untouched.

**Does not:**
- Establish whether CPU contention precedes or coincides with the ANR
  — that requires an actual run's data, not yet collected.
- Guarantee the ANR's exact on-screen timing becomes knowable — depends
  on whether a logcat ANR trace exists at all for this failure mode.
- Change AVD/emulator resource allocation or any other remediation.
- Address Finding B, which remains isolated per the user's explicit
  instruction.
- Change the production-readiness verdict, which remains unchanged.

## 5. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — this commit is on the feature
  branch only.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here. Working tree clean before and after.
- No merge to `main` and no CI rerun is performed or requested by
  this document.

---

## Status

**PHASE 8A-30 TIMESTAMP-CORRELATION DIAGNOSTIC: COMPLETE.**

| Layer | Status |
|---|---|
| Host sampler interval | ✅ Tightened 10s → 3s |
| Guest-side per-process CPU sampler (`dumpsys cpuinfo`) | ✅ Implemented |
| Host/guest clock-offset capture | ✅ Implemented |
| Broader logcat ANR-marker search | ✅ Implemented, additive to existing FATAL/crash grep |
| AVD configuration / emulator options | ✅ Unchanged — verified via diff |
| Maestro flows (`.maestro/`) | ✅ Unchanged — verified via diff |
| Application/build code (`android/`) | ✅ Unchanged — verified via diff |
| YAML validity | ✅ Verified |
| Actual correlation achieved | 🔲 Not yet observed — requires a separate CI Rerun Authorization |
| Finding A root cause | 🔲 Still not confirmed |
| Finding B | 🔲 Untouched, still isolated |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun to exercise this instrumentation and the timestamp-correlation
analysis it is meant to enable, or any other action the owner chooses.
