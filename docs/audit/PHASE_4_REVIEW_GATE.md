# Phase 4 — Forensic Validator Review

**Status: review only. Zero code changed.** `git status` confirms no
modifications from this pass. Every claim below was produced by reading the
actual current source (`narrationValidator.ts`, `narrationFallback.ts`,
`responseComposer.ts`, `askWatchOracle.ts`) and, where a claim was testable,
running a direct probe against the real functions — not by re-reading the
Phase 4 report's own summary of itself.

**Headline: this review found real, concrete, demonstrated gaps.** None of
them let a validated narration silently state the OPPOSITE of the engine's
verdict with no check catching it at all — the layered checks provide real
overlap. But several specific phrasings do slip past the SPECIFIC check
named to catch that category, and are only sometimes caught by a different
check for coincidental reasons. Per this phase's own standing rule
("never round up to done/proven when the evidence doesn't support it"),
this is reported as **PASS WITH DOCUMENTED GAPS**, not an unconditional
`PHASE 4 REVIEW GATE: PASS` — see §18 for the exact reasoning and my
recommendation.

---

## 1. Exact runtime validation order — traced, not assumed

Read `askWatchOracle.ts` and `responseComposer.ts` in full this pass.
Confirmed sequence, by line:

1. `askWatchOracle.ts`: `readingRef = db.collection('readings').doc()` —
   **allocates an id only, no write.**
2. `oracleResponse = await composeWatchOracleResponse({...})` — this single
   awaited call contains the ENTIRE chain below, and does not return until
   all of it has completed:
   a. `diagnose(verdict)` → `selectRemedyProtocol(diagnosis)` (unchanged engine)
   b. `buildReadingContract(...)` — the immutable `ReadingContract` now exists
   c. `toNarrationContext(contract, ...)` → `NarrationContext`
   d. `narrate(narrationContext)` → Claude Opus 5 → `drafted: NarrationFields | null`
   e. **if `drafted !== null`**: `validateNarration(contract, drafted)` runs
   f. **if invalid**: `logger.warn(...)`, then `narration = buildDeterministicFallbackNarration(contract)`
   g. returns `Object.freeze({ narration, ... })` — `narration` is now
      EITHER the validated draft OR the fallback, never the rejected draft
3. Back in `askWatchOracle.ts`: `readingDoc` is assembled from
   `oracleResponse?.narration?.interpretation` — reading the
   ALREADY-substituted value from step 2's return.
4. `await readingRef.set({...readingDoc, createdAt: new Date()})` — **the
   first and only Firestore write, strictly after step 2 has fully
   resolved.**

**Persistence occurs after validation, with no code path that can write
before it.** There is exactly one call site of `composeWatchOracleResponse`
in production (`functions/src/functions/askWatchOracle.ts:251`, re-confirmed
by grep) and exactly one Firestore write of the reading document, after it.
Invalid narration cannot bypass validation because there is no second path
to the client/Firestore that skips step 2 — the function's own return value
is the only source `askWatchOracle.ts` reads from.

**One real, minor defect found here, unrelated to the validation logic
itself:** `askWatchOracle.ts`'s own comment above `readingRef` allocation
still reads *"the safety validator logs its result under
readings/{readingId}/validationLog"* — a **stale comment**, left over from
Phase 2A's design discussion of the (never-shipped-this-way) historical
validator's Firestore sub-collection logging pattern. The actual Phase 4
validator logs via `logger.warn()` (Cloud Logging), not a Firestore
`validationLog` subcollection — no such subcollection is written anywhere
in the current code (confirmed: `grep -rn "validationLog" functions/src`
finds only this one comment, no writer). This is a documentation accuracy
issue, not a behavior defect — flagged per this review's own rule to name
things precisely rather than let a stale claim stand. Not fixed here per
the review gate's "STOP and report instead of expanding scope."

---

## 2. Contract integrity

- **Zero Firestore/db/network access** in either `narrationValidator.ts` or
  `narrationFallback.ts` — confirmed by grep; the only two hits for
  "Firestore"/"readings/" are a doc comment and a regex pattern literal, not
  code that reads anything.
- **Zero assignment into any `contract.*` field** anywhere in either file
  — confirmed by grep for the assignment pattern. Combined with Phase 3's
  `deepFreeze()` (which would throw in this codebase's `strict: true` mode
  on any attempted write), mutation is prevented at two independent layers:
  the validator never attempts it, and the object would reject the attempt
  if it did.
- The validator's only two parameters are `contract: ReadingContract` and
  `narration: NarrationFields | null | undefined` — no other data source is
  reachable from inside `validateNarration` or any check function.

---

## 3. Verdict check — forensic review with concrete probes

Read `checkVerdictConsistency` in full. It is `text.toLowerCase()` then
`.includes()` against two fixed phrase lists (`POSITIVE_ASSERTIONS`,
`NEGATIVE_ASSERTIONS`), checked against `OUTCOME_POLARITY[outcome]`.

**Tested directly, not inferred:**

| Input | Result | Finding |
|---|---|---|
| `"It is not true that the matter is fulfilled."` (negative outcome, this sentence is actually CORRECT) | **Flagged as `VERDICT_CONTRADICTION`** | **Negation is NOT handled** — a real false positive. The check has no concept of negation; it matches the substring regardless of what precedes it. |
| `"THE MATTER IS FULFILLED, without question."` | Flagged correctly | Case variants ARE handled (`.toLowerCase()`). |
| `"The matter... is fulfilled? No."` | **Not flagged** | Punctuation-interrupted phrasing bypasses substring match. |
| `"Rest assured, everything will go your way."` (a clear favourable assertion, in different words, on a negative-outcome contract) | **Not flagged** | Confirmed false negative for paraphrase — the documented "phrase-based, not full NLU" limitation demonstrated concretely, not just claimed. |

**Assessment:** the check is precise (near-zero risk of flagging genuinely
unrelated text) but not comprehensive, and — new information this review
surfaces — it can produce a **false positive on a correctly-hedged/negated
sentence**, which would unnecessarily discard valid, safe narration into
the fallback. That failure direction is toward safety (a real reading is
replaced with a duller but not less accurate deterministic one), not toward
harm, but it is a real defect worth naming precisely rather than folding
into the generic "not full NLU" disclaimer.

---

## 4. Timing — forensic review (the highest-risk category, tested against the user's own three examples)

Read `checkTimingConsistency` in full. Three independent checks: (1) a
calendar-date-shaped token (month/weekday name or a date-like regex) → always
`TIMING_FABRICATION`; (2) an immediacy-signal phrase when `timingPosture`
is `WAIT`/`WAIT_LONG` → `TIMING_ALTERATION`; (3) an extracted "N day(s)"
number outside the settled window, or any such number when `timing` is
`null` → `TIMING_FABRICATION`/`TIMING_ALTERATION`.

**Tested against the user's three examples directly, on a real WAIT/45-90-day contract:**

| Example | `checkTimingConsistency` alone | Full `validateNarration` |
|---|---|---|
| Faithful: *"Expect movement within the indicated period."* | `null` (valid) | valid |
| Fabricated: *"September 19th is the exact date."* | **Caught** (`TIMING_FABRICATION`, matched "september") | invalid |
| Altered: *"The result will definitely happen tomorrow."* | **`null` — NOT caught by the timing check** | **invalid — but caught by `VERDICT_CONTRADICTION`** (the phrase "will definitely happen" is independently in `POSITIVE_ASSERTIONS`), a coincidental catch, not a timing-specific one |

**The concrete gap, demonstrated with a variant that removes the
coincidental overlap:** *"Expect this to resolve tomorrow."* on the same
WAIT/45-90-day contract — **`validateNarration` returns `valid: true`.**
Neither the timing check (`"tomorrow"` is not in `IMMEDIACY_SIGNALS`, which
only lists `"immediately"`, `"right now"`, `"today"`, `"this instant"`,
`"without delay"`) nor the verdict check (no polarity-assertion phrase
present) catches it. Same result for `"very soon, within days"` and
`"this week"` — none of these near-term immediacy words are in the fixed
list.

**This is the single most important finding of this review.** It is
exactly the scenario the user's own framing worried about (turning a WAIT
posture into false immediacy) and it is not a hypothetical — it is a
reproduced, current bypass. Per the review gate's own instruction ("If a
defect requires such a change: STOP and report it instead of expanding
scope"), **this is reported, not patched.** A narrow, low-risk fix exists
(add `"tomorrow"`, `"soon"`, `"this week"`, `"shortly"` to
`IMMEDIACY_SIGNALS`) but was not applied — that edit needs your
authorization, consistent with every other phase in this project.

**Also confirmed, precisely:** a numeric day-count check is genuinely
structural and reliable — `"This resolves in 500 days"` against a `{45,90}`
window is caught deterministically, with no ambiguity, and this part of the
protection is solid, not just claimed.

**Actual protection level, stated plainly:** the validator reliably catches
(a) any invented calendar date/day-name, and (b) any explicit day-count
number outside the settled window or when none exists. It does **not**
reliably catch qualitative immediacy language ("tomorrow," "soon," "this
week") outside the five fixed phrases in `IMMEDIACY_SIGNALS` — this is a
real, bounded gap, not "complete semantic coverage" as an uninformed reading
of the Phase 4 report's summary sentence might suggest.

---

## 5. Remedy — forensic review, including the Zuhal fix's soundness

Read `checkRemedyConsistency` and the widened `checkCelestialEntities` in
full, tracing exactly where each byte of the allow-list comes from.

- **Authoritative remedy source, confirmed:** `selectedIds` is built
  exclusively from `contract.remedy.steps.map(s => s.id)` — the frozen
  contract, never `text` (the narration being checked). `REMEDY_LIBRARY`
  is the static, imported deterministic library — not reachable or
  mutable from AI output in any way.
- **Alternative-remedy detection, confirmed structural:** the check
  iterates the FULL `REMEDY_LIBRARY`, and for every entry NOT in
  `selectedIds`, does an exact (lowercased) name match against the
  narration text. An exact match against real, deterministic library
  content is unambiguous evidence, not a heuristic guess.
- **Explanatory prose is allowed:** confirmed by test and by re-reading —
  nothing here flags prose that merely explains a selected remedy;
  `REMEDY_OVERRIDE_PHRASES` is a short, specific list ("instead of this
  remedy," "a better remedy would be," etc.), not a ban on discussing the
  remedy at all.

### The Zuhal false positive — traced to source, fix proven safe

**What happened:** `astro_saturn_discipline`'s deterministic name is "Zuhal
Observance of Discipline." It can be legitimately SELECTED by
`selectRemedyProtocol()` on `targetConditions` pattern-matching alone
(matching `OBSTRUCTION`/`NEEDS_PATIENCE`), **independent of whether Saturn
is this specific reading's `obstructingAgent`** — confirmed by re-reading
`remedySelection.ts`'s scoring function: `planetaryCorrespondences`
matching is one of several additive scoring factors, not a hard
requirement. A real reading with `obstructingAgent: 'Dhanab'` (Ketu) did
select this remedy, and its own deterministic `explanation`/`name` text
names "Zuhal," which — before the fix — the celestial-entity check
(correctly) flagged as unauthorized, since Zuhal/Saturn was not in that
reading's `celestialEntities`.

**The fix, re-verified this pass:** `checkCelestialEntities` widens its
allow-list, for this check only, by scanning `contract.remedy.steps[].name`
(NOT `contract.remedy.steps[].explanation` — that field is still never
exposed to narration at all, confirmed unchanged from Phase 3) for planet
aliases, and adding any found to the allowed set. **Traced precisely: the
source of this widening is `contract.remedy.steps`, itself sourced
exclusively from `selectRemedyProtocol()`'s deterministic output** — never
from `text` (the narration under test). The widening cannot be influenced
by AI output in any way; it is entirely a function of the deterministic
contract.

**Bounded, not open-ended, confirmed by inspecting the full library:**
only 3 of the ~30 entries in `REMEDY_LIBRARY` name a planet at all
(`astro_saturn_discipline` → Zuhal/Saturn, `astro_mars_restraint` →
Mirrikh/Mars, `astro_moon_settling` → Qamar/Moon), each naming exactly one
planet, and a single reading typically selects at most ~4 remedies total.
The worst case this widening could ever produce is 3 additional planets
(Saturn, Mars, Moon) beyond `celestialEntities`' own 3 fields — never "all
nine planets," and never anything not already deterministically settled by
`selectRemedyProtocol()`.

**Conclusion: the fix is sound.** It closes a real false positive without
opening a route for AI-introduced planetary claims.

---

## 6. Celestial entity review — aliasing, and a real transliteration gap found

Traced `PLANET_ALIASES` (built from `nomenclature.ts`'s `PLANET_NAME`/
`PLANET_NAME_SHORT`, not invented) and `expandAllowedEntityNames`/
`disallowedEntityNames`.

**Confirmed working, tested directly:**
- English internal id and classical Arabic name are correctly recognized as
  the same entity (e.g. `"Zuhrah"` narration text is accepted when `Venus`
  is in `celestialEntities`, and vice versa) — the exact false-positive
  class this table exists to prevent.
- A disallowed planet named by its canonical English OR canonical Arabic
  form is correctly caught in both cases (tested: `"Saturn"` and `"Zuhal"`
  both flagged when neither is allowed).

**A real gap found, not previously documented at this level of
specificity:** an **alternate spelling/transliteration** of a disallowed
planet's name is **not caught**. Tested: `"Zohal"` (a plausible alternate
romanization of "Zuhal") on a contract where Saturn/Zuhal is genuinely
disallowed — **not flagged.** The alias table contains exactly one spelling
per planet per naming register (English id, `PLANET_NAME`, `PLANET_NAME_SHORT`)
— no fuzzy matching, no alternate-transliteration table. In practice this is
lower-risk than it sounds, because the system prompt instructs Claude to use
these exact canonical spellings (not asked to freelance transliteration),
but it is a real, unaddressed structural gap in the deterministic check
itself, not merely a theoretical one — reported precisely rather than
folded into a vague "not 100% coverage" statement.

**Placing text: explanation/remedy sentence/timing prose** — the check
scans the WHOLE text of each of the five `NarrationFields` values, not a
sub-section, so a planet name is caught regardless of which part of a given
field it appears in (there is no per-sentence or per-clause scoping to
evade). Confirmed by re-reading: `checkCelestialEntities(contract, field,
text)` receives the full field string and runs one whole-string regex test
per disallowed name.

---

## 7. Diagnosis review

**Confirmed conclusively, not inferred:** `grep -n "diagnose("
narrationValidator.ts` returns exactly one hit — the string literal
`'diagnose('` inside `PROHIBITED_TERMINOLOGY` (the deny-list itself, for
leakage detection). The actual `diagnose()` function is never imported,
never called, anywhere in `narrationValidator.ts`. `checkDiagnosisConsistency`
compares only against `contract.diagnosis.obstructingAgent` (already-settled
engine output) — it recalculates nothing.

The check itself remains scoped exactly as documented: only an explicit
`"X obstructs/blocks this matter"`/`"stands in the way"` phrase naming a
specific planet is checked against `obstructingAgent`; other forms of
diagnosis disagreement are not caught by this specific check (though may
overlap with the verdict-polarity check, as with the timing example above).

---

## 8. Certainty review — tested against the user's exact word list

| Word/phrase (low-confidence, neutral-polarity contract) | Result |
|---|---|
| `"may"` | not flagged (correct — hedged language) |
| `"likely"` | not flagged (correct) |
| `"appears"` | not flagged (correct) |
| `"will"` (bare) | not flagged (correct) |
| `"definitely"` (bare) | not flagged |
| `"certainly"` (bare) | not flagged |
| `"guaranteed"` | **flagged** (`UNSUPPORTED_CERTAINTY`) |
| `"It will definitely resolve."` | **not flagged** |
| `"It will certainly resolve."` | **not flagged** |

**Confirmed: the check does not classify all strong language as unsafe** —
`"may"`/`"likely"`/`"appears"`/bare `"will"` correctly pass, exactly as the
brief required ("do not automatically classify all strong language as
unsafe"). **A real gap, newly demonstrated:** the phrase list
(`'guaranteed'`, `'without any doubt'`, `'certain to happen'`, `'there is no
question'`, `'absolutely will'`, `'definitely will'`) is sensitive to exact
word order — `"will definitely"` and `"will certainly"` (a natural word
order) are NOT in the list, only `"definitely will"`/`"absolutely will"`
are. This means reasonably strong, arguably-unsupported certainty language
in the more common English word order slips past this specific check
undetected (though again, may separately trip the verdict check if it also
asserts a specific opposing outcome — it does not always).

**Respects the engine's own scale, confirmed:** the gate condition
(`polarity === 'neutral' || confidence < 0.8`) uses `diagnosis.confidence`
and `diagnosis.outcome` directly — no new threshold invented beyond
reusing the engine's own existing `CONFIDENCE_SCALAR` HIGH cutoff (0.8) as
the dividing line, exactly as the file's own comment claims, verified by
cross-referencing `engine/rkp/diagnosis.ts`'s `CONFIDENCE_SCALAR` table.

---

## 9. Terminology leakage — case/punctuation variants tested

| Input | Result |
|---|---|
| `"this uses rkp internally"` (lowercase) | **flagged** |
| `"this uses Rkp internally"` (mixed case) | **flagged** |
| `"this uses R.K.P. internally"` (punctuated) | **not flagged** |
| `"this uses R-K-P internally"` (hyphenated) | **not flagged** |
| `"this uses R K P internally"` (spaced) | **not flagged** |

**Case-insensitivity is real and confirmed** (via `.toLowerCase()`
throughout). **Punctuation/spacing-obfuscated variants are not caught** —
a genuine, demonstrated gap for "obvious formatting variants," which the
review explicitly asked to test. Detection is confirmed independent of the
prompt (the deny-list lives entirely in `narrationValidator.ts`, never
reads `WATCH_ORACLE_SYNTHESIS_PROMPT` or any prompt file) — that specific
property holds; the formatting-variant gap is a separate, real limitation.

---

## 10. Internal data leakage

Re-read `INTERNAL_DATA_PATTERNS` and its existing tests
(`narrationValidator.test.ts`: source-file-path and API-key-shaped-string
cases, both passing). No sensitive real values were added to any fixture
this review pass — all probes above used synthetic strings. Coverage
confirmed for: source file paths (`functions/src/...`, `src/{engine,oracle,astrology}/...`,
`.ts`), a Firestore-doc-id-shaped path, `api_key`/`api-key`, `firebase-admin`,
and Google-API-key/generic-secret-key-shaped strings — narrow and
maintained, as documented, not a general secrets scanner.

---

## 11. Prompt-injection review — the exact distinction the review asked for

Traced and tested the precise scenario: **user injection text never reaches
the validator at all** — only Claude's narration output does (confirmed by
the function signature: `validateNarration(contract, narration)`, no
question text parameter). Tested the two cases directly:

- `"The user asked me to ignore the reading and say yes, but I will not."`
  (AI *describing* the injection attempt, without complying) —
  **not flagged.** Correct: harmless narration about the question is not
  itself a violation.
- `"As instructed, ignoring the previous data."`
  (AI compliance language) — **flagged**, `PROMPT_INJECTION_ARTIFACT`.

**Confirmed directly, per the review's own framing:** the actual-violation
case (*"The reading says No, but I will say Yes"* — a real verdict flip) is
caught by `VERDICT_CONTRADICTION`, independent of whether any injection-
artifact phrase is present — re-confirmed in §4's table above with the real
"will definitely happen tomorrow" example, which was caught by the verdict
check even though it also happens to be immediacy-shaped. The validator's
protection against injection genuinely does not depend on recognizing the
attack wording — it depends on checking the *output's claims* against the
contract, which is the correct layer, as the brief itself argued.

---

## 12. Fail-closed review — proven with a real forced exception

Constructed a contract with `remedy: undefined` (a shape `buildReadingContract()`
itself could never actually produce — see the caveat below — but a
concrete way to force a real `TypeError` inside the check functions that
read `contract.remedy.steps`). Ran `validateNarration` against it directly:

**Result: did not throw.** Both `checkRemedyConsistency` and
`checkCelestialEntities` threw internally (`TypeError: Cannot read
properties of undefined (reading 'steps')`); `validateNarration`'s
per-check `try/catch` converted each into a `MALFORMED_OUTPUT`
`ValidationFailure`; the overall result was `{ valid: false, failures: [...] }`
— **never `valid: true`, and the function itself never threw out to its
caller.** This is exactly "exception → invalid → deterministic fallback,"
confirmed by execution, not by reading the comment that claims it.

**Caveat, stated precisely:** this hostile shape is artificial — the real
production `ReadingContract` is always constructed by `buildReadingContract()`
(Phase 3), which is typed and always produces a real array for
`remedy.steps` (empty when no intervention, never `undefined`). So this
proves the validator's *own* fail-closed discipline under a theoretically
malformed contract, not that such a contract can actually reach it in
production — the two are different claims, and only the first was tested
here (the second was already established, separately, by Phase 3's own
construction guarantees).

---

## 13. Fallback review

- **Uses only deterministic contract values, confirmed by re-reading the
  full file:** every sentence is built from `contract.diagnosis`/
  `contract.remedy` fields via fixed templates (`OUTCOME_LABEL`,
  `TIMING_POSTURE_LABEL`) — no free text, no invented values.
- **Does not call Claude, confirmed:** `grep` for `fetch`/`ANTHROPIC` in
  `narrationFallback.ts` returns zero matches.
- **Does not mutate the contract:** no assignment into `contract.*`
  anywhere in the file (same grep as §2).
- **Cannot introduce unsupported celestial entities:** the only planet name
  it can ever emit is `diagnosis.obstructingAgent`, which — by
  construction (Phase 3, unchanged) — is always either `null` or exactly
  `verdict.obstruction`, itself always a member of `celestialEntities`.
  Verified by re-reading `readingContract.ts`'s `celestialEntities`
  construction (unchanged, still exactly `[targetRulerName, lagnaRuler,
  obstruction]` filtered).
- **Cannot select another remedy:** it only ever names
  `contract.remedy.steps[].name` — the reading's own already-selected
  remedies, verbatim, never a library lookup or new selection.
- **Deterministic, re-confirmed this pass:** 10 direct calls with the same
  contract produced exactly 1 distinct serialized output (re-run fresh this
  review, not reused from the Phase 4 test's own assertion).

### Item 2 (fallback bypass) — answered precisely

The fallback is **structurally trusted**, not re-validated at runtime — it
is never passed back through `validateNarration()` inside
`responseComposer.ts`'s production code path (only in the test suite's own
assertion that it happens to pass). This is a deliberate design choice, not
an oversight, and it is sound for the reason above (its only variable
inputs are already-frozen contract fields, and its templates are fixed
code) — but it does mean there is no *runtime* defense-in-depth if a future
edit to `narrationFallback.ts`'s templates accidentally introduced
forbidden content (e.g. an internal term in a template string) — that would
only be caught by the existing test assertion at test time, not by any
runtime check. Worth naming as a process-level (not a today-live) gap.

---

## 14. Validation before persistence

Fully covered in §1 — re-stated here per the requested report structure:
persistence (`readingRef.set(...)`) happens strictly after
`composeWatchOracleResponse()` resolves, and that function's return value
already reflects any validation/fallback substitution. The rejected draft
is never written to Firestore and never returned to the client — it exists
only transiently inside `composeWatchOracleResponse()`'s local `drafted`
variable and, if rejected, only its `code`/`field`/`detail` metadata (not
its text) reaches the log line. **Rejected draft and approved response are
correctly distinguished**: `logger.warn(...)` logs failure metadata only;
`narration` (the field actually persisted and returned) is always the
approved-or-fallback value, never the rejected draft's text.

---

## 15. "Valid but weird" cases — checked, not just malicious text

Re-ran the full existing suite (154 tests) plus this review's own probes,
specifically checking for false positives on ordinary valid content:

- Natural paraphrase, real remedy explanation prose ("This practice
  steadies the heart while the chart settles.") — valid (existing test).
- Punctuation variation, different sentence order — the "punctuation split"
  probe in §3 shows the verdict check does NOT over-trigger on split
  phrasing (it just also fails to catch the intended case — a false
  negative, not a false positive, in that direction).
- Arabic/English planet name variants — §6 confirms both forms of an
  ALLOWED planet are accepted without a false positive.
- Timing paraphrase ("Expect movement within the indicated period") — valid
  (§4).
- The full existing `questionInNarration.test.ts`/`discussionComposer.test.ts`
  suites (real, previously-existing narration fixtures, not written for
  this validator) — still 11/11 and 11/11 passing, unmodified.

**One real false-positive risk was found this pass** (§3's negation case)
— a correctly-hedged/negated sentence can be wrongly flagged. This is the
one item in this section that is a genuine finding, not a confirmation.

---

## 16. False-positive / false-negative summary

| Category | Protection mechanism | Known false positives | Known false negatives | Severity |
|---|---|---|---|---|
| Verdict | Fixed phrase list vs. outcome polarity | Negated/hedged sentences containing a listed phrase (§3) | Paraphrases not in the fixed lists (§3, demonstrated) | **Medium** — real bypass exists, but any polarity-asserting phrase catches it; genuinely opposite-meaning paraphrases in creative prose are the risk |
| Timing | Date/weekday pattern, immediacy-phrase list, day-count range check | None found | **Qualitative immediacy words outside the 5-item list ("tomorrow," "soon," "this week") — demonstrated, reproducible (§4)** | **High** — this is the category the user flagged as highest-risk, and a real, concrete bypass was found and confirmed |
| Remedy | Exact library-name match + override-phrase list | None found | A remedy described without naming it and without an override phrase | Medium — structural check is strong; phrase-based half is narrow by design |
| Celestial entities | Canonical-alias allow-list, contract-derived | None found | Alternate transliterations/misspellings of a disallowed planet (§6, demonstrated: "Zohal") | Medium — mitigated in practice by the prompt's own canonical-naming instruction, but the deterministic check itself has the gap |
| Diagnosis | Explicit "X obstructs this matter" phrase vs. obstructingAgent | None found | Any other phrasing of a diagnosis contradiction (documented scope) | Low-Medium — narrow by design, some overlap with verdict check |
| Certainty | Fixed phrase list vs. confidence/polarity | None found | Reordered strong-certainty phrases ("will definitely" vs. "definitely will") (§8, demonstrated) | Medium |
| Terminology | Deny-list, case-insensitive | None found | Punctuation/spacing-obfuscated variants (§9, demonstrated: "R.K.P.", "R-K-P") | Low-Medium — deliberate obfuscation by a model isn't a realistic threat model here, but a real gap |
| Internal data | Regex patterns for paths/keys | None found | Not exhaustively tested this pass beyond existing fixtures | Low |
| Prompt injection artifacts | Compliance-phrase list (secondary defense) | None found | Compliance phrased outside the fixed list | Low — this category is explicitly the SECONDARY defense; the primary defense (checking claims against the contract) does not share this gap |
| Malformed output | Structural shape check | None found | None found | Low — this check is exhaustive by construction (checks every required field's type/non-emptiness) |

**No false negative found in this table lets a validated narration reach
the user while OUTRIGHT stating the opposite of the settled verdict with
zero check catching it** — every concrete bypass found here is a gap in
one SPECIFIC check, and several (timing→verdict overlap especially) are
still caught by a different check in practice for the cases tested. But the
Timing row's finding is real and independent enough (a pure immediacy claim
with no accompanying verdict-polarity language) that it should not be
described as fully covered.

---

## 17. No unauthorized expansion — confirmed

`git status --short` at the end of this review: **empty.** No file was
modified. Every finding above is reported, not patched, per the review
gate's explicit instruction.

---

## 18. Regression

| Check | Result |
|---|---|
| `functions/` vitest | 13 files, 154 tests, all passing — unchanged |
| `functions/` typecheck | Clean |
| `functions/` lint | Clean |
| 111-case golden corpus | Byte-identical (re-generated and diffed this pass) |
| 24-case replay | 24/24 identical |
| App tests/typecheck/lint | Unaffected — zero app files touched, confirmed by `git status` |

---

## Final report (per the requested structure)

1. **Runtime validation order:** contract built → narration context built →
   Claude called → validator runs on the draft → fallback substitutes on
   failure → composition returned → Firestore write. Persistence
   unconditionally follows validation; no bypass path exists (§1, §14).
2. **Source of truth:** `ReadingContract` only — zero Firestore/network/AI
   input reachable from the validator (§2).
3. **Verdict protection:** strong against explicit opposite-polarity
   assertions in the fixed phrase lists; a real false positive on
   negation, and a real false negative on paraphrase, both demonstrated (§3).
4. **Timing protection:** strong against invented dates and out-of-range
   day counts; **a real, demonstrated gap against qualitative immediacy
   language ("tomorrow," "soon," "this week") not in the 5-item signal
   list** — the most significant finding of this review (§4).
5. **Remedy protection:** strong — structural, deterministic-source-only
   allow-list; the Zuhal fix is traced and proven sound, bounded to 3
   possible extra planets library-wide (§5).
6. **Celestial protection:** strong for canonical spellings in either
   naming register; **a real gap for alternate transliterations/misspellings**
   of a disallowed planet (§6).
7. **Diagnosis protection:** narrow by design, does not recompute
   `diagnose()` (confirmed by grep — zero calls), checks only explicit
   obstruction-naming phrasing (§7).
8. **Certainty protection:** correctly avoids over-flagging hedged language
   ("may"/"likely"/"appears"/bare "will"); **a real word-order gap**
   ("will definitely" vs. "definitely will") (§8).
9. **Terminology protection:** case-insensitive and prompt-independent;
   **a real gap for punctuation/spacing-obfuscated variants** (§9).
10. **Injection protection:** correctly distinguishes AI description of an
    injection attempt from AI compliance with one; does not depend on
    recognizing attack wording, since claim-consistency checks catch the
    effect regardless (§11).
11. **Fail-closed behavior:** proven by forcing a real exception — the
    orchestrator never throws and never returns `valid: true` on an
    internal error (§12).
12. **Fallback:** deterministic, contract-only, no network, cannot
    introduce unauthorized entities or remedies, structurally trusted
    rather than runtime-re-validated (a deliberate, sound choice, with one
    named process-level caveat) (§13).
13. **Persistence ordering:** confirmed strictly after validation; rejected
    text never logged verbatim, never persisted, never returned (§1, §14).
14. **False-positive/negative table:** §16.
15. **Tests run:** full `functions/` vitest (154 tests), plus 8 fresh,
    targeted probe scripts against the live code this pass (verdict
    negation/case/punctuation/paraphrase; timing's three user-specified
    examples plus a clean immediacy-only case; certainty's full word list;
    terminology's case/punctuation variants; injection's two-case
    distinction; a forced-exception fail-closed proof; fallback determinism
    over 10 runs) — every probe's exact input/output is quoted above, not
    summarized.
16. **Proven defects:** (a) a stale, inaccurate comment in `askWatchOracle.ts`
    describing a Firestore `validationLog` subcollection that is not
    written by the current implementation (§1); (b) the timing-immediacy
    gap (§4) — the most material finding; (c) the verdict-negation false
    positive (§3). None were fixed, per the review gate's instruction.
17. **Unresolved limitations, named precisely rather than left vague:**
    certainty word-order sensitivity (§8), terminology punctuation
    obfuscation (§9), celestial transliteration variants (§6), remedy
    description-without-naming (§5), diagnosis-contradiction phrasing
    narrowness (§7) — every one of these was already gestured at generally
    in the Phase 4 report's "Limitations" section; this review's
    contribution is turning each into a specific, reproduced example rather
    than a general disclaimer.

---

## My assessment, distinct from a directive

The user's own framing warned against the specific overclaim: *"The AI
cannot contradict the engine"* vs. *"The validator detects a defined set of
material contradictions ... and fails closed when those checks detect a
violation."* This review confirms the second, narrower claim is accurate
and the first, broader one is not — there is at least one clean,
reproducible way (a bare immediacy claim like "tomorrow" with no
accompanying certainty/verdict language) for a narration to alter the
practical meaning of a WAIT-posture reading without tripping any check.

This is not, in my assessment, a reason to consider Phase 4's architecture
unsound — the ordering, contract integrity, fail-closed behavior, fallback
safety, and injection-resistance properties all held up under direct
testing, not just inspection. It is a reason to treat "PHASE 4 REVIEW GATE:
PASS" as inaccurate to state unconditionally this pass, given a concrete
bypass was found in the exact category flagged as highest-risk going in.
I'd recommend either authorizing the narrow `IMMEDIACY_SIGNALS` addition
named in §4 as a small, targeted follow-up (not a redesign), or explicitly
accepting the gap as a documented, bounded risk before Phase 5 — your call,
not mine to make unilaterally.

---

## STOP

No code was changed. No Phase 5 work was started. Awaiting your decision on
the timing-immediacy gap and the other findings above before any further
implementation.
