# Phase 5C-R — Unicode/Obfuscation Validator Remediation

**Date:** 2026-09-08
**Scope:** remediate exactly the four P5C bypass classes (Unicode/
zero-width/format/combining-mark/whitespace matching gaps) and nothing
else. No engine, judgment, diagnosis, remedy library/selection, contract
schema, prompt, UI, `kp/`, or golden-corpus change.

---

## A. Root cause

`narrationValidator.ts`'s checks all do the same thing: lowercase the
incoming text and run a literal `.includes()` or word-boundary regex
against a fixed phrase/term/name list. Phase 5C's 11,923-case (originally
10,435-case) generative/metamorphic harness proved four related classes
where this fails:

1. A zero-width joiner/non-joiner/space, word joiner, or bidi control
   character (all Unicode General Category **Cf**, "Format") inserted
   inside a target word defeats `.includes()` while the text still reads
   identically to a human.
2. A combining diacritic mark or variation selector (General Category
   **Mn**, "Nonspacing Mark") — whether it arrives already decomposed, or
   as a precomposed single character like "ú" — has the same effect.
3. A fullwidth Unicode compatibility form (e.g. fullwidth Latin letters)
   likewise defeats matching.
4. A distinct, narrower gap: the one multi-word deny-list entry ("house
   matrix") fails to match once its internal single space becomes a
   double space or a tab.

None of these touch the deterministic engine, `ReadingContract`, or the
judgment/diagnosis/remedy authority — Phase 5C already confirmed 0
contract mutations across every one of its 11,923 cases, reconfirmed here
(§F).

---

## B. Architectural decision

**One canonical security-normalization primitive, applied once per
narration field, inside `validateNarration()`'s own loop — not four
independent per-check patches.**

`functions/src/oracle/textSecurity.ts` — a single exported function,
`canonicalizeForSecurityMatching()`:

```
text
  → .normalize('NFKD')        // decompose FIRST — see below for why
  → strip every \p{Mn} codepoint   // combining marks, variation selectors
  → strip every \p{Cf} codepoint   // zero-width chars, word joiner, bidi controls
  → collapse whitespace runs to one space, trim
```

**Why decompose before stripping, not after:** reconnaissance before
writing any code proved that composing first (NFKC) and then stripping
`\p{Mn}` misses a *precomposed* accented character entirely — "ú" (U+00FA)
is its own single codepoint, category `Ll`, not `Mn`, so a
compose-then-strip approach leaves it untouched while a genuinely
decomposed "u" + combining-acute gets fixed. NFKD decomposes both forms
into base + combining mark *first*, so both are stripped identically.
This ordering bug was found and corrected during reconnaissance, before
any test was written against it (see the conversation record; re-derived
and confirmed again in `textSecurity.ts`'s own header comment and its
dedicated `precomposedAccent` unit test).

**Where it is NOT applied:** `NarrationFields`, `ReadingContract`, any
persisted or client-facing value. The canonicalized string exists only as
an ephemeral local inside `validateNarration()`'s loop, passed into each
check function instead of the raw text — the checks' own internal
`.toLowerCase()`/`.includes()`/regex logic is completely unchanged, only
what they receive changed. See §E for the explicit non-mutation proof.

**Deliberately NOT done** (per explicit instruction, confirmed by
reconnaissance to be real, separate bypasses — see §G): homoglyph/
confusable folding (Cyrillic "о" → Latin "o"), repeated-character
correction ("tommorrow" → "tomorrow"), ASCII punctuation repair
("guarant.eed" → "guaranteed"). None of these are a Unicode-category
mechanism this primitive's job is to normalize; folding them would be
exactly the "aggressive equivalence" the authorization warned against.

---

## C. Implementation — exact files changed

| File | Change |
|---|---|
| `functions/src/oracle/textSecurity.ts` | **New.** The single primitive, fully documented (what it does, what it deliberately does not do, where it must never be used). |
| `functions/src/oracle/narrationValidator.ts` | `validateNarration()`'s per-field loop now computes `canonicalText = canonicalizeForSecurityMatching(text)` once and passes it to every check instead of raw `text`. `checkRemedyConsistency` gained a `CANONICAL_REMEDY_NAMES` map (`REMEDY_LIBRARY` names, canonicalized once at module load) so the comparison stays symmetric for the four diacritic-bearing remedy names (§D) — this is the one check whose internals needed an actual code change beyond the central canonicalization; every other check's own body is untouched. |
| `functions/scripts/adversarial-harness/textMutators.ts` | Added `precomposedAccent`, `insertWordJoiner`, `insertBidiControl`, `insertVariationSelector` mutators, and `titleCase`/`collapseWhitespace`/`appendTrailingZeroWidthSpace` (added in Phase 5C itself, unrelated to this fix — noted for completeness). |
| `functions/scripts/adversarial-harness/generators.ts` | `UNICODE_AXES` widened from 5 to 9 mutators (adds word joiner, bidi control, variation selector, precomposed accent) to the timing/certainty/terminology/celestial-entity generators. |
| `functions/scripts/adversarial-harness/run.ts` | Added an overridable output directory (`--out-dir=`/`HARNESS_OUT_DIR`), so a post-remediation re-run never silently overwrites Phase 5C's own historical evidence (see §F — this was a real mistake caught and corrected during this phase, not a hypothetical). |
| `functions/src/oracle/__tests__/narrationValidatorUnicodeSecurity.test.ts` | **New.** 57 permanent regression tests — unit tests for the primitive, the four original bypass strings through the real `validateNarration()` path, an expanded per-category metamorphic table, the symmetric-diacritic remedy test, and the non-mutation proof. |

No other file changed. `git diff --stat` at the end of this phase (§H)
confirms exactly this list.

---

## D. The symmetric-diacritic correctness issue — found and fixed before it could regress anything

Four `REMEDY_LIBRARY` entries have legitimate diacritics: *Ṣalāt
al-Istikhārah*, *Duʿā for Ease*, *Qurʾānic Contemplation on Patience*,
*Dhikr of Yā Laṭīf*. If only the incoming narration text were
canonicalized (stripping its diacritics for matching) while
`remedy.name.toLowerCase()` kept its diacritics, a **previously-working**
exact match — narration correctly naming an *unselected* diacritic remedy
by its real name — would have silently stopped matching, a new false
negative introduced by this very fix. Found during reconnaissance, before
writing the fix, by tracing the comparison symmetrically rather than only
the attacker-facing side. Fixed by canonicalizing `REMEDY_LIBRARY` names
once at module load (`CANONICAL_REMEDY_NAMES`) and comparing
canonical-to-canonical. Regression-tested explicitly in both directions
(§E) — this is exactly the "prove the two-sided requirement" the
authorization asked for, applied to the one place in this codebase where
it was a real, not hypothetical, risk.

---

## E. Failure probe and regression evidence (permanent suite)

`functions/src/oracle/__tests__/narrationValidatorUnicodeSecurity.test.ts`
— **57/57 passing**:

- 15 unit tests directly on `canonicalizeForSecurityMatching()` — each
  Unicode category (Cf, Mn, both decomposed and precomposed), fullwidth
  forms, whitespace collapse, idempotency, and an explicit assertion that
  a homoglyph is **not** folded (proving the boundary is real, not just
  documented).
- 5 tests reproducing the exact four original P5C bypass strings (plus
  the distinct "house matrix" whitespace gap) through the real
  `validateNarration()` production path — every one now correctly
  `INVALID` with the expected failure code.
- 30 tests in an expanded per-category metamorphic table — one target
  phrase per category (timing "tomorrow", certainty "guaranteed",
  terminology "RKP"), each put through 10 mutation shapes (original,
  uppercase, ZWJ, ZWNJ, ZWSP, word joiner, bidi control, variation
  selector, combining mark, precomposed accent) — every one now caught.
- 4 tests for the symmetric-diacritic remedy case (§D): selected remedy,
  clean and NFD-decomposed → both `VALID`; a *different*, unselected
  remedy, clean and NFD-decomposed → both correctly `INVALID` with
  `REMEDY_SUBSTITUTION`/`REMEDY_ADDITION`.
- 4 non-mutation proof tests: the `narration` object and the
  `ReadingContract` object `validateNarration()` receives are both
  byte-identical (`JSON.stringify` equality) before and after the call,
  across a `VALID` case and an obfuscated `INVALID` case; the contract
  remains `Object.isFrozen` at every level afterward.

All 189 pre-existing `functions/` tests continue to pass unchanged
(246/246 total after adding this file).

---

## F. Generative regression — full corpus re-run

Re-ran the Phase 5C harness against the remediated validator, from the
same `functions/scripts/adversarial-harness/` machinery Phase 5C built,
widened per §C to 9 Unicode axes instead of 5:

```
generated:              11,923   (was 10,435 before widening)
executed:                11,923
expectedInvalid:         10,374
expectedValid:            1,549
caught:                  10,374
accepted:                 1,549
falseNegativeCount:            0   <-- was 1,602
falsePositiveCount:            0   <-- unchanged from Phase 5C's own 0
exceptionCount:                0
contractMutations:             0
uniqueBypassClassCount:        0   <-- was 4
```

Per-category, all previously-affected categories now show 0 false
negatives (timing 2,103 cases, certainty 2,160, terminology 2,740,
celestial-entities 1,287, all 0/0/0/0); every category untouched by the
original findings (verdict, remedy, diagnosis, internal-data-leakage,
injection-artifacts, malformed-output, presentation-neutral) is unchanged
at 0 false negatives, 0 false positives, exactly as before.

**A real mistake caught and corrected during this phase:** the harness's
`run.ts` writes its JSON evidence to `docs/audit/phase-5c` by default —
the first re-run of this phase overwrote Phase 5C's own historical
evidence files (`false-negatives.json` etc.) with the post-fix, now-empty
results, destroying the permanent record Phase 5C's own report cites.
Caught via `git status` before committing, reverted
(`git checkout -- docs/audit/phase-5c/`), and `run.ts` was given an
overridable output directory so this cannot happen silently again — this
phase's own evidence now lives in `docs/audit/phase-5c-r/`, Phase 5C's
original evidence is untouched and confirmed identical to its committed
state.

---

## G. Findings intentionally left unfixed (out of authorized scope)

Reconnaissance confirmed all three remain live bypasses, exactly as
predicted before implementation, and confirmed to STILL bypass after this
fix (tested directly against the remediated `validateNarration()`, not
just asserted):

| Technique | Result after this fix |
|---|---|
| Homoglyph/confusable (Cyrillic "о"/"а" for Latin "o"/"a") | still `VALID` (bypass) |
| Repeated-character padding ("tommorrow") | still `VALID` (bypass) |
| Mid-word ASCII punctuation ("guarant.eed") | still `VALID` (bypass) |

These are recorded here as open, documented findings — not silently
folded into this fix's scope, and not silently left undocumented. Any
remediation for them would be a separate, explicitly-authorized phase
(a different mechanism: cross-script confusable mapping and/or a
different text-mangling detector, not an extension of this Unicode-
category primitive).

---

## H. Regression matrix

| Command | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **246/246 passed**, 15 files (189 pre-existing + 57 new, unchanged elsewhere) |
| `cd functions && npx vite-node scripts/adversarial-harness/run.ts --out-dir=docs/audit/phase-5c-r` | 11,923 generated/executed; **0 false negatives, 0 false positives, 0 exceptions, 0 contract mutations** |
| `cd functions && node scripts/sync-engine.mjs --check` | exit 0, "matches src/astrology/" |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root, Jest) | **304/304 passed**, 27 suites — unchanged |
| `npx vite-node functions/scripts/generate-golden-corpus.ts` + `diff -rq` against a pre-run backup | **111/111 identical** — golden corpus untouched (this fix touches only narration validation, never engine output) |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24 identical** |

**Security checklist** (explicitly verified, not assumed):
- `textSecurity.ts` has **zero imports** — a pure function, no I/O, no
  network, no Firestore, no AI/API access.
- `narrationValidator.ts`'s import list gained exactly one new local
  import (`canonicalizeForSecurityMatching`) — no new external dependency.
- Deterministic by construction: no `Date.now()`, no `Math.random()`, no
  async/await anywhere in the new code.
- No new authority source: the primitive only transforms a local string
  copy used for matching; it never reads or writes `ReadingContract`,
  Firestore, or any client-provided value.
- Contract immutability re-confirmed: 0/11,923 contract mutations in the
  harness re-run, plus a dedicated `Object.isFrozen` assertion in the
  permanent test suite.

---

## I. Production drift verification

`git status --porcelain` at the end of this phase:

```
 M functions/scripts/adversarial-harness/generators.ts
 M functions/scripts/adversarial-harness/run.ts
 M functions/scripts/adversarial-harness/textMutators.ts
 M functions/src/oracle/narrationValidator.ts
?? docs/audit/phase-5c-r/
?? functions/src/oracle/__tests__/narrationValidatorUnicodeSecurity.test.ts
?? functions/src/oracle/textSecurity.ts
```

Explicit scoped checks against every forbidden path
(`functions/src/engine/`, `functions/src/oracle/readingContract.ts`,
`narrationContext.ts`, `narrationFallback.ts`, `remedySelection.ts`,
`remedyLibrary.ts`, `functions/src/prompts/`, `src/astrology/`,
`firestore.rules`, app `src/`, `docs/audit/golden-corpus/`) — **all
empty.** `docs/audit/phase-5c/` (Phase 5C's own historical evidence) is
confirmed unchanged from its committed state (§F).

---

## Acceptance criteria — checked against the authorization

1. [x] All four original P1 bypasses closed (§E, §F)
2. [x] Defined Cf/Mn/fullwidth/whitespace attack model produces 0 false
       negatives (§F)
3. [x] Valid controls produce 0 new false positives (§F)
4. [x] No unexpected validator exceptions (§F, §H)
5. [x] No `ReadingContract` mutation (§F, §E's dedicated proof)
6. [x] Full regression matrix passes (§H)
7. [x] Golden corpus byte-identical (§H)
8. [x] Replay identical (§H)
9. [x] Engine mirror synchronized (§H)
10. [x] No unauthorized production files changed (§I)
11. [x] Exact diff reviewed (§I)
12. [x] Documentation records before/after evidence (this file)

---

## FINAL STATUS

All four original P1 findings are closed, proven by both the full
11,923-case generative corpus (0 false negatives) and a permanent,
compact 57-test regression suite. Two-sided preservation (known-valid
stays valid, known-invalid stays invalid) is proven, including the
symmetric-diacritic remedy-name case the fix's own design required. Three
additional bypasses discovered during reconnaissance (homoglyph/
confusable, repeated-character, mid-word ASCII punctuation) remain
open, documented, and confirmed still-present — explicitly not folded
into this fix, per instruction.

**PHASE 5C-R: PASS**

STOP. Phase 5D is not started. No unrelated cleanup was performed. No
`kp/` primitive, remedy taxonomy, engine logic, contract schema, prompt,
or UI was touched. Awaiting review.
