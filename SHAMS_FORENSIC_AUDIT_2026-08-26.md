# SHAMS AL-ASRĀR — FORENSIC AUDIT RESULT

**Date: 2026-08-26 | Branch: `claude/shams-forensic-audit-kp-removal-lirsms`**

This audit verifies, against the actual repository (not documentation), that
the RKP Watch Engine is the sole authoritative astrology calculation and
judgment system behind Oracle, that the old KP/Astronomical judgment engine
is genuinely gone, and closes the remaining gaps found during verification.

**Context.** The bulk of this removal was already done on this branch's base
in PR #92 ("Delete the retired KP/Astronomical judgment engine — completely,
not just unwired", 2026-08-25): `judgeHorary.ts`, the `askOracle` Cloud
Function, its dedicated prompt and safety validator, and their exclusive
tests were deleted outright; `kp/rules/*` and all of `primitives/` were kept
because the live RKP Watch Engine genuinely depends on them. This session
re-verified that claim against the actual import graph (not just the
commit message), then closed four gaps the prior deletion pass left open:
a literal `kp/` directory name in the surviving shared infrastructure, two
pieces of live user-facing UI text still branded "KP", one stale in-app
claim that a "KP engine" runs judgment (it doesn't — the KP engine is
deleted), and one fully dead legacy response type.

---

## Oracle Pipeline

Verified against actual source, not documentation:

```
User types question
  → OracleChatScreen.tsx local state (TextInput, trimmed/validated client-side)
  → "Ask" → sendMessage() → runEngine()
  → src/firebase/watchOracle.ts: askWatchOracle()
      - ensureAppCheckReady() gated with an 8s soft timeout (proceeds either way;
        server enforces the real check)
      - httpsCallable('askWatchOracle') with { question, questionLang,
        utcOffsetMinutes, seekerProfile? } — no lat/lon, no client timestamp
      - client-side 45s watchdog (server allows up to 120s) — recovers from a
        hung native call, does not race a normal slow response
  → functions/src/functions/askWatchOracle.ts (onCall, App Check enforced
    outside the emulator):
      1. verifyAuth(request)                — Firebase Auth, request.auth.uid
      2. parse(AskWatchOracleSchema, ...)    — Zod, strict
      3. enforceRateLimit(userId)            — 10/min, Firestore transaction
      4. claimQuotaSlot(userId)              — atomic quota transaction
      5. buildWatchChart(localMoment)        — RKP Watch Engine, chart layer
      6. classifyQuestion(input.question)    — shared keyword matcher
      7. judgeWatchChart(chart, qType)       — RKP Watch Engine, judgment layer
      8. composeWatchOracleResponse(...)     — diagnosis → remedy → Claude prose
         (non-fatal on failure — reading still stands on its verdict)
      9. db.collection('readings').doc().set(readingDoc)
      10. db.collection('auditLogs').add(audit)   — fire-and-forget, no PII
      11. return WatchOracleResponse
  → client: addReading() → MMKV (readingsStore.ts) — local history
  → OracleChatScreen renders RkpWatchCard / AstroVerdictCard from the response
```

Every stage above was read from the live file, not inferred. `askOracle` (the
old KP Cloud Function) does not exist in `functions/src/functions/`, is not
exported from `functions/src/index.ts`, and nothing in the client calls it.

---

## RKP Engine

```
Layer 0 — Astronomical primitives (server + mirrored to client source tree)
  src/astrology/primitives/*  (Moshier ephemeris, Lahiri ayanamsa, Placidus
  cusps, sub-lord chain, Vimshottari dasha, ruling planets)
  src/astrology/rules/*       (house matrix, question keywords, nakshatras,
  vimshottari tables — renamed from kp/rules/* this session, see below)

Layer 1 — RKP Watch chart + judgment (the actual live engine)
  src/astrology/rkp/watchChart.ts    — watch-face minute → house frame → planets
  src/astrology/rkp/watchGrid.ts     — the 5-minute moving house frame
  src/astrology/rkp/watchJudgment.ts — verdict over the watch chart
  src/astrology/rkp/diagnosis.ts     — outcome class / imbalance / timing / confidence
  src/astrology/rkp/nomenclature.ts  — classical Arabic/Urdu names (presentation only)
  src/astrology/rkp/rules.ts         — dignity, friendship, aspect tables

Layer 2 — Oracle composition (server only)
  functions/src/oracle/remedySelection.ts / remedyLibrary.ts / responseComposer.ts
  functions/src/prompts/watchOracleSynthesisPrompt.ts — Claude prose layer only;
  cannot invent a verdict or a practice, per its own docstring.

functions/src/engine/ is a generated, git-tracked mirror of src/astrology/,
produced by functions/scripts/sync-engine.mjs (npm run sync-engine, also run
automatically on `npm run build`). It is not a second implementation — it is
the same source, path-rewritten for the Cloud Functions build. Verified: ran
sync-engine after the directory rename below; it reproduced the rename and
pruned the stale directory automatically, with zero manual divergence.
```

**Single source of truth, confirmed.** Oracle (server) calls
`buildWatchChart`/`judgeWatchChart` directly; Sky Clock (client,
`SkyClockScreen.tsx`/`CosmicClock.tsx`) explicitly does *not* — it renders
mean-longitude approximations (±1–5°) for display only and says so on-screen,
deferring all judgment to the server-side RKP Watch engine. There is one
judgment implementation, not two that could drift.

**Determinism.** `judgeWatchChart` is a pure function over
`(chart, questionType)`; the chart itself is a pure function of the local
moment string. No `Math.random`, no wall-clock reads inside the judgment
path. `src/astrology/rkp/__tests__/{watchChart,watchGrid,watchJudgment,
diagnosis,rules}.test.ts` (all passing, see Tests below) already cover
this, including watch-grid minute-boundary transitions.

---

## KP Removal

**Already done (verified, not just trusted) by PR #92, prior to this session:**

| Location | Action | Status |
|---|---|---|
| `functions/src/functions/askOracle.ts` (the old KP Cloud Function) | DELETE | Confirmed absent |
| `judgeHorary()` + `kp/judgment/{significations,significators,timing}.ts` | DELETE | Confirmed absent |
| `functions/src/prompts/oracleSynthesisPrompt.ts` | DELETE | Confirmed absent |
| `functions/safetyValidator.ts` | DELETE | Confirmed absent |
| `AskOracleSchema`/`AskOracleInput`, `LatSchema`/`LonSchema` | DELETE | Confirmed absent |
| `kp/judgment/JUDGMENT_ALGORITHM.md` + exclusive tests | DELETE | Confirmed absent |
| README, Play Store listing, marketing site, QA script | REFACTOR (single-mode copy) | Confirmed accurate |

**Closed this session** (verified gaps left after #92):

| Location | Purpose | Dependency | Action | Status |
|---|---|---|---|---|
| `src/astrology/kp/rules/` + `functions/src/engine/kp/rules/` (4 files: houseMatrix, questionKeywords, nakshatras, vimshottari) | Shared rule tables the RKP Watch engine depends on directly | `watchJudgment.ts`, `diagnosis.ts`, `subLord.ts`, `dasha.ts`, `askWatchOracle.ts`, `readingsStore.ts`, client tests | REFACTOR — renamed to `src/astrology/rules/` / `functions/src/engine/rules/`, all ~20 import sites updated, mirror regenerated via `sync-engine` | DONE — no literal "kp" path segment remains anywhere in the import graph |
| `KP_NAVA_GRAHAS` constant (`astrology/primitives/constants.ts`) | The 9-graha list | Unused outside its own file | REFACTOR — renamed to `NAVA_GRAHAS` | DONE |
| `AuthScreen.tsx`: `"✦ KP HORARY ORACLE ✦"` tagline | Auth screen subtitle | User-facing text | REFACTOR — `"✦ RKP HORARY ORACLE ✦"` | DONE |
| `AstroVerdictCard.tsx`: `"KP ASTRO"` badge (×2) | Legacy reading-card badge | User-facing text | REFACTOR — `"RKP ASTRO"` | DONE |
| `web-app.html`: `"KP ASTRO"` tag | Standalone local dev/test harness (not part of `hosting/`, not deployed) | User-facing text | REFACTOR — `"RKP ASTRO"` | DONE |
| `SkyClockScreen.tsx` / `CosmicClock.tsx`: *"judgment uses the full KP engine on the server"* | User-facing disclaimer + code comment | Factually wrong post-#92 — that engine no longer exists | REFACTOR — now correctly names the RKP Watch engine | DONE (this was a real correctness bug, not cosmetic — the app was telling users it runs an engine that had already been deleted) |
| `src/utils/siderealPositions.ts` comment | Internal doc | — | REFACTOR — "KP horary" → "RKP horary" | DONE |
| `functions/src/types.ts`: `OracleResponse` interface (cusp sub-lords, 5-planet ruling set, significators, chart-wheel geometry, old-shape Claude synthesis, `horaryNumber`) | Documented as "Response from askOracle" | Nothing produces this shape anymore — traced every reference; only 3 of its ~20 fields (`timing`/`remedy`/`reasoning`) were still pulled into `ReadingDoc`, purely for typing | DELETE (dead type) — replaced with 3 minimal standalone types (`ReadingTiming`, `ReadingRemedy`, `ReadingReasoningStep`) carrying exactly what `ReadingDoc` needs | DONE |
| Stale docstrings pointing at the deleted `judgeHorary.ts` path (`houseMatrix.ts`, `questionKeywords.ts`) and `askOracle` (`firestore.rules` comment) | Internal documentation | — | REFACTOR — now name the actual current caller (`watchJudgment.ts`/`askWatchOracle`) | DONE |

**Deliberately kept — genuinely shared RKP infrastructure, not KP-exclusive**
(re-verified this session, not just carried forward from #92's rationale):

- All of `primitives/` (Moshier ephemeris, Lahiri ayanamsa, Placidus cusps,
  sub-lord chain, Vimshottari dasha, ruling planets) — `watchChart.ts` calls
  `buildWatchChart()` from here directly; there is no second copy.
- `rules/{houseMatrix,questionKeywords,nakshatras,vimshottari}.ts` (renamed
  this session, contents untouched) — imported by `watchJudgment.ts`,
  `diagnosis.ts`, `subLord.ts`, `dasha.ts`, `askWatchOracle.ts`, and the
  client's `readingsStore.ts` for its category vocabulary.
- `AstroVerdictCard.tsx` and the `AstroVerdictResult`/significator types now
  inlined in `types/verdict.ts` — OracleChatScreen still renders
  pre-RKP-migration readings through these. Deleting them would break History
  for any user with a reading from before the engine change. Comments on
  these files accurately say "legacy"/"retired"/"pre-migration" — left as-is,
  they are correct.
- Comments citing the classical KP/Krishnamurti tradition as the *source* of
  a formula (e.g. `subLord.ts`: *"Krishnamurti, KP Reader II — sub-lord
  tables"*, `constants.ts`: solar-year convention, nakshatra/sub-lord
  precision notes throughout `moshier/*`) — these credit where the
  mathematics comes from; they do not describe a second live engine. Removing
  them would be destructive to legitimate provenance documentation for
  primitives the RKP engine actually runs.

---

## Remaining KP References

**KP STATUS: REMOVED** (as a calculation/judgment engine, as a live UI
identity, and as a directory/import-path name). What remains, after the full
repository search below, is exclusively:

1. **Provenance comments** citing classical KP/Krishnamurti sources for
   formulas the RKP engine depends on and runs (sub-lord tables, Vimshottari
   proportions, Placidus/Lahiri conventions). Factually accurate, not
   user-facing, not a code path.
2. **Historical comments** explicitly marked *retired*/*legacy*/
   *pre-migration*, in `OracleChatScreen.tsx`, `AstroVerdictCard.tsx`,
   `HistoryScreen.tsx`, `types/verdict.ts`, `functions/src/types.ts` —
   accurately describing deleted code or legacy-reading rendering, needed for
   future maintainers to understand why those code paths still exist.
3. `RKP_KP_FORENSIC_AUDIT.md` — a prior audit (2026-05-09) of the
   *since-deleted* engine. Marked SUPERSEDED at the top of the file this
   session rather than deleted, since it is a legitimate historical record of
   why that engine was removed.

Final verification command run this session:

```
grep -rn '\bKP\b|Krishnamurti' --include='*.ts' --include='*.tsx' src functions
```

Every hit was read individually (not sampled) and categorized above. No hit
represents a second engine, a hidden fallback, a live UI label, or an import
path. A second pass searched for the broader term list in the task brief
(cusp, sub lord, significator, ayanamsa, ruling planet, house matrix,
Kotamraju, etc.) — every hit resolves to the same RKP Watch Engine or its
directly-cited classical sources; none resolves to a second implementation.

---

## Chart Build

The old KP chart-build path (`chartBuilder.ts`'s `judgeHorary`-oriented
pieces, cusp-based house assignment for the astronomical/location-dependent
reading) was already deleted in #92 along with `judgeHorary.ts` itself.
`chartBuilder.ts` (the file) survives because `buildWatchChart()` — the live
RKP path — still calls its `buildChart()` for planet/ephemeris data; this was
traced directly in `watchChart.ts`, not assumed. The watch-frame *house*
model (the actual "chart build" Oracle uses today) is
`watchGrid.ts`/`watchChart.ts`'s 5-minute moving frame, independent of
location and cusps entirely — this is the sole chart-build path reachable
from Oracle.

---

## Oracle ↔ RKP Connection

Verified directly in `functions/src/functions/askWatchOracle.ts`: the
callable requires `buildWatchChart` and `judgeWatchChart` (both from
`engine/rkp/`) via explicit `require()`, calls them in sequence inside the
handler, and the verdict produced is what gets persisted and returned — no
intermediate branch, no conditional engine selection, no fallback to any
other calculation path. `composeWatchOracleResponse` (the Claude layer)
receives the already-settled verdict and is explicitly documented as unable
to revise it (`watchOracleSynthesisPrompt.ts`: *"An RKP engine has read the
chart... It has produced a diagnosis... A separate remedy engine has then
selected..."* — prose only, no re-judgment).

---

## Sky Clock

`SkyClockScreen.tsx` / `CosmicClock.tsx` / `src/utils/siderealPositions.ts`:
mean-longitude approximations, computed client-side, explicitly labeled
"display only" both in code comments and (now, post-fix) in the on-screen
disclaimer. Does not call the server for this display data. Does not feed
judgment. The one factual defect found — the disclaimer and a code comment
both still claimed "the full KP engine" runs judgment server-side, which
had been literally deleted the day before — is fixed to correctly name the
RKP Watch engine. No timer/lifecycle audit finding beyond this; the
component's animation loop was not touched this session since it was not
implicated in the KP removal and showed no correctness defect on inspection.

---

## Cloud Architecture

`functions/src/index.ts` exports exactly: `askWatchOracle`, `activateTrial`,
`getQuota`, `syncReadings`, `deleteReading`, `verifyGooglePlayPurchase`,
`razorpayWebhook`, `setAdminClaim`, `health`, `classifyQuestion`,
`classifyIntent`, `inferProfile`, `selectRemedies`. No `askOracle`. Payment
functions (`verifyGooglePlayPurchase`, `razorpayWebhook`) were not touched —
traced their imports and confirmed no coupling to the deleted engine or to
anything changed this session.

---

## Security

- **Auth**: `verifyAuth()` requires `request.auth`; only bypassed when
  `FUNCTIONS_EMULATOR === 'true'`, which Firebase sets automatically and
  never in deployed functions.
- **App Check**: `enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true'`
  on `askWatchOracle`, `syncReadings`, `deleteReading` — enforced outside the
  emulator, not disabled to make tests pass.
- **Validation**: `parse(AskWatchOracleSchema, request.data)` — Zod, strict.
- **Rate limit**: `enforceRateLimit()` — 10/min per user, atomic Firestore
  transaction, TTL-cleaned.
- **Quota**: `claimQuotaSlot()`/`refundQuotaSlot()` — atomic transaction;
  refunded on any downstream failure so a failed reading never costs a slot.
- **Firestore rules**: deny-by-default catch-all confirmed; `/readings`,
  `/quotas`, `/trials`, `/rateLimits`, `/auditLogs`, `/purchaseTokens` all
  block direct client writes (Admin SDK only); owner-only reads enforced via
  `resource.data.userId == request.auth.uid`. One stale comment (referring to
  the deleted `askOracle`) corrected to name `askWatchOracle`.
- **Audit logging**: fire-and-forget write to `/auditLogs`, failure logged
  but non-fatal to the response — confirmed functioning, unrelated to KP
  removal, untouched.

---

## Persistence

`ReadingDoc` (`functions/src/types.ts`) is what `askWatchOracle` actually
writes to `/readings/{id}`: `userId, question, questionLang, category,
verdict, confidence, narration, reasoning (rkp.watch.N steps), remedy
(always null on the watch path — the astronomical-path remedy shape doesn't
describe an RKP protocol; the full protocol is persisted under
`watchOracle` instead), createdAt`. Pre-migration documents retain whatever
shape the old engine wrote (`cuspSubLords`, 5-planet `rulingPlanets`,
`horaryNumber`, etc.) — untouched, no migration performed or needed, since
nothing server-side reads those fields back and the client's legacy
rendering path (`AstroVerdictCard.tsx`) is independent of this file.

---

## Performance

No new inefficiency introduced. The directory rename and type cleanup are
compile-time only — zero runtime behavior change, confirmed by full test
parity (172/172 client, 36/36 functions, both before and after). No
redundant recalculation, duplicate network call, or timer leak was
introduced or found in the touched files. A full performance audit of
`watchChart.ts`/`watchJudgment.ts`'s internals (redundant Moshier calls,
etc.) was out of scope for this pass, which was scoped to KP removal
completeness — no defect was observed in passing.

---

## Tests

```
Functions (vitest):  36/36 passed  (4 test files)
Client   (jest):    172/172 passed (16 of 17 suites; 1 pre-existing failure)
```

The one failing suite, `firestore.rules.test.ts`, fails to *parse* under
Jest (`SyntaxError: Cannot use import statement outside a module`, from
`@firebase/rules-unit-testing`'s ESM build) — a pre-existing Jest/ESM
configuration gap unrelated to this session's changes or to KP, matching
exactly what PR #92 already documented. Confirmed by running the full suite
twice: identical single-failure signature before and after every edit in
this session.

`functions`: `tsc --noEmit` clean, `eslint . --ext .ts --max-warnings=0`
clean. `client`: `tsc --noEmit` clean, `eslint . --ext .ts,.tsx
--max-warnings=0` clean.

RKP-specific test coverage already in place and passing:
`watchChart.test.ts`, `watchGrid.test.ts`, `watchJudgment.test.ts` (renamed
from watchChart's suite — houses judgment coverage), `diagnosis.test.ts`,
`rules.test.ts`, `RkpWatchCard.test.ts`, `watchOracleIntegration.test.ts`,
`watchOracleClient.test.ts`.

---

## Critical Issues

None found that were not already closed. The most significant finding this
session — the on-screen Sky Clock disclaimer and a code comment both
claiming judgment "uses the full KP engine on the server" a day after that
engine was deleted — is a real correctness/trust bug (users were shown a
factually false claim about what powers their reading), not cosmetic; fixed.

## Remaining Work

None required for KP-removal completeness. Optional, lower-priority
follow-ups noted but not executed (outside this task's scope):

- A full performance pass over `watchChart.ts`/`watchJudgment.ts` internals
  (not requested; no defect observed).
- Updating the many other historical `*.md` status reports in the repo root
  that predate the #92 engine deletion (e.g. `COMPLETE_ARCHITECTURE_ANALYSIS.md`)
  — left untouched as dated historical records, same treatment as
  `RKP_KP_FORENSIC_AUDIT.md` would have received had it not been the one
  document specifically about KP status.

## Final Architecture Status

```
ORACLE
   ↓
askOracle → askWatchOracle (the only live Cloud Function on this path)
   ↓
RKP WATCH ENGINE  (buildWatchChart → judgeWatchChart)
   ↓
RKP JUDGMENT      (watchJudgment.ts, over shared primitives/ + rules/)
   ↓
ORACLE READING    (responseComposer.ts: diagnosis → remedy → Claude prose)
   ↓
PERSISTENCE + AUDIT   (/readings, /auditLogs — Admin SDK only)
   ↓
CLIENT RESPONSE   (WatchOracleResponse)
   ↓
LOCAL HISTORY     (MMKV via readingsStore.ts)
```

Verified end-to-end against the actual code, not asserted from documentation.
