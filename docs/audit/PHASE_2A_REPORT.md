# Phase 2A — Infrastructure & Authority Stabilization — Final Report

**Repository:** sp36ai/Shams
**Scope:** CI correction, removal of confirmed-dead test-only code, and
audit/planning documentation. **No Watch engine file was moved, no
judgment/timing/remedy logic was changed, no `kp/` file was renamed or
removed, no safety validator was implemented or restored, no remedy path
was consolidated, no UI was changed.**

---

## 1. Exact files changed

```
MODIFIED
  .github/workflows/ci.yml                                   CI fix (§2)
  functions/.eslintrc.js                                     lint-config fix (§2A note)

DELETED
  functions/src/engine/kp/judgment/__tests__/judgeHorary.test.ts   dead test (§3)

NEW — documentation
  docs/audit/REMEDY_MIGRATION_PLAN.md
  docs/audit/SAFETY_VALIDATION_REDESIGN.md
  docs/audit/PHASE_2A_REPORT.md   (this file)
```

No file under `functions/src/engine/rkp/`, `functions/src/engine/kp/rules/`,
`functions/src/oracle/`, `src/astrology/`, any `*.tsx` UI file, `firestore.rules`,
or `functions/src/config.ts` was touched. Confirmed by `git status --short`
and `git diff --stat` against the Phase 1 baseline — see §12 for the exact
output.

## 2. Exact reason for each change

**`.github/workflows/ci.yml`** — two independent fixes to the E2E job, both
named in the Phase 2A brief:
1. Removed `|| true` from the Maestro test invocation
   (`.github/workflows/ci.yml`, "Setup Android emulator" step). This was the
   mechanism by which a genuinely failing Maestro run reported step success
   to GitHub Actions regardless of outcome.
2. Changed `dorny/test-reporter@v1`'s `fail-on-error` from `false` to `true`
   in the "Publish test report" step — a second, independent way the same
   failure could still not fail the job even if fix (1) were made
   ineffective by some other means. `true` is that action's own documented
   default; this had been explicitly set to its opposite.

Neither change touches the Maestro test *specifications* under
`.maestro/ci/`, nor weakens any assertion — both are pure CI-plumbing fixes
that change how an existing pass/fail result is reported, not what is
tested.

**`functions/.eslintrc.js`** — a Phase 2A-caused fix, disclosed plainly: the
Phase 1 scaffolding scripts (`functions/scripts/generate-golden-corpus.ts`,
`functions/scripts/replay-check.ts`) sit outside `tsconfig.json`'s
`include: ["src"]`, which broke `npm run lint` in `functions/` with a
"file not included in the TSConfig" parsing error — re-confirmed by running
`npm run lint` in this pass before applying the fix. Added `'scripts/'` to
`.eslintrc.js`'s `ignorePatterns`, using the exact reasoning already
documented in that same file for the pre-existing `'src/engine/'` entry
(same root cause: a directory reachable from disk but outside the TS
project's `include`). This is Phase 2A-allowed scaffolding maintenance, not
a production-behavior change — `functions/.eslintrc.js` has no runtime
effect on any deployed function.

**`functions/src/engine/kp/judgment/__tests__/judgeHorary.test.ts`** —
deleted. Full investigation below (§3); conclusively dead, its removal
restores `functions/`'s test suite to a genuinely clean state without
touching any production file.

**Three new documents** — the required Phase 2A deliverables: complete
remedy-path trace (`REMEDY_MIGRATION_PLAN.md`), safety-validator redesign
proposal (`SAFETY_VALIDATION_REDESIGN.md`), and this report.

---

## 3. Functions test baseline — `judgeHorary.test.ts` investigation

| Question | Finding |
|---|---|
| Why does it import a nonexistent module? | It imports `judgeHorary` from `'../judgeHorary'` — a file that was deleted, along with its three helpers (`significations.ts`, `significators.ts`, `timing.ts`), by commit `18232d7` ("Delete the retired KP/Astronomical judgment engine — completely, not just unwired (#92)"). The test file itself was not deleted in that commit — an oversight, not a deliberate choice; the same commit's own message lists `kp/judgment/__tests__/timing.test.ts` and `functions/__tests__/safetyValidator.test.ts` among files it *did* delete, so this specific file (`judgment/__tests__/judgeHorary.test.ts`) being left behind reads as a miss, not an intentional keep. |
| When was the target module deleted? | `18232d7`, 2026-08-25 16:49:57 +0530 (previously established in Phase 0/1, re-confirmed this pass via `git show 18232d7 --stat`). |
| Does it represent an obsolete judgment path? | **Yes, conclusively — confirmed by reading its full content this pass.** It tests `judgeHorary(chart, question, horaryNumber)` — the old astronomical/KP engine's verdict function, using `buildChart(iso, lat, lon)` (location-based, astronomical) and `ClassifiedQuestion` (the `askOracle` path's type), not `buildWatchChart`/`judgeWatchChart`/`DisplayWatchVerdict` (the live RKP Watch engine's types). It is testing the engine the constitution this audit operates under says must never come back, not the current one. |
| Does any production code import the same deleted module? | **No.** Repo-wide search for `judgeHorary` found only this one broken test import plus **comment-only** mentions in eight other files (`types/verdict.ts` ×2, `kp/rules/houseMatrix.ts` ×2, `kp/rules/questionKeywords.ts` ×2, `utils/planetBoundaryName.ts`, `functions/src/types.ts`, `chartBuilder.test.ts`) — every one individually checked this pass and confirmed to be prose referencing the file's old docstring for historical rationale, not an `import`/`require` statement. None of those comments were edited in this phase (out of scope — Phase 2A's brief was to investigate and, if safe, remove the dead test itself, not to sweep every stale comment in the repository). |
| Is removing it safe? | **Yes — conclusively.** It cannot load (confirmed both in Phase 0/1 and re-confirmed at the top of this phase, before the fix: `Error: Failed to load url ../judgeHorary ... Does the file exist?`), contributes zero passing tests, and nothing else in the repository depends on it loading or failing in any particular way. |

**Action taken:** removed the file (`git rm`), and nothing else — no
production engine file was touched, per the brief's explicit instruction to
modify only the test and its "obsolete test-only references." No other
test-only reference to the deleted module chain (`significations.ts`,
`significators.ts`, `timing.ts`) was found to need removal — this was the
only remaining one.

**Result:** `functions/`'s vitest suite went from `1 failed | 10 passed
(11)` / `89 passed (89)` to **`10 passed (10)` / `89 passed (89)` — the same
89 tests, now with zero failing suites.** No new failure appeared. Per the
brief's STOP condition ("If any new failure appears, STOP and report it"):
none did.

---

## 4. Remedy path trace

Full trace in `docs/audit/REMEDY_MIGRATION_PLAN.md`. Headline finding beyond
what Phase 1 established: **Path B's `selectedRemedies` are persisted to
on-device MMKV only, via `readingThreadsStore.ts`, never to Firestore** —
resolving Phase 1's "persistence unverified" flag definitively, not by
assumption but by re-reading that store's own module documentation and
confirming `functions/src/functions/selectRemedies.ts` performs no Firestore
write of any kind. Also newly established: Path B does not consume or check
the daily reading quota (no `claimQuotaSlot` import), is never spoken by
TTS, has no analytics consumer, and creates no feedback loop into any later
request. None of this was assumed — each claim was verified by reading the
relevant file in full this pass and is cited by file/line in the source
document.

---

## 5. Safety-validator redesign findings

Full proposal in `docs/audit/SAFETY_VALIDATION_REDESIGN.md`. Headline
findings from inspecting the recovered historical implementation
(`git show 08aac2b:functions/src/functions/safetyValidator.ts`, full file
recovered and read):

- It validated four free-prose fields per call, in isolation, via a second
  LLM (Haiku) — **never given the settled verdict/diagnosis**, so it could
  never check narration-vs-truth consistency, only tone/content of the text
  by itself.
- It was **itself non-deterministic** (an LLM call), fail-open on error, and
  said nothing about internal-terminology leakage at all.
- Proposed future boundary separates a deterministic terminology-leakage
  gate and a deterministic ground-truth cross-check (both new capabilities,
  neither present historically) from an optional, explicitly-flagged-as-
  non-deterministic semantic re-check — not a verbatim restoration of the
  deleted file.

---

## 6. Regression gate — golden corpus

Re-ran the Phase 1 generator and replay script after all Phase 2A changes
(CI workflow edit, eslint config edit, dead-test removal — none of which
touch any engine file, so this result was expected, and is reported as
executed evidence rather than assumed):

- **111-case two-process regeneration vs. the committed Phase 1 baseline:
  `diff -rq` → zero differences.** `git status` on
  `docs/audit/golden-corpus/` after regeneration: clean, no changes staged
  or unstaged.
- **24-case in-process replay
  (`functions/scripts/replay-check.ts`): 24/24 identical.**

**111/111 unchanged. No STOP condition triggered — no engine file was
modified in this phase, so none was expected, and the corpus confirms it.**

---

## 7. Test matrix

| Check | Result | Status |
|---|---|---|
| `functions/` vitest (`npx vitest run`) | 10 test files, 89 tests — all passing, zero failures | **PASS** (was `1 failed \| 10 passed`, `89/89 tests` before the dead-test removal) |
| `functions/` typecheck (`tsc --noEmit`) | Clean | **PASS** |
| `functions/` lint (`npm run lint` = `tsc --noEmit && eslint`) | Clean, after the `.eslintrc.js` fix (was broken by this phase's own new-file lint scope until fixed — see §2) | **PASS** |
| App jest (`npx jest --testPathIgnorePatterns=...`) | 29 suites / 356 tests, all passing | **PASS** |
| App typecheck (`tsc --noEmit`) | Clean | **PASS** |
| App lint (`npm run lint`) | Clean | **PASS** |
| Golden corpus regeneration (111 cases, two-process) | Byte-identical to committed baseline | **PASS** |
| Explicit deterministic replay (24 cases, in-process, exceeds the 20-case floor) | 24/24 identical | **PASS** |
| `functions/`'s bare `npm test` (no `--run`) | Confirmed (re-verified this pass) to start vitest's interactive watch mode and never exit on its own — the actual CI command (`npm test -- --run`, `.github/workflows/ci.yml:72`) is unaffected and was independently confirmed (`npx vitest run`) to exit 1 on a real failure and 0 when clean | **PASS for CI; NOT FIXED for local bare `npm test`** — out of this phase's stated scope (CI behavior, not `package.json` script ergonomics), noted as a carried-forward P1 in §9, not silently dropped |
| `check:orphans` (madge) | Exits 0 regardless of findings — confirmed advisory-only, cannot fail CI by construction (re-verified this pass, unchanged from Phase 1) | **PASS as a non-gating step; NOT a CI reliability issue this phase's brief asked to fix** (the brief named Maestro/dorny specifically) |
| Maestro E2E itself, executed live | Not run — no Android emulator/device or GitHub Actions runner available in this session | **NOT LOCALLY VERIFIABLE.** The workflow YAML was validated for syntax (`python3 -c "import yaml; yaml.safe_load(...)"` — parses cleanly, `jobs: ['app-quality', 'functions-quality', 'e2e']` as expected) and read in full for logical correctness, but whether `reactivecircus/android-emulator-runner@v2`'s `script:` step correctly propagates a non-zero exit from its last line into a failed GitHub Actions step (rather than, say, being swallowed by the action's own emulator-teardown wrapper) can only be confirmed by an actual run on GitHub Actions' infrastructure. **This is explicitly reported as NOT RUN / NOT LOCALLY VERIFIABLE, not converted to PASS.** |
| `firestore.rules.test.ts` (rules emulator) | Not run — requires the Firebase emulator, not started this pass, unchanged from Phase 0/1 | **NOT RUN** |

No result above was upgraded from "not run" to "pass." Where a check could
not be executed in this environment, it is named explicitly as such.

---

## 8. CI behavior before/after (documented, not independently GitHub-Actions-verified)

**Before:** a Maestro run in `.maestro/ci/` where every flow failed would
still report the "Setup Android emulator" step as successful (`|| true`
absorbs any exit code), and even if that were somehow not the case, the
"Publish test report" step was explicitly configured (`fail-on-error:
false`) not to fail on a report showing failed tests either. **Both
independent paths to a false-green result.**

**After:** the Maestro invocation's own exit code is no longer overridden,
and the report step is configured to fail on a report showing failures
(`fail-on-error: true`, that action's own documented default). A genuinely
failing on-device scenario should now fail the `e2e` job through either
mechanism independently.

**What was not, and could not be, verified in this session:** whether
`reactivecircus/android-emulator-runner@v2`'s wrapping behavior around the
`script:` block has any quirk that still absorbs the failure before it
reaches the job-level result (e.g., an internal `set +e`, or teardown logic
that resets the step's exit status) — this class of question is answerable
only by a real run on GitHub's infrastructure. Recommended next step,
outside this phase's scope to perform: deliberately push a commit that
introduces one failing Maestro assertion to a throwaway branch and confirm
the `e2e` job goes red, then revert it — the only fully conclusive proof.

---

## 9. Unresolved risks (carried forward + new)

**P0 — AI output safety validator absent from the live path.** Unchanged.
Design proposal produced (`SAFETY_VALIDATION_REDESIGN.md`); not implemented,
per instruction.

**P1 — Remedy duplicate authority (Path A / Path B).** Unchanged in kind,
substantially more complete in evidence — persistence, TTS, analytics, and
quota questions from Phase 1's open list are now all answered (§4). Not
consolidated, per instruction.

**P1 — Maestro CI fix applied but not yet proven on real GitHub Actions
infrastructure.** New. See §7/§8 — flagged as NOT LOCALLY VERIFIABLE rather
than claimed fixed-and-confirmed. Recommend the deliberate-failing-commit
proof described in §8 before treating this as fully closed.

**P1 — `functions/`'s bare `npm test` still hangs in watch mode locally.**
Unchanged from Phase 1; explicitly out of this phase's CI-focused scope, not
silently dropped (see the test-matrix row).

**P2 — RKP engine logic tested once (source), not re-tested against the
deployed synced copy.** Unchanged from Phase 0/1.

**P2 — `classifyQuestion` exported callable has no found client caller.**
Unchanged.

**P2 — `check:orphans` (madge) cannot fail CI by construction.** Unchanged
from Phase 1; not a defect this phase's brief asked to fix (it named
Maestro/dorny specifically), noted for completeness.

**P3 — `useSpeechToText` test `act()` warnings.** Unchanged.

**New, non-blocking observation:** eight files carry stale comments naming
`judgeHorary.ts` for historical rationale, now referencing a file that has
not existed since `18232d7` and whose one remaining test has now also been
removed. Not fixed in this phase (out of the stated scope: "remove ONLY
that test and its obsolete test-only references" — these are non-test
files). Listed here so it is not later mistaken for something this phase
missed rather than deliberately left alone.

---

## 10. Recommended Phase 2B sequence

Not started. For the owner's consideration when scoping Phase 2B:

1. **Prove the CI fix on real infrastructure** (§8's deliberate-failure
   test) before relying on it as a safety net for any later phase's changes.
2. **Owner decision on remedy consolidation strategy** — the three options
   in `REMEDY_MIGRATION_PLAN.md` §H — before any remedy code changes.
3. **Owner decision on the safety-validator's fail-open/fail-closed question**
   (`SAFETY_VALIDATION_REDESIGN.md`, stage 3) before implementing any part of
   the redesign.
4. Only then, Engine Purification proper: canonical Watch namespace, `kp/`
   file relocation (data-only moves, per the Phase 1 `PHASE_1_ARCHITECTURE_MAP.md`
   §D table's "movable without behavior change" column), re-running the
   111-case golden corpus after every individual move as its own regression
   gate rather than once at the end.

---

## 11. What Phase 2A deliberately did not do

Per the change boundary: no Watch engine file moved, no judgment/timing/
remedy logic changed, no `kp/` file renamed/removed/relocated, no safety
validator implemented, `selectRemedies` and both remedy libraries left
fully intact and live, no UI changed.

---

## 12. Exact diff evidence

```
$ git status --short
 M .github/workflows/ci.yml
 M functions/.eslintrc.js
D  functions/src/engine/kp/judgment/__tests__/judgeHorary.test.ts
?? docs/audit/REMEDY_MIGRATION_PLAN.md
?? docs/audit/SAFETY_VALIDATION_REDESIGN.md
?? docs/audit/PHASE_2A_REPORT.md
```

No entry above touches `functions/src/engine/rkp/`, `functions/src/engine/kp/rules/`,
`functions/src/oracle/`, `src/astrology/`, any `.tsx` file, `firestore.rules`,
or any Firebase configuration file.

---

## STOP

This concludes Phase 2A. No Phase 2B work was started. `kp/` files remain
exactly where they were. The safety validator was designed on paper only.
The remedy paths remain both live and unconsolidated. Awaiting explicit
Phase 2B instructions.
