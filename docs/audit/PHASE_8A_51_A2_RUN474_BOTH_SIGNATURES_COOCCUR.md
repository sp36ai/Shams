# Phase 8A-51 — Run #474: both the transport_id blip AND the "device offline" tail signature occur in the same run

Run `#474` (id `35115521521`, head `33e99c4`, triggered by this session's ongoing A2 watch loop) hit **`Setup Android emulator`: 26m13s (1573s)** — an A2-band occurrence, essentially matching `#468`'s 1574s.

## 1. Relocation fix holds an eighth consecutive time

`Show ADB transport-layer state` fully retrievable: lines 678–4971 of 4999, both `##[group]`/`##[endgroup]` markers present, 483 total samples captured.

## 2. Filtered analysis (per `PHASE_8A_45`'s correction)

Step window: `15:41:49Z`–`16:08:02Z`. 429 in-window samples, comprehensive coverage: first `15:45:15Z` (~3m26s in), last `16:07:41Z` (~21s before step end).

**Both previously-documented signatures appear in this single run — a first.**

### (a) The transport_id 1→2 blip

`15:55:33Z`: `error: device 'emulator-5554' not found` on all three probes, preceded (`15:55:30Z`) by `transport_id:1`, followed 3 seconds later (`15:55:36Z`) by **`transport_id:2`**. Guest load at the time: 4.82–5.85 (elevated-moderate, consistent with prior occurrences).

**Timing: 824s (13m44s) into the step** — squarely inside the established ~13–15 minute window first identified in `PHASE_8A_47` and replicated in `#457`/`#460`/`#467`/`#468`. This is the **fifth** independent replication of the mid-run blip.

### (b) The "device offline" tail signature (first seen in `#471`, `PHASE_8A_50`)

The last in-window sample, `16:07:41Z`:

```
adb get-state: device
--- adb devices -l ---
List of devices attached
emulator-5554          device ... transport_id:2
sys.boot_completed: error: closed
guest uptime: adb: device offline
```

`get-state` still reports the device present (transport_id unchanged at 2, the post-blip session), but `sys.boot_completed`/`guest uptime` both report `device offline`/`error: closed` — identical shape to `#471`'s tail sample.

**Timing: exactly 21 seconds before the step's own `completed_at`** — the identical offset observed in `#471` (also 21s before step end). Two independent runs landing on the same precise offset is a strong signal this is not coincidental; it looks like a fixed point in the runner's teardown/timeout sequence (e.g., a fixed-duration grace period before the step is force-concluded) rather than a random late sample.

## 3. Why this matters

This is the first run where both signatures co-occur, and it resolves part of the ambiguity from `PHASE_8A_50`: the "device offline" tail state is **not** an alternative to the transport_id blip — a single run can show both, independently, at two different and apparently fixed points (one ~13–15min in, one ~21s before the step concludes). This supports interpretation (b) from `PHASE_8A_49`: the mid-run blip and the tail-state are likely two separate symptoms of the runner's environment, not two alternate "modes" of A2. The tail signature's now-twice-observed exact 21-second offset is a new, more specific candidate lead — it suggests something in the step's own shutdown/cleanup sequence (possibly Maestro's own timeout handling, or a GitHub Actions runner-side step-conclusion grace period) that reliably kicks in a fixed 21 seconds before the step is marked complete, regardless of what happened earlier in the step.

## 4. What this does and does not establish

**Does:**
- Extends the transport_id blip replication to 5/5 among elevated runs long enough to contain the ~13-15min window (`#457`, `#460`, `#467`, `#468`, `#474`) — `#469` remains the sole confirmed absence in a run with full window coverage, and `#471` remains structurally inconclusive (too short).
- Establishes the "device offline" tail signature as reproducible (2/2 so far: `#471`, `#474`), with both occurrences landing at the *same* 21-second-before-step-end offset — the most precise timing correlation found across all A2 evidence to date.
- Confirms the two signatures are not mutually exclusive; they co-occur in the same run at different points.

**Does not:**
- Establish root cause. The mechanism producing either the mid-run blip or the fixed 21-second tail offset is still unknown — this raises a more specific hypothesis (a fixed-duration teardown/timeout window) but does not test or confirm it.
- Touch `ci.yml`, AVD/emulator config, RAM/CPU, application code, or the judgment engine.
- Change the production-readiness verdict.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Run `#474` triggered by this session's watch loop, per standing authorization.
- No open or merged PR exists for this branch as of this check.

---

## Status

**PHASE 8A-51: RUN #474 SHOWS BOTH THE TRANSPORT_ID BLIP AND THE "DEVICE OFFLINE" TAIL SIGNATURE IN THE SAME RUN — TAIL SIGNATURE'S 21-SECOND OFFSET NOW REPLICATED EXACTLY TWICE.**

| Layer | Status |
|---|---|
| `PHASE_8A_44` relocation | ✅ Confirmed working an eighth consecutive time |
| Transport_id 1→2 signature | ✅ 5/5 in runs with full window coverage (`#457`/`#460`/`#467`/`#468`/`#474`); still absent in `#469` |
| "Device offline" tail signature | 🟠 2/2 observed (`#471`, `#474`), both at exactly 21s before step end — new precise timing lead |
| Signatures co-occurring | ✅ New finding — not mutually exclusive, both present in `#474` |
| A2 root cause | 🔲 Still open, but a more specific hypothesis (fixed-duration teardown/timeout window) is now suggested |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |
| PR for this branch | 🔲 None exists (open or merged) |

Watch loop continues per standing stop conditions (PR merge or A2 root cause established).
