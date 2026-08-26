# SHAMS AL-ASRĀR — RKP WATCH ENGINE MATHEMATICAL & ORACLE INTEGRITY AUDIT

**Date: 2026-08-26 | Branch: `claude/shams-forensic-audit-kp-removal-lirsms`**

Follow-on to `SHAMS_FORENSIC_AUDIT_2026-08-26.md`, which established that KP is
removed and the RKP Watch Engine is the sole live judgment path. This audit
answers a different question: **is that surviving engine mathematically and
logically correct, and is the final Oracle reading actually, causally,
derived from its output?**

Scope, as requested: (1) boundary correctness, (2) RKP ↔ responseComposer
integrity, (3) client/server parity, (4) question classification
determinism, (5) judgment calibration. Every claim below was verified by
reading the live source and, where the claim is about behavior rather than
code shape, by running the actual engine — not inferred from comments or
prior documentation.

**Headline finding:** one real, previously-untested, internally-inconsistent
bug in `judgeWatchChart()` was found, proven at scale (10,176 of 112,896
sampled moment/question pairs affected, including 247 cases of the sharpest
possible contradiction: a "the matter completes" verdict alongside "reversal
possible" with zero explanation), and fixed with a regression test. Separately,
and just as importantly: **`docs/RKP_RULES_FROM_SARFARAZ.md`, cited by six
live source files as "source of truth," turns out to describe a different,
deleted engine for nearly all of its content** — not the live Watch Oracle.
Both are addressed below.

---

## 1. Boundary correctness — VERIFIED, no defect found

`src/astrology/rkp/watchGrid.ts`:

- `bracketFromMinute(minute) = Math.floor(minute / 5)`, minute restricted to
  `[0, 59]` by an explicit `RangeError` guard (minute 60 or -1 both throw,
  confirmed by test — a boundary is rejected rather than silently wrapped).
- Existing tests (`watchGrid.test.ts`) already exhaustively iterate **every**
  minute 0–59, not a sample of the round numbers: `gives every bracket
  exactly five minutes` asserts all 12 brackets get exactly 5 of the 60
  minutes, and `covers all twelve signs exactly once across the hour` asserts
  all 12 signs are reachable. This is strictly stronger evidence than
  spot-checking `04:59→05:00`, `09:59→10:00`, etc. individually — an
  off-by-one anywhere would break one of these two exhaustive counts. Spot
  checks for the specific boundaries requested (`:00`, `:04→:05`, `:59`,
  the `+05:45`/Nepal quarter-hour case) are also present and pass.
- `localMinuteFromIso()` reads the literal `HH:MM` out of the ISO string via
  regex, deliberately avoiding `Date.getMinutes()` (which would report the
  *server's* zone). Verified this is timezone-offset-agnostic by
  construction: `functions/src/utils/localTime.ts`'s `localIsoFromOffset()`
  shifts the instant by the offset in milliseconds first and *then* reads
  UTC fields off the shifted `Date` — so minute/hour/day/month/year rollovers
  (23:58 in one zone landing on a different calendar day) are handled by the
  `Date` object itself, not by hand-rolled arithmetic that could be off by
  one at a rollover. Verified the negative-offset formatting path too (e.g.
  `-05:30`) — sign is applied once to the whole field, magnitude taken via
  `Math.abs`, correct for the western hemisphere.
- `AskWatchOracleSchema` bounds `utcOffsetMinutes` to `[-720, 840]` in
  15-minute steps — covers every real-world civil offset, including the
  :30/:45 zones, and rejects anything else at the Zod layer before the
  engine ever sees it.

No off-by-one, no silent clamping, no rollover defect found anywhere in this
layer.

---

## 2. RKP → responseComposer integrity — VERIFIED structurally enforced

Traced `functions/src/oracle/responseComposer.ts` line by line. The pipeline
is exactly the one you described as ideal, not the alternative:

```
judgeWatchChart() → diagnose() → selectRemedyProtocol() → responseComposer → prose
```

- `diagnose()` (`src/astrology/rkp/diagnosis.ts`) and `selectRemedyProtocol()`
  are both pure functions — no network call, no LLM, no randomness — computed
  **before** Claude is ever contacted.
- The model (`narrate()`) receives the settled diagnosis and the
  already-chosen remedies as a text brief and is asked for exactly 4 prose
  strings (`rkp_finding`, `interpretation`, `recommended_approach`,
  `why_this_remedy`) plus a `signature` line.
- This is enforced **structurally, not just by instruction**: remedy `id`,
  `name`, `category`, `evidenceType`, `instructions` etc. are copied verbatim
  from `REMEDY_LIBRARY` into the response object built *before* `narrate()`
  is even called (`responseComposer.ts:176-204`) — the model's output is
  never merged into that object, only appended as `narration`. There is no
  code path by which the model's text could change a remedy name, add a
  remedy, or alter the diagnosis fields the client receives.
- `why_this_remedy` is force-set to `null` server-side whenever
  `protocol.interventionRequired` is false, **regardless of what the model
  returned** (`responseComposer.ts:288`) — a clean chart cannot be given a
  remedy justification even if the model hallucinates one.
- A synthesis failure (timeout, non-200, malformed JSON, missing required
  field) returns `narration: null` and nothing else changes — the
  deterministic diagnosis and protocol still reach the client and get
  persisted. Confirmed by reading the `catch`/`if (!res.ok)` paths; this is
  not a claim taken from the docstring.
- The system prompt (`watchOracleSynthesisPrompt.ts`) explicitly forbids the
  model from doing its own astrology, naming a remedy, or softening/upgrading
  the diagnosis, and gives worked examples for both a conditional and a fully
  favourable reading.

**One residual integrity gap, worth naming honestly:** the four prose fields
are validated only for *presence* (`!parsed.rkp_finding || ...`), never for
*semantic consistency* with the diagnosis. Nothing server-side checks that
`interpretation` doesn't contradict `outcome`. The system prompt is explicit
and well-constructed, and the four structured fields the client actually
renders as data (verdict, confidence, timing, remedy steps) are untouched by
the model regardless — so a prompt-injection-class failure here degrades the
*prose* only, never the *judgment* — but it is a reliance on model compliance,
not a hard guarantee, and should be named as such rather than asserted as
airtight. Recommend, if this matters for the product: a cheap post-hoc check
(e.g. does `interpretation` contain an outcome-word contradicting
`diagnosis.outcome`) before trusting the narration, or accept the residual
risk explicitly. Not fixed in this pass — it's a design trade-off call for
the product owner, not a bug.

---

## 3. Client/server parity — VERIFIED, trivially, by construction

Searched the entire client tree for any second implementation of the
watch-grid/judgment math: `bracketFromMinute`, `watchWindowFromIso`, and
`watchGrid` itself are imported **only** by `watchChart.ts` and its own test
file — nowhere in `SkyClockScreen.tsx`, `CosmicClock.tsx`, or
`siderealPositions.ts`.

There is no second, client-side implementation of the watch-frame or
judgment math to drift from the server. Sky Clock computes an entirely
different, explicitly lower-precision thing — mean-longitude sidereal
approximations (±1–5°) for live display — and never touches
`watchGrid`/`watchJudgment` at all. This was already confirmed at the
architecture level in the prior audit; this pass confirms it at the
import-graph level: `Local RKP(time) === Server RKP(time)` holds not because
two implementations happen to agree, but because there is exactly one
implementation, shared into both builds unchanged via `sync-engine`, and the
client never runs it. Parity by elimination, which is stronger than parity by
testing two copies against each other.

---

## 4. Question classification — VERIFIED deterministic; one doc drift found

`classifyQuestion()` (`src/astrology/rules/questionKeywords.ts`):

- Pure function: normalize (`toLocaleLowerCase().trim()`, collapse
  whitespace) → iterate `QuestionType`s in declaration order → Unicode-aware
  **word-boundary** regex match → first hit wins → `'general'` on no match.
  No `Date`, no randomness, no external state.
- `HOUSE_MATRIX` (`src/astrology/rules/houseMatrix.ts`) was diffed
  entry-by-entry against §2 of `docs/RKP_RULES_FROM_SARFARAZ.md` (the
  owner's original pasted table): all 14 question types match exactly —
  `favorable`, `denial`, `primary`, and `secondary` houses are byte-for-byte
  faithful (array element order differs for one entry, `children`, which is
  immaterial since membership, not order, is what the engine tests). This is
  the one part of the original owner intake the live engine actually runs on,
  and it checks out completely.
- **Doc drift, not a code bug:** the spec text says the detection rule is
  "keywords appears as a substring." The actual code matches on Unicode word
  boundaries instead (`(?<=^|[^\p{L}\p{N}])keyword(?=[^\p{L}\p{N}]|$)`),
  explicitly to stop "work" from firing inside "artwork" — a deliberate,
  correctly-reasoned improvement over the literal substring rule, documented
  in the code's own comment, but never carried back into the spec doc. Noted
  in the doc-status fix in §6 below rather than treated as a functional
  defect — the code is *more* correct than the written rule here, not less.

---

## 5. Judgment calibration — ONE CONFIRMED BUG (fixed), plus a major provenance finding

### 5a. Confirmed bug: `state` and `reversal` disagreed on what counts as "a ruling planet is retrograde"

`judgeWatchChart()` computes two related-but-distinct signals from
retrogression:

- `reversal: 'POSSIBLE' | 'NONE'` — documented and tested (pre-existing test:
  *"flags reversal exactly when a ruling planet is retrograde"*) as true
  when **either** the target house's ruler **or** the querent's own (lagna)
  ruler is retrograde.
- `state === 'REVERSING'` — via `resolveState()`'s `retrograde` input, which
  (before this fix) was wired to **only** the target ruler's retrograde flag,
  not the lagna ruler's.

**Proof, not assertion:** ran the real engine (real ephemeris, no
mocking) across 28 days × 24 hours × 12 five-minute brackets × 14 question
types (112,896 combinations). Of those, **10,176 (9%)** had `reversal:
'POSSIBLE'` while `state` resolved to something other than `'REVERSING'`
purely because the lagna ruler (not the target ruler) was the retrograde one
— broken down by what `state` said instead: `BLOCKED` 3,035, `UNFORMED`
3,085, `DELAYED` 3,096, `MOVING` 713, and — the sharpest contradiction —
**`FULFILLED` 247 times**: the headline verdict literally reads "the matter
completes," a `WatchState` documented as *"clean support across ruler,
aspect and fulfilment"*, on the same reading where `reversal: 'POSSIBLE'`
told the caller to expect "rework, reversal, or an overturn." In **zero** of
these 10,176 cases did the `factors` audit trail mention the lagna ruler's
retrograde status at all — a second, independent violation of the module's
own stated invariant ("every contribution is recorded in `factors`... a
reading can be audited after the event").

**Fix applied** (`src/astrology/rkp/watchJudgment.ts`): both `reversal` and
the `retrograde` input to `resolveState()` now derive from the same
`anyRulerRetrograde = rulerPos.isRetrograde || lagnaRulerPos.isRetrograde`
value, and a factor line is now pushed for the lagna ruler's retrograde
status too (guarded against double-printing when the target ruler and lagna
ruler are the same planet — this happens for every `health` question, whose
primary house is the 1st Ghar itself). Re-ran the same 112,896-case sweep
after the fix: mismatches and missing-factor cases both dropped to **0**.
Existing test suite (172 tests) still passes unchanged; one new regression
test added asserting (a) the general invariant across all question types at
a fixed real moment, and (b) the specific real-sky case found during the
sweep (`2026-02-01T00:40:00+05:30`, `marriage`) resolves to `REVERSING` with
an explanatory factor, where it previously resolved to `UNFORMED` silently.

This was a **real, reachable, user-facing** defect — not a theoretical
inconsistency. It directly affects the primary verdict headline shown in
`RkpWatchCard`, on roughly 1 in 11 sampled readings.

### 5b. Major finding: the live scoring model has no owner-attributed specification

This is the most important structural finding of this audit, separate from
the bug above.

`docs/RKP_RULES_FROM_SARFARAZ.md` is cited by name, as "source of truth," in
the docstrings of `houseMatrix.ts`, `questionKeywords.ts`, `nakshatras.ts`,
`vimshottari.ts`, `subLord.ts`, and `watchJudgment.ts` itself. Its header
claimed "Status: aligned to the current runtime engine." Reading it in full
against the live `watchJudgment.ts` shows that claim was **false for nearly
all of its content**:

| Doc section | Describes | Actually live in `watchJudgment.ts`? |
|---|---|---|
| §1 Core engine model (Moon-Sub-Lord primary signal, Cusp-Sub-Lord promise gate) | The deleted `judgeHorary.ts` | No |
| §2 House Matrix table | Favorable/denial/primary houses per question type | **Yes — verified faithful, see §4 above** |
| §3 Sub-lord / nakshatra / Vimshottari rules | Sub-lord chain, dasha years | Computed by `chartBuilder.ts` on every request, but the fields are discarded before reaching judgment — not a judgment input |
| §4 Ruling Planets (Day/Hora/AscSign/AscStar/MoonSign/MoonStar) | 5-6-witness scoring | Computed by `chartBuilder.ts`, likewise discarded — not a judgment input |
| §5 The 5-step judgment algorithm | `judgeHorary()`'s scoring | No — deleted, along with the file it names |
| §6 Timing via dasha-transit convergence | `judgeHorary()`'s timing | No |
| §7 Output contract | `judgeHorary()`'s response shape | No — that shape (`cuspSubLords`, 5-planet `rulingPlanets`, etc.) was the dead `OracleResponse` type removed in the prior audit pass |

The live Watch Oracle's actual scoring model — traced directly from
`watchJudgment.ts`, no other source — is:

```
+2 / -2   target house's own ruler is Strong / Weak dignity (exaltation, domicile, friendship-to-sign-lord)
+2 / -2   querent's own ruler regards the matter's ruler as Friend / Enemy
+2 / -2   each benefic / malefic occupying or aspecting the target house
+2 / -2   each benefic / malefic occupying or aspecting the 11th (fulfilment) house
+1 / -1   the matter's ruler sits in a favorable / denial house per HOUSE_MATRIX
-1        the matter's ruler is combust
(factor, no score) the matter's ruler or the querent's ruler is retrograde → REVERSING, or feeds `reversal`
obstruction, in fixed precedence: Saturn > Mars > Rahu > Ketu, occupying the target house first, then aspecting it, then (if none) Moon in house 8/12 as "MoonDisagreement"

state:      score<=-5 BLOCKED; else anyRulerRetrograde REVERSING; else score>=5 FULFILLED;
            else (Saturn-obstruction OR weak ruler) DELAYED; else score>=2 MOVING; else UNFORMED
confidence: banded on |score| — >=6 VERY_HIGH, >=4 HIGH, >=2 MODERATE, >=1 LOW, else UNCERTAIN;
            downgraded one band if both a benefic and a malefic witness fall on the target house,
            and again if Moon sits in a denial house for the question
timing:     a fixed base window per ruling planet (Moon 3-7 days ... Saturn 90-150 days),
            stretched x1.5 if weak or retrograde, compressed x0.7 if exalted
```

This is legitimate classical horary technique — dignity, planetary
friendship, aspect, benefic/malefic influence, retrogression and combustion
are all standard, textbook Vedic/KP concepts, correctly implemented (dignity
precedence, the asymmetric friendship table, inclusive house-distance
aspects, and the obstruction/occupant/aspect bookkeeping were all spot-checked
against the existing exhaustive consistency tests and found correct). But
**the specific weights (±2, ±1, -1), the state thresholds (-5, 5, 2), the
confidence bands (6/4/2/1), the obstruction precedence order
(Saturn>Mars>Rahu>Ketu), and the per-planet timing base windows are not
sourced from `RKP_RULES_FROM_SARFARAZ.md` or any other document in this
repository** — they were designed directly in the engineering session that
built the Digital Watch Oracle (commit `adb2ac2`, per its own commit
message, which does not cite a rules document for this part, unlike every
other primitive it built). The only owner-sourced pieces the Watch judgment
actually runs on are the House Matrix (§2, verified above) and the
watch-minute-selects-the-Ascendant *mechanism* itself, which the product
README has described as a feature since before the Watch engine existed.

**This is not reported as a defect** — per the standing instruction not to
invent RKP mathematics, I have not altered a single weight, threshold, or the
obstruction order; the calibration is internally consistent (confirmed by
the exhaustive sweep above, module-level and via existing dignity/aspect
tests) and produces a coherent verdict for every question type on every
sampled moment. It is reported as **MISSING SPEC ATTRIBUTION**, per your own
brief's instruction to report rather than paper over a gap in provenance:

> **MISSING IMPLEMENTATION / MISSING SPEC**
> - **File:** `src/astrology/rkp/watchJudgment.ts`
> - **Function:** `judgeWatchChart()`, `resolveState()`, `bandConfidence()`,
>   `firstObstruction()`, `computeTiming()`
> - **Expected responsibility:** per every other primitive in this codebase
>   (house matrix, sub-lord chain, dasha years, ruling-planet definitions),
>   the *specific numbers* driving a verdict should trace to an
>   owner-provided rule, cited by file and section.
> - **Current state:** the scoring weights, state thresholds, confidence
>   bands, obstruction precedence, and timing base-windows are original
>   engineering design, undocumented as owner-sourced anywhere.
> - **Recommendation:** if Astro Sarfaraz has a written or verbal
>   specification for the Digital Watch Oracle's exact scoring model, it
>   should be captured in a `docs/WATCH_ORACLE_RULES_FROM_SARFARAZ.md` (the
>   Watch Oracle's actual equivalent of the document that exists for the
>   deleted engine) and the engine's constants cross-referenced to it, the
>   same way `houseMatrix.ts` is. If no such specification exists, that is a
>   legitimate product decision to make now, not a bug to silently carry —
>   the numbers work and are internally consistent, but nobody outside this
>   engineering thread has signed off on `+2` vs `+3`, or on Saturn ranking
>   ahead of Mars.

---

## 6. Documentation fixed this session

- `docs/RKP_RULES_FROM_SARFARAZ.md`: replaced the false "aligned to the
  current runtime engine" status with an accurate, section-by-section
  breakdown of what's live (§2 house matrix, verified faithful; §2
  classification concept, with the substring→word-boundary drift noted) vs.
  what describes the deleted engine only (§1, §3-as-a-judgment-input, §4-as-
  a-judgment-input, §5, §6, §7). This document is cited as "source of truth"
  by six live files' docstrings; leaving its false status header in place
  would have misled the next reader (human or agent) into thinking the
  5-step Moon-Sub-Lord algorithm is what Oracle runs today.
- Minor, not fixed (noted for completeness, low stakes): `houseMatrix.ts`'s
  own docstring cites "§1" for the house-matrix table, which is actually §2
  in the spec doc; `questionKeywords.ts` cites "§2" for a detection-rule text
  that doesn't actually appear in the spec doc under that heading. Both are
  citation-numbering slips predating this session, cosmetic, and not
  followed further given the much larger status-header issue above already
  addresses the substantive risk (a reader trusting the wrong algorithm).

---

## 7. Performance — one finding, not acted on (rationale below)

`buildChart()` (`src/astrology/primitives/chartBuilder.ts`), the only
planet-position source `watchChart.ts` uses, unconditionally computes:

- 12 Placidus house cusps via a Newton-Raphson solver (the single most
  expensive step in the function), and
- the full day/hora/Ascendant/Moon ruling-planet set, which itself depends on
  the cusps for the Ascendant longitude,

on **every** Watch Oracle request — and `watchChart.ts` immediately discards
both (`cusps`, `rulingPlanets`, `horaLord` are never read; confirmed no other
live caller of `buildChart()` exists anywhere in the codebase, since the old
Astronomical Oracle that needed cusps was deleted in the prior audit pass).
This is genuine wasted computation on the hot path, not a correctness issue.

**Not fixed in this pass.** Two reasons: (1) cusps and the ruling-planet
computation are coupled (ruling planets need the Ascendant longitude the
cusp solver produces), so a clean fix means either threading a "skip cusps"
option through `buildChart()`'s ten-step body or splitting it into a
planets-only variant — a real structural change to a primitive this and the
prior audit both treated as protected, shared infrastructure, for a cost that
is genuinely small in absolute terms (a Newton solver converging over a
handful of iterations, likely low single-digit milliseconds) next to the
~25-second Claude synthesis call that already dominates every request's
latency. Flagging it here rather than gambling stability on a shared
primitive for a change whose real-world latency benefit is negligible.
Recommended, if ever revisited: add an optional `computeCusps: boolean`
parameter to `buildChart()` (default `true`, preserving every existing call
site's behavior) and have `watchChart.ts` pass `false`.

---

## 8. Test results

```
Client (jest):     173/173 passed (17 suites; 1 pre-existing, documented,
                    unrelated firestore.rules.test.ts Jest/ESM parse failure)
Functions (vitest): 36/36 passed
tsc --noEmit:       clean, both packages
eslint:             clean, both packages (max-warnings=0)
```

One test added: `watchChart.test.ts` — the REVERSING/reversal-consistency
regression described in §5a, covering both the general invariant (swept
across all question types) and the specific real-sky case that exposed the
bug.

The exhaustive verification sweeps described in §1 and §5a (112,896
moment/question combinations against the real ephemeris) were run as
throwaway probe scripts to establish the findings with actual evidence, not
committed to the repository — the properties they proved are now covered by
the permanent regression test and the pre-existing exhaustive boundary tests
in `watchGrid.test.ts`.

---

## Critical Issues

1. **[FIXED]** `state`/`reversal` retrograde-condition mismatch in
   `judgeWatchChart()` — see §5a. Real, user-facing, affected ~9% of sampled
   readings including 247 direct FULFILLED-vs-reversal-possible
   contradictions with no audit-trail explanation.

## High-Priority Findings (not code bugs — process/documentation)

2. **[DOCUMENTED, doc fixed]** The Watch Oracle's scoring weights, state
   thresholds, confidence bands, obstruction precedence, and timing
   base-windows have no owner-attributed specification — see §5b. Internally
   consistent and not touched; flagged for a product-owner decision.
3. **[DOCUMENTED, doc fixed]** `docs/RKP_RULES_FROM_SARFARAZ.md`'s "aligned
   to the current runtime engine" status was false for ~80% of its content —
   corrected with an accurate per-section breakdown.

## Medium-Priority Findings

4. Narration prose (`responseComposer.ts`) is validated for field presence
   only, not semantic agreement with the diagnosis — see §2. Reliance on
   model compliance, not a hard guarantee. Not fixed; a product-owner
   trade-off call.

## Low-Priority Findings

5. `buildChart()` computes Placidus cusps and the full ruling-planet set on
   every Watch Oracle request despite neither being consumed — see §7. Small
   real cost, not fixed given the coupling and negligible latency impact.
6. Two doc-citation numbering slips (`houseMatrix.ts` §1 vs. actual §2,
   `questionKeywords.ts` §2 citing text not present under that heading) —
   see §6. Cosmetic.

## What Was NOT Changed

No scoring weight, threshold, obstruction order, timing formula, dignity
table, friendship table, aspect table, or house matrix value was altered.
The only behavioral change in this pass is the `state`/`reversal` consistency
fix in §5a, which makes the code agree with its own already-tested,
already-documented contract — it does not introduce new astrological
judgment, it removes an accidental exception to an existing one.
