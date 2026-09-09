# Phase 5E-R4 — Targeted Remediation: the "misfortune" Substring Bypass

**Status: PASS**

## 1. Scope

`docs/audit/PHASE_5E_R3_REVIEW.md` found one new P1 finding: Phase 5E-R3's
widened, unanchored `span.includes('fortune')` check inside
`checkReversalClaims` also matches "fortune" as a substring of the
ordinary English word "misfortune" (and its plural), silently excluding a
genuine, contract-contradicting reversal claim. This phase remediates
exactly that one finding. The three previously-accepted residuals
(5E-R2-Review-1, -2, -4) are re-confirmed unchanged in §7, not reopened.

## 2. Files changed

- `functions/src/oracle/narrationValidator.ts` — the fix (§4).
- `functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`
  — 13 new permanent regression tests (90 total in this file, was 77).

`functions/src/oracle/textSecurity.ts` was **not** touched. No engine,
`ReadingContract`, remedy taxonomy, prompt, UI, or `kp/` file was touched.
No check other than `checkReversalClaims` was modified.

## 3. Pre-implementation discriminator proof

Per the required process, the fix was designed and verified in isolation
(a standalone probe script, deleted after confirming the results below —
never committed) **before** any production code was touched.

**Design:** replace the bare substring search
(`span.includes('fortune')`) with a word-boundary-anchored regex test
(`/\bfortune\b/i.test(span)`). `\b` requires a transition between a word
character and a non-word character (or a string boundary) — "misfortune"
has no such transition immediately before its embedded "fortune" (the
preceding character is "s," a word character), so the anchored pattern
does not match inside it, while every genuine idiom occurrence (preceded
by whitespace, an apostrophe, or the start of the sentence; followed by
whitespace, an apostrophe-s, or punctuation) is unaffected.

**Pre-implementation controls** (run against the proposed regex in
isolation):

| Input | Expected | Result |
|---|---|---|
| `"A reversal of fortune is possible..."` | excluded | ✅ excluded |
| `"Fortune's reversal is possible."` | excluded | ✅ excluded |
| `"A REVERSAL OF FORTUNE IS POSSIBLE HERE."` | excluded | ✅ excluded |
| `"FORTUNE'S REVERSAL IS POSSIBLE."` | excluded | ✅ excluded |
| `"A reversal of  fortune  is possible."` (whitespace) | excluded | ✅ excluded |
| `"Fortune's  reversal  remains possible."` (whitespace) | excluded | ✅ excluded |
| `"Fortune's, reversal is possible."` (punctuation) | excluded | ✅ excluded |
| `"Despite past misfortune, a reversal of this outcome is possible."` | **not** excluded | ✅ not excluded |
| `"Despite recent misfortunes, a reversal of this outcome is possible."` | **not** excluded | ✅ not excluded |
| `"A fortunate turn aside, a reversal of this outcome is possible."` | **not** excluded | ✅ not excluded |
| `"Fortunately, a reversal of this outcome is possible."` | **not** excluded | ✅ not excluded |
| `"A reversal of this outcome is possible."` (genuine, no "fortune") | **not** excluded | ✅ not excluded |
| `"A reversal remains possible here."` (genuine, engine phrasing) | **not** excluded | ✅ not excluded |
| `"A reversal is not possible without real change."` (genuine) | **not** excluded | ✅ not excluded |
| Distant, unrelated "fortune," outside the 20-char window | **not** excluded | ✅ not excluded |

**Boundary sweep** (a standalone "fortune" word, filler characters, then
"reversal is possible" — filler length swept 0–25): the exclusion held
through 11 filler characters and broke cleanly at 12 onward — 9 fixed
characters (`"fortune"` + two spaces) + `N` filler ≤ 20 ⟺ `N≤11`,
confirming the 20-character window itself is unchanged; only what counts
as "fortune" within it was narrowed to a real word match. This exactly
matches Phase 5E-R3's own (pre-bug) boundary behavior once the word
boundary is applied, not a change to the window size.

All 14 pre-implementation checks behaved exactly as required. Only after
this evidence was established was production code changed.

## 4. Exact implementation

```diff
-const REVERSAL_IDIOM_EXCLUSION = 'fortune';
+const REVERSAL_IDIOM_EXCLUSION_PATTERN = /\bfortune\b/i;
 const FORTUNE_LOOKBACK_WINDOW = 20;

 function isReversalOfFortuneIdiom(text: string, match: RegExpExecArray): boolean {
   const start = Math.max(0, match.index - FORTUNE_LOOKBACK_WINDOW);
-  const span = text.slice(start, match.index + match[0].length).toLowerCase();
-  return span.includes(REVERSAL_IDIOM_EXCLUSION);
+  const span = text.slice(start, match.index + match[0].length);
+  return REVERSAL_IDIOM_EXCLUSION_PATTERN.test(span);
 }
```

`REVERSAL_CLAIM_PATTERN`, `REVERSAL_POSSIBLE_WORDS`,
`REVERSAL_NONE_WORDS`, and `FORTUNE_LOOKBACK_WINDOW` are all unchanged.
The `.toLowerCase()` call moved into the regex's own `i` flag rather than
being dropped — the exclusion remains fully case-insensitive.

## 5. Exact before/after reproduction

```
"Despite past misfortune, a reversal of this outcome is possible."
  BEFORE: VALID (the P1 bug — should have been rejected)
  AFTER:  INVALID: REVERSAL_CLAIM_CONTRADICTION

"Despite recent misfortunes, a reversal of this outcome is possible."
  BEFORE: VALID (same bug, plural form)
  AFTER:  INVALID: REVERSAL_CLAIM_CONTRADICTION
```

Both re-verified directly against the real, unmodified
`validateNarration()` after the fix, not merely inferred from the new
test suite.

## 6. False-positive / false-negative controls

Re-verified directly, beyond the pre-implementation isolated probe:

- The idiom family itself (both word orders, case variants, whitespace
  variants, one punctuation variant) still correctly stays VALID —
  confirming the fix did not regress Phase 5E-R3's own closed finding.
- `"fortunate"` and `"fortunately"` (which never actually contained the
  substring "fortune" even before this fix, since `fortunate` has `a`
  where `fortune` needs `e`) do not suppress a genuine claim — tested
  explicitly per this phase's required control list, not merely assumed
  safe.
- Multiple standalone "fortune" occurrences elsewhere in the same
  narration field do not accidentally suppress an unrelated genuine claim
  further away.
- Every genuine, contract-grounded reversal claim this phase and Phase
  5E-R2/5E-R3 previously verified — the engine's own bare phrasing, "of
  this outcome" phrasing, "is not possible" phrasing — still correctly
  fails.

## 7. Boundary analysis

The 20-character `FORTUNE_LOOKBACK_WINDOW` itself is **unchanged** — this
phase narrowed WHAT counts as "fortune" inside that window (a real word,
not any substring), not the window's size. Explicitly re-verified at the
exact cutoff: a standalone "fortune" 11 characters of filler before the
match still excludes (inside the window); 12 characters no longer
excludes (outside the window) — both now permanent regression tests.

## 8. Previously accepted residuals — confirmed untouched

Re-tested directly, not merely asserted:

- **5E-R2-Review-1** (unrelated "ruler" noun collision in
  `checkRulerRelationClaims`) — that function was not touched by this
  phase; residual behavior unchanged by construction.
- **5E-R2-Review-2** (retrograde meta-commentary limitation in
  `checkRetrogradeClaims`) — not touched; unchanged.
- **5E-R2-Review-4** (ZWJ-inside-"fortune" / three-tier fallback
  interaction) — re-tested directly (`"A reversal of fort‍une is possible
  here."`) — **still INVALID, unchanged**. This is expected and correct:
  the word-boundary anchor in this phase's fix does not change how the
  three-tier fallback's raw-text tier sees an obfuscated "fortune" (the
  ZWJ still splits the word on that tier, so `\bfortune\b` still fails to
  match there, exactly as the bare substring check did before). Recorded
  as a permanent regression test (§9) so this residual's exact,
  documented behavior cannot silently drift in a future phase without a
  test failure flagging it.

None of the three residuals regressed, improved, or were reopened by this
phase — consistent with its authorized, narrow scope.

## 9. Permanent regression tests

13 new tests in a `PHASE 5E-R4` describe block in
`narrationValidatorGroundTruth.test.ts` (90 total in the file, up from
77): the exact "misfortune" and "misfortunes" reproductions (now
INVALID); "fortunate" and "fortunately" controls; the idiom family
re-confirmed across word order, case, whitespace, and punctuation
variants; the exact 20-character boundary (11 chars excludes, 12 chars
does not); the multiple-occurrence control; and the 5E-R2-Review-4
residual pinned as an explicit, documented "remains unchanged" test. All
13 pass; all 77 pre-existing tests in the same file continue to pass
unchanged.

## 10. Regression results

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **367/367** (16 test files; was 354
  before this phase).
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304** — unaffected.
- `node scripts/sync-engine.mjs --check` — clean.
- Phase 5C adversarial-harness corpus re-run
  (`npx vite-node scripts/adversarial-harness/run.ts --out-dir=docs/audit/phase-5e-r4`):
  **11,923/11,923, 0 false negatives, 0 false positives, 0 exceptions, 0
  contract mutations** — unchanged.
- Golden corpus: **not regenerated**; confirmed unchanged via
  `git diff --stat -- docs/audit/golden-corpus/`, empty.
- Replay check: **24/24** identical.
- Prohibited-path proof: `git diff --stat 8c975cd..HEAD -- src/astrology/
  functions/src/engine/ functions/src/oracle/readingContract.ts
  functions/src/oracle/remedySelection.ts functions/src/oracle/remedyLibrary.ts
  functions/src/oracle/textSecurity.ts functions/src/prompts/
  firestore.rules docs/audit/golden-corpus/` — **empty**, both against the
  committed range and the working tree. Full changed-file list:
  `functions/src/oracle/narrationValidator.ts`,
  `functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`,
  this document, and the `docs/audit/phase-5e-r4/` evidence — no other
  file.

## 11. Scope discipline

No hard-stop condition was triggered: no new false negative appeared, no
genuine reversal claim became invalid, the fix did not broaden beyond the
"fortune" idiom family (it narrowed the existing exclusion's precision,
it did not add a new excluded word or phrase), the golden corpus did not
change, no prohibited path changed, and no unrelated check or regression
appeared. `checkReversalClaims`'s underlying claim pattern and
ground-truth comparison logic were not touched — only the exclusion's own
word-matching precision.

## 12. Final status

**PHASE 5E-R4: PASS**

The "misfortune" substring bypass is closed: the exact P1 reproduction
now correctly fails validation, the reversal-of-fortune idiom family
(both orderings, all previously-verified variants) remains correctly
excluded, and all three previously-accepted residuals are confirmed
unchanged. Zero regressions across 367 functions tests, 304 app tests,
the 11,923-case adversarial corpus, the golden corpus (untouched), and
the 24-case replay. Prohibited paths, including `textSecurity.ts`,
confirmed untouched. Awaiting the independent 5E-R4 review gate before
the 5E chain closes; not self-closed here.
