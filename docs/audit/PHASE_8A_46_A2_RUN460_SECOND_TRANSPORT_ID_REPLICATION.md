# Phase 8A-46 — Run #460: second independent replication of the transport_id 1→2 signature

Run `#460` (id `35075749399`, head `5120827`) was triggered and observed
live as part of the ongoing A2 watch loop. `Setup Android emulator`
ran **1099s (18m19s)** — an intermediate duration, between the normal
baseline (`PHASE_8A_42`: 300–460s) and the previously observed A2
cluster (`#434`/`#448`/`#457`: 1409–1652s). Analyzed rather than
dismissed, since it's a new data point.

## 1. Relocation fix holds again

The `Show ADB transport-layer state` group is fully retrievable
(lines 2141–4970 of 4999, both `##[group]` and `##[endgroup]` present,
margin to spare) — third consecutive confirmation the `PHASE_8A_44`
relocation works.

## 2. Filtered sample analysis (per `PHASE_8A_45`'s correction)

Step window: `08:59:30Z`–`09:17:49Z`. 318 total samples captured
(`09:02:19Z`–`09:19:28Z`); filtering to only those inside the step's
own window:

- **One genuine in-test transport-loss sample: `09:12:40Z`.**
  Confirmed on all three probes (`get-state`, `sys.boot_completed`,
  `uptime`), immediately preceded (`09:12:37Z`) by `transport_id:1`
  and immediately followed (`09:12:43Z`, 3s later) by
  **`transport_id:2`** — recovered, but as a new transport session,
  not the old one.
- Guest load average at the surrounding samples: 6.53–11.15 (elevated,
  though well below `#457`'s peak of 31.35).
- All samples from `09:17:52Z` onward (32 consecutive `LOST`, through
  the capture window's end at `09:19:28Z`) begin 3 seconds after the
  step's own completion (`09:17:49Z`) — confirmed post-teardown noise
  per `PHASE_8A_45`, not counted as evidence.

## 3. This is a replication, not a new signature

This is **the exact same mechanical signature** `PHASE_8A_43` first
captured in run `#457`: a single 3-second transport-loss tick,
self-resolving via a `transport_id` increment (`1`→`2`), amid elevated
guest load. Two independent occurrences, two different runs, same
precise pattern (down to the exact probe-level confirmation and the
transport_id mechanics) is meaningfully stronger evidence than either
alone — this is not a one-off artifact of `#457`'s specific run.

**What replication does and does not add:**

- **Does** strengthen the `PHASE_8A_43` hypothesis that A2-band
  durations involve the emulator process being re-attached/restarted
  mid-run (evidenced by `transport_id` incrementing, not just an ADB
  link flapping) rather than a purely transient network hiccup.
- **Does not** explain why `#460`'s total duration (1099s) differs
  substantially from `#457`'s (1652s) despite both having exactly one
  such blip landing at a similar point into the run (`#457`: ~15min in;
  `#460`: ~13min in, out of 18min total). The blip itself resolves in
  3 seconds in both cases — it is not, by itself, what makes the step
  run long. Something else is responsible for the extended duration
  around the blip, still outside what this sampler observes.
- **Does not** establish a root cause. Still two data points for the
  "one mid-run blip" pattern, and the underlying reason the emulator
  needs re-attaching at all remains unexplained.

## 4. What this does and does not establish

**Does:** Confirms `PHASE_8A_44`'s relocation fix continues to work;
replicates `PHASE_8A_43`'s transport_id-change finding independently;
extends the range of observed "elevated but sub-A2" durations (1099s)
alongside the established baseline (300–460s) and full A2 band
(1409–1652s) — three duration tiers now empirically observed, not two.

**Does not:** Establish A2's root cause. Touch `ci.yml`, AVD/emulator
config, RAM/CPU, application code, or the judgment engine. Change the
production-readiness verdict.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Run `#460` (id `35075749399`) was triggered by this session's
  watch loop, per explicit authorization to trigger runs and watch for
  A2 occurrences.

---

## Status

**PHASE 8A-46: SECOND TRANSPORT_ID-CHANGE REPLICATION (RUN #460) — PATTERN STRENGTHENED, ROOT CAUSE STILL OPEN.**

| Layer | Status |
|---|---|
| `PHASE_8A_44` relocation | ✅ Confirmed working a third time |
| Transport_id 1→2 signature | ✅ Replicated independently (2nd occurrence: `#457`, `#460`) |
| Duration-tier picture | 🟠 Now 3 tiers observed: baseline (300-460s), intermediate (1099s), A2 (1409-1652s) |
| Blip → total duration causation | ❌ Not established — blip resolves in 3s, doesn't explain the extended step length |
| A2 root cause | 🔲 Still open |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |

Watch loop continues per standing stop conditions (PR merge or A2 root
cause established).
