# Phase 6D — Reconnaissance: Finding 3 (No Staging Firebase Project)

Read-only reconnaissance on **Finding 3** from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / originally `docs/audit/PHASE_6B_CLOSURE.md` §2: *"No staging
Firebase project — single project id (`shams-app-4d0e7`) for
everything."* Baseline: `7a89df1`. **No repository file is modified by
this document.** It exists to establish exact, current evidence before
any remediation is scoped or authorized — consistent with the
reconnaissance-before-implementation discipline every prior finding in
this chain has followed.

## 1. The current deployment architecture — confirmed, in full

### 1.1 One Firebase project, referenced everywhere

```
$ cat .firebaserc
{ "projects": { "default": "shams-app-4d0e7" } }
```

`firebase.json` (production config) hardcodes `"projectId":
"shams-app-4d0e7"` directly, in addition to the `.firebaserc` alias.
`firebase.predeploy.json` (a manually-maintained production-readiness
checklist file, discussed further in §4) also hardcodes the same
project id. `firebase.test.json`/`firebase-emulator.json` declare
emulator ports only — no project id, no distinct environment. There is
no second project id anywhere in the repository.

### 1.2 Every deploy workflow targets production directly from `main`, with no gate in between

| Workflow | Trigger | Target | Gate before deploying |
|---|---|---|---|
| `deploy-functions.yml` | `push: branches: [main]` (paths: `functions/**`, `src/astrology/**`) or `workflow_dispatch` | `--project shams-app-4d0e7 --force` | None — build, then deploy, then a post-deploy health check (does not block the deploy itself, only reports afterward) |
| `deploy-firebase-hosting.yml` | `push: branches: [main]` (paths: `hosting/**`, `firebase.json`) or `workflow_dispatch` | `projectId: shams-app-4d0e7`, `channelId: live` (the production hosting channel, not a preview channel) | None |
| `release-play-store.yml` | `push: branches: [main]` (paths: `android/**`, `src/**`, `package.json`, `package-lock.json`) or `workflow_dispatch` | Play Store `internal` track by default on a plain push; `production` requires an explicit manual `workflow_dispatch` input | The Play Store track choice itself is a gate for the *public listing*, but the build still runs and uploads to Google Play's `internal` track automatically on every matching push — re-confirmed unchanged from Phase 6B/6C-1's own findings |

None of the three deploy workflows carries a GitHub `environment:` key
— confirmed by direct search:

```
$ grep -n "environment:" .github/workflows/*.yml
(no output)
```

No workflow's deploy job depends on `ci.yml` (the test/lint/typecheck
workflow) via `needs:` or a `workflow_run` trigger — `ci.yml` and the
three deploy workflows are independent, parallel workflows that happen
to share the same `push: branches: [main]` trigger. Whether a push that
fails `ci.yml` can also fire a successful deploy therefore depends
entirely on whether the push could land on `main` at all — which in
turn depends on GitHub branch-protection configuration this
environment cannot inspect (see §3).

### 1.3 No staging or develop branch exists

```
$ git branch -a
* claude/shams-phase-0-baseline-lnlmy6
  main
  remotes/origin/claude/shams-phase-0-baseline-lnlmy6
  remotes/origin/main
```

Only `main` and this audit's own working branch exist. There is no
`develop`, `staging`, or similarly-named branch, and no workflow
references one.

## 2. A pre-existing, adjacent document-vs-reality inconsistency, found while establishing this evidence

Not part of Finding 3's own definition, but directly relevant to it and
newly surfaced by this reconnaissance:

`docs/qa-test-script.md` (last touched 2026-08-25, per `git log
--follow` — current, not stale) opens with:

```
**Build type:** Release APK (staging Firebase project)
```

This QA process is written **assuming a staging Firebase project
exists** to test against. No such project is configured anywhere in
this repository (§1.1) — either the staging project was provisioned
once outside this repository and later abandoned/consolidated, was
always aspirational and never actually built, or QA has in practice
been run against the single production project despite this document's
own header. This repository's contents cannot distinguish between
those possibilities. This is disclosed here as evidence relevant to
Finding 3's remediation options (§5) — not addressed, not corrected,
not treated as its own separate finding.

A second, much older and clearly stale reference exists in
`docs/COMPLETE_SECURITY_STRATEGY_WITH_FIREBASE.md` (dated April 25,
2026 in its own header; describes a "Firestore + PostgreSQL Database"
architecture that does not match this repository's actual, current
Firestore-only design) — a single checklist bullet, "Test migration in
staging first," under a Supabase-migration risk-mitigation section.
Given the document's own age and its description of an architecture
this repository does not have, this reference is assessed as an early
planning artifact, not a current statement of intent, and is not
weighed further.

## 3. The GitHub-side boundary this finding's real risk depends on

Finding 3's practical severity hinges on a question this environment
has been unable to answer at every phase of this audit: **can a push
land directly on `main` without `ci.yml` passing first?** If branch
protection on `main` requires a pull request and requires `ci.yml`'s
checks to pass before merge, then in practice nothing reaches `main` —
and therefore nothing triggers a deploy workflow — without tests,
typecheck, and lint already having passed, which meaningfully narrows
(without eliminating) the risk a missing staging environment creates.
If no such protection exists, a direct push with failing tests could
deploy straight to production functions, hosting, and the Play Store
`internal` track simultaneously.

This is the same GitHub branch-protection/required-status-check
boundary named in `docs/audit/PHASE_6B_CLOSURE.md` §4 and carried
forward, unresolved, through `PHASE_6C_1_CLOSURE.md` §3 and
`PHASE_6C_2_CLOSURE.md` §4. No tool available in this session (checked
directly against this session's attached GitHub MCP tool surface — no
branch-protection-reading method exists among them) or any prior
session in this audit chain can inspect it. **This reconnaissance does
not resolve it and does not represent it as resolved.** It is restated
here because Finding 3's own severity cannot be assessed independently
of it — a missing staging environment matters more or less depending on
exactly this unknown.

## 4. `firebase.predeploy.json` — an adjacent, self-disclosed checklist found during this reconnaissance, not part of Finding 3

While reading every Firebase project-configuration file for §1.1, this
reconnaissance read `firebase.predeploy.json` in full. It is a
manually-maintained, self-reported production-launch checklist (dated
`2026-05-03` in its own `lastUpdated` field), **not** enforced by any
script, CI step, or deploy workflow — confirmed by `grep -rn
"firebase.predeploy" .github/`, which returns no matches; nothing reads
or validates this file automatically. Several of its own `manualChecks`
booleans are recorded `false`: `apiKeyRestrictedToAndroidAndRequiredApis`,
`firebaseBillingVerified`, `appCheckEnabledInFirebaseConsole`,
`functionsSecretsProvisioned`, `googlePlayServiceAccountConfigured`,
`razorpayWebhookRegistered`, `certificatePinsCaptured` — and one
`repoChecks` boolean, `certificatePinningFailClosedEnabled`, is also
`false`, with an accompanying note stating this is intentional
("fail-closed pinning is intentionally disabled until real SPKI pins
are captured").

**This is disclosed for the record, not investigated further, and not
treated as part of Finding 3.** It is a pre-existing, self-documented,
dated checklist — not a defect this reconnaissance discovered live —
and every one of its `false` items describes a Firebase/GCP/Play
Console *console setting* or a *physical certificate-capture step*,
none of which this repository's contents, and none of which this
sandboxed environment's network access, can verify or act on. Whether
these checklist items reflect the *current* state of the live Firebase
project is exactly as unknowable from here as the live-deployment-state
boundary already established in `PHASE_6B_REVIEW.md` §5.2. If the user
wants this checklist itself investigated, that is a separate,
not-yet-scoped candidate — raised here only because it was encountered
while gathering Finding 3's own evidence, per this audit's established
practice of surfacing adjacent observations without expanding the
authorized scope to cover them.

## 5. What a real remediation would require — options, not a recommendation, not an implementation

Unlike Findings 1 and 2, this finding does not have a single "smallest
defensible code change." Laid out here as evidence for whichever
remediation authorization is issued next — **none of this is
implemented or recommended as a default by this reconnaissance**:

### Option A — a genuine second Firebase/GCP project

Requires provisioning a real second Firebase project (its own Firestore
instance, Cloud Functions deployment, Auth tenant, App Check
configuration, Play Console sandbox wiring, Razorpay test-mode keys,
and its own GitHub Secrets for CI to authenticate against it) — an
infrastructure and billing decision requiring Firebase/GCP console
access and owner authorization, **not achievable through a code change
in this repository, and not something this sandboxed environment has
the credentials or network access to provision or verify.** This is the
only option that gives QA (per `docs/qa-test-script.md`'s own stated
assumption, §2) something real to test against before production.

### Option B — narrower, code-only mitigation: gate the existing deploy workflows behind a GitHub Environment

Add an `environment: production` key to each of the three deploy jobs
(`deploy-functions.yml`, `deploy-firebase-hosting.yml`,
`release-play-store.yml`). This is a real code change this repository
could make on its own. **Its actual effect depends entirely on whether
a GitHub Environment named `production` exists with protection rules
(required reviewers, a wait timer) configured on the repository's
GitHub settings** — configuration this environment cannot create,
inspect, or verify (the same branch-protection-class boundary as §3).
Adding the YAML key alone, with no Environment protection rules
configured to back it, would add no actual gate — a risk any future
implementation authorization for this option would need to account for
explicitly, and a live-state fact only the user (with GitHub repository
admin access) can confirm or set up.

### Option C — require `ci.yml` to pass before a deploy workflow runs, independent of a staging project

Restructure the deploy workflows to trigger on `workflow_run` keyed to
`ci.yml`'s completion (checking `github.event.workflow_run.conclusion
== 'success'`) instead of independently on `push`. This narrows (but
does not eliminate — a passing `ci.yml` is not a live-traffic staging
test) the risk of a broken deploy reaching production, is fully
achievable as a repository-only code change, and does not require a
second Firebase project. It does not address QA's own stated need
(§2) for a real environment to manually test against before release.

### Option D — accept the current architecture as an explicit, owner-made decision

Formally document that a single-project architecture is intentional at
this project's current scale (small team, `internal`-track-first Play
Store releases already acting as a soft staging gate for the mobile
client specifically), correct `docs/qa-test-script.md`'s stale header
to stop assuming a staging project that does not exist, and close this
finding without infrastructure change. This is the option every prior
phase's own framing has anticipated as plausible — `PHASE_6B_CLOSURE.md`
§6 named it explicitly: *"An explicit owner decision on... whether a
staging Firebase project is warranted for this project's current
scale."*

**This reconnaissance takes no position on which option is correct.**
That choice sits with the project owner; it is a cost/architecture
trade-off, not a security defect with one obvious fix the way Findings
1 and 2 were.

## 6. Hard-stop determination

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was found. The absence of a staging
  environment is an architectural/process risk (already classified P2
  in `PHASE_6B_RECONNAISSANCE.md` and re-confirmed accurate at the 6B
  review), not a live exploit path.
- The `firebase.predeploy.json` checklist (§4) is pre-existing,
  self-disclosed, dated documentation — not a newly discovered live
  defect — and does not itself demonstrate any exploited or currently
  exploitable state.
- The `docs/qa-test-script.md` inconsistency (§2) is a documentation
  accuracy issue, not a security or data-integrity defect.
- Nothing in this reconnaissance required stopping before completion —
  the full scope (Finding 3's evidence, the boundary it depends on,
  and the remediation option space) was gathered without interruption.

## 7. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this reconnaissance is written against: `7a89df1` (the
  6C-2 Closure).
- Working tree: clean before and after this document — confirmed via
  `git status --porcelain` at the start of this reconnaissance and
  immediately before this document was written.
- No production, test, Firestore-rule, CI-workflow, or
  deployment-configuration file is touched — the only file this phase
  adds is this document.
- No implementation occurred. No remediation choice among §5's four
  options was made or recommended as a default.

---

## Status

**PHASE 6D RECONNAISSANCE (Finding 3): COMPLETE.**

| Layer | Status |
|---|---|
| Phase 6C-2 | ✅ CLOSED (`7a89df1`) |
| 6D reconnaissance (Finding 3) | ✅ Complete (this document) |
| 6D implementation | 🔲 Not yet authorized — requires an owner decision among §5's options first |
| 6D Review / Closure | 🔲 Not applicable until implementation is scoped |
| Findings 4–7 | ⛔ Untouched |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization naming which of §5's
options (or another the owner prefers) to implement — or a decision to
close Finding 3 under Option D without further code change.
