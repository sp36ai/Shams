# Phase 1 — Architecture Map, Authority Resolution & Golden Corpus

**Repository:** sp36ai/Shams
**Scope:** documentation, golden-corpus fixtures, and narrowly-scoped test
harness scaffolding only (two scripts under `functions/scripts/`, neither
imported by application code, neither part of `npm run build`, neither wired
into CI). **No judgment, timing, remedy, prompt, UI, or security-rule
behavior was changed.** See §I for the exact file list and the diff proving
this.

This document summarizes `AUTHORITY_MATRIX.md`, `REMEDY_AUTHORITY_ANALYSIS.md`,
`DUPLICATE_AUTHORITY_MAP.md`, and the golden corpus under
`docs/audit/golden-corpus/`. Read those three files for full detail; this is
the compiled index the Phase 1 brief asked for.

---

## A. Current canonical path

Unchanged from Phase 0, re-verified in this pass by re-reading every file in
the chain and by generating and replaying the golden corpus against it:

```
client (text OR voice, same call) → askWatchOracle (onCall)
  verifyAuth → Zod validate → rate limit → idempotency claim → quota claim
  → localIsoFromOffset(instant, utcOffsetMinutes)
  → buildWatchChart(localMoment)                    engine/rkp/watchChart.ts
  → classifyQuestion(question)                       engine/kp/rules/questionKeywords.ts
  → judgeWatchChart(chart, qType)                     engine/rkp/watchJudgment.ts
  → toBoundaryPlanetName × 3                          utils/planetBoundaryName.ts
  → composeWatchOracleResponse
      → diagnose(verdict)                             engine/rkp/diagnosis.ts
      → selectRemedyProtocol(diagnosis)                oracle/remedySelection.ts   [Path A]
      → narrate() → Claude Opus 5                      oracle/responseComposer.ts
  → readings/{id}.set()  → auditLogs.add()  → response → client
  → ReadingScreen fires runGuidanceSelection() UNCONDITIONALLY
      → selectRemedies (Cloud Function, LLM)           functions/selectRemedies.ts [Path B]
      → GuidanceCard renders selectedRemedies, alongside RemedyProtocolCard
  → TTS speaks the composed narration verbatim
```

The one addition to Phase 0's map, confirmed by re-reading `ReadingScreen.tsx`
in full this pass: **Path B is not a side branch — it is part of the
canonical path every reading takes**, firing unconditionally, not an
optional or legacy fallback. This is the central fact
`REMEDY_AUTHORITY_ANALYSIS.md` works through.

---

## B. Authority matrix

See `docs/audit/AUTHORITY_MATRIX.md` for the full table (Question resolution,
Chart construction, House mapping, Judgment, Diagnosis, Timing, Remedy
selection, Oracle narration, TTS). One-line summary: every responsibility has
exactly one authoritative implementation **except Remedy selection**, which
has two live ones (Path A, deterministic; Path B, LLM), covered below and in
`REMEDY_AUTHORITY_ANALYSIS.md`.

---

## C. Remedy authority analysis

See `docs/audit/REMEDY_AUTHORITY_ANALYSIS.md` for the full trace. Summary:

- **Path A** (`oracle/remedySelection.ts`): deterministic, server-side,
  library-bound, persisted to `/readings/{id}`, confirmed deterministic by
  actually running it (111-case golden corpus, byte-identical on replay).
- **Path B** (`selectRemedies` + `src/data/remedyLibrary.ts`): LLM-driven
  final pick from a client-ranked (deterministic) candidate pool, fires on
  every reading unconditionally, draws from a **disjoint** id namespace,
  persistence to Firestore **not verified** in this pass (flagged, not
  asserted).
- Both render in the same `ChatBubble`, unconditionally when present.
  `GuidanceCard.tsx`'s own comment states this dual-rendering is intentional
  design ("answer different questions"), not an oversight.
- **Recommendation (not a decision):** Path A should become sole authority
  for remedy *selection*; Path B should be retired or re-scoped to
  supplementary prose about a remedy Path A already chose — mirroring the
  narration/fact separation already enforced elsewhere in this codebase.
  Reasoning and required pre-conditions are in the source document.

---

## D. Legacy / shared-primitive classification — every production-reachable `kp/` dependency

| Path | Importer(s) | Runtime reachable? | Classification | Judgment authority? | Movable w/o behavior change? | Proposed Phase 2 destination (not performed) |
|---|---|---|---|---|---|---|
| `functions/src/engine/kp/rules/houseMatrix.ts` | `engine/types/question.ts`, `engine/rkp/diagnosis.ts`, `engine/rkp/watchJudgment.ts`, `oracle/remedySelection.ts`, `oracle/suggestedQuestions.ts`, `oracle/remedyLibrary.ts` | **Yes — live, production** | Shared house primitive (question-type → house lookup data) | **No.** It supplies routing data (`targetHouse`, supporting/obstructing houses) that `watchJudgment.ts`/`diagnosis.ts` consume; the decision logic (state, confidence, outcome) lives in those files, not here. | Yes — pure data table, no side effects, no hidden coupling to the `kp/` path name found | Candidate: `engine/rkp/rules/houseMatrix.ts` or `engine/shared/houseMatrix.ts` — a name that does not imply "Krishnamurti Paddhati judgment," since it is not one |
| `src/astrology/kp/rules/houseMatrix.ts` | `stores/readingsStore.ts` (type-only), `astrology/types/question.ts`, `astrology/rkp/{diagnosis,watchJudgment}.ts` | Source of the above (mirrored by `sync-engine.mjs`) | Compatibility layer / source-of-truth for the generated copy | No | Yes, in lockstep with the server copy — moving one without the other would break `sync-engine.mjs`'s path rewriting | Same destination as server copy, moved together |
| `functions/src/engine/kp/rules/nakshatras.ts` | `engine/primitives/subLord.ts` (used by `chartBuilder.ts`, reachable from every chart build) | **Yes — live, production** | Shared astronomical primitive (nakshatra index/lord table) | No — astronomical reference data, not a decision | Yes | Candidate: `engine/primitives/nakshatras.ts` |
| `src/astrology/kp/rules/nakshatras.ts` | `astrology/primitives/subLord.ts` | Source copy | Compatibility layer / source | No | Yes, in lockstep | Same, moved together |
| `functions/src/engine/kp/rules/vimshottari.ts` | `engine/primitives/subLord.ts` | **Yes — live, production** | Shared astronomical primitive (Vimshottari dasha-lord sequence) | No | Yes | Candidate: `engine/primitives/vimshottari.ts` |
| `src/astrology/kp/rules/vimshottari.ts` | `astrology/primitives/subLord.ts` | Source copy | Compatibility layer / source | No | Yes, in lockstep | Same, moved together |
| `functions/src/engine/kp/rules/questionKeywords.ts` | `functions/functions/askWatchOracle.ts` (direct `require()`) | **Yes — live, production, directly on the hot path** | Question classification | **Partial — it decides `QuestionType`, which routes judgment (via `HOUSE_MATRIX`), but does not itself compute a verdict, timing, or remedy.** Treated here as classification, not verdict authority, consistent with the Authority Matrix's "Question resolution" row. | Yes, but higher-risk than the pure-data files above since it is a `require()`'d module with string/keyword logic, not a lookup table — moving it needs a working import-path update, not just a file move | Candidate: `engine/classification/questionKeywords.ts` |
| `src/astrology/kp/rules/questionKeywords.ts` | **No client-side runtime call site found** (re-confirmed this pass) | Source-only; live only via the synced server copy | Compatibility layer / source | Same as above (classification) | Yes, in lockstep | Same, moved together |
| `functions/src/engine/kp/judgment/__tests__/judgeHorary.test.ts` | Nothing — its one import target (`judgeHorary.ts`) does not exist anywhere in the repository | **No — confirmed dead. Cannot load, let alone execute.** Re-verified this pass: still the sole failing suite in `npx vitest run` at current `HEAD`. | Dead code (test-only, broken) | No — cannot execute | **Confirmed safe to remove without behavior change** — it currently contributes zero passing tests and zero coverage; its only effect is a permanently-red `functions/` test suite. **Not removed in this phase**, per the explicit Phase 1 instruction to leave even confirmed-dead files untouched until Phase 2 authorizes it. | Phase 2 candidate action: delete, once explicitly authorized — no destination needed, there is nothing to preserve |

No `kp/`-named path in this table was classified by directory-name
inference. Every "Yes — live" cell traces to a concrete importer read in this
pass or the Phase 0 addendum (re-verified, not merely copied forward).

---

## E. Duplicate authority map

See `docs/audit/DUPLICATE_AUTHORITY_MAP.md` for the full table across
Question type, House mapping, Judgment, Diagnosis, Timing, and Remedy
selection. One live duplicate found: **Remedy selection** (Path A / Path B,
above). Every other responsibility has exactly one live, reachable
implementation; the only "second" judgment implementation in the repository
(`judgeHorary`) cannot execute at all.

---

## F. Golden corpus

**Location:** `docs/audit/golden-corpus/` — `index.json` (manifest) +
`cases/<id>.json` (one file per case).

**Generator:** `functions/scripts/generate-golden-corpus.ts` (not part of the
deployed bundle, not imported by any application file, not run by `npm run
build` or CI — pure Phase 1 scaffolding). Run via
`npx vite-node scripts/generate-golden-corpus.ts` from `functions/`.

**What each case captures**, per the Phase 1 spec's required fields:

| Required field | Present? | Where |
|---|---|---|
| question | Yes | `input.question` |
| timestamp | Yes | `input.utcInstant` (the server-authoritative instant) |
| timezone | Yes, as `utcOffsetMinutes` — the exact form `askWatchOracle` actually receives (the app collects a numeric UTC offset, not an IANA zone name; recording an IANA name would invent a field the system does not have) | `input.utcOffsetMinutes` |
| latitude/longitude | **Deliberately absent, documented, not invented.** `askWatchOracle` takes no lat/lon at all (Phase 0 §B); `buildWatchChart()`'s optional `location` param is documented in its own source as not affecting the result. Each case's `input.latLon` field states this explicitly rather than fabricating coordinates. | `input.latLon` (a note, not a value) |
| normalized question/type | Yes | `derived.normalizedQuestionType` |
| chart fingerprint | Yes — a SHA-256 digest of every field that determines downstream judgment (lagna sign/ruler, window, and each planet's sign/degree/house/retrograde/combust/dignity), so any future divergence in chart construction is caught even if the top-level verdict happens to still match | `derived.chartFingerprint` |
| judgment | Yes, full `WatchVerdict` (boundary-name-mapped, matching what the client actually receives) | `verdict` |
| timing | Yes — inside both `verdict.timing` and `diagnosis.timing`/`diagnosis.timingPosture` | `verdict`, `diagnosis` |
| diagnosis | Yes, full `RkpDiagnosis` | `diagnosis` |
| remedy | Yes — Path A's protocol (`interventionRequired`, `guidance`, `rationale`, `stepIds`). **Path B and narration are deliberately excluded** — Path B is not deterministic input-for-input (LLM pick) and narration is explicitly non-deterministic by design; a golden corpus can only meaningfully pin what the system guarantees to reproduce. | `remedyProtocol` |

**Coverage — 111 cases** (exceeds the 100-case floor), by label:

| Label | Count | | Label | Count |
|---|---|---|---|---|
| marriage | 8 | | disputes | 7 |
| business | 11 | | health | 2 |
| employment | 9 | | spiritual | 3 |
| finance | 9 | | lostitem | 2 |
| property | 7 | | general | 4 |
| travel | 7 | | ambiguous | 3 |
| education | 7 | | multi-intent | 3 |
| family | 7 | | timing-sensitive | 18 |
| relationship | 4 | | | |

Every required coverage category from the Phase 1 brief (relationship,
marriage, business, employment, finance, property, travel, education,
family, disputes, general, ambiguous, multi-intent, timing-sensitive) has at
least 2 cases; most have 5+.

**Baseline status:** every value in every case file was produced by actually
executing the current authoritative engine (`functions/src/engine`,
`functions/src/oracle/remedySelection.ts`) against the stated input — none
invented, none hand-written. This satisfies the Phase 1 instruction "Do NOT
invent expected judgments."

---

## G. Determinism — replay results

Two independent checks, both clean:

1. **Full-corpus, two-process replay.** The entire 111-case generator was run
   twice as separate process invocations; `diff -rq` between the two output
   trees returned **no differences** (`diff exit: 0`). This is a stricter and
   larger check than the ">= 20 cases" floor the Phase 1 brief set.
2. **24-case, same-process replay** (`functions/scripts/replay-check.ts`,
   also Phase 1 scaffolding only): each of 24 hand-selected cases — covering
   every `QuestionType`, several repeated identical inputs, and four
   timing-sensitive variants — was computed **twice back-to-back in the same
   process** and diffed via `JSON.stringify` equality on the full
   `{chart, verdict, diagnosis, protocol}` object. Result: **24/24 identical.
   Zero mismatches.** This is a stricter check than the two-process run: it
   also rules out same-process state leakage (module-level caches, mutated
   shared objects, insertion-order-sensitive `Set`/`Map` iteration) that a
   fresh-process comparison could theoretically mask.

**No nondeterminism was found. Nothing was "fixed" because nothing broke —
per the Phase 1 instruction, this would have been a STOP-and-report condition
had either check produced a difference; neither did.**

---

## H. Risks (evidence-based, P0–P3)

Carried forward from Phase 0/addendum, unchanged (not re-fixed, not
re-adjudicated) — plus new findings from this phase's test reconciliation:

**P0 — AI output safety validator absent from the live path.** Unchanged
from Phase 0 addendum §1. Not restored in this phase, per instruction.

**P1 — Live remedy duplicate authority (Path A / Path B).** Elevated from
Phase 0's "UNRESOLVED" to **CONFIRMED LIVE**, fully traced this phase.
`REMEDY_AUTHORITY_ANALYSIS.md` has the recommendation. Not consolidated in
this phase, per instruction.

**P1 — NEW THIS PHASE: Maestro E2E job can report success despite internal
test failure.** `.github/workflows/ci.yml:172`:
```
"$HOME/.maestro/bin/maestro" test --format junit --output maestro-results.xml .maestro/ci/ || true
```
The `|| true` unconditionally overrides Maestro's own exit code — a
completely failing E2E run and a completely passing one are indistinguishable
to GitHub Actions' pass/fail gate for this step. Compounding this,
`dorny/test-reporter@v1` at line 183-190 is configured with
`fail-on-error: false`, so even the step that parses the JUnit results and
could fail the job on a bad report is explicitly told not to. **The "E2E
Tests (Maestro)" CI job can currently be green while every on-device
scenario in `.maestro/ci/` fails.** This is exactly the failure mode Phase
1 §7 asked this pass to check for, and it was found. Not fixed — flagged.

**P1 — `functions/`'s bare `npm test` hangs rather than passing or failing.**
`functions/package.json`'s `"test": "vitest --passWithNoTests"` has no
`--run` flag, so invoking it directly (as a contributor typing `npm test`
reasonably would) starts vitest's interactive watch mode and never exits —
confirmed by direct execution in this pass (process had to be killed after
120s; the terminal output shows `FAIL Tests failed. Watching for file
changes... press h to show help, press q to quit`). **CI itself is not
affected** — `.github/workflows/ci.yml:72` explicitly appends `-- --run`,
and `npx vitest run` was independently confirmed in this pass to **exit 1**
on the current broken suite (`judgeHorary.test.ts`), so the
`functions-quality` CI job correctly fails today, on its own, without needing
any fix from this report. This is a local-developer-experience gap, not a
CI-masking gap — listed as P1 rather than P0 for that reason, but it means
a contributor cannot locally reproduce "is `functions/` green" by running
the command the `package.json` names `test` and trusting its result.

**P2 — RKP engine logic tested once (source), not re-tested against the
deployed synced copy.** Unchanged from Phase 0.

**P2 — `classifyQuestion` exported callable has no found client caller.**
Unchanged from Phase 0; `DUPLICATE_AUTHORITY_MAP.md` confirms it wraps the
same canonical classifier, so even if reachable elsewhere it cannot diverge.

**P2 — `check:orphans` (madge) cannot fail CI by construction.** New
observation this phase, while checking §7's "hidden behind test
configuration" question: `npm run check:orphans` exits 0 (confirmed by
direct execution) regardless of what it lists — it is an advisory report,
not a gate. Its current output is expected/benign (test files and `.d.ts`
files, which madge always reports as "orphans" since nothing imports a test
file) — **this is not itself a bug**, just a fact worth recording so a
future reader does not mistake "exits 0" for "found nothing," and does not
assume this step could ever have caught a real dead-code regression.

**P3 — `useSpeechToText` test act() warnings.** Unchanged from Phase 0.

**Test reconciliation summary (Phase 1 §7, answered directly):**
1. Is `judgeHorary.test.ts` the only reason the `functions/` suite fails? —
   **Yes**, re-confirmed by full re-run this pass: `1 failed | 10 passed
   (11)`, `89 passed (89)` tests, identical to Phase 0's numbers.
2. Are any other failures hidden behind test configuration? — **None found.**
   App suite: `29 passed, 29 total` / `356 passed, 356 total`, identical to
   Phase 0. Both `tsc --noEmit` runs (app and `functions/`) clean.
3. Are tests actually executing the intended production path? — Not
   exhaustively re-verified file-by-file this pass, but the golden corpus
   itself is strong new evidence for the deterministic core: it calls the
   exact same functions in the exact same order `askWatchOracle.ts` does,
   and its results are stable, which a suite exercising a divergent/stale
   code path could not produce as cleanly.
4. Can any E2E command exit successfully despite internal test failure? —
   **Yes — see the Maestro `|| true` finding above.** This is a direct,
   sourced answer to the question as asked, not a hypothetical.

---

## I. Exact files changed in this phase (application behavior unaffected)

```
docs/audit/AUTHORITY_MATRIX.md                    new — documentation
docs/audit/REMEDY_AUTHORITY_ANALYSIS.md            new — documentation
docs/audit/DUPLICATE_AUTHORITY_MAP.md              new — documentation
docs/audit/PHASE_1_ARCHITECTURE_MAP.md             new — documentation (this file)
docs/audit/golden-corpus/index.json                new — generated fixture (manifest)
docs/audit/golden-corpus/cases/*.json (111 files)  new — generated fixtures
functions/scripts/generate-golden-corpus.ts        new — test harness scaffolding, not imported by any application file, not part of npm run build or CI
functions/scripts/replay-check.ts                  new — test harness scaffolding, same status
```

No file under `functions/src/`, `src/`, `firestore.rules`, `.github/workflows/`,
or any Firebase configuration was modified. Confirmed by `git diff` — see the
Final Report below for the exact command and output.
