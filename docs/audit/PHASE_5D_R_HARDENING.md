# Phase 5D-R — Validator Hardening

**Status: PASS**

## 1. Scope (authorized)

Phase 5D reconnaissance (`docs/audit/PHASE_5D_RECONNAISSANCE.md`) measured three
open bypass mechanisms against `validateNarration()`: homoglyph/confusable
substitution (100% bypass), mid-word ASCII punctuation insertion (99.6%
bypass), and repeated-character padding (37.9% bypass). Phase 5D-R was
authorized to remediate **only** the first two — narrowly, evidence-backed,
inside the existing single security-matching primitive
(`functions/src/oracle/textSecurity.ts`) — and explicitly **not** to touch
repeated-character padding, which Phase 5D's own false-positive analysis
showed has no safe blanket normalization (17/23 legitimate control texts
corrupted). That mechanism remains an accepted, documented P2/open risk,
unchanged in this phase.

## 2. Exact files changed

- `functions/src/oracle/textSecurity.ts` — added `CONFUSABLE_MAP` +
  `foldConfusables()`, `bridgeMidWordPunctuation()`, and exported
  `stripUnicodeNoiseForSecurityMatching()` (Phase 5C-R's original transform,
  now exposed under its own name). `canonicalizeForSecurityMatching()` now
  composes all three stages.
- `functions/src/oracle/narrationValidator.ts` — `validateNarration()`'s
  per-field loop now tries three progressively less-transformed copies of
  each field's text against every check (full canonical → Unicode-noise-only
  → raw), taking the first non-null result. See §5 for why a single
  canonical pass was insufficient.
- `functions/src/oracle/__tests__/narrationValidatorUnicodeSecurity.test.ts`
  — corrected the now-stale Phase 5C-R "does NOT fold a homoglyph" test to
  assert the new, authorized behavior; added permanent regression coverage
  for both new mechanisms (unit-level bridging/folding cases, an expanded
  metamorphic table, legitimate-text controls, and non-mutation proofs).

No other file in the repository was modified. Engine, `kp/`, `ReadingContract`,
diagnosis, remedy, prompts, UI, and the golden corpus are untouched — verified
in §9.

## 3. Confusable hardening — mapping and evidence

`CONFUSABLE_MAP` folds exactly the 8 Cyrillic characters Phase 5D's own
reconnaissance (`docs/audit/phase-5d/reconnaissance.ts`'s `HOMOGLYPHS` table)
used to construct attack text and measured at a 100% bypass rate, and that
the same phase's false-positive analysis measured at **zero** corruption
against its 23-text legitimate control corpus:

| Latin | Cyrillic | Codepoint |
|---|---|---|
| a | а | U+0430 |
| e | е | U+0435 |
| o | о | U+043E |
| p | р | U+0440 |
| c | с | U+0441 |
| x | х | U+0445 |
| i | і | U+0456 |
| y | у | U+0443 |

Deliberately excluded: the reconnaissance script's own `HOMOGLYPHS` table
also included `n → ո` (Armenian U+0578), but that file's own comment flags
it as "visually close to n in SOME FONTS" — weaker evidence than the other
eight, which are canonical Unicode confusables. It is **not** in
`CONFUSABLE_MAP` and remains open (see §7). No other script, and no other
Cyrillic letter, is folded — this is not general Unicode confusable
resolution (UTS #39).

## 4. Punctuation hardening — patterns covered

`bridgeMidWordPunctuation()` merges a single `.`, `-`, or `_` sitting
directly between two Latin letters with no surrounding whitespace (the
"guarant.eed" shape), via a lookahead-based regex so a chain of such
separators between single letters (e.g. "R.K.P.") fully collapses rather
than only the first pair merging.

**Covered:** `.` `-` `_` as a single mid-word character.
**Not covered, by deliberate design:**
- Apostrophe — overwhelming legitimate use in contractions ("it's", "don't").
- Comma, colon, parentheses — Phase 5D's own false-positive analysis flagged
  these as more likely to appear in ordinary sentence structure.
- Forward slash — **removed during this phase's own implementation**; see
  §6 finding 1.
- A run of two or more punctuation characters in a row ("a..b") — each
  match requires a letter on both sides, so a second adjacent punctuation
  character breaks the shape. Documented residual, not chased.
- A trailing separator with no following letter ("etc.") — left untouched.

## 5. Newly discovered findings (during this phase's own implementation)

Phase 5D-R's authorization required treating any additional bypass
discovered during remediation as a finding to classify and document, not
silently fix. Two were found and — because they were **regressions in
pre-existing, unrelated detection** caused by this phase's own change,
rather than new attack surface — were fixed, per the hard-stop guidance
that a fix must never weaken an existing detector.

**Finding 1 — forward slash in the punctuation bridge defeated file-path
detection.** An initial draft of `bridgeMidWordPunctuation()` included `/`
(matching Phase 5D's full 9-character punctuation sweep). This broke
`checkInternalDataLeakage`'s literal-slash-dependent patterns (e.g.
`/\bfunctions\/src\//i`): "functions/src" canonicalized to "functionssrc",
never matching. Caught immediately by the existing regression suite (3
tests failed: `adversarialNarration.test.ts > source-code-leakage`,
`> terminology-obfuscation`, `narrationValidator.test.ts > rejects a
source-file-shaped path`). **Resolved by narrowing** the bridged set to
`. - _` only — not by touching the unrelated detector.

**Finding 2 — canonicalization can defeat a deny-list term or pattern that
itself legitimately contains bridged/folded punctuation.** Re-running the
full Phase 5C adversarial-harness corpus (11,923 cases) after Finding 1's
fix surfaced two further classes, both invisible to the hand-picked unit
tests:
- `PROHIBITED_TERMINOLOGY` contains `'HOUSE_MATRIX'` (a literal underscore);
  bridging turned matching narration text into "HOUSEMATRIX", which no
  longer matched the term via plain `.includes()`. 120 false negatives.
- `INTERNAL_DATA_PATTERNS` includes `/\.ts\b/`; bridging turned
  "narrationValidator.ts" into "...torts", losing the literal period the
  pattern depends on. 15 false negatives.
- A third, sharper case: a zero-width joiner planted **inside**
  `HOUSE_MATRIX`'s own underscore defeated *both* a naive raw-text fallback
  (the ZWJ still splits the literal substring) and the full canonical pass
  (which strips the ZWJ *and* bridges the underscore). 36 residual false
  negatives after the first fallback fix.

**Root cause:** `validateNarration()` canonicalizes narration text but never
touches the comparison targets (deny-list strings, regex patterns) — by
design, since regex patterns can't be meaningfully "canonicalized." When a
comparison target itself legitimately contains a character the new stages
transform, the transformed narration text can stop matching it even though
the untransformed text always did.

**Resolution:** `validateNarration()`'s loop now tries each check against
three progressively less-transformed copies of the field text, in order,
taking the first non-null result:
1. Fully canonicalized (`canonicalizeForSecurityMatching`) — catches
   obfuscated attacks (the whole point of this phase).
2. Unicode-noise-only (`stripUnicodeNoiseForSecurityMatching`, Phase 5C-R's
   original transform, exported unchanged) — catches cases where full
   canonicalization over-transforms a legitimate literal, but a Unicode
   attack (ZWJ, etc.) is still in play.
3. Raw, untouched text — exactly this validator's pre-5C-R behavior,
   introducing no new false positive by construction.

Each tier is a superset of what the next tier alone would catch for this
purpose, so trying them in this order never produces *fewer* detections
than any single tier — only more. All three findings above are fully closed
by this change (verified in §8).

## 6. False-positive / valid-preservation results

Unit-level (`narrationValidatorUnicodeSecurity.test.ts`, `canonicalizeForSecurityMatching` describe block): contractions (`it's`, `don't`), comma/colon/parentheses, a
trailing abbreviation period (`etc.`), a forward slash, a run of repeated
punctuation, and a non-evidenced confusable (Greek omicron) all pass through
unchanged, as asserted directly.

End-to-end (`validateNarration()`, new "ordinary prose... stays VALID"
describe block): a contraction, a hyphenated compound, an abbreviation, ordinary
sentence punctuation, legitimate Arabic/Urdu diacritic terminology unrelated
to the remedy library, and a non-evidenced confusable inside otherwise plain
prose all validate as `valid: true` through the real contract/check path.

One accepted, explicitly-documented trade-off: a genuine hyphenated compound
("well-known") *is* structurally identical to the attack shape and does get
bridged internally for matching purposes ("wellknown") — this does not
reject the narration (canonicalization is match-only, never a rewrite; see
`textSecurity.ts`'s own non-mutation guarantee), it only means such a
compound cannot itself be relied on as a deny-list evasion technique either.
Recorded as an explicit assertion, not a silent side effect.

Diacritic-bearing remedy names (`Ṣalāt al-Istikhārah`, both clean and
NFD-decomposed) continue to validate correctly per Phase 5C-R's existing
regression suite (unaffected by this phase — confirmed by full suite pass).

## 7. Phase 5D reconnaissance corpus re-run (closure measurement)

Re-ran `docs/audit/phase-5d/reconnaissance.ts` unmodified (temporarily
redirecting its output path to `docs/audit/phase-5d-r/reconnaissance-rerun/`,
then reverting the file via `git checkout`) against the fixed validator.
This script deliberately sweeps the *full* Phase 5D attack surface,
including punctuation characters and homoglyphs Phase 5D-R was explicitly
NOT authorized to close — so a nonzero residual here is expected and is the
correct signal that this phase closed exactly its authorized scope, no more:

- **ASCII punctuation, evidenced set (`. - _`):** 937/948 caught (98.9%),
  up from 0/948 (0%) before this phase. The 11 residual per character are
  entirely the two documented residuals (runs of 2+ punctuation characters;
  trailing separator with no following letter) — a structural limitation of
  the bounded pattern, not an implementation gap.
- **ASCII punctuation, out-of-scope set (`' ( ) , / :`):** 0/1944 caught
  (0%), unchanged — correctly still open, exactly as authorized.
- **Homoglyph, evidenced 8-letter set:** all attack strings built from the
  8 mapped letters are now closed (confirmed directly by the harness in §8
  and by the metamorphic regression table in §6, not solely by this script).
  The reconnaissance script's own residual count (129/540) resolves to:
  84 cases using the deliberately-excluded `n → ո` (Armenian) mapping
  (correctly still open, §3), and 45 cases (`definitely`, single-char
  positions with е/і/у) where the *unobfuscated* target word itself was
  never part of the real validator's certainty deny-list in the first place
  (`checkUnsupportedCertainty` matches the phrases "definitely will"/"will
  definitely", not the bare word) — a mismatch between this reconnaissance
  script's own word choice and the production check, present since Phase
  5D's original run, not something this phase's fix could or should affect.
- **Repeated-character padding:** unchanged (141/372, 37.9% bypass) — not in
  scope for this phase, exactly as authorized.

## 8. Phase 5C adversarial-harness corpus re-run

Re-ran the full generative/metamorphic harness
(`npx vite-node scripts/adversarial-harness/run.ts --out-dir=docs/audit/phase-5d-r`),
11,923 cases, real contract pool, unmodified generator:

```
generated: 11923, executed: 11923
falseNegativeCount: 0
falsePositiveCount: 0
exceptionCount: 0
contractMutations: 0
uniqueBypassClassCount: 0
```

Identical to the Phase 5C-R baseline (`docs/audit/phase-5c-r/summary.json`:
also 0/0/0/0). This run is what first surfaced Finding 2 in §5 (before the
three-tier fallback fix, this same corpus showed 135 false negatives across
`terminology` and `internal-data-leakage`) and confirms it is now fully
closed, with no new false positive introduced anywhere in the 11,923-case
corpus.

## 9. Regression results

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` (`tsc --noEmit && eslint . --max-warnings=0`) — clean.
- `cd functions && npx vitest run` — **15 test files, 277 tests, all passing**
  (up from 246 at the start of this phase: +31 new permanent regression
  tests for the two closed mechanisms, described in §6).
- `node scripts/sync-engine.mjs --check` — passed (`functions/src/engine/`
  matches `src/astrology/`), also auto-run as a vitest `globalSetup` hook on
  every run above.
- Golden corpus: regenerated via `npx vite-node scripts/generate-golden-corpus.ts`
  and diffed against `git HEAD` — **byte-identical, zero drift**
  (`git diff --stat -- docs/audit/golden-corpus/` empty).
- Replay check: `npx vite-node scripts/replay-check.ts` — all 24 cases
  byte-identical across two in-process invocations, no nondeterminism.
- App root: `npm run typecheck`, `npm run lint`, `npm run test` — all clean
  (304/304 tests passing). None of this phase's changes touch client code;
  run per the phase's own acceptance-gate requirement.

## 10. Scope-boundary verification

`git status --porcelain` at the end of this phase shows exactly three
modified files (`functions/src/oracle/textSecurity.ts`,
`functions/src/oracle/narrationValidator.ts`,
`functions/src/oracle/__tests__/narrationValidatorUnicodeSecurity.test.ts`)
plus this document and the new `docs/audit/phase-5d-r/` evidence directory.
Nothing under `functions/src/engine/`, `src/astrology/` (`kp/` included),
`ReadingContract`, diagnosis, remedy selection/library, prompts, response
composition, client/UI, Firestore rules, or the golden/replay corpora was
touched.

## 11. Final status

**PASS.** Both authorized P1 mechanisms (confusable substitution, mid-word
ASCII punctuation insertion) are closed for their evidence-backed scope,
symmetrically and inside the single existing primitive; two regressions this
phase's own implementation introduced in pre-existing, unrelated detection
were caught by the existing regression/harness discipline before being
accepted, and fixed by a conservative three-tier fallback rather than by
touching the deny-lists or narrowing the new mechanisms below their
evidenced scope. Zero false negatives for the defined attack model, zero new
false positives, zero exceptions, zero contract mutations, zero golden-corpus
drift, zero changes outside the validator/security-matching boundary.
Repeated-character padding remains untouched, an accepted, documented P2/open
risk, as authorized.
