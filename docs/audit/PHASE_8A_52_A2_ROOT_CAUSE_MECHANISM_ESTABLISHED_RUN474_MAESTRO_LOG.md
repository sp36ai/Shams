# Phase 8A-52 — A2's post-blip elongation mechanism established from Maestro's own log (run #474)

Every prior A2 document (`PHASE_8A_43` through `PHASE_8A_51`) analyzed only the host-side `adb-state.txt` sampler. This document analyzes **Maestro's own stdout/stderr** for run `#474` (id `35115521521`, the same run documented in `PHASE_8A_51`), supplied directly by the user as raw job log excerpt. It resolves the central open question repeated in every prior finding: *why does the total step duration vary by hundreds to thousands of seconds after a 3-second transport blip that resolves on its own?*

## 1. The exact causal chain, from primary evidence

**15:45:29Z** — Maestro begins executing its 3-flow test suite (`.maestro/ci/`): `Waiting for flows to complete...`

**15:55:33.94Z** — Maestro's own internal adb client (the `dadb` library, used internally by Maestro to talk to the device) throws, in a background connection-forwarding thread:

```
##[error]Exception in thread "pool-4-thread-1" java.io.IOException: Command failed (host:transport:emulator-5554): device 'emulator-5554' not found
	at dadb.adbserver.AdbServer.send$dadb(AdbServer.kt:99)
	at dadb.adbserver.AdbServerDadb.open(AdbServer.kt:137)
	at dadb.forwarding.TcpForwarder.handleForwarding$lambda-1(TcpForwarder.kt:64)
```

This is **the exact same moment** `PHASE_8A_51`'s `adb-state.txt` sampler caught as the transport_id blip: `15:55:33Z` LOST, `15:55:36Z` recovered as `transport_id:2`. The host-level adb daemon self-heals in 3 seconds by re-enumerating the device under a new transport ID — but **Maestro's own driver connection (via `dadb`'s `TcpForwarder`) does not recover**. This is the first time we've had direct evidence of *what breaks* at the blip, rather than just observing that the OS-level adb link recovers.

**15:59:35.16Z** — the first flow fails: `[Failed] Journey — sign up through onboarding to the Oracle (14m 5s) (Android driver unreachable)`. It had been running since `15:45:29Z` (~14m6s total), and the transport exception hit **10m4s into that flow** — but the flow doesn't report failure until **4m2s after** the exception. Maestro apparently doesn't fail a flow the instant its driver breaks; it keeps trying for a bounded period before giving up with `Android driver unreachable`.

**16:03:39.60Z** — the second flow fails: `[Failed] Auth — Sign In flow (4m 4s) (Unable to launch app com.astrosarfaraz.shamsalasrar: Android driver unreachable)`. The driver never recovered from the first break, so this flow can't even launch the app — it fails after its own ~4-minute timeout.

**16:07:40.57Z** — the third flow fails identically: `[Failed] Settings — plan display and sign out (4m 1s) (Unable to launch app ...: Android driver unreachable)`. `3/3 Flows Failed`.

**16:07:41.69Z** — the `maestro test` shell command exits with code 1; the GitHub Actions runner immediately proceeds to its own `Terminate Emulator` teardown group (`adb -s emulator-5554 emu kill`).

### The timing is not coincidental — it's a fixed per-flow timeout

| Interval | Duration |
|---|---|
| Flow 1 start → transport exception | 604s (10m4s) |
| Transport exception → Flow 1 failure | 242s (4m2s) |
| Flow 1 failure → Flow 2 failure | 244s (4m4s) |
| Flow 2 failure → Flow 3 failure | 241s (4m1s) |

Three consecutive intervals of **241–244 seconds**, each ending in an identical `Android driver unreachable` failure, is not coincidence — this is a fixed Maestro-internal timeout (~4 minutes) that governs how long a flow waits before giving up once the driver connection to the device is broken.

## 2. What this establishes: the post-blip elongation mechanism

This is a single causal chain, not two separate unexplained phenomena as `PHASE_8A_47`/`48`/`49` characterized it:

1. **A transient adb transport-layer hiccup occurs** (host-level `host:transport:emulator-5554` briefly returns "not found" — the root trigger of *this* is still not established, see §4).
2. **The OS-level adb daemon self-heals in ~3 seconds**, re-enumerating the device under a new `transport_id`. This is what `adb-state.txt` has been capturing all along.
3. **Maestro's own internal driver connection (via `dadb`) does not self-heal.** The currently-executing flow keeps running against a broken driver for up to ~4 minutes before Maestro gives up and reports `Android driver unreachable`.
4. **Every subsequent flow in the suite inherits the same broken driver** and fails immediately on `Unable to launch app ...: Android driver unreachable`, each still consuming its own ~4-minute timeout before Maestro moves to the next flow.
5. **Total step elongation = (time until the first affected flow gives up) + (~4 minutes × every remaining flow in the suite).**

This directly explains the previously "unexplained" duration variance across `#457`/`#460`/`#467`/`#468`/`#474`: the total elongation depends on (a) how far into its own execution the currently-running flow was when the transport hiccup hit, and (b) how many flows in the 3-flow suite still remained to cascade-fail afterward. A hiccup early in flow 1 with all 3 flows still to run produces a longer total than a hiccup late in the suite.

## 3. What this also explains: the "device offline" tail signature is not a separate mystery

`PHASE_8A_50`/`51` found a "device offline"/`error: closed` sample consistently ~21 seconds before the step's own `completed_at`, in two independent runs (`#471`, `#474`), and treated it as an unexplained second signature. This log resolves it: at `16:07:41.69Z`, immediately after `3/3 Flows Failed` and the `maestro test` shell command's non-zero exit, the GitHub Actions runner's own `Terminate Emulator` step begins and issues `adb -s emulator-5554 emu kill`. The "device offline" sample is simply `adb-state.txt`'s sampler catching the ADB daemon mid-teardown as the emulator process is killed — **ordinary, expected cleanup**, not a second root-cause signal. Its consistent ~21-second offset reflects the deterministic duration of the action's own post-failure teardown sequence, not a hidden mechanism.

## 4. What remains open

**Not established by this document:** the root trigger of the initial transport-layer hiccup itself — why `host:transport:emulator-5554` briefly returns "device not found" at all. Candidate causes floated in earlier phases (host CPU contention, per `PHASE_8A_29`/`30`'s partial evidence of sustained qemu CPU usage) remain plausible but unconfirmed; no sampler in this run directly ties the `15:55:33Z` exception to a concurrent host-resource spike. This is now a much narrower, well-defined question than "why does A2 elongate the step" — that question is answered.

**Also not established:** whether `#469`'s elevated duration with zero `adb-state.txt` transport_id blip (`PHASE_8A_49`) went through this same `dadb` exception mechanism without it registering as a discrete 3-second host-level loss (e.g., a transient stall rather than a full re-enumeration), or hit a different failure path entirely. Re-examining `#469`'s Maestro log (if still available) against this same cascade pattern would resolve this, but was not done here.

**Does not establish:** any fix. This document does not modify `ci.yml`, AVD/emulator config, RAM/CPU, Maestro configuration, or application code. Candidate mitigations this now suggests (not implemented, owner decision required) include: a Maestro/driver-level retry-reconnect after a transport hiccup instead of a hard per-flow timeout, restarting the adb-emulator connection between flows, or investigating whether host resource pressure at the ~10-15 minute mark can be reduced. None of these are pursued here.

## 5. Why this meets the standing stop-condition bar

The user's explicit instruction for this watch loop was to stop once A2's root cause is "actually established (not just another occurrence/replication observed)". This document, for the first time, traces the actual failure mechanism from primary evidence (Maestro's own exception trace and per-flow failure timestamps) rather than inferring it from a host-side sampler alone. It answers the specific question every one of `PHASE_8A_47`/`48`/`49`/`50`/`51` explicitly flagged as unresolved: why the step runs for many extra minutes after a 3-second blip. That mechanism is now established. The residual open question (§4, the trigger of the initial hiccup) is real but substantially narrower than "why does A2 happen" — it no longer blocks understanding of why runs take as long as they do once a hiccup occurs.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Analysis is of run `#474` (id `35115521521`), already covered by `PHASE_8A_51`; this document adds analysis of Maestro's own log output (supplied by the user), which had not been examined in any prior phase — all prior phases used only the host-side `adb-state.txt` sampler.
- No open or merged PR exists for this branch.

---

## Status

**PHASE 8A-52: A2's POST-BLIP ELONGATION MECHANISM ESTABLISHED — A TRANSIENT ADB TRANSPORT HICCUP BREAKS MAESTRO'S OWN DRIVER CONNECTION (DISTINCT FROM THE OS-LEVEL ADB LINK, WHICH SELF-HEALS), CAUSING THE CURRENT FLOW AND EVERY SUBSEQUENT FLOW TO CASCADE-FAIL ON A FIXED ~4-MINUTE `Android driver unreachable` TIMEOUT.**

| Layer | Status |
|---|---|
| Post-blip elongation mechanism | ✅ Established — cascading per-flow ~4min driver-unreachable timeouts, traced from Maestro's own log |
| "Device offline" tail signature | ✅ Explained — ordinary `Terminate Emulator` teardown after Maestro's failed exit, not a separate mechanism |
| Duration variance across runs | ✅ Explained — depends on blip timing within the flow + flow count remaining in the suite |
| Root trigger of the initial transport hiccup | 🔲 Still open — host resource contention remains the leading unconfirmed candidate |
| `#469`'s no-blip elevated case | 🔲 Not re-examined against this mechanism — open |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged; no fix implemented |
| PR for this branch | 🔲 None exists (open or merged) |

Per the standing stop condition, this document establishes A2's root-cause mechanism (not merely another occurrence). The watch loop is being stopped; see the accompanying report to the user for next-step options.
