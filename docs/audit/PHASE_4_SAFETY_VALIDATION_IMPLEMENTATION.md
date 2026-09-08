# Phase 4 — Deterministic Oracle Safety Validator

**Repository:** sp36ai/Shams
**Scope:** a deterministic, structural validator that checks Claude's
narration against the `ReadingContract` (Phase 3) before it reaches the
client, with a deterministic fallback on failure. **No second LLM call
anywhere. No judgment/timing/remedy-selection/prompt change. No UI change.
The 4/18 remedy taxonomy question was not touched. The 111-case golden
corpus and 24-case replay are byte-identical before and after.**

---

## Architecture — exact validation location

```
askWatchOracle.ts
  ↓ (unchanged: buildWatchChart → classifyQuestion → judgeWatchChart → boundary-map)
responseComposer.ts — composeWatchOracleResponse()
  diagnose(verdict) → selectRemedyProtocol(diagnosis)        [unchanged — Phase 0-2B engine]
  buildReadingContract(...)                                   [Phase 3 — unchanged this phase]
  toNarrationContext(contract, ...)                            [Phase 3 — unchanged this phase]
  narrate(narrationContext) → Claude Opus 5 → NarrationFields | null
      │
      ▼ (drafted !== null — a synthesis failure is a DIFFERENT, pre-existing
      │  case, left exactly as-is; see "What this phase did not change")
  validateNarration(contract, drafted)          ← PHASE 4, new
      │
   ┌──┴───┐
   ▼      ▼
 valid  invalid
   │      │
   │      ▼
   │  logger.warn(...) + buildDeterministicFallbackNarration(contract)
   │      │
   └──┬───┘
      ▼
  narration (either the original, validated draft, or the fallback)
      ↓
  WatchOracleComposition → Firestore → client → TTS       [unchanged]
```

One server-side authority, at the narrowest point that has both the
contract and the model's raw output in scope — inside
`composeWatchOracleResponse()`, immediately after `narrate()` returns and
before the function's single return statement. Not duplicated in React
Native, TTS, Firestore, or any other Cloud Function — `askWatchOracle.ts`
calls `composeWatchOracleResponse()` exactly as it did before this phase and
receives an already-validated (or already-substituted) narration; it has no
validation logic of its own, and none was added to it.

**Files new this phase:**
- `functions/src/oracle/narrationValidator.ts` — the validator itself.
- `functions/src/oracle/narrationFallback.ts` — the deterministic fallback
  constructor.
- `functions/src/oracle/__tests__/narrationValidator.test.ts` (37 tests),
  `functions/src/oracle/__tests__/adversarialNarration.test.ts` (13 tests) +
  `functions/src/oracle/__tests__/fixtures/adversarial-narration/*.json`
  (10 fixtures).

**Files edited this phase:**
- `functions/src/oracle/responseComposer.ts` — `NarrationFields` exported
  (so the validator can type against it without redeclaring it); the
  validation call and fallback substitution wired in as shown above.

Nothing else changed.

---

## Historical comparison

Full record in `docs/audit/PHASE_4_HISTORICAL_VALIDATOR_ANALYSIS.md`.
Summary: the deleted `safetyValidator.ts` was a second LLM call (Haiku)
judging Opus's prose in isolation, against eight tone categories, with no
access to the settled verdict/diagnosis/remedy to check claims against, and
it failed open. None of that architecture survives into this phase. What
was kept: the eight-category taxonomy as *documentation* informing which
patterns the new checks watch for; per-field failure granularity; an
explicit (now opposite) fail-open/closed statement. What was rejected
outright: any second model call, isolated-prose-only checking, and
fail-open as a default.

---

## Validation categories implemented

All in `narrationValidator.ts`, each independently exported and unit-tested:

| # | Category | Function | Failure code(s) |
|---|---|---|---|
| A | Verdict consistency | `checkVerdictConsistency` | `VERDICT_CONTRADICTION` |
| B | Timing consistency | `checkTimingConsistency` | `TIMING_FABRICATION`, `TIMING_ALTERATION` |
| C | Remedy consistency | `checkRemedyConsistency` | `REMEDY_SUBSTITUTION`, `REMEDY_ADDITION` |
| D | Celestial entity validation | `checkCelestialEntities` | `UNAUTHORIZED_CELESTIAL_ENTITY` |
| E | Diagnosis consistency | `checkDiagnosisConsistency` | `DIAGNOSIS_CONTRADICTION` |
| F | Unsupported certainty | `checkUnsupportedCertainty` | `UNSUPPORTED_CERTAINTY` |
| G | Terminology leakage | `checkTerminologyLeakage` | `TERMINOLOGY_LEAKAGE` |
| H | Internal data leakage | `checkInternalDataLeakage` | `INTERNAL_DATA_LEAKAGE` |
| I | Prompt-injection artifacts | `checkPromptInjectionArtifacts` | `PROMPT_INJECTION_ARTIFACT` |
| — | Malformed output | `checkWellFormed` | `MALFORMED_OUTPUT` |

Each check is `(contract, field, text) => ValidationFailure | null` — a pure
function, no side effects, no network, called synchronously per field per
narration. `validateNarration()` orchestrates: `checkWellFormed` first
(short-circuits on a malformed shape), then every other check against every
non-null prose field, collecting **all** failures rather than stopping at
the first (so a single narration attempt's full failure surface is visible
in one log line, not discovered one validator run at a time).

### What each check deliberately does not attempt (stated, not hidden)

- **Verdict/timing/certainty checks are phrase-based, not full NLU.** They
  catch explicit, unambiguous assertions (e.g. "the matter is fulfilled,"
  a literal month name, "guaranteed") — not every possible paraphrase of a
  contradiction. This was a deliberate choice to avoid false-positiving on
  legitimate mystical-register prose, verified directly: every existing
  narration fixture in `questionInNarration.test.ts` and
  `discussionComposer.test.ts` still validates clean (§ Preserve current UX
  below).
- **Diagnosis consistency only checks explicit "X obstructs/blocks this
  matter" phrasing naming a specific planet** — not implicit or
  circumstantial disagreement with the diagnosis. A narrower, higher-
  precision check was chosen over a broader, noisier one for the same
  false-positive reason.
- **Remedy consistency's structural check (exact library-name matching) is
  the high-confidence half; its phrase-based half (`REMEDY_OVERRIDE_PHRASES`)
  is the same "narrow, not exhaustive" trade-off as the others.**
- **Terminology/internal-data leakage lists are maintained, not
  exhaustive.** Extending them deliberately, when a real leak is found, is
  the intended maintenance path — not widening them speculatively now.

None of this pretends to "understand every sentence" (per the brief's own
framing) — the job is to catch material violations of deterministic truth,
not to parse English.

---

## Failure codes — exact, machine-readable

`ValidationFailureCode` (a closed union, not a free-text string):
`VERDICT_CONTRADICTION`, `TIMING_FABRICATION`, `TIMING_ALTERATION`,
`REMEDY_SUBSTITUTION`, `REMEDY_ADDITION`, `UNAUTHORIZED_CELESTIAL_ENTITY`,
`DIAGNOSIS_CONTRADICTION`, `UNSUPPORTED_CERTAINTY`, `TERMINOLOGY_LEAKAGE`,
`INTERNAL_DATA_LEAKAGE`, `PROMPT_INJECTION_ARTIFACT`, `MALFORMED_OUTPUT`.
Every `ValidationFailure` also carries `field` (which of the five
`NarrationFields` keys triggered it) and `detail` (a human-readable string
for logs — never sent to the client; see "Audit logging" below).

---

## Fallback — exact deterministic behavior

`narrationFallback.ts`'s `buildDeterministicFallbackNarration(contract)`
builds a complete `NarrationFields` object from fixed templates filled in
with `contract.diagnosis`/`contract.remedy` values only — no invention, no
network call, no second synthesis attempt. Verified, not assumed: a test
(`narrationValidator.test.ts`) asserts the fallback's own output always
passes `validateNarration` itself, and that it is byte-identical across two
calls with the same contract (determinism). Deliberately plain rather than
an attempt at the mystical register — reproducing that voice
deterministically from a template risks reading as its own kind of
fabricated claim; honest and unadorned was judged the safer choice for a
safety fallback specifically, and is stated as a deliberate choice in the
file's own header, not an oversight.

The fallback preserves: the outcome (`OUTCOME_LABEL` per `RkpOutcome`),
the obstructing agent when present, the diagnosis rationale verbatim
(joined), the timing posture and window, and either the selected remedy
names (when intervention is required) or the engine's own `guidance` string
(when it is not) — exactly the fields the brief asked to be preserved, and
nothing else.

---

## Injection resistance — how it's actually achieved, and its tests

**The primary defense is not a dedicated injection detector** — it is that
every consistency check (verdict/timing/remedy/entity/diagnosis) compares
narration against `ReadingContract` regardless of *why* the narration said
what it said. An injected instruction that successfully changed the
verdict/timing/remedy/entity claims is caught by those checks on its
*effect*. `checkPromptInjectionArtifacts` is a narrow, secondary signal for
visible compliance language ("as instructed, ignoring the previous...").

Tested directly (`narrationValidator.test.ts`, `adversarialNarration.test.ts`):
a "prompt-injection" fixture whose narration echoes compliance language
**and** flips the verdict is checked and correctly flagged by both
`PROMPT_INJECTION_ARTIFACT` and `VERDICT_CONTRADICTION` (the fixture accepts
either, since both are independently correct); a dedicated test documents,
explicitly, that the seeker's question text never reaches the validator at
all — only the narration does — so a validator call with clean narration is
valid regardless of what an absent or hostile question said. (The question
text's own defense — `sanitizeQuestion()` collapsing control characters and
delimiter runs before it ever reaches the prompt — is Phase 0/2A's existing,
unchanged mechanism; this phase adds the second, independent layer of
checking the *output* regardless of what the *input* attempted.)

---

## Terminology protection — test cases

`narrationValidator.test.ts` parametrizes one test per prohibited term
(`RKP`, `KP`, `Krishnamurti`, `house matrix`, `watchJudgment`,
`ReadingContract`) plus a clean-response acceptance test.
`adversarialNarration.test.ts`'s `terminology-leakage` fixture covers the
same category end-to-end via the JSON-fixture harness. `checkInternalDataLeakage`
is tested separately for a source-file-path pattern and an API-key-shaped
string.

---

## Limitations — what cannot be safely determined from deterministic parsing

Stated plainly, per the brief's own instruction not to pretend otherwise:

- **Paraphrased contradictions the phrase lists don't cover.** A model that
  contradicts the verdict without using any of the specific phrases in
  `POSITIVE_ASSERTIONS`/`NEGATIVE_ASSERTIONS` (e.g. a subtler, longer
  sentence implying the opposite outcome) will not be caught. Widening
  those lists is the correct maintenance response to a real observed
  failure — not attempted speculatively here, per the brief's own
  "conservative detection, document the boundary" instruction.
- **A remedy explanation that describes a genuinely different practice
  without naming it or using an override phrase** would not be caught by
  the structural name-match or the phrase list. Only exact library-name
  matches and a small set of override phrases are checked.
- **Celestial entity checking is a substring/word-boundary match, not
  grammatical parsing** — it cannot distinguish "Mars governs this house"
  (a reading-specific claim) from an idiom that happens to contain a
  planet's name in an unrelated sense, if such an idiom existed in the
  narration voice. None currently does, checked against the existing
  fixtures in `questionInNarration.test.ts`/`discussionComposer.test.ts`.
- **`checkDiagnosisConsistency` only checks explicit "X obstructs/blocks
  this matter" phrasing** — a diagnosis contradiction expressed any other
  way is not caught by this specific check (though it may still be caught
  by the verdict-polarity check, which is broader).

None of these gaps are silently assumed closed anywhere in this
implementation or its docs — each is named here specifically so it is not
later rediscovered and mistaken for an oversight rather than a stated,
deliberate scope boundary.

---

## Performance

No network call, no external API, no database query, no second model
invocation — every check is synchronous, in-memory string/regex work over
five short prose fields (`NarrationFields`) plus a small, already-frozen
`ReadingContract`. The 141+ validator-related tests in this phase's suites
run in well under a second combined (measured: `narrationValidator.test.ts`
37 tests in ~220ms, `adversarialNarration.test.ts` 13 tests in ~12ms — see
the test matrix below for the full run). The added latency to a live
`askWatchOracle` call is the cost of this in-process work alone — no I/O is
added to the request path.

---

## Audit logging

On a validation failure, `responseComposer.ts` calls the existing
`logger.warn()` mechanism (the same pattern already used for narration HTTP
errors and oracle-composition failures elsewhere in this file — not a new
logging infrastructure) with: `readingId`, `engineVersion`,
`contractVersion`, `contractFingerprint`, the list of `{code, field, detail}`
failures, and `fallbackUsed: true`. Deliberately **not** logged: the
narration text itself (the rejected prose is not written to logs — only the
failure metadata about it), any user PII beyond the reading id already used
elsewhere in this file's own audit trail, payment/auth data (none of which
this file ever had access to — the contract's own least-privilege
construction, Phase 3, already excludes it), or the raw seeker question
(not part of this log line at all).

---

## Preserve current UX — verified, not assumed

The existing prompt-content test suite, `questionInNarration.test.ts`
(11 tests, inspects the literal prompt string) and `discussionComposer.test.ts`
(11 tests), were **not modified** for this phase and still pass — their
mocked narration fixtures (plain, short strings like `"f"`, `"i"`, `"r"`,
real sentences with no forbidden terms/dates/override phrases) pass
validation cleanly and flow through unmodified, exactly as before. This is
the direct evidence that valid narration is untouched by this phase, not an
assumption.

---

## Test matrix

| Check | Result |
|---|---|
| `narrationValidator.test.ts` (new) | **37/37 passing** — every category listed above, both accept and reject cases |
| `adversarialNarration.test.ts` (new) | **13/13 passing** — 10 fixture categories + 2 contract-precondition pins + 1 corpus-size check |
| Existing `functions/` suites (unmodified) | All still passing — `questionInNarration.test.ts` 11/11, `discussionComposer.test.ts` 11/11, `readingContract.test.ts` 15/15, `remedySelection.test.ts` 20/20, etc. |
| `functions/` vitest, full run | **13 files, 154 tests, all passing** (was 11 files/104 tests before this phase) |
| `functions/` typecheck | Clean |
| `functions/` lint | Clean |
| App jest/typecheck/lint | Unchanged — no app-side file was touched this phase (`git status` confirms) |
| 111-case golden corpus | **Byte-identical** to the Phase 3 baseline |
| 24-case in-process replay | **24/24 identical** |

No deterministic engine result changed. Every narration-validation failure
recorded during test runs is a **narration validation failure**, not an
**engine regression** — the two are structurally distinct in this
implementation: engine regressions would show up as a golden-corpus diff
(none occurred); narration-validation failures are adversarial-fixture test
assertions, expected and intended to fail validation by design.

---

## What this phase did not change (hard-stop items, confirmed by `git diff`)

- `functions/src/engine/rkp/{diagnosis,watchJudgment}.ts`,
  `functions/src/oracle/remedySelection.ts`,
  `functions/src/oracle/remedyLibrary.ts`: zero changes.
- `functions/src/prompts/watchOracleSynthesisPrompt.ts`: zero changes — the
  prompt Claude receives is untouched.
- Any `kp/rules/*` file, any UI file, `firestore.rules`: zero changes.
- The 4/18 remedy taxonomy question: not resolved, not touched.
- Remedy `explanation` field: still not exposed to `NarrationContext` (Phase
  3's least-privilege boundary, unchanged).
- No second AI call was introduced anywhere in this phase.
- No historical reading was modified — the fallback only ever applies to
  a reading being composed right now, never retroactively.
