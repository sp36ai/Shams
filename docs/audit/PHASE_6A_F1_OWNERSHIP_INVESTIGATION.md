# Phase 6A-F1 — Server-Side Ownership Boundary Investigation

Scoped investigation, per the separately issued "Phase 6A-F1 — Server-side
ownership boundary investigation" authorization, into whether the
`syncReadings` finding reported at the Phase 6A reconnaissance hard-stop
is isolated or part of a broader server-side ownership pattern. No
production code, Firestore rule, or any other file was modified. No
remediation was performed.

## 1. Method

Every exported callable in `functions/src/index.ts` was read in full.
For every operation that writes, updates, or deletes a Firestore
document, the exact document-id derivation and any ownership check were
traced from source, not inferred from comments — per this investigation's
own evidence standard, several files were found where a comment's claim
and the code's actual behavior disagreed (see §3). Every client-supplied
document-id write path in the entire `functions/src/functions` tree was
enumerated exhaustively via `grep -rn "\.doc("` and each result
individually traced (§7).

## 2. Complete callable inventory — ownership status

| Callable | Resource(s) touched | Doc-id source | Ownership check before mutation | Verdict |
|---|---|---|---|---|
| `askWatchOracle` | `readings/{autoId}` (create only) | Firestore-auto-generated (`db.collection('readings').doc()`, `askWatchOracle.ts:254`) | N/A — a fresh create at a server-chosen id can never collide with an existing document | **SAFE** |
| `discussReading` | `readings/{readingId}` (read + `discussionTurns` increment); `readings/{compareId}` (read-only) | Client-supplied (`input.readingId`, `input.compareReadingIds`) | **Yes** — `discussReading.ts:250`, `if (data.userId !== userId) throw HttpsError('not-found', ...)`, checked inside the same transaction as the mutation, before `tx.update()` runs; comparison ids are filtered by `d.userId === userId` (`discussReading.ts:270`) and are read-only regardless | **SAFE** |
| `activateTrial` | `trials/{userId}` | Server-derived — the doc id is the caller's own verified `userId`, never client-supplied | Ownership enforced by construction (a caller cannot address any uid but their own) | **SAFE** |
| `getQuota` | `quotas/{userId}`, `trials/{userId}` (read-only) | Server-derived (`userId`) | N/A — read-only, own document only | **SAFE** |
| `syncReadings` | `readings/{r.id}` (merge-write, up to 100 per call) | **Client-supplied**, unconstrained beyond `string().min(1).max(128)` | **No** — `readings.ts:40-50` merge-writes without first reading the document to check any existing `userId` | **VULNERABLE — the original finding** (§4) |
| `deleteReading` | `readings/{readingId}` (delete) | Client-supplied (`readingId`) | **Yes** — reads the document first, `if (data.userId !== userId) throw HttpsError('permission-denied', ...)`, before `ref.delete()` | **SAFE** — the exact pattern `syncReadings`, three lines above it in the same file, is missing |
| `deleteAccount` | `users/{userId}`, `quotas/{userId}`, `trials/{userId}` (delete); `readings` (delete, via `.where('userId', '==', userId)` query) | Server-derived (`userId`) for the fixed docs; query-filtered by the caller's own `userId` for readings — no client-supplied id anywhere in this path | Ownership enforced by construction | **SAFE** |
| `setAdminClaim` | Firebase Auth custom claims for `targetUid` (no Firestore write) | Client-supplied `targetUid`, but the call itself is gated by `request.auth.token.admin !== true` — a non-admin caller is rejected before `targetUid` is ever used | Gated on the caller's own pre-existing admin claim, not on any check of `targetUid`'s own data | **SAFE** — not a Firestore ownership case at all; privilege is pre-required, not established by this call |
| `verifyGooglePlayPurchase` | `quotas/{userId}` (merge-write); `purchaseTokens/{hash(token)}` | `quotas`: server-derived (`userId`, always `request.auth.uid` — the client cannot name a different account at all, this being a Firebase-Auth-gated *callable*). `purchaseTokens`: content-derived (SHA-256 of the purchase token itself) | **Yes** — the token-binding write (`googlePlay.ts:246-260`) is a transactional first-redeemer claim: an already-bound token belonging to a different `userId` is rejected (`already-exists`) before any entitlement is granted | **SAFE** |
| `razorpayWebhook` | `quotas/{userId}` (merge-write, via `upgradePlan()`); `webhookEvents/{key}` (dedup ledger) | `quotas`: **taken from the webhook payload's `notes.userId`** (`razorpay.ts`, `upgradePlan(userId, ...)` called with `notes?.userId`) — not any caller's authenticated identity, since this is an `onRequest` HTTP endpoint with no Firebase Auth context at all, authenticated only by HMAC signature (proving the payload came from Razorpay, not proving who the `notes.userId` value names) | **No cross-check against a payer's own identity** — see §5, a distinct, secondary finding | **NEEDS DISCLOSURE — see §5** |
| `inferProfile` | none (no Firestore write of any kind) | N/A | N/A | **SAFE** — nothing to own |
| `classifyQuestion` (deployed, Phase 6A's own deferred item) | none (stateless AI classification, no Firestore write) | N/A | N/A | **SAFE**, and out of scope per this investigation's own instruction not to touch it |
| `health` | none | N/A | N/A | **SAFE** |

## 3. Code-vs-documentation mismatches found

Beyond `readings.ts:6`'s claim ("Server validates ownership: userId in
doc = caller's userId") already reported at the Phase 6A hard-stop, no
further mismatch of this kind was found in the remaining callables. Every
other file's doc comments describing ownership/authorization behavior
were independently verified against the actual code and found accurate
(`deleteReading`, `deleteAccount`, `activateTrial`, `discussReading`,
`verifyGooglePlayPurchase`, `setAdminClaim`).

## 4. The original finding — confirmed isolated, not part of a pattern

**`syncReadings` is the only callable in the entire inventory where a
client-supplied document id is used for a write (`set`/`update`/`delete`)
without first checking the existing document's own persisted `userId`.**
Every other client-supplied-id write path (`discussReading`'s
`discussionTurns` increment, `deleteReading`) performs exactly that check,
transactionally, before mutating. Every other write path in the
inventory uses a document id that cannot be attacker-chosen at all
(server-derived from the caller's own verified `userId`, a Firestore
auto-id, or a content hash bound via its own first-claim transaction).

This directly answers the investigation's central question: **`syncReadings`'s
missing ownership check is isolated. It is not evidence of a systemic
pattern across this codebase's server-side write paths** — the codebase's
prevailing practice, demonstrated in six of seven client-influenceable
write paths, is exactly the check `syncReadings` is missing.

**Reachability, independently re-confirmed for this investigation:**
`grep -rn "syncReadings"` across the entire `src/` client tree returns
zero matches. The callable is exported and deployed
(`functions/src/index.ts`), reachable by any authenticated, App-Check-passing
caller via the Firebase SDK directly (Cloud Functions callables are not
restricted to only the code paths a specific client app happens to
invoke), but **the shipped app itself never calls it.** This does not
remove the code-level defect — a caller need not use the app's own UI to
invoke a deployed callable — but it does confirm there is no path through
*ordinary use of the application* that reaches this defect today.

**Severity and exploit preconditions, restated precisely, per the
authorization's own instruction not to downgrade or exaggerate:**
- The defect is real and unconditional: given a target reading's actual
  Firestore document id, any authenticated caller can overwrite that
  document's `question`/`verdict`/`category`/`questionLang`, and reassign
  its `userId` to themselves, via a single `syncReadings` call.
- The precondition is real and non-trivial: `askWatchOracle.ts:254`
  generates reading ids via `db.collection('readings').doc()` — Firestore's
  own auto-id, drawn from a large random keyspace, not sequential or
  otherwise predictable. No feature in `src/` was found that discloses
  one user's `readingId` to another user (no share/link/leaderboard
  feature exists). Acquiring a specific victim's reading id therefore
  requires a separate disclosure channel this investigation did not find
  evidence of (a log, a support screenshot, a future feature).
- **Classification: a genuine authorization-logic defect (P1) with a
  non-trivial acquisition precondition, not a P0 unauthenticated or
  precondition-free cross-user compromise.** This matches the
  distinction the governing authorization asked to be preserved
  explicitly: the server claims to validate ownership and instead
  overwrites the ownership field with the caller's own uid — that is a
  real defect regardless of how hard the id is to obtain, and the id's
  difficulty to obtain is why this does not rise to the hard-stop bar
  ("without a meaningful additional secret/ID-disclosure precondition")
  this investigation was authorized to apply.

## 5. Secondary finding — Razorpay entitlement binding (distinct mechanism)

Not a Firestore-ownership-check gap in the sense of §2–§4 (there is no
"existing document overwritten" pattern here — `quotas/{userId}` is
merge-written to the uid named in the webhook payload, which either
already exists as a real account or the write fails), but the same
underlying question the investigation was asked to establish —
*"are authorization checks based on existing persisted state rather than
values supplied by the caller?"* — has a **no** answer here, worth
recording precisely rather than folding into §4's classification:

- `razorpayWebhook` (`functions/src/functions/payments/razorpay.ts`) is
  an `onRequest` HTTP endpoint, not a Firebase-Auth-gated callable. It is
  authenticated only by an HMAC-SHA256 signature proving the payload
  originated from Razorpay — it carries no Firebase Auth context and
  cannot, by its nature as a server-to-server webhook, know "who is
  calling."
- The `userId` that receives the entitlement (`upgradePlan(userId, ...)`)
  is read directly from the payload's `notes.userId` field — a value set
  wherever the Razorpay order was originally created, not verified
  against any authenticated identity at any point in this codebase.
- **No order-creation code exists anywhere in this repository.**
  `grep -rln "razorpay"` across `src/`, `package.json`, and the Android
  project returns zero results beyond `firebase.predeploy.json` (a
  deploy-config reference, not integration code). This means either (a)
  Razorpay orders are created through some channel entirely outside this
  repository (a separate web checkout, for instance) that this
  investigation has no visibility into, or (b) this webhook currently
  receives no genuine traffic at all. This investigation could not
  determine which, and does not assume either — it is recorded as an
  **explicit not-tested boundary** requiring an operational answer (does
  a live Razorpay integration exist outside this codebase?) rather than
  a code-only one.
- By contrast, `verifyGooglePlayPurchase` (§2) cannot exhibit this gap at
  all: it is a Firebase-Auth-gated callable, so `userId` is always
  `request.auth.uid` — the actual, verified caller — never a value from
  purchase metadata.
- **Classification: P2.** A real gap in the entitlement-binding pattern
  (unlike Google Play's, it does not tie the grant to a verified payer
  identity), but reachable only if a live external order-creation
  integration exists (not established either way by this investigation)
  and, even then, only against a real, existing Firebase uid (`auth.getUser()`
  throws and the attempt is logged/audit-trailed, not silently accepted,
  for any uid that doesn't exist) — this also does not cross the hard-stop
  bar for the same reason as §4: a meaningful precondition (a real uid,
  or possibly a nonexistent traffic path entirely) stands between this
  code path and any actual cross-user harm.

## 6. Hard-stop assessment

Per this investigation's own governing rule: *"If the investigation finds
a callable where an authenticated user can manipulate another user's
existing resource without a meaningful additional secret/ID-disclosure
precondition, stop immediately and report it as a higher-confidence
production security finding."*

**No such callable was found.** Both findings in this document (§4, §5)
require a precondition this investigation could not establish as
currently satisfiable through the shipped application: a specific
victim's unguessable Firestore reading id (§4), or a live external
order-creation integration this investigation found no evidence of (§5).
Neither finding is escalated beyond its own classification above. This
investigation does not trigger a new, higher-confidence hard-stop.

## 7. Exhaustive cross-check — every client-influenceable `.doc(id)` call

For completeness, every `.doc(` call anywhere in `functions/src/functions/`
taking anything other than a Firestore auto-id or the caller's own
`userId`, found via `grep -rn "\.doc("` and individually traced:

| Location | Resource | Traced disposition |
|---|---|---|
| `askWatchOracle.ts:254` | `readings/{autoId}` | Auto-id create — §2 |
| `discussReading.ts:218` | `readings/{input.readingId}` | Ownership-checked before mutation — §2 |
| `discussReading.ts:237` | `readings/{compareId}` | Read-only, ownership-filtered — §2 |
| `readings.ts:40` | `readings/{r.id}` | **Not** ownership-checked — §4, the original finding |
| `readings.ts:79` | `readings/{readingId}` (`deleteReading`) | Ownership-checked before deletion — §2 |
| `payments/googlePlay.ts:246` | `purchaseTokens/{hash(token)}` | First-claim transaction, cross-account reuse rejected — §2 |
| `payments/razorpay.ts:97` | `webhookEvents/{key}` | Global dedup ledger, not a user-owned resource — no ownership check applicable |
| `payments/razorpay.ts:118` | `webhookEvents/{key}` (release) | Same ledger, same disposition |

No `.doc(id)` call in this tree was missed by §2's callable-level table —
this cross-check confirms the same conclusion by a different method
(document-id call site rather than callable), independently arriving at
the same single instance.

## 8. Regression / scope discipline

No production code, test, Firestore rule, or configuration file was
modified in producing this document. `git status --porcelain` at the
start and end of this investigation is empty. No file was created other
than this one.

## 9. Conclusion

`syncReadings`'s missing ownership check (§4) is confirmed **isolated** —
the codebase's prevailing, demonstrated practice across every other
client-influenceable write path is to check ownership against persisted
state before mutating, and six of seven such paths do so correctly. One
secondary, mechanically distinct finding (§5, the Razorpay entitlement
binding) is recorded with the same evidentiary care and the same explicit
precondition disclosure. Neither finding meets this investigation's own
bar for a new, higher-confidence hard-stop.

No remediation was performed. This document is an inventory and
classification record only, per its own governing authorization. Both
findings await a separately authorized, narrowly scoped remediation
phase before either is fixed.
