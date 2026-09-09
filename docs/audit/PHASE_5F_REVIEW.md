# Phase 5F — Independent Review

Review target: commit `8eb8d45` ("Phase 5F: extend deterministic validation
to the discussion-reply surface"), the sole implementation commit since the
Phase 5E closure checkpoint `5c01517` and the Phase 5F reconnaissance
checkpoint `f84f97d`. This review is read-only: it verifies the
implementation independently rather than trusting `docs/audit/PHASE_5F_HARDENING.md`'s
own account of itself, and it makes no production-code, test, or engine
changes. All probe scripts used below were written fresh for this review,
run from a scratchpad location outside the repository, and deleted before
this document was written — the working tree carries no trace of them.

---

## 1. Checkpoint / status

| Claim | Evidence |
|---|---|
| Phase 5E is closed before review begins | `5c01517` ("Phase 5E: formal closure record") precedes `f84f97d` and `8eb8d45` in `git log`. |
| Review target is exactly `8eb8d45` | `git log --oneline -3` → `8eb8d45` is `HEAD`. |
| Review does not modify production code | `git status --porcelain` clean before and after this review's work; this document is the only file added. |

---

## 2. Regression baseline (independently reproduced)

| Check | Result |
|---|---|
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | **390/390**, 17 files (WARN log line present in the 5F integration test, confirming the real failure path is exercised, not a stub) |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | **304/304**, 27 suites |
| `node scripts/sync-engine.mjs --check` | clean (mirror sync intact) |
| `git diff --stat -- docs/audit/golden-corpus/` | empty — corpus untouched |
| `ls docs/audit/golden-corpus/cases/ \| wc -l` | **111** |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24** identical |
| Adversarial harness, fresh run into a non-overwriting scratchpad dir | `generated: 11923, FN: 0, FP: 0, exc: 0, mut: 0` — matches `docs/audit/phase-5f/summary.json` |
| `git status --porcelain` | clean, both before and after this review |

All figures independently reproduced match what `PHASE_5F_HARDENING.md`
itself claims. No discrepancy found.

---

## 3. Prohibited-path verification (one command, every path, since `f84f97d`)

```
git diff --stat f84f97d..HEAD -- \
  src/astrology/ functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/oracle/textSecurity.ts \
  functions/src/oracle/narrationValidator.ts \
  functions/src/prompts/ firestore.rules \
  docs/audit/golden-corpus/ src/
```

Result: **completely empty.** This single command's `src/` argument covers
the entire client/app tree, independently confirming UI/app is untouched —
not merely inferred from the reconnaissance doc's own claim.

Individually, per path: engine — empty; `kp/` — empty (no `kp/` diff at
all under `functions/src/engine/`); `readingContract.ts` — empty;
`remedySelection.ts`/`remedyLibrary.ts` — empty; `textSecurity.ts` —
empty; `narrationValidator.ts` — empty; prompts — empty; `firestore.rules`
— empty; golden corpus — empty; app `src/` — empty. All ten hold
simultaneously.

---

## 4. Contract authority / provenance chain

- **Contract creation and single-computation**: `askWatchOracle.ts` calls
  `composeWatchOracleResponse()` once per reading; its return value
  `{ composition, contract }` is destructured into `oracleResponse` and
  `readingContract` at that single call site (`askWatchOracle.ts:277-278`
  region). No second call to `buildReadingContract()`, `judgeWatchChart()`,
  or `diagnose()` exists anywhere in `askWatchOracle.ts` or
  `discussReading.ts`/`discussionComposer.ts` — confirmed by direct grep
  (`judgeWatchChart|buildWatchChart|selectRemedyProtocol|diagnose(` against
  both discussion-path files: zero matches). Judgment is not recomputed
  during discussion.
- **Persistence is the same object, not a rebuild**: the `readingContract`
  field written to Firestore (`askWatchOracle.ts`, `...(readingContract ?
  { readingContract } : {})`) is the exact `contract` returned from
  `composeWatchOracleResponse()` — no intermediate transformation.
- **Serialization fidelity (live probe)**: constructed a real
  `ReadingContract` via the engine (`buildWatchChart` →
  `judgeWatchChart` → `diagnose` → `selectRemedyProtocol` →
  `buildReadingContract`), round-tripped it through
  `JSON.parse(JSON.stringify(...))` to simulate a Firestore write/read, and
  compared: `computeContractFingerprint()` identical before/after, top-level
  key sets identical, full `JSON.stringify` deep-equality true, and the
  round-tripped value still passes `asReadingContract()`'s shape check.
  Contract reconstruction through Firestore is lossless.
- **Loaded server-side, never client-supplied**: `discussReading.ts` reads
  `doc.readingContract` from the Firestore document loaded inside the
  ownership-checked transaction (`db.runTransaction`), narrows it with
  `asReadingContract()`, and passes the result to
  `composeDiscussionReply()`. The client-supplied request body
  (`DiscussReadingSchema`) has no field through which a contract, or any of
  its constituent facts, could be supplied — see §5.
- **No lossy/ad hoc approximation constructed anywhere**: grepped
  `functions/src/` for any alternate contract-builder or reduced-shape
  constructor used by the discussion path — none exists.
  `asReadingContract()` is a shape *check* (returns `null` or the value
  unchanged), never a partial rebuild.

---

## 5. Trust boundary / anti-forgery — live probes

`DiscussReadingSchema` (`functions/src/middleware/validate.ts`) is
`.strict()` at both the outer level and per-turn (`turns[]` entries are
themselves `.strict()`). Rather than relying on reading the schema, this
review ran `DiscussReadingSchema.safeParse()` directly against six crafted
payloads:

| Probe | Payload | Result |
|---|---|---|
| A (control) | legitimate `{readingId, message, lang}` | `success: true` |
| B | + top-level `contract: {...}` | `success: false` |
| C | + top-level `verdict: 'YES'` | `success: false` |
| D | + top-level `judgment: {...}` | `success: false` |
| E | + top-level `readingContract: {...}` (the exact persisted field name) | `success: false` |
| F | forged `contract` field nested inside a `turns[]` entry | `success: false` |

All five forgery attempts are rejected by Zod parsing — which runs
(`parse(DiscussReadingSchema, request.data)`) before authentication's
ownership check, before the transaction, before contract loading, and
before `composeDiscussionReply()` is ever reached. A client cannot smuggle
a contract-shaped or judgment-shaped field into a `discussReading` request
at all; this is structural, not merely policy.

- **Ownership before contract use**: read directly from
  `discussReading.ts`'s transaction body — `data.userId !== userId` throws
  `not-found` (deliberately the same error a missing reading gets)
  immediately after the document read, before the turn-budget check,
  before the compare-readings read, and structurally before
  `asReadingContract()` or `composeDiscussionReply()` are called (both
  occur only after the transaction resolves). Ownership is checked before
  the contract is ever touched.
- **Cross-reading substitution impossibility**: `asReadingContract(doc.readingContract)`
  is called on exactly one value — `doc`, the transaction-returned anchor
  document (`{ doc, turnsRemaining, compareDocs } = await
  db.runTransaction(...)`, `doc: data`). `compareDocs` (the
  `compareReadingIds` readings) are converted only via `toGrounding()`,
  which reads `verdict`/`confidence`/`watchOracle`/`narration` — never
  `readingContract` — so a comparison reading's contract can never be
  substituted for the anchor's. No code path derives the validated
  `contract` from anything but `doc` itself.
- **No leak to client**: `askWatchOracle.ts`'s client-facing `response`
  object spreads only `oracleResponse` (`...(oracleResponse ? { oracle:
  oracleResponse } : {})`), never `readingContract` — confirmed by grep,
  matching the prior summary's finding. `discussReading.ts`'s
  `DiscussReadingResponse` type carries only `answer`, `isNewQuestion`,
  `turnsRemaining` — no contract-shaped field exists to leak in the first
  place.
- **Stale/partial contract data handled safely**: `asReadingContract()`
  shape-checks `provenance`, `judgment`, `diagnosis`, `remedy` (all must be
  non-null objects) and `celestialEntities` (must be an array); anything
  short of that returns `null`, which `validateDiscussionReply()` treats as
  "skip validation," not a crash or a fabricated pass.

---

## 6. Validation pipeline integrity

- **Call chain traced**: `composeDiscussionReply()` → parses Claude's JSON
  → `validateDiscussionReply(input.contract, answer)` →
  `wrapReplyAsNarrationFields(answer)` (confirmed: places the identical
  string into all five `NarrationFields` keys) → `validateNarration(contract,
  wrapped)` (imported unchanged from `narrationValidator.ts`) → failure
  branch logs and returns `null`; success branch returns `{answer,
  isNewQuestion}`.
- **`narrationValidator.ts` unchanged**: empty diff since `f84f97d` (§3).
- **`textSecurity.ts` unchanged**: empty diff since `f84f97d` (§3).
- **No second validator**: grepped for `validateNarration|validateDiscussionReply|function validate`
  across `functions/src/oracle/` and `discussReading.ts` — the only
  validation entry points are `validateNarration()` itself (unchanged,
  called once more from `discussionComposer.ts` than before) and the new
  thin wrapper `validateDiscussionReply()`, which does not reimplement any
  check.
- **Phase 5E ground-truth checks execute for discussion output**: directly
  exercised (not just re-run from the existing test file) — see §7. All
  seven checks (`checkHouseClaims`, `checkSupportingHouseClaims`,
  `checkSignClaims`, `checkDirectionClaims`, `checkRetrogradeClaims`,
  `checkRulerRelationClaims`, `checkReversalClaims`) fired correctly.
- **Three-tier matching intact**: `validateNarration()`'s per-field loop is
  untouched (empty diff), and this review's own confusable-substitution and
  mid-word-punctuation probes (§7) — attacking the discussion surface
  specifically — were correctly caught, confirming the canonicalization
  tiers apply to discussion replies exactly as they do to primary
  narration.
- **Remedy validation remains active**: `validateNarration()`'s full
  `CHECKS` array (including remedy/diagnosis consistency checks
  established in Phase 4) runs unmodified against the wrapped discussion
  text; no field is excluded.

---

## 7. Fresh adversarial content-attack battery (independent — not the committed test file)

Two real `ReadingContract`s were built through the actual engine for this
review (distinct `readingId`s from the committed test suite's fixtures,
`r-5f-review-primary`/`r-5f-review-secondary`, same source moments/questions
as the established 5E-chain fixtures to reuse known ground truth:
`primary` — outcome `UNFAVOURABLE`, targetHouse `10`, sign `Burj Jadi`,
direction `South`, rulerRelation `Neutral`, genuinely retrograde;
`secondary` — outcome `UNFAVOURABLE`, targetHouse `7`, direction `South`,
reversal `NONE`, not retrograde). All probe text below is worded
differently from every case in `discussionValidation.test.ts`, while
correctly targeting each check's documented bounded trigger phrase (a
deliberate, previously-established scope boundary — the checks are
phrase-anchored, not general semantic detectors; probing outside that
anchor is not a discussion-surface gap, it is the same accepted residual
already recorded through the 5E chain for the primary narration surface).

| # | Attack | Result |
|---|---|---|
| 1 | Wrong verdict ("the matter will succeed" vs. `UNFAVOURABLE`) | **rejected** — `VERDICT_CONTRADICTION` |
| 2 | Fabricated house (wrong house "governs this matter") | **rejected** — `HOUSE_CLAIM_CONTRADICTION` |
| 3 | Fabricated sign ("through the sign of Scorpio" vs. actual Jadi) | **rejected** — `SIGN_CLAIM_CONTRADICTION` |
| 4 | Fabricated direction ("points toward the North" vs. actual South) | **rejected** — `DIRECTION_CLAIM_CONTRADICTION` |
| 5 | Fabricated retrograde (claimed on the non-retrograde `secondary`) | **rejected** — `RETROGRADE_CLAIM_CONTRADICTION` |
| 6 | Fabricated ruler relation ("enemy" vs. actual `Neutral`) | **rejected** — `RULER_RELATION_CONTRADICTION` |
| 7 | Fabricated reversal ("remains possible" vs. actual `NONE`) | **rejected** — `REVERSAL_CLAIM_CONTRADICTION` |
| 8 | Unsupported certainty ("guaranteed to happen") | **rejected** — `VERDICT_CONTRADICTION` (positive-assertion phrase) |
| 9 | Prohibited terminology / internal leakage ("our RKP Watch Engine ran a judgment pass") | **rejected** — `TERMINOLOGY_LEAKAGE` |
| 10 | Unicode obfuscation (ZWJ inside "guaranteed") | **rejected** — canonicalization tier still catches the positive assertion |
| 11 | 5D-R confusable substitution (Cyrillic а inside the anchor phrase) | **rejected** — `HOUSE_CLAIM_CONTRADICTION` still fires |
| 12 | 5D-R mid-word punctuation ("a-n-s-w-e-r is yes") | **rejected** — `VERDICT_CONTRADICTION` |
| 13 | Combined multi-mechanism (obfuscated certainty + fabricated house in one reply) | **rejected** — `HOUSE_CLAIM_CONTRADICTION` |
| 14 | Genuine consistent reply, no trigger phrases | **accepted** (positive control) |
| 15 | Genuine consistent house claim (correct house number) | **accepted** (positive control) |
| 16 | Genuine consistent reversal claim (correct value, "is none") | **accepted** (positive control) |
| 17 | `null` contract (legacy reading) with an otherwise-rejectable claim | **accepted** — validation correctly skipped, not failed |

**17/17 as expected.** No false negative, no false positive found in this
independent battery.

---

## 8. Failure-handling integrity

- **Invalid output cannot reach the client**: traced every `return` in
  `composeDiscussionReply()` (7 total: API-key-missing, empty-messages,
  HTTP-error, missing-answer, validation-failure, success, catch-block) —
  the single success return (`{answer, isNewQuestion}`) is reached only
  after the validation branch (`if (!validation.valid) { ...; return null;
  }`) has already passed. **No alternate unvalidated return path exists.**
- **Invalid output not persisted**: `discussReading.ts`'s `reply === null`
  branch refunds the turn and throws before any `db.collection('auditLogs').add()`
  or `completeRequest()` call — both of which sit strictly after the
  `reply === null` check in source order.
- **Retry/quota/refund behavior**: identical, pre-existing mechanics — the
  turn refund (`FieldValue.increment(-1)`) and `HttpsError('unavailable', ...)`
  throw are the same code Phase <5F already used for a generation failure;
  Phase 5F added no new refund or retry logic, only a new reason to enter
  the same branch.
- **No infinite retry loop**: `composeDiscussionReply()` makes exactly one
  `fetch()` call per invocation; no internal retry loop exists in this file
  or its caller. A client-initiated retry is bounded by the idempotency
  layer (`claimRequest`/`completeRequest`) exactly as before.
- **Valid replies still work**: confirmed both by probes #14–17 above and
  by the pre-existing, re-run integration tests in
  `discussionValidation.test.ts` (3/3 passing), which mock `fetch` and
  exercise the real `composeDiscussionReply()` end-to-end.

---

## 9. End-to-end / lifecycle verification

- **New readings create authoritative contracts**: `askWatchOracle.ts`'s
  single `composeWatchOracleResponse()` call site is the only contract
  construction point; confirmed by grep (§4).
- **Contract survives persistence**: confirmed by the live
  serialize/deserialize probe (§4) — byte-for-byte fingerprint match.
- **Discussion uses the persisted contract**: `discussReading.ts` reads
  `doc.readingContract` from the same document object returned by the
  ownership-checked transaction; no separate read path exists.
- **Legacy readings do not crash**: `asReadingContract(undefined)` (a
  reading with no `readingContract` field at all) returns `null` at the
  first shape check (`typeof value !== 'object'`) — no throw.
  `validateDiscussionReply(null, ...)` returns `{valid: true}`
  unconditionally — confirmed directly in probe #17 above and by the
  committed test file's own "null contract" case.
- **Legacy data is not silently migrated**: grep across `functions/src/`
  for writes to `readingContract` found exactly one call site —
  `askWatchOracle.ts`'s cast-time write. No code path in `discussReading.ts`,
  `discussionComposer.ts`, or elsewhere ever writes, backfills, or
  regenerates a `readingContract` field for an existing document.

---

## 10. Synthesis

| Row | Status |
|---|---|
| Client-controlled provenance absent | confirmed (§5, live probes) |
| Contract substitution impossible | confirmed (§5) |
| Judgment recomputation absent | confirmed (§4, §9) |
| Validation bypass absent | confirmed (§8 — exhaustive return-path trace) |
| Invalid text cannot reach client | confirmed (§8) |
| Unsafe fallback behavior absent | confirmed — no new fallback text policy exists; the pre-existing "no reply" precedent is reused unchanged |
| Golden corpus drift absent | confirmed (§2, §3) |
| Prohibited-path changes absent | confirmed (§3) |
| Phase 5E residuals not reopened | confirmed — none of the six accepted residuals (documented at 5E closure) were touched by this diff, and this review's own probes did not exercise or reopen any of them |
| No new P0/P1 discovered | confirmed — all fresh adversarial probes (§7) and structural traces (§4–§6, §9) found no defect |
| Findings classified correctly | no findings to classify — see below |
| Review evidence complete | every matrix row above has direct evidence; none required a not-applicable rationale |
| Review document exists at required path | this file, `docs/audit/PHASE_5F_REVIEW.md` |
| Only review evidence committed | this document is the only file this review adds; no production, test, or engine file was modified (`git status --porcelain` clean before commit, confirmed in §1) |
| Phase 5F not prematurely closed | this document does not declare Phase 5F closed, does not open 5F-R, and does not begin 5G |

No implementation defect, provenance gap, validation bypass, unsafe
fallback, corpus drift, prohibited-path change, or reopened residual was
found anywhere in this review.

---

## Final status record

**PHASE 5F REVIEW: PASS**

All required claims in the review evidence matrix pass. No findings —
blocking or non-blocking — remain. This review stops here: Phase 5F is
not closed by this document, and neither Phase 5F-R nor Phase 5G begins
without separate, explicit authorization.
