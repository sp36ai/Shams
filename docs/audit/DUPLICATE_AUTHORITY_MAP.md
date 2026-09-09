# Duplicate Authority Map — Phase 1

**Method:** repo-wide search for every function capable of producing a
question type, house assignment, judgment/verdict, diagnosis, timing value,
or remedy — by function name and by call-graph, not by file location. No
consolidation performed; this is an inventory only.

## Question type / classification

| Implementation | Caller | Runtime reachability | Prod/client/test | Can it disagree with the canonical path? |
|---|---|---|---|---|
| `functions/src/engine/kp/rules/questionKeywords.ts` → `classifyQuestion()` — **canonical** | `askWatchOracle.ts:71` (`require()`) | **Live, production, server-side** | Production | — (this is the canonical path) |
| `src/astrology/kp/rules/questionKeywords.ts` → `classifyQuestion()` | No client-side runtime caller found (Phase 0 addendum §3, re-confirmed this pass) | Source-only; becomes live exclusively via `sync-engine.mjs`'s copy above | Source / build input | No — same logic, same file content (mirrored, not reimplemented) |
| `functions/src/functions/inferProfile.ts` (`SeekerProfile`: `clarity`/`comfort`/`action`/`surrender`) | `src/screens/OnboardingScreen.tsx` | Live, production, server-side (LLM-driven) | Production | **Different classification domain, not a QuestionType duplicate** — this classifies the *seeker*, not the *question*, and feeds only Path B's remedy ranking (`RankingContext.seekerProfile`), never `askWatchOracle`'s judgment. Included here for completeness since it is a classification callable, not because it competes with `classifyQuestion`. |

## House mapping

| Implementation | Caller | Runtime reachability | Prod/client/test | Can it disagree? |
|---|---|---|---|---|
| `functions/src/engine/kp/rules/houseMatrix.ts` → `HOUSE_MATRIX` — **canonical** | `engine/rkp/watchJudgment.ts`, `engine/rkp/diagnosis.ts` | Live, production, server-side | Production | — (canonical) |
| `src/astrology/kp/rules/houseMatrix.ts` → `HOUSE_MATRIX` | `src/astrology/rkp/{diagnosis,watchJudgment}.ts` (app-side jest tests exercise these directly) | Source copy; live server-side only via the sync | Source / test | No — same table, mirrored |

No second, independently-authored house-mapping table was found anywhere in
the repository.

## Judgment (verdict)

| Implementation | Caller | Runtime reachability | Prod/client/test | Can it disagree? |
|---|---|---|---|---|
| `functions/src/engine/rkp/watchJudgment.ts` → `judgeWatchChart()` — **canonical** | `askWatchOracle.ts` step 9 | Live, production, server-side | Production | — (canonical) |
| `src/astrology/rkp/watchJudgment.ts` → `judgeWatchChart()` | `src/astrology/rkp/__tests__/watchJudgment.test.ts` (jest); client production code imports only `import type { DisplayWatchVerdict }` from this module, never the function | Source copy; the function itself is not called client-side in production (confirmed: no non-type import site found under `src/` outside its own test) | Source / test | No — same algorithm, mirrored |
| `functions/src/engine/kp/judgment/__tests__/judgeHorary.test.ts` (references `judgeHorary`, a KP judgment function) | Nothing — its one import target does not exist anywhere in the repository | **Not reachable — cannot even load.** Confirmed dead (Phase 0 addendum §3, re-confirmed via `npx vitest run` in this pass — still the sole failing suite). | Test-only, and broken | N/A — cannot execute, so cannot disagree; listed for completeness since it is the historical KP judgment engine's last trace |

No live, executable second judgment implementation exists. The only "second
engine" left in the repository is unreachable dead code.

## Diagnosis

| Implementation | Caller | Runtime reachability | Prod/client/test | Can it disagree? |
|---|---|---|---|---|
| `functions/src/engine/rkp/diagnosis.ts` → `diagnose()` — **canonical** | `oracle/responseComposer.ts` step 10a | Live, production, server-side | Production | — (canonical) |
| `src/astrology/rkp/diagnosis.ts` → `diagnose()` | `src/astrology/rkp/__tests__/diagnosis.test.ts`; client production code imports only types (`RkpOutcome`, `TimingPosture`, `ImbalancePattern` — all `import type`) | Source copy; function not called client-side in production | Source / test | No — mirrored |

## Timing

No standalone "timing engine" exists separately from Judgment/Diagnosis —
timing values are fields computed inside `judgeWatchChart()`
(`WatchVerdict.timing`, from the `BASE_TIMING` table) and inside `diagnose()`
(`RkpDiagnosis.timing`, `TimingPosture`). Both are covered by the Judgment and
Diagnosis rows above; no duplicate found.

## Remedy selection

This is the one category with a **live, confirmed duplicate** — fully traced
in `REMEDY_AUTHORITY_ANALYSIS.md`. Summarized here for completeness:

| Implementation | Caller | Runtime reachability | Prod/client/test | Can it disagree with the canonical path? |
|---|---|---|---|---|
| `functions/src/oracle/remedySelection.ts` → `selectRemedyProtocol()` — deterministic, treated as canonical in this report's recommendation (not yet an owner decision) | `oracle/responseComposer.ts` step 10b | Live, production, server-side | Production | — |
| `functions/src/functions/selectRemedies.ts` (LLM callable) + `src/data/remedySelector.ts`/`rankCandidates.ts`/`remedyLibrary.ts` | `src/screens/ReadingScreen.tsx:249,317` — unconditional, on every successful reading | **Live, production**, client-orchestrated + server LLM | Production | **Yes — structurally, by disjoint library and independent input path. See `REMEDY_AUTHORITY_ANALYSIS.md` for the worked example (`business-001`).** |

## Non-findings (checked, not duplicates)

- **`dasha.ts`** (repo root) — 0 lines, empty file, no importers found. Cannot
  produce anything. Not a duplicate of `engine/kp/rules/vimshottari.ts`'s
  dasha-lord table; it is inert. Noted for completeness only.
- **`AstroVerdictCard.tsx`** (`src/data/remedyRenderer.ts` references its
  expected shape) — a display-shape name inherited from the pre-RKP
  astronomical engine, deliberately kept (per commit `18232d7`'s own message)
  so historical pre-migration readings still render in History. It renders
  data, it does not compute a verdict — not a judgment duplicate.
- **`functions/src/functions/classifyQuestion.ts`** (exported callable) — a
  thin wrapper exposing `classifyQuestion()` over the wire. Flagged in Phase 0
  as having no found client caller. It calls the **same** canonical
  `classifyQuestion()` function, not a reimplementation — so even if it is
  reachable from some untraced client path, it cannot disagree with the
  canonical classifier; it *is* the canonical classifier, exposed twice.
