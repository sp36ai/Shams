# Classical KP Rules — Source of Truth for the `judgeKP` Engine

> Status: doctrine reference for `src/astrology/kp/judgment/judgeKP.ts`
> Origin: standard published Krishnamurti Paddhati (KP) horary methodology,
> cross-checked against this repo's own prior analysis in
> `RKP_KP_FORENSIC_AUDIT.md` (2026-05-09).
> Owner review: pending — flag any deviation from Astro Sarfaraz's
> understanding of classical KP the same way `RKP_RULES_FROM_SARFARAZ.md`
> was vetted before this doc is treated as final.

---

## 0. Why a second engine

`docs/RKP_RULES_FROM_SARFARAZ.md` documents this app's original engine —
Astro Sarfaraz's RKP method: Moon's sub-lord scored as a numeric ±2
contributor, ±1 per ruling-planet witness, fixed thresholds (≥3 YES, ≤−2
NO), a 6th "confirmatory" Hora Lord witness. That is authentic *to itself*
— the engine faithfully executes what Astro Sarfaraz specified — but it is
not classical Krishnamurti Paddhati (see `RKP_KP_FORENSIC_AUDIT.md` §B, §L.4).

Correction (owner feedback): an earlier revision of this document and of
`judgeHorary.ts` had the horary-number (1–249) witness backwards, treating
it as an "RKP-only additive witness." The numbered-horary technique is in
fact Krishnamurti's own classical method — RKP never used it. It has been
moved to `judgeKP.ts` (§11) and removed from `judgeHorary.ts` entirely.

This document specifies the second, independent engine: textbook classical
KP horary judgment, with no numeric scoring and no RKP-specific additions.
Both engines run on the **same chart** (see §1) and both verdicts are
returned to the user side by side — they are not meant to agree, and
disagreement between them is informative, not a bug.

## 1. Core engine model — shared chart, divergent judgment

Ayanamsa and house system are **not** a divergence point between the two
traditions — Lahiri (Chitrapaksha) ayanamsa and Placidus cusps (Porphyry
fallback at extreme latitude) are correct KP practice for both RKP and
classical KP (`RKP_KP_FORENSIC_AUDIT.md` §A: "Sidereal zodiac with Lahiri
... Placidus house cusps"). `judgeKP` therefore takes the exact same
`Chart` object `buildChart()` already produces for RKP — there is no
second chart to build.

What genuinely diverges between the two engines:

1. **Ruling-planet composition** — classical KP's 5 witnesses vs. RKP's 6
   (RKP's Hora Lord is an explicit RKP-only addition — see §4).
2. **The judgment mechanism itself** — classical KP is a categorical
   majority-count of confirming vs. denying witnesses (§5); RKP is a
   weighted numeric score against fixed thresholds. Classical KP has no
   concept of "+2 for the Moon's sub-lord" as a scored input — the Moon's
   sub-lord is tracked for timing/display, not judgment (§3).
3. **Horary Number witness (§11).** The 1–249 numbered-horary technique is
   classical KP's own method (Krishnamurti's numbered-horary system) — used
   by `judgeKP`, not by RKP. `judgeHorary.ts` has no such parameter.
4. **Remedy** (§9) uses the same selection basis and table as RKP (Moon's
   Sub-Lord → `src/astrology/kp/judgment/remedy.ts`) — shared product logic
   applied identically by both engines, not itself KP or RKP doctrine.

## 2. House Matrix

`judgeKP` uses the same `HOUSE_MATRIX` table as RKP
(`src/astrology/kp/rules/houseMatrix.ts`). The house groupings (e.g.
career → favorable 6/10/11, denial 5/8/12) are standard textbook KP
significations independent of RKP's scoring adaptation — the same
favorable/denial house sets are the input classical KP significator
analysis operates on, just processed differently (§5). One shared,
owner-vetted table serves both engines; see the file's own header comment
for the split-if-ever-needed policy.

## 3. The sub-lord chain — shared, unchanged

Full sub-lord chain (nakshatra lord → sub lord → sub-sub lord, proportional
to Vimshottari dasha years) is genuine KP core, already correctly
implemented and shared: `src/astrology/primitives/subLord.ts`,
`src/astrology/kp/rules/nakshatras.ts`, `src/astrology/kp/rules/vimshottari.ts`.

The Moon's sub-lord is still computed and surfaced in `judgeKP`'s output
(`Verdict.moonSubLord`) for display and as the anchor for timing
(`computeConvergenceTiming`, shared, unchanged) — but unlike RKP, it does
**not** contribute a numeric score to the verdict. Classical KP treats
significator analysis of the Ruling Planets (§4-§5) as the decisive
judgment layer.

## 4. Ruling Planets — 5 Classical Witnesses, no Hora Lord

`RKP_KP_FORENSIC_AUDIT.md` §A lists the 5 classical ruling planets; this
app's existing `chart.rulingPlanets` 6-tuple already contains all 5 plus
RKP's Hora Lord addition (`docs/RKP_RULES_FROM_SARFARAZ.md`: "5 Classical
KP Witnesses plus 1 Confirmatory RKP Lord"):

1. Day Lord
2. Ascendant's sign lord
3. Ascendant's star (nakshatra) lord
4. Moon's sign lord
5. Moon's star (nakshatra) lord

`judgeKP` uses exactly these 5 —
`src/astrology/primitives/rulingPlanets.ts::classicalWitnesses()` strips
Hora Lord (index 1) from the 6-tuple. Hora Lord remains available on
`chart.horaLord` for display/context, but is never a KP witness.

The Kotamraju filter (a candidate witness is rejected if its own sub-lord
occupies a denial house — `RKP_KP_FORENSIC_AUDIT.md` §B: "a legitimate and
advanced KP verification step") applies identically to both engines'
witness sets; shared implementation in
`src/astrology/kp/judgment/kotamraju.ts`.

## 5. Significators and Fructification — categorical, not scored

**Significators** (who represents a house, strongest to weakest — already
implemented and shared, `src/astrology/kp/judgment/significators.ts`):

1. Planets in the nakshatra of planets occupying the house (strongest)
2. Planets directly occupying the house
3. Planets in the nakshatra of the house's lord
4. The house's lord itself

**Promise layer** (shared, `src/astrology/kp/judgment/promise.ts`): the
sub-lord of the question's PRIMARY house cusp must not occupy a denial
house, or the matter is `DENIED` outright — the chart cannot address the
question, before any witness analysis runs.

**Fructification** — the genuinely distinct classical-KP judgment step.
`RKP_KP_FORENSIC_AUDIT.md` §F gives the correct pseudocode:

```
confirmed_sigs = favorable_significators ∩ ruling_planets
denied_sigs    = denial_significators ∩ ruling_planets
if confirmed_sigs.length > denied_sigs.length: verdict = YES
elif denied_sigs.length > confirmed_sigs.length: verdict = NO
else: verdict = CONDITIONAL
```

This is a **majority count of witnesses**, not a weighted score — there
are no thresholds like RKP's "≥3" or "≤−2" anywhere in `judgeKP`. A tie
(including 0 confirmed / 0 denied, i.e. no witness is also a significator)
is `CONDITIONAL`.

## 6. Retrograde → DELAYED

Shared doctrine, `src/astrology/kp/judgment/retrogradeModifier.ts`: a YES
verdict becomes DELAYED when the Moon's sub-lord, Jupiter, or Venus is
retrograde at the chart moment. Applied identically by both engines.

## 7. Timing

Reused as-is, unchanged: `computeConvergenceTiming()` in
`src/astrology/kp/judgment/timing.ts` takes any confirmed-significator list
and is engine-agnostic — it does not care whether those significators were
derived via RKP's scoring or KP's majority-count.

## 8. Confidence — presentation only, not KP doctrine

Classical KP is categorical (YES/NO/CONDITIONAL/DENIED/DELAYED); it has no
native numeric confidence. `judgeKP` still returns a `confidence` number
because the UI needs one to show, computed as the witness-agreement ratio:

```
confidence = round(max(confirmedCount, deniedCount) / (confirmedCount + deniedCount) * 100)
```

(50 when there are no witnesses at all on either side.) This is explicitly
flagged in code as a presentation-layer convenience, matching
`RKP_KP_FORENSIC_AUDIT.md`'s own callout that "numeric confidence scoring
applied to sub-lord analysis" is not an authentic KP output.

## 9. Remedy — shared with RKP

Remedy guidance is a spiritual/product addition, not itself KP or RKP
doctrine (`RKP_KP_FORENSIC_AUDIT.md` §B: "Remedy from Moon's sub-lord
planet — a spiritual addition, not a KP output"). Precisely *because* it
isn't doctrine specific to either tradition, both engines apply it
identically: same selection basis (the Moon's Sub-Lord) and the same table,
shared in `src/astrology/kp/judgment/remedy.ts` so it can never drift
between engines. `judgeKP` populates `Verdict.remedy` exactly as
`judgeHorary` does.

## 10. Narration

Three languages (en/ur/hi), analytical in register rather than RKP's
mystical/Sufi voice, and — matching the same house style enforced on RKP's
narration by `src/__tests__/judgeHorary.test.ts`'s "oracle narration
language" test — free of raw KP/Vedic jargon (no "significator",
"sub-lord", "cusp", "nakshatra", etc. in the prose). Technical detail
(witness table, cuspal sub-lord, significator counts) belongs in the
structured `Verdict` fields for an expert-mode UI panel, not the narrative
sentence.

## 11. Horary Number Witness — classical KP's own technique, used by `judgeKP` only

Krishnamurti's classical horary system is itself built around the querent
choosing a number from 1–249 at the moment of asking — this is a
foundational classical-KP technique, not an RKP invention. (An earlier
revision of this codebase had this backwards — see the correction note in
§0.) `judgeKP(chart, question, horaryNumber?)` accepts an optional
1–249 number, server-generated per reading (never client-supplied, to keep
the engine itself pure/deterministic — see `functions/src/functions/askOracle.ts`).

Mapping: the number is spread across the zodiac via an equal 360°/249
division (`src/astrology/kp/judgment/judgeKP.ts::horaryNumberToLongitude`)
— **not** a reproduction of Krishnamurti's historical printed horary-number
table, which this codebase does not have; this is a fresh,
internally-consistent mapping built on the same real KP sub-lord machinery
used everywhere else in the engine. That longitude's sub-lord becomes a 6th
witness in the majority count (§5): it adds one vote to `confirmedCount` if
it occupies a favorable house, one vote to `deniedCount` if denial, zero
otherwise. Optional — omitting `horaryNumber` reproduces the exact 5-witness
scoring. `judgeHorary` (RKP) has no `horaryNumber` parameter at all.
