# Phase 3 — Architectural Review Gate

**Status: review only. No code changed.** This inspects, in source, the six
items requested before Phase 3 is treated as architecturally closed:
`readingContract.ts`, `narrationContext.ts`, `PHASE_3_CLAIM_SURFACE.md`,
`RkpDiagnosis`'s real definition, `celestialEntities`'s real construction,
and the exact data flow from contract to Claude.

## The question

> Can every piece of information available to Claude be traced backward to
> deterministic engine authority without an interpretive layer being
> introduced by the contract itself?

**Answer: Yes, with one precise, bounded caveat below (not a violation —
a scope note for whoever designs Phase 4).**

---

## `celestialEntities` — re-derived from source, not from the design doc's own summary

`readingContract.ts`, the entire construction, quoted verbatim:

```ts
const celestialEntities = Array.from(
  new Set(
    [verdict.targetRulerName, verdict.lagnaRuler, verdict.obstruction].filter(
      (name): name is string => typeof name === 'string' && name.length > 0 && name !== 'None',
    ),
  ),
);
```

This is a `Set`-dedup-and-filter over **three field reads**, nothing else.
All three (`targetRulerName`, `lagnaRuler`, `obstruction`) are read directly
off the `verdict: DisplayWatchVerdict` parameter — a value that was fully
computed by `judgeWatchChart()` and boundary-name-mapped by
`toBoundaryPlanetName()` in `askWatchOracle.ts`, **before**
`buildReadingContract()` is ever called. There is no lookup table, no
scoring, no "which planets seem relevant" decision inside this function —
it cannot produce a name that wasn't already sitting on the verdict object.
This is the "canonical extraction" shape the review asked to confirm, not
the "new interpretation" shape it asked to rule out.

**One bounded caveat, found by tracing further than the construction site
itself:** `functions/src/oracle/remedyLibrary.ts`'s `astro_*` entries
(`astro_saturn_discipline`, `astro_mars_restraint`, `astro_node_clarification`,
`astro_moon_settling`, etc.) name specific planets — "Zuhal," "Mirrikh,"
"Qamar" — inside their `explanation` field (e.g. *"where Zuhal carries the
obstruction, the classical response is..."*). `explanation` is **not**
threaded into `NarrationContext.remedy.steps` (`narrationContext.ts`
deliberately keeps only `name`/`category`/`evidenceType`/`reason` — verified
by the exact-key-set test in `readingContract.test.ts`), so this does not
currently reach Claude, and is therefore not a live gap in the claim
surface today. It matters only as a fact for later: if `explanation` is
ever added to `NarrationContext` (e.g. a future richer prompt), whoever does
that will need to verify each `astro_*` entry's named planet is always the
`obstructingAgent` that caused its selection — traced one level further:
`remedySelection.ts`'s scoring only awards a `planetaryCorrespondences`
match when `remedy.planetaryCorrespondences.includes(diagnosis.obstructingAgent)`
exactly, which is a real, deterministic, pre-existing mechanism (untouched
by Phase 3) that makes the correspondence highly likely to hold — verified
for the mechanism itself, **not exhaustively re-verified against every one
of the ~15 `astro_*` entries' exact explanation text** in this review pass.
Flagged precisely so it isn't later mistaken for either "already proven" or
"undiscovered."

Also checked: `reason` text (which **is** threaded into `NarrationContext`)
— its only planet-naming line is `remedySelection.ts:183`:
`` `corresponds to the obstructing agent (${diagnosis.obstructingAgent})` ``.
`diagnosis.obstructingAgent` is the identical value already in
`celestialEntities` (both trace to `verdict.obstruction`). No other
`reasons.push(...)` line in that file names a planet. Confirmed clean.

---

## `RkpDiagnosis` — the three fields worth understanding before designing claim validation

Read `functions/src/engine/rkp/diagnosis.ts` in full (not re-read from the
Phase 3 docs' summary). This file is untouched by Phase 3 — it is exactly
the pre-existing engine the contract reuses verbatim, confirmed by `git
diff` showing zero changes to it across every phase since Phase 0.

- **`outcome` / `primaryPattern` / `secondaryPatterns`** — `primaryPattern`
  is looked up from `AGENT_PATTERNS[obstructingAgent]` (a fixed
  correspondence table, e.g. `Saturn → ['OBSTRUCTION', 'NEEDS_PATIENCE']`)
  when there's an obstruction, or derived from the state/outcome shape
  otherwise (e.g. `DELAYED` → `NEEDS_PATIENCE` if no obstruction, etc. —
  read the full `diagnose()` body, not just its signature). This **is** a
  real interpretive layer — but it is `diagnose()`'s own, pre-existing,
  deterministic interpretive layer, part of the engine the review is asking
  whether the contract *adds to*. It does not: `ReadingContractDiagnosis`
  is a type alias (`= RkpDiagnosis`), not a restatement — `buildReadingContract()`
  copies this object by reference, computes nothing about it.
- **`obstructingAgent`** — `hasObstruction ? verdict.obstruction : null`,
  read directly off the verdict. Not a second decision about which planet
  obstructs; it is the verdict's own `obstruction` field, renamed for
  diagnosis-layer readability.
- **A claim like "the obstruction comes from X" is directly checkable**
  against `diagnosis.obstructingAgent` (or, equivalently, `judgment.obstruction`
  — both are the same value, present twice under different names for
  historical reasons unrelated to Phase 3 — this repetition was not
  introduced by the contract, it already existed as two fields on two
  pre-existing engine types the contract reuses). A future validator can
  check this claim by direct string comparison — no inference needed.

## Data flow — traced end to end, this pass

```
askWatchOracle.ts
  buildWatchChart → judgeWatchChart → WatchVerdict
  toBoundaryPlanetName × 3            → DisplayWatchVerdict (verdict)
    ↓ (verdict passed to composeWatchOracleResponse, unmodified from here on)
responseComposer.ts
  diagnose(verdict)                   → RkpDiagnosis (diagnosis)      — engine, unmodified
  selectRemedyProtocol(diagnosis)     → RemedyProtocol (protocol)     — engine, unmodified
  buildReadingContract({verdict, diagnosis, protocol, readingId, computedAt, question})
    → ReadingContract                 — pure assembly, deepFreeze()   — readingContract.ts
  toNarrationContext(contract, {seekerName, motherName})
    → NarrationContext                — pure narrowing projection    — narrationContext.ts
  buildUserPrompt(narrationContext)   → prompt string                — unchanged text (proven, Phase 3 report §J)
  fetch(Anthropic API, prompt)        → Claude's raw response
```

Every arrow above was re-read from source in this pass, not assumed from
the Phase 3 report's own description of itself. No step between `verdict`
and `buildUserPrompt` performs a judgment, diagnosis, or remedy decision —
the two genuinely decision-making steps (`diagnose`, `selectRemedyProtocol`)
are the same pre-existing engine calls Phase 0 through 2B already
established as single-authority and untouched by this phase.

---

## Verdict

**Phase 3 is architecturally closed.** Every field reachable from
`NarrationContext` traces backward, without a new interpretive step
introduced by `readingContract.ts` or `narrationContext.ts` themselves, to
either a pre-existing deterministic engine decision (`diagnose()`,
`selectRemedyProtocol()`, `judgeWatchChart()`) or direct user input
(`question`, `seekerName`, `motherName`, both explicitly documented as such
in the contract's own types). The one caveat above is a scope note for a
field (`explanation`) that is **not currently exposed to narration** — it
does not weaken today's claim surface, only bounds tomorrow's if that field
is ever added to it.

Phase 4 may proceed to design the deterministic contract validator against
`ReadingContract`/`NarrationContext`/`PHASE_3_CLAIM_SURFACE.md` as they
stand.
