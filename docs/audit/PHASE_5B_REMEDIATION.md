# Phase 5B-R — Engine Mirror & Regression-Test Integrity Remediation

**Date:** 2026-09-08
**Scope:** P5B-1 (engine mirror drift) and P5B-2 (`pruneDir()` deleting
hand-authored tests) only, per the Phase 5B-R authorization. No engine
logic, judgment rule, validator, prompt, remedy, UI, Firestore rule, auth,
or payment code was touched. `kp/` primitives were not renamed or moved.
The remedy taxonomy was not reopened.

---

## A. P5B-1 root cause

`functions/src/engine/` is a generated mirror of `src/astrology/`,
produced by `functions/scripts/sync-engine.mjs`, which every real deploy
re-runs immediately before building (`firebase.json`'s `predeploy` hook
and `.github/workflows/deploy-functions.yml`'s explicit `npm run build`
step). Nothing, however, verified that the *committed* mirror actually
matched what a fresh sync would produce — the script only ever ran in
"write" mode, silently overwriting whatever was there, with no separate
check anyone could run (or that CI ran) to assert "these already agree."

Commit `9db63fc` ("fix: use `gharLabel()` so house ordinals read
1st/2nd/3rd, not 1th/2th/3th") changed
`src/astrology/rkp/watchJudgment.ts` (the canonical source) but was never
followed by a `npm run sync-engine` + commit — so
`functions/src/engine/rkp/watchJudgment.ts` (the committed mirror) kept
rendering `` `${targetHouse}th Ghar` `` (producing "1th Ghar", "2th Ghar")
instead of the corrected `gharLabel(targetHouse)` output ("1st Ghar",
"2nd Ghar") for another several commits, undetected, because nothing ever
compared the two.

## B. P5B-1 architectural decision

**Option A (single canonical source, `functions/` importing
`src/astrology/` directly) was investigated and rejected for this scope.**
Firebase's deploy packaging is scoped to `firebase.json`'s
`functions.source: "functions"` — only the `functions/` directory (plus
`node_modules` and the compiled `lib/` output) is ever uploaded to Cloud
Functions. A file outside `functions/` is not part of that package
regardless of whether TypeScript can resolve an import to it locally;
making `functions/` import `../../src/astrology` directly would require
widening the deploy source root to the repository root (or an
equivalent restructuring of `firebase.json`), which is deploy
infrastructure well outside this phase's "engine mirror + regression-test
integrity" boundary and was explicitly not authorized.

**Option B — a deterministically generated mirror with drift
detection — was implemented,** exactly as the brief allows as the
fallback when Option A isn't safely reachable. `sync-engine.mjs` was
already deterministic (pure read-transform-write, no randomness, and
already skips a write when the transformed content is byte-identical to
what's on disk). What was missing was *enforcement*: a way to assert "the
committed mirror already equals what sync would produce" and have that
assertion run automatically, for every test invocation, not just when a
developer remembers to run it.

## C. P5B-1 implementation

- **`functions/scripts/sync-engine.mjs`** — added a `--check` mode
  (`node scripts/sync-engine.mjs --check`). It performs the identical
  directory walk and content-transform as a real sync, but writes
  nothing: any file that would be created, overwritten, or pruned is
  collected into a `drift` list. If non-empty, it prints every affected
  path plus the fix command (`npm run sync-engine`) and exits 1; if
  empty, it exits 0. The underlying walk logic is shared with the normal
  write mode (parameterized by the same `CHECK_ONLY` flag), so there is
  exactly one implementation of "what does src/astrology/ transform to,"
  not two that could themselves drift from each other.
- **`functions/package.json`** — added `"verify-engine-sync": "node
  scripts/sync-engine.mjs --check"`.
- **`functions/scripts/vitestGlobalSetup.mjs`** (new) — runs
  `sync-engine.mjs --check` once, before any test file, for *every*
  vitest invocation (`npm test`, `npx vitest`, `npx vitest run`, a
  single-file run, an IDE's own runner) — not only ones that go through
  an npm script, which a `pretest` hook would miss. On drift it throws
  immediately, aborting the entire run before a single test executes,
  with a message naming the drifted file(s) and the fix command.
- **`functions/vitest.config.ts`** — wired `test.globalSetup:
  ['./scripts/vitestGlobalSetup.mjs']`.
- **`.github/workflows/ci.yml`** — added a dedicated "Verify engine mirror
  is in sync" step (`npm run verify-engine-sync`) in the
  `functions-quality` job, immediately after `npm ci` and before `Lint`
  or `Build` — so a stale commit fails CI with an unambiguous, named
  step rather than being silently corrected by the subsequent `Build`
  step (which runs a real sync) or masked entirely (the previous
  ordering: Lint → Build → Test meant Test always ran post-sync, hiding
  that the *commit itself* was stale).
- **`functions/src/engine/rkp/watchJudgment.ts`** — re-synced from
  canonical source via the (unmodified-in-logic) real sync path. This is
  the one actual content change: `` `${targetHouse}th Ghar` `` →
  `gharLabel(targetHouse)`, matching `src/astrology/rkp/watchJudgment.ts`
  exactly (verified: `--check` now reports zero drift).

No engine judgment, timing, diagnosis, or remedy logic was touched — the
corrected text is display-rationale wording only (see §M for the
confirmed, exact blast radius).

## D. Drift detection

Two layers, both exercising the identical check logic:
1. **CI, explicit and named** — `verify-engine-sync` step, first in the
   `functions-quality` job.
2. **Every vitest run, unconditionally** — the `globalSetup` hook, which
   cannot be bypassed by invoking vitest directly instead of through an
   npm script.

A developer can still choose to ignore a `git status` diff after running
`npm run build` locally, but they cannot get a green `npm test`/`npx
vitest run`/CI run while the committed mirror disagrees with canonical
source — the run aborts before any test executes.

## E. Failure probe (executed, then reverted)

```
$ echo "// DELIBERATE PHASE 5B-R DIVERGENCE PROBE" >> functions/src/engine/rkp/watchJudgment.ts
$ node scripts/sync-engine.mjs --check
[sync-engine] DRIFT DETECTED — functions/src/engine/ does not match src/astrology/.
The following 1 path(s) would change on a real `npm run build`:
  - rkp/watchJudgment.ts

Run `npm run sync-engine` (in functions/) and commit the result.
$ echo $?
1

$ npx vitest run > out.txt 2>&1; echo "vitest exit code: $?"
vitest exit code: 1
$ tail out.txt
⎯ Error during global setup ⎯⎯
Error: [vitest globalSetup] functions/src/engine/ is out of sync with src/astrology/
(see the [sync-engine] report above). Run `npm run sync-engine` in functions/
and commit the result before running tests.
```

Zero test files executed during the failing run — the abort happens
before test collection. Reverted via `git checkout --
functions/src/engine/rkp/watchJudgment.ts`, followed by a real
`npm run sync-engine` run to restore the *correct* (already-fixed)
content, then re-verified `--check` reports clean. `git status
--porcelain` confirmed no stray probe artifact remained.

---

## F. P5B-2 root cause

`sync-engine.mjs`'s `syncDir()` (the copy step) has always explicitly
skipped `__tests__` directories — they are jest suites that belong to the
app's own runner and are never part of the functions bundle. `pruneDir()`
(the cleanup step that removes destination files with no source
counterpart), which runs immediately after `syncDir()` on every sync, had
no equivalent exemption: it walked into `__tests__` directories exactly
like any other directory and deleted anything inside one that lacked a
same-path file under `src/astrology/`.

`functions/src/engine/primitives/__tests__/chartBuilder.test.ts` and
`julianDay.test.ts` (commit `585ccd5`, "Add RKP golden-value regression
tests (previously zero under engine/)") were deliberately placed directly
under the generated tree, specifically because there is no
`src/astrology/primitives/__tests__/chartBuilder.test.ts` /
`julianDay.test.ts` counterpart at all (the app-side `__tests__` covers
different ground — `ephemerisReferenceCases.test.ts`,
`vsop87Geocentric.test.ts`). `pruneDir()` therefore saw both files as
orphaned on every single sync and deleted them, silently, with only a
console log line (`[sync-engine] Pruned stale file: ...`) that nothing
was watching for.

## G. Test preservation implementation

One targeted change to `pruneDir()` in `functions/scripts/sync-engine.mjs`:
a `__tests__` directory is now skipped entirely (`continue`), mirroring
`syncDir()`'s own long-standing skip — exactly the exemption that was
missing, and nothing broader. Pruning of genuinely stale *generated*
files elsewhere in the tree is unchanged; the invariant this restores is
"sync may remove stale generated files, but must never delete a
hand-authored test."

## H. Previously deleted tests

| File | Location | Tests | Why hand-authored | Why it must survive build |
|---|---|---|---|---|
| `chartBuilder.test.ts` | `functions/src/engine/primitives/__tests__/` | 5 | No app-side counterpart exists — added directly under `engine/` specifically to give the generated primitives code its own regression coverage (commit `585ccd5`) | It is the only test coverage for `functions/src/engine/primitives/chartBuilder.ts`'s behavior as compiled/consumed server-side |
| `julianDay.test.ts` | `functions/src/engine/primitives/__tests__/` | 12 | Same as above | Same as above |
| **Total** | | **17** | | |

## I. Build survival proof

```
$ ls functions/src/engine/primitives/__tests__/
chartBuilder.test.ts
julianDay.test.ts

$ cd functions && npm run build
> sync-engine
[sync-engine] Syncing ... → ...
[sync-engine] Done. copied=0 skipped=31        # no "Pruned stale file" line

$ ls src/engine/primitives/__tests__/
chartBuilder.test.ts
julianDay.test.ts                              # both survive
```

## J. Test execution proof

Not merely "the files exist" — actually run, post-build:

```
$ npx vitest run src/engine/primitives/__tests__/
 ✓ src/engine/primitives/__tests__/julianDay.test.ts  (12 tests)
 ✓ src/engine/primitives/__tests__/chartBuilder.test.ts  (5 tests)
 Test Files  2 passed (2)
      Tests  17 passed (17)
```

And within the full suite (`npx vitest run`, no path filter): the same
two files appear among the 14 passed files / 189 passed tests total (see
§L). No assertion inside either file was modified, weakened, or removed
— only their survival through the build was at issue (confirmed by
`git diff` showing zero changes to either test file's own content in this
phase).

## K. CI proof

**NOT LOCALLY VERIFIABLE as an actual GitHub Actions run** — no such run
was triggered or observed in this session; claiming otherwise would be
fabricating CI evidence, which the brief explicitly forbids.

What **is** verified, as the closest available local equivalent: the
exact commands the `functions-quality` CI job now runs, in the exact
order the updated `ci.yml` specifies (`npm ci` → `verify-engine-sync` →
`lint` → `build` → `test`), were each run locally in that same order
against the same repository state, and every one succeeded, including
`test` discovering and executing all 17 previously-vulnerable tests (see
§I, §J). The `verify-engine-sync` step was additionally proven to fail
loudly and correctly when it should (§E). This is strong local evidence
that the described CI job will behave as intended, but it is not a
substitute for an actual observed Actions run — flagged as such rather
than upgraded to a claim of "PASS."

---

## L. Regression matrix

| Command | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **189/189 passed, 14 files** — includes both previously-vulnerable files (17 tests) and the `[sync-engine] Check passed` line from `globalSetup` |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root, Jest) | **304/304 passed, 27 suites** |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24 identical**, unaffected by this remediation (a live double-run comparison, not a stored-golden comparison) |
| `node functions/scripts/sync-engine.mjs --check` (final state) | exits 0, "matches src/astrology/" |
| Deliberate divergence → `--check` / `npx vitest run` | both fail loudly, reverted afterward (§E) |
| `git diff --stat` against `functions/src/oracle/`, `functions/src/prompts/`, `src/astrology/`, `src/` (app), `firestore.rules` | **empty on every one** — confirmed zero out-of-scope drift |

**Golden corpus: intentionally NOT regenerated or modified in this
phase — see §M below. This is a deliberate STOP, not an oversight.**

---

## M. Production drift — and the one item deliberately left unresolved

`git diff --stat` at the end of this phase:

```
.github/workflows/ci.yml                  |  9 +++
functions/package.json                    |  1 +
functions/scripts/sync-engine.mjs         | 96 ++++++++++++++++++++++++++++---
functions/src/engine/rkp/watchJudgment.ts | 14 ++---
functions/vitest.config.ts                |  5 ++
```
plus one new file, `functions/scripts/vitestGlobalSetup.mjs`. Nothing
else changed — confirmed against every prohibited path
(`functions/src/oracle/`, `functions/src/prompts/`, judgment/diagnosis/
remedy files, `NarrationContext`, `narrationValidator`,
`narrationFallback`, UI, `firestore.rules`, auth, payments, `kp/`
primitives) via individually-scoped `git diff --stat` calls, every one
empty.

**The one flagged, deliberately-STOPPED item:** regenerating
`docs/audit/golden-corpus/` (via `generate-golden-corpus.ts`) against the
now-corrected engine mirror changes **44 of 111** case files. Every
changed line, in every one of the 44 files, is the same "Nth Ghar"
rationale-text substring the P5B-1 fix corrects (`diff` confirmed:
every changed line in the full 44-file diff contains the literal
substring "Ghar"; zero changes to `outcome`, `verdict`/`state`,
`timingPosture`, `confidence`, `remedy`, or any other field, in any
file). This is a downstream, mechanical consequence of the engine
mirror itself having been the thing that generated the existing
corpus at some point while stale — not a new engine change, and not
something this phase introduced.

Per the brief's explicit instruction — *"Do not modify the golden
corpus... If golden corpus changes: STOP"* — this phase generated the
corpus once (to characterize the exact blast radius above), confirmed it
was scoped to text only, and then **restored `docs/audit/golden-corpus/`
to its pre-existing committed content** rather than committing the
regeneration. `git status --porcelain -- docs/audit/golden-corpus/`
is empty. The corpus was not modified as part of this phase's commit.

**This needs an explicit decision from you before it is touched:**
regenerate the 44 affected golden cases now (a tightly-scoped follow-up
that would only ever change "Nth Ghar" text to correct ordinals, provably,
same as this phase's own diff characterization), or leave the corpus
carrying the old "1th/2th Ghar" text as a deliberately-accepted,
documented discrepancy against the now-corrected engine. Nothing was
decided unilaterally.

---

## N. Remaining risks (scoped strictly to these two fixes)

- The golden-corpus/engine-mirror text discrepancy above is now a known,
  documented, bounded gap (44/111 cases, rationale text only) until
  explicitly resolved.
- `verify-engine-sync`'s CI proof is local-equivalent, not an observed
  Actions run (§K) — the next real push to a PR/branch touching
  `functions/**` or `src/astrology/**` will be the first live
  confirmation of the new CI step; nothing in this phase can substitute
  for that.
- The `--check` mode and `globalSetup` hook both depend on
  `sync-engine.mjs` itself staying correct — a future change to the sync
  script's own transform logic that introduced a bug would not be caught
  by this mechanism (it would just make both "real sync" and "check"
  agree on the wrong thing). This is an inherent limit of "detect
  disagreement between two runs of the same script," not something this
  phase's narrow scope was asked to solve further.

---

## Addendum — 2026-09-08: Phase 5B-R2 golden baseline reconciliation

The one item §M left open — whether the 44 (corrected to **45**, see
below) golden-corpus differences were safe to regenerate — was resolved
under the separately-authorized Phase 5B-R2. Full field-by-field proof
lives in `docs/audit/PHASE_5B_R2_GOLDEN_BASELINE.md`.

**Correction:** this document's §M stated "44 of 111" cases differ. A
scripted, exhaustive re-count found **45**, not 44 (an off-by-one in the
original manual `diff -rq` read). The conclusion is unaffected — all 45
were proven presentation-only, not just the 44 originally counted.

Every one of the 45 cases was compared field-by-field against the
corpus's actual schema (34 decision-bearing paths, 3 presentation paths,
plus provenance fields) — not sampled, not assumed. Result: **zero
decision-bearing field differed in any case**; the only field that ever
changed was `verdict.factors` (107 individual array-element strings
across the 45 cases), and every one of those 107 changed lines reduces
to byte-identical text once the "Nth" ordinal suffix is stripped — no
other wording changed anywhere. The change was traced to the single
`gharLabel()` mirror-sync correction from Phase 5B-R, with no other code
path touching `verdict.factors`.

The golden corpus was regenerated from the synchronized, canonical engine
(`sync-engine --check` confirmed clean immediately before generation) and
proven deterministic (two consecutive runs, byte-identical). Full
regression: functions 189/189, app 304/304, both typecheck/lint clean,
replay 24/24, mirror sync check passing. Zero unauthorized production
changes (verified via scoped `git diff --stat` against every prohibited
path).

**P5B-1 — REMEDIATED**
**P5B-2 — REMEDIATED**
**P5B-R2 — PASS**
