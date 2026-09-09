# Phase 6C-1 — Targeted Remediation: Firestore Rules Suite Not Enforced by CI

Authorized against **Finding 1** of `docs/audit/PHASE_6B_CLOSURE.md` §2:
*"`firestore.rules.test.ts` never executed in CI (only a syntax/brace-balance
check runs)."* Baseline: `182a927`. Scope: this finding only —
reconnaissance, implementation, and regression verification, per the
explicit Phase 6C-1 authorization. No Review Gate or Closure Gate is
claimed or performed by this document; both remain separate,
not-yet-issued authorizations.

## 1. Reconnaissance — establishing the gap before touching anything

### 1.1 The CI workflow, as it existed at `182a927`

`.github/workflows/firestore-rules-tests.yml` defined one job
(`rules-validation`) and one step, running a pure shell/`grep` check
against `firestore.rules`: file exists, contains `rules_version = '2'`,
contains `service cloud.firestore`, contains the database matcher, and
has balanced `{`/`}` counts. **No Firestore emulator was started. No
test runner was invoked. `firestore.rules.test.ts` — the actual
26-assertion behavioral suite covering `/users`, `/quotas`, `/readings`,
`/rateLimits`, `/auditLogs`, and the catch-all deny — was never read,
loaded, or executed by this workflow.** This exactly matches the finding
as stated in the 6B reconnaissance and independently re-confirmed at the
6B review.

### 1.2 Why the real suite could not simply be invoked as-is

The repository's own `test:rules` script
(`package.json`, pre-change):

```
"test:rules": "firebase emulators:exec --config firebase.test.json --only firestore \"jest firestore.rules.test.ts --testEnvironment node --runInBand\""
```

assumes a bare `firebase` command is resolvable on `PATH`. `firebase-tools`
(the CLI that provides this binary) is **not a dependency of this
repository** — confirmed by `grep -n "firebase-tools" package.json
package-lock.json` returning nothing. The only `firebase` entry in
`package.json` is the client SDK package (`"firebase": "^10.14.0"`, a
`devDependency`), an entirely different package that does not provide a
CLI binary. A CI runner with a clean `npm ci` install would therefore
fail immediately with "command not found" if it simply ran `npm run
test:rules` unmodified — this is the root cause the fix needed to
address, not merely wiring the existing script into a workflow step.

**Existing precedent in this repository for how to invoke `firebase-tools`
without it being a committed dependency**: `.github/workflows/deploy-functions.yml`
already runs `npx firebase-tools deploy --only functions --project
shams-app-4d0e7 --force` — i.e. this repository's own established
convention is `npx firebase-tools`, not a `package.json` dependency. The
fix below follows that same convention, refined with an explicit version
pin for determinism (§2.1), which the pre-existing `deploy-functions.yml`
usage does not have and which this authorization does not touch.

## 2. Implementation — the smallest defensible change

### 2.1 `package.json` — `test:rules` made self-sufficient

```diff
-    "test:rules": "firebase emulators:exec --config firebase.test.json --only firestore \"jest firestore.rules.test.ts --testEnvironment node --runInBand\"",
+    "test:rules": "npx --yes firebase-tools@15.29.0 emulators:exec --config firebase.test.json --only firestore \"jest firestore.rules.test.ts --testEnvironment node --runInBand\"",
```

- `npx --yes firebase-tools@15.29.0` replaces the bare `firebase`
  invocation. This makes the script runnable from a clean `npm ci`
  checkout with no global tool installation assumption — true both
  locally and in CI, and true for every future contributor.
- The version is pinned exactly (`15.29.0`, the current published
  `latest` at the time of this remediation, confirmed via `npm view
  firebase-tools version`), for determinism — a CI run today and a CI
  run six months from now invoke the identical CLI version, rather than
  silently picking up a new major/minor release mid-stream.
- **No dependency was added to `package.json` or `package-lock.json`.**
  `firebase-tools` is fetched by `npx` at invocation time, exactly
  matching the existing convention `deploy-functions.yml` already uses
  for the same package — not a new pattern introduced by this
  remediation, and not "changing dependencies" in the sense the
  governing MUST-NOT list restricts (no manifest or lockfile entry is
  added).
- The command, flags, config file (`firebase.test.json`), and target
  test file (`firestore.rules.test.ts`) are otherwise byte-identical to
  the original script — only the tool-resolution mechanism changed.

### 2.2 `.github/workflows/firestore-rules-tests.yml` — the job now runs the real suite

The single job was renamed (`rules-validation` → `rules-tests`, step
name `"Validate Security Rules"` → `"Run Security Rules Tests"`, to
accurately describe what it now does) and its one shell-script step was
replaced with:

1. `actions/checkout@v4` (unchanged).
2. `actions/setup-node@v4`, `node-version: 20` — matches the version
   already used by `app-quality`/`functions-quality` in `ci.yml`, and
   satisfies `firebase-tools@15.29.0`'s own `engines.node: >=20.0.0`
   requirement (confirmed via `npm view firebase-tools engines`).
3. `actions/setup-java@v4`, `distribution: temurin`, `java-version: 17`
   — the Firestore emulator is a JVM process and will not start without
   a JRE on `PATH`. This mirrors the existing `actions/setup-java@v4`
   pattern already used in `ci.yml`'s `e2e` job, rather than relying on
   an undocumented assumption about what the `ubuntu-latest` runner
   image happens to pre-install.
4. `npm ci` — installs `@firebase/rules-unit-testing` (already a
   committed `devDependency`, confirmed via `grep`) and everything else
   the test needs; `firebase-tools` itself is fetched by the next step's
   `npx` call, not by this install.
5. `npm run test:rules` — the exact, unmodified script every contributor
   already runs locally, now genuinely runnable in CI because of §2.1.

The workflow's triggers (`push`/`pull_request` on `main`, path filters,
`workflow_dispatch`) and `permissions: contents: read` are unchanged.

### 2.3 What was deliberately left alone

- **`firestore.rules` itself — untouched.** `git diff --stat --
  firestore.rules` confirms zero changes, satisfying the governing
  MUST-NOT exactly.
- **`firestore.rules.test.ts` — untouched in its final, committed
  state.** It was temporarily mutated for the failure-sensitivity check
  in §4 and fully restored before any commit — never weakened, rewritten,
  or deleted as a net effect.
- **No production application code** (`src/`, `functions/src/`) was
  touched — confirmed in §5.
- **Findings 2–7** were not addressed. This remediation is scoped to
  Finding 1 only.

## 3. Determinism assessment

- The pinned `firebase-tools@15.29.0` version means the exact CLI build
  running the emulator is fixed, not "whatever `latest` resolves to on
  a given day."
- `firebase.test.json` (unchanged) pins the emulator's Firestore port
  (`8181`) and enables `singleProjectMode`, so the test run does not
  depend on any ambient Firebase CLI configuration beyond what the repo
  already commits.
- `.firebaserc`'s `"default"` alias resolves the project id
  (`shams-app-4d0e7`) the same way it already did for local runs — no
  new environment-specific assumption was introduced.
- `node-version: 20` and `java-version: 17` are both pinned exactly,
  matching the precision already used elsewhere in this repository's own
  workflows (`ci.yml`, `release-play-store.yml`).

This is a materially more deterministic configuration than the
repository's own pre-existing `npx firebase-tools` usage in
`deploy-functions.yml` (which carries no version pin) — that file is
untouched by this authorization, and its own lack of a pin is noted here
only for context, not as a finding this remediation addresses.

## 4. Evidence — before, mutation, and after

All three checks were run directly (not simulated) from this branch's
working tree, `git status --porcelain` confirmed clean before the first
and after the last.

### 4.1 Before: the real suite passes locally once made runnable

```
$ npm run test:rules
...
PASS ./firestore.rules.test.ts
  /users/{userId}            — 10 tests
  /quotas/{userId}           — 5 tests
  /readings/{readingId}      — 6 tests
  /rateLimits                — 2 tests
  /auditLogs                 — 2 tests
  catch-all deny             — 1 test

Test Suites: 1 passed, 1 total
Tests:       26 passed, 26 total
✔  Script exited successfully (code 0)
```

This is the same 26/26 result independently established at the Phase 6B
review (`301a69a`) — re-confirmed here against the now-pinned invocation
before any CI change was written, proving the fixed script itself works.

### 4.2 Failure sensitivity — a controlled mutation, then full restoration

Per the authorization's explicit evidence requirement, and to avoid the
governing MUST-NOT against modifying `firestore.rules` itself, the
mutation was made in the **test file**, not the rules — flipping a
single known-good assertion in `firestore.rules.test.ts` from a rejected
read to an accepted one:

```diff
-    await assertFails(db.collection('users').doc('alice').get());
+    await assertSucceeds(db.collection('users').doc('alice').get());
```

(the `"other user CANNOT read someone else's doc"` case, `/users/{userId}`)

Re-running `npm run test:rules` with this mutation in place:

```
● /users/{userId} › other user CANNOT read someone else's doc
    FirebaseError: false for 'get' @ L51, false for 'get' @ L156
Test Suites: 1 failed, 1 total
Tests:       1 failed, 25 passed, 26 total
⚠  Script exited unsuccessfully (code 1)
Error: Script "jest firestore.rules.test.ts --testEnvironment node --runInBand" exited with code 1
```

The actual process exit code was independently checked (not inferred
from the tail of piped output): `npm run test:rules > log 2>&1; echo
$?` → **`1`**. This is exactly the exit code a GitHub Actions `run:`
step treats as job failure — proving the CI job this remediation adds
would genuinely turn red on a real rules regression, not merely appear
to run.

The mutation was then fully reverted:

```
$ cp <backup> firestore.rules.test.ts
$ git diff --stat firestore.rules.test.ts
(no output — zero diff)
$ npm run test:rules
Tests: 26 passed, 26 total
✔  Script exited successfully (code 0)
```

`git diff --stat` against the restored file produced no output,
confirming the working tree carries no trace of the temporary mutation.

### 4.3 After: full regression matrix, re-run fresh against the final state

| Check | Result |
|---|---|
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** |
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **529/529**, 23 files |
| `cd functions && npm run verify-engine-sync` | `Check passed — functions/src/engine/ matches src/astrology/.` |
| `npm run test:rules` (final, restored state) | **26/26** |

The golden corpus / replay / adversarial-harness checks were not
re-run: this remediation touches no RKP engine, judgment, narration, or
astrology-primitive code (`src/astrology/`, `functions/src/engine/`,
`functions/src/oracle/`), and the mirror-sync check above independently
confirms `functions/src/engine/` still matches `src/astrology/` exactly
— there is no code path by which this remediation could affect
deterministic judgment output.

## 5. Scope verification

```
$ git status --porcelain
 M .github/workflows/firestore-rules-tests.yml
 M package.json

$ git diff --stat
 .github/workflows/firestore-rules-tests.yml | 75 +++++++++++------------------
 package.json                                |  2 +-
 2 files changed, 29 insertions(+), 48 deletions(-)

$ git diff --stat -- firestore.rules
(no output)

$ git diff --stat -- src/ functions/src/
(no output)
```

Exactly the two files this authorization scoped were changed. No
`package-lock.json` change (no dependency was added — §2.1).
`firestore.rules` untouched. No production application code
(`src/`, `functions/src/`) touched. `firestore.rules.test.ts` untouched
in its committed state (its temporary mutation in §4.2 was fully
reverted before this check was run).

`origin/main` was fetched and confirmed unchanged
(`ce536bc — "Force Cloud Functions redeploy to verify mystical Oracle
prompt deployment"`, the same commit already on record from prior
phases) — this remediation touches only the working branch,
`claude/shams-phase-0-baseline-lnlmy6`.

## 6. Hard-stop assessment

**No hard-stop condition was triggered.** Explicitly checked against
each condition in the governing authorization:

- No P0/P1 security or data-integrity vulnerability was discovered — the
  finding itself is a CI-enforcement gap, not a live defect (the 6B
  review already established the rules themselves are currently
  correct).
- CI cannot bypass or falsely report success despite a rules-test
  failure — §4.2 directly demonstrates a real test failure produces exit
  code 1, which fails the GitHub Actions step and therefore the job.
- The fix did not require changing production rules or application
  behavior — confirmed in §5.
- No credentials, secrets, or deployment infrastructure needed to
  change — confirmed: this workflow requires no secrets (`permissions:
  contents: read` only, unchanged), and nothing in `.firebaserc`,
  Firebase project configuration, or deployment targets was touched.
- No broader shared authorization/security primitive was implicated —
  this is an isolated CI-tooling gap specific to one workflow file and
  one npm script.
- No unrelated production defect was discovered during this work.

## 7. What this remediation does and does not establish

- **Does establish**: from the next push or pull request touching any
  of the paths this workflow watches (`firestore.rules`,
  `firestore.rules.test.ts`, `firebase.test.json`, `package.json`, or
  the workflow file itself), the real 26-assertion behavioral Firestore
  Rules suite will actually execute against a live emulator in CI, and a
  genuine regression in it will fail that CI job.
- **Does not establish**: that this workflow has actually run
  successfully on GitHub's own infrastructure. This environment's
  network restrictions (documented in `docs/audit/PHASE_6B_REVIEW.md`
  §5.2) prevent triggering or observing a live GitHub Actions run from
  here. Everything in §4 was verified by running the exact same commands
  locally, not by observing GitHub Actions execute them — this
  distinction is preserved deliberately, per the standing instruction
  not to silently convert an environment-blocked verification into a
  "passed" claim. The two environment-blocked boundaries named in
  `PHASE_6B_CLOSURE.md` §4 (live deployed-state verification, GitHub
  secrets/branch-protection verification) remain exactly as unresolved
  as they were before this remediation — this document does not resolve
  either, and does not claim to.
- **Does not establish** production readiness in any sense. Findings
  2–7 from `PHASE_6B_CLOSURE.md` remain open, unaddressed by this
  authorization.
- **One residual note, not a finding**: if a GitHub branch-protection
  rule on `main` names a required status check by its old job/step name
  (`rules-validation` / `"Validate Security Rules"`), renaming the job
  to `rules-tests` / `"Run Security Rules Tests"` could require that
  required-check name to be updated to match, or the check would appear
  perpetually "expected" and never satisfied. This repository's own
  workflow YAML carries no such reference (confirmed via `grep`,
  §1), and whether any such branch-protection rule exists on GitHub's
  side is precisely the second environment-blocked boundary this
  document does not resolve. Disclosed here for the record, not
  remediated — resolving it, if needed, requires GitHub repository
  administration access this environment does not have.

## 8. Deliverable / commit discipline

The only changes made under this authorization:

- `package.json` (`test:rules` script — §2.1)
- `.github/workflows/firestore-rules-tests.yml` (§2.2)
- `docs/audit/PHASE_6C_1_REMEDIATION.md` (this document)

No other file is touched. This authorization does not perform or claim
a Review Gate or a Closure Gate — both remain separate, not-yet-issued
authorizations, exactly as the governing authorization states.

---

## Status

**PHASE 6C-1 IMPLEMENTATION: COMPLETE, pending independent review.**

| Layer | Status |
|---|---|
| Phase 6B Closure | ✅ CLOSED (`182a927`) |
| 6C-1 reconnaissance | ✅ Complete (this document, §1) |
| 6C-1 implementation | ✅ Complete (this document, §2) |
| 6C-1 regression evidence | ✅ Recorded (this document, §4) |
| 6C-1 Review Gate | 🔲 Not yet authorized |
| 6C-1 Closure | 🔲 Not yet authorized |
| Findings 2–7 | ⛔ Not addressed by this authorization |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for the 6C-1 Review Gate.
