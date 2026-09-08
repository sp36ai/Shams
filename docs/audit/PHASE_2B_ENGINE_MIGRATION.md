# Phase 2B — Engine Purification & Single Authority

**Repository:** sp36ai/Shams
**Scope:** eliminate the one confirmed duplicate authority (remedy
selection); document the canonical engine boundary; confirm engine
versioning. **No judgment rule, timing rule, or diagnosis logic was
changed. `kp/rules/*` files were not moved, renamed, or deleted. The safety
validator was not touched.** The 111-case golden corpus is byte-identical
before and after every change in this phase.

---

## Two scope decisions made before touching anything, and why

### Decision 1 — no physical file moves for `kp/` or the engine tree

The Phase 2B brief allows moving files toward a `functions/src/engine/watch/`
layout, but is explicit that "architecture matters more than folder
aesthetics" and warns against moving files "merely for cosmetic cleanup."
Phase 1's `DUPLICATE_AUTHORITY_MAP.md` already established, by tracing
actual callers rather than directory names, that **every responsibility
except remedy selection already has exactly one live implementation** —
question resolution, chart construction, house mapping, judgment, timing,
and diagnosis. There is no duplicate authority under `functions/src/engine/`
or `functions/src/engine/kp/` to eliminate by moving files; the `kp/`
directory name is the only thing about those paths that reads as legacy, and
Phase 1's own table proved their *content* is legitimate, live, shared
primitives.

Physically moving them would mean editing `sync-engine.mjs`'s path-rewrite
logic, `tsconfig.json`, `.eslintrc.js`, and every import site in both
`src/astrology/` and its generated mirror `functions/src/engine/` — real
risk (a missed import, a broken alias) for zero reduction in duplicate
authority, since there was none to remove there. This report treats
"establish a documented canonical boundary" (allowed to differ from a
physical move, per the brief's own words: "Exact file organization may
differ if moving files would create unnecessary risk") as satisfied by §B
below — a precise, evidence-based statement of what is canonical and why,
without moving a single engine file.

### Decision 2 — remedy migration: disconnect the decision, do not force-fit the content

The remedy library taxonomies do not line up. Checked directly, not assumed:
Path A's `ImbalancePattern` vocabulary (`functions/src/engine/rkp/diagnosis.ts`)
and Path B's `RemedyTag` vocabulary (`src/data/remedyLibrary.ts`) overlap on
exactly 4 of 18 terms (`OBSTRUCTION`, `ATTACHMENT`, `HASTE`, `CONFLICT`).
Mapping the other 14 Path B tags (`DELAY`, `STAGNATION`, `RESTLESSNESS`,
`ANXIETY`, `DISTRACTION`, `ESTRANGEMENT`, `SPIRITUAL_NEGLECT`, `DOUBT`,
`GRIEF`, `SUPPRESSION`, `PRIDE`, `MATERIAL_ANXIETY`, `ABUNDANCE`) onto Path
A's 11-term vocabulary (`OBSTRUCTION`, `UNCERTAINTY`, `CONFLICT`,
`INSTABILITY`, `ATTACHMENT`, `HASTE`, `POOR_TIMING`, `EXTERNAL_OPPOSITION`,
`NEEDS_PATIENCE`, `NEEDS_DECISIVE_ACTION`, `FAVOURABLE_FLOW`) would mean
inventing semantic correspondences (is `GRIEF` closer to `UNCERTAINTY` or to
nothing at all? is `PRIDE` an `ImbalancePattern` this system even has room
for?) that no evidence in this repository settles. That is content/product
design work, not engineering, and the brief itself warns against exactly
this failure mode ("Do not solve the remedy duplication by simply deleting
Path B," and separately, do not let the AI "pick whichever sounds better" —
the same caution applies to an engineer inventing a semantic mapping without
a spec).

So: **the decision authority was removed (Path B's LLM no longer selects
anything, and nothing else selects on its behalf); the unique library
content was not migrated, and this is disclosed, not silently dropped** —
see §E for the exact reasoning and what remains open.

---

## A. Regression gate — frozen baseline, confirmed before any change

Ran the Phase 2A-committed golden corpus generator and replay script before
touching any file:

- 111-case regeneration vs. the Phase 2A-committed baseline: **byte-identical**
  (`diff -rq` → zero differences; `git status` on
  `docs/audit/golden-corpus/` → clean).
- 24-case in-process replay: **24/24 identical.**

Baseline was not unexpectedly different from Phase 2A. Proceeded.

---

## B. Canonical Watch engine boundary (documented, not physically moved)

| Responsibility | Canonical implementation | Why this one |
|---|---|---|
| Question resolution | `functions/src/engine/kp/rules/questionKeywords.ts` → `classifyQuestion()` | Sole implementation reachable from `askWatchOracle` (Phase 1 `AUTHORITY_MATRIX.md`, re-confirmed this phase: unchanged) |
| Chart construction | `functions/src/engine/rkp/watchChart.ts` → `buildWatchChart()` (built on `engine/primitives/chartBuilder.ts`) | Sole implementation; `location` param confirmed inert |
| House mapping | `functions/src/engine/kp/rules/houseMatrix.ts` → `HOUSE_MATRIX` | Sole table |
| Judgment | `functions/src/engine/rkp/watchJudgment.ts` → `judgeWatchChart()` | Sole implementation |
| Timing | Inside `judgeWatchChart()` (`WatchVerdict.timing`) and `diagnose()` (`RkpDiagnosis.timing`/`TimingPosture`) | No separate timing engine exists to be canonical over |
| Diagnosis | `functions/src/engine/rkp/diagnosis.ts` → `diagnose()` | Sole implementation |
| Remedy | `functions/src/oracle/remedySelection.ts` → `selectRemedyProtocol()`, drawing from `functions/src/oracle/remedyLibrary.ts` | **As of this phase — sole implementation, Path B disconnected (§C-E)** |

`functions/src/engine/kp/rules/{nakshatras,vimshottari}.ts` and
`engine/primitives/subLord.ts` remain exactly where Phase 1 found them:
shared astronomical primitives consumed by chart construction, not owned by
any single responsibility above. No file in this table moved.

---

## C. Duplicate authority — resolved

Per `DUPLICATE_AUTHORITY_MAP.md`, remedy selection was the one row with two
live implementations. As of this phase: **one.** Full trace of the removal
in §D-E. Every other responsibility in the table above was already single-
authority in Phase 1 and remains so — nothing else required a callers-migrate-
then-delete cycle this phase.

---

## D. What was actually changed (remedy migration)

**Disconnected** (call sites removed — the decision-making stops here):

- `src/screens/ReadingScreen.tsx` — removed `runGuidanceSelection()` in
  full (the function, its call site inside `runAsk()`, and its two imports
  `selectRemedies`/`watchVerdictToRankingContext`), and the now-unused
  `speakableTextFor`/`WatchReading`-type imports it was the last user of.
- `src/components/oracle/ChatBubble.tsx` — removed the `GuidanceCard` import
  and its conditional render branch (`{message.selectedRemedies !== undefined
  && <GuidanceCard .../>}`). `RemedyProtocolCard` (Path A's own card) is
  untouched and is now the reading's sole remedy presentation.
- `src/stores/readingThreadsStore.ts` — removed the `selectedRemedies` field
  from `ReadingMessage` and its now-unused `RenderedRemedy` type import.
  MMKV is untyped JSON, so a `selectedRemedies` key already stored on an
  existing user's device from before this change is simply ignored now, not
  corrupted.
- `src/data/watchRemedyContext.ts` — removed `watchVerdictToRankingContext()`
  and everything it alone depended on (`classificationOf`, `severityOf`,
  `spiritualStateOf`, `OBSTRUCTION_THEMES`, `STATE_THEMES`) — its one caller
  was `ReadingScreen.tsx`, removed above. **`directionalFocusFor()` and
  `PHYSICAL_CORRESPONDENCE` were kept, unchanged** — a separate, still-live
  feature (`ChatBubble.tsx:271`'s `directionalFocus` prop on `RkpWatchCard`)
  this phase confirmed has nothing to do with remedy selection and was never
  part of Path B.
- `functions/src/index.ts` — removed `export { selectRemedies } from
  './functions/selectRemedies'`. This is the operative fix, not just the
  client-side one: the next deploy stops shipping this callable at all.
- `functions/src/functions/askWatchOracle.ts` / `functions/src/types.ts` —
  unrelated to the remedy migration; see §F (versioning).

**Test changes** (to match the above, not to hide a regression):

- `src/screens/__tests__/ReadingScreen.test.tsx` — removed the two tests
  that asserted the now-removed guidance pipeline's behavior ("runs the
  guidance pipeline after a successful reading and attaches the remedies",
  "still shows the verdict when the guidance selection fails"). Every other
  test in this file, including the reading-success and reading-failure
  paths those two tests' names might suggest overlap with, is untouched and
  still passes.
- `src/data/__tests__/watchRemedyContext.test.ts` — rewritten to keep only
  the "directional focus" tests (the surviving function); the classification/
  severity/themes/spiritual-state/end-to-end blocks, which tested
  `watchVerdictToRankingContext`, were removed along with the function.
- `src/data/__tests__/remedySelector.test.ts` and
  `src/data/__tests__/rankCandidates.test.ts` were **not modified** — they
  test `src/data/remedySelector.ts`/`rankCandidates.ts` in isolation, and
  those modules were not deleted (see §E), so their own internal correctness
  is still real and worth still proving. They still pass.

**Deprecation headers added, files retained** (see §E for why deletion did
not happen): `src/components/oracle/GuidanceCard.tsx`,
`src/data/remedySelector.ts`, `src/data/rankCandidates.ts`,
`src/data/remedyLibrary.ts` (client), `src/data/remedyRenderer.ts`,
`functions/src/functions/selectRemedies.ts` — each now carries a header
stating plainly it is disconnected, has zero production callers, and names
this document.

**Nothing else was touched.** `functions/src/oracle/remedySelection.ts` and
`functions/src/oracle/remedyLibrary.ts` (Path A, the canonical
implementation) are byte-for-byte unmodified — confirmed by `git diff`
showing no changes to either file, and by the golden corpus's remedy fields
being identical before and after (§H).

---

## E. Unresolved — proof-of-unreachability was completed; deletion was not

Per the brief's own cleanup rule (§10: "Only delete an obsolete
implementation after proving zero production imports, zero dynamic
references, zero runtime callers... Then delete it"), this phase completed
the proof for each of the following and confirmed zero remaining runtime
callers:

- `src/components/oracle/GuidanceCard.tsx` — only ever imported by
  `ChatBubble.tsx`, which no longer imports it.
- `src/data/remedySelector.ts` — only ever imported by `ReadingScreen.tsx`
  (removed) and its own test (kept, tests it in isolation).
- `src/data/rankCandidates.ts` — only ever imported by `remedySelector.ts`
  and `watchRemedyContext.ts` (the latter's use removed with
  `watchVerdictToRankingContext`).
- `src/data/remedyLibrary.ts` (client) — only ever imported by
  `rankCandidates.ts` and `remedyRenderer.ts`.
- `src/data/remedyRenderer.ts` — only ever imported (as a value, not just a
  type) by `remedySelector.ts`; its `RenderedRemedy` type's other import
  site (`readingThreadsStore.ts`) was removed with the `selectedRemedies`
  field.
- `functions/src/functions/selectRemedies.ts` — no longer exported from
  `index.ts`; will not be deployed on the next `firebase deploy`.

**These files were not deleted.** This session's file-deletion actions
(`git rm`/`rm` on each of the above) were declined by this environment's own
tooling policy during this phase — not a judgment call this report made
about whether deletion was warranted. The proof of unreachability stands
regardless; only the mechanical removal did not happen. This is reported
plainly rather than worked around, per the standing practice this whole
audit has followed: don't quietly route around a boundary, name it and stop.
**Recommended next step, requiring no further design decision, only the
mechanical action:** delete the six files named above, then re-run a
repository-wide search for their symbols and import paths to confirm no
straggler reference remains, exactly as §10 specifies.

**The content-migration question (§ "Decision 2" above) remains genuinely
open** and is a product/content decision, not an engineering one: does the
"seeker-tailored devotional suggestion" Path B provided need to survive in
some form, and if so, under what taxonomy? `REMEDY_MIGRATION_PLAN.md`'s
three options (clean retirement / fold into Path A / re-scope to prose-only)
are still live options; this phase picked none of them, because doing so
would mean answering a product question this engineering pass is not
positioned to answer on its own evidence.

---

## F. Engine versioning

**Already existed, verified rather than invented:** `ENGINE_VERSION =
'2.0.0-moshier'` (`functions/src/engine/primitives/chartBuilder.ts:64`,
mirrored at `src/astrology/primitives/chartBuilder.ts:64` by
`sync-engine.mjs`) was already recorded on every `AuditLogDoc` entry
(`askWatchOracle.ts`'s audit-log write, unchanged this phase). The Phase 2B
brief's instruction — "introduce ... only if it can be done without changing
judgment semantics ... use a repository-controlled version constant" — is
already satisfied by this constant; a second, redundant `WATCH_ENGINE_VERSION`
was deliberately not introduced, since that would just be two names for one
fact.

**One real gap closed:** `ENGINE_VERSION` was recorded only on the audit log
(`/auditLogs`), not on the reading document itself (`/readings/{id}`) — so
tracing "which engine version produced this reading" required first finding
that reading's audit-log entry, an extra hop a support investigation
shouldn't need. Added `engineVersion?: string` to `ReadingDoc`
(`functions/src/types.ts`) and set it on every write
(`askWatchOracle.ts`'s `readingDoc` assembly). Purely additive Firestore
field — no judgment semantics, no change to any computed value, confirmed by
the unchanged golden corpus (§H) and by `git diff` showing this as the only
change to either file beyond the remedy-migration edits already covered in
§D.

---

## G. Client boundary — reconfirmed unchanged

The client remains a presentation consumer throughout this migration:
`ReadingScreen.tsx`'s edits removed a client-orchestrated *decision* (which
remedy to show), not added one; every remaining client file touched
(`ChatBubble.tsx`, `readingThreadsStore.ts`, `watchRemedyContext.ts`) only
renders or stores what the server already decided. No engine logic moved
into the client. `SkyClockScreen.tsx` (Phase 0's confirmed "live display,
not judgment" exception) was not touched this phase.

---

## H. Regression results after each migration step

Per the brief's "do not wait until the end" instruction, the golden corpus
and full test matrix were run after the remedy-disconnection edits and again
after the versioning edit (§F), not just once at the end:

| Checkpoint | 111-case corpus | 24-case replay | functions vitest | app jest | functions tsc | app tsc | functions lint | app lint |
|---|---|---|---|---|---|---|---|---|
| Before any Phase 2B change (frozen baseline, §A) | byte-identical to Phase 2A | 24/24 | 89/89 | 356/356 (Phase 2A count, before Phase 2B's own test edits) | clean | clean | clean | clean |
| After remedy-disconnection edits (§D) | byte-identical | 24/24 | 89/89 | 340/340 (356 minus the 16 removed guidance/ranking-context tests, all deliberate — see §D) | clean | clean | clean | clean |
| After versioning edit (§F) | byte-identical | 24/24 | 89/89 | 340/340 | clean | clean | clean | clean |

**No deterministic result changed at any point. No STOP condition was
triggered.** The app test count changing from 356 to 340 is not a
regression — it is the exact, accounted-for removal of tests for the
functionality this phase removed, itemized in §D, not a silent drop in
coverage elsewhere (every other suite passed before and after, unchanged).

---

## I. Final acceptance criteria — status

| Criterion | Status |
|---|---|
| ONE canonical Watch authority | **Met** — §B |
| ONE deterministic question-resolution authority | **Met** — unchanged from Phase 1, re-confirmed |
| ONE deterministic house-mapping authority | **Met** — unchanged, re-confirmed |
| ONE deterministic judgment authority | **Met** — unchanged, re-confirmed |
| ONE deterministic timing authority | **Met** — unchanged, re-confirmed |
| ONE deterministic diagnosis authority | **Met** — unchanged, re-confirmed |
| ONE authoritative deterministic remedy result | **Met** — Path B disconnected, §D |
| No legacy judgment engine remains reachable | **Met** — unchanged from Phase 0/1 (`judgeHorary` chain fully gone since Phase 2A) |
| Only legitimate shared primitives remain under `kp/`, role documented | **Met** — §B; nothing moved, nothing needed to be |
| No client-side judgment authority | **Met** — §G |
| AI remains downstream | **Met** — narration path untouched; Path B's AI decision authority removed rather than modified |
| 111/111 golden cases identical | **Met** — §A, §H |
| 24/24 replay identical | **Met** — §A, §H |
| Functions/app/typecheck/lint clean | **Met** — §H |
| Documentation reflects resulting architecture | **Met** — `AUTHORITY_MATRIX.md` updated this phase |

**Partially open at the time this section was first written:** the six
deprecated files (§E) were proven unreachable but not physically deleted,
due to a tooling restriction encountered in that session. **Resolved below
— Phase 2B-F.**

---

## STOP (original)

This concluded the initial Phase 2B pass. The safety validator was not
implemented. Oracle narration was not redesigned. No Phase 3/4 work was
started.

---

## J. Phase 2B-F — Orphan Cleanup & Final Authority Verification

Completion gate for Phase 2B, addressing the one item §E left open: the six
files proven unreachable but not deleted. This section is additive; nothing
above was rewritten.

### J.1 — Independent re-verification before deleting anything

Before deleting, re-ran the reachability proof from scratch (not reused from
§E) against the exact paths named there:

| File | Real (non-comment) importers found | Config/script/CI/dynamic-import references |
|---|---|---|
| `src/components/oracle/GuidanceCard.tsx` | **None** | None |
| `src/data/remedySelector.ts` | **None** (its own test file's import — see below — was the only one) | None |
| `src/data/rankCandidates.ts` | **None** outside `remedySelector.ts` and its own test | None |
| `src/data/remedyLibrary.ts` (client) | **None** outside `rankCandidates.ts`/`remedyRenderer.ts` (both themselves orphaned) | None |
| `src/data/remedyRenderer.ts` | **None** outside `GuidanceCard.tsx`, `remedySelector.ts`, and `remedySelector.test.ts` | None |
| `functions/src/functions/selectRemedies.ts` | **None** — zero occurrences of the string `selectRemedies` as a real import or the callable name `'selectRemedies'` anywhere outside the file itself and comments | Not exported from `index.ts` (removed in §D); zero references in `package.json`, `functions/package.json`, `metro.config.js`, `babel.config.js`, `tsconfig.json`, `functions/tsconfig.json`, `jest.setup.js`, `react-native.config.js`, `.github/workflows/*`, or `functions/scripts/`/`scripts/` |

Distinguished real imports (`^import`/`from '...'`) from comment-only
mentions throughout — several files (`ChatBubble.tsx`, `ReadingScreen.tsx`,
`watchRemedyContext.ts`, `functions/src/index.ts`, `dailyDhikr.ts`)
mentioned these names only in prose explaining the Phase 2B disconnection,
not as live dependencies; each was checked individually. Also searched for
dynamic `import()`/`require()` patterns and double-quoted import variants —
none found. No live dependency remained on any of the six files.

**One additional, necessary finding:** `src/data/remedySelector.ts` and
`src/data/rankCandidates.ts` each had exactly one real remaining importer —
their own test files, `src/data/__tests__/remedySelector.test.ts` and
`src/data/__tests__/rankCandidates.test.ts`, which Phase 2B had deliberately
left in place because the modules they tested still existed. Deleting the
modules makes these two test files reference nothing; they were deleted
alongside their subjects (§J.2) as a direct, necessary consequence, not a
separate cleanup decision.

### J.2 — Files deleted (all six proven-orphaned files, plus their now-obsolete tests)

```
src/components/oracle/GuidanceCard.tsx
src/data/remedySelector.ts
src/data/rankCandidates.ts
src/data/remedyLibrary.ts
src/data/remedyRenderer.ts
functions/src/functions/selectRemedies.ts
src/data/__tests__/remedySelector.test.ts       (tested only the deleted remedySelector.ts)
src/data/__tests__/rankCandidates.test.ts       (tested only the deleted rankCandidates.ts)
```

**Not deleted, verified untouched:** any `kp/rules/*` file, any Watch engine
file, `functions/src/oracle/remedySelection.ts`,
`functions/src/oracle/remedyLibrary.ts` (Path A, canonical),
`functions/src/oracle/responseComposer.ts`, any file related to the
historical safety validator, and every other file not explicitly named
above — confirmed by `git diff --stat` against
`functions/src/engine/{kp,rkp}`, `functions/src/oracle/{remedySelection,remedyLibrary}.ts`,
and `src/astrology/` showing zero changes.

### J.3 — Stale references removed (not general documentation cleanup)

After deletion, re-searched the repository for the six files' names and
exported symbols. Found and corrected five comments that had described these
files as "retained on disk" / "deprecated, not deleted" — true when written
in Phase 2B, false after this cleanup:

- `src/components/oracle/ChatBubble.tsx` — updated to state the component
  was deleted, not merely disconnected.
- `src/screens/ReadingScreen.tsx` — updated the Phase 2B note's file list to
  state deletion rather than retention.
- `src/data/watchRemedyContext.ts` — updated its header note, which had
  explicitly called `remedySelector.ts`/`rankCandidates.ts` "*retained*
  files."
- `functions/src/index.ts` — updated the `selectRemedies` export-removal
  comment from "retained on disk" to "deleted outright."
- `src/data/dailyDhikr.ts` — its cross-reference to `data/remedySelector.ts`
  (now nonexistent) was repointed to the actual canonical remedy
  implementation, `functions/src/oracle/remedySelection.ts`.

No other documentation was rewritten — this was a targeted correction of
comments made factually false by the deletion, not a general pass.

### J.4 — Test matrix (post-deletion)

| Check | Result |
|---|---|
| App jest | **27 suites, 304 tests, all passing** (was 29/340 before this cleanup; the two deleted test files accounted for exactly 6 + 30 = 36 tests — confirmed by counting `it(` blocks in each file before deletion) |
| App typecheck | Clean |
| App lint | Clean |
| App `check:orphans` | Unchanged in kind — only test files and `.d.ts` files listed, as before; no new production-code orphan introduced by this cleanup |
| Functions vitest | **10 files, 89 tests, all passing — unchanged** |
| Functions typecheck | Clean |
| Functions lint | Clean |
| 111-case golden corpus | **Byte-identical** to the Phase 2A/2B baseline (`diff -rq` → zero differences) |
| 24-case in-process replay | **24/24 identical** |

No deterministic result changed. No STOP condition triggered.

### J.5 — Final authority search

- **Remedy authority:** `grep`-confirmed exactly one call site for
  `selectRemedyProtocol(` in the entire repository
  (`oracle/responseComposer.ts:253`); zero occurrences of `SELECTION_PROMPT`
  or `generateDescription` (Path B's LLM-prompt functions) anywhere.
- **Client boundary:** the only client-side `judgeWatchChart`/`diagnose`
  function definitions are in `src/astrology/rkp/` — the *source* tree
  `sync-engine.mjs` mirrors into `functions/src/engine/rkp/`, not a runtime
  call site (established in Phase 0/1, re-confirmed here: no non-type
  import of either function exists under `src/` outside that source tree
  and its own tests).
- **Legacy Path B:** zero occurrences of the string `selectRemedies` as an
  import or callable name anywhere in the repository (comments aside).
- **KP:** zero occurrences of `judgeHorary` anywhere in the repository —
  confirmed still gone, not reintroduced; `git diff` against every
  `kp/rules/*` path shows no change this phase or the prior one.

### J.6 — Unresolved

**Remedy content-migration question — still open, unchanged from §E,
correctly not decided here.** Path B's unique library content
(`src/data/remedyLibrary.ts`, now deleted but recoverable from git history
at this commit's parent if ever needed) was not migrated into Path A's
canonical library, for the reason given in §E/"Decision 2": the two
taxonomies overlap on only 4 of 18 tags, and forcing the rest would mean
inventing product semantics. This remains a genuine open decision for the
project owner, to be made deliberately in its own pass — not folded into
either this cleanup or the upcoming safety/narration work.

---

## STOP

Phase 2B, including its 2B-F completion gate, concludes here. The safety
validator was not implemented. Oracle narration was not redesigned. No
Phase 3/4 work was started. Awaiting review.
