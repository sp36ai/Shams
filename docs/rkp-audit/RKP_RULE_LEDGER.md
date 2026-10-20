# RKP Watch Engine — rule ledger

Purpose: record, for every rule the watch engine applies, where it came from and
how well that origin is established. Written so no disputed rule is changed, or
left unchanged, on the strength of an assumption.

Scope: `src/astrology/rkp/*` (mirrored to `functions/src/engine/rkp/*`) and the
house matrix in `kp/rules/houseMatrix.ts`. Observations are from reading the
code and `docs/RKP_RULES_FROM_SARFARAZ.md`. No engine file was modified.

## Evidence statuses

| Status | Meaning |
|---|---|
| VERIFIED-OWNER | Explicitly stated by Astro Sarfaraz or in his rules document |
| VERIFIED-SOURCE | Supported by an identifiable source that defines the RKP tradition |
| HYPOTHESIS | Plausible, in the code, but not confirmed by owner or source |
| UNKNOWN | No evidence either way |
| CONTRADICTED | Conflicts with an established rule |

An unnamed or circular source (for example "Shams al-Asrar canon", or a
classical text applied to RKP without showing RKP uses it) is not evidence.
Absence from a classical text is not evidence against a rule either.

## Two cautions that apply to every row

1. `RKP_RULES_FROM_SARFARAZ.md` describes an older flow (Moon sub-lord, ruling
   planets, cuspal sub-lords). Its header says it is aligned to the runtime
   engine; it is not. Where this ledger cites it, it cites only parts the watch
   engine still uses (the house table, Lahiri, the 2026-10-08 decision).
2. That document does contain numeric scoring (+2/−2 for the Moon sub-lord's
   house, ±1 per ruling planet, thresholds ≥3 / ≤−2). So "RKP never scores
   numerically" is not established by the owner's own material. It also does not
   establish the watch engine's weights.

## Ledger

| ID | Rule as implemented | Where | Status | Basis / note |
|---|---|---|---|---|
| L1 | Local clock minute → twelve 5-minute brackets → 1st Ghar sign (00–04 Hamal … 55–59 Hoot); rest in zodiac order | `watchGrid.ts` | UNKNOWN | Not in the owner document. Code header calls it the "Digital Watch Oracle" mechanism and compares it to KP's number method. Needs owner confirmation of the bracket→sign mapping |
| L2 | Planets are real sidereal positions placed into the watch frame by sign | `watchChart.ts` | HYPOTHESIS | Design choice stated in code; no owner statement found |
| L3 | Lahiri ayanamsa | `primitives/ayanamsa.ts` | VERIFIED-OWNER | Doc §3 "Lahiri only" |
| L4 | Rahu/Ketu use mean node, always retrograde | `primitives` | UNKNOWN | Not addressed in owner document |
| L5 | House matrix: primary / favourable / denial per question type (career, marriage, finance, health, property, travel, legal, education, business, children, lostitem) | `kp/rules/houseMatrix.ts` | VERIFIED-OWNER | Doc §2 calls it "the exact owner-provided table". Travel denial "—" and business primary 7 both match the doc |
| L6 | Extension types `enemies`, `spiritual`, `general` | same | HYPOTHESIS | Doc marks them "app-retained", not part of the owner's table |
| L7 | 11th Ghar is the fulfilment Ghar for every question | `watchJudgment.ts` | HYPOTHESIS | Hard-coded constant; no owner statement found |
| L8 | Benefics = Mushtari, Zuhrah only; malefics = Zuhal, Mirrikh, Ras, Dhanab; Shams, Qamar, Utarid neutral | `rules.ts` | HYPOTHESIS | Code comments give no owner source |
| L9 | Aspects: all planets 7th; Mirrikh 4,7,8; Mushtari 5,7,9; Zuhal 3,7,10; Ras/Dhanab 5,7,9 | `rules.ts` | HYPOTHESIS | Code comment: nodes follow Mushtari's pattern, "the common convention" |
| L10 | Exaltation/debilitation signs, own signs; Rahu exalted Saur, Ketu Aqrab | `rules.ts` | HYPOTHESIS | Code comment: "We follow the common assignment" for the nodes. Node exaltation is disputed in the wider tradition |
| L11 | Friendship table, one-way (A→B may differ from B→A) | `rules.ts` | HYPOTHESIS | Comment calls it the classical table. Whether RKP uses it, and one-way, is unconfirmed |
| L12 | Strong = exalted or own sign; weak = enemy sign or debilitated; friendly/neutral give 0 | `rules.ts` | HYPOTHESIS | Threshold is an engineering choice |
| L13 | Same planet rules querent and matter → relation step adds nothing | `watchJudgment.ts` S2 | VERIFIED-OWNER | Owner decision 2026-10-08, recorded in doc §2 |
| L14 | Matter ruler strong +2 / weak −2 | S1 | HYPOTHESIS | Weight not in owner material |
| L15 | Querent ruler friend of matter ruler +2 / enemy −2 | S2 | HYPOTHESIS | Weight not in owner material (the 2026-10-08 decision only removes the self case) |
| L16 | Each benefic on/aspecting target Ghar +2; each malefic −2 | S3 | HYPOTHESIS | Equal ±2 across 4 malefics vs 2 benefics; measured effect in `case_records.md` and the earlier 1,952-moment sweep |
| L17 | Same weights for planets on/aspecting the 11th Ghar | S4 | HYPOTHESIS | As L16 |
| L18 | Matter ruler lands in favourable Ghar +1 / denial −1 | S5 | HYPOTHESIS | Uses the verified matrix (L5) but the ±1 weight is unconfirmed |
| L19 | Matter ruler retrograde → REVERSING; combust −1 | S6, ladder | HYPOTHESIS | Not in owner material. Old flow's retrograde modifier was a different rule (turned YES into DELAYED) |
| L20 | Obstruction order: Zuhal, Mirrikh, Ras, Dhanab; occupant before aspect; Qamar in 8/12 = "mind not settled" | `firstObstruction` | HYPOTHESIS | No source |
| L21 | State ladder: ≤−5 BLOCKED; retrograde REVERSING; ≥5 FULFILLED; Zuhal obstruction or weak ruler DELAYED; ≥2 MOVING; else UNFORMED | `resolveState` | HYPOTHESIS | Thresholds not in owner material. Old flow used ≥3 / ≤−2, so these are new |
| L22 | Confidence bands by score magnitude; downgrade when benefic and malefic both present | `bandConfidence` | HYPOTHESIS | No source |
| L23 | Timing base days per planet, ×1.5 retrograde, ×1.5 weak, ×0.7 exalted | `BASE_TIMING`, `computeTiming` | HYPOTHESIS | Doc §6 describes a different timing method (dasha years × score ratio). Code comment says "reflecting classical speed" |

## Summary

- VERIFIED-OWNER: L3, L5, L13.
- Everything that decides a verdict (L7–L12, L14–L23) is HYPOTHESIS.
- UNKNOWN: L1, L4. L1 is the central mechanism and should be confirmed first.

Nothing in this ledger says the hypotheses are wrong. It says they are not yet
established, which matters because three of the four verdicts that look most
implausible (cases 2–4 in `case_records.md`) are decided entirely by rows
L14–L17 and L21.

## Release gate for any change to a HYPOTHESIS row

1. The new rule traces to owner confirmation or a named source, recorded here.
2. Each changed rule has a positive, a negative and (where it applies) an
   exception test.
3. The golden corpus (`functions/scripts/generate-golden-corpus.ts`,
   `replay-check.ts`) is replayed and every changed verdict is listed and
   explained, not silently accepted.
4. Rules still UNKNOWN stay as they are and are named in the release notes.
