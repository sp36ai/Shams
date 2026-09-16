# Phase 8A-41 — A2 diagnostic: ADB transport-layer sampler added; run #448 retroactive analysis not possible

Follows `NEXT_PRODUCTION_EXECUTION.md`'s recommendation to investigate
A2 (`Android driver unreachable`, first seen run `#434`, recurred run
`#448`) from run `#448`'s own job log. **That specific recommendation
turned out not to be achievable, and this document records why, rather
than forcing a write-up from insufficient data.**

## 1. What was attempted

Pulled run `#448`'s job log (id `103586578172`) via
`mcp__github__get_job_logs`. Confirmed the tool's known cap
(`PHASE_8A_27`) applies here too: `return_content: true` returned only
the final ~4999 lines regardless of `tail_lines` requested, spanning
`17:20:43`–`17:21:40` UTC — the job's post-test diagnostic/reporting
tail (toolchain capture, artifact upload, test-reporter), not the
`Setup Android emulator` step itself where the ADB failure actually
occurred.

Attempted to fetch the full raw log directly via the pre-signed
`logs_url` (bypassing the tool's cap) using `curl`. **Blocked**: this
session's egress proxy refuses the destination
(`productionresultssa6.blob.core.windows.net`) by organization policy
— confirmed via the proxy's own error, not inferred from a timeout or
guessed.

## 2. Why this is a retrieval gap, not a negative result

The failure signature itself is confirmed present in the retrievable
tail (`Android driver unreachable`, `settings-gear-btn` assertion
failure) — this matches, and does not add to, what
`NEXT_PRODUCTION_EXECUTION.md` already recorded from the original
investigation.

The causal chain `NEXT_PRODUCTION_EXECUTION.md` asked for (ADB
server state → transport → emulator liveness → boot state → Maestro
reconnection, with timestamps) is not observable from what could be
retrieved — not because it didn't happen, but because:

- It lived in the `Setup Android emulator` step's own real-time
  output, entirely outside the retrievable ~5000-line tail.
- No existing sampler at the time of run `#448` captured ADB
  transport-layer state at all. `resource-usage.txt` is host CPU/RAM,
  `guest-cpuinfo.txt` is Android's own per-process CPU (both
  irrelevant to whether adb itself can see the device), and
  `logcat.txt` only captures once adb *is* connected — none of them
  would show the transport loss itself even if their full content
  were retrievable.

**Writing a root-cause document from this would have meant presenting
"couldn't retrieve it" as if it were "checked and not found" — the
same class of error this audit chain has repeatedly flagged elsewhere
(e.g. the GitHub Actions log-search-box false-negative lesson).**

## 3. What was done instead

Added a dedicated ADB transport-layer sampler to `ci.yml`'s
`Setup Android emulator` script block, so the *next* A2 occurrence is
actually traceable — this is the concrete gap
`NEXT_PRODUCTION_EXECUTION.md` §2 itself named as missing.

```
nohup bash -c 'while true; do date -u +%FT%TZ;
  echo "adb get-state: $(adb get-state 2>&1)";
  echo "--- adb devices -l ---"; adb devices -l 2>&1;
  echo "sys.boot_completed: $(adb shell getprop sys.boot_completed 2>&1)";
  echo "guest uptime: $(adb shell uptime 2>&1)";
  echo; sleep 3;
done' > "$HOME/adb-state.txt" 2>&1 &
```

- Same 3s cadence and host-UTC clock as the existing
  `resource-usage.txt`/`guest-cpuinfo.txt` samplers, so all files
  remain directly comparable on one timeline.
- Single self-contained line, per the `#438`/`PHASE_8A_31` lesson
  about this action's per-line `sh -c` execution model.
- Always on, not gated behind `disable_observer` — A2 is unrelated to
  the observer-effect/A1 experiment, and run `#448` itself was a
  *control* run (guest-cpuinfo sampler off) and still hit A2, so
  gating this sampler the same way would risk losing the one signal
  that could explain it.
- Surfaced in the existing "Show runner resource usage and OOM check"
  step, same pattern as the other three sampler files.

Verified: `yaml.safe_load` passes; `git diff --stat` shows only
`ci.yml`, 28 insertions; the new sampler line has no embedded
newlines (confirmed via direct grep, not visual inspection alone).

## 4. What this does not do

- Does not retroactively explain run `#448` — that data was never
  captured and cannot be reconstructed now.
- Does not touch AVD/emulator resource allocation, the judgment
  engine, or any application code — `ci.yml` only.
- Does not close A2 — it instruments for the next occurrence. A2
  remains open until a future run actually captures a transport-loss
  event with this sampler active.
- Does not change production readiness. Still **NOT READY**.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit: `91af654` (`NEXT_PRODUCTION_EXECUTION.md`).
- Only `.github/workflows/ci.yml` and this document are touched.

---

## Status

**PHASE 8A-41: ADB-STATE SAMPLER ADDED; RUN #448 RETROACTIVE ANALYSIS NOT POSSIBLE (RETRIEVAL-BLOCKED, NOT ABSENT).**

| Layer | Status |
|---|---|
| Run #448 causal chain | 🔲 Not recoverable — outside retrievable log window, egress-blocked direct fetch |
| ADB transport-layer sampler | ✅ Added, `ci.yml` only, verified YAML-valid and single-line |
| A2 | 🔲 Still open — instrumented for next occurrence, not resolved |
| A1, `#436` | 🔲 Unchanged, untouched by this document |
| Finding B | 🔲 Unchanged, untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |

Next A2 occurrence (via `workflow_dispatch` or a natural recurrence)
will have `adb-state.txt` available for the causal-chain analysis
`NEXT_PRODUCTION_EXECUTION.md` originally asked for.
