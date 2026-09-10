# Phase 8A-10 — Promotion: CI Artifact-Quota Remediation → `main`

Implements: "Promotion Authorization — checkpoint a48940f" — merge
`a699ff4` (retention-days fix) and `a48940f` (artifact-policy fix)
from `claude/shams-phase-0-baseline-lnlmy6` into `main`, then verify
the resulting `main` state.

## 1. What was done

```
$ git fetch origin main --quiet && git log origin/main -1 --oneline
61ddf4a Merge Phase 0-8A hardening chain (91 commits) into main   [unchanged, confirmed before merging]
$ git checkout -B main origin/main
$ git merge --no-ff claude/shams-phase-0-baseline-lnlmy6 -F <message>
Merge made by the 'ort' strategy.
$ git status --porcelain
                                                                    [empty — clean, no conflicts]
$ git push origin main:main
   61ddf4a..2229c5d  main -> main
```

**Merge commit: `2229c5de84fd2fdc9c68bbdca9617adc907211c9`**, parents
`61ddf4a` (prior `main` tip) and `a48940f` (the reviewed feature-branch
tip). Zero conflicts.

## 2. Diff scope

```
 .github/workflows/ci.yml                                  |  35 +++-
 docs/audit/PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md     | 198 ++++++++
 docs/audit/PHASE_8A_10_ARTIFACT_SIZING_FORENSICS.md        | 182 ++++++++
 docs/audit/PHASE_8A_10_CI_ARTIFACT_POLICY_CHANGE.md        | 144 ++++++
 docs/audit/PHASE_8A_10_POST_MERGE_VERIFICATION.md          | 219 +++++++++
 docs/audit/PHASE_8A_10_RETENTION_DAYS_CONFIG.md            | 127 ++++++
 docs/audit/PHASE_8A_8_MERGE.md                             | 152 ++++++
 docs/audit/PHASE_8A_9_POST_MERGE_VERIFICATION.md           | 142 +++++
 8 files changed, 1198 insertions(+), 1 deletion(-)
```

Exactly the commits made since the prior merge (`61ddf4a`): the two
`ci.yml` fixes plus the audit-trail documents recording the
investigation, sizing forensics, and both remediation commits. No
application code, dependency, Firebase rule, or deployment-workflow
file touched.

## 3. Verification performed before pushing

| Check | Result |
|---|---|
| `git status --porcelain` after merge | empty |
| `functions`: `tsc --noEmit` / `lint` | clean |
| `functions`: `vitest run` | **543/543** |
| `functions`: `verify-engine-sync` | clean |
| App: `typecheck` / `lint` | clean |
| App: `npm test -- --runInBand` | **306/306** |

Full regression matrix clean on the actual merged state, not inferred
from the pre-merge branch's own last-known-good figures.

## 4. Verification performed after pushing

```
$ git fetch origin main --quiet && git log origin/main -1 --oneline
2229c5d Merge CI artifact-quota remediation (2 commits) into main
$ git rev-parse origin/main
2229c5de84fd2fdc9c68bbdca9617adc907211c9        [matches the local merge commit exactly]
$ git merge-base --is-ancestor claude/shams-phase-0-baseline-lnlmy6 origin/main
YES — feature branch fully contained
$ git merge-base --is-ancestor 61ddf4a origin/main
YES — prior main state preserved as an ancestor, not overwritten
$ git show origin/main:.github/workflows/ci.yml | grep -n "upload_debug_apk\|retention-days"
[confirms both fixes present in ci.yml as read directly from origin/main, not the local working tree]
```

`origin/main` is confirmed to be exactly the pushed merge commit, with
both fixes verifiably present when read directly from `main`'s own
tree — not assumed from the local merge alone.

## 5. What this promotion does and does not establish

- **Does**: put the recurrence-prevention fix (`retention-days: 7`)
  and the root-cause fix (`app-debug-apk` opt-in only) onto `main` for
  the first time. Any future CI run on `main` will build and test
  exactly as before, but will no longer retain the debug APK on
  ordinary runs, and any artifact it does retain (Maestro results, or
  a manually-requested APK) is capped at 7 days.
- **Does not**: itself run CI, deploy anything, or confirm the
  existing artifact-storage quota exhaustion is actually resolved.
  Those are the separate, distinctly-authorized next steps (CI Rerun
  Authorization, per the standing two-step framing) — this document
  records the merge only.
- **Does not** relate to or depend on the artifact deletion the owner
  performed directly via the GitHub API (91 obsolete `app-debug-apk`
  artifacts, independently verified deleted in this same conversation)
  — that was account-side cleanup of already-existing artifacts,
  entirely separate from this code promotion.

## 6. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): now `2229c5d`, the merge commit described
  above — pushed as explicitly authorized.
- `claude/shams-phase-0-baseline-lnlmy6`: unchanged at `a48940f`
  through this merge action; this document is committed to it, adding
  one new commit. Working tree clean before and after this document.

---

## Status

**PHASE 8A-10 PROMOTION: COMPLETE.**

| Layer | Status |
|---|---|
| Merge to `main` | ✅ Complete — `2229c5d`, pushed, independently verified |
| Regression matrix on merged state | ✅ Clean (543/543 functions, 306/306 app) |
| `origin/main` state | ✅ Confirmed to match the pushed commit exactly, fixes present in `main`'s own tree |
| Existing artifact storage | ✅ Separately cleared by owner (91 artifacts, ~3.03 GiB), independently verified in this conversation |
| CI rerun | 🔲 Not authorized or attempted by this document — separate CI Rerun Authorization required |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting the separate, explicit CI Rerun Authorization before
triggering CI against this new `main` commit.
