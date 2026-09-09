# Phase 6C-2 — Independent Review Gate

Independent verification of `docs/audit/PHASE_6C_2_REMEDIATION.md`
(`9b189e0`), per the Phase 6C-2 Review Gate scope. **Review only — no
repository file was left modified by this review.** Two production
files' rate-limit calls were temporarily commented out as a controlled
mutation check (§4) and fully restored before this document was
written; `git status --porcelain` was confirmed clean before the first
command, immediately after the restoration, and again before this
document was committed. The one file this review adds is this document
itself.

## 1. Baseline

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: the 6C-2 remediation at `9b189e0`.
- Prior checkpoint: `76930fd` (Phase 6C-1 Closure).
- Working tree: clean throughout.

## 2. Independent methodology

Every claim in `PHASE_6C_2_REMEDIATION.md` was re-derived from source —
diffs re-read fresh, tests re-run independently, and a mutation check
performed across all five call sites at once (not copied from the
remediation document's own single-file mutation reasoning) — to prove
the new tests genuinely fail when rate limiting is removed, not merely
that they currently pass.

## 3. Requirement-by-requirement verdicts

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Independently retrace all 5 rate-limit integrations | **PASS** | §4.1 |
| 2 | Verify placement/order relative to auth, validation, admin authorization, mutations | **PASS** | §4.2 |
| 3 | Re-run the 14 new tests and full regression | **PASS** | §4.3 |
| 4 | Mutation checks prove tests fail if rate limiting is removed/bypassed | **PASS** | §4.4 |
| 5 | All 11 `onCall` exports remain protected | **PASS** | §4.5 |
| 6 | Findings 3–7 not accidentally touched | **PASS** | §4.6 |
| 7 | Prohibited paths, `main`, dependencies, rules, CI, deployment config unchanged | **PASS** | §4.6 |
| 8 | Live-deployment / branch-protection boundaries kept explicitly unresolved | **PASS** (correctly not claimed resolved — this remediation touches no deployment surface at all) | §4.7 |
| 9 | No remediation performed during review | **PASS** | §4.4 (mutation fully reverted, confirmed via clean diff) |

**No requirement failed. No hard-stop condition was found.**

## 4. Evidence detail

### 4.1 Independent retrace of all 5 integrations

`git diff --stat 76930fd..9b189e0` and a full `git diff` of the four
production files were re-read directly from the committed history, not
from the remediation document's quoted excerpts. Confirmed byte-for-byte
identical to what `PHASE_6C_2_REMEDIATION.md` §2 shows:

- `readings.ts`: one `import` line + one `await enforceRateLimit(userId)`
  in `syncReadings`, one in `deleteReading`.
- `quota.ts`: one `import` line + one `await enforceRateLimit(userId)`
  inside `getQuota`'s `measure()` callback.
- `activateTrial.ts`: one `import` line + one `await
  enforceRateLimit(userId)` inside `activateTrial`'s `measure()`
  callback.
- `admin.ts`: one `import` line + one `await
  enforceRateLimit(request.auth.uid)`, plus a two-line explanatory
  comment, after the pre-existing admin-authorization check.

No other line in any of the four files differs from the `76930fd`
baseline.

### 4.2 Placement/order verification

Independently traced execution order in each of the five call sites:

| Callable | Order confirmed |
|---|---|
| `syncReadings` | `verifyAuth` → `parse(SyncReadingsSchema, ...)` → `enforceRateLimit` → (`readings.length === 0` short-circuit) → `checkReadingOwnership` → batch writes. Rate limit runs before the ownership check and before any write. |
| `deleteReading` | `verifyAuth` → `parse(DeleteReadingSchema, ...)` → `enforceRateLimit` → `ref.get()` → ownership check → `ref.delete()`. Rate limit runs before any read or mutation. |
| `getQuota` | `verifyAuth` → (inside `measure()`) `enforceRateLimit` → `Promise.all([...get(), ...get()])` reads → (conditional) self-heal write. Rate limit runs before any Firestore access, including the read-only path. |
| `activateTrial` | `verifyAuth` → (inside `measure()`) `enforceRateLimit` → `db.runTransaction(...)` (read + conditional write). Rate limit runs before the transaction opens. |
| `setAdminClaim` | admin-authorization check (`request.auth.token.admin !== true`) → `enforceRateLimit(request.auth.uid)` → `request.data` extraction → `auth.getUser` → `auth.setCustomUserClaims`. Rate limit runs after authorization is confirmed and before any Auth read or write. |

This matches the codebase's own pre-existing convention exactly,
independently confirmed against the two callables that already combined
`verifyAuth`, `parse()`, and `measure()` before this phase began
(`askWatchOracle.ts`, `discussReading.ts`): `verifyAuth` → `parse()` →
`enforceRateLimit` where a parse step exists; `enforceRateLimit` at the
start of `measure()`'s callback where it doesn't. No integration
deviates from this pattern, and none places the rate-limit check after
a mutation.

### 4.3 Independent re-run of tests and full regression

```
$ npx vitest run src/functions/__tests__/readings.test.ts \
    src/functions/__tests__/quota.test.ts \
    src/functions/__tests__/activateTrial.test.ts \
    src/functions/__tests__/admin.test.ts
Test Files  4 passed (4)
     Tests  29 passed (29)
```

(19 in `readings.test.ts` + 3 + 3 + 4 = 29 — matches the remediation's
own count of 15 pre-existing + 14 new.)

Full regression matrix, re-run independently:

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **543/543**, 26 files |
| `cd functions && npm run verify-engine-sync` | `Check passed — functions/src/engine/ matches src/astrology/.` |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** |

Every figure matches `PHASE_6C_2_REMEDIATION.md` §3.3 exactly, each
independently re-run rather than accepted from the document.

### 4.4 Mutation check — all 5 call sites at once, not one at a time

The remediation document's own mutation check (§3.1) covered only the
breakage that occurred incidentally while writing the change (an
unmocked Firestore transaction). This review performed a **deliberate,
comprehensive mutation**: all five `enforceRateLimit(...)` call sites
were commented out simultaneously —

```diff
     const { readings } = parse(SyncReadingsSchema, request.data);
-    await enforceRateLimit(userId);
+    // MUTATION-TEST: await enforceRateLimit(userId);
```

(and the equivalent one-line change in `deleteReading`, `getQuota`,
`activateTrial`, and `setAdminClaim`) — then the same four test files
were re-run:

```
Test Files  4 failed (4)
     Tests  10 failed | 19 passed (29)
```

Exactly the 10 tests written specifically to assert the rate-limit gate
(2 per callable — "calls `enforceRateLimit` with the caller's uid" and
"a rejection blocks the callable before any write/read" — for each of
the 5 callables) failed. The other 19 tests (ownership checks, Zod
validation, legitimate-path business logic, the pre-existing
non-admin-rejection test) were **unaffected** — proving the new tests
detect specifically the rate-limit gate's removal, not some unrelated
breakage, and that no other behavior was accidentally coupled to it.

The mutation was then fully reverted from the backed-up originals:

```
$ cp <backups> functions/src/functions/{readings,quota,activateTrial,admin}.ts
$ git diff --stat functions/src/functions/readings.ts functions/src/functions/quota.ts \
    functions/src/functions/activateTrial.ts functions/src/functions/admin.ts
(no output)
$ npx vitest run
Test Files  26 passed (26)
     Tests  543 passed (543)
```

`git diff --stat` against the four files confirmed zero trace of the
mutation remained; the full suite was re-run green immediately after.

**Assessment: genuine, not vacuous.** A comprehensive, simultaneous
removal of all five integrations was caught precisely and only by the
tests built to catch it.

### 4.5 All 11 `onCall` exports remain protected

Independently re-enumerated every `onCall(` export in the codebase and
cross-checked against `enforceRateLimit` call sites:

```
$ grep -rn "= onCall(" functions/src/functions/ functions/src/functions/payments/
admin.ts:22            setAdminClaim
askWatchOracle.ts:148  askWatchOracle
discussReading.ts:184  discussReading
account.ts:69          deleteAccount
activateTrial.ts:28    activateTrial
quota.ts:14            getQuota
classifyQuestion.ts:21 classifyQuestion
inferProfile.ts:9      inferProfile
payments/googlePlay.ts:197  verifyGooglePlayPurchase
readings.ts:85         syncReadings
readings.ts:145        deleteReading
```

11 distinct `onCall` exports, confirmed. And:

```
$ grep -rn "await enforceRateLimit(" functions/src/functions/ functions/src/functions/payments/ | grep -v __tests__
```

produced exactly 11 call sites, one per export above — full parity, no
gaps, no duplicates. The two `onRequest`-wrapped exports
(`razorpayWebhook`, `health`) are correctly excluded — HTTP webhook and
public health-probe trust models, not part of Finding 2's scope, and
unchanged by any phase in this audit chain.

### 4.6 Findings 3–7 and prohibited paths

```
$ git diff --stat 76930fd..9b189e0 -- firestore.rules .github/ package.json \
    package-lock.json functions/package.json functions/package-lock.json \
    firebase.json firebase.test.json .firebaserc src/ .env.example functions/.env.example
(no output)
```

No Firestore rule, no CI workflow, no dependency manifest or lockfile
(app root or functions), no deployment configuration, no app-root
source file, no environment-file template was touched. `setAdminClaim`'s
pre-existing inline admin-authorization check (Finding 11's subject) is
confirmed unmodified in §4.1 — the new call was added around it, not
into it. `admin.ts`, `inferProfile.ts`, and `classifyQuestion.ts`
(Finding 7's subjects) carry no change to their validation logic — only
`admin.ts` gained the rate-limit line, and that line is unrelated to
its `request.data as {...}` cast.

### 4.7 `main` and the live-deployment/branch-protection boundaries

```
$ git fetch origin main --quiet
$ git log origin/main -1 --oneline
ce536bc Force Cloud Functions redeploy to verify mystical Oracle prompt deployment
$ git merge-base --is-ancestor HEAD origin/main
(not an ancestor — expected)
```

`main` is unchanged from the same commit on record since Phase 6A-R1.
The two verification boundaries named in `PHASE_6B_CLOSURE.md` §4 and
carried through `PHASE_6C_1_CLOSURE.md` §3 (live GitHub Actions/Cloud
Functions execution, and GitHub branch-protection configuration) are
**trivially unaffected by this phase** — this remediation touches no
CI workflow and no deployment configuration at all, so there is nothing
in this diff that could resolve or worsen either boundary. This review
does not claim either is resolved; both remain exactly as open as
`PHASE_6C_1_CLOSURE.md` left them.

## 5. Hard-stop assessment

None of the governing hard-stop conditions is present:

- No P0/P1 vulnerability was found or introduced — this remediation is
  strictly additive (a new rejection path on five callables that
  previously had none).
- No existing authorization/ownership check was weakened. §4.4's
  mutation check and the pre-existing non-admin-rejection test
  (unaffected by the mutation) both directly confirm this.
- No production behavior or Firestore rule changed outside
  authorization (§4.6).
- No broader security/deployment primitive requires remediation beyond
  Finding 2 — the shared `enforceRateLimit()` mechanism itself was
  already correct and untouched; only its adoption was completed.
- No evidence contradicts the implementation record — every figure in
  `PHASE_6C_2_REMEDIATION.md` was independently reproduced and matched.

## 6. Residual / unresolved boundaries — restated, not resolved by this review

1. **Live GitHub Actions/Cloud Functions execution.** Unaffected by this
   phase (§4.7) — remains exactly as unresolved as `PHASE_6C_1_CLOSURE.md`
   §3 left it.
2. **GitHub branch-protection / required-status-check configuration.**
   Unaffected by this phase (§4.7) — remains exactly as unresolved as
   `PHASE_6C_1_CLOSURE.md` §3 left it.
3. **The configured rate limit's tuning** (`RATE_LIMIT_PER_MINUTE`,
   default 10/minute, shared across all 11 callables) was not evaluated
   for per-callable appropriateness — explicitly out of scope for
   Finding 2, restated in `PHASE_6C_2_REMEDIATION.md` §7 and not
   re-litigated by this review.

## 7. Final disposition

**PHASE 6C-2 INDEPENDENT REVIEW GATE: ✅ PASS.**

All nine requirements were independently re-verified against source and
live command execution rather than accepted from the remediation
document, including a comprehensive, simultaneous mutation across all
five call sites (broader than the remediation's own incidental
breakage-and-fix) that failed precisely and only the ten tests built to
catch it, then was fully reverted and confirmed via an empty `git diff
--stat`. All 11 `onCall` exports in the codebase are confirmed to call
`enforceRateLimit` with exact 1:1 parity. Findings 3–7, all prohibited
paths, dependencies, Firestore rules, CI configuration, deployment
configuration, and `main` are all confirmed untouched. Both
live-deployment and branch-protection boundaries are correctly left
exactly as unresolved as before — not claimed resolved, since this
phase touches no deployment surface. No P0/P1 or hard-stop condition
was found.

**No remediation was performed or authorized by this review.** This is
a review-gate PASS for the `9b189e0` checkpoint only. It does not
create a Phase 6C-2 closure document, does not authorize any further
Phase 6 work, and does not constitute or imply a production-readiness
claim. Per the governing sequence, the next step is a separately
authorized 6C-2 closure record.
