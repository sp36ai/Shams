# Phase 5D-R — Formal Review / Closure Gate

**PHASE 5D-R REVIEW: PASS**

This is an independent review of the Phase 5D-R implementation, conducted
against current source, tests, evidence, and git history — not a
re-statement of `docs/audit/PHASE_5D_R_HARDENING.md`'s own claims. No
production code was modified during this review. All findings below are
either directly reproduced or newly probed.

## 1. Review scope

Verify the Phase 5D-R `PASS` claim independently: implementation
correctness and scope, the two remediated attack classes, false-positive
safety, that the remaining findings were left genuinely open (not silently
absorbed), full regression, and the git/prohibited-path boundary. No new
implementation, no fixes to anything found, no 5E scoping.

## 2. Files inspected

- `functions/src/oracle/textSecurity.ts` (read in full, current state)
- `functions/src/oracle/narrationValidator.ts` (import block, remedy-name
  symmetric-target block at line 525–530, `CHECKS` array and
  `validateNarration()`'s loop at lines 905–990, read in full)
- `functions/src/oracle/__tests__/narrationValidatorUnicodeSecurity.test.ts`
  (all 88 tests, current state)
- `docs/audit/PHASE_5D_R_HARDENING.md`
- `docs/audit/phase-5d-r/summary.json`, `bypass-classes.json` and the
  reconnaissance-rerun evidence
- `docs/audit/golden-corpus/` (regenerated and diffed, not just read)
- `git log`, `git status`, `git diff` against the pre-5D-R and pre-5D
  (Phase 5C-R) commits

## 3. Independent implementation findings

- **Exactly one canonical security-matching primitive.** All transform
  logic lives in `textSecurity.ts`: `foldConfusables()`,
  `bridgeMidWordPunctuation()`, `stripUnicodeNoiseForSecurityMatching()`
  (exported, Phase 5C-R's original transform under its own name), and
  `canonicalizeForSecurityMatching()`, which composes all three stages in
  order. `narrationValidator.ts` contains no normalization logic of its own
  — it only calls the two exported functions from `textSecurity.ts`.
  Confirmed no second implementation exists anywhere in the diff.
- **Confusable handling is narrowly scoped and evidence-backed.**
  `CONFUSABLE_MAP` contains exactly 8 entries (Cyrillic а/е/о/р/с/х/і/у →
  Latin a/e/o/p/c/x/i/y), each with its codepoint documented inline. This
  set matches Phase 5D reconnaissance's own `HOMOGLYPHS` table (in
  `docs/audit/phase-5d/reconnaissance.ts`) minus the one entry
  (`n → ո`, Armenian) that file's own comment flags as weaker evidence.
  Confirmed by direct read of both files — the 8-entry set is not a
  paraphrase, it is the literal intersection.
- **Punctuation handling is bounded and position-aware.**
  `bridgeMidWordPunctuation()` matches exactly one of `. - _` sitting
  between two `[A-Za-z]` letters via
  `/([A-Za-z])[.\-_](?=[A-Za-z])/g`, replacing with the leading letter only
  (lookahead, not consuming the trailing letter). This is structurally
  bounded — cannot match a punctuation character adjacent to
  non-letters, whitespace, or another punctuation character.
- **Repeated-character padding was not modified.** `grep`-level and
  full-file read of `textSecurity.ts` confirms no repeated-character
  collapsing logic of any kind exists in this file. Independently
  reprobed in §4.
- **Three-tier validator fallback is intentional and correctly ordered.**
  `validateNarration()`'s loop (lines 956–990) computes `canonicalText`,
  `unicodeOnlyText`, and the untouched `text`, and evaluates each check as
  `check(canonical) ?? check(unicodeOnly) ?? check(raw)`. The inline
  comment documents the three concrete cases motivating this ordering
  (`HOUSE_MATRIX`'s underscore, the `.ts` file pattern, and the
  ZWJ-inside-underscore combination) and states the ordering property
  precisely: each earlier tier is a superset of what a later tier alone
  would catch for this purpose, so the chain never produces fewer
  detections than any single tier. This claim was independently reprobed
  in §4 and holds.
- **Comparison-target symmetry — one correction to the original report's
  wording.** `CANONICAL_REMEDY_NAMES` (line 528) is genuinely
  target-canonicalized: it applies `canonicalizeForSecurityMatching()` to
  every `REMEDY_LIBRARY` name once, at module load. This is the only
  comparison target in the file treated this way. `PROHIBITED_TERMINOLOGY`,
  `INJECTION_COMPLIANCE_PHRASES`, and `INTERNAL_DATA_PATTERNS` are **not**
  canonicalized on the target side — they remain raw strings/regexes, and
  the three-tier text fallback (§ above) is the mechanism that keeps them
  matching correctly despite narration-side canonicalization, not target
  canonicalization. `PHASE_5D_R_HARDENING.md`'s §5 root-cause explanation is
  accurate on this point; the review gate is flagging it explicitly because
  the phrase "symmetric" could otherwise be read as implying all
  comparison targets were canonicalized, which is not what was built and
  is not what was needed — the fallback chain is a different, and in this
  case more robust, way of achieving the same safety property (it survives
  cases like the ZWJ-inside-underscore combination that target-side
  canonicalization alone would not).
- **No contract, engine, judgment, diagnosis, remedy, prompt, UI, or
  persistence authority was altered.** Confirmed directly in §9.

## 4. Confusable verification (fresh probes, not the existing test suite)

Ran a new, standalone probe script (`functions/scripts/_review-probe-5dr.ts`,
executed via `vite-node` against the real `validateNarration()`/real
contract-building pipeline, then deleted — not committed) covering:

- Every one of the 8 authorized confusable mappings substituted into
  "tomorrow" on a real WAIT/timing contract: **8/8 caught.**
- The original Phase 5D bypass string (`tomоrrow`, Cyrillic o): **caught.**
- Confusable combined with the Phase 5C-R zero-width mechanism
  (`tom‍оrrow` — ZWJ + Cyrillic o together): **caught.**
- Legitimate controls: Arabic/Urdu diacritic prose ("Ṣabr — patient
  endurance... in shāʾ Allāh"), legitimate mixed-script content (a
  parenthetical Greek word), and plain Latin prose: **all 3 stayed VALID.**
- Primitive-level: the excluded Armenian `n → ո` mapping, run directly
  through `canonicalizeForSecurityMatching()`, is confirmed **not** folded
  (U+0578 survives in the output) — the out-of-scope boundary holds at the
  primitive level, not only end-to-end.

Result: **12/12 confusable-related probes passed** with no discrepancy from
the report.

## 5. Punctuation verification (fresh probes)

- Every authorized punctuation form (`.` `-` `_`) inserted mid-word in
  "guaranteed" on a real UNCERTAIN contract: **3/3 caught** (corrected
  during this review — the first probe run used a WAIT/timing contract for
  a certainty-category word, which never exercises
  `checkUnsupportedCertainty` regardless of obfuscation; re-run against the
  correct UNCERTAIN contract, matching the existing regression suite's own
  pattern, all 3 pass).
- A leading period directly before a word with no preceding letter
  (`.guaranteed`) — informational probe only, confirmed this is not a
  mid-word shape and is out of the mechanism's own definition; not scored
  as pass/fail since the mechanism was never claimed to cover it.
- Repeated punctuation (`guarant..eed`) — confirmed **not** caught, matching
  the documented residual exactly (a run of 2+ punctuation characters
  breaks the letter-punct-letter shape by construction).
- Punctuation combined with the Phase 5C-R zero-width mechanism
  (`guar‍ant.eed` — ZWJ + period): **caught**, on the correct UNCERTAIN
  contract.
- Legitimate punctuation-bearing deny-list terms and file patterns, probed
  directly (not merely re-asserting the existing regression test): narration
  containing `HOUSE_MATRIX` verbatim, narration containing
  `narrationValidator.ts` verbatim, and narration containing
  `functions/src/oracle` verbatim — **all 3 still caught**, confirming the
  three-tier fallback's raw-text tier is doing real work, not merely present
  in code.

Result: **6/6 punctuation-related probes passed** (7 including the
informational leading-punctuation case) with no discrepancy from the report.

## 6. False-positive analysis (independent controls)

Ten fresh legitimate-narration controls, run end-to-end through
`validateNarration()` against real contracts, covering every category the
review instruction specified:

| Control | Result |
|---|---|
| Normal sentence punctuation (colon, parens, comma) | VALID |
| Abbreviation with trailing period ("etc.") | VALID |
| Decimal number ("0.6") | VALID |
| Date-shaped string ("15.08.2026") | VALID |
| Non-internal file-like string ("journal.txt") | VALID |
| Selected diacritic remedy name, exact (Ṣalāt al-Istikhārah) | VALID |
| Selected diacritic remedy name, NFD-decomposed | VALID |
| Apostrophe contractions ("it's", "doesn't") | VALID |
| Quotation marks | VALID |
| Hyphenated/underscored legitimate expression | VALID |

**10/10 stayed VALID.** No false positive was found. Per the hard-stop
rule, had one appeared here this review would have stopped and reported it
rather than fixing it — none did.

One border case is worth recording precisely, not as a false positive but
as a known, already-documented trade-off: "well-known" and similar
hyphenated compounds are internally bridged to "wellknown" for **matching
purposes only** (never a rewrite of the narration itself — the
non-mutation proof in §7 covers this). This does not reject the narration;
it was already disclosed in `PHASE_5D_R_HARDENING.md` §6 as an accepted
trade-off, and this review's own control #10 (a sentence containing both
"well-known" and "self_aware") confirms directly that it does not, in
practice, tip the sentence into `invalid`.

## 7. Remaining unresolved mechanisms — confirmed still open

Independently probed, not merely asserted:

- Apostrophe insertion (`guarant'eed`): **remains uncaught (valid: true).**
- Comma insertion (`guarant,eed`): **remains uncaught.**
- Colon insertion (`guarant:eed`): **remains uncaught.**
- Parenthesis insertion (`guarant(eed`): **remains uncaught.**
- Slash insertion (`guarant/eed`): **remains uncaught.**
- Excluded Cyrillic→Armenian `n` confusable: confirmed at the primitive
  level in §4 (character survives canonicalization untouched).
- Repeated-character padding ("tommorrow" on a real WAIT contract):
  **remains uncaught (valid: true)** — unchanged from Phase 5D, exactly as
  authorized.

**7/7 confirmed still open.** Phase 5D-R closed exactly its authorized
two mechanisms for their evidenced scope, and nothing more — no scope
crept in silently.

## 8. Regression results (reproduced fresh, not read from the prior report)

- `cd functions && npx tsc --noEmit` — clean, reproduced.
- `cd functions && npm run lint` — clean, reproduced.
- `cd functions && npx vitest run` — **277/277**, reproduced (15 test files).
- `npm run typecheck` (app root) — clean, reproduced.
- `npm run lint` (app root) — clean, reproduced.
- `npm run test` (app root) — **304/304**, reproduced (27 test suites).
- `node scripts/sync-engine.mjs --check` — clean, reproduced.
- Golden corpus: regenerated fresh via
  `npx vite-node scripts/generate-golden-corpus.ts`, diffed both against
  `git HEAD` (`git diff --stat` empty) and against a pre-regeneration
  filesystem snapshot taken immediately before this review's own run
  (`diff -rq`, no differences) — **byte-identical, confirmed twice.**
- Replay check: `npx vite-node scripts/replay-check.ts` — **24/24**
  identical, reproduced.

No claimed regression result failed to reproduce.

## 9. Git / prohibited-path proof

```
git diff --stat f7579e3..HEAD -- \
  functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/prompts/ \
  src/astrology/ \
  firestore.rules \
  docs/audit/golden-corpus/
```
Output: **empty** (`f7579e3` is the Phase 5C-R commit, the last state before
Phase 5D/5D-R began — this diff spans both Phase 5D reconnaissance and Phase
5D-R implementation).

Full changed-file list across the same range, for completeness:
- `functions/src/oracle/textSecurity.ts`
- `functions/src/oracle/narrationValidator.ts`
- `functions/src/oracle/__tests__/narrationValidatorUnicodeSecurity.test.ts`
- `docs/audit/PHASE_5D_RECONNAISSANCE.md`, `docs/audit/PHASE_5D_R_HARDENING.md`,
  and the evidence JSON under `docs/audit/phase-5d/` and
  `docs/audit/phase-5d-r/` (reconnaissance/harness output only, no code)

`git status --porcelain` at the start and end of this review is empty (this
review's own scratch probe script, `functions/scripts/_review-probe-5dr.ts`,
was deleted before finishing, per the "no production code changes"
constraint — it was never a tracked or committed file).

## 10. Discrepancies from the original 5D-R report

One wording-level discrepancy, not a substantive one: `PHASE_5D_R_HARDENING.md`'s
phrase "apply the mapping symmetrically to narration and comparison
targets" (quoting the original Phase 5D-R authorization) is true for the
confusable/remedy-name case (`CANONICAL_REMEDY_NAMES`) but is achieved for
the deny-list/pattern case (`PROHIBITED_TERMINOLOGY`,
`INTERNAL_DATA_PATTERNS`) by the three-tier text fallback instead of by
canonicalizing those targets. The underlying safety property holds either
way, and the hardening doc's own §5 root-cause section already describes
the fallback mechanism accurately — this review is simply flagging that a
reader taking the word "symmetric" at face value, without reading §5, could
draw an incorrect implementation model. No code or evidence discrepancy was
found: every count, test result, and regression figure in the original
report was independently reproduced exactly.

## 11. Final disposition

**PHASE 5D-R REVIEW: PASS**

The Phase 5D-R implementation is independently verified as correct, scoped
exactly to its two authorized mechanisms (confusable substitution,
mid-word ASCII punctuation insertion, both narrowly evidence-backed), safe
against the false-positive controls tested, and provably free of drift
outside the validator/security-matching boundary. All regression claims
reproduced. All remaining findings — apostrophe/comma/colon/parenthesis/
slash punctuation insertion, the excluded Cyrillic→Armenian `n` confusable,
and repeated-character padding — are confirmed genuinely open, not silently
folded into this phase's closure. One documentation-wording note is
recorded in §10 for precision; it does not affect the disposition.

No changes were made to production code, tests, or evidence during this
review. No hard-stop condition was triggered.
