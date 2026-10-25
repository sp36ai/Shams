# RKP Rules: Source of Truth from Astro Sarfaraz

> Status: reconciled with the running engine on 2026-10-25 (documentation only; no behaviour changed)
> Owner: Astro Sarfaraz
> Canonical code: `src/astrology/` (mirrored to `functions/src/engine/` by `functions/scripts/sync-engine.mjs`;
> `npm run verify-engine-sync` fails if the mirror drifts). The server runs the mirror, via `askWatchOracle`.

This document has three parts:

- **Part A, Implemented behaviour:** what the RKP Watch Engine computes today. Every rule here has
  a code reference.
- **Part B, Owner decisions in force:** decisions that constrain the engine, including the
  2026-10-25 decisions not to add new rules.
- **Part C, Not implemented / proposed only:** ideas that appear in product copy or earlier designs
  but are **not** engine behaviour. Nothing in Part C may be described as how a reading is judged.

If this document and the code disagree, the code is what runs. Report the disagreement to the owner;
do not "fix" the code to match this document without an owner decision.

---

# Part A: Implemented behaviour

## A1. Pipeline

```text
Oracle UI (text, or voice → speech-to-text → the same question text)
  → askWatchOracle (App Check, Auth, Zod, rate limit, idempotency claim, quota slot)
  → buildWatchChart(moment)            src/astrology/rkp/watchChart.ts
  → classifyQuestion(question)         src/astrology/kp/rules/questionKeywords.ts
  → judgeWatchChart(chart, qType)      src/astrology/rkp/watchJudgment.ts
  → diagnose(verdict)                  src/astrology/rkp/diagnosis.ts
  → selectRemedyProtocol(diagnosis)    functions/src/oracle/remedySelection.ts
  → compose + validate narration       functions/src/oracle/responseComposer.ts, narrationValidator.ts
  → Firestore /readings + audit log → client → MMKV history
```

Only the steps up to and including `diagnose` + `selectRemedyProtocol` decide anything. Narration
explains the result and cannot change it (enforced by `functions/src/oracle/__tests__/verdictInvariance.test.ts`).

## A2. The moment of the question

- The **instant** is the server's own clock (`Date.now()`). It is never client-supplied, so a
  reading cannot be replayed or re-rolled by choosing a time.
- The **UTC offset** is supplied by the client, because only the device knows the querent's zone.
  The server combines the two into a local-offset ISO string (`functions/src/utils/localTime.ts`).
- **Location is not used.** The watch frame replaces horizon house cusps, and planet longitudes are
  apparent geocentric positions, the same for every observer at a given instant. So location would
  not change any result (`watchChart.ts` header).

## A3. The watch frame: 12 five-minute brackets (`watchGrid.ts`)

- The querent's **local wall-clock minute** is read from the literal minute field of the
  offset-bearing ISO string. It is not read through `Date#getMinutes()`, which would use the
  server's zone.
- The hour is split into twelve half-open 5-minute brackets: `[00,05)` → bracket 0 … `[55,60)` → bracket 11.
- The bracket fixes the sign of the **1st Ghar**: bracket 0 = Burj Hamal (Aries) … bracket 11 =
  Burj Hoot (Pisces). The other eleven Ghars follow in zodiacal order.
- This is a moment-selected house frame. It is **not** the horizon Ascendant computed by
  `primitives/houseCusps.ts`, and the two must not be substituted for each other.
- The lagna ruler is the domicile ruler of the 1st Ghar's sign.

## A4. Planets (`watchChart.ts` → `primitives/chartBuilder.ts`)

- These are real positions from the in-process Meeus / VSOP87 (Moshier) ephemeris
  (`primitives/moshier/`), converted to sidereal with **Lahiri** ayanamsa (`primitives/ayanamsa.ts`).
- The nine bodies are Shams, Qamar, Mirrikh, Utarid, Mushtari, Zuhra, Zuhal, Ras and Dhanab (internally
  Sun … Saturn, Rahu, Ketu; the nodes are renamed at the server boundary by
  `functions/src/utils/planetBoundaryName.ts`).
- Each planet carries its real sign and degree, retrograde flag and combustion flag (thresholds in
  `primitives/constants.ts`, `COMBUSTION_THRESHOLD_DEG`).
- Each planet drops into the Ghar its **real sign** occupies under the watch frame.
- `chartBuilder` also computes horizon cusps (Placidus), nakshatra, sub-lord, ruling planets and
  hora lord. **The watch judgment uses none of these.** The cusps are discarded. Hora, day lord and
  ruling planets are shown only in client UI (Sky Clock, hora countdown, timing strip).

## A5. Rule tables (`rules.ts`, `nomenclature.ts`)

**Dignity** (`dignityOf`), with precedence exaltation → debilitation → own sign → relation to
the sign's ruler:

| Planet             | Exalted     | Debilitated | Own signs              |
| ------------------ | ----------- | ----------- | ---------------------- |
| Shams (Sun)        | Hamal (1)   | Meezan (7)  | Asad (5)               |
| Qamar (Moon)       | Saur (2)    | Aqrab (8)   | Sartan (4)             |
| Mirrikh (Mars)     | Jadi (10)   | Sartan (4)  | Hamal (1), Aqrab (8)   |
| Utarid (Mercury)   | Sunbula (6) | Hoot (12)   | Jauza (3), Sunbula (6) |
| Mushtari (Jupiter) | Sartan (4)  | Jadi (10)   | Qaus (9), Hoot (12)    |
| Zuhra (Venus)      | Hoot (12)   | Sunbula (6) | Saur (2), Meezan (7)   |
| Zuhal (Saturn)     | Meezan (7)  | Hamal (1)   | Jadi (10), Dalw (11)   |
| Ras (Rahu)         | Saur (2)    | Aqrab (8)   | none                   |
| Dhanab (Ketu)      | Aqrab (8)   | Saur (2)    | none                   |

Otherwise the dignity is FriendlySign, NeutralSign or EnemySign, according to how the planet
regards the sign's ruler.

- **Strong** = Exalted or OwnSign. **Weak** = EnemySign or Debilitated.
- **Friendship:** the classical natural-friendship table, which is asymmetric (`FRIENDSHIP` in `rules.ts`).
- **Aspects (Nazar):** every planet aspects the 7th from itself. Mirrikh also aspects the 4th and
  8th, Mushtari the 5th and 9th, and Zuhal the 3rd and 10th. The nodes take Mushtari's pattern (5, 7, 9).
  Distances are counted inclusively.
- **Benefics:** Mushtari, Zuhra. **Malefics:** Zuhal, Mirrikh, Ras, Dhanab. Shams, Qamar and
  Utarid are neither, for scoring purposes.
- **Direction by sign element:** fire = East, earth = South, air = West, water = North.

## A6. House matrix (`src/astrology/kp/rules/houseMatrix.ts`)

This is the owner-provided table. The watch judgment reads `primary` (the target Ghar) plus `favorable` /
`denial` (where the matter's ruler has landed). The `secondary` column is kept for traceability
and is **not read by the judgment**. The diagnosis reports `favorable` / `denial` as supporting and
obstructing houses.

| Question Type | Favorable Houses | Denial Houses | Primary | Secondary |
| ------------- | ---------------- | ------------- | ------- | --------- |
| career        | 6, 10, 11        | 5, 8, 12      | 10      | 6, 11     |
| marriage      | 7, 11, 2         | 6, 8, 12      | 7       | 2, 11     |
| finance       | 2, 6, 11         | 8, 12         | 2       | 6, 11     |
| health        | 1, 5, 11         | 6, 8, 12      | 1       | 5, 11     |
| property      | 4, 11, 2         | 8, 12         | 4       | 11, 2     |
| travel        | 3, 9, 12         | —             | 9       | 3, 12     |
| business      | 7, 10, 11        | 6, 8, 12      | 7       | 10, 11    |
| legal         | 6, 11            | 8, 12         | 6       | 11        |
| children      | 5, 11, 2         | 1, 4, 10      | 5       | 2, 11     |
| education     | 4, 9, 11         | 8, 12         | 4       | 9, 11     |
| lostitem      | 2, 4, 11         | 8, 12         | 2       | 4, 11     |

App-retained extension categories that are not part of the owner's exact pasted table:

| Question Type | Favorable Houses | Denial Houses | Primary | Secondary |
| ------------- | ---------------- | ------------- | ------- | --------- |
| enemies       | 6, 11            | 8, 12         | 6       | 11        |
| spiritual     | 5, 9, 12         | 6, 8          | 9       | 5, 12     |
| general       | 1, 11            | 8, 12         | 1       | 11        |

## A7. Question classification (`questionKeywords.ts`)

- The question is normalised (lowercased, whitespace collapsed; Urdu and Hindi preserved). Then the
  first whole-word keyword match wins, checked in the order career, marriage, finance, health,
  property, travel, legal, education, business, children, lostitem, enemies, spiritual. If nothing
  matches, the type is `general`.
- `functions/src/oracle/questionScope.ts` declines off-topic questions before any chart is cast.

**Lending and returning questions** (owner decision, 2026-10-08). No new house table was added.

- **An object** is judged as `lostitem` (primary 2nd Ghar).
- **Money** is judged as `finance` (primary 2nd Ghar). Finance is checked before lostitem, so "the
  money I lent" is finance.
- Keywords: lostitem includes lend, lent, borrow, borrowed, give back, gave back, give me back, give my,
  return my, returned my, واپس دے / واپس کرے / واپس کریں, वापस देगा / देगी / करेगा / करेगी.
  Finance adds owe, owes, owed, repay, repaid and credit (ادھار / उधार / udhaar), but not
  "udhar", which also means "there".

## A8. Judgment (`watchJudgment.ts`, `judgeWatchChart`)

Let T = the primary (target) Ghar for the question type, R = the ruler of T's sign, and L = the lagna ruler.
Each step that applies is recorded verbatim in `factors`.

| Step | Condition                                                                         | Score        |
| ---- | --------------------------------------------------------------------------------- | ------------ |
| 1    | R strong / R weak                                                                 | +2 / −2      |
| 2    | L regards R as Friend / Enemy (**skipped when L = R**, owner decision 2026-10-08) | +2 / −2      |
| 3    | Each benefic / malefic sitting in **or** aspecting T                              | +2 / −2 each |
| 4    | Each benefic / malefic sitting in or aspecting the **11th Ghar** (fulfilment)     | +2 / −2 each |
| 5    | R sits in a favorable / denial house for the question type                        | +1 / −1      |
| 6    | R combust                                                                         | −1           |

Then the engine works out:

- **Reversal** = `POSSIBLE` if R or L is retrograde, else `NONE`.
- **Obstruction**, in strict precedence: a malefic **sitting in** T (Zuhal > Mirrikh > Ras > Dhanab),
  then a malefic **aspecting** T (same order), then `MoonDisagreement` if Qamar is in the 8th or
  12th Ghar, otherwise `None`.
- **State**, checked in this order:
  1. score ≤ −5 → `BLOCKED`
  2. R retrograde → `REVERSING`
  3. score ≥ 5 → `FULFILLED`
  4. obstruction is Zuhal, or R is weak → `DELAYED`
  5. score ≥ 2 → `MOVING`
  6. otherwise → `UNFORMED`
- **Confidence** from |score|: ≥ 6 VERY_HIGH, ≥ 4 HIGH, ≥ 2 MODERATE, ≥ 1 LOW, else UNCERTAIN. It is
  downgraded one step when both a benefic and a malefic fall on T, and one step for `MoonDisagreement`.
- **Direction** = direction of T's sign. **Afflicted direction** = direction of the obstructing
  planet's sign. Both are reported and **not scored**.
- **Controller profile** = Assertive if T's sign is odd, otherwise Receptive. It is used by the diagnosis,
  not the score.

**Moon factors used today:** only the `MoonDisagreement` obstruction (Qamar in the 8th/12th), plus the
Moon's ordinary role as a planet that can sit in or aspect a Ghar. The Moon is neither benefic nor
malefic here.

## A9. Timing (`computeTiming`)

The timing window comes from R's base window:

| R            | Base window (days) |
| ------------ | ------------------ |
| Qamar        | 3–7                |
| Utarid       | 7–14               |
| Zuhra        | 10–21              |
| Shams        | 14–30              |
| Mirrikh      | 30–60              |
| Ras / Dhanab | 45–90              |
| Mushtari     | 60–90              |
| Zuhal        | 90–150             |

Multipliers: ×1.5 if R is retrograde, ×1.5 if R is weak, ×0.7 if R is exalted. Results are rounded.
Timing is `null` when the state is `UNFORMED`. **No lunar-cycle, transit or dasha calculation
determines timing.**

## A10. Diagnosis (`diagnosis.ts`)

Six states become eight outcomes:

| State     | Base outcome | Refinement                                                         |
| --------- | ------------ | ------------------------------------------------------------------ |
| FULFILLED | FAVOURABLE   | becomes CONDITIONAL if any obstruction                             |
| MOVING    | ESCALATING   | becomes CONDITIONAL if any obstruction                             |
| DELAYED   | DELAYED      | becomes PREMATURE if the earliest window is more than 45 days away |
| BLOCKED   | UNFAVOURABLE |                                                                    |
| REVERSING | DECLINING    |                                                                    |
| UNFORMED  | UNCERTAIN    |                                                                    |

The diagnosis also produces:

- an imbalance pattern profile (from the obstructing agent, the outcome, an enemy ruler relation,
  reversal and controller profile);
- a timing posture: ACT_NOW, ACT_SOON (window ≤ 14 days), WAIT (≤ 45 days or unfavourable),
  WAIT_LONG or UNKNOWN;
- `interventionNeeded = false` (**no remedy**) when the outcome is FAVOURABLE, nothing obstructs,
  confidence ≥ 0.8 and there is no reversal.

## A11. Remedies (`functions/src/oracle/remedyLibrary.ts`, `remedySelection.ts`)

- Remedies come only from the controlled library of **32** entries across five categories:
  contemplative, devotional, astrological, behavioral and practical (professional escalation).
- Selection is driven by the diagnosis (patterns and outcome), filtered by tradition (default
  `universal` + `islamic`). Mandatory professional escalation applies to the question types in
  `MANDATORY_ESCALATION_TYPES`.
- Qur'ānic verses, Divine Names, duas and acts such as sadaqa appear **inside specific library
  entries**, and only when those entries are selected. Readings do not always contain all four.
- Remedy names, instructions and evidence labels are copied verbatim from the library after
  narration. The model never writes remedy text.

## A12. Narration (`functions/src/prompts/watchOracleSynthesisPrompt.ts`, `responseComposer.ts`)

- Voice: warm, direct, answer-first (owner decision 2026-10-14).
- The model writes prose fields only: `rkp_finding`, `interpretation`, `recommended_approach`,
  `why_this_remedy` and `signature`. The fixed `ORACLE_BRAND_SEAL` is attached after the model returns.
- `narrationValidator.ts` rejects prose that contradicts or goes beyond the engine's findings. If
  synthesis fails, a deterministic fallback is used, and the reading keeps its verdict and remedies.
- Audio (TTS) speaks the server-validated `speakableText`. For older readings that lack it, it falls
  back to the plain-language state headline (`src/components/oracle/ChatBubble.tsx`). Audio never
  generates a separate judgment.

---

# Part B: Owner decisions in force

| Date       | Decision                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-08 | When one planet rules both the querent and the matter, judgment step 2 adds no score and states no factor.                         |
| 2026-10-08 | Lending and returning: objects → `lostitem`, money → `finance`. No new house table.                                                |
| 2026-10-14 | Narration voice is warm, direct and answer-first (replaced the manuscript register).                                               |
| 2026-10-25 | The audit in `docs/SHAMS_SPEC_VS_RKP_ENGINE.md` is the accepted baseline. The RKP Watch Engine is the sole authority for judgment. |
| 2026-10-25 | 1. Keep the 12 five-minute Ghar brackets. No watch-theme scoring.                                                                  |
| 2026-10-25 | 2. No four-quadrant scoring.                                                                                                       |
| 2026-10-25 | 3. Keep the existing Moon factors. Moon phase and lunar mansion stay informational.                                                |
| 2026-10-25 | 4. No angular-strength scoring.                                                                                                    |
| 2026-10-25 | 5. No directional scoring. Direction stays descriptive.                                                                            |
| 2026-10-25 | 6. Keep the six states and eight outcome mappings. No separate Danger state.                                                       |
| 2026-10-25 | 7. Keep the planet-specific timing windows and adjustments. Do not imply lunar-cycle or transit timing.                            |
| 2026-10-25 | 8. Keep the 32-entry library and diagnosis-based selection. Clean charts remain eligible for no remedy.                            |
| 2026-10-25 | 9. Keep the direct, answer-first voice.                                                                                            |
| 2026-10-25 | 10. Keep location out of judgment unless an approved rule requires it.                                                             |
| 2026-10-25 | 11. This document reconciled with the running code (this revision).                                                                |

Also in force: no generic weighted scoring formula, and no second judgment backend (e.g. a separate
FastAPI engine), may replace or run alongside `judgeWatchChart`.

---

# Part C: Not implemented / proposed only

None of the following is engine behaviour. Each would need a written owner rule, a defined effect on
the score or state, and regression tests before it could be built.

- Watch themes (expansion, testing, illusion, structural foundation, …) attached to brackets or horas.
- Initiation / stabilization / expansion / dissolution quadrants and rules built on them.
- Moon phase (waxing/waning) or lunar mansion (`src/astrology/manazil.ts`, display-only) as scoring inputs.
- Angularity (kendra) weighting.
- Directional reinforcement scoring.
- A "Danger" outcome distinct from BLOCKED / UNFAVOURABLE.
- Timing from lunar cycles, transits, dasha periods or watch repetition.
- A fixed four-part remedy (verse + Divine Name + dua + act) on every reading.
- Location as a judgment input.

### Superseded (removed from the runtime, kept here for history only)

Earlier revisions of this document described a KP-style 5-step Moon-sub-lord algorithm:

- a cusp-sub-lord "promise" gate;
- Moon sub-lord house scoring;
- ruling-planet witnesses (day, ascendant sign/star, Moon sign/star, hora);
- verdicts YES / NO / CONDITIONAL / DELAYED;
- dasha-based timing.

That algorithm lived at `src/astrology/kp/judgment/judgeHorary.ts`, which **no longer exists**. The KP
judgment path has been intentionally removed and must not be reinstated. The shared primitives it
used (Lahiri ayanamsa, nakshatra and sub-lord tables, ruling-planet and hora calculations) remain in
`src/astrology/primitives/` and `src/astrology/kp/rules/` as mathematics and for UI display. They are
not inputs to the judgment.
