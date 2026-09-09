# Phase 8A-1 — Reconnaissance: Narration Safety Validation Gap on `main`

Read-only reconnaissance on the P0/P1-class finding that halted Phase
8A: **`main`'s deployed AI-output narration path has no independent
post-generation safety validation.** Baseline: `07f8b00`. **No
repository file is modified by this document.**

## 1. The exact gap on `main` (`ce536bc` — confirmed deployed to production Cloud Functions per Phase 7C §4)

`functions/src/oracle/responseComposer.ts`'s `narrate()` function calls
the Anthropic API with `WATCH_ORACLE_SYNTHESIS_PROMPT` as the system
prompt, parses the JSON response, and checks only that four fields
(`rkp_finding`, `interpretation`, `recommended_approach`, `signature`)
are non-empty. The function's own code comment states the gap
explicitly:

```ts
// The system prompt guard is the primary defense; additional post-generation
// validation was removed when the KP engine was deleted (PR #92).
return drafted;
```

No length cap, no content filter, no claim-consistency check, and no
independent judgment of what the model actually wrote exists anywhere
between this `return` and the reading being persisted to Firestore and
shown to a user. Confirmed by reading the full `narrate()` and
`composeWatchOracleResponse()` bodies directly from `main`'s tree via
`git show ce536bc:...` (not the local working tree, correcting the
method error described in §6).

## 2. Root cause, traced to the exact commit

- `main`'s commit `f6505df` ("Merge PR #88: Production audit framework
  with conflict resolution") explicitly states in its own message:
  *"Fixed safetyValidator imports (file deleted in main)... Updated
  responseComposer to work without deleted safety validator."*
- This was **conflict-resolution fallout from PR #92** (the KP/
  Astronomical engine deletion), not a deliberate, reviewed decision to
  retire the control. `safetyValidator.ts` — the mechanism the prior
  audit's `PRODUCTION_AUDIT_2026-08-23.md` (item 5) claimed as closed —
  was a casualty of merging two large, independently-developed
  branches, and was never restored.
- **Confirmed absent from `main`'s entire tree** via `git ls-tree -r
  ce536bc | grep -i safety` and a direct `git show
  ce536bc:functions/src/oracle/safetyValidator.ts` failure. No file of
  any name providing this function exists on `main`.

## 3. What was removed, characterized precisely via the hardened branch's replacement

The hardened branch does not restore `safetyValidator.ts` — it
replaced it with a newer, more thorough mechanism, built as this
audit chain's own **Phase 4** work (predating the window this
conversation's summary covers), documented at
`docs/audit/PHASE_4_SAFETY_VALIDATION_IMPLEMENTATION.md`,
`docs/audit/PHASE_4_HISTORICAL_VALIDATOR_ANALYSIS.md` (which
specifically explains *why* the deleted file was not simply restored),
and `docs/audit/PHASE_3_CLAIM_SURFACE.md`. **None of these three
documents exist on `main`** — confirmed via `git show ce536bc:<path>`
failing for each.

`functions/src/oracle/narrationValidator.ts` (1,539 lines) is a
**deterministic, network-free validator** — its own docstring states
the absolute rule explicitly: *"this file makes NO network call, calls
NO model, and asks NOTHING to judge itself... every check is a plain
comparison between narration text and a specific `ReadingContract`
field."* It checks 12 base failure categories
(`VERDICT_CONTRADICTION`, `TIMING_FABRICATION`, `TIMING_ALTERATION`,
`REMEDY_SUBSTITUTION`, `REMEDY_ADDITION`,
`UNAUTHORIZED_CELESTIAL_ENTITY`, `DIAGNOSIS_CONTRADICTION`,
`UNSUPPORTED_CERTAINTY`, `TERMINOLOGY_LEAKAGE`,
`INTERNAL_DATA_LEAKAGE`, `PROMPT_INJECTION_ARTIFACT`,
`MALFORMED_OUTPUT`) plus a later "Phase 5E-R" set of deterministic
ground-truth claim checks (house/sign/direction/retrograde/
ruler-relation contradiction). On the hardened branch it is called
twice inside `narrate()` — once for the persisted narration, once
independently for the TTS-spoken artifact — and a failure routes to
`buildDeterministicFallbackNarration()` (`narrationFallback.ts`, 80
lines) rather than silently returning the unvalidated text or `null`.
`readingContract.ts` (327 lines) defines the ground-truth structure the
validator checks narration against; `textSecurity.ts` (166 lines)
provides Unicode-normalization/canonicalization helpers so obfuscated
variants of a forbidden term can't slip past a naive string match.

**Total replacement surface: 2,112 lines across 4 files**, none of
which exist on `main`.

## 4. Reachability — this is the live, primary path, not a dead branch

`composeWatchOracleResponse()` is called from
`functions/src/functions/askWatchOracle.ts` inside the
`oracle-composition` stage of the main judgment flow — the callable
every real Oracle reading in the app invokes. It is wrapped in its own
try/catch (a composition failure is non-fatal — the reading still
stands on its deterministic verdict, per the code's own comment) but
when it *succeeds*, the model's prose is written directly into the
`ReadingDoc.narration.{en,ur,hi}` fields and the `watchOracle` field
persisted to Firestore, then shown to the user — with zero validation
of content beyond the four-field presence check. This is not a rare or
degraded-mode path; it is the expected, common-case outcome of every
successful reading.

## 5. What remaining defenses exist on `main` — stated precisely, not overstated

- **System prompt guardrails** (`watchOracleSynthesisPrompt.ts`, 116
  lines, one `WHAT YOU MUST NOT DO` section) — instruction-based only;
  no structural enforcement backs it. This is the literal "primary
  defense" the code comment names, and on `main` it is also the *only*
  defense for narration content.
- **Remedy content is structurally never model-generated** — remedy
  names, instructions, and evidence labels are copied verbatim from
  `REMEDY_LIBRARY` after the model returns; the model writes prose
  fields only (`rkp_finding`, `interpretation`, `recommended_approach`,
  `why_this_remedy`, `signature`). This meaningfully narrows the blast
  radius — a compromised or drifting model cannot invent a remedy
  practice — but does not bound what it writes in the prose fields
  themselves (a fabricated timing claim, a contradicted verdict, a
  leaked internal term, or system-prompt/injection artifacts surfacing
  in the visible text are all still possible).
- **Field-presence check only** — no length cap (confirmed: the one
  `.slice(0, 500)` in this file bounds the user's own question in the
  prompt build, not the model's output), no content check.
- **Input-side prompt-injection defense exists and is real**, but
  solves a different problem: `sanitizeQuestion()` flattens newlines in
  the *user's own question* before it enters the prompt, so a seeker
  cannot forge a fake "RKP DIAGNOSIS" section via their question text.
  Two of `main`'s test files superficially matched a search for
  "inject"/"unsafe" (`questionInNarration.test.ts`,
  `discussionComposer.test.ts`) — both confirmed, on inspection, to
  test this same input-side control, not the model's output. **`main`
  has zero tests asserting anything about output-side narration
  safety** — no equivalent of the hardened branch's
  `narrationValidator.test.ts`, `narrationValidatorGroundTruth.test.ts`,
  `narrationValidatorHardening.test.ts`,
  `narrationValidatorUnicodeSecurity.test.ts`, or the 13-fixture
  `adversarialNarration.test.ts` suite exists on `main`.

## 6. Orphaned code confirming the removal was incomplete cleanup, not a clean decision

`askWatchOracle.ts` on `main` still allocates `readingRef` early and
threads `readingId: readingRef.id` into `composeWatchOracleResponse()`
via a comment stating: *"the safety validator logs its result under
readings/{readingId}/validationLog, and needs the id before the
reading document itself is written."* Confirmed: `readingId` is
declared in `CompositionInput` but **is not destructured or used
anywhere inside `composeWatchOracleResponse()` or `narrate()`** — a
dead parameter. A repository-wide search (`git grep -n
"validationLog"`) finds **exactly one match, the orphaned comment
itself** — no code writes to any `validationLog` subcollection, and
`firestore.rules` has no rule for one. This confirms the removal was
an unreviewed side effect of conflict resolution, not a deliberate
redesign — the audit-trail intention survives only as a stale comment.

## 7. Correction owed to this audit chain's own record

`docs/audit/PHASE_7B_REVIEW.md` §4.4 corroborated the prior audit's
"AI output defense-in-depth" closure claim as a mere "naming drift"
(`runWatchNarrationSafetyValidator` → `validateNarration()`). That
corroboration is **inaccurate**: the check that produced it ran a
plain `grep` against the local working tree — the hardened branch,
where `narrationValidator.ts` genuinely exists and is called — rather
than `git show ce536bc:...` against `main`'s tree the way the adjacent
checks in the same section correctly did. The correct characterization
is: **`main` has no output-side narration safety mechanism under any
name.** This document does not itself write the correcting addendum —
that remains a separate action awaiting its own authorization, per
this project's append-only-with-dated-addenda discipline, as flagged
when this finding first halted Phase 8A.

## 8. Severity assessment

Not a P0 (no authentication bypass, no cross-user data access, no
unbounded financial effect) but a genuine **P1**: production narration
shown to real users, for a product whose entire premise is a
disciplined, deterministic judgment system explicitly walled off from
model invention (*"RKP calculates. Oracle composes. UI displays. Audio
speaks. Client never invents judgment."*), currently has no
structural backstop if Claude's output ever drifts from, contradicts,
or elaborates beyond what the deterministic engine actually
determined — bounded only by instruction-following, with zero
automated tests exercising that boundary. The prompt-injection defense
that does exist protects the *input* side (a malicious question can't
forge a fake diagnosis section); nothing protects the *output* side
(a compromised, confused, or adversarially-steered model response
reaches the user's screen and ears unfiltered). The hardened branch's
own 2,112-line replacement and its adversarial-fixture test suite are
direct evidence this project's own engineering judgment already rated
this risk as worth a substantial, dedicated control — one that is
currently not running in production.

## 9. What a remediation would require — laid out, not chosen

Two shapes, not evaluated against each other by this reconnaissance:

- **Narrow port**: bring exactly the 4 files (`narrationValidator.ts`,
  `narrationFallback.ts`, `readingContract.ts`, `textSecurity.ts`,
  2,112 lines) plus their test suites and the two call sites' wiring
  in `responseComposer.ts` onto `main`, independent of the broader
  84-commit hardened-branch merge decision. Smallest, most targeted
  fix; would need its own careful dependency check (`ReadingContract`
  and `NarrationFields` type compatibility against `main`'s current
  `responseComposer.ts` shape, which has diverged in other ways per
  the 349-file/175,938-line total diff surface Phase 8A's aborted first
  step measured).
- **Full merge**: resolved as part of whatever Phase 8B/8C merge
  authorization eventually promotes the hardened branch to `main` in
  full, closing this alongside every other Phase 6 finding at once.
  Slower to land, but avoids re-solving a merge-compatibility problem
  twice.

**This reconnaissance takes no position on which shape, or on timing
relative to the broader promotion sequence.**

## 10. Hard-stop determination

**No further hard-stop condition was triggered during this
reconnaissance.** The single finding that already triggered the
hard-stop protocol (§1) has now been fully characterized with precise,
independently-derived evidence; nothing newly discovered here (the
orphaned `readingId`/`validationLog` comment, the absence of
output-side tests) rises to its own separate hard-stop — both are
symptoms of the same root cause already reported, not new defect
classes.

## 11. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this reconnaissance is written against: `07f8b00`
  (Phase 7C Final Decision).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, CI-workflow, or
  deployment-configuration file is touched — the only file this phase
  adds is this document.
- No implementation occurred. No remediation was chosen. No addendum
  to `PHASE_7B_REVIEW.md` was written.

---

## Status

**PHASE 8A-1 RECONNAISSANCE: COMPLETE.**

| Layer | Status |
|---|---|
| Phase 7C Final Decision | ✅ Complete (`07f8b00`) |
| Phase 8A promotion reconnaissance | ⏸️ Paused — halted by this finding before completing |
| Phase 8A-1 reconnaissance (this finding) | ✅ Complete (this document) |
| Narration safety validation gap | 🔴 Confirmed, characterized, **not remediated** — live in production |
| `PHASE_7B_REVIEW.md` §4.4 correction | 🔲 Owed, not yet written — awaiting separate authorization |
| Finding 3 (Options A/B) | 🔲 Still undecided, untouched |
| Merge to `main` | 🔲 Not authorized |
| Production deployment | 🔲 Not authorized |

Awaiting a separate, explicit authorization for: (a) remediation of
this finding (narrow port or full-merge shape, per §9), (b) the
`PHASE_7B_REVIEW.md` correcting addendum, and/or (c) resumption of the
paused Phase 8A promotion-reconnaissance sweep.
