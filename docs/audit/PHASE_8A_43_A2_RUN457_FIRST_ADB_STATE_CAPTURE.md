# Phase 8A-43 — Run #457: first `adb-state.txt` capture of a live A2-class anomaly

Run `#457` (id `35062829561`, head `638ea65`, the commit that added
`PHASE_8A_41`'s ADB transport-layer sampler) completed while being
monitored live in this session. **This is the first A2-band occurrence
captured with the new `adb-state.txt` sampler active**, and the first
time this audit chain has any direct transport-layer evidence for A2
at all, rather than only a top-level error message and a duration
outlier.

## 1. Headline numbers

- `Setup Android emulator` step: `06:25:11Z` → `06:52:43Z` =
  **27m32s (1652s)** — longer than both prior confirmed A2 occurrences
  (`#434`: 1409s, `#448`: 1445s; baseline from `PHASE_8A_42`: 300–460s).
- Job conclusion: `failure`. Run conclusion: `failure`.
- This extends the A2-band cluster to 3 occurrences: `#434` (1409s),
  `#448` (1445s), `#457` (1652s) — all still tightly clustered as a
  distinct, multi-hundred-percent-above-baseline band, though `#457`
  is the longest of the three so far.

## 2. What `adb-state.txt` actually showed

The retrievable tail (same ~4999-line cap documented since
`PHASE_8A_27`, reconfirmed here) captured a **239-sample slice**
of the sampler's output, spanning host-UTC `06:28:03Z`–`06:41:03Z` —
roughly the middle third of the 27m32s step. Neither the step's start
(`06:25:11`–`06:28:03`) nor its true end (`06:41:03`–`06:52:43`,
including whatever happened at the moment the step actually failed)
is in this window — the same retrieval-gap pattern `PHASE_8A_41`
described, just landing on a different slice this time. **This is a
partial capture, not a complete causal chain.**

Within that partial window:

- **238 of 239 `adb get-state` samples**: `device` (reachable),
  consistently `transport_id:1`.
- **One sample, `06:40:18Z`**: transport loss, confirmed on all three
  probes in the same 3s tick:
  ```
  adb get-state: error: device 'emulator-5554' not found
  sys.boot_completed: adb: device 'emulator-5554' not found
  guest uptime: adb: device 'emulator-5554' not found
  ```
- **Next sample, `06:40:21Z` (3s later)**: device reachable again —
  but as **`transport_id:2`**, not `transport_id:1`. The following 14
  samples (through `06:41:03Z`, where this window ends) all show
  `transport_id:2`.
- Guest-side load average (`adb shell uptime`, sampled the whole
  window): ranged from 4.09 up to **31.35** at points — severe
  contention, guest uptime at the anomaly ≈ 14 minutes since boot.

## 3. What this does and does not establish

**Does:**
- **First direct mechanical evidence of what an A2-band transport
  event looks like**, as opposed to only a symptom (`Android driver
  unreachable`) and a duration outlier. The `transport_id` change
  (`1` → `2`) is a real, specific signal: ADB did not merely lose and
  regain a flaky link to the same device session — it re-enumerated a
  *new* transport for `emulator-5554`. That is consistent with the
  emulator process itself having restarted or been re-attached, not
  with a purely network/USB-layer hiccup on an otherwise-stable
  process.
- Confirms the sampler mechanism works exactly as designed
  (`PHASE_8A_41`): a real transport-loss event was captured on its own
  3s tick, correlated across all three probes, host-UTC timestamped.
- Corroborates the standing resource-contention thread (`PHASE_8A_29`
  and others): guest load average north of 30 sampled during this same
  run.

**Does not:**
- **Explain the 27m32s total duration.** The captured transport-loss
  event itself resolved in 3 seconds (one sampler tick). It is not,
  on its own, sufficient to account for a step that ran nearly half an
  hour before failing. Either (a) this single blip is a symptom of a
  larger disruption that started before `06:28:03` or continued after
  `06:41:03` — both outside this capture window — or (b) it is one of
  several similar events not captured in this partial slice, or (c) it
  is a real but ultimately minor event and the dominant cause of the
  27m32s duration lies elsewhere (e.g. the emulator/system-image
  install or boot phase itself stalling, which this sampler does not
  instrument). **This document does not pick between these — the
  evidence to decide is outside the retrievable window.**
- Prove the `transport_id` change *caused* the eventual job failure
  rather than being incidental — no Maestro-level flow/assertion
  output was retrievable in this same tail (same limitation as
  `PHASE_8A_41` found for `#448`; the actual `Android driver
  unreachable`/flow-failure text lives earlier in the step's own
  output, still outside the retrievable window).
- Change `ci.yml`, AVD/emulator config, RAM/CPU allocation, or the
  judgment engine — this document is analysis of already-captured log
  output only, no changes made.
- Close A2. Confirms the sampler is working and gives the first real
  clue (`transport_id` re-enumeration), not a root cause.

## 4. Recommended next step

The retrievable-window problem is now the binding constraint, not the
absence of instrumentation — `PHASE_8A_41`'s sampler is proven to
work. Two options for whoever resumes:

1. Wait for/trigger further occurrences and hope a future run's
   overall log is short enough (or the anomaly close enough to the
   step's own end) that the retrievable tail happens to cover it.
2. **Relocate the ADB-state group's `cat` output earlier in the same
   step** (mirroring the exact fix pattern `PHASE_8A_28`/`PHASE_8A_34`
   already used for the resource/logcat samplers), or split it into
   its own dedicated step placed immediately after `Setup Android
   emulator` and before the larger hierarchy-dump content in `Show
   logcat...` — so a tail-based fetch is more likely to land on its
   true start and end rather than an arbitrary middle slice, the way
   this run's capture did.

Option 2 is a small, additive, single-purpose diagnostic-ordering
change of exactly the kind already precedented multiple times in this
audit chain (not a resource/AVD/judgment change) — flagged here as a
candidate, not yet implemented, since it wasn't evidenced as necessary
until this run showed the tail landing mid-group.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself. No CI config,
  AVD/emulator, RAM/CPU, or judgment-engine change.
- Run `#457` (id `35062829561`) was triggered by a source external to
  this session (already `in_progress` when this session first checked
  it); this document only analyzes its already-produced output.

---

## Status

**PHASE 8A-43: FIRST REAL ADB-TRANSPORT EVIDENCE FOR A2 CAPTURED — PARTIAL, NOT YET A ROOT CAUSE.**

| Layer | Status |
|---|---|
| `adb-state.txt` sampler | ✅ Confirmed working — captured a real transport-loss event on its own tick |
| A2-band cluster | ✅ Extended to 3 occurrences (`#434` 1409s, `#448` 1445s, `#457` 1652s) |
| Transport-loss mechanism | 🟠 New clue: `transport_id` changed (`1`→`2`) across the drop — consistent with re-enumeration, not a flaky link |
| 27m32s duration explained | ❌ Not established — captured blip resolved in 3s, window doesn't cover step start/end |
| Root cause | 🔲 Still open |
| Retrievable-window limitation | 🟠 Now the binding constraint; step-ordering relocation proposed as next candidate fix, not yet implemented |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |
