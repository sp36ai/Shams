# Phase 3 — Claim Surface

**Status:** definition only. No validator is implemented against this
document — see `PHASE_3_IMMUTABLE_READING_CONTRACT.md` §K for what remains
deferred. This exists so Phase 4 can be built against a written boundary
instead of inferred from prose or invented at implementation time.

The categories below classify what a narration turn (today: the four
`NarrationFields` — `rkp_finding`, `interpretation`, `recommended_approach`,
`why_this_remedy`) may say, relative to the `ReadingContract` that was
settled before narration ran.

---

## Allowed claims

Directly supported by a `ReadingContract` field, stated in a way a reader
could trace back to that field without inference:

- The diagnosis outcome and its plain-language meaning
  (`contract.diagnosis.outcome`, `.primaryPattern`, `.secondaryPatterns`).
- The timing posture and window (`contract.diagnosis.timingPosture`,
  `.timing`) — stated as the structured range the engine produced (e.g.
  "30 to 60 days" from `{minDays:30, maxDays:60}`), never a specific
  calendar date, since the engine never produces one.
- The obstructing agent, by its canonical name only
  (`contract.diagnosis.obstructingAgent`, which is already boundary-name-
  mapped before the contract is built).
- Which house governs the matter (`contract.diagnosis.targetHouse`).
- The selected remedies, by name/category/evidence type, and the reason
  each was selected (`contract.remedy.steps[].{name,category,evidenceType,
  reason}`) — explained, never renamed or substituted.
- The question type/domain the reading was cast for
  (`contract.question.questionType`).
- Any celestial entity named in `contract.celestialEntities` — and no
  other. This is the array's entire purpose: it is the allow-list a future
  validator (or, informally, the system prompt today) checks planet/entity
  mentions against.

## Derived presentation

Safe transformations of an allowed claim — the *meaning* is unchanged, only
the *surface form* is:

- Converting `{minDays, maxDays}` into prose ("around 30 days", "30 to 60
  days") — exactly what `formatTiming()` in `responseComposer.ts` already
  does, structurally unchanged by this phase.
- Rendering a planet's classical/display name instead of its internal
  identifier — already fully handled before the contract is built
  (`toBoundaryPlanetName`, `nomenclature.ts`'s `PLANET_NAME`/
  `PLANET_NAME_SHORT`); the contract only ever carries the already-safe
  name, never the internal one, so there is no "raw" form for narration to
  accidentally use instead.
- Explaining *why* a deterministic diagnosis or remedy selection makes
  sense in the seeker's own terms, without changing what was decided —
  the entire purpose of `rkp_finding`/`interpretation`/
  `recommended_approach`/`why_this_remedy`.
- Softening or varying phrasing/register across readings (the "mystical
  manuscript voice") — a presentation choice, not a claim.

## Forbidden claims

Things no `ReadingContract` field establishes:

- **New planetary facts** — a planet's position, dignity, aspect, or
  relationship not present in `contract.judgment`/`contract.diagnosis`
  (e.g. narration describing a conjunction or retrograde the verdict never
  reported).
- **New timing events** — a specific date, day-of-week, or named future
  event. The contract only ever carries a day-count range or `null`; any
  narration text implying a calendar date is unsupported by construction.
- **New remedies** — any practice, name, or instruction not present in
  `contract.remedy.steps`. Structurally prevented today by
  `responseComposer.ts` copying remedy names/instructions verbatim after
  the model returns (unchanged by this phase) — this claim category exists
  in the document for completeness and for Phase 4's validator to check
  independently, not because it is currently unguarded.
- **New verdicts** — narration stating an outcome that contradicts
  `contract.diagnosis.outcome` (e.g. describing a `BLOCKED`/`UNFAVOURABLE`
  reading in confidently favourable terms). Not currently checked by any
  automated mechanism — see `SAFETY_VALIDATION_REDESIGN.md`'s "ground-truth
  cross-check" proposal from Phase 2A, still undone.
- **Unsupported certainty** — "will happen," "guaranteed," absolute
  language the engine's own `confidence`/`timingPosture` don't support.
  Currently addressed only by system-prompt instruction (see Phase 0
  addendum's finding that the independent post-generation check for this
  category is absent).
- **Invented causes** — attributing the diagnosis to a reason the
  `rationale` array doesn't contain.
- **Invented celestial placements** — any entity name not in
  `contract.celestialEntities`.
- **Internal terminology leakage** — `KP`, `RKP`, `house matrix`, or other
  implementation vocabulary reaching the seeker (see
  `SAFETY_VALIDATION_REDESIGN.md`'s deterministic terminology-leakage gate
  proposal — still undone).

---

## What this document does not do

It does not implement a check for any category above. It exists so Phase 4
has a written target: "does this narration text, checked against this
reading's `ReadingContract`, stay inside Allowed + Derived Presentation, and
avoid every Forbidden category?" is now a question with a concrete object to
check against, rather than a question a validator would otherwise have to
infer from a mixture of engine objects, prose, and prompt assumptions — the
exact failure mode Phase 3 was commissioned to prevent.
