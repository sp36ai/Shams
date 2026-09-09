# Authority Matrix — Phase 1 (updated in Phase 2B)

**Scope:** documentation only. Produced by tracing actual callers (imports,
`require()` sites, exported-function call graphs) from `functions/src/index.ts`
and the client screens down to the leaf modules that do the work — not by
directory naming. Every "Runtime entry point" cell below was independently
confirmed in this pass by grep/read, not carried over from Phase 0 by
assertion alone (Phase 0's findings were used as a starting map, not as proof).

**Phase 2B update:** the Remedy selection row below is updated to reflect
that Path B was disconnected in Phase 2B — see
`docs/audit/PHASE_2B_ENGINE_MIGRATION.md` for the full migration record.
Every other row is unchanged from Phase 1: no other responsibility had more
than one implementation, so Phase 2B made no other change to this matrix.

| Responsibility | Current implementation | Runtime entry point | Authoritative? | Consumer(s) | Phase 2 action |
|---|---|---|---|---|---|
| Question resolution (classification) | `functions/src/engine/kp/rules/questionKeywords.ts` → `classifyQuestion()` | `functions/src/functions/askWatchOracle.ts:71` — direct `require()`, step 7 of the callable | **Yes — sole path.** No other function computes `QuestionType` on the live reading path. | `engine/rkp/watchJudgment.ts` (routes on `qType`), `engine/rkp/diagnosis.ts`, `oracle/remedySelection.ts`, `oracle/suggestedQuestions.ts`, `oracle/remedyLibrary.ts` | None proposed — leave in place |
| Chart construction (watch frame) | `functions/src/engine/rkp/watchChart.ts` → `buildWatchChart()`, itself calling `engine/primitives/chartBuilder.ts` → `buildChart()` for real planetary positions | `askWatchOracle.ts` step 6, called with `localMoment` (server instant + client-asserted UTC offset) | **Yes — sole path.** `location` param accepted but does not affect output (own doc comment, confirmed by reading `watchChart.ts:95-101`) — see the golden-corpus generator's explicit note on this. | `engine/rkp/watchJudgment.ts`, `src/screens/SkyClockScreen.tsx` (client — reads chart primitives for live display only, never judgment; see Phase 0 §B) | None proposed |
| House mapping | `functions/src/engine/kp/rules/houseMatrix.ts` → `HOUSE_MATRIX` (question-type → primary/supporting/obstructing house lookup table) | Read directly inside `engine/rkp/watchJudgment.ts` and `engine/rkp/diagnosis.ts` | **Yes — sole table.** Confirmed one definition, no client-side equivalent computes house routing independently (client's copy under `src/astrology/kp/rules/houseMatrix.ts` is the *source*, mirrored by `sync-engine.mjs` into the copy above — same data, not a second authority; see Phase 0 addendum §E.1) | `watchJudgment.ts`, `diagnosis.ts` | None proposed |
| Judgment (verdict) | `functions/src/engine/rkp/watchJudgment.ts` → `judgeWatchChart()` | `askWatchOracle.ts` step 9 | **Yes — sole path.** No client-reachable equivalent; client imports only `import type` from this module (Phase 0 §B, re-confirmed this pass: no runtime call site under `src/` for `judgeWatchChart`). | `oracle/responseComposer.ts` (via `diagnose()`), `functions/askWatchOracle.ts` (assembles response + reading doc) | None proposed |
| Diagnosis | `functions/src/engine/rkp/diagnosis.ts` → `diagnose()` | Called inside `oracle/responseComposer.ts`'s `composeWatchOracleResponse()`, step 10a of the callable | **Yes — sole path.** Deterministic, takes the settled `DisplayWatchVerdict` and nothing else. | `oracle/remedySelection.ts` (`selectRemedyProtocol(diagnosis, ...)`), `oracle/responseComposer.ts`'s prompt builder (facts only, never revised) | None proposed |
| Timing | Computed inside `diagnose()` (`RkpDiagnosis.timing`) and inside `judgeWatchChart()` (`WatchVerdict.timing`, from the `BASE_TIMING` table in `watchJudgment.ts`) | Same call sites as Judgment/Diagnosis above | **Yes — sole path.** No separate timing engine found; `TimingPosture` (`ACT_NOW`/`ACT_SOON`/`WAIT`/`WAIT_LONG`/`UNKNOWN`) is derived inside `diagnose()` from the verdict's own `timing`/`state`/`confidence`, not recomputed elsewhere. | `oracle/responseComposer.ts` prompt (`formatTiming`), client `RemedyProtocolCard.tsx` (`diagnosis.timingPosture` display) | None proposed |
| Remedy selection | **ONE mechanism as of Phase 2B.** `functions/src/oracle/remedySelection.ts` → `selectRemedyProtocol()`, deterministic, library-bound (`oracle/remedyLibrary.ts`) — unchanged throughout Phase 2B, still produces byte-identical output on the 111-case golden corpus. Path B (`functions/src/functions/selectRemedies.ts`, an LLM callable, fed by client-side `src/data/remedySelector.ts`/`rankCandidates.ts` drawing from a second library `src/data/remedyLibrary.ts`) was **disconnected** in Phase 2B: its call site was removed from `src/screens/ReadingScreen.tsx`, its export removed from `functions/src/index.ts`. Its implementation files remain on disk, marked deprecated, not deleted — see `docs/audit/PHASE_2B_ENGINE_MIGRATION.md`'s Unresolved section for why. | `oracle/responseComposer.ts` step 10b, inside `askWatchOracle` — sole path. | **Yes — sole path, as of Phase 2B.** Path B is unreachable: zero client call sites, zero server export. | `RemedyProtocolCard.tsx` — sole rendering consumer as of Phase 2B (`GuidanceCard.tsx` still exists on disk but nothing calls it — see the migration doc). | Content migration of Path B's unique library entries was evaluated and explicitly deferred — see `REMEDY_MIGRATION_PLAN.md`/`PHASE_2B_ENGINE_MIGRATION.md` for why forcing it now would mean inventing semantics no evidence settles. |
| Oracle narration | `functions/src/oracle/responseComposer.ts` → `narrate()`, calling Claude Opus 5 via `prompts/watchOracleSynthesisPrompt.ts` | `askWatchOracle.ts` step 10c | **No — explicitly not authoritative over fact.** Prose only, structurally bounded to `NarrationFields`; remedy names/instructions are copied verbatim from the library after the model returns (Phase 0 §C, re-confirmed this pass — no change to `responseComposer.ts` since Phase 0). AI safety re-check is **absent** (Phase 0 addendum §1). | `ChatBubble.tsx` narration text, `useTextToSpeech` (speaks it verbatim) | None proposed (out of Phase 1's fix scope) |
| TTS | `src/hooks/useTextToSpeech.ts`, wrapping `react-native-tts` | `ChatBubble.tsx` play/pause control | **No — pure presentation.** Speaks whatever string it is given; on-device, no network call, generates nothing (Phase 0 §B, re-confirmed: file re-read in full this pass, no new call sites found). | End user (audio) | None proposed |

## Note on how "authoritative" was determined

A module was marked authoritative for a responsibility only if (a) it is the
sole implementation reachable from `askWatchOracle`'s live call chain, or (b)
where more than one implementation is reachable, both are named explicitly and
neither is asserted as "the" authority. Remedy selection was the one row that
did not resolve to a single answer in Phase 1 — it does now, as of Phase 2B
(see `PHASE_2B_ENGINE_MIGRATION.md`): every responsibility in this matrix has
exactly one live, reachable, authoritative implementation.

No cell above treats a `kp/`-named path as non-authoritative on the strength of
its directory name — `houseMatrix.ts` lives under `kp/rules/` and is still
marked the sole, authoritative table, because its importers prove it is.
