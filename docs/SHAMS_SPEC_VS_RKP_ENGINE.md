# Shams al-Asrār: the product description checked against the running RKP engine

> Status: analysis only. No engine, prompt or remedy code was changed.
> Date: 2026-10-25
> Scope: the 11-section product description ("Core Philosophy" through "Ethical Layer")
> checked against `functions/src/engine/rkp/*`, `functions/src/oracle/*` and
> `functions/src/functions/askWatchOracle.ts` as they are on `main` (b89cf48).

The description is a good way to explain the product to people. It is **not** a description
of what the engine computes. Some sections match the code exactly, some match it in spirit, and
some describe mechanisms the engine does not have. Any mechanism in that last group would be a
**new RKP rule**, which needs the owner (Astro Sarfaraz) to decide on it. None of them should be
added on engineering judgment.

Legend: ✅ matches code · 🟡 partly / under a different mechanism · ❌ not in the engine

---

## 1. Core philosophy: "the moment of the question is its birth-chart" ✅

Matches. `buildWatchChart(iso8601)` (`engine/rkp/watchChart.ts`) builds the chart from the moment
of asking, and `askWatchOracle` persists that moment with the reading.

## 2. Input layer 🟡

| Description says | Engine does | |
|---|---|---|
| Exact date | ISO timestamp with the querent's local offset | ✅ |
| Exact time to the minute | The **local wall-clock minute** chooses the house frame (`watchGrid.localMinuteFromIso`) | ✅ |
| Location (city + country) | **Not used, on purpose.** Planet longitudes are geocentric and the watch frame replaces the horizon cusps, so a location would not change the result (`watchChart.ts` header, "LOCATION IS OPTIONAL, AND THAT IS EXACT") | ❌ by design |
| Intent category | Keyword classifier into the owner's house-matrix types (`kp/rules/questionKeywords.ts`, `houseMatrix.ts`) | ✅ |

**Correction for public copy:** "location" should not be described as a calculation input. If it
were made one, it would have to drive something real, such as a horizon Ascendant. That would
mean replacing the watch frame, which is a methodology change.

## 3. Celestial mapping 🟡

All nine bodies are real sidereal positions from the Meeus/VSOP87 ephemeris, with true retrograde
and combustion flags (`watchChart.ts` → `primitives/chartBuilder`). What the engine reads from
them:

| Description says | Engine | |
|---|---|---|
| Planetary dignity | `dignityOf()`: exalted, own, friendly, neutral, enemy, debilitated (`rules.ts`) | ✅ |
| Benefic vs malefic dominance | Benefics are Mushtari and Zuhra; malefics are Zuhal, Mirrikh, Ras and Dhanab. Each one on or aspecting the target Ghar or the 11th Ghar scores ±2 | ✅ |
| Directional placement (E/W/N/S) | Each sign has a direction. The verdict carries `direction` (target Ghar) and `afflictedDirection` (obstructor). **Directions are reported but never scored** | 🟡 |
| Angular strength | Not scored. No kendra or angularity weighting exists | ❌ |
| Moon phase influence | Shown in the UI only (`src/utils/siderealPositions.moonPhase`, Sky Clock / Oracle header). **Not part of the judgment** | ❌ |
| Active lunar mansion | `manazil.ts` exists for **display and narration wording only** ("This layer surfaces Arabic names + oracle descriptors ONLY"). Not used in the judgment | ❌ |

The only Moon condition the judgment uses: Qamar in the 8th or 12th Ghar →
`MoonDisagreement` (confidence downgraded).

## 4. Watch-based time division 🟡 (biggest gap between the copy and the code)

| Description says | Engine |
|---|---|
| Day and night divided into symbolic watches | The **hour** is divided into twelve 5-minute brackets (`watchGrid.ts`). The bracket fixes the 1st Ghar: :00–:05 = Burj Hamal … :55–:60 = Burj Hoot |
| Each watch has a ruling planet | The bracket's sign has a domicile ruler, which becomes the **lagna ruler**. Hora and day lords exist in `primitives/rulingPlanets.ts` but the watch judgment **does not use them** |
| Each watch has a karmic theme (expansion, testing, illusion, structural foundation…) | **No such table exists.** Themes are not assigned to brackets |
| Each watch has a directional current | Indirectly: the lagna sign has a direction |

So the "watch" really is the central mechanism, but it selects a **house frame**. It does not
select a theme. The theme vocabulary in the description has no source in
`docs/RKP_RULES_FROM_SARFARAZ.md`.

## 5. Directional and quadrant logic ❌

The four quadrants (initiation, stabilization, expansion, dissolution) and the rules built on them
("expansion + benefic → strong yes", "dissolution + heavy malefic → wait", "malefic angular
dominance → danger") **do not exist in the engine**. The engine's inputs are the target house,
the 11th Ghar, the house where the matter's ruler sits (favourable or denial houses from the
owner's matrix), and how the querent's ruler relates to the matter's ruler.

## 6. Outcome determination 🟡

**What the engine actually scores** (`watchJudgment.judgeWatchChart`, each step recorded in `factors`):

1. Dignity of the matter's ruler: strong +2, weak −2
2. Querent's ruler → matter's ruler: friend +2, enemy −2 (skipped when one planet rules both; owner decision 2026-10-08)
3. Each benefic or malefic sitting in or aspecting the target Ghar: ±2
4. Each benefic or malefic on the 11th Ghar (fulfilment): ±2
5. Matter's ruler in a favourable or denial house for the question type: ±1
6. Matter's ruler combust: −1; retrograde sets reversal to possible
7. Obstruction precedence: Zuhal > Mirrikh > Ras > Dhanab, occupants before aspects, then Moon in the 8th or 12th

Against the description's five inputs: planetary strength ✅, benefic/malefic ratio ✅, moon
condition 🟡 (8/12 only), watch-theme alignment ❌, directional reinforcement ❌.

**Output states.** The description lists four. The engine has six watch states, and
`diagnosis.ts` turns them into eight outcomes:

| Description | Closest engine state → diagnosis outcome |
|---|---|
| Yes (clear flow) | `FULFILLED` → `FAVOURABLE`; `MOVING` → `ESCALATING` |
| Conditional yes | `FULFILLED`/`MOVING` with an obstruction → `CONDITIONAL` |
| Wait | `DELAYED` → `DELAYED`, or `PREMATURE` when the earliest window is more than 45 days away; `UNFORMED` → `UNCERTAIN` |
| Danger (avoid now) | `BLOCKED` → `UNFAVOURABLE`. **No separate danger state exists**; `REVERSING` → `DECLINING` is the nearest "caution" signal |

**Timing.** The description says lunar cycles, transit windows, heavy-planet release and watch
repetition. The engine (`computeTiming`) uses a **fixed base window per ruling planet** (Qamar 3–7
days … Zuhal 90–150 days), multiplied by ×1.5 if retrograde, ×1.5 if weak and ×0.7 if exalted.
It does not compute lunar cycles or transits. Phrases like "2–3 lunar cycles" in a reading come
from narration wording, not from engine timing.

> Note: `docs/RKP_RULES_FROM_SARFARAZ.md` §1, §4, §5 and §6 still describe the Moon-sub-lord / ruling-planet
> algorithm and point at `src/astrology/kp/judgment/judgeHorary.ts`, **which no longer exists**.
> The running engine is the watch judgment above. That document should be brought in line with the code (owner sign-off),
> because it is labelled "source of truth".

## 7. Spiritual adjustment layer 🟡

| Description says | Engine |
|---|---|
| **Every** answer includes a verse, a Divine Name, a dua and a practical act | Remedies are **selected by diagnosis** from a fixed 32-entry library (`remedyLibrary.ts`, `remedySelection.ts`). They are not a fixed four-part set |
| Qur'ānic verse | Inside specific entries (e.g. `devotional_quran_patience`), only when those entries are selected |
| One Asmā' al-Ḥusnā | Inside specific entries (e.g. Yā Ṣabūr, `devotional_ya_latif`), not on every reading |
| Dua | `devotional_dua_ease`, `devotional_istikhara`, etc., when selected |
| Practical act (charity, fasting, prayer, correction) | `devotional_sadaqa`, the behavioral entries, and the practical escalations (medical, legal, financial, safety, counselling) |

Two deliberate differences:

- **No remedy on a clean chart.** `diagnosis.interventionNeeded = false` when the outcome is
  favourable, nothing obstructs, confidence ≥ 0.8 and there is no reversal. The rule is that
  prescribing something for a clean chart is "ritual for its own sake".
- **Tradition gating.** Islamic entries are offered when the seeker's tradition allows them
  (the default is both `universal` and `islamic`).

The model never writes remedy text. Remedy text is copied verbatim from the library after
synthesis (`responseComposer.ts`), so remedies cannot be invented at request time.

## 8. Response composition protocol 🟡

| Description section | Composition field |
|---|---|
| 1. Cosmic introduction | No dedicated field. The narration voice is the "warm, direct, answer-first" register (owner decision 2026-10-14), **replacing** the earlier manuscript register |
| 2. Unveiling (outcome, timing, direction) | `rkp_finding` + `interpretation` (+ `diagnosis`, `timing`, `direction` on the verdict) |
| 3. Remedy | `recommended_approach`, `why_this_remedy` + library protocol steps |
| 4. Signature | Model `signature` (varies) + fixed `ORACLE_BRAND_SEAL` |

Conflict to settle: the description's "poetic cosmic introduction" goes against the current
answer-first voice decision.

## 9. Technical blueprint ✅ (with substitutions)

| Description says | Actual |
|---|---|
| Real-time ephemeris API | In-process Meeus/VSOP87 ephemeris, with no external API dependency |
| Geo/timezone converter | Client sends a local-offset ISO timestamp. Server reads the literal minute |
| Lunar mansion module | Exists, display only |
| Scoring algorithm | `judgeWatchChart` |
| Watch-time rule engine | `watchGrid.ts` |
| Data flow | Oracle UI → `askWatchOracle` (App Check, Auth, Zod, rate limit, idempotency, quota) → watch chart → classify → judge → diagnose → remedy select → compose/validate → Firestore + audit → client → MMKV |

## 10. Decision logic examples ❌

Neither example ("moon strong + benefics angular + expansion quadrant + growth watch → YES 2–4
weeks", "Saturn dominant + waning afflicted moon + dissolution + testing → WAIT 1 lunar cycle")
can be produced by the current engine, because it has no quadrant, watch-theme or moon-phase
inputs. They should not be used as examples in investor or marketing material unless the owner
adopts those rules.

## 11. Ethical layer ✅

Matches the architecture: confidence banding and downgrades, the evidence-type label on every
remedy, mandatory professional escalation for health, legal and similar categories
(`MANDATORY_ESCALATION_TYPES`), off-topic declines (`questionScope.ts`), and a narration
validator that rejects claims the engine did not make.

---

## Owner decisions this description raises

Each of these would change RKP methodology, so none should be built until Astro Sarfaraz
specifies it:

1. **Watch themes**: should each 5-minute bracket (or hora) carry a theme? If so, what is the
   exact table, and does it change the score or only the narration?
2. **Quadrants**: adopt the initiation/stabilization/expansion/dissolution quadrants? Which
   houses or signs belong to each, and what weights apply?
3. **Moon phase and lunar mansion in the judgment**: currently display-only. Should the phase or
   the manzila's nature (benefic/malefic) score? If so, with what weight?
4. **Angularity**: add kendra weighting for benefics and malefics?
5. **Directional scoring**: should `direction` or `afflictedDirection` affect the score, or stay
   descriptive?
6. **A distinct "Danger" outcome**: or is `BLOCKED`/`UNFAVOURABLE` (plus `REVERSING`) the
   intended answer?
7. **Timing basis**: keep the per-planet base windows, or move to lunar cycles and transits?
8. **Fixed four-part remedy**: should every reading carry verse + Name + dua + act, overriding
   the "no remedy on a clean chart" rule and tradition gating?
9. **Cosmic introduction**: bring back a poetic opening, or keep the answer-first voice?
10. **Location**: keep it out of the calculation (current, exact), or introduce a horizon-based
    element (a methodology change)?
11. **Update `RKP_RULES_FROM_SARFARAZ.md`** so that it describes the watch engine that actually
    runs.

Until those are decided, the accurate one-line description of the running system is:

> Question → local watch minute selects the house frame → real sidereal planets placed into it →
> dignity, friendship, benefic/malefic witness on the matter and on fulfilment → one of six
> states with confidence, obstruction and a timing window → diagnosis → remedy chosen from a
> controlled library → narration that may only explain what the engine found.
