# Phase 7A — Production-Readiness Reconnaissance

Read-only reconnaissance answering: *given everything closed through
Finding 7 / Phase 6D-5, is this repository actually ready for
production, and what evidence prevents us from saying so?* Baseline:
`332d405`. **No repository file is modified by this document.** Every
item below is classified **Verified**, **Not Verified**, **Not
Applicable**, or **Residual Risk** — no inaccessible GitHub/GCP state
is represented as a silent PASS.

## 0. The two headline facts this reconnaissance establishes before anything else

### 0.1 None of this session's Phase 5–6D-5 work has been merged or deployed

```
$ git fetch origin main --quiet && git log origin/main -1 --oneline
ce536bc Force Cloud Functions redeploy to verify mystical Oracle prompt deployment

$ git merge-base --is-ancestor HEAD origin/main
NO — this branch's work has NOT been merged to main

$ git rev-list --count origin/main..HEAD
81
$ git rev-list --count HEAD..origin/main
0
```

**81 commits — every remediation from Phase 5 (5A–5I), Phase 6A
(ownership/payment safety), 6B (infrastructure reconnaissance), 6C-1
(rules-test CI enforcement), 6C-2 (rate limiting on 5 callables), 6D-1
(deployment gating), 6D-2/6D-3/6D-5 (dependency and validation
findings, closed without code change), and 6D-4 (App Check readiness
on 5 client callables) — exist only on
`claude/shams-phase-0-baseline-lnlmy6`.** `main` has not moved since
before this entire audit chain began. Concretely, **production today
still runs**:

- **`syncReadings` without the cross-user ownership check** Phase
  6A-F1/6A-R1 fixed — the original defect this whole Phase 6 audit
  chain began from.
- **No rate limiting** on `syncReadings`, `deleteReading`,
  `activateTrial`, `getQuota`, `setAdminClaim` — Phase 6C-2's fix.
- **No client-side App Check readiness gate** on `deleteAccount`,
  `activateTrial`, `getQuota`, `verifyGooglePlayPurchase`,
  `inferProfile` — Phase 6D-4's fix (this one is a client-app change;
  it ships on the *next Play Store release* the client is rebuilt
  from, not merely on a Cloud Functions redeploy).
- **The old syntax-only Firestore rules CI check**, not the real
  26-assertion behavioral suite — Phase 6C-1's fix.
- **Deploy workflows still trigger on a bare push**, independent of
  whether CI passed — Phase 6D-1's fix.

This is not a hypothetical staging/production gap (Finding 3's own
subject) — it is that **the fixes this audit chain itself produced are
not live.** This is the single most important fact for any production-
readiness verdict and is stated here as **Residual Risk**, not folded
into any other area below.

### 0.2 A separate, earlier audit effort's work IS already live on `main`

`main` at `ce536bc` already contains real, substantial hardening from
a **different, earlier session** (dated 2026-08-23, branch
`claude/shams-audit-framework-yz73bg`, merged via PR #88, itself
built on PR #92's complete removal of the retired KP/astronomical
engine) — confirmed directly, not merely cited:

```
$ git show ce536bc:BACKUP_AND_DISASTER_RECOVERY.md   → exists on main
$ git show ce536bc:PRODUCTION_AUDIT_2026-08-23.md    → exists on main
$ git log ce536bc --oneline --diff-filter=D -- functions/src/functions/askOracle.ts
18232d7 Delete the retired KP/Astronomical judgment engine — completely, not just unwired (#92)
```

That prior audit (`PRODUCTION_AUDIT_2026-08-23.md`, 828 lines) closed
6 of its own 8 release-gate items in-session (account deletion, RKP
golden-value regression tests, payment-webhook idempotency, AI output
defense-in-depth via `runWatchNarrationSafetyValidator`, prompt-field
sanitization via `NameSchema`) and explicitly left 2 **OPEN**, by its
own honest accounting, because closing them needs GCP/production-
traffic access that session didn't have: **Backup/disaster recovery**
and **the legacy `askOracle` endpoint**.

**This reconnaissance independently re-checked both open items, not
merely re-cited them:**

- **Legacy `askOracle` — resolved, more thoroughly than that document
  hoped for.** It recommended checking live traffic before deleting.
  Instead, a later commit (`18232d7`, part of PR #92) deleted the file
  outright as part of removing the whole retired KP engine —
  confirmed via `git show ce536bc:functions/src/functions/askOracle.ts`
  returning nothing. The prior audit's own "OPEN" status for this item
  is now stale; this reconnaissance updates it: **RESOLVED (verified
  by deletion, not by traffic-count as originally planned)**.
- **Backup/disaster recovery — still genuinely open.**
  `BACKUP_AND_DISASTER_RECOVERY.md` (167 lines, already on `main`) is
  a complete, well-specified policy and runbook (RPO ≤24h/RTO ≤4h
  targets, exact `gcloud firestore backups schedules create` commands,
  a restore procedure, a quarterly-drill checklist) — but its own drill
  table reads *"(none yet — first drill still pending)"*, and its own
  header states *"No backup policy exists [as implemented]... enabling
  backups requires GCP project-owner/editor access... which the
  session that wrote this document does not have."* This environment
  has the identical access limitation — re-confirmed, not assumed:
  no `gcloud`/GCP credentials or console access exist in this session
  either. **Classified: Residual Risk, environment-blocked, unchanged
  since 2026-08-23.**

## 1. CI/CD deployment integrity after the `workflow_run` change

**Verified** (on this branch; **Not Verified live**, since it hasn't
reached `main` — see §0.1): all three deploy workflows
(`deploy-functions.yml`, `deploy-firebase-hosting.yml`,
`release-play-store.yml`) gate on `workflow_run` keyed to `ci.yml`'s
completion, re-confirmed present:

```
$ grep -A2 "^on:" .github/workflows/deploy-functions.yml
on:
  workflow_run:
    workflows: ['CI']
$ grep -n "^\s*if:" .github/workflows/deploy-functions.yml
40:    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
```

Identical in the other two files (`PHASE_6D_1_REVIEW.md` §4.2 already
independently confirmed this structurally). **Residual, disclosed
since Phase 6D-1**: `workflow_run` triggers activate using the
workflow file version on the repository's *default branch* — so this
gate, even once merged, only protects deploys that happen *after* the
merge; and a live GitHub Actions execution of any of these three
files remains **Not Verified** — this environment cannot trigger or
observe one.

## 2–3. Production deployment / Firebase-GCP configuration verifiable from the repository

**Verified** (structure): single Firebase project (`shams-app-4d0e7`)
throughout `firebase.json`/`.firebaserc`; Cloud Functions runtime
`nodejs22`; 4 secrets declared (`RAZORPAY_WEBHOOK_SECRET`,
`GOOGLE_PLAY_CLIENT_EMAIL`, `GOOGLE_PLAY_PRIVATE_KEY`,
`ANTHROPIC_API_KEY`) — unchanged since `PHASE_6D_RECONNAISSANCE.md`.

**Not Verified** (console-side state): `firebase.predeploy.json`
(also already on `main`, dated 2026-05-03, unenforced by any script —
re-confirmed via `grep -rn "firebase.predeploy" .github/` → no
matches) carries 7 `manualChecks` booleans still `false`:
`apiKeyRestrictedToAndroidAndRequiredApis`, `firebaseBillingVerified`,
`appCheckEnabledInFirebaseConsole`, `functionsSecretsProvisioned`,
`googlePlayServiceAccountConfigured`, `razorpayWebhookRegistered`,
`certificatePinsCaptured`. `MANUAL_ACTIONS_REQUIRED.md` (also already
on `main`) independently names the same category of gaps (API key
restriction, App Check console enablement, secret provisioning, Play
Console service account). **None of these can be confirmed true or
false from this environment** — every one requires Firebase/GCP/Play
Console access. Carried forward as **Not Verified**, exactly as every
prior phase back to `PHASE_6B_REVIEW.md` §5.2 has recorded this
boundary — not newly discovered, not resolved.

## 4. Authentication and App Check enforcement

**Verified**, re-run fresh: all 11 `onCall` exports still declare
`enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true'`
(`grep -rc "enforceAppCheck" functions/src/functions/*.ts
functions/src/functions/payments/*.ts` → 11 matches); all 7 real
client `httpsCallable` sites now import and call
`ensureAppCheckReady()` (2 occurrences each — import + call — in
every one of `watchOracle.ts`, `account.ts`, `trial.ts`,
`oracleDiscussion.ts`, `useQuota.ts`, `usePurchase.ts`,
`OnboardingScreen.tsx`), closing Finding 6. **On this branch only** —
see §0.1 for why "verified in the code" and "true in production" are
not the same claim right now.

## 5. Firestore rules and rules-test evidence

**Verified, executed fresh this pass**:

```
$ npx firebase-tools@15.29.0 emulators:exec --config firebase.test.json \
    --only firestore --project shams-app-4d0e7 \
    "npx jest firestore.rules.test.ts --testEnvironment node --runInBand"
Tests: 26 passed, 26 total
```

The deny-by-default rule structure (`firestore.rules`) is unchanged
since every prior phase's own confirmation. **Not Verified**: whether
`firestore.rules` as deployed in the live project matches this
repository's committed copy — no live project read access exists in
this environment.

## 6. Callable-function security boundaries

**Verified**, consolidated from this whole audit chain, not re-derived:
ownership checks (`syncReadings`/`deleteReading`, 6A-R1), rate limiting
(all 11 `onCall` exports, 6C-2), App Check (§4 above), input validation
(8 of 11 use the shared Zod `parse()` pattern; the remaining 3 —
`setAdminClaim`, `classifyQuestion`, `inferProfile` — use manual but
non-trivial validation, closed at Finding 7 with a per-instance risk
characterization rather than a code change). **On this branch only** —
see §0.1.

## 7. Entitlement/payment paths

**Verified** (code, unchanged since prior phases): Google Play
verification calls the real `androidpublisher` API
(`googlePlay.ts:220`), purchase tokens are hashed and deduplicated
(`purchaseTokens` collection), Razorpay webhooks are HMAC-verified and
now idempotent via `claimWebhookEvent()` (per the already-`main`-merged
`PRODUCTION_AUDIT_2026-08-23.md` §17 item 4 — independently
re-confirmed present: `grep -n "claimWebhookEvent"
functions/src/functions/payments/razorpay.ts` returns matches).
**Residual, disclosed since 6A-R1, unchanged**: `notes.userId` in a
Razorpay webhook is not cryptographically bound to a verified payer —
no order-creation endpoint exists in this codebase to bind against
(`PHASE_6A_R1_CLOSURE.md` §3). **Residual, disclosed since 6D-4,
unchanged**: a failed `verifyGooglePlayPurchase` on the
`purchaseUpdatedListener` path leaves no automatic retry
(`PHASE_6D_4_REVIEW.md` §6).

## 8. Dependency/security posture

**Verified**, closed at Findings 4 and 5 with corrected, per-chain
reachability characterizations (not blanket "build-tooling only")
rather than dependency upgrades — both closures explicitly point-in-
time, tied to specific facts (no iOS target, no Expo tooling invoked,
`uuid`'s vulnerable functions never called with the required
arguments). Not re-run fresh by this reconnaissance since no
dependency changed since those closures.

## 9. Observability, crash/error handling, telemetry

**Verified** (client): `ErrorBoundary` + Crashlytics wiring, already
on `main` per `PRODUCTION_AUDIT_2026-08-23.md` §16, re-confirmed
present in this branch's tree (`src/components/ErrorBoundary.tsx`).
**Verified** (server): `middleware/telemetry.ts`'s `measure()` logs
structured `perf:<name>` entries — **still lacks a `try`/`finally`**,
re-confirmed unchanged (this was Finding 10 in the original 6B
reconnaissance, a non-blocking observation never carried into the
Findings 1–7 remediation cycle, and correctly not touched by any of
this chain's work). **Residual, from the already-`main`-merged prior
audit, not independently re-verified this pass** (no code changed
here since 2026-08-23): no global unhandled-promise-rejection handler
in `src/` (`ErrorUtils.setGlobalHandler`), no proactive
offline/network-state detection (`@react-native-community/netinfo`
not a dependency), no client-side performance/UX telemetry layer.
Sentry is referenced only in comments — Crashlytics remains the sole
live error-monitoring tool, unchanged since Finding-set closure.

## 10. Backup/recovery and operational failure modes

**Residual Risk — confirmed still open**, per §0.2. This is the most
significant unresolved item this reconnaissance found: a complete,
well-written policy exists (`BACKUP_AND_DISASTER_RECOVERY.md`, already
on `main`), but Firestore backups are not enabled, no backup has ever
been confirmed to exist, and no restore has ever been drilled — by
that document's own record, not by inference. **Not achievable from
this or any prior session in this audit chain** — requires GCP
project-owner access no session has had.

## 11. GitHub Actions / environment / branch-protection evidence where accessible

**Not Verified — re-confirmed, not merely re-stated.** Re-checked this
session's own available GitHub MCP tool surface for a branch-
protection-reading method — none exists (`ToolSearch` for "branch
protection rules github repository settings" returns only
write/administrative tools: `create_branch`, `create_repository`,
`fork_repository`, `list_repository_collaborators`,
`update_pull_request_branch` — no read method for protection rules).
This is the same boundary named in every closure back to
`PHASE_6B_CLOSURE.md` §4, independently re-confirmed still true in
this session rather than assumed carried over.

## 12. Remaining environment-blocked verification boundaries — consolidated

Restated in one place, not scattered, per this reconnaissance's own
classification discipline:

1. Live GitHub Actions execution of any workflow in this repository.
2. GitHub branch-protection / required-status-check configuration.
3. GitHub Environment protection rules.
4. Firebase/GCP console state (`firebase.predeploy.json`'s 7 `false`
   manual checks; `MANUAL_ACTIONS_REQUIRED.md`'s equivalent items).
5. Firestore backup enablement and restore-drill execution (§10).
6. Whether the live, deployed `firestore.rules` matches this
   repository's committed copy.

None of these six is treated as PASS by this document. All six are
identical in kind to boundaries this audit chain has carried since
Phase 6B and none has become newly resolvable in this session.

## 13. Release/build configuration for Play Store

**Verified**, unchanged since `PHASE_6D_RECONNAISSANCE.md`: a plain
push to `main` (once merged — see §0.1) targets the Play Store
`internal` track by default; `production` requires an explicit manual
`workflow_dispatch`. Release signing (`android/app/build.gradle`)
fails the build outright if invoked without the real upload-keystore
secrets present — confirmed structurally unreachable-by-accident, not
re-derived fresh this pass since nothing in this area changed.

## 14. Hard-stop / P0 / P1 determination

**No hard-stop condition was found in this reconnaissance.** Checked
explicitly against the full 7-phase audit's own definition:

- Nothing discovered here is a *new* P0/P1 — every item in §0–§13 is
  either already-closed-but-unmerged work (§0.1), already-disclosed
  residual risk restated with re-confirmed evidence (§7, §9, §10), or
  an environment-access boundary unchanged since it was first named.
- **§0.1 deserves explicit acknowledgment as the closest thing to a
  standing risk this reconnaissance surfaces**: production is
  currently running *without* the ownership-check fix, the rate
  limiting, and the App Check readiness gate this same audit chain
  already diagnosed and fixed. This is not a new defect discovered by
  Phase 7A — it is the same, already-fully-documented set of fixes
  from Findings 1, 2, and 6, simply not yet shipped. Whether this
  itself should be treated as a hard-stop requiring immediate merge
  authorization, rather than a residual risk to record and hand to
  Phase 7B/7C, is a disposition question for the independent review
  and the final production-readiness decision — not something this
  reconnaissance resolves unilaterally.

## 15. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this reconnaissance is written against: `332d405`
  (the 6D-5 Closure / Finding 7 closure).
- Working tree: clean before and after this document — including
  after regenerating the golden corpus (§16) to prove it byte-
  identical, which produced no diff and required no revert.
- No production, test, Firestore-rule, CI-workflow, or deployment-
  configuration file is touched — the only file this phase adds is
  this document.
- No implementation occurred. Finding 3's Options A/B remain
  undecided, untouched by this reconnaissance.

## 16. RKP determinism regression matrix — re-run fresh at this checkpoint, for completeness

Not one of the 14 requested areas by name, but the load-bearing
evidence underneath §6/§8's "the engine itself is sound" claims this
whole audit chain has relied on since Phase 5 — re-executed here
rather than merely cited:

| Check | Result |
|---|---|
| `npx vite-node scripts/generate-golden-corpus.ts` (writes to the tracked `docs/audit/golden-corpus/`) | **111/111 cases regenerated byte-identical** — `git diff --stat` after running produced no output |
| `npx vite-node scripts/replay-check.ts` | **24/24 cases byte-identical** across two in-process invocations |
| `npx vite-node scripts/adversarial-harness/run.ts` (written to a scratch dir, not the tracked `docs/audit/phase-5c/`) | **11,923/11,923 cases, 0 false negatives, 0 false positives, 0 exceptions, 0 contract mutations** |
| `npm run typecheck`/`lint`/`test` (app root) | clean; **306/306** |
| `cd functions && npx tsc --noEmit`/`npm run lint`/`npx vitest run` | clean; **543/543** |
| `npm run verify-engine-sync` | clean |

Every figure matches this audit chain's own historical record exactly,
independently reproduced at the current checkpoint rather than carried
forward as an assumption.

---

## Status

**PHASE 7A RECONNAISSANCE: COMPLETE.**

| Layer | Status |
|---|---|
| Findings 1–7 | ✅ CLOSED (all, via 6C-1/6C-2/6D-1 Option C/6D-2/6D-3/6D-4/6D-5) |
| Finding 3 (Options A/B) | 🔲 Undecided — untouched |
| Phase 7A reconnaissance | ✅ Complete (this document) |
| Phase 7B Independent Review | 🔲 Not yet authorized |
| Phase 7C Closure / Production Decision | 🔲 Not applicable until 7B completes |
| Production readiness | ❌ Not established |

Headline evidence for whoever authorizes Phase 7B: **the code-level
work is real and independently verified at every step (§16), but the
single largest gap between "this audit chain closed everything" and
"this app is production-ready" is that none of it has been merged to
`main` or deployed (§0.1) — a fact this reconnaissance treats as the
most important residual risk in the whole document, not a footnote.**
Backup/disaster recovery (§10) is the second-largest, and is
identically blocked by the same GCP-access boundary every phase since
5D/6B has already named. Awaiting a separate, explicit authorization
for the Phase 7B Independent Review Gate.
