# Phase 5E-R3 — Independent Review Gate

**PHASE 5E-R3 REVIEW: PASS WITH DOCUMENTED FINDINGS**

Independent review of the Phase 5E-R3 implementation (commit `8e45d50`),
conducted against current source and fresh, deliberately adversarial
probes targeting the 20-character lookback boundary — not a restatement
of `docs/audit/PHASE_5E_R3_HARDENING.md`'s own claims. No production code
was modified during this review; the finding below is reproduced
directly, not fixed.

**This review found one new, real, higher-severity issue than anything
previously accepted in this chain: a genuine false NEGATIVE (a fabricated
reversal claim silently passing validation), not another false positive.
See §4.**

## 1. Scope

Reviewed exactly the Phase 5E-R3 change: the reordered "Fortune's
reversal" idiom fix, the `FORTUNE_LOOKBACK_WINDOW` discriminator, its 12
new permanent tests, and preservation of existing ground-truth reversal
detection. No production code, test, or unrelated file was modified
during this review.

## 2. Fresh diff read

`git diff e8b227f..8e45d50 -- functions/src/oracle/narrationValidator.ts`
read in full: exactly the change `PHASE_5E_R3_HARDENING.md` describes —
`REVERSAL_IDIOM_EXCLUSION` narrowed from the phrase `'of fortune'` to the
bare word `'fortune'`, combined with a new `isReversalOfFortuneIdiom()`
that widens the search span to `FORTUNE_LOOKBACK_WINDOW` (20) characters
before the match, through the end of the match. `REVERSAL_CLAIM_PATTERN`,
`REVERSAL_POSSIBLE_WORDS`, and `REVERSAL_NONE_WORDS` are byte-identical to
the Phase 5E-R2 baseline. `functions/src/oracle/textSecurity.ts` confirmed
byte-identical across the same range (empty diff).

## 3. Independently reconstructed discriminator behavior

Rebuilt the exact logic in an isolated probe (not the committed
implementation, to avoid trusting it uncritically) and confirmed it
matches: `span = text.slice(max(0, matchIndex - 20), matchIndex +
matchLength).toLowerCase(); return span.includes('fortune')`. This is a
**bare substring search**, with no word-boundary anchor (`\b`) — a
property directly responsible for the finding in §4.

**Boundary sweep** (constructed strings of the form `"fortune" + N filler
chars + " reversal is possible."`, sweeping `N` from 0 to 30): the
exclusion held through `N=10` and broke cleanly at `N=13` onward — exactly
consistent with `"fortune"` (7 chars) + filler + `" "` (1 char) needing
`≤20` total chars before `"reversal"` starts (`8+N≤20` ⟺ `N≤12`). The
cutoff is a precise, deterministic 20-character hard boundary, not fuzzy
or inconsistent — confirms the implementation matches its own
documentation exactly.

## 4. NEW FINDING (P1) — the bare substring check matches "fortune" inside "misfortune," suppressing a genuine reversal claim

```
"Despite past misfortune, a reversal of this outcome is possible."
  → VALID  (should be REVERSAL_CLAIM_CONTRADICTION — contract's actual
             judgment.reversal is NONE)
"Despite recent misfortunes, a reversal of this outcome is possible."
  → VALID  (same bug, plural form)
```

**Root cause, traced precisely:** `isReversalOfFortuneIdiom()`'s
`span.includes('fortune')` matches the substring `"fortune"` wherever it
occurs in the 20-character-plus-match window — including inside the
English word **"misfortune"** (`mis` + `fortune`), which is not the
demonstrated idiom at all. `"misfortune"` sits well within the 20-char
lookback in the reproduction above, so the exclusion fires and the check
returns `null` — silently accepting a narration sentence that names no
idiom, uses the exact "reversal of this outcome is X" shape the check
exists to catch, and contradicts the contract's real `judgment.reversal`
value.

**This is a regression Phase 5E-R2 did not have**: the prior exclusion
checked for the literal phrase `'of fortune'` within the matched span
only. `"misfortune"` never contains `"of fortune"` as a substring, and the
word sits before the match (outside the pre-5E-R3 search span) in any
case — so this exact reproduction was correctly flagged
`REVERSAL_CLAIM_CONTRADICTION` before this phase. 5E-R3's two combined
changes — widening the search span to include text before the match, and
narrowing the excluded string from the full phrase `'of fortune'` down to
the bare word `'fortune'` — together created this new collision. Neither
change alone would have: the widened span with the FULL PHRASE `'of
fortune'` would not match inside "misfortune" (no "of" there); the bare
word `'fortune'` restricted to only the matched span (the pre-5E-R3
search area) would not reach "misfortune," which sits before the match.

**Severity: P1.** This is not another over-rejection false positive like
the three previously accepted residuals — it is a false NEGATIVE: a
narration that fabricates a reversal claim, using the exact plain-English
shape (`"reversal of this outcome is X"`) `checkReversalClaims` was built
specifically to catch, now passes validation silently. "Despite past
misfortune" is ordinary, plausible narration language for an oracle
discussing a seeker's history — this is not a constructed edge case.

**Confirmed bounded, not a total failure of the check:** moving
"misfortune" further from the match (`"A history of misfortune precedes
this: a reversal is possible here."` — "misfortune" now >20 chars before
the match) is correctly still caught. The bug is specifically the
20-character proximity window combined with the unanchored substring
check, not a wholesale defeat of `checkReversalClaims`.

**Two further probes, informational, not additional bugs:** multiple
distant occurrences of the standalone word "fortune" in the same field,
and "fortune" mentioned in an unrelated sentence far from a genuine claim,
were both still correctly caught — confirming the bug is specifically the
unanchored substring match against "misfortune"'s internal spelling, not
a broader failure of the lookback design.

## 5. Genuine claims otherwise still correctly rejected

Outside the "misfortune" collision, every genuine claim this review
tested was still correctly caught: the engine's own bare phrasing ("A
reversal remains possible here," no "fortune" anywhere); "a reversal of
this outcome is possible" with no nearby "fortune"; and both idiom
orderings ("reversal of fortune," "Fortune's reversal") still correctly
excluded as designed. Punctuation between "Fortune's" and "reversal" (a
comma) did not break the exclusion, confirming robustness to minor
punctuation variation was not lost.

## 6. Previously accepted residuals — confirmed unchanged, not worsened

- **Unrelated "ruler" noun collision** (`docs/audit/PHASE_5E_R2_REVIEW.md`
  Finding 5E-R2-Review-1): re-tested, still present, unchanged.
- **Retrograde meta-commentary limitation** (Finding 5E-R2-Review-2):
  re-tested, still present, unchanged.
- **Three-tier fallback / ZWJ-inside-"fortune" interaction** (Finding
  5E-R2-Review-4): re-tested (`"A reversal of fort‍une is possible
  here."`), still present, unchanged. Phase 5E-R3 did not touch the logic
  responsible for this interaction.

None of the three regressed or improved — consistent with Phase 5E-R3's
narrow, documented scope (only Finding 5E-R2-Review-3 was in scope).

## 7. Diagnostic-cause and judgment-recomputation checks

- `grep -n "\.rationale" functions/src/oracle/narrationValidator.ts` —
  the only non-comment match remains `checkRetrogradeClaims`'s existing,
  unchanged ground-truth lookup. Diagnostic-cause fabrication remains
  genuinely unimplemented — not silently claimed as solved by this phase.
- No new field is read from `ReadingContract`, no new judgment is
  computed. The Phase 5E-R3 change only alters which characters
  `checkReversalClaims`'s exclusion inspects — confirmed by reading the
  full diff in §2, not merely trusting the hardening doc's own claim.

## 8. Regression results (reproduced fresh)

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **354/354** (16 test files),
  reproduced. Notably, none of the 354 committed tests exercise the
  "misfortune" case — confirming §4 is a genuine gap in the
  implementation's own test coverage, not a result this review
  misattributes.
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304**, reproduced.
- `node scripts/sync-engine.mjs --check` — clean.
- Phase 5C adversarial-harness corpus, re-run fresh: **11,923/11,923, 0
  false negatives, 0 false positives, 0 exceptions, 0 contract
  mutations.** This corpus's own generators do not happen to construct a
  "misfortune"-shaped case either — consistent with why this review's own
  deliberate, targeted boundary-sweep was necessary to surface §4.
- Golden corpus: not regenerated; `git diff --stat -- docs/audit/golden-corpus/`
  empty.
- Replay check: **24/24** identical.
- Prohibited-path proof: `git diff --stat 8e45d50..HEAD -- src/astrology/
  functions/src/engine/ functions/src/oracle/readingContract.ts
  functions/src/oracle/remedySelection.ts functions/src/oracle/remedyLibrary.ts
  functions/src/oracle/textSecurity.ts functions/src/prompts/
  firestore.rules docs/audit/golden-corpus/` — **empty**, both against the
  committed range and the working tree. `git status --porcelain` empty at
  review start and end (this review's own scratch probe script deleted
  before finishing, never committed).

No claimed regression result failed to reproduce, and no regression gate
failed.

## 9. Distinguishing verified conditions from findings

**Independently verified PASS conditions:**
- Both idiom orderings ("reversal of fortune," "Fortune's reversal") are
  correctly excluded, including case and whitespace variants.
- The 20-character boundary is a precise, deterministic hard cutoff
  matching its own documentation exactly.
- No genuine ground-truth reversal claim tested by this review — other
  than the "misfortune" collision — became a false negative.
- The three previously-accepted residuals are confirmed unchanged, not
  worsened.
- Diagnostic-cause fabrication remains genuinely unimplemented.
- No new judgment or semantic interpretation was introduced.
- Every regression gate (functions/app tests, typecheck, lint, 5C corpus,
  golden corpus, replay, mirror sync, prohibited-path diff) passed fresh.

**Newly discovered finding:**
- §4 — the bare substring check inside `isReversalOfFortuneIdiom()`
  matches "fortune" as a substring of "misfortune," silently suppressing
  a genuine, contract-contradicting reversal claim within the 20-character
  window. P1. Not fixed by this review, per its own "document, don't fix"
  instruction.

**Accepted residuals (unchanged, not reopened by this review):**
- 5E-R2-Review-1 (unrelated "ruler" noun collision), P3.
- 5E-R2-Review-2 (retrograde meta-commentary), P3.
- 5E-R2-Review-4 (ZWJ-inside-"fortune" / three-tier fallback
  interaction), P3, informational, no realistic exploitation path.
- The non-house/non-date ordinal residual and diagnostic-cause exclusion,
  both from earlier in the chain.

## 10. Final recommendation

**PHASE 5E-R3 REVIEW: PASS WITH DOCUMENTED FINDINGS**

Finding 5E-R2-Review-3 (the reordered idiom) is genuinely fixed for its
own exact reproduction and every variant this review constructed, with
zero regression against the previously-established ground-truth
detection or the three previously-accepted residuals. However, this
review's own required attack on the lookback boundary (per this task's
explicit instruction to "try hard to break the 20-character discriminator")
found a new, real, P1-severity false negative — more serious in kind than
any finding previously accepted in this chain, since it is a fabrication
silently bypassing detection rather than legitimate prose being
over-rejected.

**This review does not recommend closing the 5E chain yet.** Unlike the
three P3 residuals — which are over-rejection annoyances with narrow,
implausible reproduction shapes — §4 is a detection bypass reachable by
one ordinary English word ("misfortune") in plausible oracle narration
prose. The project owner should scope a narrow follow-up (a word-boundary
anchor on the "fortune" substring check — e.g. `\bfortune\b` instead of a
bare `.includes()` — is the shape such a fix would likely take, not
prescribed here since scoping it is the next phase's decision) before
treating the 5E chain as closed.

No implementation was performed. No Phase 5F was begun.
