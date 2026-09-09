# Phase 5E-R2 — False-Positive Remediation

**Status: PASS**

## 1. Scope

`docs/audit/PHASE_5E_R_REVIEW_GATE.md` found four real, reproducible
false-positive classes in the seven Phase 5E-R ground-truth checks, none
caught by that phase's own testing:

- **5E-R-Review-1 (P2):** `checkRulerRelationClaims` flags ordinary
  human-relationship prose ("a colleague regards them as a friend").
- **5E-R-Review-2 (P2):** `checkRetrogradeClaims` flags metaphorical use
  of "retrograde" ("this situation feels retrograde").
- **5E-R-Review-3 (P1):** `checkReversalClaims` flags the idiom "a
  reversal of fortune is possible."
- **5E-R-Review-4 (P2):** `checkDirectionClaims` flags direction words
  inside proper nouns ("points toward the North Star").

This phase remediates exactly these four, and nothing else. Diagnostic-cause
claims remain unimplemented (Phase 5E-R's own documented exclusion, not
reopened here); the non-house/non-date ordinal residual from Finding 5E-2
remains open (also not in this phase's scope).

## 2. Files changed

- `functions/src/oracle/narrationValidator.ts` — the four fixes below.
- `functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts` —
  22 new permanent regression tests (65 total, was 43).

`functions/src/oracle/textSecurity.ts` was **not** touched — none of the
four fixes required a new normalization stage; each is a narrow,
in-check discriminator using data or vocabulary already present in the
file (`PLANET_ALIASES`, `findSentenceContaining()`, the matched text
itself).

## 3. Reconnaissance of current behavior, before changing anything

Re-read all four check functions fresh (not merely re-reading the review's
own summary) before designing any fix:

- `checkRulerRelationClaims`: a single regex,
  `/\bregards?\b[\s\S]{0,60}?\bas\s+(?:an?\s+)?(friend|enemy|neutral)\b/i`,
  matched anywhere in the field text with no requirement that the sentence
  be about an astrological ruler at all.
- `checkRetrogradeClaims`: `/\bretrograde\b/i.test(text)` — the bare word,
  anywhere, with no requirement that a planet or ruler be named.
- `checkReversalClaims`: `/\breversal\b[\s\S]{0,40}?\b(?:is|remains)\s+(...)\b/i`
  — the 40-character gap is wide enough to admit "of fortune" between
  "reversal" and "is/remains," indistinguishable in shape from the
  genuine "reversal of this outcome is X" claim the check exists to catch.
- `checkDirectionClaims`: `DIRECTIONS.find(d => new RegExp(...).test(sentence))`
  — a bare word match with no check for what follows it, so a direction
  word inside a two-word proper noun ("North Star") is indistinguishable
  from a standalone directional claim.

## 4. Claim-recognition strategy — the smallest evidence-based discriminator per class

**Ruler-relation:** require the literal word "ruler" in the same sentence
as the "regards ... as a friend/enemy/neutral" match. Not invented: this
is the field's own documented meaning (`watchJudgment.ts`'s comment, "How
the querent's ruler regards the ruler of the matter") and the ONLY
phrasing any real precedent — the original Finding 5E-1 reproduction and
this suite's own tests — has ever used for this claim ("The querent's
ruler regards the matter's ruler as a..."). A narration naming the two
planets directly instead ("Zuhal regards Mushtari as a friend") would not
be recognized either way — an accepted, bounded residual (§8), not a
regression this fix introduces (that phrasing was never demonstrated as
real narration content).

**Retrograde:** require the same sentence to name a planet (any
`PLANET_ALIASES` surface form — the codebase's own existing alias table,
already used by `checkCelestialEntities`) or use "ruler"/"ruling
planet"/"planet". Grounded directly in the engine's own two real
phrasings — `watchJudgment.ts`'s `factors` text ("`<planet name>` is
retrograde") and `diagnosis.ts`'s `rationale` text ("A ruling planet is
retrograde") — so the fix cannot lose recognition of either engine-native
form, and does not need to invent a third vocabulary.

**Reversal:** exclude matches whose full matched text contains "of
fortune" — the exact demonstrated idiom, not a broader idiom list. The
original Finding 5E-1 reproduction ("A reversal of this outcome is none")
does not contain that phrase and is structurally unaffected; verified
directly in §6.

**Direction:** a direction word is a genuine claim only when NOT
immediately followed by whitespace and another capitalized word (the
`North Star`/`South Pole` shape). A direction word ending a clause
("...toward the South.") or followed by ordinary lowercase prose is
unaffected. This targets the demonstrated mechanism precisely — a
direction word continuing into a compound proper noun — rather than
maintaining a list of specific proper nouns to exclude, which would need
constant extension for every future toponym/idiom narration might use.

No check was changed into a semantic/LLM classifier. No check's core
shape-detection was removed — each fix adds one narrow, additional
condition that must also hold, on top of the existing detection, exactly
as `DATE_LIKE_PATTERN`'s own Phase 5E-R fix (a negative lookahead, not a
rewrite) already established as this codebase's pattern for this kind of
correction.

## 5. Independent verification against the exact review reproductions

Ran fresh (a temporary probe script, not committed) directly reproducing
`PHASE_5E_R_REVIEW_GATE.md` §4's four examples verbatim, before writing
any permanent test:

```
"The seeker's colleague regards them as a friend, which brings comfort."
  → now VALID (was RULER_RELATION_CONTRADICTION)
"This situation feels retrograde compared to last year."
  → now VALID (was RETROGRADE_CLAIM_CONTRADICTION)
"A reversal of fortune is possible if effort continues."
  → now VALID (was REVERSAL_CLAIM_CONTRADICTION)
"The evidence points toward the North Star as a symbol of steadfastness,
 not an actual direction claim."
  → now VALID (was DIRECTION_CLAIM_CONTRADICTION)
```

All four now VALID, confirmed directly, not inferred from the permanent
test suite alone.

## 6. Zero new false negatives — genuine claims re-verified

The same probe re-confirmed every genuine ground-truth claim still fails,
including phrasings each fix could plausibly have broken:

- `"The querent's ruler regards the matter's ruler as an enemy."` (on a
  `Neutral` reading) — still `RULER_RELATION_CONTRADICTION`.
- `"Zuhal is currently retrograde..."` (planet-name phrasing, on a
  non-retrograde reading) — still `RETROGRADE_CLAIM_CONTRADICTION`.
- `"The ruling planet is retrograde in this matter."` (the engine's own
  `diagnosis.rationale` phrasing, on a non-retrograde reading) — still
  `RETROGRADE_CLAIM_CONTRADICTION`.
- `"Zuhal is currently retrograde..."` on the genuinely-retrograde
  reading — still correctly **VALID** (ground-truth match, unaffected by
  this phase's fix — confirms the fix narrows the false-positive without
  disturbing Phase 5E-R's own retrograde correction).
- `"A reversal of this outcome is possible."` (not the "of fortune"
  idiom) — still `REVERSAL_CLAIM_CONTRADICTION`.
- A bare direction word ending a clause (`"...points toward the North."`)
  — still `DIRECTION_CLAIM_CONTRADICTION`.

## 7. Permanent regression tests

22 new tests added to `narrationValidatorGroundTruth.test.ts` (65 total),
four new `describe` blocks, one per finding, each with: the exact review
reproduction (now VALID); 2 adversarial near-misses (a different verb
form/wording, and an ALL-CAPS case variation — covering the "case,
punctuation, whitespace, wording" variation the authorization required);
and 1–3 genuine-claim controls confirming the corresponding contradiction
is still caught, including the engine's own exact phrasing where
applicable. All 65 pass.

One test-authoring bug was caught and fixed during this phase, worth
recording: an early draft of a direction near-miss test used "points
toward the north, not the south" — coincidentally containing the
contract's own correct direction ("South") elsewhere in the same
sentence, which `claimedDirection()`'s scan-in-array-order behavior
picked up as a genuine (and, coincidentally, correct) claim before ever
reaching "north," passing the test for the wrong reason. Caught by running
the test and observing the unexpected result, not assumed correct because
it read intuitively — corrected to unambiguous wording
("...points toward the north, quite clearly").

## 8. Documented residuals (unchanged, not this phase's scope)

- **Ruler-relation claims phrased by naming planets directly** ("Zuhal
  regards Mushtari as a friend") remain unrecognized either way — no real
  narration precedent uses this phrasing, so this is not a regression,
  but it is a boundary of the "ruler" keyword discriminator worth stating
  plainly rather than leaving implicit.
- **Diagnostic-cause claims** (`diagnosis.rationale` free text) — still
  not implemented, per Phase 5E-R's own documented exclusion.
- **The non-house/non-date ordinal collision** ("the 3rd point") — still
  a false positive, per Finding 5E-2's own documented scope boundary.
- **Idioms adjacent to but not identical to "reversal of fortune"** (e.g.
  "a reversal of luck") are not excluded — only the exact demonstrated
  phrase, per this phase's "smallest evidence-based discriminator"
  instruction. Not tested as a false positive by this phase because it
  was not demonstrated by the review; recorded here so it is not mistaken
  for an oversight if found later.

## 9. Regression results

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **342/342** (16 test files; was 320
  before this phase — the 22 new tests above).
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304** — unaffected (this phase only
  touches `functions/src/oracle/`).
- `node scripts/sync-engine.mjs --check` — clean.
- Phase 5C adversarial-harness corpus re-run
  (`npx vite-node scripts/adversarial-harness/run.ts --out-dir=docs/audit/phase-5e-r2`):
  **11,923/11,923, 0 false negatives, 0 false positives, 0 exceptions, 0
  contract mutations** — unchanged from the Phase 5E-R baseline (this
  corpus's own generators don't happen to produce the four idiom shapes
  this phase fixes, so it was 0/0/0/0 before and after — expected, and
  consistent with the review's own §5 explanation of why the existing
  corpus didn't surface these findings in the first place).
- Golden corpus: **not regenerated**; confirmed unchanged via
  `git diff --stat -- docs/audit/golden-corpus/`, empty.
- Replay check: **24/24** identical.
- Prohibited-path proof: `git diff --stat bc97dee..HEAD -- src/astrology/
  functions/src/engine/ functions/src/oracle/readingContract.ts
  functions/src/oracle/remedySelection.ts functions/src/oracle/remedyLibrary.ts
  functions/src/oracle/textSecurity.ts functions/src/prompts/
  firestore.rules docs/audit/golden-corpus/` — **empty**, both against
  the committed range and the working tree at time of writing.

## 10. Final status

**PHASE 5E-R2: PASS**

All four demonstrated false-positive classes closed, each via the
smallest evidence-based discriminator available, none broadening the
validator toward semantic/LLM interpretation, none weakening the
underlying ground-truth cross-checks (every genuine claim reproduction
from Phase 5E-1 and the Phase 5E-R review still correctly fails). Zero
new false negatives, zero regressions across 342 functions tests, 304 app
tests, the 11,923-case adversarial corpus, the golden corpus (untouched),
and the 24-case replay. Prohibited paths confirmed untouched, including
`textSecurity.ts`. Awaiting the independent 5E-R2 review gate before the
5E chain closes and any Phase 5F authorization.
