# Phase 5E-R4 — Independent Review Gate

**PHASE 5E-R4 REVIEW: PASS**

Independent review of the Phase 5E-R4 implementation (commit `fddc19c`),
conducted against current source and fresh, deliberately adversarial
probes — not a restatement of `docs/audit/PHASE_5E_R4_HARDENING.md`'s own
claims. No production code was modified during this review.

## 1. Scope

Reviewed exactly the Phase 5E-R4 change: the word-boundary anchor on the
"fortune" exclusion inside `checkReversalClaims`, its permanent
regression tests, and preservation of the 20-character lookback window,
the idiom family, ground-truth detection, and the three previously
accepted residuals. No production code, test, or unrelated file was
modified during this review.

## 2. Fresh diff read

`git diff 8c975cd..fddc19c -- functions/src/oracle/narrationValidator.ts`
read in full: one hunk, inside `checkReversalClaims`'s support code only
— `REVERSAL_IDIOM_EXCLUSION` (a bare string) replaced with
`REVERSAL_IDIOM_EXCLUSION_PATTERN = /\bfortune\b/i`, and
`isReversalOfFortuneIdiom()`'s body changed from `span.toLowerCase().includes(...)`
to a direct regex `.test(span)` (the lowercasing folded into the regex's
own `i` flag). `FORTUNE_LOOKBACK_WINDOW` (20) is untouched — confirmed by
`grep`, the constant's value and every other line referencing it are
byte-identical to the Phase 5E-R3 baseline. No other exported function in
the file was touched — confirmed by diffing every `export function`
signature line across the same range, only one hunk exists in the whole
file. `functions/src/oracle/textSecurity.ts` confirmed byte-identical
(`git diff 8c975cd..fddc19c -- .../textSecurity.ts`, empty).

## 3. Independent reproduction of the original P1

```
"Despite past misfortune, a reversal of this outcome is possible."
  → INVALID: REVERSAL_CLAIM_CONTRADICTION  (was VALID before this phase)
"Despite recent misfortunes, a reversal of this outcome is possible."
  → INVALID: REVERSAL_CLAIM_CONTRADICTION  (was VALID before this phase)
```

Both confirmed against the real `validateNarration()`, against a
non-retrograde, `judgment.reversal === 'NONE'` real contract.

## 4. Adversarial attack on word-boundary behavior

This review's central task was to try to break the fix, not merely
confirm the 13 committed tests. Beyond `"misfortune"`, three further
compound/hyphenated "fortune"-containing constructions were tested,
specifically chosen because a naive regex-only analysis suggested they
might also slip past a bare `\bfortune\b` anchor:

- **`"fortune-telling"`** (hyphenated): `"This is not fortune-telling: a
  reversal of this outcome is possible."` — **still correctly INVALID.**
  Tracing why is itself the interesting result: tested against the
  regex in isolation (outside `validateNarration()`), `\bfortune\b` DOES
  match inside `"fortune-telling"` (the hyphen is a non-word character,
  so a boundary exists there) — meaning an isolated-regex analysis alone
  would have wrongly predicted this as a bypass. Run through the real
  pipeline, it is not: `checkReversalClaims` receives text through
  Phase 5D-R's existing `canonicalizeForSecurityMatching()` on the first
  fallback tier, which bridges mid-word `.`/`-`/`_` between two letters —
  `"fortune-telling"` becomes `"fortunetelling"` on the canonical tier,
  removing the hyphen and with it the word boundary `\bfortune\b` needs.
  This is a real, if unplanned, protective interaction between Phase
  5D-R's punctuation-bridging and this phase's word-boundary fix, not
  something either phase's own authors designed for. Recorded here
  because it demonstrates why this review tested through the real
  validator rather than an isolated regex — the isolated regex alone
  would have produced a false alarm.
- **`"fortuneteller"`** (no separator): still correctly INVALID — no
  boundary exists between "fortune" and "teller" at all (adjacent word
  characters), so `\bfortune\b` never matches this compound regardless of
  canonicalization.
- **`"Fortune 500 company"`** (a standalone, word-bounded "Fortune" with
  an unrelated meaning — a company ranking, not the idiom): still
  correctly INVALID. This confirms the discriminator's known, accepted
  imprecision (any standalone "fortune" word within the window excludes,
  regardless of surrounding meaning) does not somehow compound into a
  worse bypass — it behaves exactly as `PHASE_5E_R4_HARDENING.md` itself
  documents, no better and no worse.

No new bypass was found by this attack pass.

## 5. Word-boundary and window-boundary re-verification

A fresh, independently-constructed sweep (`"fortune " + N filler chars +
" reversal is possible."`, `N` from 0 to 30) reproduced the exact cutoff
`PHASE_5E_R4_HARDENING.md` claims: excluded through `N=11`, no longer
excluded from `N=12` onward — `7 ("fortune") + 2 (two spaces) + N ≤ 20`.
The 20-character window is confirmed unchanged from Phase 5E-R3; only
what counts as "fortune" within it was narrowed.

Case-insensitivity was re-verified with a genuine claim using mixed case
(`"MisFortune"`) — still correctly caught, confirming the fix's `i` flag
did not introduce a case-sensitivity gap. A ZWJ planted inside
"misfortune" itself was also tested — still correctly caught (the ZWJ is
stripped by canonicalization, leaving "misfortune" intact and still
un-bounded before "fortune").

## 6. Multiple occurrences

- An unrelated, standalone "fortune" mention placed well outside the
  20-character window, followed later by a genuine reversal claim — still
  correctly caught.
- Two "fortune" occurrences in close proximity, only one of which (the
  idiom itself, "Fortune's reversal") is within the window of a genuine
  claim shape — correctly excluded as the idiom, no interference from the
  earlier unrelated mention.

## 7. Ground-truth ground-truth preservation

Four controls spanning both possible `judgment.reversal` values and both
correct/incorrect narration, independent of Phase 5E-R4's own test suite:
a wrong "none" claim on a `POSSIBLE` contract, a wrong "possible" claim on
a `NONE` contract, and the correct narration for each — all four behaved
exactly as the contract's ground truth requires. No regression to the
underlying comparison logic, which this phase did not touch.

## 8. Previously accepted residuals — confirmed unchanged

- **5E-R2-Review-1** (unrelated "ruler" noun collision): re-tested,
  unchanged.
- **5E-R2-Review-2** (retrograde meta-commentary limitation): re-tested,
  unchanged.
- **5E-R2-Review-4** (ZWJ-inside-"fortune" / three-tier fallback
  interaction): re-tested directly, unchanged — still `INVALID`, exactly
  as `PHASE_5E_R4_HARDENING.md` §8 documents and as its own new permanent
  test now pins.

## 9. Diagnostic-cause and scope checks

- `grep -n "\.rationale" functions/src/oracle/narrationValidator.ts` —
  the only non-comment match remains `checkRetrogradeClaims`'s existing,
  unchanged ground-truth lookup. Diagnostic-cause fabrication remains
  genuinely unimplemented.
- No other validator check was touched — confirmed in §2 by diffing every
  `export function` line across the full commit range.

## 10. Regression results (reproduced fresh)

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **367/367** (16 test files),
  reproduced.
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
- Prohibited-path proof: `git diff --stat fddc19c..HEAD -- src/astrology/
  functions/src/engine/ functions/src/oracle/readingContract.ts
  functions/src/oracle/remedySelection.ts functions/src/oracle/remedyLibrary.ts
  functions/src/oracle/textSecurity.ts functions/src/prompts/
  firestore.rules docs/audit/golden-corpus/` — **empty**, both against the
  committed range and the working tree. `git status --porcelain` empty at
  review start and end (scratch probe scripts deleted before finishing,
  never committed).

No claimed regression result failed to reproduce, and no regression gate
failed.

## 11. Exact changed-file boundary

`functions/src/oracle/narrationValidator.ts`,
`functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`,
`docs/audit/PHASE_5E_R4_HARDENING.md`, and the `docs/audit/phase-5e-r4/`
evidence directory — no other file, confirmed by full-range diff stat.

## 12. Final recommendation

**PHASE 5E-R4 REVIEW: PASS**

The Phase 5E-R3 P1 ("misfortune" substring bypass) is genuinely and fully
closed. This review's own adversarial attack — including two
compound-word constructions not covered by the implementation's own
tests, one of which (`"fortune-telling"`) an isolated-regex-only analysis
would have wrongly flagged as a residual bypass — found no new false
negative, no new false positive, no change to the 20-character window's
size, no unintended broadening beyond the "fortune" idiom family, and no
regression to any of the three previously-accepted residuals or to
genuine ground-truth reversal detection. Every regression gate passed
fresh. No prohibited path, including `textSecurity.ts`, was touched.

This review recommends the Phase 5E chain (5E → 5E-R → 5E-R Review →
5E-R2 → 5E-R2 Review → 5E-R3 → 5E-R3 Review → 5E-R4 → 5E-R4 Review) is
now eligible for closure, contingent on the project owner's own explicit
sign-off — this review does not declare the chain closed itself. No
Phase 5F was begun or authorized by this review.
