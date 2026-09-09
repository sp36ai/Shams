# Phase 5E-R — Formal Review / Closure Gate

**PHASE 5E-R REVIEW: PASS WITH DOCUMENTED GAPS**

Independent review of the Phase 5E-R implementation, conducted against
current source, tests, and git history — not a restatement of
`docs/audit/PHASE_5E_R_HARDENING.md`'s own claims. No production code was
modified during this review; all findings below are reproduced directly,
not fixed.

## 1. Review scope

Verify the Phase 5E-R `PASS` claim independently: the seven ground-truth
checks, the `DATE_LIKE_PATTERN` collision fix, the 43 committed tests, and
the claimed absence of engine/contract/prohibited-path drift — with fresh,
independently-constructed adversarial probes, not merely a re-read of the
implementation's own test suite.

## 2. Files inspected

- `functions/src/oracle/narrationValidator.ts` — full diff read
  (`git diff 62c3985..025e95b`), every one of the seven new check
  functions and the `DATE_LIKE_PATTERN` change read in full, not
  summarized.
- `functions/src/oracle/textSecurity.ts` — confirmed byte-identical to the
  Phase 5D-R review-gate baseline (`git diff` against both the commit
  range and the working tree, both empty).
- `functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`
  (all 43 tests read and re-run).
- `docs/audit/PHASE_5E_RECONNAISSANCE.md`, `docs/audit/PHASE_5E_R_HARDENING.md`.
- `docs/audit/phase-5e-r/summary.json` (the implementation phase's own
  adversarial-harness evidence).
- `git log`, `git status`, `git diff` against the Phase 5E reconnaissance
  commit (`62c3985`) and the current working tree.

## 3. Independent implementation findings

- **Exactly one canonical security-matching primitive, still untouched.**
  `textSecurity.ts` shows zero diff across this phase's entire range —
  confirmed directly, not inferred from the hardening doc's own claim.
  The seven new checks receive text exclusively through the pre-existing,
  unmodified three-tier fallback (`canonicalText ?? unicodeOnlyText ??
  text`) in `validateNarration()`'s loop; no special-casing was added for
  them, and none was needed.
- **No new judgment is computed.** Every new check function reads a value
  already present on the frozen `ReadingContract`
  (`judgment.targetHouse/.targetSignName/.direction/.rulerRelation/.reversal/.factors`,
  `diagnosis.supportingHouses/.rationale`) and performs a single
  string/regex comparison against it. None constructs a `WatchVerdict`,
  `RkpDiagnosis`, or `RemedyProtocol`. Confirmed by direct reading of all
  seven function bodies, not by trusting the header comment's claim.
- **The retrograde-check correction (hardening doc §4) is real and
  correctly implemented**, not merely claimed: `checkRetrogradeClaims`
  compares against `judgment.factors`/`diagnosis.rationale` content, not a
  blanket deny-list on the word "retrograde" — confirmed by reading the
  function body directly.
- **`DATE_LIKE_PATTERN`'s fix is exactly as narrow as documented**: a
  negative lookahead for `house`/`ghar` only, leaving the rest of the
  pattern (month-adjacent ordinals, slash/dash-delimited dates) untouched.
  Confirmed by diff, not paraphrase.
- **Diagnostic-cause claims (`diagnosis.rationale` free text) are
  genuinely not implemented** — confirmed by `grep`: no check function
  references `.rationale` for any purpose other than `checkRetrogradeClaims`'s
  narrow, single-word ground-truth lookup. The exclusion is real, not a
  silent partial coverage dressed up as a full exclusion.
- **No prohibited path touched.** §9 below.

## 4. Independent adversarial testing — the two findings the implementation missed

Reconnaissance and the implementation phase's own testing both, correctly,
verified "correct claim → VALID" and "omitted claim → VALID." This
review's own fresh probes went further: constructing narration that
matches a check's phrase SHAPE while genuinely meaning something else —
ordinary English idiom, not an astrological claim — the exact case the
authorization's "Critical false-positive requirement" (do not solve this
by rejecting broad astrology vocabulary) was written to guard against.
**Four of the seven new checks have a real, reproducible false-positive
class the implementation's own §5 false-positive analysis did not test
for and therefore did not catch.**

### Finding 5E-R-Review-1 (P2) — `checkRulerRelationClaims` flags ordinary human-relationship prose

Reproduction (contract: `judgeWatchChart` output for "Will I get the job I
interviewed for?" at `2026-08-15T11:00:00+04:00`, `judgment.rulerRelation
= Neutral`):

```
"The seeker's colleague regards them as a friend, which brings comfort."
  → INVALID: RULER_RELATION_CONTRADICTION
    ("narration claims the ruler relation is "friend", but
     judgment.rulerRelation is Neutral")
```

`RULER_RELATION_PATTERN` (`/\bregards?\b[\s\S]{0,60}?\bas\s+(?:an?\s+)?(friend|enemy|neutral)\b/i`)
matches this shape unconditionally — it has no way to distinguish "the
querent's ruler regards the matter's ruler as a friend" (the astrological
claim it was built for) from "a colleague regards them as a friend" (an
ordinary sentence about the seeker's human relationships, plausible
narration content for an oracle discussing e.g. an employment or
friendship question).

### Finding 5E-R-Review-2 (P2) — `checkRetrogradeClaims` flags metaphorical use of "retrograde"

Reproduction (contract: "Should I close my failing business?" at
`2026-08-15T11:37:00+05:00`, not retrograde):

```
"This situation feels retrograde compared to last year."
  → INVALID: RETROGRADE_CLAIM_CONTRADICTION
```

The check triggers on any occurrence of the bare word "retrograde,"
regardless of whether it is asserting a specific planetary fact ("Zuhal is
retrograde") or using the word in a looser, common English sense ("this
feels retrograde," "a retrograde step"). Narrower than
Finding-5E-R-Review-1's risk (this app's domain does skew the word toward
its astrological sense), but real and reproducible.

### Finding 5E-R-Review-3 (P1) — `checkReversalClaims` flags the idiom "reversal of fortune," likely narration-plausible language

Reproduction (same non-retrograde, `reversal: NONE` contract):

```
"A reversal of fortune is possible if effort continues."
  → INVALID: REVERSAL_CLAIM_CONTRADICTION
    ("narration claims reversal "possible", but judgment.reversal is NONE")
```

Raised to P1 rather than P2: "a reversal of fortune" is a standard English
idiom with an obvious, natural fit in exactly this app's own narration
register (an oracle discussing a seeker's prospects) — this is not an
exotic adversarial construction, it is ordinary, foreseeable prose. The
check cannot distinguish it from a genuine claim about
`judgment.reversal`'s specific technical meaning (whether a past
decision/action on this matter is liable to be reopened — see
`watchJudgment.ts`'s own comment on the field), because both share the
same "reversal ... is/remains POSSIBLE-or-NOT" surface shape. A companion
probe on the same contract, `"A reversal is not possible without real
change in approach"` (a generic, non-astrological piece of advice),
happened to validate — not because the check recognized it as unrelated,
but because this contract's real `reversal` value (`NONE`) coincidentally
matched the idiom's own claimed value; the same idiom on a
`reversal: POSSIBLE` contract would very likely also false-positive.

### Finding 5E-R-Review-4 (P2) — `checkDirectionClaims` flags "North Star" and similar direction-word-bearing proper nouns/idioms

Reproduction (contract: "Will I get the job I interviewed for?",
`judgment.direction = South`):

```
"The evidence points toward the North Star as a symbol of steadfastness,
 not an actual direction claim."
  → INVALID: DIRECTION_CLAIM_CONTRADICTION
```

`DIRECTIONS.find(d => ...)` matches the bare word "North" anywhere in the
anchor sentence, including inside a proper noun ("North Star") or any
other phrase using a cardinal-direction word non-literally. Two companion
probes without an actual direction word present — `"Patience governs this
matter more than haste does"` and `"Every sign points toward the seeker's
own choice"` — correctly stayed VALID, confirming the phrase-anchor itself
is reasonably safe; the risk is specifically the bare direction-word
extraction once the anchor phrase is present.

**House and sign claims were also probed and did NOT reproduce a false
positive** in this review's testing: `"Patience governs this matter more
than haste does"` and `"Discipline rules this matter above all else"`
(no numeral present, so `extractHouseNumbers` correctly returns nothing)
both stayed VALID — these two checks' bounded numeral/name extraction is
more resistant to this class of false positive than the four above,
because they require a specific number or a specific sign name to be
present, not merely a common word.

## 5. Why this was not caught by the implementation phase's own testing

`PHASE_5E_R_HARDENING.md` §5's false-positive controls are structured as
pairs: "correct claim → VALID" and "omitted claim → VALID," per category.
Both are necessary but not sufficient — neither ever constructs a sentence
that matches a check's phrase SHAPE while intending something other than
the astrological claim. The 11,923-case existing adversarial-harness
corpus (re-run fresh by this review, still 0/0/0/0 — see §7) does not
cover this either, because its generators were built for the mutation
classes Phase 5C originally targeted (Unicode obfuscation, verdict/timing/
remedy/celestial substitution), not idiomatic-English collision with a
new claim-shape detector. This is precisely the kind of gap an
independent review step exists to catch — the same spirit as this
project's own established discipline, e.g. the Phase 5D-R implementation's
own self-caught regressions.

## 6. Independent test-suite re-verification

The 43 committed tests were re-run (not merely re-read):
`npx vitest run src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`
— **43/43 pass**, confirmed independently. Spot-checked several test
bodies against the actual check implementations (not just trusting test
names) — each asserts what it claims to. The two real contracts the suite
constructs (`employment-001`/`business-007`-equivalent) were independently
reproduced in this review's own probe scripts from the same moment/question
pair and produced identical field values (`targetHouse: 10`,
`direction: South`, `reversal: POSSIBLE`, genuinely retrograde for the
first; `rulerRelation: Neutral` confirmed via a wider sweep of all 10 real
question/moment pairs, used to source Findings 1–3's reproductions above).

## 7. Regression results (reproduced fresh)

- `cd functions && npx tsc --noEmit` — clean, reproduced.
- `cd functions && npm run lint` — clean, reproduced.
- `cd functions && npx vitest run` — **320/320** (16 test files), reproduced.
- `npm run typecheck` (app root) — clean, reproduced.
- `npm run lint` (app root) — clean, reproduced.
- `npm run test` (app root) — **304/304**, reproduced.
- `node scripts/sync-engine.mjs --check` — clean, reproduced.
- Phase 5C adversarial-harness corpus, re-run fresh by this review (not
  the implementation's own cached output): **11,923/11,923, 0 false
  negatives, 0 false positives, 0 exceptions, 0 contract mutations.**
  Confirms the four findings in §4 are real gaps in this corpus's own
  coverage, not something the corpus already measures and the
  implementation ignored.
- Golden corpus: **not regenerated**, per the same instruction the
  implementation phase itself followed. Confirmed unreachable from this
  phase's changes (unchanged reasoning from the hardening doc: golden
  corpus generation never calls `validateNarration()`) and confirmed via
  `git diff --stat -- docs/audit/golden-corpus/`, empty.
- Replay check: **24/24** identical, reproduced.

No claimed regression result failed to reproduce.

## 8. Combined attack / interaction check

Re-confirmed (via the committed test suite, independently re-run) that
contradictory ground-truth claims combined with the already-closed 5C-R/
5D-R obfuscation mechanisms (zero-width joiner, mid-word punctuation,
Cyrillic confusable) are still caught — the new checks receive
canonicalized text through the same unmodified three-tier fallback every
other check uses, so this required no new mechanism and none was built.

## 9. Git / prohibited-path proof

```
git diff --stat 62c3985..HEAD -- \
  src/astrology/ \
  functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/oracle/textSecurity.ts \
  functions/src/prompts/ \
  firestore.rules \
  docs/audit/golden-corpus/
```
Output: **empty.** Full changed-file list across the same range:
`functions/src/oracle/narrationValidator.ts`,
`functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`,
`docs/audit/PHASE_5E_R_HARDENING.md`, and the evidence JSON under
`docs/audit/phase-5e-r/` — no code outside the validator, and no data.
`git status --porcelain` at the start and end of this review is empty
(this review's own scratch probe scripts were deleted before finishing,
never committed).

## 10. Discrepancies from the original 5E-R report

One material discrepancy: `PHASE_5E_R_HARDENING.md` §5 states "zero new
false positives" and §11 restates this as demonstrated. This review found
that claim to be **incompletely verified, not false in the cases it
actually tested** — every false-positive control the hardening doc
constructed genuinely does pass, but the doc's own control set did not
include the "shape-matches, meaning-doesn't" category this review probed,
so its "zero new false positives" conclusion does not extend as far as
its own §12 recommendation implicitly assumed. No other discrepancy was
found: every regression figure, every field-provenance claim, the
retrograde-check correction, and the `DATE_LIKE_PATTERN` fix's exact scope
all reproduced exactly as documented.

## 11. Final disposition

**PHASE 5E-R REVIEW: PASS WITH DOCUMENTED GAPS**

The implementation is structurally sound: exactly the two authorized
findings addressed, no new judgment introduced, no prohibited path
touched, the security-matching architecture correctly left untouched and
correctly inherited by the new checks, and every regression claim
reproduced. It does not qualify for an unqualified PASS because four of
the seven new checks (`checkRulerRelationClaims`,
`checkRetrogradeClaims`, `checkReversalClaims`, `checkDirectionClaims`)
have a demonstrated, reproducible false-positive class against ordinary,
narration-plausible English — most seriously Finding
5E-R-Review-3 ("a reversal of fortune is possible," P1), which uses a
common idiom directly in this app's own narration register. These are not
hypothetical: each was reproduced against a real, engine-produced
contract with a single narration sentence, using no obfuscation or
adversarial construction of any kind — ordinary prose.

This is not a request to fix anything now — per this review's own
instruction to independently verify rather than remediate, no code was
changed. The four findings are recorded here for the project owner to
scope into a follow-up (a narrower phrase-anchor requiring the sentence
also reference a planet/ruler/matter noun, for the ruler-relation and
retrograde checks; a more specific anchor than bare "reversal ... is/
remains X" for the reversal check; and excluding direction words inside
capitalized multi-word proper nouns like "North Star" for the direction
check, are the shapes of narrow fixes each would need — not prescribed
here, since scoping that fix is the next phase's decision, not this
review's).

No hard-stop condition beyond "document, don't fix" was triggered. No
implementation was performed. No Phase 5F was begun.
