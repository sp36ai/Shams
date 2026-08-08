# RKP — Watch of Currents: the Clock-Based Engine

> Status: **live in production.** `askOracle.ts` calls `judgeRKPWatch()`.
> Source: user-supplied RKP elaboration (chat) — this document does not
> introduce any table or threshold not already given there, except where
> explicitly marked "confirmed default" (the classical support/obstruction
> toolkit, chosen by the project owner from three offered options).

## What this replaced

Earlier in this engine's history, "RKP" meant a sub-lord scoring variant of
KP (`judgeHorary.ts`). The project owner clarified that the *authentic* RKP
is a different system entirely: a clock-based horary method with no birth
chart and no Placidus cusps for house determination. `askOracle.ts` now
runs `judgeRKPWatch()` exclusively.

`judgeHorary.ts` and `currentReading.ts` are **not deleted** — they remain
in the codebase, fully tested, unused in production, following the same
precedent as `judgeKP.ts` (classical KP, also built and tested but never
wired into `askOracle.ts`). `remedyTable.ts` and `arabicNames.ts` were
extracted out of `judgeHorary.ts` so `judgeRKPWatch.ts` could share them
without duplicating the data; `judgeHorary.ts`'s own behavior is unchanged
by that extraction (see its own test suite, still green).

## The mechanism

```
Question moment (local minute)
  → 5-minute bucket (00-04 → Aries, 05-09 → Taurus, ... 55-59 → Pisces)
  → that sign IS house 1 (Lagna) directly — no external reference chart
  → houses 2-12 cascade forward in natural zodiacal order (whole-sign)
  → real transiting planets (Moshier + Lahiri, same ephemeris as the other
    two engines) are placed into these houses by sign only
  → the question's PRIMARY house (existing HOUSE_MATRIX, unchanged) is
    looked up on this wheel
  → that house's classical sign-lord is analyzed for support/obstruction
  → cross-checked against Moon's real sub-lord and 4 ruling-planet witnesses
  → combined into one of 6 verdict states → timing via existing dasha
    convergence machinery
  → in parallel: a household Vastu scan reads every planet's current
    direction (independent of the question) and flags which directions
    currently hold a malefic
```

Confirmed against the user's own 10:51 PM worked example: minute 51 → bucket
10 → Aquarius/1st, cascading exactly to Pisces/2nd, Aries/3rd, Taurus/4th,
Gemini/5th, Cancer/6th, Leo/7th, Virgo/8th, Libra/9th, Scorpio/10th,
Sagittarius/11th, Capricorn/12th — see
`src/astrology/primitives/__tests__/watchChart.test.ts`.

## Code

- `src/astrology/primitives/watchChart.ts` — the clock chart primitive
  (Lagna selection, house wheel, planet placement by sign).
- `src/astrology/kp/judgment/judgeRKPWatch.ts` — the judgment engine
  (house-lord analysis, Moon confirmation, ruling-planet confirmation,
  verdict combination, timing).
- `src/astrology/types/watchVerdict.ts` — the `WatchVerdict` output contract.

## The one confirmed-default piece

Neither source document gives exact support/obstruction weights — only the
concept ("must be judged in relation to the question, not a fixed label").
The project owner selected the **standard classical toolkit** as the
default (of three offered): dignity (exalted/own = support, debilitated =
obstruction), conjunction with benefics/malefics sharing the lord's
clock-house, classical Vedic aspects (7th for all planets, plus Mars'
4th/8th, Jupiter's 5th/9th, Saturn's 3rd/10th), combustion (obstruction),
retrograde (recorded as a delay modifier, not scored). This is standard
astrological technique applied to the RKP framework, not itself sourced
from the RKP material — fully adjustable.

## Vastu direction mapping

"The entire 360-degree compass layout of your physical living space is
mapped directly onto the 12 numbers of a standard clock face" (source
material). Two direction tables were supplied in the same message:

- A 12-row table worked for one specific Aquarius-Lagna chart, using
  8-point directions (adds NE/SE for 2 of its 12 rows: Pisces, Taurus).
- A standalone 4-cardinal table, keyed by sign rather than house, following
  the classical element correspondence: East = fire (Aries/Leo/Sagittarius),
  South = earth (Taurus/Virgo/Capricorn), West = air (Gemini/Libra/Aquarius),
  North = water (Cancer/Scorpio/Pisces).

These two agree on **10 of 12** entries once the worked table's houses are
converted to signs; they disagree only on Pisces (North vs. North-East) and
Taurus (South vs. South-East). The 4-cardinal table is used as the
canonical rule (`watchChart.ts`'s `SIGN_DIRECTIONS`): it is sign-based (so
it doesn't depend on which house a sign currently occupies as the Lagna
moves), internally consistent with the classical element scheme, and
matches the majority of the worked example's own rows. Revisit if the
8-point version turns out to be the intended one.

The engine surfaces two structured facts from this, independent of any
specific question:

- `houseLord.direction` — the physical direction of the currently activated
  (primary) house.
- `vastu.occupantsByDirection` / `vastu.afflictedDirections` — a full
  household scan of where all 9 grahas currently sit by direction, and
  which directions hold at least one natural malefic.

No remedy text ("clear the clutter," "use a round white clock") is
generated by the engine — per the source material's own separation rule,
that phrasing is a presentation-layer concern.

## Local time caveat

The source material requires the querent's exact civil local minute (their
real wristwatch — timezone- and DST-aware). The engine's current inputs
(timestamp + lat/lon) don't carry a timezone, so `judgeRKPWatch()` accepts
an optional `timezoneOffsetMinutes`; when omitted it falls back to the same
local-*solar*-time approximation already used elsewhere in this codebase for
Day/Hora Lord (`primitives/rulingPlanets.ts`). This is a labeled
simplification, not a fabricated rule — solar and civil time can differ by
tens of minutes, which changes the 5-minute bucket. Wiring in a real
timezone (from lat/lon via a tz-lookup, or from the client) would remove
this caveat.

## Confidence, narration, remedy

Implemented and wired in (see `computeConfidence()` / `buildNarration()` in
`judgeRKPWatch.ts`):

- **Confidence** — the source material's 7-factor, 50-point-base model. 5 of
  7 factors are computed (sub-lord clarity, Moon agreement, ruling-planet
  overlap, retrograde affliction, timestamp precision — always +5, this app
  always supplies GPS-derived lat/lon). Multi-Cusp Agreement and Chart
  Cleanliness/Void-of-Course are part of the documented model but not yet
  implemented (see Strictures below) — they contribute 0, not an invented
  value.
- **Narration** (EN/UR/HI) and **remedy** — keyed on the activated house's
  lord, the decisive planet in this engine (the role Moon's sub-lord plays
  in `judgeHorary.ts`). Reuses the shared `remedyTable.ts` / `arabicNames.ts`
  so both engines speak with the same voice.

## Explicitly deferred (not oversights)

- **The 8 classical strictures** (Via Combusta, Void of Course, Ascendant
  edge degrees, Saturn in 1st/7th, extreme retrograde, planetary war,
  timestamp quality, multiple-questions-in-one) — not yet checked.
- **Third-person question rotation** (asking about a spouse/child/etc. —
  rotates which house is "self") — product/UX feature, not yet built.
- **Multi-Cusp Agreement and Chart Cleanliness confidence factors** — part
  of the documented model, blocked on the strictures work above.

## Production wiring

`askOracle.ts` calls `judgeRKPWatch(chart, classified)` with no
`timezoneOffsetMinutes` (the client doesn't send one yet — see the Local
time caveat above), and maps its `WatchVerdict` onto the existing
`OracleResponse` contract (`functions/src/types.ts`):

- `rulingPlanets.ascStarLord` and `.horaLord` are omitted (`undefined`) —
  neither concept applies to a whole-sign watch Lagna.
- `significators` (KP's favorable/denial/neutral sets) is omitted — this
  engine doesn't compute them. `confirmedSignificators`/`deniedSignificators`
  map to the ruling witnesses that actually landed in a favorable/denial
  clock-house — the closest honest analog.
- `horaryNumber` is no longer generated — it was specific to
  `judgeHorary.ts`'s witness model.
- Three new optional response fields carry this engine's own facts forward:
  `nativeState` (the finer 6-state verdict), `houseLordDirection`, and
  `vastuAfflictedDirections` — plumbed through `src/firebase/oracle.ts` into
  `Reading.verdictJson` for future UI use, not yet rendered by any screen.

The client already treats every ruling-planet/significator field as
optional (`if (rp?.ascStarLord)` etc. in `OracleChatScreen.tsx`), so the
narrower witness set degrades gracefully — fewer chips render, nothing
crashes. The main verdict card (verdict, confidence, narration, timing,
remedy) is fully populated by the new engine and unaffected.
