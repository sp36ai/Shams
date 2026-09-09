# Phase 7C — Final Production-Readiness Decision

Baseline: `3fa6fc9` (the Phase 7B Independent Review Gate PASS). This
document answers the single question this phase exists to answer —
**is the repository, as it exists today, actually ready for
production?** — by distinguishing three separate states that Phase 7A
and 7B kept conflated in casual reference: the hardened branch, `main`,
and what is actually deployed. **No merge or deployment is authorized
by this document.** Nothing beyond this document is added; no code,
test, workflow, or dependency file is touched.

## 0. The three states, defined precisely

| State | Identifier | What it is |
|---|---|---|
| **Hardened branch** | `3fa6fc9` (`claude/shams-phase-0-baseline-lnlmy6`) | This entire audit's own work — Phases 5 through 7B, 83 commits ahead of `main`, 0 behind. Never merged. |
| **`main`** | `ce536bc` | The separate, earlier `claude/shams-audit-framework-yz73bg` effort's work (PR #88/#92), merged 2026-09-06. Does not contain any of this session's Phase 6A–6D hardening. |
| **Deployed production** | Cloud Functions: `ce536bc`. Hosting/Play Store: older, path-filtered. | What Firebase/Play Store are actually running right now, independently confirmed this phase (§4) rather than assumed. |

## 1. Final disposition of every open/residual risk

| Item | Status on hardened branch (`3fa6fc9`) | Status on `main` (`ce536bc`) | Status as deployed |
|---|---|---|---|
| Finding 1 — Firestore rules CI enforcement | ✅ Fixed (6C-1) | ❌ Not present | ❌ N/A (CI-only; irrelevant to runtime, but the gate itself isn't live on `main`'s CI) |
| Finding 2 — rate limiting on 4 callables | ✅ Fixed (6C-2) | ❌ Not present | ❌ **Not enforced in production today** |
| Finding 3 — single-project deploy architecture | ⚠️ Option C (CI-dependent deploy gate) implemented (6D-1); **Options A/B undecided, explicitly held by owner** | ❌ Not present | ❌ N/A — Option C has never gone live (see §1a) |
| Finding 4 — app dependency audit | ✅ Closed, no code change warranted (6D-2) | N/A — different dependency state, not separately audited | N/A |
| Finding 5 — functions dependency audit | ✅ Closed, no code change warranted (6D-3) | N/A — not separately audited | N/A |
| Finding 6 — App Check readiness (5 of 7 client sites) | ✅ Fixed (6D-4) | ❌ Not present | ❌ **The 5-site gap is live in production today** |
| Finding 7 — Zod validation bypass (3 manual casts) | ✅ Closed, per-instance characterization, no code change (6D-5) | ❌ Not present (the 3 manual casts are unaddressed either way) | ❌ Present in production, same as both branches (no code change was ever proposed) |
| Backup/DR | ⛔ Unresolved — policy written, never enabled or drilled, GCP-access-blocked in every session that has touched this repository | ⛔ Same — this is `main`'s own unresolved item, inherited unchanged | ⛔ Same — this is an infrastructure-configuration gap, not a code gap; it exists identically regardless of which commit is deployed |
| Legacy `askOracle` endpoint | ✅ Resolved — deleted outright (`18232d7`) | ✅ Resolved, already on `main` | ✅ Resolved — confirmed absent from the deployed Cloud Functions set (not exported in `functions/src/index.ts` at `ce536bc`, independently re-confirmed at 7A/7B) |

**1a. Why Finding 3 Option C has never gone live, restated precisely
for this decision**: `6D-1`'s `workflow_run` deploy-gate change lives
only on the hardened branch. GitHub Actions resolves a `workflow_run`
trigger using the workflow file version on the repository's **default
branch** (`main`), not the triggering branch. Since the hardened branch
has never merged, `main`'s deploy workflows are still on the older
`push`-triggered version — confirmed directly this phase: the most
recent `Deploy Cloud Functions` run (`id 34034026579`, on `ce536bc`)
fired on `event: "push"`, not `workflow_run`. **Option C's protection
does not exist in the running system today, regardless of how sound
the code sitting unmerged on the hardened branch is.**

## 2. Does Finding 3 (Options A/B) require an owner decision before production?

**No — not as an absolute blocker, but its absence is a real,
disclosed gap that changes what "ready" can mean.** Options A/B
concern whether staging deployments should run against an isolated
second Firebase project (A) or a GitHub Environment approval gate (B)
— both address a different failure mode than Option C: A/B protect
against a *bad deploy of otherwise-correct code* reaching production
without a review checkpoint; Option C (once actually live) protects
against *deploying code that never passed CI*. The two are
complementary, not redundant, and this audit chain has only built the
second. Given the owner's explicit "Hold — no decision now," this
document does not decide A/B and does not treat their absence as a
hard blocker on its own — but a verdict of unqualified READY would
misrepresent this repository's actual deploy-safety posture, since
neither the CI-gate (Option C, unmerged and therefore inert) nor a
staging/approval gate (A/B, undecided) is functioning in the live
system today. This is folded into §8's verdict as an accepted risk,
not a hard stop.

## 3. Must the hardened branch be merged before any readiness declaration?

**Yes, for any declaration beyond "the hardened branch itself is
internally sound."** The evidence in §1 is unambiguous: three of the
seven original Phase 6B findings (1, 2, 6) are actively unfixed in
both `main` and the deployed system, and Finding 3's Option C exists
only as inert code on an unmerged branch. **No production-readiness
verdict for the system the app's users actually interact with can be
positive while this gap stands.** A declaration of readiness for the
*hardened branch as a design* is a different, narrower claim than a
declaration of readiness for *this application as currently running*
— this document keeps that distinction explicit throughout and refuses
to let a PASS on the former stand in for the latter.

## 4. Can deployment of the exact reviewed commit be verified?

**Partially — and more precisely than Phase 7A/7B could establish**,
using GitHub Actions tooling not exercised in this audit chain until
this phase:

- **Cloud Functions**: ✅ **Verified.** The most recent successful
  `Deploy Cloud Functions` run (`run #50`, id `34034026579`,
  `conclusion: success`) executed against `head_sha: ce536bc`
  (2026-09-06 12:44:53 UTC) — **the exact current tip of `main`**,
  confirmed by direct commit-hash comparison. Production Cloud
  Functions are running exactly `main`'s code, not the hardened
  branch's, and not anything older.
- **Firebase Hosting**: ⚠️ **Stale relative to `main`'s tip, by
  design.** The most recent `Deploy Firebase Hosting` run succeeded
  against `7df767f` (PR #91) — several commits behind `ce536bc`. This
  workflow was not re-triggered by later commits because none of them
  touched the `hosting/` path it watches (`docs/qa-test-script.md`,
  `functions/`, and app-source-only changes since #91 don't touch
  static hosting content) — consistent with intended path-filtered
  behavior, not a broken pipeline. Not a residual risk in itself, but
  recorded rather than assumed.
- **Play Store release**: ⚠️ **Also behind `ce536bc`,** last successful
  run at `b9c8f943f` — one commit before `main`'s tip, itself a
  no-op trigger commit added to retry after a Play API outage. The
  mobile binary reflects the app-source state as of that commit; the
  gap to `ce536bc` is a `functions/`-only "force redeploy" commit with
  no client-side change, so no app-binary drift is implied.
- **The hardened branch itself (`3fa6fc9`)**: ❌ **Confirmed never
  deployed anywhere.** No workflow run in this repository's Actions
  history targets `claude/shams-phase-0-baseline-lnlmy6` as its
  `head_branch` for any of the three deploy workflows.
- **Firestore rules / security rules deployment**: ⛔ Not independently
  verifiable — no Actions workflow deploys `firestore.rules`
  automatically in this repository (deployment is manual per
  `firebase.predeploy.json`'s own checklist, confirmed at 7A); whether
  the rules file actually live in the Firestore backend matches the
  repository's committed `firestore.rules` cannot be checked from here.

**Net finding**: production Cloud Functions are confirmed running
exactly `main`'s code — meaning every gap in §1's "Status on `main`"
column is a live, present gap in the running backend today, not a
theoretical one contingent on some unknown deployed version.

## 5. Treatment of the unresolved Backup/DR capability

**Unchanged, unresolved, and correctly treated as out of this
document's power to close.** Every session in this audit chain,
including this one, has been GCP-console-access-blocked from enabling
or drilling backups. This is recorded as a **residual risk**, not
downgraded to N/A and not silently escalated to a hard stop — it was
already true before this audit chain began, is orthogonal to which
commit is deployed (an infrastructure/console configuration matter,
not a code defect), and does not change based on anything decided in
this document. It remains a manual action for the owner, tracked in
`MANUAL_ACTIONS_REQUIRED.md` on `main` since the prior audit and
unaddressed since.

## 6. Treatment of GitHub branch-protection / Environment-protection boundaries

**Branch protection remains not independently verifiable** — re-confirmed
this phase: no tool in this session's GitHub surface reads branch
protection rules or required-status-check configuration (the newly
available `actions_list`/`actions_get`/`get_commit`/`list_commits`
tools used in §4 read workflow run history, not repository protection
settings). **This phase does add one genuinely new, verified
capability beyond 7A/7B**: real GitHub Actions run history, which
resolved §4's deployment-verification question from "environment-
blocked, Not Verified" to a direct commit-hash-level confirmation for
Cloud Functions. Branch protection itself, and any GitHub Environment
approval-gate configuration relevant to Finding 3 Option B, remain
labeled **Not Verified** — this document does not convert that
silence into a PASS.

## 7. Final security and regression evidence

Restated from the independently-reproduced figures at `a2e716d`
(7A) and re-confirmed unchanged at `3fa6fc9` (7B, `git diff --stat
a2e716d` empty) — not re-run a third time by this decision-only phase,
since no code has changed since 7B's own fresh execution:

| Check | Result |
|---|---|
| RKP golden corpus | 111/111, byte-identical on regeneration |
| RKP replay-check | 24/24, no nondeterminism |
| Adversarial harness | 11,923/11,923 generated & executed; 0 false negatives, 0 false positives, 0 exceptions, 0 contract mutations |
| Firestore rules test suite | 26/26 |
| App: typecheck / lint / tests | clean / clean / 306/306 |
| Functions: typecheck / lint / tests | clean / clean / 543/543 |
| Engine mirror sync | clean |
| App Check coverage (server) | 11/11 `onCall` exports enforce |
| App Check coverage (client, hardened branch only) | 7/7 sites gated |
| App Check coverage (client, `main`/deployed) | **2/7 sites gated — 5 remain unguarded in production today** |
| Rate limiting (hardened branch only) | applied to all 11 callables |
| Rate limiting (`main`/deployed) | **not applied to `syncReadings`, `deleteReading`, `getQuota`, `activateTrial`, `setAdminClaim` in production today** |

This table is the sharpest illustration of why §3's conclusion holds:
every regression figure the hardened branch earns is real and
independently reproduced, but none of it describes the system
currently serving users.

## 8. Hard-stop determination for this phase

**No new hard-stop condition was discovered by this phase.** Every gap
named in §1 was already known, dated, and disclosed by Phases 6A–7B —
this document synthesizes and re-confirms deployment state, it does
not surface a new P0/P1. The one genuinely new fact this phase
establishes (§4 — Cloud Functions deployed exactly at `ce536bc`) makes
several already-known gaps *concretely current* rather than
theoretical, which is why it belongs in this decision rather than
triggering its own separate hard-stop protocol.

## 9. Final verdict

Answered separately for each of the three states, because a single
undifferentiated verdict would misrepresent at least two of them:

| State | Verdict |
|---|---|
| **As currently deployed** (Cloud Functions at `ce536bc`, i.e. `main`) | ❌ **NOT READY.** Findings 1, 2, and 6 are live, unmitigated gaps in the running production backend today (no CI-enforced Firestore rules gate, no rate limiting on 5 callables, App Check readiness unguarded on 5 of 7 client call sites) — not theoretical, independently confirmed present in the exact deployed commit. Backup/DR remains undrilled. |
| **`main` as a codebase** (`ce536bc`, independent of what's deployed) | ❌ **NOT READY**, for the identical reason — it is what's deployed. |
| **The hardened branch** (`3fa6fc9`), *if and only if merged, deployed, and re-verified post-merge* | ⚠️ **READY WITH ACCEPTED RISKS** — contingent on three explicit owner acceptances this document does not make on its own: (a) accept Backup/DR as a disclosed, undrilled residual risk rather than a blocker; (b) accept Finding 3 Option C alone (once actually live via merge) as sufficient deploy protection, without Options A/B; (c) accept GitHub branch-protection/Environment-protection state as unverifiable from this environment rather than blocking on it. Absent those three explicit acceptances, the hardened branch's own honest status is **NOT READY** either — a well-tested, well-reviewed set of fixes that has itself never been deployed or run against production traffic is not the same claim as a production-ready system. |

**No merge or deployment is authorized by this document.** If the
owner wishes to move toward the "READY WITH ACCEPTED RISKS" state for
the hardened branch, that requires: (1) a separate, explicit merge
authorization; (2) the three risk-acceptances named above stated
explicitly, not inferred; (3) a fresh, post-merge re-verification of
§4's deployment-state check (confirming Cloud Functions actually
redeploy to the merged commit, not just that CI goes green) before any
final sign-off — this document does not presume that redeploy would
succeed or would fire automatically merely because `main`'s deploy
workflows are `push`-triggered as of today.

## 10. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this decision is written against: `3fa6fc9` (Phase 7B
  Independent Review Gate PASS).
- Working tree: clean before and after this document; `git diff --stat
  3fa6fc9` empty except for this document's own addition.
- No production, test, Firestore-rule, CI-workflow, or dependency file
  is touched — the only file this phase adds is this document.
- No merge to `main` was performed. No deployment was triggered or
  requested by this phase.

---

## Status

**PHASE 7C: FINAL PRODUCTION-READINESS DECISION — COMPLETE.**

| Layer | Status |
|---|---|
| Phase 5 – 6D-5 | ✅ CLOSED (hardened branch only) |
| Phase 7A Reconnaissance | ✅ Complete (`a2e716d`) |
| Phase 7B Independent Review | ✅ PASS (`3fa6fc9`) |
| Phase 7C Final Decision | ✅ Complete (this document) |
| **Deployed production** | ❌ **NOT READY** |
| **`main`** | ❌ **NOT READY** |
| **Hardened branch, unmerged** | ⚠️ **READY WITH ACCEPTED RISKS, contingent — not yet actually merged/deployed/accepted** |
| Finding 3 (Options A/B) | 🔲 Still undecided — not required to close this phase, but named as an accepted-risk condition for any future READY declaration |
| Merge to `main` | 🔲 Not authorized by this document |
| Deployment | 🔲 Not authorized by this document |

Awaiting a separate, explicit authorization for any next step —
merge, further Finding 3 work, Backup/DR remediation (still
GCP-access-blocked regardless), or closure of this audit chain as-is.
