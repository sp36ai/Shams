# Phase 5F-R2 — Comparison-Reading Trust-Boundary Remediation

Implementation record for the narrowly scoped remediation authorized
directly against Finding item 6 of the Phase 5 Residual Disposition Gate
(`docs/audit/PHASE_5_RESIDUAL_DISPOSITION.md`): comparison readings
referenced via `compareReadingIds` in a discussion thread had zero
independent validation coverage — only the anchor reading's
`ReadingContract` was ever checked.

This is an **implementation checkpoint only**. Per the governing
authorization's completion condition, 5F-R2 is not closed by this
document — it awaits the independent Review Gate.

## 1. Re-audit at the pre-modification HEAD

Starting checkpoint: `bf5198c` (Phase 5: Residual Disposition Gate).
Working tree clean. Re-traced the complete discussion path from source,
not from memory of Phase 5F's own documentation:

```
discussion input (readingId, compareReadingIds, message, turns)
  → discussReading.ts: ownership + existence check (anchor AND each
    compare id, same rule, comparison silently dropped on failure)
  → discussReading.ts: labelFor(doc) — one label per reading
  → discussReading.ts: toGrounding(doc) — builds ReadingGrounding[],
    only the ANCHOR's doc.readingContract narrowed via asReadingContract()
  → discussionComposer.ts: DiscussionInput { groundings, contract }
    — contract is the anchor's ReadingContract | null, a SEPARATE
    top-level field, never attached to any grounding
  → composeDiscussionReply(): builds the brief (buildDiscussionBrief,
    all groundings, correctly labeled), calls Claude, parses `answer`
  → validateDiscussionReply(input.contract, answer): the WHOLE reply
    text, wrapped into all five NarrationFields, checked against ONLY
    the anchor's contract — via validateNarration(), unmodified
  → on failure: return null (no deterministic fallback for discussion)
  → discussReading.ts: null → refund the turn, throw a retryable error
  → on success: response persisted via completeRequest(), returned to
    the client
```

Confirmed directly in source (`functions/src/functions/discussReading.ts`,
`functions/src/oracle/discussionComposer.ts`) — the comparison readings'
own `readingContract` field was never read at all; nothing in the
pipeline ever loaded it, let alone validated against it.

## 2. Reproduction

Built a throwaway script (`functions/scripts/_repro-5f-r2.ts`, run via
`vite-node`, deleted before this document was written, never committed)
using real, engine-computed contracts:

- An anchor reading ("the career reading") and a comparison reading
  ("the business reading"), genuinely different on `judgment.targetHouse`
  (10 vs. 7).
- A reply: `"As for the business reading, house number 8 governs this
  matter, quite different from the career question."` — 8 is fabricated
  relative to the business reading's real house (7).
- `validateDiscussionReply(anchor, answer)` — the exact pre-fix call
  shape — returned `valid: false`, but for the WRONG reason: it flagged
  house 8 against the ANCHOR's own house (10), which also happens not to
  be 8. This is a coincidence of the specific numbers chosen, not
  evidence the comparison reading was checked.
- Reproduced properly by additionally constructing the genuine claim
  (`house number 7 governs this matter` — 7 is the business reading's
  real house, fabricated relative to nothing): `validateDiscussionReply
  (anchor, genuineAnswer)` returned **`valid: false`** — a **true**
  statement about the comparison reading was wrongly **rejected**,
  because it was checked against the anchor's own, different house (10).

This is the concrete, load-bearing proof of the gap: not merely
"a false claim can get through" (the specific numbers in the first probe
made that hard to demonstrate cleanly against only two contracts), but
the sharper, unambiguous proof — **a comparison reading's own true facts
are indistinguishable, to the pre-fix validator, from a comparison
reading's fabricated facts, because neither is ever checked against that
reading's actual contract.** Both a genuine comparison claim and a false
one are validated against the wrong (anchor's) contract, so the outcome
for either is arbitrary — sometimes a lucky coincidence catches a
fabrication, sometimes it wrongly rejects the truth. Full script content
and both probe outputs are reproduced in the review evidence for the
independent Review Gate.

## 3. The correction

Smallest architectural change that makes every referenced reading
independently authoritative, reusing the existing single-contract
`validateDiscussionReply()` primitive unmodified rather than building a
second validator:

1. **`ReadingGrounding` now carries its own `contract: ReadingContract |
   null`** (`discussionComposer.ts`) — the anchor and every comparison
   reading are symmetric: each grounding IS its own authority, not a
   special-cased side channel. `DiscussionInput`'s separate top-level
   `contract` field is removed; the anchor's contract is simply
   `groundings[0].contract`.
2. **`segmentReplyByGrounding(answer, groundings)`** (new, exported) —
   attributes each part of the reply to the specific grounding it names.
   Single-reading threads (the overwhelming majority — no
   `compareReadingIds`): one segment, the whole reply, against the
   anchor — byte-identical to pre-5F-R2 behavior. Multi-reading threads:
   splits on each grounding's label's first literal (case-insensitive)
   occurrence; text before any label goes to the anchor. Two
   conservative, safety-first fallbacks: identical labels among
   groundings, or no label named at all, both fall back to the entire
   reply checked against the anchor only (never weaker than pre-5F-R2,
   never silently permissive).
3. **`validateDiscussionReplyAgainstGroundings(groundings, answer)`**
   (new, exported) — segments the reply, then calls the UNMODIFIED
   `validateDiscussionReply()` once per segment against that segment's
   own grounding's contract. A grounding with `contract: null` skips
   validation for its own segment only — the exact Phase 5F precedent
   for a missing contract, applied uniformly instead of only to the
   anchor.
4. **`discussReading.ts`**: `labelsFor(docs)` (new, exported) assigns
   every reading in the call a label together, disambiguating a repeated
   category with a numeric suffix (" (2)", " (3)", ...) from its second
   occurrence — the anchor, always index 0, is always the first
   occurrence of its own category and so is never suffixed.
   `dedupeIds(ids)` (new, exported) de-duplicates `compareReadingIds`
   before the transaction reads them, first-occurrence-wins, so a
   duplicate id can never produce two identical groundings with
   identical labels in the first place. `toGrounding` now attaches
   `asReadingContract(d.readingContract)` for EVERY doc, anchor and
   comparison alike, not only the anchor.
5. **`composeDiscussionReply()`** now calls
   `validateDiscussionReplyAgainstGroundings(input.groundings, answer)`
   instead of `validateDiscussionReply(input.contract, answer)`. On
   failure it returns `null`, the exact same, pre-existing "no reply"
   outcome Phase 5F already established — not a new policy.

No new check was added to `narrationValidator.ts`. No existing check's
logic changed. `narrationValidator.ts` and `textSecurity.ts` are both
untouched (confirmed in §7).

## 4. Deterministic behavior for every required edge case

| Case | Behavior |
|---|---|
| Comparison reading missing (bad/foreign id) | Already dropped upstream by the existing ownership/existence transaction check (unchanged); never becomes a grounding, nothing to attribute to it. |
| Comparison `ReadingContract` missing (legacy reading) | That grounding's `contract` is `null`; its own segment skips validation, exactly the Phase 5F anchor precedent, applied per-grounding. |
| Invalid/unknown reading id | Same as "missing" above — filtered upstream, unchanged. |
| Multiple comparison readings | Each gets its own label and its own contract; each segment independently checked. |
| Mixed anchor + comparison claims | Text before the first label → anchor; each labeled run → its own reading. |
| Duplicate comparison ids | `dedupeIds()` collapses them before the transaction ever reads them — no duplicate grounding, no duplicate label, no ambiguity to fall back from. |
| Two DISTINCT readings sharing one category (e.g. two "finance" readings) | `labelsFor()` disambiguates with a numeric suffix, so `segmentReplyByGrounding()` never sees a genuine collision from this cause. |
| A reply that names no comparison label at all | Whole reply checked against the anchor only — unchanged from pre-5F-R2. |

## 5. Tests

Two new permanent test files, plus targeted updates to two existing ones
(interface-shape churn only — no assertion in either existing file was
weakened or removed):

- **`functions/src/oracle/__tests__/discussionComparisonValidation.test.ts`**
  (29 tests) — the full required matrix: anchor-only unchanged;
  valid single comparison reading; multiple comparison readings each
  independently authoritative; mixed anchor+comparison claims each
  checked against its correct source; fabricated/contradictory
  comparison claims rejected (house, verdict, celestial-entity); missing
  comparison reading and missing comparison contract handled
  deterministically; ambiguous/duplicate-label fallback; prompt
  injection targeting a comparison reading cannot alter the authoritative
  check; `segmentReplyByGrounding` unit behavior including the
  documented residual limitation (§6); no regression against the
  existing single-grounding ground-truth corpus; and a live
  `composeDiscussionReply()` integration proving the fix at the actual
  output boundary, not only at the validator's own internal call.
- **`functions/src/functions/__tests__/discussReading.test.ts`** (9 tests,
  new file) — `labelsFor()` and `dedupeIds()` as pure functions, covering
  disambiguation ordering, three-way collision, determinism across
  repeated calls, and duplicate-id collapsing.
- **`discussionComposer.test.ts`** — `GROUNDING`/`second` fixtures gained
  a `contract: null` field (interface now requires it); no assertion
  changed.
- **`discussionValidation.test.ts`** — `grounding()` now takes an
  explicit `contract` parameter and attaches it per-grounding instead of
  via the now-removed top-level `DiscussionInput.contract`; the three
  `composeDiscussionReply()` integration tests updated to match; no
  assertion changed, and all still pass.

## 6. Residual limitation — disclosed, not fixed

Label-based attribution is a bounded, phrase-anchored heuristic,
consistent with every other check this validator already uses — it is
not a semantic parser. One concrete, demonstrated limitation:

**Anchor-genuine text that appears AFTER a comparison label in the reply
is attributed to that comparison reading, not the anchor**, until the
next label or the end of the string. Example (from the test suite):
`"As for the business reading, X. But back to the original question,
house number <career's real house> governs this matter."` — the trailing
sentence is genuinely about the anchor, but is attributed to the business
reading's segment and checked against its contract instead, because no
second occurrence of the anchor's own label follows.

This can only ever cause **over-rejection** (a genuine claim checked
against the wrong, but still real, contract), never **under-rejection**
(a claim escaping validation entirely) — the exact asymmetry the
governing "do not weaken existing validation" instruction requires. A
full semantic claim-attribution parser that tracks topic shifts within a
sentence was judged out of this phase's scope: it would require
interpreting meaning, not matching a server-assigned literal string,
crossing from "deterministic, bounded check" into exactly the kind of
judgment this project's architecture keeps out of the validation layer
by design.

## 7. Regression results (full matrix, re-run fresh)

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **489/489** (21 files; was 451 — 38 new tests: 29 + 9) |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root) | **306/306**, unaffected |
| `node scripts/sync-engine.mjs --check` | clean |
| Golden corpus | **111/111**, untouched (`git diff --stat` empty) |
| Replay check | **24/24**, byte-identical |
| 11,923-case adversarial harness (scratch `--out-dir=docs/audit/phase-5f-r2`) | **0 false negatives, 0 false positives, 0 exceptions, 0 contract mutations** — unchanged from the pre-fix baseline |
| Prohibited-path diff (`bf5198c..HEAD`, engine/`kp/`/`readingContract.ts`/`remedySelection.ts`/`remedyLibrary.ts`/`textSecurity.ts`/`narrationValidator.ts`/prompts/`firestore.rules`/golden corpus, all at once) | **empty** |

## 8. Exact changed-file boundary

`functions/src/functions/discussReading.ts`,
`functions/src/oracle/discussionComposer.ts` (implementation);
`functions/src/oracle/__tests__/discussionComposer.test.ts`,
`functions/src/oracle/__tests__/discussionValidation.test.ts` (existing,
interface-shape updates only); `functions/src/oracle/__tests__/
discussionComparisonValidation.test.ts`,
`functions/src/functions/__tests__/discussReading.test.ts` (new);
this document. No other file. `classifyQuestion.ts` untouched. The
judgment engine, astronomical calculations, verdict semantics, timing
logic, and remedy logic are all untouched — this phase never reads or
writes a `WatchVerdict`, `RkpDiagnosis`, or `RemedyProtocol` field; it
only routes an already-computed `ReadingContract` to the correct
validation call. `PROHIBITED_TERMINOLOGY`/debranding scope untouched.

## 9. Scope discipline

No hard-stop condition was triggered: the comparison-reading contract
was made authoritative without touching the judgment architecture (it
was already computed and persisted by Phase 5F — this phase only routes
it correctly); anchor-only behavior is unchanged (§3.2, proven directly
by test); no P0/P1 was discovered outside this scope; nothing here
touches Phase 6/deferred infrastructure; the regression baseline is
unchanged for every existing check; and every required edge case (§4)
resolves deterministically. P5A-2 (the dead `classifyQuestion` callable,
deferred to Phase 6 at the Residual Disposition Gate) was not touched,
widened, or reconsidered.

## 10. Final status

**PHASE 5F-R2: IMPLEMENTATION CHECKPOINT — PASS.**

The comparison-reading validation gap (Residual Disposition Gate item 6)
is closed: every reading a discussion response can reference is now
independently authoritative and validation-covered, using the exact
existing single-contract validator, attributed via a bounded,
deterministic, disclosed-limitation label-matching mechanism. Anchor-only
behavior is unchanged. Zero regressions across the full matrix. This
document does not close Phase 5F-R2 — per the governing authorization,
it awaits the independent Review Gate.
