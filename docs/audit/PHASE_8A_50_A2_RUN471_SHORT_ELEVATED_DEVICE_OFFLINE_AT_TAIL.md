# Phase 8A-50 — Run #471: shortest elevated occurrence yet; new "device offline" tail signature, not the transport_id blip

Run `#471` (id `35105814882`, head `152c826`, triggered by this session's ongoing A2 watch loop) hit **`Setup Android emulator`: 12m30s (750s)**, `failure` conclusion. This is the shortest elevated/non-baseline duration observed so far — above the normal baseline (300–460s) but below every previously seen "intermediate"/A2 duration (1099s and up).

## 1. Relocation fix holds a seventh consecutive time

`Show ADB transport-layer state` fully retrievable: lines 3229–4971 of 4999, both `##[group]`/`##[endgroup]` markers present.

## 2. Filtered analysis (per `PHASE_8A_45`'s correction)

Step window: `14:13:43Z`–`14:26:13Z`. 165 in-window samples, comprehensive coverage confirmed: first sample `14:17:08Z` (~3m25s into the step), last `14:25:52Z` (~21s before step end).

**Zero `transport_id` changes and zero `get-state`/"not found" losses anywhere in-window** — `transport_id:1` held for the entire step, unlike the four prior A2-band occurrences (`#457`/`#460`/`#467`/`#468`).

## 3. A key structural caveat: this step never reached the established blip window

All four prior transport_id blips (`#457`/`#460`/`#467`/`#468`) landed **~13–15 minutes into their respective steps** (`PHASE_8A_47`/`48`). This step's *entire* duration was only 12m30s — it ended **before** the step-relative time where the blip has ever been observed to occur. So the absence of the blip here is not a clean disproof or replication either way; it's structurally impossible for the established-timing blip to have appeared in a step this short. This is a materially different situation from `#469` (`PHASE_8A_49`), which ran 22m36s — long enough to fully contain the established blip window — and still showed no blip. `#471` cannot be used as a fifth "elevated, no blip" data point on equal footing with `#469`.

## 4. New finding: a distinct "device offline" signature at the very tail of the step

The last in-window sample, `14:25:52Z` (~21s before the step's own `completed_at`, `14:26:13Z`):

```
adb get-state: device
sys.boot_completed: error: closed
guest uptime: adb: device offline
```

This is a **different failure shape** from every previously documented occurrence: `get-state` still reports the device is present (not "not found"), but the two other probes (`sys.boot_completed`, `guest uptime`) both report `device offline`/`error: closed`. `transport_id` never changed — this is not a re-enumeration event, it looks like the ADB connection degrading/closing right at the point the step gives up, rather than a mid-run transient blip that later self-resolves. This sample is also the last one captured before the step completed, so there's no way to see whether it would have recovered — the step ended shortly after.

Guest load average across the window: 4.14–22.9 — elevated, consistent with the range seen in prior occurrences, no different signal here.

## 5. What this does and does not establish

**Does:**
- Extends the relocation fix's confirmed-working streak to 7 consecutive runs.
- Adds a new, shorter duration tier: 750s, between baseline (300–460s) and the previously-shortest elevated case (1099s, `#460`).
- Surfaces a new observation — an ADB "device offline" condition at the very end of a failing step, distinct from the transport_id re-enumeration blip pattern, and structurally different in that it never resolves within the sampled window (the step ends shortly after).
- Clarifies that `#471`'s lack of a transport_id blip is not evidence against the blip hypothesis (the step was too short to reach the blip's established timing window), unlike `#469`'s genuine counterexample.

**Does not:**
- Establish root cause. Whether the "device offline" tail state is a symptom of the same underlying mechanism as the transport_id blip, or a separate failure mode entirely, is not distinguishable from current evidence.
- Touch `ci.yml`, AVD/emulator config, RAM/CPU, application code, or the judgment engine.
- Change the production-readiness verdict.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Run `#471` triggered by this session's watch loop, per standing authorization.
- No open or merged PR exists for this branch as of this check (`list_pull_requests`, state: all — empty result).

---

## Status

**PHASE 8A-50: SHORTEST ELEVATED OCCURRENCE YET (RUN #471, 750s) — NO TRANSPORT_ID BLIP (STRUCTURALLY EXPECTED, STEP TOO SHORT TO REACH BLIP WINDOW), NEW "DEVICE OFFLINE" TAIL SIGNATURE OBSERVED.**

| Layer | Status |
|---|---|
| `PHASE_8A_44` relocation | ✅ Confirmed working a seventh consecutive time |
| Transport_id 1→2 signature | ⚪ Not applicable this run — step ended before the established ~13-15min blip window |
| New "device offline" tail signature | 🟠 New observation, single occurrence, not yet replicated |
| Duration-tier picture | 🟠 New shortest elevated tier: 750s (vs. baseline 300-460s, prior floor 1099s) |
| A2 root cause | 🔲 Still open |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |
| PR for this branch | 🔲 None exists (open or merged) |

Watch loop continues per standing stop conditions (PR merge or A2 root cause established).
