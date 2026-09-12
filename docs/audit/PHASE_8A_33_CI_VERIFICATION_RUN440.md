# Phase 8A-33 — CI Verification: Run `#440` (First Successful Exercise of the Fixed Timestamp-Correlation Diagnostic)

Implements: "CI Rerun Authorization — checkpoint `c2ab236`." The
first run to actually complete the Phase 8A-30 diagnostic end to end
after the PR #110 fix. **Read-only — no application, test, or
workflow file is changed. No remediation of Finding A or B. No CI
rerun.** Independently verifies (and in one respect corrects) a
detailed report of this run received in conversation, per this audit
chain's standing practice of not adopting externally-sourced claims
without direct verification.

## 1. Run identification

- Run `#440`, id `34688000969`, event `workflow_dispatch`.
- `head_sha`: `c2ab236` — confirmed exact match before triggering.
- Final `status`: `completed`. Final `conclusion`: `failure`.
- `Functions Quality`: ✅ success (one scoped Node.js 20→24 deprecation
  warning, non-blocking). `App Quality`: ✅ success.
  `E2E Tests (Maestro)`: ❌ failure.
- `Setup Android emulator`: `10:30:19Z`–`10:35:38Z` (5m19s) — **within
  the normal range, not the ~3-minute early-abort pattern `#438`
  showed.** This is the first direct confirmation the PR #110 fix
  holds under real execution, not just static YAML validation.

## 2. Confirmed independently: the PR #110 fix works in production

```
##[group]Host/guest clock offset (for correlating guest-clock-timestamped evidence, e.g. logcat)
host (date -u):  2026-09-12T10:33:09.276Z
guest (adb shell date -u): Sat Sep 12 10:33:09 UTC 2026
##[endgroup]
```

Both lines present, host and guest clocks agree to within the same
second. This is the positive control `PHASE_8A_31`/`PHASE_8A_32`
could not obtain — `clock-offset.txt` now populates correctly under
a live run, not just under static verification.

## 3. Confirmed independently: deterministic visibility-timeout pattern recurred

Via `dorny/test-reporter`'s summary (inside the retrievable window):

```
3 tests were completed in 102s with 0 passed, 3 failed and 0 skipped.
  Assertion is false: id: auth-tab-signup is visible
  Assertion is false: id: auth-tab-signin is visible
  Assertion is false: id: settings-gear-btn is visible
```

Identical failure signature and combined duration in the established
range — consistent with every previously-sampled run except `#434`'s
outlier and `#438`'s self-inflicted defect.

## 4. Confirmed independently: real, dense resource-correlation data was captured this run

`guest-cpuinfo.txt` (via `dumpsys cpuinfo`) captured **43 samples**
this run — a large improvement over `#438`'s single truncated line,
and the first run where this data is both populated and retrievable.
Two per-process figures, held essentially constant across nearly all
43 samples:

```
  33% 531/system_server: 22% user + 10% kernel / faults: 18438 minor 307 major
   6.1% 795/com.android.systemui: 2.6% user + 3.4% kernel / faults: 3331 minor 99 major
```

(`system_server` shifts slightly to 34%/18%+16% partway through; both
figures otherwise hold steady across the sampled window.) The final
captured sample, immediately before the ADB connection to the guest
closed as the step wrapped up:

```
2026-09-12T10:35:27Z
99% TOTAL: 43% user + 52% kernel + 4% softirq
error: closed
```

Host-side `resource-usage.txt` (3s interval) shows the qemu process at
**166% CPU**, consistent with `#437`'s finding of sustained multi-core
host-side contention. `hw.cpu.ncore = 2`, `hw.ramSize = 1536M`,
`platform-tools 37.0.1`/`emulator 37.1.11` — all unchanged from every
prior sampled run.

## 5. A material refinement to the standing CPU-contention question — not a "yes"

**`com.android.systemui`'s own process CPU is low and stable (~5-6%)
throughout the sampled window — it is not itself CPU-starved by this
measure.** What is elevated is `system_server` (33-34%, `system_server`
being the process that hosts window management, input dispatch, and
ANR detection) and the guest's overall `TOTAL` CPU, which reaches 99%
in the final sample. **This is a more precise, and somewhat different,
picture than "SystemUI is CPU-starved":** if CPU contention is a
causal factor in the SystemUI ANR, this data points toward broad
guest-OS-wide scheduling pressure — likely acting on SystemUI
indirectly via `system_server` (which SystemUI depends on for window
focus, input dispatch, and ANR-timeout bookkeeping) — rather than
SystemUI's own thread being directly starved of CPU cycles.

This is genuinely new, useful evidence. It does **not**, on its own,
answer the standing question ("does the SystemUI failure temporally
correlate with CPU contention strongly enough to justify CPU
contention as the leading mechanism") with a "yes" — it refines what
"CPU contention" would even mean here, without yet tying it to the
ANR's own timing (§6).

## 6. What could NOT be independently verified this run — and why

A detailed report received in this conversation claimed direct
evidence of an ANR trace in logcat (`"ActivityManager: Timeout waiting
for provider com.android.systemui.keyguard"`, `"Long monitor
contention with owner ActivityManager/PackageManager"`) and a
manually-confirmed `"System UI isn't responding"` / `android:id/alertTitle`
hit in the hierarchy dump with bounds identical to prior runs.

**None of this could be independently confirmed from what this
session's tooling can retrieve for run `#440`.** The job's total log is
10,488 lines; `get_job_logs` again returned only the final ~5,000
lines (the same hard cap `PHASE_8A_27` first documented) — and this
run, that window's earliest content is already mid-way through a raw
JSON hierarchy dump, with **no group header for `Show logcat and
preserved Maestro debug artifacts` present anywhere in the retrievable
window at all** (confirmed by an explicit search for that step's own
group names — zero matches). That step's `FATAL/crash` grep, the
Phase 8A-30 broader ANR-marker grep, and the `<50KB` hierarchy-dump
group all run *before* the large `commands-*.json` extraction within
that same step — so on a run where that step's total output is large
enough, its own earlier groups are pushed out of the retrievable tail
before its own later groups (and everything after it) are. This is a
distinct manifestation of the same retrieval-cap problem the Phase
8A-28 relocation addressed for the *steps after* `Show logcat...`, but
does not and cannot fix for content *within* that step itself.

**This is not a contradiction of the reported findings — it is an
inability to confirm or deny them from here.** A zero-match search
for `"System UI isn't responding"` in what I could retrieve is
explained entirely by that content being outside the window (matching
the exact pattern `PHASE_8A_25`/`PHASE_8A_27` already documented for
other runs), not by the text's absence. Per this audit chain's
standing practice, these specific claims are recorded as **reported,
not independently verified**, and are not adopted as established
fact pending a way to retrieve that step's content (e.g., a further
diagnostic-relocation change, not made here).

## 7. Finding B and Option A

```
##[error]Failed to CreateArtifact: Artifact storage quota has been hit. Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
Cache saved with key: gradle-1ba634b600555383c2adefe7c9b40e8f62610626749a169490a5b88b205b82cf
```

Finding B recurred identically. `Save Gradle cache` succeeded again —
continuing the unbroken record of Option A confirmations.

## 8. What this run does and does not establish

**Does:**
- Confirm the PR #110 fix works under real execution, not just static
  validation — `clock-offset.txt` populated correctly, and the
  `Setup Android emulator` step ran its full normal duration rather
  than aborting early.
- Reconfirm the deterministic visibility-timeout pattern, Finding B,
  and Option A all behave exactly as established.
- Capture real, dense guest-side per-process CPU data for the first
  time (43 samples) — `com.android.systemui` itself is low-CPU and
  stable; `system_server` and guest-wide `TOTAL` CPU are notably
  higher, refining (not confirming) the CPU-contention theory toward a
  system-wide-scheduling-pressure framing.

**Does not:**
- Confirm or deny whether a SystemUI ANR recurred this run, or its
  timing — the relevant log content (hierarchy dump, ANR-marker
  search) is outside this session's retrievable window for this run.
- Answer the standing correlation question with "yes" — it remains
  **inconclusive**, now for a more precise reason: the timing evidence
  needed is unretrievable, and the CPU data that *is* retrievable
  complicates rather than simply confirms the original framing.
- Change emulator resource allocation or any other remediation.
- Address Finding B.
- Change the production-readiness verdict, which remains unchanged.

## 9. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  document.

---

## Status

**PHASE 8A-33 CI VERIFICATION (run `#440`): COMPLETE.**

| Layer | Status |
|---|---|
| PR #110 fix (clock-offset) | ✅ Confirmed working under real execution |
| `Setup Android emulator` early-abort recurrence | ✅ Did NOT recur — normal 5m19s duration |
| Visibility-timeout pattern (all 3 flows) | ❌ Recurred — consistent with established pattern |
| Guest-side per-process CPU data | ✅ Captured (43 samples) — `com.android.systemui` low/stable (~5-6%); `system_server`/`TOTAL` notably higher |
| Host-side qemu CPU | ✅ ~166%, consistent with `#437` |
| SystemUI ANR recurrence this run | 🔲 Not established — `Show logcat...` step's content unretrievable |
| Externally-reported ANR-trace/logcat claims | 🔲 Reported, NOT independently verified — recorded as such, not adopted |
| Standing CPU-contention-correlation question | 🟠 Still INCONCLUSIVE — refined, not answered |
| Finding B | ❌ Recurred — identical, still open |
| Option A (Gradle cache save) | ✅ Confirmed again |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a way
to make the `Show logcat...` step's own content retrievable (its
own further relocation or splitting), a further rerun as-is, a
remediation attempt, Finding B's own next step, or any other action
the owner chooses.
