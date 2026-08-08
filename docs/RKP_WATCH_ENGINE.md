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
- `src/astrology/kp/judgment/classicalToolkit.ts` — dignity, benefic/malefic,
  drishti, occupation/aspect helpers, `houseLordAnalysis()`.
- `src/astrology/kp/judgment/rkpTriad.ts` — the Verdict Triad protocol.
- `src/astrology/kp/judgment/rkpRemedy.ts` — RKP's material micro-remedies.
- `src/astrology/primitives/planetaryRelations.ts` — natural friendship/enmity.
- `src/astrology/types/watchVerdict.ts` — the `WatchVerdict` output contract.

## The Verdict Triad

The engine originally judged the target house alone. The RKP material's
"CORE PREDICTIVE PROTOCOL" makes the verdict a **three-point** relationship:

| Point | House | Meaning |
|---|---|---|
| Querent | 1st | the seeker's own energy and capacity |
| Query | target house (from `HOUSE_MATRIX`) | the matter itself |
| Fulfilment | 11th | whether the desire actually materialises |

`analyseTriad()` runs `houseLordAnalysis()` on all three, then adds:

- **Ruler clash** — the natural friendship/enmity of the 1st-house ruler
  and the target-house ruler (`planetaryRelations.ts`). The material's own
  example: Sun (Leo Lagna) vs. Saturn (Capricorn 6th) = enemies = "hard
  bureaucratic delay, rigid rules, refusal to adjust".
- **Malefic affliction / benefic rescue** on the target and 11th houses —
  Rahu/Ketu/Mars occupying or aspecting vs. Jupiter/Venus doing the same.
- **Polarity profiles** — odd Lagna sign = masculine/direct querent, even
  target sign = feminine/administrative controller.

### The outcome ladder

The material names three outcomes but not their precedence, and a chart can
satisfy more than one. They are resolved most-severe-first:

1. **blocked** — the target or 11th house is *heavily* afflicted by
   Rahu/Ketu/Mars with zero benefic support.
2. **delayed** — the target ruler is weak (debilitated, combust, or a
   net-obstructed tally), retrograde, under Saturn's aspect, or clashing
   with the Lagna ruler.
3. **positive** — friendly or strong rulers (or Jupiter on the target) and
   an 11th house clear of malefics.
4. **mixed** — none of the three fully met; reported as unresolved rather
   than forced into one of them.

`combineVerdict()` then lets the Moon sub-lord and the ruling witnesses
sharpen `positive` into `YES_STRONG`, soften it to `YES_CONDITIONAL`, or —
when both contradict outright — reduce it to `INCONCLUSIVE`. They never
overturn a `blocked` triad, which the material treats as structural.

### Three readings that needed a judgement call

These are documented rather than silently decided — all three are
adjustable:

1. **A house's own lord never afflicts it.** Read literally, "Mars sitting
   in your 6th house" would make every Mars-ruled house self-afflicting the
   moment Mars occupies its own sign — classically the opposite of the
   truth. The lord's condition is judged separately by
   `houseLordAnalysis()`; the affliction test is about intruders only.
2. **"Heavily afflicted" needs a threshold.** Mars alone aspects three
   houses, so a literal reading would deny most charts. Heavy = a malefic
   actually *occupying* the house, or two or more bearing on it.
3. **A weak ruler delays, it does not deny.** The material puts "the target
   house ruler is weak" under *Delayed* ("it WILL happen, but only after
   strict corrections") and reserves denial for malefic affliction. Denial
   is therefore reachable only through rung 1.

## The condition state — a second, parallel classification

`rkpConditionState.ts` classifies the *mechanism* the matter is in, using
the material's Sanskrit six. This is **additive**: it does not replace
`nativeState`.

| Field | Set | Role |
|---|---|---|
| `nativeState` | YES_STRONG / YES_CONDITIONAL / DELAY / WAIT / NO_DENIED / INCONCLUSIVE | what to TELL the seeker — drives the UI, share text and the oracle's unveiling heading |
| `conditionState` | Siddhi / Stambhana / Gati / Vakra / Kshaya / Bija | what MECHANISM the matter is in — diagnostic |

A seeker is never shown "Stambhana". Collapsing to one set is
[open question 6](RKP_OPEN_QUESTIONS.md).

The precedence ladder follows the reference implementation exactly where it
is explicit — Saturn before Mars/Rahu before exaltation — and the prose
definitions for the two states that implementation never reaches:

1. **Stambhana** — Saturn bears on the house of the matter.
2. **Kshaya** — a Rahu/Ketu eclipse point on that house, then Mars on it,
   then a debilitated ruler. These sit *above* the generic blocked check:
   when a block is caused by an eclipse point, the material calls it decay,
   not blockage.
3. **Stambhana (residual)** — blocked by something other than those, e.g.
   affliction of the 11th rather than the target.
4. **Vakra** — any of the three triad rulers retrograde.
5. **Siddhi** — positive triad, dignified ruler, and *no* blocking malefic
   on either the target or the 11th ("clean connectivity").
6. **Gati** — the matter is in motion without that unbroken connectivity.
7. **Bija** — terminal: a genuine question whose timing has not matured.

## The anchor validation layer

`functions/src/prompts/oracleAnchorsSchema.ts` is a Zod schema sitting
between calculation and text generation — the material's Pydantic layer,
in this stack. `deriveOracleAnchors()` is already statically typed, so the
schema exists for what types cannot catch at runtime: an engine change that
starts emitting an out-of-range value, or a malformed timing string that
would otherwise reach the prompt and become a fabricated date.

It **fails open** — logs and continues, rather than the hard throw the
material describes. A seeker who has already spent quota should still get
their reading, and every anchor has a safe fallback in the prompt.
`parseOracleAnchors()` throws if a hard failure is ever wanted.

## Confidence — conflicting signals now downgrade the score

"If the AI detects conflicting aspects (e.g. Jupiter blessing a house, but
Saturn aspecting the ruler), it automatically downgrades the confidence
level to MODERATE or LOW, alerting the user to hidden variables."

A `triadConflict` factor now costs **-10 per conflict**, alongside
`conflictNotes` recording which fired:

- the target house is both afflicted and rescued
- the 11th house is both afflicted and rescued
- the rulers clash despite a strong target lord
- the matter is open but fulfilment is under malefic pressure

The magnitude is set so two conflicts drop an otherwise VERY_HIGH reading
into HIGH/MODERATE, which is the behaviour the rule describes. The material
gives no per-signal weight, so all four are equal.

## Planetary friendship — a labelled classical default

The material supplies the rule and two examples (Sun/Saturn = enemies,
Moon/Jupiter = friendly) but not the full table. `planetaryRelations.ts`
uses the standard classical *naisargika maitri* set, which reproduces both
examples exactly. The classical table is directional (Jupiter counts the
Moon a friend; the Moon counts Jupiter neutral), so `relationBetween()`
combines the two directions: enmity from either side wins, then friendship
from either side, else neutral — which is what makes Moon/Jupiter come out
"friendly" as the material states.

**Rahu and Ketu are neutral to everything.** Classical sources disagree on
natural friendships for the shadow grahas and the RKP material gives none,
so none was invented. Their malefic role is captured separately by the
triad's affliction test.

## RKP's material remedies

`rkpRemedy.ts` implements the material's three micro-remedies as structured
facts (no prose — that stays in the presentation layer):

1. **Clock acceleration** — the fixed 2–3 minute advance, plus the derived
   `minutesToNextBucket` so the presentation layer can tell whether that
   advance would actually cross into the next Lagna segment right now.
2. **Material clearance** — the physical direction of the target house, the
   blocking planets bearing on it, and the object categories to clear.
3. **Planetary timing window** — the Lagna lord (and its weekday), the
   11th lord, the current hora lord, and whether the action planet's own
   hora is running now.

⚠ **Two open items on this module:**

- The material names object mappings for **only three planets** ("rusted
  iron for Saturn, faulty wiring for Mars, cluttered paper for Mercury").
  Sun, Moon, Jupiter, Venus, Rahu and Ketu fall through to the material's
  own general list rather than getting invented mappings. Needs owner input.
- The material **forbids** gemstones, fasts, mantras and ritual donations —
  which would rule out the app's existing Qur'an/Asmā'/zikr/sadaqah remedy
  track. Both are emitted side by side (`remedy` and `materialRemedy`) and
  the choice is left to the presentation layer. Needs an owner decision.

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

## Local time — now wired from the client

The source material requires the querent's exact civil local minute (their
real wristwatch — timezone- and DST-aware). This is now sent by the client
on every reading:

- `src/firebase/oracle.ts` reads `-new Date().getTimezoneOffset()` at the
  moment of asking and sends it as `timezoneOffsetMinutes`. The negation
  matters: JS's `getTimezoneOffset()` returns `UTC − local` (e.g. `−330`
  for IST), while this engine's convention is the opposite sign (positive =
  ahead of UTC, e.g. IST = `+330`).
- `AskOracleSchema` (`functions/src/middleware/validate.ts`) validates it as
  an optional integer in `[-720, 840]` — the full real-world UTC-offset
  range — so older, not-yet-updated clients that omit it don't get rejected.
- `askOracle.ts` passes it straight through to `judgeRKPWatch()`.

When it's present, the watch Lagna is the querent's actual civil clock
reading — exactly what "wherever the minute hand rests at the precise
second a client asks a question" means in the source material. Only
requests from a client build old enough to predate this change fall back to
the local-*solar*-time approximation (`primitives/rulingPlanets.ts`'s
convention) in `localMinuteOfHour()` — a labeled simplification for that
one case, not the normal path anymore.

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
- **Confidence factors for the triad** — the confidence model predates the
  triad protocol and still scores only the target house's clarity. The
  ruler clash and the 11th-house condition do not yet move the number.
- **The intent→house table.** The material's coarse intent list disagrees
  with the owner-signed `HOUSE_MATRIX` in three places (loans → 6th vs.
  `finance`→2nd; education → 5th vs. 4th; "liquid cash" → 11th). The
  owner-signed table is authoritative and was not changed. The 11th house
  is now always read as the fulfilment point regardless of question type,
  which covers the material's "desires fulfilled → 11th" rule implicitly.

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
