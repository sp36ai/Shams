# Phase 6A-R1 — Formal Closure

This document formally closes Phase 6A-R1, the ownership & entitlement
boundary remediation authorized directly against the findings
established at `docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md`
(§4, §5) and its own continuation (§C, discovered during 6A-R1's own
implementation). It records no new evidence and makes no production-code,
test, Firestore-rule, or payment-architecture change — it exists solely
to give the 6A-R1 chain the same explicit closure record every completed
chain in this project's audit trail already has.

## 1. Chain history

| Step | Commit | Outcome |
|---|---|---|
| 6A-F1 investigation | `90a7a9c` | Findings established: `syncReadings` (§4) wrote to a client-supplied Firestore document id with no ownership check before mutation — every other write path in the codebase was confirmed to check ownership correctly, this one isolated instance did not. Secondary finding (§5): `razorpayWebhook`'s entitlement grant was bound to `notes.userId` from the payment payload, never cross-checked against a verified payer identity — no order-creation code exists in this repository to bind against. |
| 6A-R1 implementation (§A, §B) | `23cfa7c` | `syncReadings` fully remediated: `checkReadingOwnership()` reads every id in a sync batch before any write, rejecting the whole call with `permission-denied` if any id belongs to a different user. `razorpayWebhook` fail-safe boundary remediated within its authorized scope: `extractNonEmptyString()` replaces bare truthy checks with genuine runtime type validation; `isUnverifiableEntitlementTarget()`/`recordUnverifiableEntitlementTarget()` record a distinct security event for an entitlement target naming no real Firebase Auth account. **During this same implementation pass, developing the required end-to-end Razorpay tests discovered a new, distinct hard-stop finding (§C)** — reported, not remediated, per the governing authorization's own "stop and report rather than expand scope" instruction. |
| 6A-R1 continuation (§C) | `b8c2d6c` | Authorized directly to fold the §C finding into the same remediation, since it affects the same entitlement trust boundary. `upgradePlan()` (shared by both `payment.captured` and `subscription.activated`) reordered so `auth.getUser(userId)` runs before either the Firestore quota write or the Auth custom-claim write — a nonexistent uid now produces zero entitlement mutation of any kind, where it previously left an orphaned Firestore quota document. |
| 6A-R1 independent review | `d07d0b7` | **PASS.** Diffs independently traced against live source; two temporary, fully-reverted mutation checks confirmed the permanent test suite genuinely catches a regression of exactly the kind each fix closes (not merely that current assertions happen to hold); full regression matrix independently re-run; no hard-stop condition triggered. |

The implementation checkpoint this closure ratifies is **`b8c2d6c`**,
validated by the independent Review Gate at **`d07d0b7`**, exactly as
named in the governing authorization.

## 2. The three remediated items — discovery and remediation, distinguished

Per the governing authorization's explicit instruction, discovery and
remediation are recorded as distinct events for each item, not merged
into a single "fixed" statement:

### 2.1 `syncReadings` ownership validation

- **Discovery** (`90a7a9c`, 6A-F1 §4): the function's own doc comment
  claimed "Server validates ownership: userId in doc = caller's userId,"
  but the code performed no such check — a client-supplied document id
  was merge-written unconditionally, both overwriting existing content
  and unconditionally reassigning `userId` to the caller. Confirmed
  isolated: every other client-influenceable write path in the codebase
  (`deleteReading`, `discussReading`'s turn increment,
  `verifyGooglePlayPurchase`'s token binding) was independently traced
  and found to check ownership correctly.
- **Remediation** (`23cfa7c`): `checkReadingOwnership()` reads every id
  in a sync batch via one `db.getAll()` call before any write; the whole
  call is rejected with `permission-denied` — zero writes, including
  otherwise-legitimate entries in the same batch — the moment any id is
  found to belong to a different user. A nonexistent id is still treated
  as a legitimate new reading, preserving the function's original,
  intended behavior for that case exactly.
- **Independently re-verified at review** (`d07d0b7`): source-traced
  (the check runs before the write loop; its thrown error propagates
  unchanged) and mutation-tested (disabling the check causes 2 of 15
  tests to fail, confirming the suite is not vacuous).

### 2.2 Razorpay `notes.userId` fail-safe/type validation and security-event handling

- **Discovery** (`90a7a9c`, 6A-F1 §5): `notes.userId` was only
  truthy-checked, not type-checked, allowing a malformed JSON value to
  reach `auth.getUser()`/Firestore as an uncontrolled type error, caught
  only by a generic outer catch. No distinct signal existed for "this
  entitlement target does not exist in Firebase Auth" versus any other
  transient failure.
- **Remediation** (`23cfa7c`): `extractNonEmptyString()` applied
  symmetrically to `notes.userId`, the plan-identifying field, and the
  payment/subscription id, in both `payment.captured` and
  `subscription.activated`. `isUnverifiableEntitlementTarget()` /
  `recordUnverifiableEntitlementTarget()` record a distinct
  `razorpay_entitlement_target_unverifiable` security event — additive
  to, not a replacement of, the existing generic audit-log entry.
- **Independently re-verified at review** (`d07d0b7`): both branches
  confirmed symmetric by direct comparison; the file's rewritten header
  comment independently checked against the actual code's guarantees and
  found accurate, not overclaiming.

### 2.3 `upgradePlan()` verification-before-mutation ordering

- **Discovery** (`23cfa7c`, this document's own §C, discovered mid-pass
  while testing 2.2): `upgradePlan()` — shared by both webhook event
  branches — wrote `/quotas/{userId}` before calling `auth.getUser(userId)`
  to verify the uid existed at all. A well-formed but nonexistent uid
  still received an orphaned Firestore entitlement write before the
  function threw. Reported as a new hard-stop per the governing
  authorization's own instruction, not remediated in the same commit
  that found it.
- **Remediation** (`b8c2d6c`, the continuation authorization): `auth.getUser(userId)`
  now runs first; the Firestore quota write and the Auth custom-claim
  write both happen only after that succeeds. Custom-claim merge
  semantics (`{...currentClaims, plan, planExpiry}`, never a destructive
  replace) are character-for-character unchanged — only their position
  relative to the identity check moved.
- **Independently re-verified at review** (`d07d0b7`): source-traced
  (the three operations now execute in the corrected order) and
  mutation-tested (reverting the reorder causes 2 of 25 tests to fail,
  for both event types independently, confirming the suite is not
  vacuous).

## 3. Residual — the Razorpay external-integration boundary, carried forward unresolved

**This is not a resolved finding. It is an explicitly accepted,
disclosed limitation, carried forward unchanged by this closure.**

`notes.userId` — the value that receives the plan upgrade in a Razorpay
webhook — is not, and cannot be, bound to a verified payer/order
relationship anywhere in this codebase, because **no order-creation
integration exists here to bind against.** `docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md`
§5 established this by exhaustive search (`grep -rln "razorpay"` across
`src/`, `package.json`, and the Android project, returning nothing
beyond a deploy-config reference); the independent review at `d07d0b7`
re-confirmed the same search still returns nothing. `razorpay.ts`'s own
header states the resulting trust model precisely: the HMAC signature
proves the webhook payload came from Razorpay; it does not, and this
codebase cannot make it, prove that `notes.userId` names the account
that actually paid.

What 6A-R1 guarantees is narrower and unconditional regardless of that
missing piece: whatever identity `notes.userId` names, it must be a
genuinely well-formed string (2.2), and no entitlement — Firestore or
Auth — is persisted for it unless Firebase Auth independently confirms
that identity exists first (2.3). Binding entitlement to an
actually-verified payer remains out of scope until a real order-creation
integration exists to verify against. This closure does not invent one,
does not claim the boundary is resolved, and does not expand 6A-R1's
scope to attempt one.

**Exact external dependency required for a future proper binding, if
ever authorized:** a server-side order-creation endpoint (or equivalent
integration point) that, at the moment a Razorpay order is created,
records the authenticated caller's own `userId` against that order's id
— the same pattern `verifyGooglePlayPurchase` already uses for its
purchase-token binding (`payments/googlePlay.ts`) — so the webhook can
verify `notes.userId` against that binding instead of trusting the
payload's own claim. No such endpoint exists in this repository today.

## 4. Regression evidence at the reviewed checkpoint (`d07d0b7`, restated from the review, not re-run by this closure since no code changed since that review)

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **529/529**, 23 files |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root) | **306/306** — exact stated baseline |
| `node scripts/sync-engine.mjs --check` | clean |
| Golden corpus | **111/111**, untouched |
| Replay check | **24/24**, byte-identical |
| 11,923-case adversarial harness | **0** false negatives, **0** false positives, **0** exceptions, **0** contract mutations |
| Prohibited-path diff (`90a7a9c..d07d0b7`, all ten paths plus `classifyQuestion.ts`) | **empty** |
| Mutation-detection sanity checks | both fixes independently confirmed non-vacuous (§2.1, §2.3) |
| `main` | untouched (unrelated `origin/main` HEAD) |

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this closure is written against: `d07d0b7` (the 6A-R1
  Review Gate PASS).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, or payment-architecture file is
  touched by this closure — the only file this phase adds is this
  document.
- No Phase 5 document is created or modified by this closure.
- No `PHASE_6B_*` file is created by this closure.

## 6. Phase 6B and production readiness

- **No Phase 6B work has begun.** This closure does not scope, begin,
  or authorize any Phase 6B reconnaissance or implementation.
- **This closure does not declare the application production-ready.**
  It closes the specific ownership/entitlement remediation and review
  chain authorized against the 6A-F1 findings. The disclosed Razorpay
  payer-binding boundary (§3) remains explicitly open, carried forward
  for whichever future, separately authorized Phase 6 work addresses it
  — not resolved, not silently converted into an accepted-forever
  limitation, and not expanded upon here.

---

## Status

**PHASE 6A-R1: CLOSED.**

| Layer | Status |
|---|---|
| Phase 5 | ✅ CLOSED |
| 6A-F1 | ✅ Complete |
| 6A-R1 implementation | ✅ Complete (`b8c2d6c`) |
| 6A-R1 Review | ✅ PASS (`d07d0b7`) |
| 6A-R1 Closure | ✅ CLOSED (this document) |
| Phase 6B | ⛔ Not authorized |
| Production readiness | ❌ Not yet established |

Awaiting a separate, explicit authorization for the next step of Phase 6.
