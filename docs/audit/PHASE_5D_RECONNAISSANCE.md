# Phase 5D — Validator Obfuscation Hardening: Reconnaissance

**Date:** 2026-09-08
**Nature of this phase:** reconnaissance only. No production code was
modified. No mitigation was implemented. This document, and the offline
scripts/evidence under `docs/audit/phase-5d/`, are the entire deliverable.

**Baseline held immutable throughout:** Phase 5C-R PASS —
`canonicalizeForSecurityMatching()` is the single Unicode security-matching
primitive; 11,923 adversarial cases at 0 false negatives/0 false
positives/0 exceptions/0 contract mutations; functions 189/189 (now
246/246 with 5C-R's own suite); app 304/304; golden corpus 111/111;
replay 24/24; engine mirror synchronized. None of this was touched,
reinterpreted, or re-run to change its meaning — it was re-verified only
to confirm this phase left it exactly as-is (§11).

---

## 1. Executive conclusion

All three mechanisms are **real, reproducible, and currently unmitigated**
bypasses of `narrationValidator.ts`'s literal-matching checks — confirmed
against real, engine-produced contracts via the actual `validateNarration()`
production path, not inferred.

- **Homoglyph/confusable substitution: 540/540 attack cases bypass
  (100%).** Deliberately un-mitigated by `canonicalizeForSecurityMatching()`
  (5C-R's own explicit, documented boundary).
- **Repeated-character padding: 141/372 attack cases bypass (37.9%).**
  Materially *lower* severity than the other two — the mechanism only
  works when the repeated character sits in the interior of the target
  word; repetition at the first or last character leaves the original
  word intact as a literal substring and is still caught (§3.B).
- **ASCII punctuation insertion: 2,953/2,964 attack cases bypass (99.6%).**
  Nearly total, except where the existing `RKP_OBFUSCATED_PATTERN`
  already tolerates punctuation by design for that one term.
- **Combined mechanisms compose to a stronger bypass than any single one**
  (§4): every tested pairing that included punctuation reached 100%
  bypass; pairings without punctuation (homoglyph+repetition,
  homoglyph+zero-width-joiner) reached 61%, higher than repeated-char
  alone but not universal.

**None of the three currently has a mitigation this phase would classify
as safe to implement as a blanket normalization.** Homoglyph folding
(Category C, §7) is the one explicitly flagged as a fuzzy/semantic
problem requiring a scoped, evidence-based confusable table rather than
broad script-folding. Repeated-character collapsing is unsafe as a global
normalization — it altered 17 of 23 legitimate control texts, several
into a different real word (§5). ASCII punctuation stripping is
comparatively closer to safe but not free (8/23 legitimate texts
altered, including contracted "it's"/"seeker's" and hyphenated "well-
known") and needs a bounded, position-aware design, not a blanket strip.

**Decision required before any implementation** (§12): whether to
authorize a Category B (separate bounded detector) treatment for ASCII
punctuation, whether repeated-character padding is worth a detector at
all given its lower severity, and whether homoglyph substitution should
be addressed by a narrow, evidence-scoped confusable table (Category B)
or left as Category D (accepted, documented risk) given the false-
positive risk any broad approach carries.

---

## 2. Exact current validator architecture

Read `functions/src/oracle/narrationValidator.ts` in full immediately
before writing this table (975 lines, current HEAD, `git log -1` =
Phase 5C-R's own commit) — not inferred from prior reports. Full table
in `docs/audit/phase-5d/check-table.json`; summarized:

| Check | Mechanism | Lists/patterns | Normalization path | Known bypass mechanisms (this phase) |
|---|---|---|---|---|
| `checkVerdictConsistency` | substring | `POSITIVE_ASSERTIONS`(7), `NEGATIVE_ASSERTIONS`(7) | canonicalize → lowercase | all three |
| `checkTimingConsistency` (date fabrication) | regex | `MONTH_DATE_PATTERN`, `WEEKDAY_NAMES`(7), `DATE_LIKE_PATTERN` | canonicalize → lowercase | weekday names only; numeric patterns largely unaffected |
| `checkTimingConsistency` (immediacy) | substring | `STRONG_IMMEDIACY_SIGNALS`(9), `SOFT_IMMEDIACY_SIGNALS`(2), `HEDGE_QUALIFIERS`(5) | canonicalize → lowercase | all three |
| `checkTimingConsistency` (day count) | regex | `/(\d+)\s*day/gi` | canonicalize | none — purely numeric |
| `checkRemedyConsistency` (name match) | substring | `REMEDY_LIBRARY` names (33), `CANONICAL_REMEDY_NAMES` map | canonicalize both sides (5C-R) | all three |
| `checkRemedyConsistency` (override phrases) | substring | `REMEDY_OVERRIDE_PHRASES`(6) | canonicalize → lowercase | all three |
| `checkCelestialEntities` | word-boundary regex | `disallowedEntityNames()` over `PLANET_ALIASES` (9 planets) | canonicalize | all three |
| `checkDiagnosisConsistency` | substring, sentence-scoped | `OBSTRUCTION_PHRASES`(3) + `PLANET_ALIASES` | canonicalize → lowercase | all three (against the phrase; lower severity — a defeated phrase match means the check no-ops, not mis-attributes) |
| `checkUnsupportedCertainty` | substring | `CERTAINTY_PHRASES`(9) | canonicalize → lowercase | all three |
| `checkTerminologyLeakage` (deny-list) | substring | `PROHIBITED_TERMINOLOGY`(22, one multi-word) | canonicalize → lowercase | all three |
| `checkTerminologyLeakage` (RKP pattern) | regex | `RKP_OBFUSCATED_PATTERN` | canonicalize | punctuation already tolerated by design; homoglyph substitution of r/k/p is not |
| `checkInternalDataLeakage` | regex | 8 structural patterns (paths, key shapes) | canonicalize | largely irrelevant — shape patterns, not phrases |
| `checkPromptInjectionArtifacts` | substring | `INJECTION_COMPLIANCE_PHRASES`(7) | canonicalize → lowercase | all three |
| `checkWellFormed` | structural | n/a | none (runs before per-field canonicalization) | not applicable |

**Architectural fact confirmed by re-reading, not assumed:** every
text-matching check receives the *same* canonicalized string — computed
once in `validateNarration()`'s loop (line 953) — so a mitigation applied
at that single call site would, as with 5C-R, cover every check
uniformly without touching individual check bodies. This is the same
structural leverage 5C-R used.

---

## 3. Three bypass investigations

Full data: `docs/audit/phase-5d/attack-matrix.json` (3,876 cases),
generated by `docs/audit/phase-5d/reconnaissance.ts` against the real,
11-contract Phase 5C pool (`functions/scripts/adversarial-harness/
contracts.ts`), through the actual `validateNarration()` path, offline,
deterministic, no network calls.

### A. Homoglyph/confusable substitution — 540/540 bypass (100%)

Tested single-character and whole-word substitution, using a small,
evidence-drawn set of Unicode confusables (Cyrillic а/е/о/р/с/х/і/у for
Latin a/e/o/p/c/x/i/y, one Armenian example for a second script), against
`tomorrow`/`immediately`/`today`/`shortly` (timing), `guaranteed`/
`definitely` (certainty), `Krishnamurti`/`engineVersion`/
`ReadingContract` (terminology), and disallowed planet names (celestial),
each against every WAIT/WAIT_LONG or certainty-applicable contract in the
pool.

**Exact reproduction:** contract `employment-001` (BLOCKED, WAIT
posture), narration `interpretation`: `"This will resolve tоmorrow."`
(the "o" in "tomorrow" replaced with Cyrillic о, U+043E) →
`validateNarration()` → `checkTimingConsistency` →
`STRONG_IMMEDIACY_SIGNALS.find(s => lower.includes(s))` → no match
(canonicalization does not fold homoglyphs, by 5C-R's own explicit
design) → `result.valid === true`. **100% bypass rate across every
single-character and whole-word variant tested** — this mechanism is
completely unmitigated, exactly as documented in Phase 5C-R.

### B. Repeated-character padding — 141/372 bypass (37.9%)

Tested doubling and tripling a character at the start, middle, and end
of each target word, across the same term/contract combinations.

**Mechanistic finding, not assumed — derived from the actual position
breakdown:**

| Repetition position | Caught | Bypassed |
|---|---|---|
| First character (pos 0) | 115 | 9 |
| Last character | 61 | 0 |
| Interior character | 0 | 132 |

Repeating the **first or last** character of a word overwhelmingly
leaves the original word intact as a literal contiguous substring —
`"ttomorrow".includes("tomorrow")` is `true` — so the existing check
still fires. Repeating an **interior** character breaks the word into two
pieces, neither of which equals the original — `"tomorrrow"` no longer
contains `"tomorrow"` as a substring — and bypasses every time tested
(132/132 interior-position cases). **This is a real, reproducible
bypass, but structurally narrower than the other two**: an attacker must
specifically target interior characters, and even then the resulting
word is visibly misspelled to a human reader in a way homoglyph/
punctuation obfuscation is not.

**Exact reproduction:** contract `employment-001`, narration:
`"This will resolve tomorrrow."` (the second "r" tripled, an interior
position) → `checkTimingConsistency` → no `STRONG_IMMEDIACY_SIGNALS`
match → `result.valid === true`.

### C. ASCII punctuation insertion — 2,953/2,964 bypass (99.6%)

Tested inserting each of `. - _ / , : ' ( )` at three positions (near-
start, middle, near-end) inside each target word, across the same term/
contract combinations, plus the `verdict` category (opposite-polarity
assertion phrases) and `remedy` category (an unselected remedy name).

**Exact reproduction:** contract `employment-001`, narration:
`"This will resolve t.omorrow."` → `checkTimingConsistency` → no
`STRONG_IMMEDIACY_SIGNALS` match (the literal substring `"tomorrow"` no
longer appears) → `result.valid === true`. **Near-total bypass (99.6%)**
— the 11 caught cases were positions where the inserted punctuation
happened to be adjacent to a word boundary already tolerated by
`RKP_OBFUSCATED_PATTERN`'s own separator-tolerant design (this pattern
is specific to the literal sequence "r"-sep-"k"-sep-"p" and was not
otherwise defeated).

---

## 4. Combined-attack results

Full data: `docs/audit/phase-5d/combined-attacks.json` (90 cases).
Tested `tomorrow`/`guaranteed` against every WAIT/WAIT_LONG contract,
combining: homoglyph+punctuation, homoglyph+repetition,
punctuation+repetition, homoglyph+punctuation+repetition, and
homoglyph+the-already-fixed-5C-R-zero-width-joiner (to test whether
composing an open mechanism with a *closed* one re-opens anything).

| Combination | Bypass rate |
|---|---|
| homoglyph + punctuation | 18/18 (100%) |
| homoglyph + punctuation + repetition | 18/18 (100%) |
| punctuation + repetition | 18/18 (100%) |
| homoglyph + repetition | 11/18 (61%) |
| homoglyph + zero-width-joiner | 11/18 (61%) |

**Finding: the mechanisms compose into a strictly stronger bypass than
any single mechanism alone whenever punctuation is included** (100% vs.
punctuation-alone's 99.6% — a marginal but real increase, closing the
handful of RKP-pattern-adjacent gaps). Combining homoglyph with the
already-*closed* zero-width-joiner mechanism does **not** re-open
anything beyond what homoglyph substitution alone already causes (61% —
identical to homoglyph+repetition, both bounded by the same "does the
non-homoglyph half of the combination land on an interior character"
factor as §3.B) — confirming 5C-R's fix remains fully effective even
under composition with an open mechanism; it is the *homoglyph* half of
the pairing doing 100% of the bypassing, not any interaction with the
zero-width mechanism.

Exact reproduction (worst case): contract `employment-001`, narration:
`"This will resolve ttоmo-rrow."` (homoglyph о + doubled leading t +
mid-word hyphen) → still `valid === true`.

---

## 5. False-positive analysis

**Mandatory, performed before any mitigation recommendation.** Legitimate
control corpus (`docs/audit/phase-5d/legitimate-corpus.json`, 23 texts):
every pool contract's real deterministic-fallback narration (guaranteed
contract-consistent, per 5C-R's own proof), the Phase 4A "SHOULD ACCEPT"
example sentences, a legitimate mention of a real (diacritic-bearing)
remedy name, ordinary contracted/hyphenated/apostrophe'd prose, and a
sentence built specifically to probe a plausible word-boundary collision
("her keen partner" — a phrase already proven safe in Phase 4A).

Three candidate mitigation *concepts* (constructed only inside the
reconnaissance script, never touching production code) were measured for
both attack-coverage and false-positive cost:

| Candidate | Attack cases now caught (of 3,710 measured false negatives) | Legitimate texts altered |
|---|---|---|
| Fold the same small Cyrillic confusable set back to Latin | 580 (15.6%) | **0 / 23** |
| Collapse any run of 2+ identical letters to 1 | 145 (3.9%) | **17 / 23** |
| Strip ASCII `. - _ / , : ' ( )` between two letters (mid-word) | 2,967 (80.0%) | **8 / 23** |

**What each would break, concretely:**
- **Homoglyph folding** (the narrow, evidence-scoped Cyrillic set actually
  used to construct the attacks): **zero** legitimate texts altered in
  this corpus. This is the most promising of the three by this measure —
  but the corpus is 23 texts, not exhaustive, and any real
  implementation would need to scope the confusable table narrowly
  (exactly the letters this codebase's own vocabulary uses) rather than
  a large generic table, per the explicit "do not blindly convert
  arbitrary Cyrillic/Greek" instruction.
- **Repeated-letter collapsing** is **unsafe as a blanket rule**: it
  corrupted "possible"→"posible", "needs_patience"→"neds_patience",
  "supported"→"suported", "matter"→"mater", "fulfilled"→"fulfiled",
  "assertive"→"asertive" — ordinary English words with legitimate double
  letters, several turning into a different real (or near-real) word.
  17 of 23 control texts were altered. This candidate is not a safe
  normalization at any reasonable scope.
- **Mid-word ASCII punctuation stripping** altered contracted forms
  (`it's`→`its`, `seeker's`→`seekers`) and hyphenated compounds
  (`well-known`→`wellknown`, `needs_patience`→`needspatience`) — real
  but arguably lower-stakes changes (no word became a *different* word
  with a different meaning, unlike repeated-letter collapsing) — still a
  measurable cost, and this measurement used a blanket strip, not a
  bounded/targeted detector.

**Conclusion of this analysis:** none of these three concepts is
"apply directly to `canonicalizeForSecurityMatching()`" safe without
further, more targeted design — confirming the instruction's own warning
that an aggressive fix could create more false positives than the
vulnerabilities it removes, especially for repeated-character collapsing.

---

## 6. Severity classification

Using the standing Phase 5 rubric (P0/P1/P2/P3), applied to each
mechanism's *demonstrated* impact — not a projection:

| Mechanism | Severity | Rationale |
|---|---|---|
| Homoglyph/confusable substitution | **P1** | 100% bypass across every check tested; narration safety (the invariant Phase 4/4A/5C/5C-R all exist to guarantee) is defeated whenever this technique is used, on any target term |
| ASCII punctuation insertion | **P1** | 99.6% bypass, functionally near-total; same narration-safety consequence as homoglyph substitution |
| Repeated-character padding | **P2** | Real and reproducible, but structurally bounded (interior-position-only, 37.9% overall) and produces a visibly misspelled word to any human reader — a materially weaker practical threat than the other two |

None reaches P0: as with the four bypasses 5C-R closed, none of these
touches the deterministic engine or `ReadingContract` — every case in
this phase's corpus confirmed the contract byte-identical before/after
(0 contract mutations were possible by construction, since
`validateNarration()` never writes to its inputs — already proven
structurally in 5C-R and unaffected here).

---

## 7. Recommended treatment per mechanism (classification only — no implementation)

- **Homoglyph/confusable substitution → CATEGORY C (fuzzy/semantic
  problem), with a narrow CATEGORY B path noted.** A blanket Unicode
  confusable-folding pass is exactly the "generic fuzzy matching" this
  phase was told not to introduce, and real Unicode confusables data
  (UTS #39) is large and would require careful scoping to avoid
  collateral folding. However, §5 shows that a small, evidence-scoped
  table (the handful of confusables actually relevant to this
  application's own English-language security terms) causes zero
  measured false positives in this corpus and closes 15.6% of the
  measured bypass surface on its own. **Recommendation for the decision
  point:** this could be pursued as a bounded CATEGORY B detector (an
  explicit, small, documented confusable table — not general confusable
  resolution) if authorized, or left CATEGORY D if the residual scope
  risk (an incomplete table always exists) is judged not worth the
  precedent of adding *any* cross-script folding to this codebase.
- **ASCII punctuation insertion → CATEGORY B (requires a separate
  bounded detector), not a blanket normalization addition to
  `canonicalizeForSecurityMatching()`.** §5's blanket-strip measurement
  shows real but survivable false-positive cost (8/23); a *bounded*
  version (e.g., only stripping a punctuation character when it sits
  between two letters of the *same* candidate target word during
  matching, rather than transforming the whole canonical string
  wholesale) was not itself measured in this phase and would need its
  own design and false-positive proof before authorization — this phase
  explicitly stops short of designing it.
- **Repeated-character padding → CATEGORY D (accepted, documented
  risk)**, given its P2 severity, its narrower structural scope (interior-
  position-only), and §5's demonstration that the obvious normalization
  (collapse repeated letters) is unsafe at any reasonable scope. If
  pursued at all, it would need a fundamentally different, more targeted
  primitive than the "letters and short whitespace" domain the current
  security primitive already covers — reported here, not designed.

---

## 8. Explicit non-goals of this phase (confirmed, not merely stated)

- `canonicalizeForSecurityMatching()` was **not** modified — confirmed by
  `git diff --stat -- functions/src/oracle/textSecurity.ts` returning
  empty (§11).
- No fuzzy matcher, edit-distance/Levenshtein comparator, or spell
  checker was introduced anywhere, including inside the reconnaissance
  script — the three "candidate mitigation" transforms in §5 exist only
  as measurement tools inside `docs/audit/phase-5d/reconnaissance.ts`
  and were never applied to, or copied into, any production file.
- No Claude/Anthropic/network call was made anywhere in this phase — the
  entire reconnaissance script is offline and deterministic (confirmed:
  zero `fetch`/`http`/API imports in `reconnaissance.ts`).
- The Unicode mechanisms 5C-R already closed (zero-width chars, format
  characters, combining marks, fullwidth forms, whitespace-run
  normalization) were not reopened or reinterpreted — §4's combined-
  attack test with a zero-width joiner confirms they remain fully closed
  even under composition with an open mechanism.

---

## 9. Evidence paths

- `docs/audit/phase-5d/reconnaissance.ts` — the reconnaissance script
  itself (offline, deterministic, read-only w.r.t. production code).
- `docs/audit/phase-5d/check-table.json` — Step 1's exact current-
  validator check table.
- `docs/audit/phase-5d/attack-matrix.json` — all 3,876 primary attack-
  matrix cases (mechanism × category × target × position/intensity),
  each with original text, mutated text, expected/actual result.
- `docs/audit/phase-5d/combined-attacks.json` — all 90 combined-attack
  cases.
- `docs/audit/phase-5d/mitigation-measurements.json` — the three
  candidate-mitigation measurements against both the attack corpus and
  the legitimate corpus.
- `docs/audit/phase-5d/legitimate-corpus.json` — the 23-text legitimate
  control corpus used for false-positive measurement.
- `docs/audit/phase-5d/summary.json` — aggregate metrics (also printed
  to stdout by the script).

Reproduce with (from `functions/`):
`npx vite-node ../docs/audit/phase-5d/reconnaissance.ts`

---

## 10. Regression results

| Command | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **246/246 passed**, 15 files — unchanged from the 5C-R baseline |
| `cd functions && node scripts/sync-engine.mjs --check` | exit 0, "matches src/astrology/" |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean (one `no-console` warning in the new reconnaissance script, fixed via `console.warn`, per the app's `max-warnings=0` gate) |
| `npm run test` (app root, Jest) | **304/304 passed**, 27 suites — unchanged |
| `npx vite-node functions/scripts/generate-golden-corpus.ts` + `diff -rq` against a pre-run backup | **111/111 identical** — golden corpus untouched |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24 identical** |

**No STOP condition was triggered** — the golden corpus did not change
at any point in this phase (this phase never touches the engine or
narration validator at all, only reads them).

---

## 11. Production drift verification

`git status --porcelain` at the end of this phase:

```
?? docs/audit/phase-5d/
```

`git diff --stat` against every already-tracked file: **empty.** Explicit
scoped checks against every forbidden path (`functions/src/engine/`,
`functions/src/oracle/narrationValidator.ts`, `textSecurity.ts`,
`readingContract.ts`, `narrationContext.ts`, `remedySelection.ts`,
`remedyLibrary.ts`, `functions/src/prompts/`, `src/astrology/`,
`firestore.rules`, app `src/`, `docs/audit/golden-corpus/`,
`docs/audit/phase-5c/`) — **all empty.**

**Production code changed: 0.** The only new content anywhere is
`docs/audit/phase-5d/` (the reconnaissance script and its generated
evidence) and this report.

---

## 12. Decision required before implementation

This phase does not choose a fix. Before any Phase 5D-implementation (or
equivalently-scoped) phase is authorized, three separate decisions are
needed:

1. **Homoglyph/confusable substitution (P1, 100% bypass):** authorize a
   narrow, evidence-scoped confusable-folding table (Category B, bounded)
   for implementation and its own adversarial + false-positive proof
   cycle — or accept it as a documented, unmitigated risk (Category D)?
2. **ASCII punctuation insertion (P1, 99.6% bypass):** authorize design
   and implementation of a bounded, position-aware punctuation detector
   (Category B) distinct from `canonicalizeForSecurityMatching()`'s own
   responsibility — or accept as documented risk?
3. **Repeated-character padding (P2, 37.9% bypass, narrower in practice):**
   given its lower severity and the demonstrated unsafety of the obvious
   normalization, is this worth pursuing at all in a near-term phase, or
   should it be recorded as accepted risk (Category D) pending a
   fundamentally different approach?

Each decision should be issued as its own explicit authorization,
scoped exactly as narrowly as this reconnaissance phase and Phase 5C-R
were, per the standing project discipline — this report recommends
nothing be bundled into a single follow-up phase without that
per-mechanism decision being made first.

---

## FINAL STATUS

**PHASE 5D (RECONNAISSANCE): COMPLETE.**

No implementation was performed. No mitigation was chosen.
`narrationValidator.ts` and `textSecurity.ts` were not modified. No
Phase 5D-R (or equivalent remediation phase) was started. Awaiting the
per-mechanism decisions in §12 before any further authorization.
