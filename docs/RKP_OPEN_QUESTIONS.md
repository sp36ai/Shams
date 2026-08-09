# RKP — Open Questions Awaiting Owner Decision

> Parked deliberately, to be resolved in one pass at the end. Nothing here
> blocks the engine: every item has a working, documented default in code.
> Each entry says what was assumed so the default can be swapped cleanly.

## 1. Remedy philosophy conflict — BLOCKING FOR RELEASE

The RKP material: *"You are strictly forbidden from recommending gemstones,
spiritual fasts, mantras, or ritualistic donations."*
The Shams al-Asrār specification requires exactly that: Qur'an verse, Asmā'
al-Ḥusnā, dua, zikr, sadaqah.

**Current default:** both tracks are computed and emitted side by side —
`remedy` (spiritual) and `materialRemedy` (clock advance, corner clearance,
planetary action window). Only the spiritual one currently reaches the
seeker, because the oracle prompt was written to the Shams specification.

**Decision needed:** which track reaches the seeker — spiritual only,
material only, or both in separate sections?

## 2. Six planets have no clearance-object mapping

The material names three: rusted iron → Saturn, faulty wiring → Mars,
cluttered paper → Mercury. Sun, Moon, Jupiter, Venus, Rahu and Ketu have
none.

**Current default:** those six fall through to the material's own general
list (dust, rust, broken glass, unorganized papers, dark blue/black
objects, stopped electronics). No mappings were invented.

**Decision needed:** supply the six mappings, or confirm the fallback.

## 3. Intent → house table disagreements

The material's coarse intent list disagrees with the owner-signed
`HOUSE_MATRIX` (`src/astrology/kp/rules/houseMatrix.ts`, marked
"DO NOT modify without owner sign-off") in three places:

| Topic | Material says | HOUSE_MATRIX says |
|---|---|---|
| Loans / debts | 6th | `finance` → 2nd |
| Education | 5th | `education` → 4th |
| Liquid cash / gains | 11th | `finance` → 2nd |

**Current default:** the owner-signed table wins; nothing was changed. The
11th house is now always read as the fulfilment point regardless of
question type, which covers the "desires fulfilled → 11th" rule implicitly.

**Decision needed:** amend the matrix, or confirm it stands. Note there is
no `loan` question type at all — loan questions currently classify as
`finance`.

## 4. The gender claim in the polarity profile

The material: odd signs indicate *"male individuals dominating the
situation"*, even signs *"female individuals controlling the outcome"*.

**Current default:** only the behavioural half reaches the presentation
layer — `CONTROLLER_STYLE: DIRECT_ASSERTIVE | CAUTIOUS_ADMINISTRATIVE` —
and the prompt is explicitly barred from attributing it to any person,
gender or role. The full polarity (`masculine`/`feminine`) is still
computed and returned in the API response for anyone who wants it.

**Reasoning for the default:** telling a seeker that a person of a
specific gender is blocking their loan is an unfalsifiable claim about a
real third party the engine knows nothing about.

**Decision needed:** confirm, or authorise the fuller phrasing.

## 5. Three interpretive calls in the triad ladder

Documented in `docs/RKP_WATCH_ENGINE.md`; all adjustable.

1. **A house's own lord never afflicts it.** Read literally, "Mars sitting
   in your 6th house" would make every Mars-ruled house self-afflicting.
2. **"Heavily afflicted" needs a threshold** — a malefic *occupying* the
   house, or two or more bearing on it. Mars alone aspects three houses,
   so a literal reading would deny most charts.
3. **A weak ruler delays, it does not deny** — the material puts "weak
   ruler" under *Delayed*, so denial is reachable only via malefic
   affliction.

## 6. Verdict taxonomy — two parallel sets

The engine now carries two six-state classifications:

| Field | Set | Role |
|---|---|---|
| `nativeState` | YES_STRONG / YES_CONDITIONAL / DELAY / WAIT / NO_DENIED / INCONCLUSIVE | drives the answer, the UI, and the oracle's unveiling heading |
| `conditionState` | Siddhi / Stambhana / Gati / Vakra / Kshaya / Bija | describes the *mechanism* the matter is in |

**Current default:** both, in parallel. `nativeState` remains the driver
because the entire presentation layer, Firestore contract, share text and
the six unveiling headings are built on it, and a seeker is never shown
"Stambhana".

**Decision needed:** keep parallel, or collapse to the Sanskrit set as the
single verdict (a larger change — it would rewrite the oracle prompt's six
headings and the client verdict pills).

## 7. `REVERSAL: IMPOSSIBLE` has no supplied rule

The schema allows POSSIBLE / IMPOSSIBLE / NONE but no rule distinguishes
IMPOSSIBLE from NONE.

**Current default:** IMPOSSIBLE is emitted when the matter is *sealed* — a
blocked triad with no retrograde among the three triad rulers, so nothing
in motion could turn it back. NONE means simply no reversal indicated.

**Decision needed:** confirm or replace that reading.

Also note the material is internally inconsistent about which rulers to
check: the schema comment says *"query or fulfillment house lords"*, the
reference code checks *target or lagna*. **Current default:** all three
triad rulers, which satisfies both readings.

## 8. OBSTRUCTION enum excludes some real obstructors

The supplied closed enum is Saturn / Mars / Rahu / Ketu /
Moon_Disagreement / Denial_Witness / NONE. The Sun is a natural malefic in
this engine's own classification and can genuinely obstruct, but has no
slot.

**Current default:** the closed enum is enforced. A Sun (or Venus/Mercury)
obstruction that is not one of the four named planets falls through to
`Denial_Witness` or `NONE`.

**Decision needed:** add Sun to the enum, or confirm the four-planet list.

## 9. PRIMARY_THEME — union rather than replacement

The supplied enum has five values (STRONG_OPENING, STRUCTURAL_BLOCKAGE,
DELAY, AMBIGUITY, RAPID_RESOLUTION); the engine had seven, including
OPENING, OBSTRUCTION and UNCLEAR_SIGNAL.

**Current default:** the union — RAPID_RESOLUTION was added, nothing was
dropped. Dropping UNCLEAR_SIGNAL would leave the INCONCLUSIVE verdict with
no theme at all.

**Decision needed:** confirm the union, or specify what INCONCLUSIVE and a
neutral-dignity opening should map to in the five-value set.

## 10. Confidence model still ignores parts of the chart

Two factors from the documented 7-factor model remain unimplemented —
Multi-Cusp Agreement and Chart Cleanliness / Void-of-Course — both blocked
on the 8 classical strictures, which are not built.

**Current default:** they score 0 rather than an invented value. A new
`triadConflict` factor now covers the "conflicting aspects downgrade
confidence" rule, so the triad is no longer entirely absent from the
score.
