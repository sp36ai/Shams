# Phase 6C-2 — Formal Closure

This document formally closes Phase 6C-2, the targeted remediation of
Finding 2 from `docs/audit/PHASE_6B_CLOSURE.md` §2 ("Rate limiting
missing on 5 callables: `syncReadings`, `deleteReading`,
`activateTrial`, `getQuota`, `setAdminClaim`"). It records no new
evidence and makes no production-code, test, Firestore-rule, or
deployment-configuration change — it exists solely to give the 6C-2
chain the same explicit closure record every completed chain in this
project's audit trail already has. It is the only file this closure
adds.

## 1. Chain history

| Step | Commit | Outcome |
|---|---|---|
| 6C-2 implementation | `9b189e0` | Added one `await enforceRateLimit(userId)` (or, for `setAdminClaim`, `request.auth.uid`) to each of the 5 target callables, placed to match this codebase's own pre-existing convention (`verifyAuth` → `parse()` → `enforceRateLimit`, or inside `measure()`'s callback where there is no parse step). The shared `enforceRateLimit()` primitive, its configured rate, and every already-rate-limited callable were left unmodified. Adding the real call broke 9/15 of `readings.test.ts`'s pre-existing tests immediately (an unmocked Firestore transaction) — reproduced before fixing, confirming the change genuinely executes on the real code path — then fixed via a mock, restoring all 15 to green unmodified. 14 new tests added (readings.test.ts extended + 3 new files: `quota.test.ts`, `activateTrial.test.ts`, `admin.test.ts`). Full regression clean: 543/543 functions tests (was 529/529, +14, 0 regressions), 306/306 app tests, clean typecheck/lint both sides, engine mirror sync clean. |
| 6C-2 independent review | `4eb399a` | **PASS.** All 5 integrations independently retraced against fresh source reads; placement/order confirmed against the codebase's own precedent, always before any read or write. The 29 targeted tests and the full 543/543 regression re-run independently. A **broader mutation check than the implementation's own**: all 5 `enforceRateLimit` call sites commented out simultaneously (not one at a time) — exactly the 10 tests built to catch that failed, the other 19 stayed green — then fully restored and reconfirmed 543/543. All 11 `onCall` exports independently re-enumerated and confirmed at exact 1:1 parity with rate-limit calls. Findings 3–7, all prohibited paths, dependencies, `firestore.rules`, CI, and deployment config confirmed untouched; `main` unchanged. No hard-stop found. |

This closure ratifies both checkpoints — `9b189e0` (implementation) and
`4eb399a` (independent review) — exactly as authorized. It performs no
re-verification of its own; it consolidates what those two documents
already established.

## 2. The 5 rate-limit integrations — closed

| Callable | File | Rate-limit call | Placement (verified at review) |
|---|---|---|---|
| `syncReadings` | `readings.ts` | `enforceRateLimit(userId)` | after `verifyAuth` + `parse()`, before `checkReadingOwnership()` and any batch write |
| `deleteReading` | `readings.ts` | `enforceRateLimit(userId)` | after `verifyAuth` + `parse()`, before the ownership check and delete |
| `getQuota` | `quota.ts` | `enforceRateLimit(userId)` | at the start of `measure()`'s callback, before any Firestore read |
| `activateTrial` | `activateTrial.ts` | `enforceRateLimit(userId)` | at the start of `measure()`'s callback, before `db.runTransaction(...)` |
| `setAdminClaim` | `admin.ts` | `enforceRateLimit(request.auth.uid)` | after the pre-existing admin-authorization check succeeds, before any Auth read or write |

All five are now closed against Finding 2: each callable that
previously had no rate-limit gate at all now has exactly one, placed
before any mutation, and independently verified (not merely
implemented) to actually block execution on rejection.

## 3. Evidence preserved

### 3.1 Targeted and full-suite test evidence

- **29/29 targeted tests** across the four affected test files
  (`readings.test.ts`: 19, `quota.test.ts`: 3, `activateTrial.test.ts`:
  3, `admin.test.ts`: 4) — 15 pre-existing (restored to green after
  being broken by the real integration, unmodified in their own
  assertions) + 14 new (proving `enforceRateLimit` is called with the
  correct uid and that a rejection blocks the callable before any
  write/read, for each of the 5 callables).
- **543/543 full functions regression** (up from 529/529 at the 6C-1
  baseline, +14, 0 regressions), reproduced independently at both
  implementation and review.
- **306/306 app-root tests**, unaffected (this remediation touches no
  app-root code) — reproduced independently at both implementation and
  review.

### 3.2 Mutation-detection evidence

At review, all 5 `enforceRateLimit(...)` call sites were commented out
**simultaneously** (broader than the implementation's own incidental
breakage-and-fix, which only exercised the pattern for
`syncReadings`/`deleteReading`):

```
Test Files  4 failed (4)
     Tests  10 failed | 19 passed (29)
```

Exactly the 10 tests written specifically to assert the rate-limit gate
(2 per callable, across all 5) failed; the other 19 — ownership checks,
Zod validation, legitimate-path business logic, the pre-existing
non-admin-rejection test — were unaffected, proving the new tests
detect precisely the rate-limit gate's removal and nothing else. The
mutation was then fully reverted; `git diff --stat` on the four
production files showed no output, and the full suite was re-run green
(543/543) immediately after.

### 3.3 11/11 `onCall` parity

Independently re-enumerated at review: 11 distinct `onCall` exports in
the codebase (`setAdminClaim`, `askWatchOracle`, `discussReading`,
`deleteAccount`, `activateTrial`, `getQuota`, `classifyQuestion`,
`inferProfile`, `verifyGooglePlayPurchase`, `syncReadings`,
`deleteReading`), each with exactly one `await enforceRateLimit(...)`
call — full parity, no gaps, no duplicates. The two `onRequest`-wrapped
exports (`razorpayWebhook`, `health`) are correctly excluded — a
different trust model (HMAC-verified webhook; public health probe),
outside Finding 2's scope, unchanged by any phase in this audit chain.

## 4. What remains explicitly unresolved — carried forward, not silently closed

**This is not a resolved verification. It is an explicitly disclosed,
unchanged limitation, carried forward by this closure exactly as prior
documents recorded it:**

- **Live deployment state.** Not observable from this environment.
  This phase touches no CI workflow and no deployment configuration at
  all, so nothing in this remediation could resolve or worsen this
  boundary — it is exactly as unresolved as `PHASE_6C_1_CLOSURE.md` §3
  left it.
- **GitHub branch-protection / required-status-check configuration.**
  No tool available in any environment this audit chain has had access
  to can inspect it. Likewise untouched and unaffected by this phase.

Both boundaries are identical in kind to the two named in
`docs/audit/PHASE_6B_CLOSURE.md` §4 and remain exactly as unresolved
after this closure as they were before Phase 6C-2 began.

## 5. Findings 3–7 and Phase 6D

- **Findings 3–7** (from `docs/audit/PHASE_6C_1_CLOSURE.md` §6) remain
  open, unaddressed by this closure. Each is a separately scoped
  candidate for its own future reconnaissance → implementation →
  review → closure chain, exactly as Findings 1 and 2 were.
- **No Phase 6D work has begun.** This closure does not scope, begin,
  or authorize any further Phase 6 reconnaissance or implementation.
- **This closure does not declare the application production-ready.**
  It closes the specific rate-limiting remediation and review chain
  authorized against Finding 2. The two disclosed verification
  boundaries (§4) remain explicitly open, carried forward for whichever
  future, separately authorized work addresses them.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this closure is written against: `4eb399a` (the 6C-2
  Independent Review Gate PASS).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, or deployment-configuration file
  is touched by this closure — the only file this phase adds is this
  document.
- No Phase 5, 6A, 6B, or 6C-1 document is created or modified by this
  closure.
- No `PHASE_6C_3_*` or `PHASE_6D_*` file is created by this closure.

---

## Status

**PHASE 6C-2: CLOSED.**

| Layer | Status |
|---|---|
| Phase 5 | ✅ CLOSED |
| 6A | ✅ CLOSED |
| 6B | ✅ CLOSED |
| 6C-1 | ✅ CLOSED |
| 6C-2 implementation | ✅ Complete (`9b189e0`) |
| 6C-2 Review | ✅ PASS (`4eb399a`) |
| 6C-2 Closure | ✅ CLOSED (this document) |
| Findings 3–7 | ⛔ Untouched |
| Phase 6D | ⛔ Not authorized |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for the next Phase 6 step.
