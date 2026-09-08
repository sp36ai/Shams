# Phase 5C — AI/Narration Adversarial Testing (Generative Validator Fuzzing)

**Date:** 2026-09-08
**Checkpoint at start:** 5B/5B-R/5B-R2 closed (engine mirror synchronized +
drift-detected, 17 previously-endangered tests preserved and executing,
golden corpus reconciled — 111/111 deterministic, 24/24 replay, functions
189/189, app 304/304, both typecheck/lint clean).
**Nature of this phase:** offline, deterministic, generative/combinatorial
+ metamorphic adversarial testing of `validateNarration()` at scale. No
network or Anthropic API call was made anywhere in this phase. No fixes
were applied to any finding.

---

## A. Objective and acceptance criteria

**Objective:** stress-test the existing `validateNarration()` implementation
at scale using systematically generated adversarial narration variants
against real, immutable `ReadingContract` objects, looking for false
negatives the 13 hand-authored Phase 4/4A fixtures cannot expose.

**Invariant under test:** *a narration that materially contradicts
authoritative contract data must never be accepted as valid.*

**Acceptance criteria** (as authorized): ≥1,000 meaningful variants per
high-risk category (timing, verdict, certainty, terminology, celestial
entities) where combinatorics support it; ≥10,000 total generated cases;
deterministic, seed-free generation; reproducible failing case IDs;
mutation metadata recorded for every finding; full metamorphic pairing
(known-valid → mutation → expected result known in advance); a complete
metric accounting (generated / executed / expected-invalid / caught /
unexpected-valid / exceptions / false positives / false negatives /
unique bypass classes); **false negatives = 0 required for an
unconditional PASS**; no validator modification under any circumstance.

---

## B. Contract pool

11 `ReadingContract` objects, all produced by the real, unmodified engine
chain (`classifyQuestion → buildWatchChart → judgeWatchChart →
toBoundaryPlanetName ×3 → diagnose → selectRemedyProtocol →
buildReadingContract` — the exact call order `askWatchOracle.ts` uses).
Ten are built from question/instant/offset inputs taken from 10 of the
111 existing golden-corpus cases, selected specifically for diversity
(inspected before selecting — not assumed); the eleventh is a legitimate,
deterministic transformation of one real contract (removing remedy steps,
`interventionRequired: false`) — the identical technique
`narrationValidator.test.ts`'s own `noIntervention` fixture already
uses — needed because zero of the 111 golden cases have
`interventionRequired: false` (confirmed by inspection).

| Contract | Verdict state | Timing posture | Diagnosis pattern | Obstructing agent | Intervention | Celestial entities |
|---|---|---|---|---|---|---|
| employment-001 | BLOCKED | WAIT | CONFLICT | Mars | yes (3 steps) | Zuhal, Mars |
| business-007 | BLOCKED | WAIT | OBSTRUCTION | Saturn | yes (4 steps) | Zuhrah, Mars, Saturn |
| finance-002 | DELAYED | WAIT | CONFLICT | Mars | yes (3 steps) | Utarid, Venus, Mars |
| family-002 | DELAYED | WAIT | UNCERTAINTY | Ras | yes (4 steps) | Zuhrah, Venus, Ras |
| business-002 | DELAYED | WAIT_LONG | NEEDS_PATIENCE | none | yes (3 steps) | Mirrikh, Venus |
| business-005 | FULFILLED | WAIT_LONG | OBSTRUCTION | Saturn | yes (3 steps) | Mushtari, Mercury, Saturn |
| ambiguous-002 | MOVING | ACT_SOON | NEEDS_DECISIVE_ACTION | none | yes (3 steps) | Qamar, Moon |
| business-004 | REVERSING | WAIT_LONG | CONFLICT | Mars | yes (4 steps) | Zuhal, Moon, Mars |
| education-003 | UNFORMED | UNKNOWN | UNCERTAINTY | Dhanab | yes (3 steps) | Shams, Jupiter, Dhanab |
| general-001 | BLOCKED | WAIT | UNCERTAINTY | Dhanab | yes (3 steps) | Mirrikh, Mars, Dhanab |
| business-005-no-intervention (synthetic) | FULFILLED | WAIT_LONG | OBSTRUCTION | Saturn | **no** (0 steps) | Mushtari, Mercury, Saturn |

Every verdict state (BLOCKED, DELAYED, FULFILLED, MOVING, REVERSING,
UNFORMED), every timing posture (WAIT, WAIT_LONG, ACT_SOON, UNKNOWN), and
five distinct obstructing agents (Mars, Saturn, Ras, Dhanab, none) are
represented — a materially diverse sample, per the authorized scope, not
an exhaustive enumeration.

Every contract's deterministic fallback narration
(`buildDeterministicFallbackNarration()`) was confirmed to itself pass
`validateNarration()` before being used as the harness's metamorphic
"known-valid" anchor (this is exactly what that function's own existing
test suite already proves — `narrationValidator.test.ts`'s
`buildDeterministicFallbackNarration` describe block — re-confirmed live
against all 11 pool contracts here, zero exceptions).

---

## C. Harness design

`functions/scripts/adversarial-harness/` — offline, deterministic, no
network/API code anywhere in the harness. Run via
`npx vite-node scripts/adversarial-harness/run.ts` (from `functions/`).

- **`contracts.ts`** — builds the 11-contract pool described above.
- **`textMutators.ts`** — 16 pure, seed-free presentation-transform
  primitives (case, whitespace, zero-width characters, RTL marks,
  fullwidth forms, combining marks, punctuation, quoting, title case).
- **`types.ts`** — the `GeneratedCase` shape (id, category, contract id,
  full `NarrationFields`, expected validity, mutation metadata).
- **`generators.ts`** — 11 category generator functions, each a real
  cross-product over contract × phrase/term × sentence template ×
  (sometimes) mutator, risk-weighted per the authorization.
- **`run.ts`** — executes every generated case through the real,
  unmodified `validateNarration()`, classifies each outcome, and writes
  `docs/audit/phase-5c/{summary,false-negatives,false-positives-sample,
  exceptions,bypass-classes}.json`.

Every case takes the contract's own deterministic fallback narration as a
base and replaces exactly one field (`interpretation`) with the
adversarial text — the same shape a real drafted narration takes
(`NarrationFields` with the other fields intact) — so `validateNarration`
is exercised exactly as `responseComposer.ts` calls it in production,
never with a synthetic/malformed input shape it wasn't designed for
(malformed-shape testing is its own separate, deliberately small category
— §D/§E).

**No randomness anywhere.** Every axis is an explicit, finite array;
every combination is produced by nested iteration, not sampling. The
entire 10,435-case run is byte-for-byte reproducible on any machine
running the same source.

---

## D. Metamorphic invariants exercised

1. **Presentation-only mutation of a known-valid narration → still VALID.**
   864 cases: the fallback narration's own text, put through all 16
   presentation mutators, across every field that has content, across
   every contract.
2. **Decision-altering mutation of contract-consistent text → INVALID.**
   The core of every risk-weighted category — a wrong timing claim, a
   wrong certainty assertion, a wrong verdict polarity, a wrong
   obstructing agent, a wrong remedy, a disallowed planet, a leaked
   internal term, an injection-compliance artifact.
3. **Hedge-qualified soft-immediacy mutation → stays VALID** (the
   validator's own Phase 4A design decision) — 270 timing cases
   (`soft-hedged-should-stay-valid`) and 90 certainty-hedge-control cases,
   both expecting `VALID`, both confirmed correct (0 false positives in
   either sub-category).
4. **Strong-immediacy mutation even when hedged in the same sentence →
   still INVALID** (Phase 4A's own "strong signals are unconditional"
   design) — 360 timing cases (`strong-hedged-still-invalid`), confirmed
   correct.
5. **Allowed-entity control → stays VALID** — 22 celestial-entity cases
   naming a planet actually in the contract's own allow-list, confirmed
   correct.
6. **Unicode-obfuscated variant of an otherwise-decision-altering claim →
   the claim is still materially made to a human reader, so still
   expected INVALID** — this is the axis that produced every finding
   below (§F).

---

## E. Results

```
generated:              10,435
executed:                10,435
expectedInvalid:          9,102
expectedValid:            1,333
caught:                   7,500
accepted:                 1,333
falseNegativeCount:        1,602   <-- the critical metric
falsePositiveCount:            0
exceptionCount:                0
contractMutations:             0
uniqueBypassClassCount:        4
```

Per-category breakdown:

| Category | Total | False negatives | False positives | Exceptions |
|---|---|---|---|---|
| presentation-neutral | 864 | 0 | 0 | 0 |
| timing | 1,815 | 360 | 0 | 0 |
| certainty | 1,836 | 549 | 0 | 0 |
| terminology | 2,212 | 528 | 0 | 0 |
| celestial-entities | 1,155 | 165 | 0 | 0 |
| verdict | 1,190 | 0 | 0 | 0 |
| remedy | 770 | 0 | 0 | 0 |
| diagnosis | 495 | 0 | 0 | 0 |
| internal-data-leakage | 40 | 0 | 0 | 0 |
| injection-artifacts | 35 | 0 | 0 | 0 |
| malformed-output | 23 | 0 | 0 | 0 |

All five high-risk categories named in the authorization (timing,
certainty, terminology, celestial entities, verdict) exceed the 1,000-case
target. Total exceeds 10,000. **0 exceptions** — the validator never threw
under any of the 10,435 cases, including all 23 deliberately malformed
`NarrationFields` shapes (empty strings, whitespace-only, `null`,
`undefined`, wrong types) — confirming the fail-closed design holds under
this scale, not just the hand-authored fixtures. **0 contract
mutations** — every one of the 10,435 calls left its `ReadingContract`
byte-identical before and after (checked via `JSON.stringify` equality on
every call, redundant confirmation of Phase 5B's `Object.isFrozen` proof,
specific to this harness's own inputs). **0 false positives** after one
harness-authoring bug was found and corrected in the harness itself, not
the validator (§below) — every metamorphic "should stay valid" case
(presentation mutations, hedged-soft-immediacy, hedged-certainty,
allowed-entity, in-range day-counts) was correctly accepted.

**One harness-authoring bug found and fixed during this phase (not a
validator finding):** an initial terminology-category control sentence,
"look positive about tomorrow," was meant to test a legitimate
2-3-letter-substring collision risk but accidentally also contained the
real word "tomorrow" — itself a genuine `STRONG_IMMEDIACY_SIGNALS` entry —
so the validator correctly rejected it (on a WAIT-posture contract) for a
completely different, correct reason than the one the case was designed
to test. This was the harness's test-data error, not a validator
over-rejection; corrected to "look positive about the outcome" and
re-run, after which false positives are 0. Recorded here rather than
silently fixed, per the same evidence-over-assertion discipline as every
other finding in this phase.

---

## F. Findings

**No P0.** **Four related P1 findings**, all reducible to one mechanical
root cause, discovered only by the scale and Unicode-mutation axis this
phase specifically authorized (Phase 5A had already found the same
mechanism against the unrelated keyword *classifier*, a non-security
function — this is the first time it has been proven against the actual
safety-boundary *validator*).

### P5C-1 (P1) — Zero-width/Unicode-obfuscated timing-immediacy phrases bypass `checkTimingConsistency`

**Root cause:** `STRONG_IMMEDIACY_SIGNALS.find(s => lower.includes(s))`
and `SOFT_IMMEDIACY_SIGNALS.find(s => lower.includes(s))` (both in
`narrationValidator.ts`) are literal-substring matches. Inserting a
zero-width joiner/non-joiner/space inside the target word (e.g.
`"tom‍orrow"`), or rendering it in fullwidth Unicode forms, or adding
combining diacritics, defeats `.includes()` while the text still reads as
the same word to a human.

**Exact reproduction:**
- Input: contract `employment-001` (BLOCKED, WAIT posture, 45-90-day-shaped
  timing window).
- Narration `interpretation` field: `"This will resolve tom‍orrow."`
  (the word "tomorrow" with a zero-width joiner, U+200D, inserted after
  "tom").
- Path: `validateNarration(contract, narration)` →
  `checkTimingConsistency` → `STRONG_IMMEDIACY_SIGNALS.find(s =>
  lower.includes(s))` → no match (the literal substring `"tomorrow"` is
  not present) → check returns `null` → no other check fires →
  `result.valid === true`.
- Expected: `INVALID` (`TIMING_ALTERATION`) — a WAIT-posture reading
  narrated as resolving "tomorrow" is exactly the P1 finding Phase 4A was
  built to fix (the *literal* word), and the obfuscated form makes the
  identical false claim to any reader.
- Actual: `VALID`.
- Why it matters: this is the exact class of claim (a WAIT-posture
  reading narrated as immediate) Phase 4A's entire remediation was built
  around — the mechanism that closes the *literal* form does not close
  this trivially-obfuscated one.
- Scale: 360/1,815 timing cases (all five Unicode mutators ×
  8 strong-immediacy phrases × 9 WAIT/WAIT_LONG contracts).

### P5C-2 (P1) — Zero-width/Unicode-obfuscated certainty phrases bypass `checkUnsupportedCertainty`

Identical mechanism against `CERTAINTY_PHRASES.find(p => lower.includes(p))`.

**Exact reproduction:**
- Input: contract `employment-001` (confirmed certainty-check-applicable:
  `checkUnsupportedCertainty(contract, 'interpretation', 'This is
  guaranteed.')` returns a failure on the unobfuscated phrase).
- Narration: `"This is guar‍anteed."` (zero-width joiner inserted inside
  "guaranteed").
- Path: `checkUnsupportedCertainty` → `CERTAINTY_PHRASES.find(p =>
  lower.includes(p))` → no match → `null` → `result.valid === true`.
- Expected: `INVALID` (`UNSUPPORTED_CERTAINTY`).
- Actual: `VALID`.
- Scale: 549/1,836 certainty cases.

### P5C-3 (P1) — Zero-width/Unicode-obfuscated prohibited terminology bypasses `checkTerminologyLeakage`, and a distinct multi-word-term whitespace gap

Two related mechanisms under the same check:
- (a) The same Unicode-obfuscation mechanism against
  `scanForDenyList()`'s `lower.includes(term.toLowerCase())` — reproduced
  for `"Krishnamurti"`, `"ReadingContract"`, `"watchJudgment"`, and every
  other single-token entry in `PROHIBITED_TERMINOLOGY` (the Phase 4A
  `RKP_OBFUSCATED_PATTERN` regex is itself immune to this exact technique
  for the literal string "RKP" — confirmed 0 false negatives for `term:
  'RKP'` specifically — but the 22 *other*, plain-substring-matched
  entries in the same deny-list are not).
- (b) A narrower, distinct gap: the one **multi-word** entry, `"house
  matrix"`, fails to match once its internal single space becomes a
  double space or a tab (`extraWhitespace`/`tabsInsteadOfSpaces` — neither
  a Unicode-obfuscation technique, just ordinary whitespace variation) —
  12 of the 528 terminology false negatives are this narrower sub-case,
  confirmed by inspecting every false negative's `mutator` field.

**Exact reproduction (mechanism a):**
- Input: contract `finance-002` (any contract — this check takes no
  contract-dependent state).
- Narration: `"This comes from Krishn‍amurti directly."` (zero-width
  joiner inserted inside "Krishnamurti").
- Path: `checkTerminologyLeakage` → `scanForDenyList` → no substring
  match → `RKP_OBFUSCATED_PATTERN.test()` → also no match (the pattern is
  specific to "r-k-p") → `null` → `result.valid === true`.
- Expected: `INVALID` (`TERMINOLOGY_LEAKAGE`) — this is exactly the deny
  list's own stated purpose (internal implementation vocabulary that must
  never reach the seeker), obfuscated by one invisible character.
- Actual: `VALID`.
- Scale: 528/2,212 terminology cases (516 Unicode-obfuscation + 12
  multi-word-whitespace).

### P5C-4 (P1) — Zero-width/Unicode-obfuscated planet names bypass `checkCelestialEntities`

Same mechanism against `disallowedEntityNames()`'s
`new RegExp('\\b' + escapeRegExp(name) + '\\b', 'i').test(text)` — the
word-boundary regex still requires the literal, unbroken name.

**Exact reproduction:**
- Input: contract `employment-001` (`celestialEntities: ["Zuhal",
  "Mars"]` — "Zuhrah" (Venus) is confirmed disallowed for this contract:
  `checkCelestialEntities(contract, 'interpretation', "Zuhrah weighs
  heavily on this matter.")` returns a failure on the unobfuscated form).
- Narration: `"Zuhr‍ah weighs heavily on this matter."` (zero-width
  joiner inside "Zuhrah").
- Path: `checkCelestialEntities` → the disallowed-name regex requires an
  unbroken match → none found → `null` → `result.valid === true`.
- Expected: `INVALID` (`UNAUTHORIZED_CELESTIAL_ENTITY`) — this is
  precisely the P0-adjacent claim category the brief calls out
  ("celestial-entity authorization" is explicitly listed as
  decision-bearing) obfuscated by one invisible character.
- Actual: `VALID`.
- Scale: 165/1,155 celestial-entity cases.

### Severity rationale

Classified **P1** ("a realistic production path can materially diverge
from canonical behavior" / "narration safety" per the standing Phase 5
rubric), not P0: no path found in this phase lets an attacker alter the
*engine's own* truth (`ReadingContract` remains untouched and correctly
frozen in every one of the 10,435 cases — §E), and no path was found that
lets a *client* or a *user* directly control this obfuscated text (that
would require Claude's own drafted narration to spontaneously contain
zero-width/fullwidth/combining-mark characters, which is plausible but
was not observed or tested against a live model in this phase — 5C is
explicitly offline, no Anthropic API calls). What is proven, concretely
and reproducibly, is that **if** such text ever reached the validator —
from Claude, from a future feature, or from any other narration source —
it would pass as `VALID` and reach the seeker unfiltered, defeating
exactly the invariant Phase 4/4A exist to guarantee. That is a real
weakening of the narration-safety boundary, not a demonstrated live
exploit against a real user — hence P1, not P0.

**Not fixed, per explicit instruction.** No modification was made to
`narrationValidator.ts` or any other production file as a result of
these findings.

---

## G. Test matrix

| Command | Result |
|---|---|
| `cd functions && npx vite-node scripts/adversarial-harness/run.ts` | 10,435 generated/executed; 1,602 false negatives (4 unique bypass classes); 0 false positives; 0 exceptions; 0 contract mutations |
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && node scripts/sync-engine.mjs --check` | exit 0, "matches src/astrology/" |
| `cd functions && npx vitest run` | 189/189 passed, 14 files — unchanged from the 5B-R2 baseline |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root, Jest) | 304/304 passed, 27 suites — unchanged |
| `npx vite-node functions/scripts/generate-golden-corpus.ts` + `diff -rq` against a pre-run backup | 111/111 identical — golden corpus untouched |
| `npx vite-node functions/scripts/replay-check.ts` | 24/24 identical |

No existing test was modified, skipped, or rewritten. No golden-corpus
file changed. No engine, oracle, prompt, validator, contract, UI, or
Firestore-rule file was touched.

---

## H. Production drift verification

`git status --porcelain` at the end of this phase:

```
?? docs/audit/phase-5c/
?? functions/scripts/adversarial-harness/
```

`git diff --stat` (against every already-tracked file): **empty.**
Explicit scoped checks against every forbidden path (`functions/src/engine/`,
`functions/src/oracle/narrationValidator.ts`, `narrationFallback.ts`,
`readingContract.ts`, `narrationContext.ts`, `functions/src/prompts/`,
`src/astrology/`, `firestore.rules`, app `src/`) — **all empty.**

**Production code changed: 0.** Every new file is either new offline test
tooling (`functions/scripts/adversarial-harness/`, in the same category
as the project's own pre-existing `generate-golden-corpus.ts`/
`replay-check.ts`) or generated evidence output
(`docs/audit/phase-5c/*.json`).

---

## I. Remaining risks / scope notes

- This phase deliberately did not call the live Anthropic API — it proves
  the *validator's* gap, not whether Claude's real output would ever
  produce the obfuscated text needed to trigger it. That is a distinct,
  narrower question a future phase could investigate (e.g., adversarial
  prompt-injection testing against the real model), out of this phase's
  offline scope.
- The 4 findings share one root cause (literal-substring/word-boundary
  matching defeated by inserted invisible or visually-similar Unicode).
  A remediation, if authorized, would likely be a single shared
  normalization step rather than four separate fixes — but that decision,
  and any validator change at all, is explicitly out of this phase's
  scope.
- The RKP-specific obfuscation defense added in Phase 4A
  (`RKP_OBFUSCATED_PATTERN`) is *not* vulnerable to this exact technique
  (confirmed: 0 false negatives for the "RKP" term specifically) — it
  uses a separator-tolerant pattern rather than a plain substring check.
  This is worth noting as evidence the general mechanism (a
  purpose-built, non-`.includes()` pattern) is a viable direction, without
  this phase prescribing that as the fix.
- The multi-word "house matrix" whitespace gap (§F, P5C-3b) is a narrower,
  independent sub-finding within the same check — worth tracking
  separately since its fix (if any) would differ in shape from the
  Unicode-obfuscation fix.

---

## Acceptance criteria — checked against the authorization

- [x] ≥1,000 meaningful variants for each of timing, verdict, certainty,
      terminology, celestial entities (1,815 / 1,190 / 1,836 / 2,212 / 1,155)
- [x] ≥10,000 total generated cases (10,435)
- [x] Deterministic, seed-free generation (no randomness anywhere in the harness)
- [x] Reproducible failing case IDs (`docs/audit/phase-5c/false-negatives.json`,
      every entry carries a stable id and full mutation metadata)
- [x] Real contracts across materially different verdict/timing/diagnosis/
      remedy/celestial configurations (§B)
- [x] Metamorphic testing performed, not only template generation (§D)
- [x] Full metric accounting, not "N tests passed" (§E)
- [x] No validator modification of any kind
- [x] Every bypass reproduced, classified, documented — not fixed (§F)
- [x] No exceptions, no contract mutation, confirmed explicitly (§E)
- [x] Full regression matrix green (§G)
- [x] No unauthorized production drift (§H)

---

## FINAL STATUS

Testing completed at full authorized scale. **Four related, reproducible
P1 validator-bypass classes were discovered and documented** (zero-width/
Unicode-obfuscated immediacy phrases, certainty phrases, prohibited
terminology, and celestial-entity names, plus one narrower multi-word
whitespace gap). False negatives are **not** zero (1,602 of 10,435). No
production fix was applied, per explicit instruction.

**PHASE 5C: PASS WITH FINDINGS**

STOP. No remediation was performed. No Phase 5D work was started. No
`kp/` primitive was touched. The 4/18 remedy-taxonomy decision was not
reopened. No unrelated cleanup was performed. Awaiting review before any
further action.
