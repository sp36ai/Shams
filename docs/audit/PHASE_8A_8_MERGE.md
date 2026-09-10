# Phase 8A-8 — Merge: Hardened Branch → `main`

Authorized action: "Phase 8A-8 Merge Authorization — baseline
e468f18." Scope, exactly as authorized: merge the hardened branch into
`main` exactly as reviewed at `docs/audit/PHASE_8A_7_REVIEW.md`, no
additional remediation/dependency/Firebase-rule/architectural change,
preserve the reviewed commit range, no production deployment
authorized by implication, stop and verify the resulting `main` state
before any deployment authorization.

## 1. What was done

```
$ git fetch origin main --quiet && git log origin/main -1 --oneline
ce536bc Force Cloud Functions redeploy...        [confirmed unchanged immediately before merging]
$ git checkout -B main origin/main
$ git merge --no-ff claude/shams-phase-0-baseline-lnlmy6 -F <message>
Merge made by the 'ort' strategy.
$ git status --porcelain
                                                   [empty — clean merge, no conflicts]
$ git push origin main:main
   ce536bc..61ddf4a  main -> main
```

**Merge commit: `61ddf4a913600c35ac66aae09fd5795a2537698b`**, parents
`ce536bc` (old `main`) and `e468f18` (the reviewed hardened-branch
tip). Zero conflicts, matching every conflict-risk assessment in
`PHASE_8A_RECONNAISSANCE.md` and `PHASE_8A_7_REVIEW.md` exactly.

## 2. Verification performed before pushing

| Check | Result |
|---|---|
| `git status --porcelain` after merge | empty |
| File-list identity: `ce536bc..e468f18` vs. `ce536bc..HEAD` (post-merge) | identical, byte-for-byte set of 355 files — no unexpected addition or omission |
| `functions`: `tsc --noEmit` / `lint` | clean |
| `functions`: `vitest run` | **543/543** |
| `functions`: `verify-engine-sync` | clean |
| App: `typecheck` / `lint` | clean |
| App: `npm test -- --runInBand` | **306/306** |

**Full regression matrix clean on the actual merged state**, not
inferred from the pre-merge branch's own last-known-good figures.

## 3. Verification performed after pushing

```
$ git fetch origin main --quiet && git log origin/main -1 --oneline
61ddf4a Merge Phase 0-8A hardening chain (91 commits) into main
$ git rev-parse origin/main
61ddf4a913600c35ac66aae09fd5795a2537698b            [matches the local merge commit exactly]
$ git merge-base --is-ancestor claude/shams-phase-0-baseline-lnlmy6 origin/main
YES — hardened branch fully contained
$ git merge-base --is-ancestor ce536bc origin/main
YES — prior main state preserved as an ancestor, not overwritten
```

`origin/main` is confirmed to be exactly the pushed merge commit — not
assumed from the push output alone.

## 4. Post-merge CI/deploy state — observed, not triggered or waited on

```
CI workflow (ci.yml), run #428, head_sha 61ddf4a: status "in_progress"
  (fired automatically on push — this is CI itself, not a deployment)

Deploy Cloud Functions (deploy-functions.yml), most recent run:
  run #50, head_sha ce536bc (the OLD commit) — unchanged since before this merge
```

**No deploy workflow has fired for the new merge commit as of this
writing.** This is expected, not a problem to fix: `main`'s own
`deploy-functions.yml` (and the other two deploy workflows) are, for
the first time, now the `workflow_run`-triggered version this audit
chain's own Finding 3 Option C (`6D-1`) built — they fire only after
the `CI` workflow completes successfully on `main`, not on `push`
directly. CI is still in progress at the time of this document. This
document does **not** wait for CI to complete, does **not** poll, and
does **not** trigger anything — per the authorization's own explicit
instruction to stop after the merge.

**One nuance worth stating plainly, not glossed over**: because
Option C's gate is now live and automatic by design (that is exactly
what it was built and reviewed to do), a Cloud Functions deployment
**may fire on its own once CI succeeds**, without any further manual
trigger — this is the intended behavior of already-reviewed
(`6D-1`) code, not a new action this document takes or a bypass of
"no deployment authorized by implication." The authorization's own
instruction not to authorize deployment by implication is honored at
the level of *this session's own actions*: nothing here triggers,
requests, or waits for a deploy. Whether the owner wants that
already-built automatic gate to fire on this occasion, or wants it
held back (e.g., by not letting CI complete, or by a manual
intervention outside this session's authority to decide), is exactly
the kind of question the "separate, explicit deployment authorization"
this authorization calls for should resolve — this document surfaces
the mechanism plainly rather than letting it act as a silent default.

## 5. What remains explicitly unresolved

- **Finding 3 (Options A/B)** remain recorded, undecided residual
  architectural decisions, exactly as the authorization specified —
  not resolved, not treated as having been silently closed by this
  merge.
- **No production-readiness verdict is issued by this document.**
  `docs/audit/PHASE_7C_FINAL_DECISION.md`'s verdicts for "deployed
  production" and "`main`" were both NOT READY, evaluated against the
  pre-merge state; this merge changes what `main` contains but a
  revised verdict requires its own separate assessment (a future
  8B-class phase), not an inference from the merge succeeding.
- **Whether Cloud Functions actually deploy this commit — and if so,
  whether that deployment succeeds — is not yet known** as of this
  document. §4's observation is a snapshot, not a final state. The
  same independent method `PHASE_7C_FINAL_DECISION.md` §4 used (query
  GitHub Actions run history, confirm the deployed `head_sha` matches)
  remains the correct way to check this later, separately.

## 6. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): now `61ddf4a`, the merge commit described
  above — pushed as explicitly authorized.
- `claude/shams-phase-0-baseline-lnlmy6`: unchanged at `e468f18`
  through this merge action; this document is committed to it, adding
  one new commit. Working tree clean before and after this document.
- No Firestore-rule, dependency, or additional CI/deploy-configuration
  file was touched beyond what the reviewed merge itself already
  contained — this document adds no further diff to either branch
  beyond itself.

---

## Status

**PHASE 8A-8 MERGE: COMPLETE.**

| Layer | Status |
|---|---|
| Phase 8A-7 Independent Review | ✅ PASS (`e468f18`) |
| Merge to `main` | ✅ Complete — `61ddf4a`, pushed, verified |
| Regression matrix on merged state | ✅ Clean (543/543 functions, 306/306 app) |
| `origin/main` state | ✅ Independently confirmed to match the pushed commit exactly |
| CI on the merge commit | 🔄 In progress at time of writing — not waited on |
| Cloud Functions deployment of the merge commit | 🔲 Not yet observed — Option C's automatic gate may fire once CI succeeds; not triggered or waited on by this document |
| Finding 3 (Options A/B) | 🔲 Still undecided — unaffected by this merge |
| Production readiness verdict | 🔲 Not reissued by this document — requires its own separate assessment |
| Further deployment action | 🔲 Not authorized by this document |

Awaiting a separate, explicit authorization for the next step —
including, when the owner is ready, checking the actual post-CI
deployment outcome and deciding whether a revised production-readiness
assessment should follow.
