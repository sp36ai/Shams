# Phase 6A-R1 — Ownership & Entitlement Boundary Remediation

Implementation record for the narrowly scoped remediation authorized
directly against the two findings established at
`docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md` (§4, §5). Starting
checkpoint: `90a7a9c`. Branch: `claude/shams-phase-0-baseline-lnlmy6`
(`main` untouched throughout).

**This document does not close 6A-R1.** Per the governing authorization's
own completion discipline, it reports an implementation checkpoint AND
one new hard-stop finding discovered during this phase's own test
development — not remediated, per the authorization's explicit
instruction to stop and report rather than expand scope. See §C.

## A. `syncReadings` — remediated, closed

### A.1 The fix

`checkReadingOwnership()` (new, exported for direct testing,
`functions/src/functions/readings.ts`) reads every reading id in a
`syncReadings` request via a single `db.getAll()` call **before any
write is attempted**, and throws `permission-denied` — performing no
write at all, for any reading in the batch, including otherwise-
legitimate ones — the moment a single id is found to already exist under
a different `userId`. A nonexistent id is treated as a legitimate new
reading (the ordinary, intended case), preserving the function's
original behavior exactly for that case.

This is the smallest correction that closes the finding: it adds one
pre-check phase; it does not alter the existing chunked-batch-write loop,
the Zod schema, or `deleteReading`, which was already correct.

**Design decision, made explicitly rather than left implicit:** a batch
containing any cross-user id **fails the whole call**, rather than
silently skipping only the conflicting entries and writing the
legitimate ones. This was chosen over a partial-success design because:
(a) it is simpler to reason about and test exhaustively; (b) it surfaces
a genuine conflict as an error the caller/logs will notice, rather than
silently dropping what could be evidence of an actual attack attempt;
(c) it still satisfies "preserve legitimate same-user synchronization"
exactly — the overwhelmingly common case (a batch entirely of the
caller's own readings) is completely unaffected.

**Client-supplied ownership fields cannot bypass the check** — confirmed,
not merely assumed: `SyncReadingsSchema`'s per-item schema does not
declare a `userId` field at all, and the write path never reads
`r.userId` under any circumstance — it always writes the AUTH-derived
`userId`. A test (`readings.test.ts`, requirement 6) proves a spoofed
`userId` on the payload has no effect on the resulting document's actual
ownership, regardless of whether Zod strips it.

### A.2 Required test matrix — all satisfied

| # | Case | Result |
|---|---|---|
| 1 | Existing same-user reading | Allowed |
| 2 | Existing different-user reading | Rejected, `permission-denied` |
| 3 | Nonexistent reading id | Allowed (new reading) |
| 4 | Multiple ids, mixed ownership | Whole call rejected, zero writes |
| 5 | `{merge:true}` cannot overwrite another user's ownership | Proven — the target document is byte-for-byte unchanged after a rejected attempt |
| 6 | Client-supplied ownership fields cannot bypass the check | Proven — a spoofed `userId` on the payload has no effect |
| 7 | `deleteReading`'s existing ownership behavior remains intact | Proven — same-user delete succeeds, cross-user delete still rejected, nonexistent id still `not-found`, all unchanged |

15 permanent tests in the new
`functions/src/functions/__tests__/readings.test.ts`, using a minimal
in-memory fake Firestore that models exactly the calls `readings.ts`
makes (no emulator required) — all passing.

## B. `razorpayWebhook` — fail-safe boundary only, as authorized

Per this phase's own explicit instruction, **no payer/order-binding
architecture was invented.** The repository has no order-creation code
(confirmed exhaustively at 6A-F1 §5); this phase does not pretend
otherwise.

### B.1 What was fixed

1. **`extractNonEmptyString()`** (new, exported) replaces the previous
   bare `!userId`/`!razorPlan` truthy checks with a genuine runtime type
   check. The prior `Record<string, string>` cast on `notes`/`entity`
   was a compile-time promise only — a malformed payload (a JSON number,
   object, or array at that key) was truthy and would previously flow
   into `auth.getUser()`/Firestore's `.doc()` as an uncontrolled type
   error, caught only by the generic outer catch. Now rejected
   deliberately, at the point of extraction, for both `payment.captured`
   and `subscription.activated`.
2. **`isUnverifiableEntitlementTarget()` / `recordUnverifiableEntitlementTarget()`**
   (new, exported/private) — when `upgradePlan()` fails specifically
   because `notes.userId` names no real Firebase Auth account
   (`auth/user-not-found`), this is now recorded as a distinct
   `securityEvents` entry (`razorpay_entitlement_target_unverifiable`),
   matching the established sibling pattern
   (`razorpay_invalid_signature`, `play_purchase_token_reuse`) rather
   than folding into the same generic `payment_razorpay_fail` bucket
   every transient failure already used. Additive — the generic bucket
   still also records it.
3. **The file's own header comment was rewritten** to state the actual
   trust model precisely: the HMAC signature proves the payload came
   from Razorpay; it does not prove `notes.userId` names the account
   that paid. This replaces the previous comment's silence on that
   distinction with an explicit statement of the boundary, cross-
   referenced to the missing order-creation integration this repository
   does not contain.

### B.2 Required boundary behavior — established and tested

| `notes.userId` state | Behavior |
|---|---|
| Absent | No entitlement, acknowledged 200 (pre-existing, reconfirmed unchanged) |
| Malformed (non-string JSON value) | No entitlement, acknowledged 200 (newly, deliberately rejected — previously an uncontrolled type error) |
| Well-formed, but names no real Firebase Auth account | No custom-claim entitlement; **the Firestore quota document is still written first — see §C, the open finding** |
| Well-formed and names a real account | Entitlement granted exactly as before — no regression |

9 permanent unit tests for the two pure helpers plus 5 end-to-end
webhook-invocation tests (real HMAC signing, the real exported
`razorpayWebhook` handler invoked directly, a minimal in-memory fake for
`db`/`auth`) in the new
`functions/src/functions/payments/__tests__/razorpay.test.ts` — the
first test file this callable has ever had (its absence is itself
recorded here, not silently corrected into "always existed").

## C. Hard-stop — discovered, then remediated under a continuation authorization

This section is preserved in two parts, in the order events actually
happened, per this project's append-only audit convention: **C.1** is
the original discovery, exactly as first reported (this document's own
prior committed text, unmodified) — at that point genuinely "reported,
not remediated." **C.2**, added afterward under a separate, explicit
continuation authorization ("6A-R1 continuation — Entitlement
Write-Ordering Hardening"), records the fix. Do not read C.1 as
describing the code's current behavior — C.2 supersedes it; C.1 is kept
verbatim as the historical record of what was found and why it was not
fixed in the same pass it was discovered in.

### C.1 — Original discovery (historical; superseded by C.2 below)

While developing the required end-to-end Razorpay boundary tests, one of
them (exercising a well-formed but nonexistent `notes.userId`) caught a
**pre-existing bug this phase did not introduce**, in code this phase
did not otherwise touch:

**`upgradePlan()` (`functions/src/functions/payments/razorpay.ts:248-274`,
shared by both `payment.captured` and `subscription.activated`) writes
`/quotas/{userId}` — the Firestore document `getQuota` and other
server-side checks treat as authoritative — BEFORE calling
`auth.getUser(userId)` to verify the uid names a real account at all.**

```
257:  // Firestore update (authoritative for quota checks)
258:  await db.collection('quotas').doc(userId).set(
259:    { plan, planExpiry: expiresAt.toISOString(), updatedAt: FieldValue.serverTimestamp() },
264:    { merge: true },
265:  );
266:
267:  // Merge into existing claims — do NOT replace (would wipe admin: true, etc.)
268:  const existingUser = await auth.getUser(userId);   ← verification happens AFTER the write above
```

**Reproduced, not assumed:** a permanent test (`razorpay.test.ts`, "a
well-formed but nonexistent uid is recorded as a distinct securityEvent
— KNOWN OPEN GAP") sends a signed `payment.captured` webhook naming a
uid with no Firebase Auth account. The test proves `/quotas/{userId}`
receives the paid-plan write **before** `auth.getUser()` throws — the
Firestore entitlement document is left holding a plan for a uid that
does not correspond to any real account. The custom-claim step never
runs (the function throws before reaching it), so the account-level gate
most of the codebase actually checks is unaffected — but the raw
Firestore quota document, which `getQuota` (`functions/src/functions/quota.ts`)
reads directly, is not.

**Why this was not fixed in this phase:** it matches two of this
authorization's own hard-stop conditions directly — *"entitlement can be
granted to an unverified user"* and *"fixing one path reveals a shared
authorization primitive that is unsafe elsewhere"* (`upgradePlan()` is
shared by both event branches). Reordering its two writes is a
reasonable fix in principle, but it touches the shared entitlement-write
primitive itself, not the `notes.userId` extraction/type-safety/logging
boundary this phase was specifically authorized to correct. Per the
authorization's own instruction — *"Stop immediately and report rather
than expanding scope"* — this was reported, not fixed.

**Practical severity, stated precisely, not exaggerated:** the affected
uid does not exist in Firebase Auth, so no real seeker can authenticate
as it to benefit from the orphaned Firestore write today; the custom
claim (the gate `verifyGooglePlayPurchase` and most other privileged
checks in this codebase actually rely on) is never set for it. The
concrete residual risk is narrower — a stale, orphaned `/quotas/{uid}`
document for a nonexistent account, and, if that specific uid string is
ever later reused by a real account through some path this investigation
did not examine, an entitlement that account never legitimately paid
for. This is recorded as a genuine defect requiring its own fix, not
downplayed to "cosmetic," and not escalated beyond what was actually
demonstrated.

**Awaiting its own narrowly scoped authorization** — reorder
`upgradePlan()`'s two operations (verify the uid via `auth.getUser()`
first; write `/quotas/{userId}` only after that succeeds) is the shape
such a fix would likely take, not prescribed further here since scoping
it is the next authorization's decision.

### C.2 — Remediation (this continuation)

Authorized directly: *"fold it into the same 6A-R1 remediation... the
critical invariant is now explicit: No server-side entitlement may be
persisted until the identity receiving that entitlement has been
verified."*

**The fix — before/after, exact:**

```diff
   const durationDays = PLAN_DURATION_DAYS[plan];
   const expiresAt = new Date(Date.now() + durationDays * 86_400_000);

-  // Firestore update (authoritative for quota checks)
-  await db.collection('quotas').doc(userId).set(
-    { plan, planExpiry: expiresAt.toISOString(), updatedAt: FieldValue.serverTimestamp() },
-    { merge: true },
-  );
-
-  // Merge into existing claims — do NOT replace (would wipe admin: true, etc.)
-  const existingUser = await auth.getUser(userId);
-  const currentClaims = existingUser.customClaims ?? {};
-  await auth.setCustomUserClaims(userId, { ...currentClaims, plan, planExpiry: expiresAt.toISOString() });
+  // Verify the target identity FIRST — see this file's own header.
+  const existingUser = await auth.getUser(userId);
+  const currentClaims = existingUser.customClaims ?? {};
+
+  // Firestore update (authoritative for quota checks) — only after the
+  // identity above is confirmed real.
+  await db.collection('quotas').doc(userId).set(
+    { plan, planExpiry: expiresAt.toISOString(), updatedAt: FieldValue.serverTimestamp() },
+    { merge: true },
+  );
+
+  // Merge into existing claims — do NOT replace (would wipe admin: true, etc.)
+  await auth.setCustomUserClaims(userId, { ...currentClaims, plan, planExpiry: expiresAt.toISOString() });
```

`auth.getUser(userId)` now runs before either mutation. When it throws
(`auth/user-not-found`), the caller's existing catch block —
`isUnverifiableEntitlementTarget(err)` — recognizes exactly this error
and records the distinct `securityEvents` entry (§B.1); neither the
Firestore quota document nor the Auth custom claim is ever touched.
Custom-claim merge semantics (`{...currentClaims, plan, planExpiry}`,
never a destructive replace) are byte-for-byte unchanged. Both event
branches (`payment.captured`, `subscription.activated`) call the same
`upgradePlan()`, so both are corrected by the one change — no second
remediation architecture was needed or built.

**Proof that a nonexistent uid now produces zero entitlement mutation**
— the permanent test this remediation added/updated
(`razorpay.test.ts`, *"a well-formed but nonexistent uid produces ZERO
entitlement mutation — the §C hard-stop, now closed"*) asserts, for the
exact same reproduction C.1 used:
- `quotaWrites` has length 0 (previously 1 — this is the fix, proven by
  the same test that first proved the bug, not a new, differently-shaped
  assertion);
- `claimsWrites` (new tracking added to the test's fake `auth`) has
  length 0;
- the `razorpay_entitlement_target_unverifiable` securityEvents entry is
  still recorded (unchanged from C.1's own fix in §B.1);
- the generic `payment_razorpay_fail` audit-log entry is still recorded
  (unchanged).

A second, new test proves the same guarantee for `subscription.activated`
independently, not merely inferred from `payment.captured`'s coverage.

**Mandatory regression cases — all satisfied:**

| # | Case | Result |
|---|---|---|
| 1 | Valid existing uid → quota entitlement succeeds | Proven — `quotaWrites` length 1, `plan` correct |
| 2 | Nonexistent uid → rejected | Proven — `auth.getUser()` throws, function exits via the catch |
| 3 | Nonexistent uid → `/quotas/{uid}` does not exist or change | Proven — `quotaWrites` length 0 |
| 4 | Valid HMAC + nonexistent uid → cannot create entitlement | Proven — the end-to-end test signs a real HMAC and still gets zero mutation |
| 5 | Both webhook event types exercise the corrected path | Proven — dedicated tests for `payment.captured` and `subscription.activated`, both the nonexistent- and existing-uid cases |
| 6 | Existing user claims remain intact | Proven — a new test seeds `real-uid-1` with a pre-existing `admin: true` claim and asserts it survives the merge alongside the new `plan`/`planExpiry` |
| 7 | Existing plan/expiry behavior remains intact | Proven — `quotaWrites[0].data.plan`/`.planExpiry` assertions unchanged in shape from before the reorder |
| 8 | Malformed/unverifiable `notes.userId` remains fail-safe | Proven — the malformed-value and absent-value tests from the original §B pass unchanged |
| 9 | Replay/idempotency behavior is unchanged | Proven — a new test sends the same `payment.captured` payload (same `paymentId`) twice; `claimWebhookEvent`'s existing dedup still suppresses the second write, `quotaWrites`/`claimsWrites` both length 1 |

**Residual Razorpay external-integration boundary — restated, unchanged
by this remediation:** this fix closes the write-ordering defect
entirely within code that already existed. It does **not**, and was not
authorized to, bind `notes.userId` to a verified payer/order
relationship — that still requires an order-creation integration this
repository does not contain (`docs/audit/PHASE_6A_F1_OWNERSHIP_INVESTIGATION.md`
§5). The file's header (§B.1) continues to state this precisely: HMAC
proves Razorpay origin, not payer identity. What this remediation adds
is narrower and unconditional regardless of that missing integration:
whatever identity `notes.userId` names, no entitlement is persisted for
it unless that identity is confirmed to exist in Firebase Auth first.

## D. Regression results (full matrix, re-run fresh after the C.2 fix)

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **529/529** (23 files; was 525 before this continuation, 489 before §A/§B) |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root) | **306/306**, unaffected |
| `node scripts/sync-engine.mjs --check` | clean |
| Golden corpus | **111/111**, untouched |
| Replay check | **24/24**, byte-identical |
| 11,923-case adversarial harness (scratch out-dir, outside the repository) | **0** false negatives, **0** false positives, **0** exceptions, **0** contract mutations |
| Prohibited-path diff (`90a7a9c..HEAD`, all ten paths plus `classifyQuestion.ts`) | **empty** |
| This continuation's own working-tree diff | exactly `functions/src/functions/payments/razorpay.ts` (production, the reorder) and `functions/src/functions/payments/__tests__/razorpay.test.ts` (tests) — `readings.ts`/`readings.test.ts` untouched, confirmed by the same diff |

## E. Scope discipline

- `classifyQuestion.ts` — untouched (confirmed in the prohibited-path
  diff above), both in §A/§B and in this continuation.
- Phase 5 oracle/narration code (`narrationValidator.ts`, `textSecurity.ts`,
  `readingContract.ts`, `remedySelection.ts`, `remedyLibrary.ts`, the
  engine, `kp/`) — untouched.
- `firestore.rules` — untouched; every fix in this phase operates
  entirely server-side via the Admin SDK, which does not go through
  Firestore Security Rules at all — no rule change was needed or made
  at any point.
- Payment credentials/secrets — untouched.
- Production Firebase configuration — untouched.
- `syncReadings`/`readings.ts` — untouched by this continuation (the new
  tests did not expose any regression there, so per the authorization's
  own instruction it was not touched again).
- No unrelated callable was modified.
- No second remediation architecture was built — the single reorder in
  `upgradePlan()` closes the finding for both event branches.
- No Phase 6B implementation was performed.
- No production-readiness claim is made anywhere in this document.

## F. Final status

**PHASE 6A-R1: IMPLEMENTATION CHECKPOINT — COMPLETE.**

- **§A (`syncReadings`) — fully remediated and tested.**
- **§B (`razorpayWebhook` fail-safe boundary) — fully remediated within
  its authorized scope.** No payer/order-binding architecture invented.
- **§C — discovered (C.1) and remediated (C.2).** The write-ordering
  defect is closed for both webhook event types, with the residual
  external-integration boundary (payer verification itself) restated,
  not silently expanded past what was authorized.

This document still does not close 6A-R1. Per the governing
authorization's own sequence (6A-F1 → 6A-R1 implementation → 6A-R1
Review Gate → 6A-R1 Closure → Phase 6B reconnaissance), the next step is
the independent Review Gate — not performed by this document, and not
self-certified here.
