# Phase 8A-39 — Observer-Effect Control Experiment: Results (#444 vs #445)

Reports the first paired comparison from the Phase 8A-38 experiment.
**Result: inconclusive on n=1 per condition — neither run produced a
formal ANR trace, which is itself informative but does not test the
hypothesis the way a run that did produce one would.** Read-only
analysis; proceeds directly into additional repetitions per the
standing authorization to continue with engineering judgment.

## 1. Run identification

| | Run `#444` (control) | Run `#445` (treatment) |
|---|---|---|
| id | `34704845126` | `34704853088` |
| `head_sha` | `782d92e` | `782d92e` (identical) |
| `disable_observer` input | `true` | `false` |
| Conclusion | `failure` | `failure` |
| `Setup Android emulator` duration | 5m27s | 5m13s |
| Flow results | 3/3 failed, 99s combined | 3/3 failed, 101s combined |
| Assertions | Same 3 (`auth-tab-signup`/`auth-tab-signin`/`settings-gear-btn`) | Same 3 |

## 2. Mechanism verification — the experimental variable actually differed as intended

- **`#444` (control)**: `guest-cpuinfo.txt not found` — confirmed
  empirically, not just from the input flag, that the guest-side
  `dumpsys cpuinfo` sampler did not run.
- **`#445` (treatment)**: `guest-cpuinfo.txt` fully populated — 43
  samples, real data (`system_server` at 34%, etc.), confirming the
  sampler ran normally.

This is the load-bearing check for the whole experiment: the one
intended variable (the guest-cpuinfo sampler) demonstrably differed
between the two runs, confirmed by direct evidence rather than
assumption.

(Note: the in-script "PHASE 8A-38 observer-effect experiment mode"
log line intended as a secondary confirmation was not retrievable in
either run — it's a plain `echo` inside the `Setup Android emulator`
step's own script, which runs chronologically before the huge
hierarchy-dump content that step also produces, so it falls outside
the retrievable tail window for the same reason `PHASE_8A_27`/
`PHASE_8A_33` documented. Not a concern here since the guest-cpuinfo.txt
presence/absence check above is a stronger, direct confirmation
anyway.)

## 3. The actual result: neither run produced a formal ANR

Both runs' `Show logcat ANR/FATAL search results` groups were fully
retrieved this time (confirmed complete: each group's own opening and
closing `##[group]`/`##[endgroup]` markers are both present, 422 lines
for `#444`, 405 for `#445`) — and in both, the only match for the
case-insensitive string `"ANR"` is the group's own title text. **Zero
occurrences of an actual `"ANR in ..."` trace line in either run.**

Both runs do show genuine, non-trivial `system_server` lock
contention — `Long monitor contention with owner PackageManager`,
`Long monitor contention with owner Binder:...`, `Slow dispatch took
619ms`/`470ms` — of similar character and magnitude to what surrounded
`#441`'s actual ANR. Neither run's contention escalated to the ~5-second
threshold that triggers Android's formal ANR mechanism this time.

`#444`'s FATAL/crash group showed only benign system-service timeouts
(`Icing`, `WellbeingSettingsProvid`, `NearbyDiscovery` — the same
class of benign noise `#441` also showed). `#445`'s FATAL/crash
group's own header fell just outside the retrievable window this run
(a partial instance of the same trade-off `PHASE_8A_35` §6 already
documented) — not investigated further since it isn't needed to reach
this document's conclusion.

## 4. What this does and does not establish, applying the pre-agreed framework exactly

Per the framework agreed before this experiment: *"If A1 occurs in
#445 but not #444, that substantially strengthens the observer-effect
hypothesis. If A1 occurs in both, the hypothesis is weakened
substantially... If neither occurs, we need to look at whether the
experiment itself changed timing enough to suppress the failure; that
is not automatically a resolution."*

**This is the third case: neither run produced a formal ANR.** That is
not evidence for or against the observer-effect hypothesis — it means
this specific pair of runs didn't exercise the phenomenon at all. Given
this audit chain's own sampling history, a full logcat-confirmed ANR
trace has been captured in only 1 of the runs where that specific
search was retrievable (`#441`), against a background of consistent
`system_server` contention appearing in most runs regardless. **The
underlying event appears to have a low, intermittent base rate** — not
something a single run of either condition can be expected to reliably
reproduce.

**A pair of n=1 runs cannot test this hypothesis.** Reaching a
comparison of *occurrence rates* — the only way to meaningfully
compare a low-base-rate, intermittent event between two conditions —
requires multiple repetitions of each condition. This document does
not overclaim either direction from a single pair.

## 5. Proceeding: additional repetitions

Per the standing authorization to continue with engineering judgment
once the evidence supports a next step, and because the honest
conclusion above is "we need more data, not a different experiment
design," the next action is running additional repetitions of both
conditions at the same checkpoint (`782d92e`) — not a redesign, not a
resource change, not a conclusion drawn from insufficient data.

## 6. Exact repository state

- Repository: `sp36ai/shams`.
- `main`/`claude/shams-phase-0-baseline-lnlmy6`: unaffected by this
  document beyond its own commit.
- No application, test, or workflow file is modified by this document.

---

## Status

**PHASE 8A-39 OBSERVER-EFFECT EXPERIMENT RESULTS (#444/#445): COMPLETE — INCONCLUSIVE, MORE DATA NEEDED.**

| Layer | Status |
|---|---|
| Experimental variable (guest-cpuinfo sampler) | ✅ Confirmed correctly differed between runs |
| Formal ANR trace | ❌ Absent in both runs |
| `system_server` contention | 🟠 Present in both, similar magnitude, did not escalate to ANR in either |
| Observer-effect hypothesis | 🟠 Untested by this pair — insufficient occurrence to compare |
| A2 / `#436` signature | ✅ Neither occurred — both runs classify as the standard visibility-timeout pattern |
| Finding B | ❌ Recurred in both (unaffected, unrelated) |
| Option A (Gradle cache save) | ✅ Confirmed again in both |
| Production readiness | ❌ NOT READY — unchanged |

Proceeding to additional repetitions of both conditions.
