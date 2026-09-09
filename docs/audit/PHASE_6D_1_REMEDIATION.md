# Phase 6D-1 — Targeted Remediation: CI-Gated Production Deployment (Finding 3, Option C)

Authorized against **Finding 3** from `docs/audit/PHASE_6B_CLOSURE.md`
§2 / `docs/audit/PHASE_6D_RECONNAISSANCE.md`, Option C specifically:
*"require `ci.yml` to pass before a deploy workflow runs, independent of
a staging project."* Baseline: `1556e1c`. Scope: this exact,
narrowly-authorized change only — reconnaissance, implementation, and
regression verification. No Review Gate or Closure Gate is claimed or
performed by this document; both remain separate, not-yet-issued
authorizations.

## 1. Reconnaissance — re-confirmed against the exact baseline before touching anything

`docs/audit/PHASE_6D_RECONNAISSANCE.md` (this authorization's own
governing evidence) already established the gap in full — re-confirmed
fresh against `1556e1c` before any file was edited:

- All three deploy workflows (`deploy-functions.yml`,
  `deploy-firebase-hosting.yml`, `release-play-store.yml`) triggered
  independently on `push: branches: [main]`, with no dependency on
  `ci.yml` and no `environment:` gate.
- `ci.yml`'s own `name:` field is `CI` — the exact string needed for a
  `workflow_run` trigger's `workflows:` array (confirmed via `grep -n
  "^name:" .github/workflows/ci.yml`).
- No `environment:` key existed anywhere in `.github/workflows/`
  (re-confirmed via `grep`, zero matches) — nothing else in this
  repository currently gates a deploy on anything.

## 2. Implementation — the minimum change: switch trigger, gate the job, deploy the validated commit

Applied identically, with workflow-specific adjustments only where a
file's existing structure required them, to all three files:

### 2.1 Trigger: `push` → `workflow_run` (keyed to `ci.yml`), `workflow_dispatch` preserved

```diff
 on:
-  push:
-    branches: [main]
-    paths:
-      - 'functions/**'
-      - 'src/astrology/**'
-      - '.github/workflows/deploy-functions.yml'
+  workflow_run:
+    workflows: ['CI']
+    types: [completed]
+    branches: [main]
   workflow_dispatch:
```

(`release-play-store.yml` keeps its full `workflow_dispatch: inputs:
track: ...` block, character-for-character unchanged — only its `push`
block is replaced by the same `workflow_run` block.)

### 2.2 Job gate: only proceed on a passing CI run, or a deliberate manual dispatch

```diff
 jobs:
   deploy:
     name: Deploy to asia-south1
     runs-on: ubuntu-latest
+    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
     steps:
```

Applied to each of the three jobs (`deploy` in the two Firebase
workflows, `release` in `release-play-store.yml`). This is the actual
gate: a `workflow_run` event whose `conclusion` is anything other than
`'success'` (`failure`, `cancelled`, `skipped`, `timed_out`) now short-
circuits the job before any step runs. A manual `workflow_dispatch` is
unaffected — deliberately preserved as an operational escape valve, not
part of the "arbitrary push" risk the authorization named.

### 2.3 Checkout: deploy the exact commit CI validated, not just "main" at run time

```diff
       - name: Checkout
         uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
```

Without this, the checkout step would default to whatever `main` is at
the moment the deploy job happens to run — which could have moved on if
another push landed between `ci.yml` finishing and this job starting.
`workflow_run.head_sha` pins the deploy to the exact commit `ci.yml`
actually validated; the `|| github.sha` fallback covers the
`workflow_dispatch` case, where `workflow_run` context does not exist.

## 3. What was deliberately left alone

- **The production Firebase project and every deployment target** —
  untouched. `--project shams-app-4d0e7`, `channelId: live`, and the
  Play Store `internal`-by-default/`production`-by-manual-dispatch
  logic are all byte-for-byte unchanged.
- **No second Firebase/GCP project was created.** This remediation is
  Option C only — a repository-level gate, not Option A.
- **No application/runtime code, Firestore rule, or dependency** was
  touched — confirmed in §5.
- **No unrelated CI modernization.** `ci.yml` itself is unmodified; the
  only change is what triggers the three *deploy* workflows and what
  condition gates their jobs.
- **`docs/qa-test-script.md` was not modified**, per the authorization's
  explicit exclusion — its stale staging-project assumption
  (`PHASE_6D_RECONNAISSANCE.md` §2) remains exactly as disclosed,
  uncorrected, for a separate documentation task if one is authorized.
- **No attempt was made to resolve the GitHub branch-protection/
  Environment-protection/secrets/live-deployment boundaries** — see §6.

## 4. A disclosed, unavoidable side effect: `workflow_run` does not support `paths`

GitHub Actions' `workflow_run` trigger schema has no `paths` key —
unlike `push`, it cannot be scoped to only fire when specific files
change. All three workflows previously used `paths:` to avoid running
on unrelated changes (e.g. `deploy-functions.yml` only ran on pushes
touching `functions/**`/`src/astrology/**`). **This scoping is
necessarily lost** by switching to `workflow_run` — each of these three
workflows will now evaluate on every successful `CI` completion on
`main`, regardless of what changed in that push.

This was not worked around by adding new tooling (a paths-filtering
marketplace action, a diff-based skip step), in keeping with the
authorization's "minimum necessary change" and "no unrelated CI
modernization" instructions. Its practical impact is judged low, not
zero:

- `deploy-functions.yml`'s deploy step (`firebase-tools deploy --only
  functions ... --force`) is idempotent — redeploying identical
  function code on an unrelated push (e.g. a docs-only change) wastes a
  few minutes of CI time and cycles the Cloud Functions revision, but
  does not deploy incorrect code or otherwise misbehave.
- `deploy-firebase-hosting.yml` and `release-play-store.yml`'s build
  steps are similarly idempotent in effect (the hosting/Play Store
  artifact is rebuilt from the same source and re-uploaded).
- The gate this phase exists to add — blocking deployment when CI
  fails — is unaffected by this side effect; it only means these
  workflows now also run (and harmlessly redeploy) somewhat more often
  than before.

This is disclosed here explicitly, not discovered later. If the
increased run frequency becomes a real cost concern, narrowing it back
down is a separate, small follow-up (e.g. a path-filtering step inside
the job, gated on `git diff` between `workflow_run.head_sha` and its
parent) — not attempted here, out of this authorization's own scope.

## 5. Regression evidence

Because this remediation touches only workflow YAML, no application,
functions, or Firestore-rule code path is affected — the regression
matrix below confirms exactly that: nothing broke, because nothing in
the tested surface changed.

| Check | Result |
|---|---|
| YAML syntax (`python3 -c "yaml.safe_load(...)"` on all 3 files) | valid |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** |
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **543/543**, 26 files |
| `cd functions && npm run verify-engine-sync` | `Check passed — functions/src/engine/ matches src/astrology/.` |

## 6. Failure sensitivity — proven the way this environment actually can

**A live GitHub Actions execution could not be triggered or observed
from here** — the same environment-network-restriction and, distinctly,
a GitHub-Actions-specific limitation: `workflow_run` triggers are
evaluated using the workflow file version present on the repository's
**default branch**, not the version on whatever branch triggers the
event. Since this change lives on
`claude/shams-phase-0-baseline-lnlmy6`, not `main`, the gate does not
actually become live until this content reaches `main` — this is
disclosed as a fact about how `workflow_run` works, not a defect in
this change.

What this environment *can* do, and did: a deterministic, standalone
simulation of the exact job-level `if:` expression added to all three
workflows, reproducing GitHub Actions' own case-insensitive `==`
string-comparison semantics, run for every meaningful
`(event_name, workflow_run.conclusion)` combination:

```
PASS  event_name=workflow_dispatch conclusion=undefined  -> runs=true   (expected true)  — manual override — must always run
PASS  event_name=workflow_run      conclusion=success    -> runs=true   (expected true)  — CI passed — must deploy
PASS  event_name=workflow_run      conclusion=failure    -> runs=false  (expected false) — CI failed — must NOT deploy (the gate this phase adds)
PASS  event_name=workflow_run      conclusion=cancelled  -> runs=false  (expected false) — CI cancelled — must NOT deploy
PASS  event_name=workflow_run      conclusion=skipped    -> runs=false  (expected false) — CI skipped — must NOT deploy
PASS  event_name=workflow_run      conclusion=timed_out  -> runs=false  (expected false) — CI timed out — must NOT deploy
```

The case that matters most for "failure sensitivity" specifically —
`workflow_run` / `conclusion=failure` → `runs=false` — is directly
proven here: a failing `CI` run does not satisfy either side of the
`||`, so the deploy job's `if:` evaluates false and the job (and every
step in it, including the actual `firebase-tools deploy`/Play Store
upload) never runs. This is the exact defect Finding 3 named — a push
that fails CI could previously still deploy to production — closed by
construction, verified by direct simulation of the governing
expression rather than by observing a live run this environment cannot
trigger.

## 7. Scope verification

```
$ git status --porcelain
 M .github/workflows/deploy-firebase-hosting.yml
 M .github/workflows/deploy-functions.yml
 M .github/workflows/release-play-store.yml

$ git diff --stat
 .github/workflows/deploy-firebase-hosting.yml | 13 ++++++---
 .github/workflows/deploy-functions.yml        | 39 ++++++++++++++++++++++-----
 .github/workflows/release-play-store.yml      | 19 ++++++++-----
 3 files changed, 53 insertions(+), 18 deletions(-)

$ git diff --stat -- docs/qa-test-script.md
(no output)

$ git diff --stat -- src/ functions/src/ firestore.rules package.json \
    package-lock.json functions/package.json functions/package-lock.json \
    .github/workflows/ci.yml .github/workflows/firestore-rules-tests.yml
(no output)
```

Exactly the three authorized workflow files were changed. No
application code, no Firestore rule, no dependency manifest or
lockfile, no unrelated CI workflow (`ci.yml`,
`firestore-rules-tests.yml`), and no documentation file was touched.

`origin/main` was fetched and confirmed unchanged (`ce536bc` — the same
commit on record since Phase 6A-R1); this branch's HEAD is confirmed
not an ancestor of `main`.

## 8. Hard-stop assessment

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was found or introduced — this remediation is
  strictly additive (a new gating condition on three deploy jobs that
  previously had none).
- No production behavior, Firestore rule, application code, or
  dependency changed outside authorization (§3, §7).
- No unrelated CI modernization occurred (§3).
- The unresolved GitHub-side boundaries (§9) were encountered exactly
  as expected from prior phases and are documented, not attempted to be
  resolved.
- No evidence contradicts this document's own claims — every check in
  §5 was run directly against the final state, and §6's simulation is
  fully reproducible from the committed `if:` expression text itself.

## 9. Environment-dependent boundaries — encountered, documented, not resolved

Per the authorization's explicit instruction to document these if
encountered, not attempt to resolve them:

1. **GitHub branch-protection configuration on `main`.** Still
   unverifiable from this environment — no tool available in this
   session can inspect it (re-confirmed; consistent with every prior
   phase back to `PHASE_6B_CLOSURE.md` §4). This remediation's gate
   operates entirely within workflow logic and does not depend on
   branch protection to function — but branch protection is still the
   deciding factor in whether a push can bypass `ci.yml` *from
   landing on `main` at all*, a distinct question this gate does not
   answer (see `PHASE_6D_RECONNAISSANCE.md` §3).
2. **GitHub Environment protection.** Not used by this remediation at
   all — Option C was chosen specifically because it does not depend on
   an Environment's protection rules existing (Option B's own limitation,
   named in `PHASE_6D_RECONNAISSANCE.md` §5).
3. **Live GitHub Actions execution of these three updated workflows.**
   Not observable from here — both for the general network-restriction
   reason established since Phase 6C-1, and for the `workflow_run`-
   specific reason in §6 (the trigger only activates once the file
   version reaches `main`).
4. **GitHub Secrets.** Unaffected and unexamined — this remediation
   adds no new secret requirement; every secret reference
   (`FIREBASE_SERVICE_ACCOUNT`, `GOOGLE_SERVICES_JSON`,
   `BASE64_KEYSTORE`/`SHAMS_UPLOAD_KEYSTORE`, etc.) is unchanged.

## 10. Deliverable / commit discipline

The only changes made under this authorization:

- `.github/workflows/deploy-functions.yml` (§2)
- `.github/workflows/deploy-firebase-hosting.yml` (§2)
- `.github/workflows/release-play-store.yml` (§2)
- `docs/audit/PHASE_6D_1_REMEDIATION.md` (this document)

No other file is touched. This authorization does not perform or claim
a Review Gate or a Closure Gate — both remain separate, not-yet-issued
authorizations. This document does not claim this remediation
establishes a staging environment or production readiness — it closes
one specific, disclosed control gap (deploy workflows independent of
CI) within the single-production-project architecture that Finding 3's
broader question (Options A/B/D) still leaves open for a separate
owner decision.

---

## Status

**PHASE 6D-1 IMPLEMENTATION: COMPLETE, pending independent review.**

| Layer | Status |
|---|---|
| Phase 6D reconnaissance | ✅ Complete (`1556e1c`) |
| 6D-1 implementation | ✅ Complete (this document) |
| 6D-1 regression evidence | ✅ Recorded (this document, §5–§6) |
| 6D-1 Review Gate | 🔲 Not yet authorized |
| 6D-1 Closure | 🔲 Not yet authorized |
| Options A/B/D (Finding 3's broader question) | 🔲 Not decided — untouched by this remediation |
| Findings 4–7 | ⛔ Not addressed |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for the 6D-1 Review Gate.
