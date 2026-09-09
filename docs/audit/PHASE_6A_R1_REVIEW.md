# Phase 6A-R1 — Independent Review Gate

Review of implementation checkpoint `b8c2d6c`, against the complete
6A-R1 authorization chain: the original 6A-R1 authorization (§A
`syncReadings`, §B `razorpayWebhook` fail-safe boundary) and its
continuation authorization (§C `upgradePlan()` write-ordering). Baseline
for the diff review: `90a7a9c` (the Phase 6A-F1 investigation this whole
chain remediates).

Review-only. No production code, test, rule, configuration, or audit
record was modified by this review. Two temporary mutation checks (§4)
were made and fully reverted before this document was written — both
confirmed clean (`git diff --stat` empty) before this review's own
conclusions were drawn.

## 1. Checkpoint

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: `b8c2d6c`, diffed against `90a7a9c`.
- `main`: confirmed untouched — its own HEAD (`ce536bc`) shares no
  history with this branch's commits; nothing in this review chain was
  ever pushed there.
- Working tree: clean throughout.

## 2. Independent diff assessment

Read in full, not summarized from the implementation's own claims:
`git diff 90a7a9c..b8c2d6c -- functions/src/functions/readings.ts` and
`git diff 90a7a9c..b8c2d6c -- functions/src/functions/payments/razorpay.ts`.

**`readings.ts`:** `checkReadingOwnership()` reads every id in a sync
batch via one `db.getAll()` call, called inside `syncReadings`'s own
`try` block **before** the chunked write loop begins. Confirmed directly
in source: the `HttpsError('permission-denied', ...)` it throws is
caught by the existing `if (err instanceof HttpsError) throw err;`
re-throw, so it propagates to the caller unchanged — not silently
swallowed or converted to a generic `internal` error. The write loop
itself (`db.batch().set(..., {merge:true})`) is byte-for-byte unchanged
from before this phase; only a pre-check phase was added.

**`razorpay.ts`:** `extractNonEmptyString()` is applied at every
extraction site for `notes.userId`, the plan-identifying field, and the
payment/subscription id, in **both** the `payment.captured` and
`subscription.activated` branches — confirmed by direct comparison, not
assumed symmetric. `isUnverifiableEntitlementTarget()` /
`recordUnverifiableEntitlementTarget()` are wired into both branches'
`catch` blocks, after the existing `releaseWebhookEvent()` call and
before the `throw err` that lets the outer generic catch also still
record `payment_razorpay_fail` — confirmed additive, not a replacement.

**`upgradePlan()` reorder:** confirmed directly — `auth.getUser(userId)`
now executes before `db.collection('quotas').doc(userId).set(...)`,
which executes before `auth.setCustomUserClaims(...)`. The custom-claim
merge expression (`{...currentClaims, plan, planExpiry}`) is
character-for-character unchanged from before the reorder — only its
position relative to the Firestore write moved, matching the "retain
existing merge semantics" requirement exactly.

## 3. Finding-by-finding verdict

### 3.1 `syncReadings`

| Requirement | Verdict | Evidence |
|---|---|---|
| Persisted ownership checked before mutation | **PASS** | `checkReadingOwnership()` runs before the write loop; confirmed by source read and by mutation test (§4.1) |
| Cross-user ids fail closed | **PASS** | `permission-denied`, zero writes for the whole call |
| Same-user synchronization remains functional | **PASS** | Dedicated tests for new-reading and existing-own-reading cases, both passing |
| Mixed batches cannot partially authorize unauthorized ownership | **PASS** | Whole-call rejection confirmed — the legitimate entry in a mixed batch is also not written, the documented fail-closed design choice, not a partial-authorization gap |
| Client-supplied ownership cannot establish authority | **PASS** | `SyncReadingsSchema`'s per-item schema has no `userId` field; the write path never reads `r.userId`; a spoofed value is proven inert |
| `deleteReading` remains unchanged | **PASS** | Diffed independently — zero lines changed in `deleteReading`; its own ownership-check tests (same-user, cross-user, nonexistent) all still pass |

### 3.2 Razorpay boundary

| Requirement | Verdict | Evidence |
|---|---|---|
| Malformed/absent `notes.userId` cannot create an entitlement | **PASS** | Both cases tested end-to-end against the real exported handler with a real HMAC signature; `quotaWrites` length 0 in both |
| Unverifiable targets handled fail-safe | **PASS** | Nonexistent-uid case produces zero entitlement mutation (§3.3) and is acknowledged 200 to Razorpay (no infinite retry) |
| No unsupported payer-verification claim introduced | **PASS** | The file's own header states the trust boundary precisely (HMAC proves Razorpay origin, not payer identity) — read in full, matches the actual code's guarantees exactly, does not overclaim |
| Security-event handling is deterministic and appropriate | **PASS** | `razorpay_entitlement_target_unverifiable` recorded exactly once per qualifying failure, additive to the pre-existing generic audit log, using the established sibling pattern |

### 3.3 `upgradePlan()`

| Requirement | Verdict | Evidence |
|---|---|---|
| `auth.getUser(userId)` occurs before any entitlement mutation | **PASS** | Confirmed in source (§2) and by mutation test (§4.2) |
| Nonexistent uid → zero quota mutation | **PASS** | `quotaWrites` length 0, both event types |
| Nonexistent uid → zero claim mutation | **PASS** | `claimsWrites` length 0, both event types (this specific assertion — `claimsWrites`, not only `quotaWrites` — is new tracking added in this continuation and independently confirmed present) |
| Both webhook event paths use the corrected ordering | **PASS** | Both call the same `upgradePlan()`; dedicated tests for each independently confirm the nonexistent- and existing-uid cases |
| Existing custom claims retain merge semantics | **PASS** | A seeded `admin: true` claim on `real-uid-1` survives alongside the new `plan`/`planExpiry` fields — proven, not assumed |
| Plan and expiry behavior for valid users is unchanged | **PASS** | `quotaWrites[0].data.plan`/`.planExpiry` assertions match pre-reorder shape exactly |
| Idempotency/deduplication remains intact | **PASS** | A duplicate `payment.captured` event (same `paymentId`) still produces exactly one quota write and one claims write — `claimWebhookEvent`'s existing dedup untouched by the reorder |

## 4. Mutation-detection sanity checks (this review's own, not restated from the implementation)

Per this review's own instruction not to merely repeat the
implementation author's conclusions, two temporary, fully-reverted
mutations were applied to confirm the test suite genuinely exercises the
real production code path, not a vacuously-passing re-implementation:

### 4.1 `syncReadings`

The `checkReadingOwnership()` call site in `syncReadings` was commented
out (ownership check disabled, write loop otherwise untouched). Result:
**2 of 15 tests in `readings.test.ts` failed** — both the direct
cross-user-overwrite test and the mixed-batch test — exactly the two
tests that exist specifically to catch this class of regression. File
restored from a pre-mutation backup; `git diff --stat` confirmed empty
before continuing.

### 4.2 `upgradePlan()`

The reorder was reverted (Firestore quota write restored to before
`auth.getUser()`, exactly the pre-fix shape). Result: **2 of 25 tests in
`razorpay.test.ts` failed** — the nonexistent-uid tests for both
`payment.captured` and `subscription.activated`, both asserting
`quotaWrites` length 0 and instead observing length 1. File restored
from a pre-mutation backup; `git diff --stat` confirmed empty before
continuing.

Both checks confirm the permanent test suite would catch a regression
of exactly the kind each fix closes — not merely that the current code
happens to satisfy the current assertions.

## 5. Test evidence (independently re-run, not restated)

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **529/529**, 23 files |
| `npx vitest run src/functions/payments/__tests__/razorpay.test.ts` (isolated, verbose) | **25/25**, every required case individually confirmed present and passing |
| `npx vitest run src/functions/__tests__/readings.test.ts` (isolated) | **15/15** |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root) | **306/306** — exactly the stated baseline, no change to explain |
| `node scripts/sync-engine.mjs --check` | clean |
| Golden corpus | **111/111**, `git diff --stat` empty |
| Replay check | **24/24**, byte-identical |
| 11,923-case adversarial harness (scratch out-dir, outside the repository) | **0** false negatives, **0** false positives, **0** exceptions, **0** contract mutations |
| Prohibited-path diff (`90a7a9c..HEAD`, all ten paths plus `classifyQuestion.ts`) | **empty** |
| Full changed-file list, entire 6A-R1 span | exactly `functions/src/functions/readings.ts`, `functions/src/functions/payments/razorpay.ts` (production) and their two test files — no other file |
| Working tree | clean, before and after this review |
| `main` | untouched — confirmed by unrelated `origin/main` HEAD |

## 6. Residual Razorpay external-integration limitation — restated, not resolved

This review confirms the limitation this phase's own documents already
state and does not treat it as a gap this Review Gate should have
closed: **`notes.userId` is not bound to a verified payer/order
relationship anywhere in this codebase**, because no order-creation
integration exists here to bind against (`docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md`
§5, independently re-confirmed by this review: `grep -rln "razorpay"`
across `src/`, `package.json`, and the Android project still returns
nothing beyond the deploy-config reference). What this phase's fixes
guarantee is narrower and unconditional regardless of that missing
piece: whatever identity `notes.userId` names, (a) it must be a
genuinely well-formed string, and (b) no entitlement of any kind —
Firestore or Auth — is persisted for it unless Firebase Auth confirms
that identity exists first. Binding entitlement to an actually-verified
payer remains explicitly out of scope until an order-creation
integration exists to verify against — this review does not recommend
inventing one, and confirms none was invented.

## 7. Non-blocking observations

- `admin.ts` (`setAdminClaim`) and `inferProfile.ts` still validate
  their inputs by manual shape-check rather than the established
  `parse()`/Zod pattern every other callable uses — noted at 6A-F1, not
  reopened here, and out of this Review Gate's own scope (neither
  callable was touched by 6A-R1).
- `upgradePlan()`'s Firestore-write-then-claim-write ordering (as
  opposed to the identity-verification-then-either-write ordering this
  phase fixed) still has the pre-existing, narrower partial-write shape
  if the Firestore write succeeds but `setCustomUserClaims` then fails —
  this is unchanged by this phase (it was never part of the reported
  finding, which concerned identity verification, not this narrower
  two-write consistency question) and is not a regression this review
  introduces or discovers; recorded here only for completeness, not as
  a finding requiring action.

## 8. Hard-stop assessment

None of the review's own hard-stop conditions were triggered:

- No remaining unauthorized cross-user mutation was found in either
  authorized path.
- No entitlement mutation before identity verification was found —
  the opposite was proven (§3.3, §4.2).
- No entitlement was found grantable to an unverifiable identity.
- No regression in existing valid-payment behavior was found (§3.3,
  "plan and expiry behavior for valid users is unchanged").
- No new P0/P1 was found.
- No scope violation was found — the full changed-file list (§5) is
  exactly the two authorized production files and their tests.
- No evidence was found that the tests do not exercise the real
  production boundary — the opposite was proven by mutation testing
  (§4), and every end-to-end test invokes the actual exported
  `razorpayWebhook`/`syncReadings` handlers, not re-implementations.
- No unexplained Phase 5 behavior change — the prohibited-path diff
  (§5) is empty, and Phase 5's own regression instruments (golden
  corpus, replay, adversarial harness) are all unchanged.

## 9. Final disposition

**PHASE 6A-R1 REVIEW GATE: ✅ PASS.**

All findings from `docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md`
(§4 `syncReadings`, §5 the Razorpay entitlement binding) and the §C
hard-stop discovered during this phase's own implementation
(`upgradePlan()` write-ordering) are closed, independently verified
against live source and by mutation-testing the permanent regression
suite, not merely by re-running it. The residual Razorpay
external-integration limitation is confirmed genuine and correctly left
unresolved, not silently expanded past its authorized scope.

This is a review-gate PASS for the `b8c2d6c` implementation checkpoint.
It does not close 6A-R1, does not create `PHASE_6A_R1_CLOSURE.md`, and
does not authorize Phase 6B. Per the governing sequence, the next step
is the separately authorized 6A-R1 closure record.
