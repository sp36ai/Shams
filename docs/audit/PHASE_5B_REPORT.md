# Phase 5B — Engine Boundary & Decision Integrity Verification

**Date:** 2026-09-08
**Status of Phase 5A going in:** CLOSED — PASS WITH DOCUMENTED FINDINGS (no
P0/P1).
**Nature of this phase:** reconnaissance/adversarial only, narrower than
5A. No production logic, judgment, diagnosis, timing, remedy, contract,
validator, prompt, UI, Firestore rule, auth, or payment code was modified.
One dry-run of `sync-engine.mjs` was performed to characterize a finding
and then fully reverted (`git checkout --`) — net production change: 0,
confirmed by `git status --porcelain` at the end of this phase.

**Primary question answered:** *Is the Watch engine truly the single
source of truth all the way into the persisted ReadingContract, or merely
the preferred source of truth?*

**Answer: truly the single source of truth for every judgment-bearing
field**, with one important qualification recorded as a P2 finding about
the fidelity of the checked-in generated mirror used for local
verification (not production).

---

## A. Engine authority graph

Traced from `askWatchOracle.ts`, by import/call site, not by filename:

```
functions/src/functions/askWatchOracle.ts (onCall, the sole production entry point)
  │
  ├─ classifyQuestion(input.question)                     [engine/kp/rules/questionKeywords.ts]
  │    input:  string
  │    output: QuestionType (14-value enum)
  │    mutates: nothing (pure)
  │
  ├─ buildWatchChart(localMoment)                          [engine/rkp/watchChart.ts]
  │    input:  ISO-8601 local-time string (server instant + validated offset)
  │    output: WatchChart (planets, houses, window)
  │    mutates: nothing (pure)
  │
  ├─ judgeWatchChart(chart, qType)                         [engine/rkp/watchJudgment.ts]
  │    input:  (WatchChart, QuestionType)   — reads HOUSE_MATRIX[qType] internally
  │    output: WatchVerdict
  │    mutates: nothing (pure)
  │
  ├─ (askWatchOracle.ts) publicVerdict = { ...verdict, obstruction/targetRuler/
  │    lagnaRuler renamed via toBoundaryPlanetName() }      [utils/planetBoundaryName.ts]
  │    — a field-renaming SPREAD, never a value change to any decision field
  │
  └─ composeWatchOracleResponse({ verdict: publicVerdict, question, ... })  [oracle/responseComposer.ts]
       │
       ├─ diagnose(verdict)                                 [engine/rkp/diagnosis.ts]
       │    input:  DisplayWatchVerdict
       │    output: RkpDiagnosis
       │    mutates: nothing (pure)
       │
       ├─ selectRemedyProtocol(diagnosis, opts?)             [oracle/remedySelection.ts]
       │    input:  (RkpDiagnosis, { traditions? })
       │    output: RemedyProtocol
       │    mutates: nothing (pure)
       │
       ├─ buildReadingContract({ readingId, computedAt, question,
       │      verdict, diagnosis, protocol })                [oracle/readingContract.ts]
       │    output: ReadingContract, deep-frozen before return
       │
       ├─ toNarrationContext(contract, { seekerName, motherName })  [oracle/narrationContext.ts]
       │    — a narrowed READ-ONLY VIEW for the prompt builder; not written back
       │
       ├─ narrate(narrationContext)                          [oracle/responseComposer.ts, calls Claude]
       │    output: NarrationFields | null — five prose strings only
       │
       └─ validateNarration(contract, drafted)               [oracle/narrationValidator.ts]
            — deterministic check against `contract`; on failure,
              buildDeterministicFallbackNarration(contract) replaces narration
              (never any other field)
  │
  ├─ readingRef.set(readingDoc)      — Firestore persistence (readingDoc.verdict
  │    is STATE_TO_VERDICT[verdict.state], readingDoc.watchOracle is the
  │    composition above — both trace to the same `verdict`/`diagnosis`/`protocol`)
  │
  └─ auditLogs.add(audit)            — questionHash, verdict, engineVersion, resultHash
```

Every function above was confirmed to have exactly the signature shown by
direct source read, not assumed. `mutates: nothing` was confirmed by
reading each function body for assignment expressions to its parameters
— none exist; all are pure transformations that construct new values.

---

## B. Single-authority matrix

See `docs/audit/PHASE_5B_AUTHORITY_MATRIX.md` — every responsibility
(question resolution, chart, house mapping, judgment, timing, diagnosis,
remedy, contract, fingerprint, engine version, generated-mirror
integrity, Firestore/discussion, client, AI) is tabulated with producer,
consumer, alternate-authority search result, and reachability. Summary:
**one live producer per responsibility, with zero alternate production
authority found**, except the generated-mirror integrity row (P2, §C
below).

---

## C. Alternate implementations

Searched repository-wide (both `src/` and `functions/src/`, not filename
pattern-matching but actual `export function`/`export const` declarations
and their callers):

- `judgeWatchChart` / any `judge*` function: **exactly 2 definitions**,
  the expected canonical-source (`src/astrology/rkp/watchJudgment.ts`) +
  synced-mirror (`functions/src/engine/rkp/watchJudgment.ts`) pair. No
  third implementation, no legacy alternate.
- `diagnose()`: **exactly 2 definitions**, same source/mirror pair.
- `selectRemedyProtocol`: **exactly 1 definition** — no app-side mirror
  exists (correct: this is oracle-composition logic, not a shared
  astrology primitive, so it was never meant to be synced). Re-verified
  independently of the Phase 2B report, from current HEAD, not taken on
  faith from that document.
- `buildWatchChart`: **exactly 2 definitions**, source/mirror pair.
- `judgeHorary` (the retired KP horary engine): **the file does not exist
  anywhere on disk.** Every remaining reference to `judgeHorary.ts` in the
  repository is a stale comment pointing at a deleted module (in
  `verdict.ts`, `houseMatrix.ts`, `questionKeywords.ts`,
  `planetBoundaryName.ts`, `types.ts`) — a documentation-accuracy note
  (P3), not a live legacy-authority-escape risk.
- **The one genuine finding**: the checked-in
  `functions/src/engine/rkp/watchJudgment.ts` — supposedly a mechanical,
  byte-faithful mirror of `src/astrology/rkp/watchJudgment.ts` — has
  silently diverged from its source. See Finding P5B-1 below for the full
  reproduction. This is not a second, competing implementation someone
  wrote deliberately; it is the SAME implementation having fallen out of
  sync with itself across the generated-mirror boundary.
- Dev-only duplicate producers: `functions/scripts/generate-golden-corpus.ts`
  and `functions/scripts/replay-check.ts` both independently call
  `judgeWatchChart`/`diagnose`/`selectRemedyProtocol`/`buildReadingContract`
  — this is expected and correct (they are the project's own regression
  tooling, calling the canonical functions the same way production does,
  not an alternate engine). Neither script is exported, deployed, or
  callable by a user request — confirmed by `functions/src/index.ts`'s
  export list (§ traced fully in Phase 5A, re-confirmed unchanged this
  phase).

---

## D. Verdict authority

`DisplayWatchVerdict` is constructed in exactly two production-relevant
places, both confirmed as *derivations*, not *alternate computations*:
1. `judgeWatchChart()` returns the base `WatchVerdict`.
2. `askWatchOracle.ts` spreads it into `publicVerdict` purely to rename
   three fields (`obstruction`/`targetRuler`/`lagnaRuler`) through
   `toBoundaryPlanetName()` — every other field, including `state`
   (the actual yes/no/wait decision) and `confidence`, passes through
   unchanged.

No `.verdict = ` assignment (mutation) exists anywhere in the
non-test source of the repository (grepped: zero hits). No client-shaped,
Firestore-shaped, or Claude-shaped object is ever assigned into a verdict
field — confirmed by the §5 mutation-attack tests below and by the
contract-provenance trace in Phase 5A §I (re-verified current this phase:
`AskWatchOracleSchema` remains `.strict()` with no verdict-shaped field).

---

## E. Timing authority

Timing (`diagnosis.timing`, `diagnosis.timingPosture`) is computed
entirely inside `diagnose()`, from `verdict` fields only. `diagnose()`'s
signature — `diagnose(verdict: DisplayWatchVerdict): RkpDiagnosis` — has
no second parameter, so question text (where a user might write
"tomorrow" or a contradictory timeframe) is structurally unable to reach
this computation. This was proven directly in Phase 5A §G and
re-confirmed by this phase's authority trace (§A above) — the pipeline
never passes `question` into `diagnose()`, only into the later
`buildReadingContract()` call as opaque display data and into the Claude
prompt as sanitized subject matter. No narration, client state, or
persisted value is ever read back into `diagnosis.timing` — confirmed by
grep: zero assignments to `.timing` or `.timingPosture` outside
`diagnosis.ts` itself.

---

## F. Diagnosis authority

`diagnose(verdict)` is the sole producer. `obstructingAgent`,
`primaryPattern`, `secondaryPatterns`, and every other diagnosis field are
all set inside this one function, from `verdict` alone. The Phase 4/4A
`narrationValidator.ts` reads these fields (`checkDiagnosisConsistency`,
`checkUnsupportedCertainty`, etc.) to check narration TEXT against them —
grepped `narrationValidator.ts` for any call to `diagnose(`: zero hits.
The validator is a comparator, never a second diagnosis engine, confirmed
by absence of the one call that would make it one. Neither the client nor
Claude constructs a diagnosis-shaped object anywhere in the traced source
(§L below).

---

## G. Remedy authority — fresh independent verification

Not taken from Phase 2B's own report. From current HEAD:
`grep -rn "export function selectRemedyProtocol"` returns exactly one
result, in `functions/src/oracle/remedySelection.ts`. No app-side mirror
of this file exists (`find src/astrology -iname "remedySelection*"` — no
match), which is itself confirmation that remedy selection was never part
of the shared-primitive sync boundary — it is oracle-composition logic,
server-only, by design. `composeWatchOracleResponse` is the only caller.
Both the client-facing composition (`base.protocol`) and the immutable
`contract.remedy` trace to the identical `protocol` object returned by
this one call — not two independently-selected remedies that could
diverge.

---

## H. Chart/house authority

`buildWatchChart()`: exactly one source/mirror definition pair, one
caller (`askWatchOracle.ts`). House mapping is not a separable step with
its own entry point — `judgeWatchChart()` reads `HOUSE_MATRIX[qType]`
(a fixed, frozen table in `houseMatrix.ts`) inline, as a single lookup,
not a function another module could call to produce a competing mapping.
No client-suppliable house assignment field exists in any schema. No
cached or serialized chart is ever accepted as engine input — `chart` is
always the direct return value of `buildWatchChart()`, used immediately,
never round-tripped through Firestore or the client first.

---

## I. Contract/fingerprint integrity

`computeContractFingerprint()` (`readingContract.ts:315`) was read in
full and tested directly (not merely inspected):

- **Fields included:** `contractVersion`, `engineVersion`, `rulesVersion`,
  `question` (both `raw` and `questionType`), `judgment`, `diagnosis`,
  `remedy`, `celestialEntities` — every judgment-bearing field.
- **Fields deliberately excluded:** `readingId`, `computedAt` — per-
  invocation identity, not judgment content, by explicit design (own doc
  comment) and confirmed empirically below.
- **Canonical serialization:** `canonicalStringify()` recursively sorts
  object keys before `JSON.stringify`, so property-insertion order never
  affects the digest; arrays keep their meaningful order.
- **Hash:** SHA-256 over the canonical string.

Executed directly against a real, engine-produced contract:

| Test | Result |
|---|---|
| Same contract, computed twice | fingerprints identical |
| `judgment.state` changed | fingerprint **changed** |
| `diagnosis.timingPosture` changed | fingerprint **changed** |
| `diagnosis.obstructingAgent` changed | fingerprint **changed** |
| `remedy.steps` changed | fingerprint **changed** |
| `question.questionType` changed | fingerprint **changed** |
| `provenance.engineVersion` changed | fingerprint **changed** |
| `provenance.readingId` changed | fingerprint **unchanged** (correct, by design) |
| `provenance.computedAt` changed | fingerprint **unchanged** (correct, by design) |

No Claude-controlled field (narration) and no client-controlled field
(beyond the already-proven-deterministic `question`/`questionType`) is
ever part of the hashed material.

---

## J. Immutability/serialization

Tested directly against a live, engine-produced `ReadingContract` (not
just read as source):

- `Object.isFrozen()` returned `true` at every level tested: top-level
  contract, `judgment`, `diagnosis`, `remedy`, `remedy.steps` (array),
  `remedy.steps[0]` (element), `celestialEntities` (array),
  `diagnosis.rationale` (array).
- Direct mutation attempts (`contract.judgment.state = 'FULFILLED'`,
  `contract.remedy.steps.push(...)`, `contract.celestialEntities.push(...)`,
  `contract.question.raw = 'INJECTED'`) all **threw `TypeError`** under
  strict-mode execution (the actual runtime mode of this TypeScript/ESM
  codebase), and in every case the underlying value was **confirmed
  unchanged** immediately after the attempt.
- **Serialization escape:** `JSON.parse(JSON.stringify(contract))`
  produces an ordinary mutable plain object, as expected of any
  `JSON.stringify`/`parse` round trip — that shadow object is NOT frozen
  and CAN be freely mutated. This is inherent JS semantics, not a defect
  in the contract itself. The relevant question — does anything in
  production treat such a shadow as authoritative? — was answered by the
  authority trace in §A: nothing in `responseComposer.ts`,
  `askWatchOracle.ts`, or `narrationValidator.ts` ever round-trips
  `contract` through `JSON.stringify`/`parse` and then continues using
  the result as the contract; `computeContractFingerprint` is always
  called on the live frozen `contract` object itself, and would produce a
  demonstrably different fingerprint if it were ever accidentally called
  on a tampered shadow (confirmed in §I's test table).
- **Spread escape:** `{ ...contract, judgment: { ...contract.judgment,
  state: 'FULFILLED' } }` likewise produces an unfrozen, freely-mutable
  new object — again inherent JS semantics — while leaving the original
  frozen `contract.judgment.state` provably untouched. No production code
  path performs such a spread on the contract and then treats the result
  as authoritative (confirmed by the same authority trace).

**Conclusion: the frozen object itself is what every downstream consumer
actually reads — fingerprinting, validation, and Firestore persistence
all operate on the same live, frozen `contract` reference, never on a
reconstructed or serialized copy.**

---

## K. Firestore/discussion authority

`askWatchOracle.ts` writes `readings/{id}` exactly once, from the same
`verdict`/`diagnosis`/`protocol` values already traced above — Firestore
performs no computation of its own; it is pure persistence.

`discussReading.ts` was read in full for this phase (not just the
ownership-check spot-read from Phase 5A): it loads the stored document
inside a transaction, checks `data.userId !== userId` (ownership), and
passes `verdict`/`confidence`/`narration`/`watchOracle` (via
`toGrounding()`) into `composeDiscussionReply()` as **read-only
grounding context** for a conversational Claude reply. The only Firestore
write `discussReading.ts` performs on the reading document is
`discussionTurns: FieldValue.increment(1)` (and a refund decrement on
failure) — never a verdict, diagnosis, or remedy field. No code path
anywhere re-derives a judgment from a stored reading; a previously stored
reading is read back verbatim or not at all, never recomputed into a
competing judgment.

---

## L. Client/AI authority boundaries

**Client:** grepped the entire `src/` tree for any call to
`judgeWatchChart`, `diagnose`, `selectRemedyProtocol`,
`buildReadingContract`, or `computeContractFingerprint` outside the
canonical authoring files themselves (`src/astrology/rkp/*`, which
*define* these functions as the source of truth for the sync step, and
are not consumers). Zero matches. The client only ever reads
server-returned display data (`WatchReading`, `WatchOracleComposition`)
and renders it — confirmed to be display mapping, not decision
computation, consistent with Phase 5A's client-wrapper trace.

**AI:** `narrate()` (`responseComposer.ts:376-460`) parses Claude's JSON
response and extracts exactly five string fields — `rkp_finding`,
`interpretation`, `recommended_approach`, `why_this_remedy`, `signature`
— into `NarrationFields`. Read the entire function body: there is no
code path anywhere that takes any part of Claude's response and assigns
it into `verdict`, `timing`, `diagnosis`, `remedy`, `engineVersion`, or
`contractFingerprint`. `validateNarration()` (Phase 4/4A) reads `contract`
to check the drafted `NarrationFields` against it and can only replace
`narration` with the deterministic fallback — it has no write access to
any other contract field (confirmed by its signature:
`validateNarration(contract: ReadingContract, drafted: NarrationFields):
ValidationResult` — `contract` is not even declared as mutable, and the
deep-freeze from §J would throw on any attempt regardless).
**No P0/P1 candidate found under this section.**

---

## M. Determinism

Executed directly, not assumed: `buildWatchChart` + `judgeWatchChart` +
`diagnose` + `selectRemedyProtocol` + `buildReadingContract` +
`computeContractFingerprint`, run twice against identical inputs (same
moment, same question, same reading id, same fixed `computedAt`):

- `judgment` — byte-identical (`JSON.stringify` equality)
- `diagnosis` — byte-identical
- `remedy` — byte-identical
- `contractFingerprint` — identical

No nondeterministic metadata leaked into any of the compared fields (the
only intentionally-varying fields, `readingId`/`computedAt`, were held
fixed for this comparison and are separately proven excluded from the
fingerprint in §I).

---

## N. Golden corpus

`npx vite-node functions/scripts/generate-golden-corpus.ts` re-run this
phase and diffed byte-for-byte (`diff -rq`) against a pre-run backup:
**111/111 identical.** The corpus directory itself was not modified
(confirmed: it was restored to its pre-run state by the generator writing
identical bytes, and `git status` shows no change to
`docs/audit/golden-corpus/`). `replay-check.ts`: **24/24
`identical: true`, 0 `identical: false`.**

Per the brief's instruction to compare more than final narration: the
golden-corpus generator and replay-check script both compare the full
engine-produced structure (chart-derived verdict, diagnosis, remedy) —
narration is intentionally excluded from both scripts already (it is
non-deterministic across real Claude calls and neither script invokes
Claude), so "111/111 identical" and "24/24 identical" already report on
verdict/timing/diagnosis/remedy specifically, not narration text.

---

## O. Adversarial engine inputs

Executed directly against the live engine functions (not predicted):

| Input | Function | Result |
|---|---|---|
| Invalid `qType` string | `judgeWatchChart` | **Threw** `TypeError` (undefined `HOUSE_MATRIX` entry) |
| `undefined`/`null`/`{}` chart | `judgeWatchChart` | **Threw** `TypeError` in all three cases |
| `{}`, invalid `state`, non-numeric `confidence`, `NaN` confidence | `diagnose` | **Threw** `TypeError` in all four cases (accesses a house-matrix-derived field that doesn't exist on a malformed verdict) |
| `undefined`/`null` diagnosis | `selectRemedyProtocol` | **Threw** `TypeError` |
| `{}` / `{outcome:'NOT_REAL'}` diagnosis | `selectRemedyProtocol` | Did **not** throw — returned a **degenerate, safe empty-steps protocol** (`steps: []`), not a fabricated remedy |
| `computedAt: new Date(NaN)`, `question: undefined` | `buildReadingContract` | **Threw** `RangeError: Invalid time value` (from `.toISOString()`) |

**No malformed input tested produced a plausible-looking but false
authoritative reading.** Every case either failed loudly (a crash — not
automatically a P0/P1 per the brief's own framing) or degraded to an
explicitly empty/safe result. None of these inputs are reachable from any
traced user-input path (Phase 5A already proved `qType` always comes from
the deterministic classifier, `chart` always from `buildWatchChart`, and
`verdict`/`diagnosis` always from the immediately preceding deterministic
step) — this section is pure defense-in-depth characterization, not a
demonstrated live path.

---

## P. Legacy/KP authority analysis (no deletion performed)

`kp/rules/houseMatrix.ts` and `kp/rules/questionKeywords.ts` are, per the
prior audit, legitimate — and per this phase's fresh trace, **the actual
live, canonical, only** — question-resolution and house-routing
implementations; their `kp/` directory name is a naming legacy, not a
sign of retired code (re-confirmed, not merely taken on faith). The
actual retired judgment engine, `judgeHorary.ts`, **does not exist on
disk anywhere in the repository** — full removal was already complete,
not merely unreferenced. The only trace of it is five stale doc-comment
mentions (P3, documentation accuracy) pointing at a file that no longer
exists. No legacy judgment authority can execute. Nothing was deleted,
renamed, or modified in this section's investigation.

---

## Q. Findings

**No P0 or P1 findings.** Two P2 findings and continuation of the
existing P3 documentation-accuracy note.

### P5B-1 (P2) — the committed `functions/src/engine/` mirror has silently diverged from its canonical source

`functions/src/engine/rkp/watchJudgment.ts` (committed, HEAD) does not
match what `sync-engine.mjs` would currently produce from
`src/astrology/rkp/watchJudgment.ts`. Reproduced and then fully reverted
this phase (see §R for the exact procedure). The divergence is a rationale-
text formatting bug only: the committed server copy renders
`` `${targetHouse}th Ghar` `` (producing "1th Ghar", "2th Ghar") instead
of the canonical source's `gharLabel(targetHouse)` helper (producing "1st
Ghar", "2nd Ghar" — commit `9db63fc`, "fix: use gharLabel() so house
ordinals read 1st/2nd/3rd, not 1th/2th/3th", never propagated to the
mirror). This affects only `diagnosis.rationale` string text (display
prose), not `outcome`, `timingPosture`, `obstructingAgent`, or any other
decision field.

**Why this matters beyond the cosmetic bug itself:** it demonstrates that
nothing in this repository's tooling currently prevents the checked-in
generated mirror from drifting from its source between commits.
Production deploys are NOT at risk — both `firebase.json`'s `predeploy`
hook and `.github/workflows/deploy-functions.yml`'s explicit
`npm run build` step re-run `sync-engine` immediately before every real
deploy, so the live Cloud Function always runs freshly-synced code
regardless of what is committed. The `functions-quality` CI job
(`.github/workflows/ci.yml`) also happens to test fresh code, purely as a
side effect of step ordering (`npm run build` runs before `npm test` in
that job). **What is at risk is ad-hoc verification**: every `npx vitest
run` / `npx tsc --noEmit` invocation made directly against `functions/` —
including every one performed in this session across Phase 4, 4A, and
5A — silently exercised the stale, diverged copy without any indication
that it was stale. This is recorded as a genuine limitation on this
project's own prior audit evidence: the Phase 4A/5A "zero engine drift"
`git diff` checks remain valid for their literal claim (this session did
not modify engine files), but say nothing about whether the pre-existing
committed engine mirror was already internally consistent with its
source — a different question this phase is the first to have asked and
answered.

### P5B-2 (P2) — `sync-engine.mjs`'s `pruneDir()` silently deletes hand-authored, non-mirrored test files on every build

`functions/src/engine/primitives/__tests__/chartBuilder.test.ts` and
`julianDay.test.ts` (17 tests total, added in commit `585ccd5`, "Add RKP
golden-value regression tests (previously zero under engine/)") were
deliberately hand-authored directly under the generated `engine/` tree,
specifically because `__tests__` directories are documented as
intentionally skipped by the sync step's *copy* logic (`syncDir()`) — but
`pruneDir()`, which runs immediately after and recursively removes any
destination file absent from the source, does **not** carry the same
exemption. Reproduced directly this phase: running `node
scripts/sync-engine.mjs` deleted both files
(`[sync-engine] Pruned stale file: chartBuilder.test.ts` /
`julianDay.test.ts`), fully reverted afterward via `git checkout --
functions/src/engine/`.

**Concrete consequence, not merely theoretical:** because the
`functions-quality` CI job runs `npm run build` (which invokes this
prune) immediately before `npm test`, **these 17 tests do not execute in
CI on any run**, silently — CI reports whatever subset of tests it finds
after the prune has already run, with no error, warning, or reduced-count
signal distinguishing "17 fewer tests intentionally" from "17 fewer tests
silently lost." The same applies to
`.github/workflows/deploy-functions.yml`'s explicit `npm run build` step,
though tests are not run there. This is a genuine, currently-active
verification-coverage gap in the project's own CI pipeline — not a
production authority risk (test files are never part of the deployed
`lib/` bundle regardless), but the most operationally significant of this
phase's findings: real regression coverage the team believed existed
("previously zero under engine/" — the commit message shows this was a
deliberate gap-filling effort) has been silently absent from CI since the
sync-engine `__tests__`-skip behavior was introduced.

### P5B-3 (P3, continuation of a Phase 5B-native finding) — stale doc comments reference a deleted module

Five files carry comments pointing at `judgeHorary.ts`, which does not
exist on disk. Documentation-accuracy only; already covered under item P
above with no separate remediation implied here (per instruction, not
fixed).

---

## R. Reproduction

No P0/P1 findings exist. The two P2 findings' reproduction is inline
above (P5B-1, P5B-2); the exact commands used:

```
# P5B-1 / P5B-2 reproduction, both surfaced by the same dry run:
cp -r functions/src/engine /tmp/.../engine-backup-preSync   # safety backup
cd functions && node scripts/sync-engine.mjs
# → "[sync-engine] Pruned stale file: chartBuilder.test.ts"
# → "[sync-engine] Pruned stale file: julianDay.test.ts"
# → "[sync-engine] Done. copied=1 skipped=30"
git status --porcelain -- functions/src/engine/
#  D functions/src/engine/primitives/__tests__/chartBuilder.test.ts
#  D functions/src/engine/primitives/__tests__/julianDay.test.ts
#  M functions/src/engine/rkp/watchJudgment.ts
git diff -- functions/src/engine/rkp/watchJudgment.ts   # shows the gharLabel/"Nth Ghar" divergence

# Revert (this phase performs no fixes):
git checkout -- functions/src/engine/
git status --porcelain -- functions/src/engine/   # → empty, confirmed reverted
```

---

## S. Test matrix

| Command | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | 189/189 passed, 14 files — unchanged from the Phase 5A baseline |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root, Jest) | 304/304 passed, 27 suites (re-confirmed this phase) |
| `npx vite-node functions/scripts/generate-golden-corpus.ts` + `diff -rq` against pre-run backup | 111/111 identical, corpus unmodified |
| `npx vite-node functions/scripts/replay-check.ts` | 24/24 identical |
| Fingerprint sensitivity probe (9 sub-cases) | all as expected — see §I table |
| Immutability probe (mutation attempts at every contract level) | all mutations blocked/threw, all values confirmed unchanged — see §J |
| Adversarial engine-input probe (13 sub-cases across 4 functions) | all fail loud or degrade safely, zero false-authoritative output — see §O |
| `node scripts/sync-engine.mjs` dry run, then `git checkout --` | reproduced P5B-1/P5B-2, then fully reverted — see §R |

No existing test was modified, skipped, or rewritten. No test failed.

---

## T. Production changes

**Production code changed: 0.**

`git status --porcelain` at the end of this phase shows only the three
new documentation files:
- `docs/audit/PHASE_5B_REPORT.md` (this file)
- `docs/audit/PHASE_5B_AUTHORITY_MATRIX.md`
- (this report references no other new file)

The one working-tree modification made during this phase (`sync-engine`
dry run touching `functions/src/engine/`) was fully reverted via
`git checkout --` before this report was written, and `git status
--porcelain -- functions/src/engine/` was re-confirmed empty.

---

## Acceptance criteria — checked against the brief

- [x] Engine authority graph built from actual imports/call sites (§A)
- [x] Single authority proven for every responsibility (§B, full matrix doc)
- [x] Alternate implementations searched repository-wide, not by filename (§C)
- [x] Watch engine entry points enumerated — one production entry
      (`askWatchOracle.ts`), two dev-only regression-script entries,
      confirmed unexported/undeployed
- [x] Verdict authority traced and mutation-tested (§D, §J)
- [x] Timing authority traced, contradictory-input tested (§E; corpus already covered this in 5A §G, re-confirmed structurally here)
- [x] Diagnosis authority traced, validator confirmed not a second diagnosis engine (§F)
- [x] Remedy authority independently re-verified from current HEAD, not from Phase 2B docs (§G)
- [x] Chart/house authority traced (§H)
- [x] Engine version authority traced, replacement attempt tested (§B matrix row, re-confirmed strict-schema rejection)
- [x] Contract fingerprint tested for determinism and field sensitivity (§I)
- [x] Immutability boundary tested at every contract level (§J)
- [x] Serialization/spread escape tested (§J)
- [x] Firestore/discussion authority traced (§K)
- [x] Client authority search performed, scoped narrowly (§L)
- [x] AI authority search performed, scoped narrowly (§L)
- [x] Determinism re-tested with repeated runs (§M)
- [x] Golden corpus re-run, 111/111, unmodified (§N)
- [x] Adversarial engine inputs tested safely, no crash treated as automatic P0 (§O)
- [x] Legacy/KP authority searched, nothing deleted/renamed (§P)
- [x] No P0/P1 to reproduce; both P2s fully reproduced and reverted (§R)
- [x] Test matrix recorded (§S)
- [x] Production changes: 0 (§T)

---

## FINAL STATUS

No P0 or P1 vulnerabilities were found. The Watch engine is confirmed to
be the true single source of truth for every judgment-bearing field, all
the way into the persisted `ReadingContract` — not merely the preferred
one. Two P2 findings (generated-mirror drift; a build-tooling bug that
silently drops 17 regression tests from CI) are documented and were
deliberately left unfixed, per this phase's reconnaissance-only
instruction, along with one continuing P3 (stale doc comments).

**PHASE 5B: PASS WITH DOCUMENTED FINDINGS**

STOP. Phase 5C is not started. No findings were fixed. No refactor was
performed. No file was renamed. No module was moved. No `kp/` primitive
was deleted or renamed. The 4/18 remedy taxonomy question was not
reopened. No unrelated cleanup was performed.
