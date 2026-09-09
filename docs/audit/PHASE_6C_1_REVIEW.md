# Phase 6C-1 — Independent Review Gate

Independent verification of `docs/audit/PHASE_6C_1_REMEDIATION.md`
(`8b3fb73`), per the separately issued Phase 6C-1 Independent Review
Gate authorization. **Review only — no repository file was modified by
this review.** The one file this review adds is this document itself.
`git status --porcelain` was confirmed clean before the first command
and after the last.

## 1. Baseline

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: the 6C-1 remediation at `8b3fb73`.
- Prior checkpoint: `182a927` (Phase 6B Closure).
- Working tree: clean throughout.

## 2. Independent methodology

Every claim in `PHASE_6C_1_REMEDIATION.md` was re-derived from source —
commands re-run fresh, not copied from its own output — including a
**second, independently chosen** failure-sensitivity mutation (a
different assertion than the one the remediation itself used), and a
live query of this repository's actual GitHub Actions run history to
test, rather than merely restate, the "not independently observable"
claim about live CI execution.

## 3. Requirement-by-requirement verdicts

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Pre-remediation CI gap vs. historical baseline | **PASS** | §4.1 |
| 2 | `package.json` `test:rules` invokes the behavioral suite | **PASS** | §4.2 |
| 3 | Pinned `firebase-tools` invocation is deterministic/appropriate | **PASS** | §4.3 |
| 4 | Workflow installs prerequisites and runs `npm run test:rules` | **PASS** | §4.4 |
| 5 | Workflow fails when the rules suite exits nonzero | **PASS** | §4.5 |
| 6 | `firestore.rules` unchanged | **PASS** | §4.6 |
| 7 | Rules tests unchanged (except documented test-support necessity) | **PASS** | §4.6 |
| 8 | No production code/rules/deps/deployment/other-findings changes | **PASS** | §4.7 |
| 9 | 26/26 evidence reproducible locally | **PASS** | §4.8 |
| 10 | Failure-sensitivity evidence is genuine, not vacuous | **PASS** | §4.9 |
| 11 | Full regression evidence at `8b3fb73` is accurate | **PASS** | §4.10 |
| 12 | GitHub Actions/branch-protection boundary stays unresolved, not falsely "verified" | **NOT VERIFIABLE** (correctly reported as such by the remediation; independently strengthened, not resolved) | §4.11 |

**No requirement failed. No hard-stop condition was found.**

## 4. Evidence detail

### 4.1 Requirement 1 — pre-remediation gap

`git show 182a927:.github/workflows/firestore-rules-tests.yml` was
read in full, independently of the remediation document's own
transcription. Confirmed: one job (`rules-validation`), one step, doing
only `grep`-based checks (`rules_version = '2'` present, `service
cloud.firestore` present, database-matcher present, brace-count
balance) against `firestore.rules`. No emulator was started, no test
runner was invoked, `firestore.rules.test.ts` was never referenced.
Matches the remediation's §1.1 exactly, independently confirmed against
the actual historical commit rather than trusted from its quoted diff.

### 4.2 Requirement 2 — `test:rules` invokes the real suite

```
$ grep -n "test:rules" package.json
23:    "test:rules": "npx --yes firebase-tools@15.29.0 emulators:exec --config firebase.test.json --only firestore \"jest firestore.rules.test.ts --testEnvironment node --runInBand\"",
```

Confirmed: the script targets `firestore.rules.test.ts` (the real
26-assertion behavioral suite) via `jest`, run inside
`emulators:exec` against `firebase.test.json`'s Firestore emulator
configuration — not a syntax check, not a mock.

### 4.3 Requirement 3 — pin determinism/appropriateness

```
$ npm view firebase-tools@15.29.0 version
15.29.0
$ npm view firebase-tools engines
{ node: '>=20.0.0 || >=22.0.0 || >=24.0.0' }
```

The pin resolves to an exact, existing, currently-published version —
no floating range (`^`/`~`), so every invocation of this script
fetches the identical CLI build. The workflow's `node-version: 20`
setup satisfies `>=20.0.0`. This is a genuine improvement in
determinism over the repository's own pre-existing `npx firebase-tools`
usage in `deploy-functions.yml` (confirmed still unpinned there,
untouched by this remediation — correctly out of scope for Finding 1).

### 4.4 Requirement 4 — workflow installs prerequisites and runs the script

Full workflow content re-read directly from the working tree (not from
the remediation document's quoted excerpt):

- `actions/setup-node@v4`, `node-version: 20` — present.
- `actions/setup-java@v4`, `distribution: temurin`, `java-version: 17`
  — present, with an inline comment correctly identifying why (the
  Firestore emulator is a JVM process).
- `npm ci` — present, installs `@firebase/rules-unit-testing` (confirmed
  a committed `devDependency` via `grep -n
  "@firebase/rules-unit-testing" package.json` → present) and jest.
- Final step: `run: npm run test:rules` — present, unmodified from §4.2.

No step was found that could plausibly substitute for or shadow this
execution.

### 4.5 Requirement 5 — a real failure fails the workflow step

No `continue-on-error`, `|| true`, `; true`, or equivalent
failure-swallowing construct exists anywhere in the workflow file
(independently re-confirmed via `grep`, zero matches). The step is a
single bare command, not a pipeline — GitHub Actions' default Linux
`run:` shell (`bash -eo pipefail`) means a nonzero exit from `npm run
test:rules` fails the step, and therefore the job, under standard,
undisputed GitHub Actions semantics. §4.9 independently reproduces the
actual nonzero exit code this depends on.

### 4.6 Requirements 6–7 — rules and rules-tests file integrity

```
$ git diff 182a927..8b3fb73 -- firestore.rules
(no output)
$ git diff 182a927..8b3fb73 -- firestore.rules.test.ts
(no output)
```

Both files are byte-identical to the pre-remediation checkpoint. No
"documented test-support necessity" exception was invoked or needed —
the remediation's own required test-file changes (§4.9's mutation) were
temporary and fully reverted before commit, and this diff against the
actual committed history confirms that reversion held.

### 4.7 Requirement 8 — scope containment

```
$ git diff --stat 182a927..8b3fb73
 .github/workflows/firestore-rules-tests.yml |  75 +++---
 docs/audit/PHASE_6C_1_REMEDIATION.md        | 366 ++++++++++++++++++++++++++++
 package.json                                |   2 +-
 3 files changed, 395 insertions(+), 48 deletions(-)

$ git diff --stat 182a927..8b3fb73 -- package-lock.json
(no output)
$ git diff --stat 182a927..8b3fb73 -- src/ functions/src/
(no output)
$ git diff --stat 182a927..8b3fb73 -- firebase.json .firebaserc firebase.test.json \
    firebase-emulator.json .github/workflows/deploy-functions.yml \
    .github/workflows/release-play-store.yml
(no output)
```

Exactly the three files the authorization scoped were changed. No
lockfile change (confirming no dependency was actually added — the
`npx` approach genuinely avoided a manifest/lockfile footprint). No
production application code. No deployment configuration. Findings 2–7
are untouched by definition (no file relevant to any of them appears in
the diff).

### 4.8 Requirement 9 — 26/26 reproduced independently

```
$ npm run test:rules
...
Tests:       26 passed, 26 total
✔  Script exited successfully (code 0)
```

Run fresh, from this review's own invocation, against the exact
committed state at `8b3fb73` — not copied from the remediation
document's transcript.

### 4.9 Requirement 10 — failure sensitivity is genuine

The remediation document's own mutation flipped one assertion in the
`/users/{userId}` suite. To independently verify the sensitivity is not
an artifact of that one specific test, this review performed a
**second, differently chosen** mutation in the `/quotas/{userId}`
suite:

```diff
   it('owner CANNOT write quota (Admin SDK only)', async () => {
     const db = testEnv.authenticatedContext('alice').firestore();
-    await assertFails(db.collection('quotas').doc('alice').set({ plan: 'premium', used: 0 }));
+    await assertSucceeds(db.collection('quotas').doc('alice').set({ plan: 'premium', used: 0 }));
   });
```

Result:

```
● /quotas/{userId} › owner CANNOT write quota (Admin SDK only)
    FirebaseError: 7 PERMISSION_DENIED: ...
Tests:       1 failed, 25 passed, 26 total
⚠  Script exited unsuccessfully (code 1)
```

The actual process exit code was checked directly, not inferred from
piped/tailed output: `npm run test:rules > log 2>&1; echo $?` → **`1`**.
This is a second, independent confirmation (on a different test, in a
different rule area — write-protection rather than read-protection)
that a genuine rules regression produces the nonzero exit code the CI
step depends on.

The mutation was then fully reverted:

```
$ cp <backup> firestore.rules.test.ts
$ git diff --stat firestore.rules.test.ts
(no output)
$ npm run test:rules
Tests: 26 passed, 26 total
✔  Script exited successfully (code 0)
```

`git diff --stat` confirmed zero trace of the mutation remained.

**Assessment: genuine, not vacuous.** Two independently chosen
mutations, in two different rule areas, both correctly failed the
suite with the correct exit code; both were fully and verifiably
reverted.

### 4.10 Requirement 11 — full regression matrix, re-run fresh

| Check | Result |
|---|---|
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** |
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **529/529**, 23 files |
| `cd functions && npm run verify-engine-sync` | `Check passed — functions/src/engine/ matches src/astrology/.` |
| `npm run test:rules` (restored state) | **26/26** |

Every figure matches `PHASE_6C_1_REMEDIATION.md` §4.3 exactly, each
independently re-run rather than accepted from the document.

### 4.11 Requirement 12 — the GitHub-side boundary, independently probed

This review went further than re-reading the remediation's own
disclosure — it attempted to actually query GitHub's live state via the
GitHub MCP tools available in this session, to test whether the
boundary could now be resolved rather than merely re-asserting it
could not.

**What was found:**

- `list_workflow_runs` for `firestore-rules-tests.yml` filtered to
  `branch: claude/shams-phase-0-baseline-lnlmy6` returns **zero runs**.
  This is not evidence of a failure to observe — it is because the
  workflow's own triggers (`push`/`pull_request` scoped to `branches:
  [main]`, plus `workflow_dispatch`) have never fired for this branch:
  no push to `main`, no pull request opened for this branch (confirmed
  via `search_pull_requests` with `head:claude/shams-phase-0-baseline-lnlmy6`
  → 0 results), and `workflow_dispatch` was never manually invoked.
- The workflow's unfiltered run history (139 runs total) shows the
  **pre-remediation, syntax-only job reporting `conclusion: "success"`
  on every historical run**, including on `main` itself and on merged
  PRs (e.g. run `34026041287`, "Merge PR #88," `main`, success). This is
  concrete, historical confirmation — not merely a theoretical concern —
  of exactly the risk Finding 1 named: a green "Firestore Rules Testing"
  check that never actually ran the behavioral suite. It does not
  reproduce the fixed workflow (all 139 runs predate this remediation,
  dated no later than 2026-09-06), so it cannot and does not confirm the
  new job succeeds live — it only confirms the failure mode the fix
  targets was real, on this repository's own history, not hypothetical.
- No GitHub tool available in this session can read branch-protection
  rules or required-status-check configuration (checked directly by
  searching this session's available GitHub tool surface — no such
  method exists among the attached GitHub MCP tools).
- `origin/main` was independently re-fetched and confirmed still at
  `ce536bc` — the same commit on record since Phase 6A-R1 — and
  `git merge-base --is-ancestor 8b3fb73 origin/main` confirms `8b3fb73`
  is not on `main`. **`main` remains untouched**, independently
  reconfirmed, not merely restated.

**Assessment: NOT VERIFIABLE, exactly as the remediation itself
disclosed — neither weakened nor silently resolved.** This review did
not trigger a `workflow_dispatch` run itself: doing so would go beyond
"review only, do not modify repository files" in spirit (it is a live
action with side effects — consuming CI minutes and depending on
whatever secrets/credentials this repository's Actions environment
holds — that this authorization did not extend to), and no tool in this
session can inspect branch-protection state at all. The live-execution
and branch-protection boundaries named in `PHASE_6B_CLOSURE.md` §4
remain exactly as unresolved as they were before this review. This
review adds independent confirmation that the *specific failure mode*
Finding 1 describes is not speculative — it is directly visible in this
repository's own 139-run history — without converting the
live-execution boundary itself into a "PASS."

## 5. Hard-stop assessment

None of the six hard-stop conditions in the governing authorization is
present:

- No P0/P1 vulnerability was found or reintroduced.
- CI cannot falsely succeed despite a rules-test failure — §4.5 and
  §4.9 directly demonstrate the opposite, with a second independently
  chosen mutation.
- The remediation does not weaken or bypass behavioral rules testing —
  it is the first change in this repository's history to actually wire
  the real suite into CI at all (§4.11's historical-run evidence
  confirms no prior version of this workflow ever did).
- No production behavior or Firestore rules changed outside
  authorization (§4.6, §4.7).
- No broader security/deployment primitive requires remediation beyond
  Finding 1 — this remediation is self-contained to one workflow file
  and one npm script.
- No evidence contradicts the implementation record. Every figure in
  `PHASE_6C_1_REMEDIATION.md` was independently reproduced and matched.

## 6. Residual / unresolved boundaries — restated, not resolved by this review

1. **Live GitHub Actions execution of the new workflow.** Not yet
   observable — no push to `main`, no PR, and no manual dispatch has
   occurred for this branch's commits (§4.11). This is a fact about
   what has and has not happened on GitHub, independently confirmed via
   the GitHub API, not an assumption.
2. **GitHub branch-protection / required-status-check configuration.**
   No tool available in this session or the prior implementation's
   environment can inspect it. `PHASE_6C_1_REMEDIATION.md` §7's
   residual note (a required-check name possibly referencing the old
   job name `rules-validation`/`"Validate Security Rules"`) remains an
   open, disclosed, unverified risk — not escalated, not dismissed.
3. Both boundaries are identical in kind to the two named in
   `PHASE_6B_CLOSURE.md` §4 and are not resolved by this review or by
   the remediation it reviews.

## 7. Final disposition

**PHASE 6C-1 INDEPENDENT REVIEW GATE: ✅ PASS.**

All twelve requirements were independently re-verified against source
and live command execution rather than accepted from the remediation
document. Eleven are **PASS**, confirmed by direct, reproducible
evidence, including a second, independently chosen failure-sensitivity
mutation in a different rule area than the one the remediation itself
used. The twelfth (the GitHub Actions/branch-protection boundary) is
correctly and explicitly recorded as **NOT VERIFIABLE** — this review
went further than accepting that characterization by directly querying
GitHub's live state, which both confirmed the boundary is genuinely
unresolved (no qualifying run or PR exists for this branch, no
branch-protection-reading tool exists in this environment) and
surfaced independent historical evidence that the failure mode Finding
1 targeted was real on this repository's own past CI runs. No P0/P1 or
hard-stop condition was found.

**No remediation was performed or authorized by this review.** This is
a review-gate PASS for the `8b3fb73` checkpoint only. It does not
create a Phase 6C-1 closure document, does not authorize remediation of
Findings 2–7, and does not authorize any Phase 6D work. Per the
governing sequence, the next step is a separately authorized 6C-1
closure record.
