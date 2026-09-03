# RKP Rules - Source of Truth from Astro Sarfaraz

> **Status:** Aligned to the current runtime engine (`src/astrology/rkp/watchJudgment.ts`).
>
> *Note: The legacy KP astronomical judgment system (Cusp Sub-Lords as a
> promise gate, Moon Sub-Lord scoring, Ruling-Planet witnesses, Vimshottari
> Dasha timing — implemented in the now-deleted `judgeHorary.ts`) was
> permanently retired and removed. This document previously described that
> engine as current; it did not match the code for some time. It now
> strictly reflects the authoritative RKP Watch Engine mechanics below.*
>
> Origin: Astro Sarfaraz's rule intake (house matrix, question keywords,
> nakshatra/dasha constants) plus the current Watch Engine's own judgment
> method.
> Owner: Astro Sarfaraz

---

## 1. Core engine model

The current engine judges from the **Watch-Minute Ghar framework**, not
Placidus cusps: the watch minute at the moment of asking selects the 1st
Ghar, the twelve signs rotate through the Ghars from there, and real
sidereal planetary positions (Lahiri ayanamsa) drop into whichever Ghar
their true sign occupies. See `src/astrology/rkp/watchChart.ts` for the
chart build and `src/astrology/rkp/watchGrid.ts` for the Ghar-selection
math.

Deterministic inputs:

- Exact UTC timestamp of the question (read for the watch minute)
- Sidereal chart using Lahiri ayanamsa
- No location or house-cusp computation is used for judgment — the watch
  frame replaces cusps entirely, which is why a reading needs no lat/lon

Judgment relies strictly on:

1. **Target house selection** — mapped via the owner-sourced
   `houseMatrix.ts` (`primary` house per question type).
2. **Sidereal planet placement** — real ephemeris-based placement into
   Ghars (no simulation).
3. **Planetary dignity** — strength of the house's own ruler
   (`dignityOf`, `isStrong`/`isWeak` in `rules.ts`).
4. **Ruler relations** — how the querent's Lagna ruler regards the
   target house's ruler (`relationBetween`, `isBenefic`/`isMalefic`).
5. **Obstruction check** — malefic occupation/aspect on the target Ghar,
   in strict precedence, falling back to a Moon-in-8th/12th disagreement
   signal.

Every contribution is recorded in `factors`, so narration speaks from
actual chart facts and a reading can be audited after the event. This is
a deterministic weighted reading, not a black box.

Code: `src/astrology/rkp/watchJudgment.ts`

---

## 2. House Matrix

The following entries mirror the exact owner-provided table. This data is
still current and is imported directly by `watchJudgment.ts`.

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

App-retained extension categories that are not part of the owner's exact
pasted table:

| Question Type | Favorable Houses | Denial Houses | Primary | Secondary |
| ------------- | ---------------- | ------------- | ------- | --------- |
| enemies       | 6, 11            | 8, 12         | 6       | 11        |
| spiritual     | 5, 9, 12         | 6, 8          | 9       | 5, 12     |
| general       | 1, 11            | 8, 12         | 1       | 11        |

**Note (multi-house / compound events):** every entry above resolves to
exactly one `primary` house. There is currently no owner-authored rule
for how houses interact for compound events (e.g. litigation weighed
against the 6th, 7th and 12th together; disease-onset vs. recovery as
separate house pairs; earned wealth vs. windfall). That data does not
exist yet in this codebase in any form — see the companion intake
document `docs/MULTI_HOUSE_EVENT_INTAKE.md` for the structured request
prepared for Astro Sarfaraz to fill in before any compound-event logic is
implemented.

Code: `src/astrology/kp/rules/houseMatrix.ts`

---

## 3. Sidereal and Nakshatra constants

- Zodiac: sidereal only
- Ayanamsa: Lahiri only
- Nakshatra span: 13°20'
- Vimshottari order: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury
- Dasha years: Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17

These constants are retained as shared mathematical primitives (used
elsewhere in the app, e.g. dasha display) and provenance documentation.
**They are not consumed by the current judgment algorithm** —
`watchJudgment.ts` does not compute or use a sub-lord chain or dasha
timing for its verdict (see §6 below for how timing actually works now).

Code:

- `src/astrology/primitives/ayanamsa.ts`
- `src/astrology/primitives/subLord.ts`
- `src/astrology/kp/rules/nakshatras.ts`
- `src/astrology/kp/rules/vimshottari.ts`

---

## 4. Ruling Planets — not used by the current judgment

The legacy engine used 5 Classical KP Witnesses plus a confirmatory Hora
lord (Day Lord, Ascendant Sign/Star Lord, Moon Sign/Star Lord, Hora Lord)
as a scoring pass. **The current `watchJudgment.ts` does not use Ruling
Planet witnesses at all** — confirmed: nothing under `src/astrology/rkp/`
imports the ruling-planets primitive. The primitive itself
(`src/astrology/primitives/rulingPlanets.ts`) is retained only as a
shared calculation and may be used elsewhere in the app outside
judgment (e.g. display/remedy contexts) — verify at the call site before
assuming it feeds a verdict.

---

## 5. The current judgment algorithm

This replaces the old 5-step Cusp-Sub-Lord/Moon-Sub-Lord pseudocode,
which described `judgeHorary.ts` — a file that no longer exists. The
following is a faithful step-by-step account of `judgeWatchChart()` in
`src/astrology/rkp/watchJudgment.ts`:

```text
function judgeWatchChart(chart, qType):
  targetHouse = HOUSE_MATRIX[qType].primary
  target      = chart's Ghar at targetHouse
  fulfilment  = chart's Ghar at house 11
  targetRuler = target.ruler
  lagnaRuler  = chart.lagnaRuler

  score = 0

  # 1. Strength of the ruler that owns the matter
  if targetRuler is strong (dignity): score += 2
  else if targetRuler is weak:        score -= 2

  # 2. Querent's ruler vs. the matter's ruler
  relation = relationBetween(lagnaRuler, targetRuler)
  if relation == Friend: score += 2
  else if relation == Enemy: score -= 2

  # 3. Who occupies or aspects the target Ghar
  for each planet occupying or aspecting target:
    if benefic: score += 2
    else if malefic: score -= 2

  # 4. Who occupies or aspects the 11th Ghar (fulfilment)
  for each planet occupying or aspecting fulfilment:
    if benefic: score += 2
    else if malefic: score -= 2

  # 5. Where the matter's ruler itself has landed
  if targetRuler's house in matrix.favorable: score += 1
  else if targetRuler's house in matrix.denial: score -= 1

  # 6. Retrogression / combustion
  reversal = POSSIBLE if targetRuler or lagnaRuler is retrograde else NONE
  if targetRuler is combust: score -= 1

  # 7. Obstruction (strict precedence: Saturn > Mars > Rahu > Ketu,
  #    occupying beats aspecting; falls back to Moon in 8th/12th)
  obstruction = firstObstruction(chart, targetHouse)

  # 8. Settle the state
  state = BLOCKED   if score <= -5
        = REVERSING if targetRuler is retrograde
        = FULFILLED if score >= 5
        = DELAYED   if obstruction == Saturn or targetRuler is weak
        = MOVING    if score >= 2
        = UNFORMED  otherwise

  # 9. Confidence, downgraded when witnesses disagree
  confidence = band(|score|): >=6 VERY_HIGH, >=4 HIGH, >=2 MODERATE,
                               >=1 LOW, else UNCERTAIN
  downgrade one band if both a benefic and a malefic witnessed the matter,
  or if obstruction is a Moon-disagreement signal
```

Every `+2`/`-2`/`+1`/`-1` contribution above is recorded verbatim into
the verdict's `factors` array as it happens — narration is generated
from those recorded facts, never independently.

Code: `src/astrology/rkp/watchJudgment.ts`

---

## 6. Timing

This replaces the old dasha/nakshatra-lord-based timing description.

Timing is **not** dasha-based in the current engine. It is derived from
the target house ruler's own classical planetary speed:

```text
function computeTiming(chart, ruler):
  base = BASE_TIMING[ruler]   # classical baseline window, e.g.
                               # Moon 3-7 days ... Saturn 90-150 days
  factor = 1
  if ruler is retrograde: factor *= 1.5
  if ruler is weak (dignity): factor *= 1.5
  if ruler is exalted: factor *= 0.7

  return { minDays: base.minDays * factor, maxDays: base.maxDays * factor }
```

Timing is omitted (`null`) entirely when the state is `UNFORMED`.

Code: `src/astrology/rkp/watchJudgment.ts`

---

## 7. Output contract notes

Current decisive payload in the verdict (`WatchVerdict` /
`DisplayWatchVerdict`, `src/astrology/rkp/watchJudgment.ts`):

- `targetHouse` / `targetSignName` / `targetRuler` / `targetRulerName`
- `fulfilmentHouse` (always 11)
- `lagnaRuler` and `rulerRelation` (Friend/Enemy/Neutral, etc.)
- `state`, `confidence`, `score`
- `obstruction`, `reversal`
- `timing` (nullable `{ minDays, maxDays }`)
- `direction`, `afflictedDirection`, `controllerProfile`
- `factors` — the ordered, human-readable reasoning trail

`DisplayWatchVerdict` is the wire shape: `obstruction`, `targetRuler` and
`lagnaRuler` are boundary-mapped to display names (`Ras`/`Dhanab` for the
nodes) before leaving the server — see
`functions/src/utils/planetBoundaryName.ts`.

The old CSL-based verdict contract remains removed from the runtime path.

---

## 8. Remaining provisional areas

The following still need explicit owner confirmation if they are to be
treated as authoritative cultural output rather than engineering
placeholders:

- remedy mapping
- EN/UR/HI narration wording
- **Multi-house / compound event judgment** (litigation, health crises,
  financial windfalls, and similar compound scenarios) — no owner rule
  exists for this yet. See `docs/MULTI_HOUSE_EVENT_INTAKE.md`.

These do not change the underlying deterministic verdict logic described
above.
