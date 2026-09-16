# Phase 8A-44 — Relocate the ADB transport-layer state group to survive the log tail

Implements the candidate fix `PHASE_8A_43` flagged after run `#457`
showed a `get_job_logs` tail fetch landing mid-way through the
ADB-state group's own content, missing both the step's true start and
its true end.

## 1. Root cause of the truncation

The ADB-state group previously lived as the *last* group inside "Show
runner resource usage and OOM check" — but that one step bundles four
separate 3s-cadence samplers (`resource-usage.txt`, `guest-cpuinfo.txt`,
`clock-offset.txt`, `adb-state.txt`) for a run whose `Setup Android
emulator` step can last 25+ minutes (the A2-band cluster: `#434`
1409s, `#448` 1445s, `#457` 1652s). At ~3s cadence, that's several
hundred samples per file, several thousand lines combined — enough on
its own to exceed the ~4999-line retrievable tail (`PHASE_8A_27`),
regardless of what ran before or after this step. Being last *within*
that step wasn't enough; the step's own earlier groups (resource-usage,
guest-cpuinfo, clock-offset) were eating the budget before the tail
ever reached the ADB group.

## 2. What changed

Moved the `ADB transport-layer state` group out of "Show runner
resource usage and OOM check" into its own new step, `Show ADB
transport-layer state`, placed as the **last step in the job** — after
toolchain-version capture, Maestro-results upload, test-report
publish, and Gradle cache save (all `if: always()`, all independent of
this diagnostic and of each other). This is the same relocation
pattern already used twice before in this audit chain (`PHASE_8A_28`:
moved diagnostic steps after the large "Show logcat..." step;
`PHASE_8A_34`: moved the ANR/FATAL search groups to their own step for
the same reason) — nothing else's output now stands between this group
and the true end of the log a tail-based fetch keeps.

No change to sampler behavior, cadence, file path, or content — the
`nohup bash -c '...' > "$HOME/adb-state.txt" ...` sampler line inside
`Setup Android emulator` (added in `PHASE_8A_41`) is untouched. This is
a `cat`/display relocation only.

## 3. Verification performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid

$ git diff --stat
 .github/workflows/ci.yml | 29 +++++++++++++++++++++--------
 1 file changed, 21 insertions(+), 8 deletions(-)

$ git diff --stat -- .maestro/ android/
(no output -- both untouched)
```

Confirmed the removed block and the newly added step are byte-for-byte
the same `cat`/`echo`/`::group::` logic — only the removed comment
(now replaced with a comment explaining the new placement) and location
differ.

## 4. What this does and does not establish

**Does:**
- Increases the probability that a future A2 occurrence's full
  `adb-state.txt` content (not just a partial middle slice) is
  retrievable via `get_job_logs`, by removing the specific bottleneck
  `PHASE_8A_43` identified.

**Does not:**
- Guarantee full retrievability — if a future run's *total* log
  (toolchain capture + upload + publish + cache-save + this group) still
  exceeds ~4999 lines even with nothing after it, some of the group's
  own earlier samples would still be cut. This narrows the gap; it does
  not eliminate the underlying tail-cap limitation.
- Touch AVD/emulator configuration, RAM/CPU allocation, application
  code, Maestro flows, or the judgment engine.
- Establish A2's root cause — still open, per `PHASE_8A_42`/`PHASE_8A_43`.
- Change the production-readiness verdict.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Only `.github/workflows/ci.yml` and this document touched.
- No CI rerun triggered by this document itself; next A2-band
  occurrence (natural or `workflow_dispatch`) will be the first test of
  this relocation.

---

## Status

**PHASE 8A-44: ADB-STATE GROUP RELOCATED — VERIFIED, NOT YET RE-TESTED AGAINST A LIVE A2 OCCURRENCE.**

| Layer | Status |
|---|---|
| Relocation | ✅ Applied — own step, last in the job, after all other independent `if: always()` steps |
| Sampler behavior/content | ✅ Unchanged — reordering only |
| YAML / diff scope | ✅ Valid, confined to `ci.yml`, `.maestro/`/`android/` untouched |
| Effectiveness against the tail cap | 🔲 Not yet tested — awaiting next A2-band run |
| A2 root cause | 🔲 Still open |
| Production readiness | ❌ NOT READY — unchanged |
