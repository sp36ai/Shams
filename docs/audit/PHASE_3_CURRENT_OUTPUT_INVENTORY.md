# Phase 3 — Current Output Inventory

**Method:** traced actual runtime construction — `askWatchOracle.ts` →
`responseComposer.ts` → Firestore write → client wire type → TTS — by
reading each file in full, not by inferring fields from TypeScript names.
This is the "before" picture `ReadingContract` (§ the design doc) was built
from.

---

## The chain, in call order

```
askWatchOracle.ts
  buildWatchChart(localMoment)                 → WatchChart (full chart — not inventoried below; see note)
  classifyQuestion(question)                   → QuestionType
  judgeWatchChart(chart, qType)                → WatchVerdict
  toBoundaryPlanetName × 3                      → DisplayWatchVerdict (publicVerdict)
    ↓
  composeWatchOracleResponse({ verdict: publicVerdict, question, seekerName, motherName, readingId })
    diagnose(verdict)                           → RkpDiagnosis
    selectRemedyProtocol(diagnosis, {traditions}) → RemedyProtocol
    narrate(...) → Claude Opus 5                → NarrationFields | null
    → WatchOracleComposition (frozen, shallow)
    ↓
  readingDoc assembly → /readings/{id}.set()
  auditLogs.add()
    ↓
  response → client (WatchOracleResponse)
    ↓
  ChatBubble.tsx renders; useTextToSpeech speaks narration text verbatim
```

**Note on the full chart:** `WatchChart` (all 9 planets × sign/house/degree/
retrograde/combust/dignity, all 12 houses) is constructed and consumed
entirely inside `askWatchOracle.ts`/`watchChart.ts`/`watchJudgment.ts`. It
never reaches `responseComposer.ts`, Firestore, or the client — only its
already-reduced judgment output (`WatchVerdict`) does. It is therefore not
itemized field-by-field below: nothing downstream of the judgment step ever
sees it, so there is nothing there for a contract governing the
engine→narration boundary to represent.

---

## Field inventory

| Field | Current producer | Type | Deterministic? | User-visible? | Required for narration? | Source of truth |
|---|---|---|---|---|---|---|
| `verdict.qType` | `judgeWatchChart()` (from `classifyQuestion()`) | `QuestionType` | Yes | Indirectly (drives diagnosis text) | Yes | Engine |
| `verdict.targetHouse` | `judgeWatchChart()` | `HouseNumber` (1-12) | Yes | Yes (`RkpWatchCard`) | No (diagnosis restates it) | Engine |
| `verdict.targetSignName` | `judgeWatchChart()` | `string` | Yes | Yes | No | Engine |
| `verdict.targetRuler` / `targetRulerName` | `judgeWatchChart()`; `targetRuler` boundary-mapped in `askWatchOracle.ts` | `string` | Yes | Yes | No | Engine |
| `verdict.fulfilmentHouse` | `judgeWatchChart()` | `HouseNumber` | Yes | Yes | No | Engine |
| `verdict.lagnaRuler` | `judgeWatchChart()`; boundary-mapped in `askWatchOracle.ts` | `string` | Yes | Yes | No | Engine |
| `verdict.rulerRelation` | `judgeWatchChart()` | `Relation` | Yes | Yes | No | Engine |
| `verdict.state` | `judgeWatchChart()` | `WatchState` | Yes | Yes (mapped to `VerdictKind` for history) | No (diagnosis.outcome is what narration reads) | Engine |
| `verdict.confidence` | `judgeWatchChart()` | `Confidence` | Yes | Yes | No | Engine |
| `verdict.score` | `judgeWatchChart()` | `number` | Yes | No (internal, exposed "for auditing" per its own doc comment) | No | Engine |
| `verdict.obstruction` | `judgeWatchChart()`; boundary-mapped | `string` | Yes | Yes | Yes (diagnosis.obstructingAgent derives from it) | Engine |
| `verdict.reversal` | `judgeWatchChart()` | `'POSSIBLE' \| 'NONE'` | Yes | Yes | No | Engine |
| `verdict.timing` | `judgeWatchChart()` | `{minDays,maxDays} \| null` | Yes | Yes | Indirectly — `diagnosis.timing` is what narration actually reads | Engine |
| `verdict.direction` / `afflictedDirection` | `judgeWatchChart()` | `Direction` | Yes | Yes (`directionalFocusFor`) | No | Engine |
| `verdict.controllerProfile` | `judgeWatchChart()` | `'Assertive' \| 'Receptive'` | Yes | Yes | No | Engine |
| `verdict.factors` | `judgeWatchChart()` | `string[]` | Yes | Used as narration fallback (`askWatchOracle.ts`: `oracleResponse?.narration?.interpretation \|\| verdict.factors.join(' ')`) | Only as a fallback, never as prompt input | Engine |
| `diagnosis.outcome` | `diagnose()` | `RkpOutcome` | Yes | Yes | **Yes — the prompt's primary claim** | Engine |
| `diagnosis.primaryPattern` / `secondaryPatterns` | `diagnose()` | `ImbalancePattern` | Yes | Yes | Yes | Engine |
| `diagnosis.timingPosture` | `diagnose()` | `TimingPosture` | Yes | Yes | Yes | Engine |
| `diagnosis.confidence` | `diagnose()` | `number` (0-1) | Yes | Yes | Yes | Engine |
| `diagnosis.interventionNeeded` | `diagnose()` | `boolean` | Yes | No (not in `WatchOracleComposition`'s `diagnosis` subset — see note) | No | Engine |
| `diagnosis.obstructingAgent` | `diagnose()` | `string \| null` | Yes | Yes | Yes | Engine |
| `diagnosis.targetHouse` / `supportingHouses` / `obstructingHouses` | `diagnose()` | `number[]` | Yes | Only `targetHouse` (the other two are not in `WatchOracleComposition`) | `targetHouse`: yes | Engine |
| `diagnosis.timing` | `diagnose()` | `{minDays,maxDays}\|null` | Yes | No directly (formatted into prose by narration) | **Yes** | Engine |
| `diagnosis.rationale` | `diagnose()` | `string[]` | Yes | No (not surfaced in `WatchOracleComposition`) | **Yes — "CHART RATIONALE"** | Engine |
| `protocol.interventionRequired` | `selectRemedyProtocol()` | `boolean` | Yes | Yes | Yes | Engine |
| `protocol.guidance` | `selectRemedyProtocol()` | `string \| null` | Yes | Yes | Yes | Engine (fixed strings from the remedy module, not model prose) |
| `protocol.steps[].remedy.{id,name,category,evidenceType,intensity,duration,explanation,instructions}` | `selectRemedyProtocol()` → `REMEDY_LIBRARY` | various | Yes | Yes | `name`/`category`/`evidenceType`: yes. `explanation`/`instructions`/`duration`: not read by `buildUserPrompt` today (only by the client card) | Engine (library-bound) |
| `protocol.steps[].reason` | `selectRemedyProtocol()` | `string` | Yes | No (dropped from the public `OracleProtocolStep` shape — see note) | **Yes — the remedy-line justification** | Engine |
| `protocol.rationale` | `selectRemedyProtocol()` | `string[]` | Yes | No | No (not read by `buildUserPrompt`) | Engine |
| `question` (raw seeker text) | Client input, `askWatchOracle` request | `string` | No — user input | Yes (own bubble) | Yes, sanitized at point of use | **User**, not engine |
| `seekerName` / `motherName` | Client input | `string \| undefined` | No — user input | No (used only in the prompt's `SEEKER_NAME`/`MOTHER_NAME` lines) | Yes | **User** |
| `narration.{rkp_finding,interpretation,recommended_approach,why_this_remedy,signature}` | Claude Opus 5, via `narrate()` | `string` | **No — LLM** | Yes | N/A (this IS the narration output) | **AI**, structurally bounded (see responseComposer.ts's own header) |
| `brandSeal` | Fixed constant `ORACLE_BRAND_SEAL` | `string` | Yes (constant) | Yes | No | Code constant, never model-written |
| `suggestedQuestions` | `selectSuggestedQuestions(diagnosis)` | `string[]` | Yes | Yes | No | Engine (deterministic, keyed off diagnosis) |
| `readingId` | `readingRef.id` (Firestore doc id, `askWatchOracle.ts`) | `string` | No — random | For correlation only | No | Server (Admin SDK id generation) |
| `computedAt` / `localMoment` | Server `Date.now()` + client-asserted UTC offset | `string` (ISO) | No — real time | Yes | No | Server (`instant`), offset from **client** |
| `engineVersion` | `ENGINE_VERSION` constant | `string` | Yes (constant) | No (audit log + `ReadingDoc`, not shown in UI) | No | Code constant |

**Note on `WatchOracleComposition`'s narrowed `diagnosis`/`protocol` subsets:**
the public composition object does **not** carry every field the internal
`RkpDiagnosis`/`RemedyProtocol` objects have — `interventionNeeded`,
`supportingHouses`, `obstructingHouses`, and `protocol.steps[].reason` are
computed by the engine but were, before this phase, either dropped entirely
(`reason`) or never assembled into any outward-facing shape at all
(`interventionNeeded`, the two house arrays). This is exactly the kind of
gap Phase 3's brief anticipated ("If a value is currently produced by more
than one authority... STOP and document it" — this is not that; it is a
single-authority value that was simply not being carried through
completely). `ReadingContract` closes the `reason` gap (§B of the design
doc) because `buildUserPrompt` needs it; `interventionNeeded`,
`supportingHouses`, and `obstructingHouses` are deliberately still not
carried into the contract, since nothing downstream of the engine currently
reads them — see the design doc's own scoping note.

## Firestore (`ReadingDoc`) fields relevant to this inventory

| Field | Populated from | Notes |
|---|---|---|
| `verdict` | `STATE_TO_VERDICT[verdict.state]` | A coarse `VerdictKind` mapping (YES/NO/CONDITIONAL/DELAYED/UNCLEAR), not the raw `WatchState` |
| `confidence` | `CONFIDENCE_NUMERIC[verdict.confidence]` | Coarse band → number mapping |
| `narration` | `oracleResponse?.narration?.interpretation \|\| verdict.factors.join(' ')`, duplicated into `en`/`ur`/`hi` | Same English text under all three language keys today — a pre-existing characteristic, not something this phase changed |
| `reasoning` | `verdict.factors.map(...)` | Not `diagnosis.rationale` — the Firestore `reasoning` array is built from the verdict's own factors, a different (also engine-sourced) list |
| `remedy` | `null` always | `ReadingDoc.remedy` carries the legacy astronomical path's shape; the watch protocol lives entirely under `watchOracle` |
| `watchOracle` | `oracleResponse` (the full `WatchOracleComposition`) when synthesis ran | This is how `contractFingerprint` (new this phase) reaches Firestore — see the design doc §I |
| `engineVersion` | `ENGINE_VERSION` | Added in Phase 2B |

## Client / TTS

- `src/firebase/watchOracle.ts`'s `WatchOracleResponse`/`WatchReading` types
  mirror the server's response shape (hand-authored, confirmed by reading —
  not generated from the server type).
- `ChatBubble.tsx` renders `reading.oracle.narration` fields and passes the
  same text to `useTextToSpeech`'s `speak()` — TTS receives exactly the
  composed narration string, nothing else, confirmed in Phase 0/1/2B and
  re-confirmed this phase (no new call site touches TTS).
- No client code reconstructs a verdict, diagnosis, or remedy from prose —
  every card (`RkpWatchCard`, `RemedyProtocolCard`) renders structured
  fields already on the response object.
