# Phase 5E-R2 — Formal Review Gate

**PHASE 5E-R2 REVIEW: PASS WITH DOCUMENTED FINDINGS**

Independent review of the Phase 5E-R2 implementation, conducted against
current source and fresh adversarial probes — not a restatement of
`docs/audit/PHASE_5E_R2_HARDENING.md`'s own claims. No production code
was modified during this review; every finding below is reproduced
directly, not fixed.

## 1. Review scope

Independently verify the Phase 5E-R2 `PASS` claim: fresh-read the actual
diff, reproduce all four originally-reported false positives as fixed,
confirm no new false negatives, then specifically attack the four new
discriminators themselves for further collisions the implementation's own
testing did not construct — the same posture that found the original four
findings in the Phase 5E-R review.

## 2. Fresh read of the actual diff

`git diff bc97dee..3d99c10 -- functions/src/oracle/narrationValidator.ts`
read in full (not summarized): four discrete, narrow changes, one per
finding — `claimedDirection()`'s proper-noun lookahead,
`checkRetrogradeClaims`'s planet/ruler-keyword requirement,
`checkRulerRelationClaims`'s "ruler" requirement, and
`checkReversalClaims`'s "of fortune" exclusion — matching
`PHASE_5E_R2_HARDENING.md`'s own description exactly, no discrepancy.
`functions/src/oracle/textSecurity.ts` confirmed byte-identical across the
same range (`git diff bc97dee..3d99c10 -- .../textSecurity.ts`, empty).

## 3. Independent reproduction of the four original false positives

All four confirmed fixed, reproduced fresh (not via the committed test
suite alone):

```
"The seeker's colleague regards them as a friend, which brings comfort."
  → VALID (was RULER_RELATION_CONTRADICTION)
"This situation feels retrograde compared to last year."
  → VALID (was RETROGRADE_CLAIM_CONTRADICTION)
"A reversal of fortune is possible if effort continues."
  → VALID (was REVERSAL_CLAIM_CONTRADICTION)
"The evidence points toward the North Star as a symbol of steadfastness,
 not an actual direction claim."
  → VALID (was DIRECTION_CLAIM_CONTRADICTION)
```

## 4. Independent verification of genuine ground-truth claims

All confirmed still correctly rejected: ruler-relation contradiction using
the field's own real phrasing ("the querent's ruler regards..."); a
planet-named retrograde claim on a non-retrograde reading; a reversal
claim using "of this outcome" (not the excluded idiom); a bare
sentence-ending direction word. Zero new false negatives found.

## 5. Attacking the four new discriminators — findings

This is where this review's independent value lies: constructing
adversarial cases specifically targeting the boundary each new
discriminator draws, not merely re-confirming the four cases already
fixed.

### Finding 5E-R2-Review-1 (P3) — the "ruler" keyword discriminator doesn't verify WHICH ruler

```
"The ruler of a nearby kingdom regards the seeker as a friend in this story."
  → INVALID: RULER_RELATION_CONTRADICTION
```

The fix requires the word "ruler" in-sentence but does not require it to
refer to the astrological ruler specifically. A sentence using "ruler" in
an unrelated (e.g. narrative/metaphorical) sense, combined with the
"regards ... as a friend" shape, still false-positives. Low severity: this
exact collision — a literal, unrelated "ruler" noun sharing a sentence
with an unrelated "regards ... as" clause — is a far less natural
narration shape than the original finding (ordinary "X regards Y as a
friend" prose, with no "ruler" at all, is common; a sentence that
specifically introduces an unrelated "ruler" AND uses this exact relation
phrasing is not). Recorded as a residual of the keyword-based
discriminator design, not a regression — this class of imprecision is
inherent to any single-keyword discriminator and was implicitly, if not
explicitly, accepted when `PHASE_5E_R2_HARDENING.md` §8 chose "ruler" as
the discriminator.

### Finding 5E-R2-Review-2 (P3) — the retrograde discriminator doesn't verify assertion vs. meta-commentary

```
"Some say Mercury retrograde ruins plans, but that is just a meme, not how this works."
  → INVALID: UNAUTHORIZED_CELESTIAL_ENTITY, RETROGRADE_CLAIM_CONTRADICTION
```

Naming a planet and the word "retrograde" in the same sentence is treated
as an assertion even when the sentence is explicitly disclaiming the
astrological point. Also flags `UNAUTHORIZED_CELESTIAL_ENTITY` independent
of this phase's own fix (Mercury is not on this reading's allow-list) —
that second code is pre-existing `checkCelestialEntities` behavior,
unrelated to Phase 5E-R2, noted only for completeness. Very low real-world
plausibility: an Oracle narration voice disclaiming pop-astrology memes
mid-reading is not a shape this app's own narration register would
plausibly produce.

### Finding 5E-R2-Review-3 (P2) — the "of fortune" exclusion does not generalize to the same idiom reordered

```
"Fortune's reversal is possible if effort continues."
  → INVALID: REVERSAL_CLAIM_CONTRADICTION
```

The exclusion checks the matched span (`\breversal\b...`) for the literal
substring "of fortune." When the idiom is reordered so "Fortune" precedes
"reversal" instead of following it, "of fortune" never appears in the
matched text, and the false positive this phase set out to fix reappears
in a narrower form. This is the most material of this review's findings —
same underlying idiom family as the P1 original, still a plausible
narration phrasing, not merely a constructed edge case — but narrower in
practice than the original (the canonical "a reversal of fortune is
possible" ordering is far more common English usage than "fortune's
reversal is possible").

### Finding 5E-R2-Review-4 (P3, informational — not a gap) — the "of fortune" exclusion has a theoretical Unicode-obfuscation interaction, with no realistic exploitation path

```
"A reversal of fort‍une is possible here." (zero-width joiner inside "fortune")
  → INVALID: REVERSAL_CLAIM_CONTRADICTION
```

Root cause, traced precisely: `validateNarration()`'s three-tier fallback
(`check(canonicalText) ?? check(unicodeOnlyText) ?? check(rawText)`) tries
progressively less-transformed text and takes the first NON-NULL result.
On the canonical and Unicode-only tiers, the ZWJ is stripped, "fortune" is
intact, and the exclusion correctly fires, returning `null` (no failure) —
but `null` is exactly the fallback chain's signal to try the NEXT, less-
transformed tier, not a final "no failure" answer, so it falls through to
the raw tier. On raw text, the ZWJ still splits "fortune," the exclusion's
substring check no longer matches, and the (unrelated, still-valid)
REVERSAL_CLAIM_PATTERN still matches across the gap — producing a
failure, which the `??` chain accepts as the final result.

This is a real, traceable interaction between an EXCLUSION (a check that
can turn a match into "no failure") and the three-tier fallback's own
design assumption (that trying more tiers only ever adds detections, never
removes one a more-canonical tier already ruled out) — worth recording
precisely for anyone extending this pattern in a future phase. It is not,
however, a practically exploitable false positive: constructing it requires
an adversary to deliberately insert a Unicode obfuscation character inside
an otherwise-benign idiom specifically to make the validator MORE likely
to reject it — self-defeating for an attacker, and not a shape any
legitimate narration generator would ever produce unprompted. Recorded as
informational, not counted toward this review's disposition as a blocking
false positive.

### No further findings from this attack pass

The direction discriminator held up under two further adversarial
constructions: a genuine correct claim followed by a comma-separated
capitalized place name (`"points toward the South, near Karachi"` — stayed
correctly VALID because it's the true direction) and a genuine WRONG claim
in the same shape (`"points toward the East, near Karachi"` — stayed
correctly INVALID, confirming the proper-noun lookahead's requirement for
DIRECT whitespace+capital, not comma-separated text, does not accidentally
suppress genuine wrong claims). The ruler-relation and retrograde
discriminators were also tested combined with 5D-R's own obfuscation
mechanisms directly on the keyword itself (ZWJ inside "ruler," a Cyrillic
confusable inside a planet name) — both correctly still detected the
genuine contradiction, confirming the three-tier fallback continues to
work as designed for DETECTION (only the EXCLUSION-vs-fallback interaction
in Finding 4 above behaves differently, for the reason traced there).

## 6. Diagnostic-cause and ordinal-residual scope check

- `grep -n "\.rationale" functions/src/oracle/narrationValidator.ts` —
  the only match outside comments is `checkRetrogradeClaims`'s existing,
  narrow ground-truth lookup (unchanged since Phase 5E-R). No check
  compares narration against `diagnosis.rationale`'s free-text content in
  general. Diagnostic-cause fabrication remains genuinely unimplemented,
  not silently claimed as solved.
- The "ordinal that is neither a house nor a date" residual
  (`"Consider the 3rd point carefully."`) was re-run directly: still a
  false positive, unchanged, still explicitly documented in the test
  suite's own "KNOWN RESIDUAL" test — not silently changed or removed.

## 7. No judgment recomputed; comparisons remain contract-grounded

Confirmed by reading all four modified functions in full: none constructs
a new fact. `claimedDirection()` only re-shapes how a direction word is
extracted from already-given text; the retrograde/ruler-relation/reversal
fixes only add an additional in-sentence keyword/substring condition
before the SAME pre-existing ground-truth comparison already established
in Phase 5E-R runs. No new field is read from `ReadingContract` beyond
what Phase 5E-R already introduced.

## 8. Scope verification — prohibited paths

```
git diff --stat 3d99c10..HEAD -- \
  src/astrology/ functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/oracle/textSecurity.ts \
  functions/src/prompts/ firestore.rules docs/audit/golden-corpus/
```
Output: **empty**, both against the committed range and the working tree
at time of writing. `git status --porcelain` empty at review start and
end (this review's own scratch probe script deleted before finishing,
never committed). No engine, contract, remedy taxonomy, prompt, UI, app,
or `kp/` change of any kind — confirmed directly, not inferred.

## 9. Regression results (reproduced fresh)

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **342/342** (16 test files), reproduced.
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304**, reproduced.
- `node scripts/sync-engine.mjs --check` — clean.
- Phase 5C adversarial-harness corpus, re-run fresh: **11,923/11,923, 0
  false negatives, 0 false positives, 0 exceptions, 0 contract
  mutations.**
- Golden corpus: not regenerated; `git diff --stat -- docs/audit/golden-corpus/`
  empty.
- Replay check: **24/24** identical.

No claimed regression result failed to reproduce.

## 10. Discrepancies from the original 5E-R2 report

None material. `PHASE_5E_R2_HARDENING.md`'s §8 "Documented residuals"
already anticipated the general shape of Finding 1 above (planets named
directly rather than via "ruler") without enumerating the specific
"unrelated ruler noun" variant this review constructed; §8 also already
flagged "idioms adjacent to but not identical to 'reversal of fortune'"
as untested, which is exactly what Finding 3 demonstrates concretely.
Finding 4 (the ZWJ-obfuscation interaction) was not anticipated by the
original report and is new to this review, though — per §5's own
analysis — it carries no practical exploitation risk.

## 11. Final disposition

**PHASE 5E-R2 REVIEW: PASS WITH DOCUMENTED FINDINGS**

The four originally-reported false positives are genuinely and correctly
fixed, with zero regressions against any genuine ground-truth claim and
zero regressions against the 5C-R/5D-R obfuscation mechanisms' own
detection behavior. This does not qualify for an unqualified PASS because
this review's adversarial attack on the four new discriminators
themselves found three further, narrower residuals (Findings 1–3, P2–P3)
and one informational interaction (Finding 4, no practical exploitation
path) — none of which regress anything the implementation phase itself
tested or claimed, and none of which touch a prohibited path, but all of
which are real, reproducible gaps a sufficiently motivated narration
generator or adversary could still hit.

None of these findings, individually or together, rise to a hard-stop
condition: no false positive was found in ordinary, undemonstrated
narration content outside the four already-known idiom families; no
genuine ground-truth claim became a false negative; no previously-closed
5C-R/5D-R mechanism regressed; the golden corpus, replay determinism, and
every prohibited path are all confirmed unchanged; and no fix relies on
semantic/LLM interpretation. Per this review's own "document, don't fix"
instruction, none were remediated here.

**Recommendation:** the project owner may reasonably choose to close the
5E chain now, accepting Findings 1–4 as documented, low-severity residual
risk (consistent with how the non-house/non-date ordinal residual and the
diagnostic-cause exclusion were already accepted as open findings earlier
in this chain) — or scope a narrow 5E-R3 for Finding 3 specifically (the
most material of the four, given its idiom is a plausible reordering of
already-fixed content). Findings 1, 2, and 4 are lower priority: 1 and 2
are inherent to any keyword-based discriminator and would recur in some
form for almost any narrower fix; 4 has no realistic exploitation path.
This review does not recommend blocking the 5E chain's closure solely on
these findings.

No implementation was performed. No Phase 5F was begun.
