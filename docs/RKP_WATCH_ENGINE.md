# RKP — Watch of Currents: the Clock-Based Engine

> Status: Phase 1 implemented and tested. Not yet wired into production
> (`askOracle.ts` still calls the older `judgeHorary()`).
> Source: user-supplied RKP elaboration (chat) — this document does not
> introduce any table or threshold not already given there, except where
> explicitly marked "confirmed default" (the classical support/obstruction
> toolkit, chosen by the project owner from three offered options).

## What this replaces

Earlier in this engine's history, "RKP" meant a sub-lord scoring variant of
KP (`judgeHorary.ts`, still present, still production). The project owner
has since clarified that the *authentic* RKP is a different system entirely:
a clock-based horary method with no birth chart and no Placidus cusps for
house determination. This document describes that system as now
implemented in `judgeRKPWatch.ts`.

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

## Explicitly deferred (not oversights)

- **Confidence scoring** (the 7-factor 0–100 model, fully specified in the
  source Knowledge Base with exact point values) — not yet wired in.
- **The 8 classical strictures** (Via Combusta, Void of Course, Ascendant
  edge degrees, Saturn in 1st/7th, extreme retrograde, planetary war,
  timestamp quality, multiple-questions-in-one) — not yet checked.
- **Third-person question rotation** (asking about a spouse/child/etc. —
  rotates which house is "self") — product/UX feature, not yet built.
- **Remedy / narration** — explicitly a presentation-layer concern per the
  source material's own non-negotiable rule ("keep calculation, judgment,
  and oracle presentation as separate layers"); not part of this engine.

## Not wired into production

`askOracle.ts` still calls `judgeHorary()`. Swapping the live app's verdicts
over to `judgeRKPWatch()` is a real behavior change to a shipped product and
hasn't been done pending explicit confirmation this engine is producing the
readings expected of it.
