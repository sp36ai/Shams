# Phase 4 — Historical Validator Analysis

**Status: reference material only.** This re-examines the deleted
`safetyValidator.ts` (recovered from git history, full text already quoted
in `docs/audit/SAFETY_VALIDATION_REDESIGN.md` from the Phase 2A pass) with
one new question this phase needs answered: what should the *new*
architecture keep, and what should it reject outright. Nothing here is
restored verbatim; nothing here is implemented — see
`PHASE_4_SAFETY_VALIDATION_IMPLEMENTATION.md` for what was actually built.

## Exact historical commits (unchanged from Phase 2A's finding, re-confirmed)

- **Introduced:** `3db4c65` (2026-08-07) — original version, four fields
  (`hidden_influence`, `spiritual_layer`, `timing`, `warning`), the old
  astronomical `askOracle` path.
- **Generalized for the watch path:** `08aac2b` (2026-08-23) —
  `runFieldValidation`/`runWatchNarrationSafetyValidator` added, four
  different fields (`rkp_finding`, `interpretation`, `recommended_approach`,
  `why_this_remedy`).
- **Deleted:** `18232d7` (2026-08-25), as apparent collateral of the KP
  engine removal — the file was never KP functionality, but was swept up
  in that cleanup.
- **Call site actually removed:** `e326807` (2026-09-06), during a merge
  conflict resolution.

## Previous architecture

```
narration fields (drafted by Opus)
        │
        ▼
runFieldValidation(fields, fieldNames, readingId, apiKey)
        │  for each field, in parallel:
        ▼
validateField() ──► second Anthropic call (Haiku)
        │             VALIDATOR_PROMPT: "review this text, flag violations
        │             in these 8 categories, return corrected text or approve"
        ▼
per-field {text, issues, modified}
        │
        ▼
aggregate → {status, issues, fieldsModified} → logged to Firestore
        │
        ▼
narration fields, with any modified text substituted, returned
```

## What it validated

Free-form prose, one field at a time, judged in isolation by a second LLM
call against eight named categories (medical/financial/legal claims,
dangerous instructions, certainty language, dependency risk, fear
amplification, authority overreach) — full text already quoted in
`SAFETY_VALIDATION_REDESIGN.md`.

## What it failed to validate (re-confirmed this phase, now with the
## contract available to check against — Phase 2A could only describe the
## gap; Phase 4 can name exactly what closes it)

- **No ground-truth check.** It never received `WatchVerdict`/`RkpDiagnosis`/
  `RemedyProtocol` — only the isolated text. It could not have detected a
  verdict contradiction, a timing fabrication, a remedy substitution, or an
  unauthorized celestial entity, because it was never given anything to
  check those claims against. This is the single biggest reason it cannot
  simply be restored: even working exactly as designed, it structurally
  could not do most of what Phase 4 requires.
- **Itself non-deterministic.** A second LLM call, with its own sampling
  variance — two runs over identical input text were not guaranteed to
  return the identical verdict. The brief for this phase is explicit:
  "Claude must never be allowed to validate itself" — the historical
  validator was Haiku validating Opus, which is the same failure mode
  (one model's output judged by another model's opinion, not by structural
  fact), only with a different model pair.
- **No terminology-leakage coverage.** Never checked for internal
  vocabulary (`KP`, `RKP`, `house matrix`, etc.) at all — a distinct
  concern from its eight content-safety categories, never in its scope.
- **No celestial-entity allow-list.** Had no concept of "which planets does
  this specific reading concern" — that concept (`celestialEntities`)
  didn't exist until Phase 3.
- **Fail-open on every failure mode**, including its own exceptions and
  timeouts — the opposite of what a safety boundary should default to
  under uncertainty, and the opposite of what this phase's brief requires
  ("A validator failure must never silently become a successful
  response").

## Why it is insufficient for the new contract, stated plainly

It was built for a world with no `ReadingContract` — an LLM checking
another LLM's prose against a fixed list of tone rules, with nothing
structural to check against and nothing to distinguish "sounds risky" from
"is actually false relative to this specific reading." Phase 3 changed what
is available to check against; the validator design has to change to match,
not be pasted back in unchanged.

## Ideas retained

- **The eight content-safety categories are still a real, useful taxonomy**
  (medical/financial/legal claims, dangerous instructions, certainty
  language, dependency risk, fear amplification, authority overreach) —
  reused as *documentation* of what "unsupported certainty" and
  "terminology/leakage" checks should watch for, not as an LLM prompt.
- **Fail-open vs. fail-closed as an explicit, named design choice**, not a
  silent default — the historical file at least stated its trade-off in a
  comment; the new validator states its own (fail-closed) just as
  explicitly, per §15 of this phase's brief.
- **Per-field granularity.** The historical validator checked each prose
  field separately and could report exactly which field triggered a
  finding. The new validator does the same — every `ValidationFailure`
  names the specific `NarrationFields` key it came from.

## Ideas rejected

- **A second LLM call of any kind**, for any purpose, including "did the
  first LLM lie" — rejected outright per this phase's absolute rule.
  Everything the new validator checks is checked structurally, against the
  `ReadingContract`, with plain string/pattern matching — never by asking a
  model to judge another model.
- **Validating prose in isolation, without the settled facts it describes.**
  The new validator's entire premise is the opposite: every check is a
  comparison between narration text and a specific `ReadingContract` field.
- **Fail-open as the default.** Rejected; the new validator fails closed
  (§15 of the implementation doc).
- **A single, monolithic `VALIDATOR_PROMPT`-style free-text ruleset.**
  Replaced with named, individually testable check functions, each
  producing a machine-readable failure code.
