# RKP Rules - Source of Truth from Astro Sarfaraz

> Status: aligned to the current runtime engine
> Origin: Astro Sarfaraz's rule intake plus the exact 5-step formula update
> Owner: Astro Sarfaraz

---

## 1. Core engine model

This engine now uses the 5-step Moon-Sub-Lord RKP flow.

It does not use the older cusp-sub-lord / 4-source CSL signification model for verdicts.

Deterministic inputs:

- Exact UTC timestamp of the question
- Exact location of the question
- Sidereal chart using Lahiri ayanamsa
- Placidus houses, with Porphyry fallback only at extreme latitude

Primary judgment signal:

- Find the Moon's sidereal longitude
- Find the Moon's nakshatra
- Find the Moon's sub-lord
- Judge the house occupied by the Moon's sub-lord against the question matrix

---

## 2. House Matrix

The following entries mirror the exact owner-provided 5-step table.

| Question Type | Favorable Houses | Denial Houses | Primary | Secondary |
|---|---|---|---|---|
| career | 6, 10, 11 | 5, 8, 12 | 10 | 6, 11 |
| marriage | 7, 11, 2 | 6, 8, 12 | 7 | 2, 11 |
| finance | 2, 6, 11 | 8, 12 | 2 | 6, 11 |
| health | 1, 5, 11 | 6, 8, 12 | 1 | 5, 11 |
| property | 4, 11, 2 | 8, 12 | 4 | 11, 2 |
| travel | 3, 9, 12 | — | 9 | 3, 12 |
| business | 7, 10, 11 | 6, 8, 12 | 7 | 10, 11 |
| legal | 6, 11 | 8, 12 | 6 | 11 |
| children | 5, 11, 2 | 1, 4, 10 | 5 | 2, 11 |
| education | 4, 9, 11 | 8, 12 | 4 | 9, 11 |
| lostitem | 2, 4, 11 | 8, 12 | 2 | 4, 11 |

App-retained extension categories that are not part of the owner's exact pasted table:

| Question Type | Favorable Houses | Denial Houses | Primary | Secondary |
|---|---|---|---|---|
| enemies | 6, 11 | 8, 12 | 6 | 11 |
| spiritual | 5, 9, 12 | 6, 8 | 9 | 5, 12 |
| general | 1, 11 | 8, 12 | 1 | 11 |

Code: `src/astrology/kp/rules/houseMatrix.ts`

---

## 3. Sidereal and Nakshatra rules

- Zodiac: sidereal only
- Ayanamsa: Lahiri only
- Nakshatra span: 13deg20min
- Vimshottari order: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury
- Dasha years: Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17

Sub-lord rule:

- Each nakshatra is subdivided proportionally by Vimshottari dasha years
- The sub-sequence always starts from that nakshatra's lord

Code:

- `src/astrology/primitives/ayanamsa.ts`
- `src/astrology/primitives/subLord.ts`
- `src/astrology/kp/rules/nakshatras.ts`
- `src/astrology/kp/rules/vimshottari.ts`

---

## 4. Ruling Planets

RKP uses exactly three ruling planets in this engine:

1. Day Lord
2. Hora Lord
3. Minute Lord

Local-time basis:

- All three are computed from the same local-solar moment derived from longitude
- This avoids UTC/local drift between weekday, hora, and minute

Day lord:

- Sunday Sun
- Monday Moon
- Tuesday Mars
- Wednesday Mercury
- Thursday Jupiter
- Friday Venus
- Saturday Saturn

Hora lord:

- Chaldean order: Sun -> Venus -> Mercury -> Moon -> Saturn -> Jupiter -> Mars
- Sunrise is approximated as 6:00 AM local solar time
- Each hora is treated as one local-solar hour in the runtime engine

Minute lord:

- Divide the current local-solar hour into 9 equal parts
- Sequence: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury

Code: `src/astrology/primitives/rulingPlanets.ts`

---

## 5. The 5-step judgment algorithm

```text
function judgeHorary(chart, question):

  STEP 1 - Read Moon's sidereal nakshatra and sub-lord
    moonSubLord = chart.planets['Moon'].subLord

  STEP 2 - Load the question's favorable and denial houses
    { favorable, denial, primary, secondary } = HOUSE_MATRIX[qType]

  STEP 3 - Check the house occupied by Moon's sub-lord
    moonSubLordHouse = houseOfPlanet(moonSubLord, chart)
    if moonSubLordHouse in favorable: +2
    else if moonSubLordHouse in denial: -2
    else: 0

  STEP 4 - Verify with ruling planets
    for each of [dayLord, horaLord, minuteLord]:
      rpHouse = houseOfPlanet(rp, chart)
      if rpHouse in favorable: +1
      else if rpHouse in denial: -1
      else: 0

  STEP 5 - Convert score to verdict
    if score >= 3: YES
    else if score <= -2: NO
    else: CONDITIONAL
```

Retrograde modifier:

- If verdict is YES and any of these are retrograde:
- Moon's Sub-Lord
- Jupiter
- Venus
- Then verdict becomes DELAYED

This modifier reduces confidence and adds delay.
It does not convert a NO into YES.

Code: `src/astrology/kp/judgment/judgeHorary.ts`

---

## 6. Timing

Timing planet:

- Nakshatra lord of the Moon's Sub-Lord planet

Rough timing:

- `months = dashaYears(timingPlanet) * 12 * (positiveScore / maxScore)`

Runtime output then converts the computed duration to one of:

- `days`
- `weeks`
- `months`
- `years`

Active dasha fields are included for traceability:

- Mahadasha
- Antardasha
- Pratyantardasha

Code:

- `src/astrology/primitives/dasha.ts`
- `src/astrology/kp/judgment/judgeHorary.ts`

---

## 7. Output contract notes

Current decisive payloads in the verdict:

- `questionCusp` - contextual cusp snapshot for the matter
- `moonSubLord` - decisive Moon-sub-lord snapshot
- `rulingPlanets` - day/hora/minute ruling planets plus raw agreement score

The old CSL-based verdict contract has been removed from the runtime path.

---

## 8. Remaining provisional areas

The following still need explicit owner confirmation if they are to be treated as authoritative cultural output rather than engineering placeholders:

- remedy mapping
- EN/UR/HI narration wording

These do not change the underlying deterministic verdict logic.
