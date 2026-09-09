# Phase 5E-R3 — Narrow P2 Remediation: Reordered Reversal-of-Fortune Idiom

**Status: PASS**

## 1. Scope

`docs/audit/PHASE_5E_R2_REVIEW.md` (Finding 5E-R2-Review-3, P2) found the
Phase 5E-R2 "of fortune" exclusion in `checkReversalClaims` does not
generalize to the same idiom reordered: "Fortune's reversal is possible"
still false-positives, because the word "fortune" precedes "reversal"
instead of following it, and so never falls inside the matched span
`REVERSAL_CLAIM_PATTERN` captures. This phase remediates exactly that one
finding. The three lower-severity findings from the same review
(5E-R2-Review-1, -2, -4) remain accepted, documented residuals, per the
authorization — not reopened here.

## 2. Files changed

- `functions/src/oracle/narrationValidator.ts` — widened the exclusion's
  own search span (below).
- `functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`
  — 12 new permanent regression tests (77 total in this file, was 65).

`functions/src/oracle/textSecurity.ts` was **not** touched.

## 3. Fresh reproduction of the P2 finding

Before any code change, re-confirmed against the current (pre-fix)
implementation:

```
"A reversal of fortune is possible if effort continues."
  → VALID (already fixed by Phase 5E-R2's "of fortune" exclusion)
"Fortune's reversal is possible."
  → INVALID: REVERSAL_CLAIM_CONTRADICTION (the P2 finding — NOT excluded)
```

## 4. Discriminator design — evidence established before implementation

Per this phase's required process, the discriminator was designed and
verified against positive and negative controls **before** any production
code was touched (a standalone probe script, deleted after confirming the
results below — never committed).

**Design:** widen the exclusion's search span, not the underlying claim
pattern. Instead of checking only the matched text (`match[0]`) for the
word "fortune," also look up to `FORTUNE_LOOKBACK_WINDOW` (20 characters —
enough for `"Fortune's "`, 10 characters, plus slack) immediately BEFORE
the match start. This still targets exactly the one demonstrated idiom
word, "fortune," in either position relative to "reversal" — it does not
add a second word, a stemmed/fuzzy match, or any dictionary of idioms.

**Pre-implementation verification** (run against the proposed logic in
isolation, not yet wired into the real check):

| Input | Expected | Result |
|---|---|---|
| `"A reversal of fortune is possible..."` | excluded | ✅ excluded |
| `"Fortune's reversal is possible."` | excluded | ✅ excluded |
| `"A REVERSAL OF FORTUNE IS POSSIBLE HERE."` | excluded | ✅ excluded |
| `"FORTUNE'S REVERSAL IS POSSIBLE."` | excluded | ✅ excluded |
| `"A reversal of  fortune  is possible."` (extra whitespace) | excluded | ✅ excluded |
| `"Fortune's  reversal  remains possible."` (extra whitespace) | excluded | ✅ excluded |
| `"A reversal of fortune remains possible."` | excluded | ✅ excluded |
| `"A reversal of this outcome is possible."` (genuine) | **not** excluded | ✅ not excluded |
| `"A reversal remains possible here."` (genuine, engine phrasing) | **not** excluded | ✅ not excluded |
| `"A reversal is not possible without real change."` (genuine) | **not** excluded | ✅ not excluded |
| `"This matter requires patience and reflection."` (no reversal claim) | **not** excluded | ✅ not excluded |

All 11 pre-implementation controls behaved exactly as required. Only
after this evidence was established was the production code changed.

## 5. Exact implementation

```diff
-const REVERSAL_IDIOM_EXCLUSION = 'of fortune';
+const REVERSAL_IDIOM_EXCLUSION = 'fortune';
+const FORTUNE_LOOKBACK_WINDOW = 20;
+
+function isReversalOfFortuneIdiom(text: string, match: RegExpExecArray): boolean {
+  const start = Math.max(0, match.index - FORTUNE_LOOKBACK_WINDOW);
+  const span = text.slice(start, match.index + match[0].length).toLowerCase();
+  return span.includes(REVERSAL_IDIOM_EXCLUSION);
+}

 export function checkReversalClaims(...): ValidationFailure | null {
   const match = REVERSAL_CLAIM_PATTERN.exec(text);
   if (!match) return null;
-  if (match[0].toLowerCase().includes(REVERSAL_IDIOM_EXCLUSION)) {
+  if (isReversalOfFortuneIdiom(text, match)) {
     return null;
   }
   ...
```

`REVERSAL_CLAIM_PATTERN` itself, `REVERSAL_POSSIBLE_WORDS`, and
`REVERSAL_NONE_WORDS` are all unchanged — the underlying claim shape and
the ground-truth comparison logic were not touched, only how far back the
exclusion looks for the one idiom word.

## 6. Zero new false negatives — genuine claims re-verified

Re-run directly against the real implementation after the change:

- `"A reversal of this outcome is possible."` — still
  `REVERSAL_CLAIM_CONTRADICTION` on a `NONE` reading.
- `"A reversal remains possible here."` (the engine's own exact
  `diagnosis.rationale` phrasing) — still `REVERSAL_CLAIM_CONTRADICTION`
  on a `NONE` reading.
- `"A reversal is not possible without real change."` — still
  `REVERSAL_CLAIM_CONTRADICTION` on a `POSSIBLE` reading.
- A control placing the word "fortune" **outside** the 20-character
  lookback window, well before an otherwise-genuine claim
  (`"Speak plainly of fortune and fate first, then note separately: a
  reversal of this outcome is possible."`) — still
  `REVERSAL_CLAIM_CONTRADICTION`, confirming the window is bounded, not
  a sentence-wide search that could be gamed by placing "fortune"
  anywhere in a long narration field to suppress an unrelated genuine
  claim.

## 7. Permanent regression tests

12 new tests in a `PHASE 5E-R3` describe block in
`narrationValidatorGroundTruth.test.ts`, covering exactly the matrix the
authorization specified: reversal of fortune (original order); Fortune's
reversal (reordered — the exact review reproduction); reordered with
"remains"; capitalization variants (ALL CAPS reordered, Title Case
original); punctuation/whitespace variants (extra spacing, both orders);
three genuine contract-grounded reversal claims (including the engine's
own bare phrasing); ordinary non-reversal prose; and the bounded-window
control above. All 12 pass; all 65 pre-existing tests in the same file
continue to pass unchanged (77 total, up from 65).

## 8. Regression results

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **354/354** (16 test files; was 342
  before this phase — the 12 new tests above).
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304** — unaffected.
- `node scripts/sync-engine.mjs --check` — clean.
- Phase 5C adversarial-harness corpus re-run
  (`npx vite-node scripts/adversarial-harness/run.ts --out-dir=docs/audit/phase-5e-r3`):
  **11,923/11,923, 0 false negatives, 0 false positives, 0 exceptions, 0
  contract mutations** — unchanged.
- Golden corpus: **not regenerated**; confirmed unchanged via
  `git diff --stat -- docs/audit/golden-corpus/`, empty.
- Replay check: **24/24** identical.
- Prohibited-path proof: `git diff --stat e8b227f..HEAD -- src/astrology/
  functions/src/engine/ functions/src/oracle/readingContract.ts
  functions/src/oracle/remedySelection.ts functions/src/oracle/remedyLibrary.ts
  functions/src/oracle/textSecurity.ts functions/src/prompts/
  firestore.rules docs/audit/golden-corpus/` — **empty**, both against the
  committed range and the working tree at time of writing. Full
  changed-file list: `functions/src/oracle/narrationValidator.ts`,
  `functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`,
  this document, and the `docs/audit/phase-5e-r3/` evidence — no other
  file.

## 9. Scope discipline

No hard-stop condition was triggered: the fix required no semantic
interpretation (a bounded character-window substring check, not NLP), no
expansion beyond the "fortune" idiom family (no second word or dictionary
was added), no genuine reversal claim became a false negative, and no
new false positive of any kind was found in this phase's own testing.
`checkReversalClaims` was not redesigned — only the exclusion's own
lookback span was widened.

## 10. Final status

**PHASE 5E-R3: PASS**

Finding 5E-R2-Review-3 closed. The reversal-of-fortune idiom, in either
word order, correctly stays VALID; every genuine contract-grounded
reversal claim this phase tested — including three new controls beyond
what Phase 5E-R2 itself verified — still correctly fails. Zero
regressions across 354 functions tests, 304 app tests, the 11,923-case
adversarial corpus, the golden corpus (untouched), and the 24-case
replay. Prohibited paths, including `textSecurity.ts`, confirmed
untouched. Awaiting the independent 5E-R3 review gate before the 5E chain
closes; not self-closed here.
