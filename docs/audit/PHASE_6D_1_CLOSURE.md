# Phase 6D-1 — Formal Closure

This document formally closes Phase 6D-1, the targeted remediation of
Finding 3 (Option C) established in `docs/audit/PHASE_6D_RECONNAISSANCE.md`
and originally recorded in `docs/audit/PHASE_6B_CLOSURE.md` §2 /
`docs/audit/PHASE_6C_1_CLOSURE.md` §6. It records no new evidence and
makes no production-code, test, Firestore-rule, or deployment-
configuration change — it exists solely to give the 6D-1 chain the
same explicit closure record every completed chain in this project's
audit trail already has. It is the only file this closure adds.

## 1. Chain history

| Step | Commit | Outcome |
|---|---|---|
| 6D reconnaissance (Finding 3) | `1556e1c` | Confirmed the single-project architecture and that all three deploy workflows (`deploy-functions.yml`, `deploy-firebase-hosting.yml`, `release-play-store.yml`) triggered independently on `push: branches: [main]`, with no dependency on `ci.yml` and no `environment:` gate. Laid out four remediation options (A: real second Firebase/GCP project; B: GitHub Environment gate; C: CI-dependent deploy trigger; D: accept the single-project architecture as an owner decision) without recommending a default. |
| 6D-1 implementation (Option C) | `d1dead2` | All three deploy workflows switched from `push` to `workflow_run` keyed to `ci.yml`'s completion (`workflows: ['CI']`, `types: [completed]`, `branches: [main]`), `workflow_dispatch` preserved as a manual override. Each job gained `if: github.event_name == 'workflow_dispatch' \|\| github.event.workflow_run.conclusion == 'success'`. Each checkout pinned to `workflow_run.head_sha` (falling back to `github.sha` for manual dispatch), so the exact commit CI validated is what deploys. Disclosed, not worked around: `workflow_run` has no `paths` filter, so the prior path-scoping was necessarily dropped — each deploy step is idempotent, so the cost is wasted CI minutes on an unrelated push, not incorrect behavior. Full regression matrix clean (unaffected, as expected — no application code touched). |
| 6D-1 independent review | `5c1f226` | **PASS.** All three files re-parsed programmatically (not read as prose) and confirmed structurally identical in trigger/job/checkout shape. A freshly written, broader failure-sensitivity simulation (12 cases, beyond the implementation's own 6) confirmed the gate blocks on every non-success `conclusion` and allows manual dispatch and CI success. One deliberately adversarial case — whether the `if:` condition alone could be tricked by a hypothetical event supplying a forged `workflow_run.conclusion` — was traced through and confirmed not reachable: the `on:` trigger declaration (only `workflow_run`/`workflow_dispatch` subscribed) is the actual, sufficient defense. Full regression/scope matrix independently re-run and matched exactly. No hard-stop found. |

This closure ratifies both checkpoints — `d1dead2` (implementation) and
`5c1f226` (independent review) — exactly as authorized. It performs no
re-verification of its own; it consolidates what those two documents
already established.

## 2. What is ratified

- **The CI-dependent deployment gate.** All three production deploy
  workflows now require `ci.yml`'s own successful completion (or a
  deliberate manual `workflow_dispatch`) before any deploy step runs.
  A push that fails lint, typecheck, or tests can no longer reach
  production functions, hosting, or the Play Store `internal` track —
  closed by construction, independently verified by two separate,
  differently-written failure-sensitivity simulations (one at
  implementation, a broader one at review) rather than by observing a
  live run this environment cannot trigger.
- **Exact-commit deployment.** Each deploy job checks out
  `workflow_run.head_sha` — the precise commit CI validated — rather
  than whatever `main` resolves to when the job happens to start,
  closing the race the implementation identified between CI finishing
  and the deploy job beginning.
- **The `on:`/`if:` design as a whole**, not merely the `if:` condition
  in isolation — the independent review's own adversarial probe (§1,
  6D-1 independent review row) confirmed the two layers work together
  correctly: no event type these workflows still subscribe to can ever
  populate `workflow_run.conclusion` without the event genuinely being
  a `workflow_run` completion.
- **No production-readiness claim.** This closure states only that the
  specific deploy-workflow gating gap named in Finding 3 / Option C has
  been remediated and independently verified. It does not assert the
  application is production-ready in any operational or business
  sense, and it does not resolve Finding 3's broader architectural
  question (§4).

## 3. The disclosed `workflow_run` path-filter limitation — carried forward, not silently absorbed

**This is not a resolved limitation. It is an explicitly disclosed,
unchanged trade-off, carried forward by this closure exactly as both
prior documents recorded it:**

GitHub Actions' `workflow_run` trigger has no `paths` key. The three
deploy workflows previously scoped themselves to specific path changes
(`functions/**`/`src/astrology/**` for Cloud Functions;
`hosting/**`/`firebase.json` for Hosting; `android/**`/`src/**`/
`package.json`/`package-lock.json` for the Play Store release) — that
scoping is necessarily gone. All three workflows now evaluate on every
successful `ci.yml` completion on `main`, regardless of what changed.

This was a deliberate, disclosed choice, not an oversight: reproducing
path-scoping under `workflow_run` would require additional tooling (a
diff-based skip step or a marketplace paths-filtering action) that the
governing authorization's "minimum necessary change" and "no unrelated
CI modernization" instructions explicitly excluded. Its practical
impact was assessed, at both implementation and independent review, as
low — every affected deploy step (`firebase-tools deploy --force`, the
Hosting deploy, the Play Store AAB build/upload) is idempotent, so an
unnecessary run on an unrelated change redeploys identical output
rather than doing anything incorrect. The cost is wasted CI minutes,
not a correctness or security regression.

If this cost becomes a real operational concern, narrowing the trigger
back down (e.g. a path-comparison step inside the job, gated on
`git diff` between `workflow_run.head_sha` and its parent) is a
separate, small follow-up — not authorized, not scoped, and not
attempted by this phase.

## 4. What remains explicitly unresolved — carried forward, not silently closed

- **Finding 3's broader architectural question** (Options A: a real
  second Firebase/GCP project, B: a GitHub Environment gate, D: an
  explicit owner decision to keep one project) remains entirely open.
  This closure resolves only Option C — the narrow, repository-level
  deployment-gating weakness. Whether a genuine staging environment is
  ever warranted for this project's scale is unchanged by this phase,
  exactly as `docs/audit/PHASE_6D_RECONNAISSANCE.md` §5 laid it out.
- **`docs/qa-test-script.md`'s stale staging-project assumption**
  (`PHASE_6D_RECONNAISSANCE.md` §2) remains uncorrected — explicitly
  excluded from this authorization's scope, left for a separate
  documentation task if one is authorized.
- **Live GitHub Actions execution of the three updated workflows.**
  Still not observable from this environment — both for the general
  network-restriction reason established since Phase 6C-1, and because
  `workflow_run` triggers activate using the workflow file version
  present on the repository's *default branch*, which this content has
  not yet reached. Neither the implementation nor the review attempted
  to work around this; both instead independently simulated the
  governing `if:` expression's logic directly.
- **GitHub branch-protection / required-status-check configuration on
  `main`.** No tool available in any environment this audit chain has
  had access to can inspect it. This remediation's gate does not
  depend on branch protection to function, but branch protection is
  still the deciding factor in whether an untested push can land on
  `main` at all in the first place — a distinct question this gate
  does not answer, restated exactly as `PHASE_6D_RECONNAISSANCE.md` §3
  and every prior closure back to `PHASE_6B_CLOSURE.md` §4 left it.
- **GitHub Environment protection and GitHub Secrets.** Unaffected and
  unexamined by this phase — Option C was chosen specifically to avoid
  depending on Environment protection rules; no secret requirement was
  added or changed.

Every one of these boundaries is identical in kind to those named in
`docs/audit/PHASE_6B_CLOSURE.md` §4 and remains exactly as unresolved
after this closure as it was before Phase 6D-1 began.

## 5. Regression evidence at the reviewed checkpoint (`5c1f226`, restated from the review, not re-run by this closure since no code changed since that review)

| Check | Result |
|---|---|
| YAML validity (all 3 workflow files) | valid, independently re-parsed programmatically |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** |
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **543/543**, 26 files |
| `cd functions && npm run verify-engine-sync` | clean — `functions/src/engine/` matches `src/astrology/` |
| Failure-sensitivity simulation (implementation, 6 cases) | all correct |
| Failure-sensitivity simulation (independent review, 12 cases, including the adversarial probe) | all correct |
| Prohibited-path diff (`1556e1c..d1dead2`: `src/`, `functions/src/`, `firestore.rules`, dependency manifests/lockfiles, `ci.yml`, `firestore-rules-tests.yml`, `docs/qa-test-script.md`, `firebase.json`, `.firebaserc`) | **empty** |
| `main` | untouched (`ce536bc`, confirmed not an ancestor relationship reversed) |

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this closure is written against: `5c1f226` (the 6D-1
  Independent Review Gate PASS).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, or deployment-configuration file
  is touched by this closure — the only file this phase adds is this
  document.
- No Phase 5, 6A, 6B, 6C-1, 6C-2, or 6D reconnaissance document is
  created or modified by this closure.
- No `PHASE_6D_2_*` or Finding-4-through-7 file is created by this
  closure.

## 7. Findings 4–7 and further Phase 6 work

- **Findings 4–7** remain open, unaddressed by this closure. Each is a
  separately scoped candidate for its own future reconnaissance →
  implementation → review → closure chain, exactly as Findings 1, 2,
  and 3/Option C were.
- **No further Phase 6 work has begun.** This closure does not scope,
  begin, or authorize any subsequent Finding-4-through-7 work, any
  further Finding 3 work (Options A/B/D), or any other Phase 6 activity.
- **This closure does not declare the application production-ready.**
  It closes the specific deployment-gating remediation and review
  chain authorized against Finding 3 / Option C. The boundaries in §3
  and §4 remain explicitly open, carried forward for whichever future,
  separately authorized work addresses them.

---

## Status

**PHASE 6D-1: CLOSED.**

| Layer | Status |
|---|---|
| Phase 5 | ✅ CLOSED |
| 6A | ✅ CLOSED |
| 6B | ✅ CLOSED |
| 6C-1 | ✅ CLOSED |
| 6C-2 | ✅ CLOSED |
| 6D reconnaissance | ✅ Complete (`1556e1c`) |
| 6D-1 implementation | ✅ Complete (`d1dead2`) |
| 6D-1 Review | ✅ PASS (`5c1f226`) |
| 6D-1 Closure | ✅ CLOSED (this document) |
| Finding 3 (Options A/B/D) | 🔲 Undecided — untouched by this closure |
| Findings 4–7 | ⛔ Untouched |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for the next Phase 6 step.
