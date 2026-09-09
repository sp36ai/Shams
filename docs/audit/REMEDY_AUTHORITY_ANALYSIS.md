# Remedy Authority Analysis — Phase 1

**Status:** Investigation and recommendation only. No code changed. No decision
enacted — Path A and Path B are both still live, unmodified, and running
exactly as before this document was written.

---

## Path A — `functions/src/oracle/remedyLibrary.ts` + `remedySelection.ts`

| Question | Answer | Evidence |
|---|---|---|
| Where are remedies selected? | `functions/src/oracle/remedySelection.ts` → `selectRemedyProtocol(diagnosis, options)` | Called from `oracle/responseComposer.ts`'s `composeWatchOracleResponse()`, itself called from `askWatchOracle.ts` step 10b |
| What input does it receive? | The settled `RkpDiagnosis` object (`outcome`, `primaryPattern`, `secondaryPatterns`, `timingPosture`, `confidence`, `qType`, `obstructingAgent`, etc.) plus an optional `traditions` filter (defaults to `['universal', 'islamic']`) | `remedySelection.ts:258-262` |
| Is selection deterministic? | **Yes.** Confirmed by direct execution in this pass: the Phase 1 golden corpus (111 cases, `docs/audit/golden-corpus/`) calls `selectRemedyProtocol()` for every case and the two-process replay (see §Determinism in `PHASE_1_ARCHITECTURE_MAP.md`) produced byte-identical output both times, for all 111 cases. Its own doc comment states "Deterministic: identical diagnoses produce identical protocols" (`remedySelection.ts:257`) — verified, not just quoted. | golden-corpus cases, `remedySelection.ts:257` |
| Is it persisted? | Yes — as part of `WatchOracleComposition.protocol` inside `ReadingDoc.watchOracle`, written to `/readings/{id}` by `askWatchOracle.ts` (`readingDoc` assembly, step 11) | `askWatchOracle.ts:274-296` |
| How does it reach the client? | Directly in the `askWatchOracle` callable's response (`response.oracle.protocol`) — no separate round trip | `askWatchOracle.ts:352-366` |
| Which UI renders it? | `src/components/oracle/RemedyProtocolCard.tsx`, rendered unconditionally when `reading.oracle !== undefined` | `ChatBubble.tsx:273` |

**Selection library:** `functions/src/oracle/remedyLibrary.ts` (653 lines). Id
namespace observed: `astro_*` (e.g. `astro_saturn_discipline`,
`astro_favourable_window`, `astro_mars_restraint`), `behavioral_*`,
`contemplative_*`, `devotional_*`, `practical_*`.

---

## Path B — `src/data/remedyLibrary.ts` + `selectRemedies`

| Question | Answer | Evidence |
|---|---|---|
| Where is `selectRemedies` invoked from? | `src/screens/ReadingScreen.tsx`'s `runGuidanceSelection()`, called at `ReadingScreen.tsx:317` — **unconditionally, inside `runAsk()`'s success path, immediately after every successful `askWatchOracle()` call.** No feature flag, no A/B gate, no user opt-in found. | `ReadingScreen.tsx:241-269, 290-317` |
| What is its callable/backend path? | `src/data/remedySelector.ts`'s `selectRemedies()` wrapper calls the `selectRemedies` Cloud Function (`functions/src/functions/selectRemedies.ts`, exported from `index.ts`, confirmed live in Phase 0 §B) via `regionalFunctions` | `remedySelector.ts:11-13`, `functions/src/functions/selectRemedies.ts` |
| Is LLM involved? | **Yes, directly and centrally.** `functions/src/functions/selectRemedies.ts`'s `SELECTION_PROMPT` instructs an LLM to pick 1-3 remedy ids from up to 8 candidates, returning `{"selectedIds":[...],"selectionReason":"..."}`. A second LLM call (`generateDescription`) then writes a 1-2 line description per selected remedy. Neither call is deterministic by construction (temperature/model sampling not pinned to 0 as far as this pass could verify from the prompt file alone — not independently re-verified against the live API in this session, since doing so would be a live production call, out of Phase 1's scope). | `functions/src/functions/selectRemedies.ts:33-48` and the `generateDescription` function below it |
| What input does it receive? | Server side: `oracleContext` (classification/spiritualState/severity/summary), up to 8 `candidates` (pre-ranked client-side), `questionText`, `readingId`. Client side, the candidate ranking itself (`getCandidates`/`rankCandidates` in `src/data/rankCandidates.ts`) **is** deterministic — it is only the final 1-3 pick from that pool, and the prose description, that is LLM-driven. | `functions/src/functions/selectRemedies.ts:15-27`, `src/data/rankCandidates.ts` |
| What is the output? | `selectedIds: string[]`, `selectionReason: string`, `descriptions: Record<string,string>` | `functions/src/functions/selectRemedies.ts:29-32` |
| Is it persisted? | **Not found to be persisted to Firestore in this pass** — `runGuidanceSelection()`'s `.then()` calls `updateMessage(targetThreadId, oracleMessageId, { selectedRemedies: result.selectedRemedies })`, which is thread/message state (client-local, MMKV-backed per Phase 0's architecture, not re-verified this pass whether `updateMessage` itself writes to Firestore). **Flagged as unverified, not asserted either way** — worth a direct check in Phase 2 scoping before any consolidation decision, since if Path B's picks aren't durably persisted, a user who reopens a reading later may see Path A's protocol only, while the original session saw both — a data-durability asymmetry between the two paths, not just a duplication. |
| Client rendering | `src/components/oracle/GuidanceCard.tsx`, rendered when `message.selectedRemedies !== undefined` | `ChatBubble.tsx:274-276` |
| Any other consumer? | `src/data/watchRemedyContext.ts` imports `categoryToThemes` from `remedySelector.ts` (a pure mapping table, not the LLM call) to build the `RankingContext` Path B's ranking step consumes — this is a shared helper between the deterministic ranking stage and the type layer, not a third authority. | `watchRemedyContext.ts:28` |

**Selection library:** `src/data/remedyLibrary.ts` (411 lines). Id namespace
observed: `salawat_*`, `dua_*`, `istikhara_*` (and further categories not
enumerated in full this pass — confirmed disjoint from Path A's namespace by
`diff` in Phase 0 addendum §2, re-confirmed here).

---

## Can the two paths produce contradictory guidance?

**Structurally, yes — they draw from disjoint libraries via unrelated
selection mechanisms, and nothing synchronizes them.** This is established
conclusively (not probabilistically) by the fact that their id sets do not
intersect at all: whatever Path B ever returns cannot, by construction, be one
of Path A's ids or vice versa. The live question is not "can they name the
same remedy" (they structurally cannot) but "can they imply different, or
even opposed, guidance for the same reading" — and the answer is also yes,
because Path A is driven purely by the deterministic diagnosis while Path B's
final pick is an LLM's free choice among a client-ranked pool that does not
consider Path A's diagnosis text at all (it consumes a separately-derived
`RankingContext`, not `RkpDiagnosis`).

### A concrete example, from real golden-corpus data (not invented)

Golden case `business-001` (`docs/audit/golden-corpus/cases/business-001.json`,
generated in this pass by actually running the deterministic engine — see
`PHASE_1_ARCHITECTURE_MAP.md` §F):

- Question: *"Will my new business succeed?"*
- Verdict: `state: "BLOCKED"`, `obstruction: "Ras"` (Rahu, boundary-named)
- **Path A's real, computed protocol for this exact case:**
  `['practical_financial', 'astro_saturn_discipline', 'contemplative_silence', 'devotional_tahajjud']`
  — deterministic, reproduced identically on every run.

For Path B, this session attempted to execute the actual client-side ranking
function (`watchVerdictToRankingContext()` → `getCandidates()`,
`src/data/watchRemedyContext.ts` / `src/data/rankCandidates.ts`) against this
same verdict, to show the real candidate pool rather than an inferred one.
**This execution attempt failed on a tooling incompatibility** (`vite-node`,
used to run the golden-corpus generator against `functions/src/engine`,
could not parse an unrelated TypeScript construct when reachability pulled in
files written for the Metro/Babel toolchain rather than plain `tsc`/Vite —
`RollupError: Expected 'from', got 'typeOf'`) — not a finding about the
codebase, a limitation of this session's ad hoc script. It was not worth
widening Phase 1's scope to fix, since fixing it would mean adding real
tooling, not documentation. The result below is therefore **read from source,
not executed** — labeled as such:

By inspection of `src/data/remedyLibrary.ts`, a `BLOCKED` state maps (via
`STATE_THEMES` in `watchRemedyContext.ts`, not independently re-confirmed by
execution this pass) toward an `OBSTRUCTION`-family theme, which is also the
top-scoring tag for library entries `salawat_01`
(`themeTags: ['OBSTRUCTION', 'STAGNATION', 'SPIRITUAL_NEGLECT']`) and `dua_01`
(`themeTags: ['OBSTRUCTION', 'DELAY', 'FORCING']`) — both real entries,
`remedyLibrary.ts:86-113`. Neither id can ever equal any of Path A's four
selected ids above (disjoint namespace, confirmed by `diff`). **So the
concrete, unavoidable structural fact — independent of what the LLM
ultimately picks between `salawat_01`/`dua_01`/others — is that a user asking
"Will my new business succeed?" and receiving Path A's `BLOCKED` /
`astro_saturn_discipline`-anchored protocol will, in the same screen, also
plausibly see a `salawat`/`dua`-category card whose content was chosen by a
process that never saw Path A's diagnosis, its target house, its obstructing
agent, or its timing window.** Whether the two ever read as contradictory in
plain-language terms is a subjective narrative question this report does not
adjudicate; what is established is that no mechanism exists to prevent it.

---

## Recorded per the requested format

| Field | Path A | Path B |
|---|---|---|
| Source library | `functions/src/oracle/remedyLibrary.ts` (653 lines) | `src/data/remedyLibrary.ts` (411 lines) |
| Selection authority | `oracle/remedySelection.ts` (`selectRemedyProtocol`) | `functions/src/functions/selectRemedies.ts` (Cloud Function, LLM) |
| Deterministic / LLM | Deterministic (confirmed by execution + replay) | Ranking stage deterministic; final 1-3 pick + descriptions are LLM |
| IDs | `astro_*`, `behavioral_*`, `contemplative_*`, `devotional_*`, `practical_*` | `salawat_*`, `dua_*`, `istikhara_*`, others (disjoint from Path A, confirmed by diff) |
| Persistence | Yes — `/readings/{id}.watchOracle.protocol` (Firestore, Admin SDK) | **Unverified this pass** — likely thread/message-local state only; needs direct confirmation before Phase 2 |
| UI consumer | `RemedyProtocolCard.tsx` | `GuidanceCard.tsx` |
| User-visible effect | Renders unconditionally when `reading.oracle` present | Renders unconditionally when `message.selectedRemedies` present — both can and typically do render together, per `GuidanceCard.tsx`'s own header comment stating this is intentional |

---

## Recommendation for Phase 2

**This report does not decide which mechanism to keep** — per the Phase 1
brief, that decision belongs to Phase 2, made by the project owner. What
follows is a recommendation, with reasoning, not an instruction.

**Recommendation: Path A (`oracle/remedySelection.ts`, deterministic,
server-side, library-bound) should become the single authoritative mechanism
for remedy content. Path B (`selectRemedies`, LLM-driven) should either be
retired or explicitly re-scoped to a role that is not "select the remedy" —
e.g. limited to generating supplementary prose *about* a remedy Path A has
already chosen, mirroring exactly the narration/fact separation
`responseComposer.ts` already enforces for the narration fields (Phase 0 §C).**

Reasoning:

1. **Constitutional fit.** The project's own architectural rules (as stated
   in the Phase 0/1 instructions governing this audit) are explicit: "Remedy
   is machine-owned. AI cannot invent remedies." Path A satisfies this
   exactly — it is a pure function of the deterministic diagnosis. Path B
   does not: an LLM freely picks among candidates without ever seeing the
   diagnosis that produced the reading, which is a different and looser
   guarantee than "AI narrates, never decides."
2. **Reproducibility.** Path A is provably deterministic (this pass's golden
   corpus + replay check demonstrate it directly). Path B cannot be replayed
   byte-for-byte even in principle — a golden-corpus entry for Path B would
   only ever be a snapshot of one LLM response at one point in time, not a
   regression oracle.
3. **Persistence and correctness under review.** Path A's output is written
   to the reading document and is part of the audited, retrievable record.
   Path B's persistence is unverified (see table above) — if it is in fact
   ephemeral, that alone is reason enough to not treat it as an equal,
   continuing source of truth for a reading a user may revisit.
4. **What would be lost.** `GuidanceCard.tsx`'s own comment frames Path B as
   answering a *different* question than Path A ("which devotional practice
   suits this seeker now" vs. "what the chart prescribes") — this is a real,
   stated design intent, not an oversight, and a Phase 2 decision to retire
   or re-scope Path B should account for whatever product value that
   seeker-tailored suggestion currently provides, rather than removing it
   purely on architectural grounds. This is exactly the kind of trade-off
   Phase 1 is not positioned to make unilaterally.

**What Phase 2 needs before acting**, regardless of which way the decision
goes: (a) confirmation of whether Path B's `selectedRemedies` are persisted
anywhere durable, (b) an owner decision on whether the "seeker-tailored
devotional suggestion" product value is worth keeping in some form, and (c) if
Path B is retired, an explicit decision on `src/data/remedyLibrary.ts`'s
38 entries — archive, fold into Path A's library, or discard — none of which
this report performs.
