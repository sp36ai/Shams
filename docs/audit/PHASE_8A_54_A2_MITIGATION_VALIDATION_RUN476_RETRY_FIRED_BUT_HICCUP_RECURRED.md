# Phase 8A-54 — Run #476: PHASE_8A_53 mitigation validation — the retry fired, but the transport hiccup recurred in the retry attempt too

Run `#476` (id `35133255659`, head `d9733b8`, the `PHASE_8A_53` mitigation commit) was triggered specifically to validate that mitigation. `Setup Android emulator` ran **2666s (44m26s)**, `failure` — roughly double the largest single-attempt A2 duration seen before this fix (`#467`: 1654s), consistent with the retry having fired and also failed.

## 1. Retrieval limitation

Maestro's own stdout (the `::warning::Maestro run failed; restarting adb and retrying once` line and the per-flow `Android driver unreachable` messages, as directly read from raw log in `PHASE_8A_52`) could **not** be retrieved for this run: `get_job_logs`'s tail-window is capped at roughly 2500-5000 lines regardless of the `tail_lines` value requested, and for this abnormally long (44-minute) run, the `Show ADB transport-layer state` diagnostic group alone (one sample every 3s for the full step duration) is large enough to consume the entire retrievable tail on its own — every attempt to reach further back landed on more of that same group, never on the earlier `Setup Android emulator` step's live Maestro output. Direct download of the log via its presigned blob URL was also blocked by the environment's egress proxy policy (`productionresultssa19.blob.core.windows.net` denied by organization policy, confirmed via the proxy status endpoint).

This document's conclusions are therefore based on the `adb-state.txt` transport signature alone (as in every prior PHASE_8A_4x/5x analysis before `PHASE_8A_52`), not on direct confirmation from Maestro's own log text. The evidence is strong and internally consistent, but is circumstantial rather than a literal read of the retry-warning message.

## 2. What the transport_id timeline shows

Combining several partial `get_job_logs` retrievals (the largest single window reaching back to `18:42:22Z`), three sample-level events are visible across the step's `18:25:51Z`–`19:10:17Z` window:

| Event | Timestamp | Offset from step start | Detail |
|---|---|---|---|
| `transport_id` reset: **2 → 1** | `18:50:01Z` | 1450s (24m10s) | A *decrease*, not an increment |
| `transport_id` increment: **1 → 2** | `19:01:54Z` | 2163s (36m3s) | 713s (11m53s) after the reset |
| "device offline" tail signature | `19:09:57Z` | 2646s (44m6s) | 20s before step end (matches the `PHASE_8A_50`/`51` pattern) |

The **2 → 1 transition is the key signal**. Every previously observed transport_id change in this audit (`#457`/`#460`/`#467`/`#468`/`#474`) was an *increment* (1→2), consistent with the OS-level adb daemon re-enumerating the same device under a new session ID after a transient drop. A transport_id going *backward*, from 2 to 1, is not something the daemon does on its own — `adb`'s transport IDs are monotonically increasing per adb-server process. The only way to see `transport_id:1` again after already having seen `transport_id:2` is for the **adb server process itself to have been restarted**, which resets its internal counter. That is exactly what `PHASE_8A_53`'s mitigation does (`adb kill-server; adb start-server; adb wait-for-device`) immediately after a Maestro failure, before retrying.

**This confirms the retry mitigation fired during this run.**

## 3. Reconstructed timeline

Based on the transport_id evidence and the durations of prior single-attempt A2 occurrences (`PHASE_8A_43`–`51`):

1. **`18:25:51Z`–`18:50:01Z` (1450s / 24m10s): first Maestro attempt.** This duration falls just below the previously observed single-attempt A2-band floor (1409s), consistent with a transport hiccup occurring at some point in this attempt, cascading through the 3-flow suite's `Android driver unreachable` timeouts exactly as `PHASE_8A_52` described, and the attempt ultimately failing — triggering the mitigation's retry path.
2. **`18:50:01Z`: adb server restarted** (the 2→1 reset), Maestro retries.
3. **`18:50:01Z`–`19:01:54Z` (713s / 11m53s into attempt 2): clean running.** This is closely in line with the established ~10-15 minute mark where every prior transport hiccup has occurred (measured from each *attempt's own* start, not the step's).
4. **`19:01:54Z`: a second, independent transport hiccup occurs during the retry attempt itself** (the 1→2 increment) — the same failure mode recurring, unmitigated by the adb restart, because the restart only clears the broken connection state; it does not prevent a fresh hiccup from happening again.
5. **`19:01:54Z`–`19:10:17Z` (503s / 8m23s): cascading flow failures in attempt 2**, closely matching roughly two flows' worth of the ~241s-per-flow `Android driver unreachable` timeout measured directly in `PHASE_8A_52`.
6. **`19:09:57Z`: "device offline" tail signature**, 20 seconds before step end — consistent with `PHASE_8A_50`/`51`'s finding that this is simply the `Terminate Emulator` teardown after Maestro's final failed exit, not a separate mechanism.
7. **`19:10:17Z`: step concludes `failure`.** No `|| true` was added by `PHASE_8A_53`, so a failure on the retry attempt correctly still fails the step and the job — exactly as designed.

## 4. What this validates and does not validate

**Validates:**
- The mitigation's retry logic **does fire** on a real failure, exactly as coded — this is the first live confirmation of that (previously only reasoned about from the diff itself in `PHASE_8A_53`).
- The adb-server-restart step **does produce a genuinely fresh driver connection** (evidenced by the transport_id counter reset), not a no-op.
- The step correctly still fails when both attempts hit the underlying issue — the mitigation does not mask a real problem or produce a false-green result.

**Does not validate — and this is the important negative result:**
- **The mitigation did not prevent this run from failing.** In this trial, the root trigger of the transport hiccup (still unestablished per `PHASE_8A_52`'s open question) recurred independently in the retry attempt, so both attempts cascaded through the same `Android driver unreachable` failure mode. This is exactly the caveat `PHASE_8A_53` itself flagged: *"If that trigger recurs during the retry attempt too, the retry will also fail... this mitigation reduces the impact of a hiccup, it does not prevent the hiccup."* That caveat is now observed, not just anticipated.
- This is a single trial (n=1). It does not establish the mitigation's overall effectiveness rate — only that retry-then-still-fail is a possible outcome, alongside the hoped-for retry-then-succeed outcome that this trial did not produce. Determining the mitigation's actual hit rate would require several more elevated-duration occurrences to observe across.

## 5. What this does not establish

Does not touch `ci.yml`, AVD/emulator config, RAM/CPU, application code, or the judgment engine — this document is analysis only, no further code change. Does not change the production-readiness verdict (**NOT READY**, unchanged). Does not re-establish or contradict `PHASE_8A_52`'s root-cause mechanism — if anything, this run's data is fully consistent with and further corroborates it (two independent instances of the same cascade pattern, now observed within one job).

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Run `#476` (id `35133255659`) was triggered specifically to validate `PHASE_8A_53`, per standing authorization for this validation check.
- No open or merged PR exists for this branch.

---

## Status

**PHASE 8A-54: PHASE_8A_53 MITIGATION VALIDATED AS FIRING CORRECTLY (ADB SERVER RESTART CONFIRMED VIA TRANSPORT_ID RESET), BUT DID NOT PREVENT FAILURE IN THIS TRIAL — THE UNDERLYING TRANSPORT HICCUP RECURRED INDEPENDENTLY IN THE RETRY ATTEMPT.**

| Layer | Status |
|---|---|
| Retry mitigation fires on failure | ✅ Confirmed live (transport_id reset 2→1, only possible via adb server restart) |
| Retry produces a fresh driver connection | ✅ Confirmed (new transport_id sequence after reset) |
| Retry prevents overall failure | ❌ Not in this trial — hiccup recurred in attempt 2 |
| Job correctly still fails when both attempts hit the issue | ✅ Confirmed — no false green, no `\|\| true` bypass |
| Mitigation's overall hit rate | 🔲 Not established — n=1, more elevated occurrences needed |
| Root trigger of the transport hiccup itself | 🔲 Still unestablished (unchanged from `PHASE_8A_52`) |
| Maestro's own log directly confirming the retry-warning text | 🔲 Not retrieved — tool/network retrieval limits for this abnormally long run (documented in §1) |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |
