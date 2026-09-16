# Phase 8A-42 — A2 correlated against `#436` and the other experiment runs via step-level timing

Follows the "Tuesday" instruction: *"Start with A2, specifically
correlate run #448 (control, sampler OFF, 1204s, Android driver
unreachable) against #436 and the other experiment runs."*
`PHASE_8A_41` already established that `#448`'s own job log cannot be
retrieved deeply enough to trace the causal chain inside its `Setup
Android emulator` step. **This document does not repeat that
attempt.** Instead it correlates the one dataset that *is* fully
retrievable regardless of log-size limits — each job's own per-step
`started_at`/`completed_at` timestamps via `list_workflow_jobs` — across
all 9 runs with usable evidence, read-only, no `ci.yml`/AVD/judgment
change.

## 1. Read-only verification performed first

Before trusting `638ea65` (the Phase 8A-41 ADB-sampler commit already
on `origin`), independently re-verified it in this session:
`python3 -c "import yaml; yaml.safe_load(...)"` → `YAML valid`;
`git diff --stat 91af654 638ea65` → only `.github/workflows/ci.yml`
(28 insertions) and the new doc; `git diff ... -- .maestro/ android/`
→ empty (untouched); the new sampler line confirmed as one physical
line (no embedded newlines), consistent with the `#438`/`PHASE_8A_31`
lesson its own comment cites. Local branch fast-forwarded cleanly
(`91af654` → `638ea65`, no divergent local commits, no merge
conflict). This is accepted as sound and built on below.

Also noted, not acted on: run `#457` (id `35062829561`, head
`638ea65`) is currently `in_progress` — the first run to carry the new
`adb-state.txt` sampler. Its result is not yet available and is not
needed for this document's conclusion; whoever next has evidence from
it should treat it as the first real test of the instrumentation added
in `PHASE_8A_41`.

## 2. The correlation: `Setup Android emulator` step duration

Pulled `list_workflow_jobs` for every run with prior evidence
(`PHASE_8A_35`/`38`/`39`/`41`/`NEXT_PRODUCTION_EXECUTION.md`) plus
`#434` and `#436` themselves, and computed each job's `Setup Android
emulator` step wall-clock duration directly from its own
`started_at`/`completed_at` (no log content needed):

| Run | `Setup Android emulator` duration | Result / signature |
|---|---|---|
| `#434` (id `34619159995`) | **23m29s (1409s)** | **A2** — `Android driver unreachable`, first occurrence |
| `#448` (id `34706084102`) | **24m05s (1445s)** | **A2** — control run (`disable_observer=true`), second occurrence |
| `#436` (id `34627268358`) | 7m03s (423s) | Unclassified — `auth-tab-signin` timeout, coroutine frame |
| `#441` (id `34690464956`) | 5m10s (310s) | A1 — direct SystemUI ANR (`PHASE_8A_35`) |
| `#444` (id `34704845126`) | 5m27s (per `PHASE_8A_39`, not independently re-pulled here) | Standard visibility-timeout pattern |
| `#445` (id `34704853088`) | 5m13s (per `PHASE_8A_39`) | Standard visibility-timeout pattern |
| `#446` (id `34706068685`) | 7m23s (443s) | Standard visibility-timeout pattern |
| `#447` (id `34706071603`) | 7m40s (460s) | Standard visibility-timeout pattern |
| `#449` (id `34706085177`) | 6m46s (406s) | Standard visibility-timeout pattern |

## 3. What this establishes

- **`#436` is confirmed structurally distinct from A2, not a missed
  recurrence of it.** Its `Setup Android emulator` duration (423s) is
  squarely inside the 7-run standard-pattern band (310s–460s). If
  `#436` had involved any ADB transport loss of the kind A2 shows, the
  same step would show it as a multi-hundred-percent outlier the way
  `#434`/`#448` do — it does not. This directly answers the
  correlation question for `#436`: **no timing evidence links it to
  A2**; it remains its own open, unclassified signature (visibility
  assertion + coroutine-scheduler frame), unrelated to the ADB
  transport-layer mechanism `PHASE_8A_41`'s sampler targets.
- **A2's two occurrences are tightly, consistently anomalous relative
  to every other sampled run.** `#434` and `#448` sit at 1409s and
  1445s respectively — a 36-second, ~2.5% spread between the two
  occurrences themselves, against a background where every other run
  (7 of 9 sampled) falls in a 310–460s band. The step takes roughly
  **3–4.7x longer** in both A2 occurrences than in any non-A2 run
  sampled.
- **The tight clustering between `#434` and `#448` (1409s vs 1445s) is
  itself a clue, not just corroboration.** An open-ended, arbitrary
  hang would be expected to vary more between two independent
  occurrences separated by a full day (`#434`: 2026-09-11 16:08 UTC;
  `#448`: 2026-09-12 16:56 UTC) and one CI-config generation
  (`9472133` vs `a50b354`). Landing within 36 seconds of each other is
  more consistent with a **bounded retry/timeout mechanism** governing
  the excess duration (e.g. a fixed number of `adb wait-for-device`
  or emulator-boot retries, each with its own timeout, being exhausted
  both times) than with an unbounded stall. `PHASE_8A_35_CI_VERIFICATION_RUN435`'s
  finding for `#434` — a normal first flow (72s), then ADB lost ~10.5
  minutes later, then two flows hanging 14m40s and 4m6s before failing
  — is consistent with this: 14m40s + 4m6s ≈ 18m46s of the ~23m29s
  total looks like two separate bounded wait/retry windows being
  exhausted in sequence, not one continuous unexplained stall.
- **The observer-effect sampler is ruled out again, independently of
  `PHASE_8A_41`'s own point.** `#448` was itself a control run
  (`disable_observer=true`, guest-cpuinfo sampler off) and still shows
  the full A2 timing signature — this timing-based view confirms the
  same conclusion `NEXT_PRODUCTION_EXECUTION.md` already drew from the
  error-message evidence, from an independent data source.

## 4. What this does not establish

- **Not a root cause.** This narrows *where* (the same step, a
  timeout/retry-shaped ~23–24 minute window) and *what it is not*
  (unrelated to `#436`, unrelated to the guest-cpuinfo sampler), but
  not *why* the ADB transport is lost in the first place. That
  requires the causal-chain data `PHASE_8A_41`'s new `adb-state.txt`
  sampler is designed to capture on the next A2 occurrence — this
  document does not have that data yet (run `#457` is still in
  progress and untested).
- **n=2.** Two occurrences is enough to observe a consistent pattern,
  not enough to treat the ~1400s duration or the retry-count hypothesis
  as confirmed. A third occurrence with `adb-state.txt` present would
  meaningfully strengthen or correct this.
- Does not touch `ci.yml`, AVD/emulator configuration, RAM/CPU
  allocation, application code, or the judgment engine — this document
  is analysis only, using data already retrievable via the GitHub API,
  no CI rerun triggered by this document itself.
- Does not change the production-readiness verdict.

## 5. Recommended next step

Wait for run `#457` (in progress at the time of writing) or trigger a
fresh `workflow_dispatch` run to accumulate `adb-state.txt` samples;
the next time `Setup Android emulator` shows this same ~1400s+
signature, pull that run's `adb-state.txt` (delivered via the job log,
same pattern as the other samplers, so not subject to the artifact
quota) and correlate its `adb get-state`/`devices -l`/
`sys.boot_completed`/uptime samples against the timing bands
established here — specifically checking whether the transport loss
happens near either the ~5-6min steady-state mark (matching normal
runs' completion, suggesting the emulator itself finished booting
normally before losing ADB) or earlier (suggesting a boot-time
failure that manifests as a transport-loss error only later).

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Local branch fast-forwarded to `638ea65` (Phase 8A-41) in this
  session, then this document added as a new commit on top — no other
  file touched.
- No workflow_dispatch triggered by this document (run `#457` was
  already in progress before this analysis began, from a source
  external to this session).

---

## Status

**PHASE 8A-42: A2/`#436` TIMING CORRELATION COMPLETE.**

| Layer | Status |
|---|---|
| `#436` vs A2 | ✅ Ruled out via timing — `#436`'s setup duration is in the normal band, not the A2 outlier band |
| A2 (`#434`/`#448`) internal consistency | ✅ Confirmed — 1409s/1445s, ~2.5% spread, both ~3-4.7x baseline |
| Retry/timeout-shaped hypothesis | 🟠 Suggested by clustering + `#434`'s sub-flow timings, not yet confirmed |
| Root cause | 🔲 Still open — awaiting `adb-state.txt` from next A2 occurrence |
| Observer-effect sampler as A2 cause | ✅ Ruled out again, independent confirmation |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |

Next: monitor run `#457` (and any subsequent runs) for the first
`adb-state.txt` capture of an actual A2 occurrence.
