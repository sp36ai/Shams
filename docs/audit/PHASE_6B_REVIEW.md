# Phase 6B — Independent Review Gate

Independent verification of `docs/audit/PHASE_6B_RECONNAISSANCE.md`
(`d484e7d`), per the separately issued Phase 6B Review Gate
Authorization. No production code, test, Firestore rule, deployment
configuration, dependency, or payment file was modified. No remediation
was performed or authorized. `git status --porcelain` is empty at the
start and end of this review.

## 1. Baseline

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: the reconnaissance at `d484e7d`.
- Working tree: clean throughout.

## 2. Independent methodology

Every finding was re-traced from source directly — commands re-run
fresh, not copied from the reconnaissance's own output — and, where the
reconnaissance's own environment could not verify something (§14 of that
document), this review attempted the verification independently rather
than accepting the "not verified" status by default. One such attempt
succeeded (§5.1, the real `firestore.rules.test.ts` suite was actually
executed); one did not (§13, live deployed-state reachability), and is
reported as attempted-and-failed, not silently left unconfirmed.

## 3. Finding-by-finding assessment

| # | Finding | Assessment | Notes |
|---|---|---|---|
| 1 | `firestore.rules.test.ts` never executed in CI | **PASS** | Confirmed exactly (§5.1) — and independently strengthened: the real suite was actually run against a live emulator this review, 26/26 passing |
| 2 | Rate limiting missing on 5 callables | **PASS** | Confirmed exactly, fresh grep, 0 matches in all 4 files (§6) |
| 3 | No staging Firebase project | **PASS** | Confirmed exactly; one caveat added (§7) |
| 4 | App-root audit: 1 critical + 11 high, build-tooling only | **PASS** | Confirmed exactly, and reachability claim independently strengthened with the actual dependency chain (§8) |
| 5 | `functions/` audit: 12 moderate, in the runtime tree | **MODIFIED** | Count confirmed exactly, but reachability is narrower than stated — see §9 |
| 6 | App Check readiness at 2 of 7 client sites | **PASS** | Confirmed exactly, all 7 call sites independently re-enumerated (§10) |
| 7 | `setAdminClaim`/`inferProfile` bypass shared Zod pattern | **MODIFIED** | Understated — a third callable (`classifyQuestion.ts`) has the same characteristic; see §11 |
| 8 | Temporary 50/50 quota limits, revert pending | **PASS** | Confirmed exactly, and the previously-unchecked client/server mirror-consistency question is now resolved: consistent, no drift (§12) |
| 9 | Sentry referenced but not integrated | **PASS** | Confirmed exactly (§12) |
| 10 | `measure()` has no try/finally | **PASS** | Confirmed exactly, full file re-read (§12) |
| 11 | `verifyAuth()`/`setAdminClaim` style inconsistency | **PASS** | Confirmed exactly (§12) |

**No finding was rejected.** Two were modified — both refinements that
add precision, neither reverses the original classification, and
neither escalates severity.

## 4. No P0/P1 or hard-stop found on independent re-examination

Every finding was checked against this review's own explicit instruction
to look for anything meeting a P0/P1 or hard-stop threshold "despite the
reconnaissance classification." None does:

- No finding grants unauthorized access, mutates another user's data, or
  bypasses an authentication/App Check/entitlement boundary — every one
  is a gap in a secondary control (rate limiting, CI test execution,
  input-validation consistency, environment separation, dependency
  hygiene, monitoring completeness), not a broken primary one.
- The two MODIFIED findings (§5, §11 in the table above) both refine
  toward **lower**, not higher, practical severity once traced more
  precisely (§9, §11 below) — neither approaches a hard-stop threshold.
- No new finding was discovered that the reconnaissance missed entirely.

## 5. Independent verification of previously not-verified items

### 5.1 Current execution status of the Firestore rules tests

**Resolved — successfully executed, not merely re-read.** This review
installed `firebase-tools` (network-fetched via `npx`, nothing added to
`package.json`/lockfiles) and ran the actual command the repository's own
`test:rules` script specifies:

```
npx firebase-tools@13 emulators:exec --config firebase.test.json \
  --only firestore --project shams-app-4d0e7 \
  "npx jest firestore.rules.test.ts --testEnvironment node --runInBand"
```

Result: **`PASS ./firestore.rules.test.ts` — 26/26 tests passing**,
covering `/users`, `/quotas`, `/readings`, `/rateLimits`, `/auditLogs`,
and the catch-all deny, against a real Firestore emulator loaded with
the actual committed `firestore.rules`. `git status --porcelain` was
confirmed empty immediately after (no artifact left behind).

This closes the reconnaissance's own explicit gap and adds an important
clarification the reconnaissance could not make: **Finding 1 (the CI gap)
is confirmed accurate, but the underlying rules themselves are not
currently broken** — the risk this finding describes is specifically
about a *future* regression going uncaught, not a present one.

### 5.2 Live deployment state

**Attempted, not resolved — network-restricted, not silently skipped.**
This review attempted a genuinely low-risk, read-only, unauthenticated
request to the actual deployed health endpoint
(`https://asia-south1-shams-app-4d0e7.cloudfunctions.net/health`, the
same URL `deploy-functions.yml`'s own post-deploy check curls). The
request failed at the network layer (`curl: (56) CONNECT tunnel failed,
response 403` — this review environment's own egress proxy does not
allow this host). **Still not verified**, for the same reason the
reconnaissance itself stated, now confirmed by an actual attempt rather
than assumed.

### 5.3 GitHub secrets and branch protection

**Still not verified.** No GitHub API access or credentials are
available in this review's environment. Confirmed by attempting to
locate any tooling that could answer this (`gh` CLI, a GitHub MCP
integration) — none is available in this session. Repository-visible
evidence remains as the reconnaissance stated: no `environment:` key
appears in any workflow file (re-confirmed by fresh grep, §7), meaning
if a GitHub Environment protection rule exists it is not referenced by
these workflows — but branch-protection rules on `main` itself
(required reviewers, required status checks) are a separate GitHub
setting this review still cannot inspect.

### 5.4 Deployment targeting

**Resolved by direct re-read, matches the reconnaissance exactly.**
`deploy-functions.yml` targets `--project shams-app-4d0e7` on every push
to `main` touching `functions/**`/`src/astrology/**`, no approval gate
in the workflow file. `release-play-store.yml` targets the `internal`
Play Store track by default for a push trigger
(`tracks: ${{ github.event.inputs.track || 'internal' }}`, re-confirmed
by direct grep) — production requires an explicit manual
`workflow_dispatch`. Both re-confirmed character-for-character against
the live file, not restated from memory.

### 5.5 App Check enforcement/readiness

**Resolved — re-traced in full, table independently rebuilt.** All 11
`onCall` exports were re-grepped fresh for `enforceAppCheck` — same 11
matches, same conditional (`process.env.FUNCTIONS_EMULATOR !== 'true'`)
in every one. All 7 client-side `httpsCallable()` call sites were
independently re-enumerated (one, `useQuota.ts`, required a second,
more careful grep since its call is chained across two lines and did not
match a naive `httpsCallable(` search on the first pass — corrected
within this review, not left as a false negative). Result: the same 2-
of-7 count the reconnaissance reported (`watchOracle.ts`,
`oracleDiscussion.ts`), independently rebuilt from scratch rather than
copied.

### 5.6 Dependency reachability

**Resolved, with new precision added.** For the app-root critical/high
findings: `npm ls @expo/plist` traced the exact chain —
`@react-native-voice/voice` → `@expo/config-plugins` → `@expo/plist` —
confirming this is an Expo *config-plugin* dependency (native-project
generation tooling, invoked during `expo prebuild`/native config
generation, not at runtime by the shipped app or by any server code).
Reachability claim **confirmed accurate**.

For the `functions/` moderate findings: `npm ls @google-cloud/storage`
traced the chain — `firebase-admin` → `@google-cloud/storage` (v7.22.0)
— confirming this dependency IS always loaded as part of the Cloud
Functions runtime (via `firebase-admin`, not optional). **However**,
this review additionally checked whether the application's own code
ever calls the Cloud Storage API at all: `grep -rln "getStorage|
@google-cloud/storage|firebase-admin/storage" functions/src/` returns
**zero matches**. The vulnerable code (in `teeny-request`/`retry-request`,
`@google-cloud/storage`'s own HTTP-request helpers) is loaded into the
process but never invoked by any code path this application actually
exercises — narrower reachability than the reconnaissance's own "in the
actual deployed runtime tree" framing implied. See §9 for the resulting
severity refinement.

## 6. Verification of the reconnaissance's own scope discipline

`git show --stat d484e7d` and `git diff --stat b884452..d484e7d`
independently confirm the reconnaissance commit touched exactly one
file — `docs/audit/PHASE_6B_RECONNAISSANCE.md`, 522 insertions, nothing
else. No production, test, rule, deployment, or dependency file was
modified by the reconnaissance itself.

## 7. Finding 3 detail — no staging environment

Re-confirmed: `.firebaserc` names exactly one project alias ("default" →
`shams-app-4d0e7`); `firebase.json` and `firebase.predeploy.json` both
hardcode the same `projectId`; `firebase.test.json`/`firebase-emulator.json`
declare emulator ports only, no distinct project id. `grep -rn
"^\s*environment:" .github/workflows/` returns zero matches — no
workflow references a GitHub Environment. **Caveat, stated by the
reconnaissance and reconfirmed here, not newly discovered**: this does
not rule out a branch-protection rule on `main` configured outside any
workflow YAML (§5.3) — this review's assessment is that the finding is
accurate for what workflow-level gating exists, while GitHub-repository-
setting-level gating remains genuinely unverifiable from this
environment.

## 8. Finding 4 detail — app-root dependency audit

`npm audit --omit=dev` re-run fresh in the app root: **33 vulnerabilities
(1 critical, 11 high, 20 moderate, 1 low)** — exact match to the
reconnaissance's reported figures, not merely a plausible re-statement.
Reachability independently re-derived (§5.6): confirmed build-tooling
only.

## 9. Finding 5 detail — functions/ dependency audit, severity refined

`npm audit --omit=dev` re-run fresh in `functions/`: **12 moderate**,
exact match. The reconnaissance characterized this as being "in the
actual deployed runtime dependency tree," which is true in the sense
that the vulnerable packages are always loaded (§5.6) — but this review's
additional check (no application code path ever calls the Cloud Storage
API) means the *practical* reachability is closer to the app-root
finding's own shape (loaded, not exercised) than the reconnaissance's
phrasing suggested. **Assessment: MODIFIED, not REJECTED** — the finding
itself (12 moderate advisories exist in the Functions dependency tree)
is accurate and unchanged; its severity framing is refined from
"deployed runtime tree" (implying live exposure) to "loaded but never
exercised by this application's own code" (a materially lower practical
risk, though still worth the same P3 remediation recommendation the
reconnaissance already gave it).

## 10. Finding 6 detail — App Check readiness table, independently rebuilt

| Call site | Callable | Awaits `ensureAppCheckReady()`? | Independently confirmed |
|---|---|---|---|
| `src/firebase/watchOracle.ts` | `askWatchOracle` | yes | ✓ |
| `src/firebase/oracleDiscussion.ts` | `discussReading` | yes | ✓ |
| `src/firebase/account.ts` | `deleteAccount` | no | ✓ |
| `src/firebase/trial.ts` | `activateTrial` | no | ✓ |
| `src/hooks/useQuota.ts` | `getQuota` | no | ✓ (required a corrected grep — the call is chained across two lines) |
| `src/hooks/usePurchase.ts` | `verifyGooglePlayPurchase` | no | ✓ |
| `src/screens/OnboardingScreen.tsx` | `inferProfile` | no | ✓ |

Exact match to the reconnaissance's own table.

## 11. Finding 7 detail — a third callable also bypasses the shared Zod pattern

`classifyQuestion.ts` — not named in the reconnaissance's Finding 7 —
was independently found to have the same characteristic:
`const inputData = request.data as { text?: unknown } | null;` followed
by a manual `typeof inputData?.text === 'string'` check and a
`.slice(0, 1000)` bound, structurally identical in shape to
`admin.ts`'s and `inferProfile.ts`'s own manual-validation pattern, not
the shared `parse()`/Zod schema every other input-taking callable uses.

**This is an understatement in the original reconnaissance, corrected
here — not a new defect.** Severity is unchanged (P3): `classifyQuestion`
has its own manual bounds (not zero validation), and — independently
re-confirmed this review, fresh grep — remains unreferenced by any
client code (`grep -rln "classifyQuestion" src/` still returns only the
unrelated deterministic KP-keyword matcher file), so it carries the same
"dead code, no live exploitation path" mitigating factor 6A-F1 already
established for this same callable under a different finding (P5A-2).
`account.ts`, `activateTrial.ts`, `quota.ts`, and `health.ts` were also
checked and correctly excluded from this finding — each takes no
meaningful request-body fields at all (confirmed: called with `{}` or no
arguments client-side), so there is nothing for a schema to validate.

## 12. Findings 8–11 — confirmed without modification

- **Finding 8** (temporary 50/50 limits): `functions/src/config.ts:18-19`
  re-read, values and comment match exactly. **New this review**:
  `src/stores/quotaStore.ts:30-31` independently checked and found
  currently consistent (`FREE_DAILY_LIMIT = 50`, `TRIAL_DAILY_LIMIT =
  50`) — the reconnaissance's own §14 listed this mirror-check as
  unverified; this review resolves it: no drift exists today.
- **Finding 9** (Sentry): `grep -n "sentry" package.json` (case-insensitive)
  and `grep -rn "Sentry\." src/` both re-run fresh, zero matches beyond
  the two comment lines in `logger.ts` already cited.
- **Finding 10** (`measure()`): full file re-read
  (`functions/src/middleware/telemetry.ts`, 20 lines) — confirmed no
  `try`/`catch`/`finally` of any kind around `await fn()`.
- **Finding 11** (auth style): `admin.ts` lines 26-27 re-read, confirmed
  the manual `if (!request.auth || request.auth.token.admin !== true)`
  check, distinct from but equivalent in effect to `verifyAuth()`.

## 13. Residual / accepted boundaries — restated, not resolved by this review

- The Razorpay `notes.userId` payer-binding boundary (6A-F1/6A-R1) —
  untouched by this review, correctly not reopened or re-litigated.
- Live deployed-state comparison (§5.2) — attempted, network-blocked,
  remains open.
- GitHub secrets/branch-protection configuration (§5.3) — remains
  unverifiable from any environment this review or the original
  reconnaissance had access to.
- `FUNCTIONS_EMULATOR` deployment-environment guarantees — a platform/
  deployment question, not answerable from repository contents; not
  re-attempted differently by this review.
- The financial/cost magnitude of the missing-rate-limit findings (§2 of
  the original reconnaissance's severity table) — this review confirmed
  the code-level gap exists (§6) but did not attempt to quantify
  production traffic cost impact, which would require live metrics this
  environment does not have.

## 14. Hard-stop determination

**No hard-stop condition was triggered by this independent review.**
Every finding was re-traced to exact source, confirmed accurate (9 of
11 exactly, 2 of 11 with a precision refinement that lowers rather than
raises practical severity), and none crosses into unauthorized access,
cross-user mutation, an authentication/App Check bypass, unauthorized
entitlement mutation, secret exposure, an Admin SDK trust-boundary
failure, unauthorized privileged behavior, or a demonstrated
security-relevant deployed-vs-source divergence. This review ran to
completion across its full authorized scope.

## 15. Exact remediation recommendations (restated from the reconnaissance, not expanded)

In the same priority order the reconnaissance itself proposed, with this
review's own confirmation that none is authorized by either document:

1. Wire the real `firestore.rules.test.ts` suite into
   `firestore-rules-tests.yml` (replacing or supplementing the current
   syntax-only check) — the highest-priority recommendation, since this
   review's own §5.1 confirms the real suite runs cleanly today and
   would be simple to wire in as-is.
2. Apply `enforceRateLimit()` to `syncReadings`, `deleteReading`,
   `activateTrial`, `getQuota`, `setAdminClaim` — `syncReadings`/
   `deleteReading` first, as the highest-cost two.
3. Scope dependency remediation separately for the app-root
   (`@expo/plist`/`xmldom`) and `functions/` (`@google-cloud/storage`'s
   transitive chain) advisories — neither is urgent given the
   reachability findings in §5.6/§9, but both are real and addressable.
4. Extend the `ensureAppCheckReady()` guard to the remaining 5 client
   call sites (§10).
5. Bring `admin.ts`, `inferProfile.ts`, and `classifyQuestion.ts` (§11,
   corrected count) onto the shared `parse()`/Zod pattern for
   consistency, though none currently has zero validation.
6. An explicit owner decision on the temporary 50/50 quota limits and on
   whether a staging Firebase project is warranted for this project's
   scale.

**None of these is authorized by this review.** Each would require its
own narrowly scoped authorization, exactly as every prior phase in this
project's audit trail has required.

## 16. Final disposition

**PHASE 6B REVIEW GATE: ✅ PASS.**

All 11 findings from the Phase 6B reconnaissance were independently
re-traced to exact source and confirmed genuine, with two precision
refinements (both lowering, not raising, practical severity) and zero
rejections. Two previously not-verified items were newly resolved this
review (the real Firestore rules suite was actually executed and
passes; the client/server quota-limit mirror was checked and found
consistent). Two remain genuinely unverifiable from any environment
available (live deployed-state comparison, attempted and network-
blocked; GitHub secrets/branch-protection configuration). No P0/P1 or
hard-stop condition was found on independent re-examination.

**No remediation was authorized or performed by this review.** This is
a review-gate PASS for the `d484e7d` reconnaissance checkpoint only. It
does not create a Phase 6B closure document, does not authorize Phase
6C, and does not constitute or imply a production-readiness claim. Per
the governing sequence, the next step is a separately authorized 6B
closure record.
