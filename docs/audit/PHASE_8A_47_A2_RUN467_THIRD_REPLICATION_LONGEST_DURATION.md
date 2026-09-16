# Phase 8A-47 — Run #467: third independent transport_id replication, longest A2 duration yet

Run `#467` (id `35091319878`, head `f2ec3a7`, triggered by this session's ongoing A2 watch loop) hit **`Setup Android emulator`: 27m34s (1654s)** — the longest A2-band occurrence observed to date, surpassing `#457`'s 1652s.

## 1. Relocation fix holds a fourth consecutive time

`Show ADB transport-layer state` fully retrievable: lines 643–4970 of 4999, both `##[group]`/`##[endgroup]` markers present, 483 total samples captured.

## 2. Filtered analysis (per `PHASE_8A_45`'s correction)

Step window: `11:48:33Z`–`12:16:07Z`. 463 samples fall inside this window; **exactly one** shows a genuine in-test transport loss:

- **`12:03:46Z`**: `error: device 'emulator-5554' not found` on all three probes, preceded (`12:03:42Z`) by `transport_id:1`, followed 3 seconds later (`12:03:49Z`) by **`transport_id:2`**.
- Guest load average at the time: 5.90–8.34 — elevated, in the same range as `#460`'s occurrence, below `#457`'s peak (31.35).
- Blip landed ~15m13s into the 27m34s step — comparable relative position to `#457` (~15min into 27m32s) and `#460` (~13min into 18m19s).
- All samples after `12:16:07Z` onward (visible in the retrieved tail beyond the step window) follow the established post-teardown-noise pattern and are excluded from this count.

## 3. Third independent replication — pattern now well-established

This is the **third** occurrence of the identical mechanical signature (`PHASE_8A_43` → `#457`; `PHASE_8A_46` → `#460`; this document → `#467`): a single, self-resolving ~3-second transport-loss tick, always paired with a `transport_id` increment (never a same-ID recovery), always amid elevated (not extreme) guest load, always landing roughly 13–15 minutes into the step regardless of the step's total eventual duration.

**What three occurrences now support, beyond two:**
- The `transport_id` re-enumeration is not incidental — it happens every time the blip is captured, which is now a 3-for-3 pattern. This is strong, repeated evidence that whatever causes A2 involves the ADB daemon re-attaching to what it treats as a distinct device session, not merely a dropped/retried packet on a stable session.
- The blip's consistent ~13–15 minute timing across runs of very different total lengths (1099s, 1652s, 1654s) suggests it is tied to something that happens at a roughly fixed point in the runner's own lifecycle (e.g., a periodic host-side event, a scheduled process, or a fixed-latency step in the emulator's own boot/stabilization sequence) rather than to the eventual step duration itself.

**What is still not established:**
- Why total duration varies 1099s → 1652s → 1654s despite near-identical blip characteristics. The blip itself resolves in 3 seconds every time; something else — happening either before, after, or independent of the blip, and not captured by this sampler — is responsible for the bulk of the elongation.
- What "something else" is. No sampler currently observes emulator boot-phase internals, Maestro's own driver-reconnection attempts, or host-level scheduling around the ~13–15 minute mark.

## 4. What this does and does not establish

**Does:** Extends the transport_id replication to 3/3 confirmed occurrences; confirms the `PHASE_8A_44` relocation fix continues to hold under a fourth test; extends the A2-band duration range to 1409–1654s.

**Does not:** Establish root cause. Does not touch `ci.yml`, AVD/emulator config, RAM/CPU, application code, or the judgment engine. Does not change the production-readiness verdict.

## 5. Recommended next investigative step

With the mechanical pattern now well-replicated, the next useful move is capturing what happens around the ~13–15 minute mark independent of the ADB layer — e.g., a lightweight host-side timestamped log of `ps`/emulator-process state at high frequency during that window, to see whether a host-level event (not just the guest-side symptom) coincides with the blip. This is a new instrumentation candidate, not implemented here since it wasn't evidenced as necessary until this third replication established the timing consistency.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Run `#467` was triggered by this session's watch loop, per standing authorization.

---

## Status

**PHASE 8A-47: THIRD TRANSPORT_ID REPLICATION (RUN #467) — LONGEST A2 DURATION YET, PATTERN WELL-ESTABLISHED, ROOT CAUSE STILL OPEN.**

| Layer | Status |
|---|---|
| `PHASE_8A_44` relocation | ✅ Confirmed working a fourth consecutive time |
| Transport_id 1→2 signature | ✅ 3/3 replication (`#457`, `#460`, `#467`) |
| Blip timing consistency | 🟠 New finding — lands ~13-15min into the step regardless of total duration |
| Total-duration variance | ❌ Still unexplained (1099s/1652s/1654s despite near-identical blips) |
| A2 root cause | 🔲 Still open |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |

Watch loop continues per standing stop conditions (PR merge or A2 root cause established).
