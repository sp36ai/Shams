# Phase 3 — Immutable Reading Contract

**Repository:** sp36ai/Shams
**Scope:** create the formal, immutable boundary between the deterministic
Watch engine and the Oracle narration layer. **No judgment rule, timing
rule, or remedy-selection algorithm was changed. No safety validator was
implemented or restored. No prompt text changed — proven, not assumed, by
the existing `questionInNarration.test.ts` suite passing unmodified against
the actual prompt string it inspects. The 4/18 remedy taxonomy question was
not touched.**

**The code is the artifact to inspect, not this document** — per the
review instructions for this phase. The two files that matter:
`functions/src/oracle/readingContract.ts` (the contract + immutability +
serialization + fingerprint) and `functions/src/oracle/narrationContext.ts`
(the narration adapter). Both are new files; nothing existing was rewritten
to make room for them — `functions/src/oracle/responseComposer.ts` was
edited to call them, not restructured around them.

---

## A. Existing output

See `docs/audit/PHASE_3_CURRENT_OUTPUT_INVENTORY.md` for the complete
field-by-field trace. Headline finding: two fields the engine already
computed were not carried through any outward-facing shape before this
phase — `protocol.steps[].reason` (dropped from the public
`OracleProtocolStep`) and, more narrowly, `diagnosis.rationale` (used by
the prompt but absent from the client-facing `WatchOracleComposition`).
Neither is a "produced by more than one authority" case (the brief's STOP
condition) — both are single-authority values that simply weren't threaded
all the way through. The contract closes the gap that mattered for
narration (`reason`); see §C for why the others were deliberately left out
of the contract's scope.

---

## B. New contract — schema and ownership

`functions/src/oracle/readingContract.ts`:

```ts
export const READING_CONTRACT_VERSION = '1.0.0';

interface ReadingContractProvenance {
  contractVersion: string;
  engineVersion: string;
  rulesVersion: string;   // documented alias of engineVersion — see §H
  readingId: string;
  computedAt: string;     // ISO 8601 UTC
}

interface ReadingContractQuestion {
  raw: string | null;     // user input, not engine truth — see §C
  questionType: QuestionType;
}

type ReadingContractJudgment = DisplayWatchVerdict;   // reused verbatim
type ReadingContractDiagnosis = RkpDiagnosis;          // reused verbatim

interface ReadingContractRemedyStep {
  id: string; name: string; category: string; evidenceType: string;
  intensity: string; duration: string | null; explanation: string;
  instructions: readonly string[]; isEscalation: boolean;
  reason: string;   // the one field the public shape had been dropping
}

interface ReadingContractRemedy {
  interventionRequired: boolean;
  guidance: string | null;
  steps: readonly ReadingContractRemedyStep[];
  rationale: readonly string[];
}

type ReadingContractCelestialEntities = readonly string[];  // allow-list

interface ReadingContract {
  provenance: ReadingContractProvenance;
  question: ReadingContractQuestion;
  judgment: ReadingContractJudgment;
  diagnosis: ReadingContractDiagnosis;
  remedy: ReadingContractRemedy;
  celestialEntities: ReadingContractCelestialEntities;
}
```

**Ownership — one producer per field**, verified, not assumed (§ below is
the exact "producer → contract field → consumers" table the brief
requires):

| Contract field | Producer | Consumers |
|---|---|---|
| `provenance.contractVersion` | `READING_CONTRACT_VERSION` constant, this file | Future validator (Phase 4), audit/logging |
| `provenance.engineVersion` / `rulesVersion` | `ENGINE_VERSION` constant (`engine/primitives/chartBuilder.ts`) | Same |
| `provenance.readingId` | Caller (`askWatchOracle.ts`'s `readingRef.id`) | Firestore correlation |
| `provenance.computedAt` | Caller's `instant` (`askWatchOracle.ts`) | Audit/logging |
| `question.raw` | Caller (client-supplied question text) | `toNarrationContext` (sanitized at point of use) |
| `question.questionType` | `diagnosis.qType`, itself from `classifyQuestion()` | `toNarrationContext`, remedy escalation logic (unchanged, inside `selectRemedyProtocol`) |
| `judgment.*` | `judgeWatchChart()`, boundary-mapped in `askWatchOracle.ts` before this contract is built | `diagnose()` (already ran before the contract exists), `toNarrationContext` (not directly — via `diagnosis`) |
| `diagnosis.*` | `diagnose()` | `selectRemedyProtocol()` (already ran), `toNarrationContext` |
| `remedy.*` | `selectRemedyProtocol()` | `toNarrationContext` |
| `celestialEntities` | Derived (pure set-union, no new value) from `judgment.targetRulerName`/`lagnaRuler`/`obstruction` | Reserved for Phase 4 — not consumed by narration today (least-privilege; see §E) |

No field is populated by Claude, prompt text, client UI, TTS, or historical
cached prose — confirmed by construction: `buildReadingContract()` is a
synchronous, pure function called *before* `narrate()` runs, and nothing
downstream of it (§E, §D) can write back into it.

---

## C. Field provenance — design decisions worth stating explicitly

- **`question.raw`'s source of truth is the user, not the engine.** It is
  included in the contract for provenance completeness (it is the subject
  matter every other field was computed in service of), not because the
  engine decided it. This is called out explicitly in the type's own doc
  comment so a future reader doesn't mistake its presence for a claim that
  the engine authored it.
- **`interventionNeeded`, `supportingHouses`, `obstructingHouses` were
  deliberately left out of the contract.** They are real `RkpDiagnosis`
  fields, single-authority, but nothing downstream — not narration, not the
  client, not any test — reads them today. Per the brief's own
  "Do not invent new scoring semantics" and "prefer the smallest safe
  implementation," they were not added speculatively. Adding them later, if
  a real consumer needs them, is a pure extension (new field, `1.1.0`
  contract version), not a breaking one.
- **`celestialEntities` is derived, not sourced from a new engine
  computation.** It is a `Set`-deduplicated array of three fields the
  verdict already carries. It performs no naming translation of its own —
  every value passing through it was already boundary-name-mapped before
  `buildReadingContract()` ever sees it.

---

## D. Immutability — how it is enforced

**TypeScript `readonly` was judged insufficient on its own**, per the
brief's own instruction, and confirmed by writing a test that proves why:
`readingContract.test.ts`'s "a downstream mutation attempt does not alter
the authoritative value" test uses `// @ts-expect-error` to *deliberately*
bypass the type system (exactly what `as any`, a spread-then-mutate, or any
code outside this module's own type-checked call sites could also do) and
then asserts the runtime write still throws and the value is unchanged.

**Runtime enforcement: `deepFreeze()`**, a recursive `Object.freeze()` walk
over every plain object/array reachable from the contract, called once at
the end of `buildReadingContract()`. Cost: the contract is a few dozen
fields deep at most — not the multi-hundred-field `WatchChart` object,
which never enters this file at all (see §A's note) — so the recursive walk
is a small, constant-size operation per reading, not a scaling concern.
Verified directly: `readingContract.test.ts`'s immutability suite asserts
`Object.isFrozen()` at every level (`provenance`, `judgment`, `diagnosis`,
`remedy`, `remedy.steps`, an individual step, `celestialEntities`) and that
a write attempt throws a `TypeError` (strict-mode assignment to a frozen
object's property).

**The narration adapter cannot hand back a mutable reference to the
original.** `toNarrationContext()` builds a *new* plain object from the
contract's values — it does not return the contract or any nested piece of
it by reference. `readingContract.test.ts`'s "cannot alter the original
contract through the returned context" test proves this directly: mutating
the returned `NarrationContext`'s `diagnosis.outcome` (a fresh, unfrozen
object — freezing the *narration context* was judged unnecessary, since it
was never the authoritative object to begin with; only what could be
mistaken for engine truth needs freezing) does not change
`contract.diagnosis.outcome`.

---

## E. Narration boundary — exactly what Claude's prompt is built from

`functions/src/oracle/narrationContext.ts`'s `NarrationContext`:

```ts
interface NarrationContext {
  seekerName: string | null;
  motherName: string | null;
  question: string | null;   // sanitized at point of use, not here
  diagnosis: {
    outcome, primaryPattern, secondaryPatterns, timingPosture, timing,
    confidence, obstructingAgent, targetHouse, questionType, rationale
  };
  remedy: {
    interventionRequired, guidance,
    steps: readonly { name, category, evidenceType, reason }[]
  };
}
```

This is **strictly narrower** than `ReadingContract` — least privilege,
verified by `readingContract.test.ts`'s "exposes no provenance, database,
or internal-service fields" and "carries exactly the diagnosis/remedy
fields buildUserPrompt uses, no more" tests (the latter asserts the exact
key set, not just "some subset"). Excluded, and why:

- **`provenance`** (readingId, timestamps, version strings) — narration has
  no legitimate reason to know or mention any of these.
- **`celestialEntities`** (the full allow-list) — narration is fed the
  entities already embedded in `diagnosis`/`remedy`; the allow-list itself
  is a *validator* concern (Phase 4), not a narration input.
- **Remedy step `id`/`duration`/`instructions`/`explanation`/
  `isEscalation`** — the synthesis prompt's remedy lines use only
  `name`/`category`/`evidenceType`/`reason` (see `buildUserPrompt` in
  `responseComposer.ts`, unchanged text); nothing else was ever read by the
  prompt, so nothing else is threaded through.

No database handle, callable function, mutable engine object, or unrelated
user data (auth, payment, security metadata) was ever reachable from
`ReadingContract` in the first place — the boundary was already enforced
one layer up, at what `buildReadingContract()`'s own input type
(`BuildReadingContractInput`) accepts. `narrationContext.ts` cannot leak
what it was never given.

---

## F. Claim surface

See `docs/audit/PHASE_3_CLAIM_SURFACE.md` for the full Allowed / Derived
Presentation / Forbidden breakdown. Not implemented as a check this phase —
definition only, for Phase 4 to build against.

---

## G. Serialization

`canonicalStringify()` — recursive key-sorting before `JSON.stringify`, so
the same logical contract always serializes identically regardless of
property insertion order (verified: `readingContract.test.ts`'s "is stable
regardless of source object key order" test). Array order is preserved
(order is meaningful — remedy steps, rationale lines are ordered lists, not
sets). No functions, class instances, or circular references exist in this
contract's shape by construction, so none of the exclusions the brief warns
about (§9) needed special-casing — documented as a fact about this shape,
not a general-purpose serializer's guarantee.

`computedAt` is stored as an ISO 8601 UTC string, not a `Date` object,
specifically so `deepFreeze`/`canonicalStringify` never have to reason
about `Date`'s mutability or its non-plain-object shape.

---

## H. Versioning

- **`contractVersion`** (`READING_CONTRACT_VERSION = '1.0.0'`) — versions
  this file's own schema shape. Bump when a field is added, renamed, or
  removed.
- **`engineVersion`** — pre-existing `ENGINE_VERSION` constant
  (`'2.0.0-moshier'`), unchanged, now also carried on the contract (it was
  already on `ReadingDoc` and `AuditLogDoc` since Phase 2B).
- **`rulesVersion`** — **a documented alias of `engineVersion`, not an
  invented independent number.** No separate "rules version" concept exists
  anywhere in this codebase today — the house matrix, remedy library, and
  judgment weights version together with the engine build. Per the brief's
  explicit "Do not invent new scoring semantics," this field exists in the
  schema (so a future split doesn't require a schema migration) but is
  documented, in the type itself, as meaning exactly `engineVersion` today.

---

## I. Persistence — compatibility strategy

**No database migration.** The contract is not itself written to Firestore
as a standalone document. What was added, additively:

- `WatchOracleComposition.contractFingerprint: string` — a new, non-optional
  field on the existing composition object `askWatchOracle.ts` already
  writes wholesale into `ReadingDoc.watchOracle` and returns wholesale to
  the client as `response.oracle`. No existing consumer of
  `WatchOracleComposition` reads or requires this field (confirmed:
  `discussionComposer.test.ts`'s hand-built fixture needed exactly one line
  added to keep typechecking — see the test-matrix section below for the
  exact diff), and it changes no other field's value or the client's own
  hand-mirrored `WatchOracleComposition` type (`src/types/watchOracle.ts`),
  which was not touched and does not need to declare this field to keep
  typechecking (structural typing — extra fields on the wire are inert to
  a client type that doesn't ask for them).
- **Why not persist the full contract object.** Doing so cleanly would mean
  either widening the client-facing response shape further (more invasive
  than warranted this phase, and not something Phase 4 has asked for yet)
  or computing a second, redundant serialization path outside
  `readingContract.ts`. The fingerprint alone gives Firestore/audit
  provenance ("did this reading's stored judgment match what the contract
  fingerprint says it should be") without that cost. Full-contract
  persistence remains an option for a future phase if Phase 4's validator
  design turns out to need the whole object at rest, not just its
  fingerprint — deliberately deferred, not foreclosed.
- **No historical reading was rewritten.** Readings persisted before this
  phase simply lack `watchOracle.contractFingerprint` — an absent field, not
  a broken one; nothing reads it as required.

---

## J. Tests

`functions/src/oracle/__tests__/readingContract.test.ts` (new, 15 tests) —
built against the **real** deterministic engine (`buildWatchChart` →
`judgeWatchChart` → `diagnose` → `selectRemedyProtocol`), not hand-fabricated
fixtures, per the brief's own preference for exercising real engine output:

| Requirement (per the brief's §13) | Test(s) | Result |
|---|---|---|
| Construction: same input → same contract | "same deterministic engine input produces the same contract content" | PASS |
| Construction: different input → different contract | "a different question produces a different contract" | PASS |
| Immutability: frozen at every level | "is frozen at every level reachable from the contract" | PASS |
| Immutability: mutation attempt fails, value unchanged | "a downstream mutation attempt does not alter the authoritative value" | PASS |
| Serialization: stable regardless of key order | "is stable regardless of source object key order" | PASS |
| Fingerprint: same content → same fingerprint | "same deterministic contract content produces the same fingerprint" | PASS |
| Fingerprint: excludes readingId/computedAt | "fingerprint is insensitive to provenance.readingId/computedAt" | PASS |
| Fingerprint: sensitive to real content changes | "a different question type changes the fingerprint" | PASS |
| Versioning: explicit | "carries explicit contract/engine/rules versions" | PASS |
| Source isolation: narration adapter cannot mutate engine truth | "cannot alter the original contract through the returned context" | PASS |
| Forbidden data: no provenance/db/service fields in NarrationContext | "exposes no provenance, database, or internal-service fields" | PASS |
| Least privilege: exact field set, not just "a subset" | "carries exactly the diagnosis/remedy fields buildUserPrompt uses, no more" | PASS |

**Existing-suite regression proof** (not new tests — the point is that
these were *not modified* and still pass): `questionInNarration.test.ts`
(11/11) inspects the literal prompt string sent to the (mocked) Anthropic
API; its assertions are unchanged and all pass, which is the direct proof
that `buildUserPrompt`'s refactor to read from `NarrationContext` produced
byte-identical prompt text. `discussionComposer.test.ts` needed exactly one
line added to its hand-built `WatchOracleComposition` fixture
(`contractFingerprint: 'test-fixture-fingerprint'`) to keep typechecking —
not a behavior change, a fixture completeness fix forced by the new
required field.

### Full test matrix

| Check | Result |
|---|---|
| `functions/` vitest | **11 files, 104 tests, all passing** (was 10/89 before this phase — +1 new file, +15 new tests) |
| `functions/` typecheck | Clean |
| `functions/` lint | Clean |
| App jest | **27 suites, 304 tests, all passing — unchanged** |
| App typecheck | Clean |
| App lint | Clean |
| 111-case golden corpus | **Byte-identical** to the Phase 2B-F baseline (expected: no engine file was touched; the generator doesn't call `responseComposer.ts` at all) |
| 24-case in-process replay | **24/24 identical** |

No deterministic result changed. No STOP condition was triggered.

---

## K. Deferred work

Explicitly, per the brief's hard stop:

- **The safety validator was NOT implemented.** `ReadingContract`/
  `NarrationContext`/the claim surface exist so Phase 4 has something
  concrete to validate against — nothing validates against them yet.
- **The Claude prompt was NOT redesigned.** `WATCH_ORACLE_SYNTHESIS_PROMPT`
  is untouched; `buildUserPrompt`'s output text is unchanged (proven, §J).
- **The 4/18 remedy taxonomy question was NOT resolved.** Untouched,
  unchanged from Phase 2B's own reasoning.
- **Judgment, timing, and remedy-selection algorithms were NOT changed.**
  `diagnose()`, `judgeWatchChart()`, and `selectRemedyProtocol()` were not
  edited — confirmed by `git diff` showing zero changes to
  `functions/src/engine/rkp/{diagnosis,watchJudgment}.ts` or
  `functions/src/oracle/remedySelection.ts`.
- **UI was NOT redesigned.** The one UI-adjacent change is a type
  (`WatchOracleComposition` gained one field); no component's rendering
  logic was touched.
- **Full-contract Firestore persistence** (as opposed to the fingerprint
  alone) remains an open option for a future phase — see §I.
- **`interventionNeeded`/`supportingHouses`/`obstructingHouses`** remain
  outside the contract's scope until a real consumer needs them — see §C.
