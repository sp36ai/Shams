# RKP vs KP FORENSIC ENGINE AUDIT

**Shams al-Asrār | Engine v2.0.0-moshier | Audit date: 2026-05-09**

---

## A. What True KP Actually Is

KP astrology is a deterministic interrogation system. Every verdict derives mechanically from the natal/horary chart. There is no interpretation latitude — the algorithm either confirms or denies based on strict significator linkage.

**The mandatory components, in operational order:**

**Astronomical foundation**

- Sidereal zodiac with Lahiri (Chitrapaksha) ayanamsa — not tropical, not Raman, not any other
- Placidus house cusps, computed for exact moment and coordinates of question
- All 9 grahas (Sun through Saturn + Rahu/Ketu as mean nodes) in sidereal longitude to sub-lord precision (< 5 arcminutes — nakshatra spans 13°20', sub-lord spans ~50 arcminutes minimum, so ephemeris error must be < 5')

**The sub-lord chain — the core of KP**

Each degree of the zodiac belongs to a nested structure:

```
360° → 12 signs (30° each) → sign lord (classical lordship)
Each sign → 2.25 nakshatras (13°20' each) → nakshatra lord (Vimshottari)
Each nakshatra → 9 sub-divisions → sub lord (proportional to dasha years)
Each sub → 9 sub-sub divisions → sub-sub lord
```

A planet at longitude L has:

- A **sign lord** — the rashi lord (classical)
- A **nakshatra lord** — determined by which of 27 nakshatras the degree falls in
- A **sub lord** — the critical KP significator, determined by position within the nakshatra using Vimshottari proportions
- A **sub-sub lord** — for precision timing

**What most apps fake:** Sign lord only, or Rashi + nakshatra only, with no sub-lord computation. A system without sub-lords is NOT KP. It is Jyotish with nakshatra lookup.

**Cusp sub-lords — what makes KP different from everything else**

Every house cusp has a sub-lord. The cusp sub-lord of house N tells you whether house N can DELIVER its promise.

- If cusp sub-lord of house 7 is connected to houses 7, 11, 2 → marriage promised
- If cusp sub-lord of house 7 is connected to houses 6, 8, 12 → marriage denied or blocked

This is the promise layer. Before checking whether something will happen, KP demands you check whether it CAN happen. No other system does this. This is what separates KP from predictive astrology broadly.

**Significators — who represents a house**

For house N, the significators are (in order of strength):

1. Planets **in the nakshatra** of the planets **occupying** house N (strongest)
2. Planets **occupying** house N
3. Planets **in the nakshatra** of the **lord** of house N
4. The **lord** of house N

This is the occupation-before-ownership principle. A planet occupying a house has stronger signification than the house's lord sitting elsewhere. Most apps ignore this and only use lordship.

**Ruling planets (5, not 3)**

At the moment of judgment:

1. Day lord (weekday lord at moment of question)
2. Hora lord (planetary hour lord)
3. Moon's nakshatra lord (lord of the nakshatra Moon occupies)
4. Moon's sign lord (rashi lord of Moon's position)
5. Ascendant's nakshatra lord (lord of nakshatra of the ascending degree)

These 5 are the witnesses to the judgment. A ruling planet appearing in the significator list is confirmation that the house-promise will fructify.

**Promise vs fructification**

This is a two-layer test:

- **Promise**: Cusp sub-lord of the relevant house is connected to favorable houses → the matter CAN happen
- **Fructification**: Significators of favorable houses are confirmed by ruling planets → the matter WILL happen at the time indicated by the current dasha

Both must be satisfied for YES. Promise without fructification = yes eventually, not now. Fructification without promise = no matter what the planets say, it cannot happen in this life.

**Timing — not a ratio, not a single planet**

True KP timing is a convergence requirement:

- The **current dasha/antardasha lord** must be a significator of the relevant favorable house
- The **dasha lord** must transit over a sensitive degree (cusp, natal planet) in the chart
- Classically, **Jupiter and Saturn double transit** over a sensitive point at the period of fructification

The timing window narrows when multiple dashas and transits converge on the same sensitive degree. Timing is confirmatory, not primary — you do not compute timing unless the promise and fructification layers already passed.

**What is fake KP**

- Sun-sign or Moon-sign based predictions with KP labeling
- Nakshatra lord lookup with no sub-lord computation
- House lordship significance without occupation consideration
- "Ruling planets" that are only day lord + hora lord (missing Moon's nakshatra lord, Moon's sign lord, Ascendant's nakshatra lord)
- Numeric confidence scoring applied to sub-lord analysis
- Timing from a single planet's dasha years without dasha-transit convergence
- Any system that produces verdicts without computing Placidus cusps at the exact moment and coordinates

---

## B. What RKP Currently Is

Based on the actual engine code (judgeHorary.ts, chartBuilder.ts, houseMatrix.ts, rulingPlanets.ts), RKP inside Shams is:

**Option D: Branded deterministic oracle with genuine KP primitives and a simplified scoring judgment layer.**

It is not A (full KP), not B (simplified — that implies it's attempting the same thing at lower fidelity), not C (hybrid timing), and not E (something else). It is KP primitives powering a deterministic oracle scoring algorithm.

Specifically:

**What is authentic KP in the engine:**

- Lahiri ayanamsa — correct
- Placidus cusps with Porphyry fallback at high latitudes — correct
- Moshier ephemeris (< 1 arcminute for planets, < 10 arcseconds for Moon) — meets sub-lord precision requirements
- Full sub-lord chain: nakshatra lord → sub lord → sub-sub lord — correct and implemented
- Moon's sub-lord as the primary significator of the moment — correct KP doctrine
- Vimshottari dasha sequence and proportions — correct
- Retrograde modifier: DELAYED when Moon's sub-lord, Jupiter, or Venus is retrograde — correct KP behavior
- Kotamraju filter: rejecting a planet if its own sub-lord is in a denial house — a legitimate and advanced KP verification step
- House groups per question type (career = 6/10/11 favorable, 5/8/12 denial; marriage = 2/7/11 favorable, 6/8/12 denial) — correct KP house groupings

**What is RKP adaptation (not classical KP):**

- The scoring system (+2 for sub-lord, +1 per ruling planet) — KP has no scoring; it has analytical judgment
- Only 3 ruling planets: Day Lord, Hora Lord, Minute Lord — classical KP requires 5 (add Moon's sign lord and Ascendant's nakshatra lord)
- Fixed threshold verdicts (score ≥ 3 = YES, ≤ −2 = NO) — deterministic oracle thresholds, not KP rules
- Timing formula: `dasha_years × 12 × (score_ratio)` — a directional heuristic, not true dasha-transit convergence
- Remedy from Moon's sub-lord planet — a spiritual addition, not a KP output
- Pre-defined house matrices per question type — KP computes this dynamically from the actual chart; the matrices are accurate but static

**The 3 ruling planets deviation is the most significant KP departure.** Astro Sarfaraz's RKP variant deliberately uses Day Lord + Hora Lord + Minute Lord (the lord of the minute of day). This is a distinct RKP innovation. Classical Krishnamurti uses the 5-planet set above.

---

## C. Real vs Fake KP Inside Shams

| Component                            | In Engine   | KP Authentic       | Notes                                       |
| ------------------------------------ | ----------- | ------------------ | ------------------------------------------- |
| Lahiri ayanamsa                      | ✅          | ✅                 | Correct formula                             |
| Placidus cusps                       | ✅          | ✅                 | Newton solver, Porphyry fallback            |
| Sub-lord chain (3 levels)            | ✅          | ✅                 | Full Vimshottari proportions                |
| Moon's sub-lord as primary signal    | ✅          | ✅                 | Core KP doctrine                            |
| Vimshottari dasha periods            | ✅          | ✅                 | Correct sequence and years                  |
| Retrograde = DELAYED modifier        | ✅          | ✅                 | Established KP rule                         |
| Kotamraju filter                     | ✅          | ✅                 | Advanced KP verification                    |
| Occupation vs ownership distinction  | ❌          | Required           | Significator ranking not computed           |
| **Cusp sub-lords**                   | ❌          | **Required**       | Promise layer entirely absent               |
| **Full significator list**           | ❌          | **Required**       | Not computed per house                      |
| 5 ruling planets                     | ❌ (3 only) | Required           | Moon sign lord + Asc nakshatra lord missing |
| Dasha-transit convergence timing     | ❌          | Required           | Heuristic ratio used instead                |
| Double transit (Jupiter + Saturn)    | ❌          | Advanced           | Not implemented                             |
| Promise vs fructification separation | ❌          | Required           | Single-pass scoring only                    |
| Numeric scoring                      | ✅          | ❌ (RKP only)      | Not a KP concept                            |
| Fixed verdict thresholds             | ✅          | ❌ (RKP only)      | Deterministic oracle layer                  |
| Planet remedy table                  | ✅          | ❌ (spiritual add) | Not a KP output                             |

---

## D. Existing Engine Architecture

**The actual runtime flow, as implemented:**

```
Question text
  → classifyQuestion() — keyword match (en/ur/hi), returns QuestionType
  → buildChart(isoTimestamp, lat, lon)
      → julianDay(timestamp) → JDut → JDtt (with Delta-T)
      → lahiriAyanamsa(jd) → ayanamsa degrees
      → computePlanetPositions(jd) — Moshier ephemeris for 9 grahas
        → subtract ayanamsa → sidereal longitudes
        → nakshatra index → nakshatra lord
        → sub lord (Vimshottari proportion within nakshatra)
        → sub-sub lord
      → computeHouseCusps(jd, lat, lon) — Placidus 12 cusps
        → RAMC from GMST + longitude
        → Newton solver for 12 cusps
        → assign planets to houses (which cusp span they fall in)
      → computeRulingPlanets(jd, lat, lon)
        → Day lord (weekday at moment)
        → Hora lord (planetary hour at moment)
        → Minute lord (lord of current minute of planetary day)
      → Object.freeze(chart) — immutable artifact
  → judgeHorary(chart, classifiedQuestion)
      → STEP 1: moonSubLord = chart.planets.Moon.subLord
      → STEP 2: matrix = HOUSE_MATRIX[qType] → {favorable[], denial[]}
      → STEP 3: moonSubLordHouse = houseOfPlanet(moonSubLord, chart)
                if favorable → score += 2; elif denial → score -= 2
      → applyKotamrajuFilter(moonSubLord) — reject if sub-lord in denial → score −2
      → STEP 4: for each ruling planet:
                  house = houseOfPlanet(rp, chart)
                  if favorable → score += 1; elif denial → score -= 1
                  applyKotamrajuFilter(rp)
      → STEP 5: score ≥ 3 → YES; ≤ −2 → NO; else → CONDITIONAL
                retrograde check → DELAYED
      → buildTiming(chart, score, qType) — dasha ratio heuristic
      → selectRemedy(moonSubLord)
      → buildNarration(verdict, ..., lang)
      → buildReasoning() — audit trail with weights
      → Object.freeze(verdict)
```

**The judgment engine is a 5-step scoring pass over 4 data points:**

1. Moon's sub-lord house placement (weight: ±2)
2. Kotamraju filter on sub-lord (weight: −2 penalty)
3. 3 ruling planets' house placements (weight: ±1 each)
4. Kotamraju filter on each ruling planet

Maximum possible score: +5 (sub-lord in favorable +2, all 3 RPs favorable +3)

**The engine does NOT compute:**

- Cusp sub-lords for any house
- Significator lists (which planets represent which houses)
- Occupation vs ownership ranking
- Dasha-transit timing

---

## E. Missing KP Components

Listed by severity of impact on verdict accuracy:

**Severity: VERDICT-ALTERING**

**1. Cusp sub-lords (promise layer)**
This is the largest gap. Without the cusp sub-lord of the relevant house, the engine cannot determine whether the house CAN deliver. The engine currently asks "does the Moon's sub-lord support this house?" without first asking "does this house have any promise at all?" A house whose cusp sub-lord is in denial houses will NEVER deliver regardless of what the Moon's sub-lord says. Missing this creates false positives.

**2. Full significator computation**
The engine uses Moon's sub-lord's house placement as a proxy for significator analysis. True KP computes all planets in the nakshatra of planets occupying or ruling the question houses, then checks for ruling planet confirmation. The current engine's +1/−1 per ruling planet is not significator analysis — it is house-placement scoring, which is structurally different.

**3. Missing ruling planets (Moon sign lord, Ascendant nakshatra lord)**
The 3-planet set misses 2 of the 5 classical witnesses. The missing two are often the decisive ones because Moon's sign lord connects directly to emotional/mental readiness and Ascendant's nakshatra lord connects to the querent's own capacity to manifest the outcome.

**Severity: TIMING-ALTERING**

**4. True dasha timing**
The formula `dasha_years × 12 × ratio` gives a ballpark range that is better than nothing but cannot be called KP timing. KP timing requires: (a) current dasha lord must be a significator of the relevant house, (b) transit of dasha lord over a sensitive degree. The heuristic ratio has no astronomical basis.

**5. Sub-lord of timing planet**
Classical KP timing identifies the timing planet as the first significator that also appears as a ruling planet. The sub-lord of this timing planet then tells you the antardasha period when fructification happens. Not computed.

**Severity: PRECISION-ALTERING**

**6. Occupation before ownership in significator ranking**
The engine treats all ruling planets equally regardless of their relation to the question houses. KP requires ordering: planets in a nakshatra of an occupant outrank the house lord. This ordering matters when ruling planets give conflicting signals.

**7. Sub-sub lord for precision**
The sub-sub lord layer (4th level of the chain) is computed in the data but not used in judgment. It is used in classical KP for distinguishing the exact week or day within a timing window. Its absence limits timing precision but does not affect the YES/NO verdict.

---

## F. Correct KP Core Architecture

The backend engine should own this layer entirely. No UI component, no interpretation layer, no user-facing code should touch it.

```
KP_CORE {

  INPUT:
    timestamp: ISO 8601 (moment of question)
    lat: number (decimal degrees, signed)
    lon: number (decimal degrees, signed)
    questionType: QuestionType (14 types)

  EPHEMERIS LAYER:
    JDut → JDtt (Delta-T, Espenak-Meeus)
    lahiriAyanamsa(jd) → ay
    for each graha: tropical_longitude − ay → sidereal_longitude
    → nakshatra_lord, sub_lord, sub_sub_lord (Vimshottari chain)
    → speed → retrograde flag

  HOUSE LAYER:
    Placidus cusps (12) via Newton solver at (jd, lat, lon)
    RAMC from GMST + geographic longitude
    assign each graha to house (which cusp span contains its longitude)
    compute cusp sub-lord for ALL 12 cusps  ← MISSING, must add

  RULING PLANETS LAYER:
    dayLord(jd)                              — weekday lord
    horaLord(jd, lat)                        — planetary hour lord
    minuteLord(jd, lat)                      — lord of current minute [RKP: keep]
    moonSignLord(chart.Moon.longitude)       — rashi lord             [ADD]
    ascendantNakshatraLord(chart.cusps[1])   — asc nakshatra lord     [ADD]

  SIGNIFICATOR LAYER (MISSING — MUST BUILD):
    for each house N in questionHouses:
      occupants = planets whose longitude ∈ [cusp_N, cusp_{N+1})
      owner = signLord(cusp_N.longitude)
      sigs_N = [
        planets in nakshatra_of(occupant) for occupant in occupants,  // strongest
        occupants,
        planets in nakshatra_of(owner),
        owner
      ]
    favorable_sigs = union of sigs_N for N in favorable_houses
    denial_sigs   = union of sigs_N for N in denial_houses

  PROMISE LAYER (MISSING — MUST BUILD):
    for each relevant house N:
      cusp_sub_lord = chart.cusps[N].subLord
      cusp_sub_lord_house = houseOfPlanet(cusp_sub_lord, chart)
      house_promised = favorable_houses.includes(cusp_sub_lord_house)
      if not house_promised: return DENIED (hard stop)

  FRUCTIFICATION LAYER:
    confirmed_sigs = favorable_sigs ∩ ruling_planets_set
    denied_sigs    = denial_sigs ∩ ruling_planets_set
    if confirmed_sigs.length > denied_sigs.length: direction = YES
    else if denied_sigs.length > confirmed_sigs.length: direction = NO
    else: direction = CONDITIONAL

  TIMING LAYER:
    timing_planet = first planet in confirmed_sigs that is also a ruling planet
    current_dasha = dashaPeriod(chart.Moon.longitude, timestamp)
    if current_dasha.mahadasha.lord in confirmed_sigs:
      timing_anchor = current_dasha
    timing_window = antardasha period of timing planet within current mahadasha

  RETROGRADE MODIFIER:
    if direction == YES and (moonSubLord.retrograde or Jupiter.retrograde or Venus.retrograde):
      direction = DELAYED

  KOTAMRAJU FILTER (already implemented, keep):
    reject planet if its own sub-lord is in denial house

  OUTPUT:
    verdict: VerdictKind
    confidence: 0-100
    moonSubLord: Planet
    moonSubLordHouse: HouseIndex
    cuspSubLords: Record<HouseIndex, Planet>           ← new
    significators: { favorable: Planet[], denial: Planet[] }  ← new
    rulingPlanets: { day, hora, minute, moonSign, ascNakshatra }  ← extended
    confirmedSignificators: Planet[]                   ← new
    timing: { dashaLord, antardashaLord, window, range }
    reasoning: ReasoningStep[]
}
```

---

## G. Correct RKP Adaptation Layer

The RKP layer sits between the KP core output and the user-facing response. It owns interpretation, spiritual tone, readability, and oracle presentation. It must NEVER touch astronomical computation.

```
RKP_LAYER {

  INPUT: KP_CORE output (frozen, immutable)

  VERDICT MAPPING:
    YES         → "The heavens confirm"
    NO          → "The heavens do not support"
    CONDITIONAL → "The heavens are ambiguous" + conditions
    DELAYED     → "The stars confirm but timing is obstructed"
    DENIED      → "This matter is not promised in the current chart"  ← new
    UNCLEAR     → "Insufficient planetary alignment at this moment"

  CONFIDENCE TRANSLATION:
    90-100 → "Strongly confirmed" (3+ ruling planets aligned)
    70-89  → "Confirmed" (2 ruling planets aligned)
    50-69  → "Probable" (1 ruling planet aligned, promise holds)
    30-49  → "Uncertain" (promise holds, no ruling planet confirmation)
    10-29  → "Doubtful" (mixed signals, denial present)

  TIMING PRESENTATION:
    days   → "Within days"
    weeks  → "Within the fortnight" / "Within weeks"
    months → "Within [N] months"
    years  → "In the coming year(s)"
    + active dasha context: "During the [planet] period"

  REMEDY FRAMING:
    Source: Moon's sub-lord's planet
    Frame as: "The planetary influence recommends..."
    Not presented as prescription — presented as resonance

  NARRATION:
    3 languages (EN/UR/HI) — already implemented correctly
    Templates are culturally localized, not machine translated — keep

  SIGNIFICATOR EXPOSURE (for advanced/expert mode):
    favorable_sigs → "Supporting planets: Sun, Mars"
    denial_sigs    → "Opposing planets: Saturn"
    confirmed_sigs → "Witnesses: Jupiter (ruling planet)"

  WHAT RKP LAYER MUST NEVER DO:
    - Compute ayanamsa
    - Compute cusps
    - Access raw ephemeris output
    - Modify verdict direction
    - Override Kotamraju filter
    - Override promise layer
}
```

---

## H. Backend Ownership

```
SERVER OWNS (Cloud Function — never touches client):
  - Full ephemeris computation
  - Ayanamsa
  - Placidus cusps
  - Sub-lord chain
  - Cusp sub-lords (to add)
  - Significator computation (to add)
  - Promise layer (to add)
  - Ruling planets (all 5 after fix)
  - Kotamraju filter
  - Verdict direction
  - Timing calculation
  - Confidence scoring
  - Reasoning audit trail
  - ENGINE_VERSION stamp

CLIENT OWNS (React Native — safe to hold):
  - RKP interpretation layer (narration templates)
  - Verdict display logic (color, icon, banner)
  - Timing label formatting
  - Remedy display formatting
  - History storage (MMKV, Reading schema)
  - Language selection
  - SkyState display (mean longitude approximations ±1-5° — display only)
  - TimingBar (hora, day lord — display only, NOT judgment input)

NEVER CLIENT-SIDE:
  - Sub-lord computation used for judgment
  - Cusp computation used for judgment
  - Any verdict derivation
  - Any significator analysis

CURRENT VIOLATION: NONE
The client has zero engine logic. The APK contains no astrology algorithm.
This is correct and must not change.
```

---

## I. UI / UX Placement

**Default mode — visible to all users:**

| Element                              | Visible      | Rationale                            |
| ------------------------------------ | ------------ | ------------------------------------ |
| Verdict (YES/NO/CONDITIONAL/DELAYED) | ✅           | Primary output                       |
| Confidence bar                       | ✅           | Strength of planetary alignment      |
| Narration (1 paragraph)              | ✅           | Oracle voice, culturally appropriate |
| Timing window (rough)                | ✅           | Directional — "Within weeks"         |
| Active dasha period                  | ✅ optional  | Temporal anchor users can verify     |
| Moon's sub-lord planet               | ✅           | Most important KP data point         |
| Sub-lord house                       | ✅           | "Occupies house 7" — interpretable   |
| Remedy                               | ✅ collapsed | Spiritual layer, opt-in              |

**Expert / advanced mode — collapsed panel:**

| Element                               | Visible | Rationale                           |
| ------------------------------------- | ------- | ----------------------------------- |
| All ruling planets (5 after fix)      | Expert  | Too technical for general users     |
| Kotamraju filter result per planet    | Expert  | Meaningful only to KP practitioners |
| Reasoning steps with weights          | Expert  | Full audit trail                    |
| Significators per house (after build) | Expert  | Core KP but opaque generally        |
| Cusp sub-lord verdict (after build)   | Expert  | Promise layer — abstract            |
| Confidence as number                  | Expert  | Show bar, hide raw number           |

**Always hidden:**

| Element                       | Rationale                          |
| ----------------------------- | ---------------------------------- |
| Raw sidereal longitudes (DMS) | Meaningless to users               |
| Ayanamsa value                | Implementation detail              |
| Julian Day                    | Internal time scale                |
| Delta-T correction            | Sub-arcsecond, invisible           |
| Sub-sub lord                  | Day-level precision, not displayed |
| Engine version                | In data payload only, not in UI    |
| Placidus cusp degrees         | 12 numbers with no user meaning    |

**Currently correct:**

- AstroVerdictCard: sub-lord display, house pills, ruling planet chips, confidence bar ✅
- WatchVerdictCard: 3 formula rows, confidence bar ✅
- SkyState: labeled as approximate ±1-5°, not used for judgment ✅
- TimingBar: hora + day lord as atmospheric context, not judgment input ✅

---

## J. Result / Output Structure

```
PROMISE CHECK (absent — must add first):
  If promise absent → DENIED (hard stop, no further analysis)

  DENIED ≠ NO.
  NO     = query is answerable; answer is negative.
  DENIED = chart cannot address this question at this time.

VERDICT KINDS (correct hierarchy):
  YES         = score ≥ 3, no retrograde obstruction, promise holds
  DELAYED     = score ≥ 3 but retrograde obstruction on timing planets
  CONDITIONAL = score −1 to +2 (ambiguous signal, no clear confirmation)
  NO          = score ≤ −2, denial houses dominate
  UNCLEAR     = location null (GPS absent) — not a judgment result

CONFIDENCE MAPPING (current formula correct):
  confidence = clamp(((score + maxScore) / (2 × maxScore)) × 100, 10, 100)
  After adding Moon sign lord + Asc nakshatra lord, maxScore becomes 7:
    Moon sub-lord:    ±2
    5 ruling planets: ±1 each
    Kotamraju:        −2 per rejected planet (unchanged)

CONTRADICTION HANDLING (currently missing):
  When favorable_sigs ∩ denial_sigs ≠ ∅ (planet significates both sides):
    → That planet is a NEUTRAL witness — does not count for either side
    → Remove from both lists before scoring
  Currently undetectable because significators are not computed.

MIXED SIGNAL HANDLING:
  CONDITIONAL is the correct output. It is underused in the current engine
  because the threshold is wide (−1 to +2). After adding significator
  analysis, CONDITIONAL will appear more often and carry a sub-reason:
  "Supporting and opposing significators both present."

DENIAL OVERRIDE:
  Kotamraju filter — correctly implemented, hard override.
  Promise denial (to add) — harder override, fires before Kotamraju,
  short-circuits the entire analysis.
```

---

## K. Runtime Operational Flow

**Current actual flow (implemented):**

```
1.  Client: question text + timestamp + lat/lon → askOracle (Firebase callable)
2.  Server: App Check + Firebase Auth
3.  Server: Zod validation
4.  Server: Rate limit (10/min, Firestore transaction)
5.  Server: Quota check (3/week free, atomic transaction)
6.  Server: buildChart(timestamp, lat, lon)
      a. JDut → JDtt (Delta-T)
      b. Lahiri ayanamsa
      c. 9 planet positions (Moshier)
      d. Nakshatra + sub-lord + sub-sub-lord per planet
      e. Placidus 12 cusps (Newton solver)
      f. Planet → house assignment
      g. 3 ruling planets (day, hora, minute)
7.  Server: classifyQuestion(text) → QuestionType
8.  Server: judgeHorary(chart, classifiedQuestion)
      a. Moon's sub-lord → house placement
      b. Kotamraju filter on sub-lord
      c. ±2 score for sub-lord
      d. 3 ruling planets → house placement → ±1 each
      e. Kotamraju filter on each RP
      f. score → verdict (≥3 YES, ≤−2 NO, else CONDITIONAL)
      g. Retrograde → DELAYED
      h. Timing: dasha years × ratio (heuristic)
      i. Remedy from sub-lord planet
      j. Narration in 3 languages
      k. Reasoning audit trail
9.  Server: Write /readings/{id} to Firestore
10. Server: Write audit log (fire-and-forget)
11. Server: Return minimal response
12. Client: addReading() → MMKV
13. Client: AstroVerdictCard render
```

**Target flow after KP core additions:**

```
Steps 1–7: unchanged.

8.  Server: judgeHorary(chart, classifiedQuestion)
      a. Compute cusp sub-lords for all 12 cusps          [ADD]
      b. Promise check: relevant cusp sub-lords in favorable houses?  [ADD]
         → if NO: return DENIED, short-circuit
      c. Compute significators for favorable + denial houses  [ADD]
      d. Apply occupation-before-ownership ranking         [ADD]
      e. Moon's sub-lord → house placement + Kotamraju    (unchanged)
      f. 5 ruling planets                                  [EXTEND]
      g. confirmed = ruling_planets ∩ favorable_sigs       [NEW]
      h. denied    = ruling_planets ∩ denial_sigs          [NEW]
      i. Score from confirmed/denied counts                [REVISE]
      j. Retrograde → DELAYED                              (unchanged)
      k. Timing: first confirmed RP's dasha period         [REVISE]
      l. Remedy, narration, reasoning                      (unchanged structure)

Steps 9–13: unchanged.
```

---

## L. Final Engineering Verdict

**1. What Shams currently truly is**

A production-grade deterministic oracle with genuine KP astronomical foundations and a simplified RKP scoring judgment layer. The astronomy is real. The judgment algorithm is a scoring proxy for classical KP analysis.

**2. How much of it is real KP**

- Astronomical layer: 100% KP-compliant. Lahiri ayanamsa, Placidus cusps, Moshier ephemeris, full sub-lord chain — all correct to sub-lord precision.
- Judgment layer: ~40% KP. Moon's sub-lord as primary signal and favorable/denial house groups are pure KP. The scoring system, 3-planet ruling set, and timing heuristic are RKP adaptations.

**3. How much is symbolic oracle logic**

The timing formula, remedy selection, and narration are symbolic oracle additions. Not KP, not fake — they are honest additions to the product. They should not be labeled as KP outputs.

**4. Whether RKP is currently authentic**

RKP as described by Astro Sarfaraz — Day Lord + Hora Lord + Minute Lord as witnesses, Moon's sub-lord as primary judge, house matrix scoring — is authentically implemented. The engine faithfully executes the described RKP methodology. RKP is authentic to itself. It is not classical Krishnamurti.

**5. What is missing for true KP**

In order of impact:

- Cusp sub-lords (promise layer) — verdict-altering for false positives
- Full significator computation — verdict-altering for precision
- Moon sign lord + Ascendant nakshatra lord — ruling planet accuracy
- Dasha-transit convergence timing — timing precision

**6. What should be rebuilt**

Nothing demolished. Additive changes only:

```
Phase A: Cusp sub-lords + promise check      (~1–2 days)
  → subLordAtLongitude() already exists in subLord.ts
  → Call it 12 times (once per cusp)
  → Add promise check before judgment block
  → Add DENIED verdict kind

Phase B: Significator lists                  (~2–3 days)
  → Compute occupation/ownership per house
  → Apply ranking: nakshatra-of-occupant > occupant > nakshatra-of-lord > lord
  → Store in chart output

Phase C: Extend ruling planets to 5          (~1 day)
  → Moon sign lord: signLord(chart.Moon.longitude) — trivial
  → Asc nakshatra lord: nakshatraLord(chart.cusps[1].longitude) — trivial

Phase D: Revise scoring to significator-based (~2–3 days)
  → Replace +1 per ruling planet house-placement
  → With: confirmed = ruling_planets ∩ favorable_sigs
  → Adjust thresholds; update test suite
```

Total: ~1 week of engine work. Structure is already correct. All additions are additive.

**7. What should remain**

- Entire astronomical layer — correct, production-quality, keep
- Kotamraju filter — advanced KP, keep
- Narration system — culturally localized, excellent, keep
- Zod schemas, auth pipeline, quota, audit trail — not KP-related, correct, keep
- Determinism guarantee (FNV-1a, no random) — keep
- Object.freeze outputs — keep
- ENGINE_VERSION pin — keep
- Reasoning audit trail — keep and extend

**8. What should be hidden from users**

Raw cusp degrees, ayanamsa, Julian Day, sub-sub lord, full significator lists (default), Kotamraju result per planet, engine version in UI. All stays in the data payload for expert mode and audit. Never deleted, only not displayed by default.

**9. What should be exposed to advanced users**

Expert panel (collapsed by default on verdict card):

- All ruling planets (5 after fix) with house positions
- Moon's sub-lord with house and sign
- Cusp sub-lords of 2-3 relevant houses (after implementation)
- Confirmed vs denied significators
- Reasoning steps with weights
- Active dasha/antardasha period

This panel exists for KP practitioners who want to verify the engine's work. It builds deep trust with the audience that understands KP.

**10. Final production architecture**

```
Layer 0: Astronomical (server, pure KP)
  Moshier + Lahiri + Placidus + Sub-lords + Cusp sub-lords
  → Immutable Chart (frozen, version-stamped)

Layer 1: Significator (server, pure KP — to build)
  Occupation, Ownership, Nakshatra linkage
  → Ranked significator lists per house group

Layer 2: Judgment (server, RKP scoring over KP data)
  Promise check → Kotamraju → Ruling planet confirmation → Threshold
  → VerdictKind + confidence + reasoning

Layer 3: Interpretation (server, RKP)
  Timing narrative + Remedy + Narration (3 langs)
  → OracleResponse (what the client receives)

Layer 4: Presentation (client, RKP)
  Verdict card + Timing display + Remedy + Expert panel
  → AstroVerdictCard

Layer 5: Oracle atmosphere (client, product)
  SkyState, TimingBar, CosmicClock
  → Approximate display only, clearly labeled, never judgment input
```

The current architecture correctly separates Layers 0–3 (server) from Layers 4–5 (client). The gaps are within Layers 0–2 on the server — specifically the missing cusp sub-lord computation and significator analysis. The client architecture requires no structural changes.

**The single most important addition: cusp sub-lords.**

Without them, the engine can produce YES verdicts for questions the chart cannot answer. Adding cusp sub-lords introduces the promise layer that prevents this class of error. Implementation requires 12 calls to the existing `subLordAtLongitude()` function — the primitive already exists in `subLord.ts`. The implementation cost is low. The accuracy improvement is significant.
