# Phase 8A-34 — Relocate `Show logcat...`'s ANR/FATAL Search Into Its Own Step

Implements: "Authorize relocating the Show logcat step's ANR/FATAL
groups separately." Directly addresses the gap
`PHASE_8A_33_CI_VERIFICATION_RUN440.md` §6 recorded: on run `#440`,
`Show logcat and preserved Maestro debug artifacts`'s own FATAL/crash
and ANR-marker logcat searches were unretrievable, because they ran as
that step's *first two groups* — before the hierarchy-dump/
`commands-*.json` content that usually dominates that step's total
size — so on a run where that content is large, `get_job_logs`'s
retrievable-tail cap (`PHASE_8A_27`) can cut off these two searches
even though `PHASE_8A_28` already moved the *other* diagnostic steps
past that same cap. **Reordering only — no search logic, application
code, or test file is changed. No remediation of Finding A or B. No CI
rerun.**

## 1. What was changed

Confined to the `e2e` job in `.github/workflows/ci.yml`:

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 47 +++++++++++++++++++++++++++++------------------
 1 file changed, 29 insertions(+), 18 deletions(-)
```

The FATAL/crash grep and the Phase 8A-30 ANR-marker grep — previously
the first two groups inside `Show logcat and preserved Maestro debug
artifacts` — are now their own step, **`Show logcat ANR/FATAL search
results`**, placed immediately after `Show logcat...` (which keeps
its remaining groups: last-150-lines, the Maestro artifacts listing,
small hierarchy dumps, and the `commands-*.json` extraction).

New step order in the `e2e` job (unchanged steps omitted):

```
Show logcat and preserved Maestro debug artifacts   <- large-output step (unchanged content, minus the 2 moved groups)
Show logcat ANR/FATAL search results                 <- NEW step, the 2 relocated groups
Show runner resource usage and OOM check              <- unchanged (Phase 8A-28 relocation)
Capture Android SDK/emulator toolchain versions        <- unchanged (Phase 8A-28 relocation)
Upload Maestro results
```

Both `grep` commands are byte-identical to before the move — verified
directly in the diff (only their surrounding `::group::`/`::endgroup::`
scaffolding and step placement changed).

## 2. Why this fixes the gap

`get_job_logs` returns only the log's final ~4999 lines/~565KB
regardless of the `tail_lines` value requested, once a job's log
exceeds that size (`PHASE_8A_27`). `PHASE_8A_28` already moved the
*resource/toolchain diagnostic steps* to run after `Show logcat...`
for exactly this reason. `PHASE_8A_33` found a distinct manifestation
of the same problem: content *within* `Show logcat...` itself can
also get cut off from the front, if that step's own later groups
(the hierarchy dumps, and especially `commands-*.json`, which
routinely exceeds 50KB per `PHASE_8A_21`) are large enough. Moving the
two searches into their own step *after* `Show logcat...` entirely —
rather than leaving them as that step's first two groups — means their
output is now nearer the end of the log than the content that was
pushing them out, the same fix pattern `PHASE_8A_28` already applied
one level up.

This does not guarantee retrievability in every future run (if
`Show logcat...`'s own content grows large enough on its own, even a
step immediately after it could still be pushed out) — the same
caveat `PHASE_8A_28`'s own document already recorded.

## 3. Verification performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid

$ git diff --stat -- .maestro/ android/
(no output — both untouched)

$ git diff .github/workflows/ci.yml
(29 insertions, 18 deletions -- confirmed: the two grep commands are
byte-identical before and after; only their step placement and
surrounding echo/group scaffolding moved)
```

New step order confirmed via a direct name search of the file:
`Show logcat and preserved Maestro debug artifacts` → `Show logcat
ANR/FATAL search results` → `Show runner resource usage and OOM check`
→ `Capture Android SDK/emulator toolchain versions`.

Same class of boundary as every prior CI-config change in this audit
chain: the only real proof this relocation achieves its purpose is an
actual CI run whose log is fetched afterward — **not performed here**;
this authorization did not include a CI rerun.

## 4. What this does and does not establish

**Does:**
- Implement exactly the authorized relocation.
- Directly target the specific gap `PHASE_8A_33` §6 found, with no
  change to search logic, application behavior, Maestro assertions, or
  emulator resource allocation.

**Does not:**
- Guarantee retrievability in every future run (see §2's caveat).
- Retroactively supply the ANR-trace evidence `PHASE_8A_33` could not
  confirm for run `#440` — that gap remains as recorded there.
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

**PHASE 8A-34 LOGCAT ANR/FATAL SEARCH RELOCATION: COMPLETE.**

| Layer | Status |
|---|---|
| Step relocation | ✅ Implemented — FATAL/crash + ANR-marker searches moved into their own step, after `Show logcat...` |
| Search logic | ✅ Unchanged — byte-identical `grep` commands |
| YAML validity / diff scope | ✅ Verified — valid, `.maestro/`/`android/` untouched |
| Actual retrievability improvement | 🔲 Not yet observed — requires a separate CI Rerun Authorization |
| Finding A root cause | 🔲 Still not confirmed |
| Finding B | 🔲 Untouched, still open |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun to verify the relocated searches' output is now retrievable, or
any other action the owner chooses.
