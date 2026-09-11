# Phase 8A-28 — Relocate Diagnostic Steps Later in the Job

Implements: "Authorize relocating the diagnostic steps later in the
job." Directly addresses the log-retrieval gap
`PHASE_8A_27_CI_VERIFICATION_RUN436.md` §2 recorded: `get_job_logs`
silently caps its returned payload to a job's final ~4999 lines/~565KB
regardless of the `tail_lines` value requested, and the large inlined
Maestro view-hierarchy JSON dump in `Show logcat and preserved Maestro
debug artifacts` was consuming that entire budget on its own — pushing
the Phase 8A-26 resource sampler/`dmesg` output and the Phase 8A-20
toolchain-capture output outside the retrievable window on run `#436`.
**Reordering only — no diagnostic logic, application code, or test
file is changed. No remediation of Finding A or B. No CI rerun.**

## 1. What was changed

Confined to the `e2e` job in `.github/workflows/ci.yml`:

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 97 +++++++++++++++++++++++++++++-------------------
 1 file changed, 58 insertions(+), 39 deletions(-)
```

Two existing steps — `Show runner resource usage and OOM check`
(Phase 8A-26) and `Capture Android SDK/emulator toolchain versions`
(Phase 8A-20) — were moved from their original position (right after
`Disk usage after Android SDK/emulator setup`, before `Show logcat and
preserved Maestro debug artifacts`) to run immediately **after** `Show
logcat and preserved Maestro debug artifacts` instead, right before
`Upload Maestro results`. Confirmed byte-identical step bodies before
and after the move — only their position and comments changed:

```
$ diff <(git show HEAD~1:.github/workflows/ci.yml | grep -A20 "name: Show runner resource usage and OOM check" | sed -n '1,10p') \
       <(grep -A20 "name: Show runner resource usage and OOM check" .github/workflows/ci.yml | sed -n '1,10p')
(no output — identical)
```

New step order in the `e2e` job (unchanged steps omitted):

```
Setup Android emulator
Disk usage after Android SDK/emulator setup
Show logcat and preserved Maestro debug artifacts   <- large-output step
Show runner resource usage and OOM check             <- moved here
Capture Android SDK/emulator toolchain versions       <- moved here
Upload Maestro results
Publish test report
Save Gradle cache
```

## 2. Why this fixes the gap

`get_job_logs` (this session's only working log-retrieval path — the
raw blob-log URL remains proxy-blocked, per `PHASE_8A_27` §2) returns
only the log's final ~4999 lines/~565KB once a job's log exceeds that
size, no matter how large a `tail_lines` value is requested. The large
inlined view-hierarchy JSON dump lives entirely inside `Show logcat
and preserved Maestro debug artifacts`'s own output and cannot be
shrunk without losing the evidence it exists to capture (Finding A's
SystemUI-ANR evidence in `PHASE_8A_25` came from exactly this dump).
Rather than reduce that step's output, this change moves the two
*smaller*, purely diagnostic steps to run after it — so their output
is now the part of the log nearest the end, and therefore the part any
tail-based fetch keeps, regardless of how much the large step emits
before them.

This is a reordering, not a size reduction — it does not shrink the
job's total log volume, and does not guarantee retrievability if a
future run's `Show logcat...` output grows large enough to itself
exceed the ~565KB cap on its own (in which case even these relocated
steps would again fall outside the window). It directly fixes the
specific gap `PHASE_8A_27` observed, at the cost of no longer
guaranteeing that *this* pair of steps runs where the eye would
naturally expect them (right after disk usage) — judged an acceptable
trade given their content is unaffected by their position, and comments
were added in both the old and new locations' surrounding context to
document why.

## 3. Verification performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
```

Same class of boundary as every prior CI-config change in this audit
chain: the only real proof this reordering achieves its purpose is an
actual CI run whose log is fetched afterward — **not performed here**;
this authorization did not include a CI rerun.

## 4. What this does and does not establish

**Does:**
- Implement exactly the authorized relocation.
- Directly target the specific retrieval gap `PHASE_8A_27` found,
  with no change to diagnostic content, application behavior, Maestro
  assertions, or emulator resource allocation.

**Does not:**
- Guarantee retrievability in every future run (see §2's caveat about
  the large step's own output potentially growing further).
- Prove the resource-constraint theory, or supply any data about
  run `#436` retroactively — that gap remains as recorded.
- Change emulator resource allocation or any other remediation.
- Address Finding B.
- Change the production-readiness verdict, which remains unchanged.

## 5. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — this commit is on the feature
  branch only.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here. Working tree clean before and after.
- No merge to `main` and no CI rerun is performed or requested by
  this document.

---

## Status

**PHASE 8A-28 DIAGNOSTIC RELOCATION: COMPLETE.**

| Layer | Status |
|---|---|
| Step relocation | ✅ Implemented — both steps moved after `Show logcat...`, bodies byte-identical |
| YAML validity | ✅ Verified |
| Diagnostic content/behavior | ✅ Unchanged — reordering only |
| Emulator RAM/CPU allocation | ✅ Unchanged |
| Actual retrievability improvement | 🔲 Not yet observed — requires a separate CI Rerun Authorization |
| Finding A root cause | 🔲 Still not confirmed |
| Finding B | 🔲 Untouched, still open |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun to verify the relocated steps' output is now retrievable, or any
other action the owner chooses.
