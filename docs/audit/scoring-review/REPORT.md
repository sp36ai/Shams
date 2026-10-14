# Scoring Integrity Review — RKP watch judgment

**Status:** read-only diagnostic. **No engine change.** Rules, weights, aspect
conventions, thresholds and precedence are frozen (owner decision,
2026-10-14). Every variant below exists only inside the analysis harness and
is an illustration, not a proposed rule.

- Harness: `functions/scripts/scoring-review.ts`
  (run `npx vite-node scripts/scoring-review.ts` from `functions/`)
- Raw output: `docs/audit/scoring-review/results.json`
- Engine version reviewed: `functions/src/engine/rkp/watchJudgment.ts` at
  `fd18e73` (server copy verified identical to `src/astrology/rkp` by
  `sync-engine --check`).

## Reading sets

| Set | What | Readings | Distinct charts |
|---|---|---|---|
| October | 4 questions × every 5 min of 2026-10-01…30, IST | 34,560 | **264** |
| Two years | 4 questions × 12 ascendant slots (12:00–12:55 IST) × every day of 2026–2027 | 35,040 | — |
| Golden corpus | `docs/audit/golden-corpus` | 111 | — |

**Important caveat.** The watch minute alone fixes the ascendant (:00 is always
Burj Hamal, :05 Burj Saur, … :55 Burj Hoot), and the real planets passed
through only 22 configurations in October. The 34,560 October readings
therefore contain only 264 distinct charts, which is far less independent
evidence than the count suggests. That is why the two-year set was added.

Questions used: "Xfghbf" (classified *general*), "Will I get the new job?"
(*career*), "Will I marry her?" (*marriage*), "Will my money come back?"
(*finance*).

## Audit 1 — Contribution audit

An independent replica recomputes every score step by step from chart data
(not from factor text).

- The replica reproduces the engine's **score, state and confidence on all
  34,560 October readings and all 35,040 two-year readings**: 0 mismatches.
- The step means sum exactly to the mean score:

| Step | Mean | Readings where negative | Readings where positive |
|---|---|---|---|
| 1 Ruler dignity | +0.279 | 21.0% | 35.0% |
| 2 Querent's ruler vs matter's ruler | −0.083 | 20.8% | 16.7% |
| 3 Witnesses on the matter's Ghar | −1.667 | 58.3% | 8.3% |
| 4 Witnesses on the 11th Ghar | −1.667 | 58.3% | 8.3% |
| 5 Ruler's placement | +0.115 | 16.5% | 28.0% |
| 6 Combustion | −0.065 | 6.5% | — |
| **Sum = mean score** | **−3.088** | | |

Every component is applied as the code states. No arithmetic defect was
found.

## Audit 2 — Contact-level audit (October)

Contacts per reading, summed over the matter's Ghar and the 11th Ghar:

| Planet | Scored as | Sits (per reading) | Gazes (per reading) | Mean points |
|---|---|---|---|---|
| Zuhal, Mirrikh, Ras, Dhanab (each) | −2 | 0.17 | 0.50 | **−1.33 each** |
| Mushtari | +2 | 0.17 | 0.50 | +1.33 |
| Zuhrah | +2 | 0.17 | 0.17 | +0.67 |
| Shams, Qamar, Utarid | 0 | 0.17 | 0.17 | 0 |

- Sitting in a house is symmetric: every planet sits in a judged house
  equally often. The imbalance comes entirely from the gaze rules: four
  malefics with 3 extra gazes each, against one benefic with 3 extra gazes
  and one with only the 7th.
- **One planet can contribute more than once in a judgment**:
  - 45.8% of readings have the same scoring planet on both the matter's Ghar
    and the 11th, so it is counted in both step 3 and step 4.
  - 22.9% of readings score the matter's own ruler for dignity (step 1) and
    again as a witness (steps 3 and 4).
- **Node axis**:
  - Both nodes touch the same judged house in 16.7% of judged houses. Because
    the nodes are exactly opposite and share the 5/7/9 gaze, Ras in a house
    always gazes on Dhanab's house, and the reverse.
  - Node contacts per judgment: 0 in 25%, 1 in 33%, 2 in 25%, 3 in 17%.

## Audit 3 — Counterfactual replay (identical October readings)

| | Mean score | FULFILLED | MOVING | DELAYED | BLOCKED | REVERSING | UNFORMED |
|---|---|---|---|---|---|---|---|
| Current rules | −3.09 | 0.18% | 0.58% | 29.34% | 33.67% | 23.31% | 12.92% |
| Axis once per house | −2.42 | 0.18% | 0.58% | 32.52% | 24.63% | 26.42% | 15.67% |
| Axis once per judgment | −1.92 | 0.18% | 0.58% | 37.60% | 17.47% | 26.86% | 17.31% |

Verdict transitions in October:
- **Axis once per house:** only BLOCKED readings change. 3,124 move to
  DELAYED (1,098), REVERSING (1,074) or UNFORMED (952). No other state changes.
- **Axis once per judgment:** only BLOCKED readings change. 5,600 move to
  DELAYED (2,854), UNFORMED (1,519) or REVERSING (1,227).
- **No reading becomes FULFILLED or MOVING in October** under either variant.
  Removing the node double count turns "closed" into "delayed / turning /
  unsettled", not into "yes". The precedence (retrograde → REVERSING; Zuhal or
  a weak ruler → DELAYED) still applies first.

Only the BLOCKED (−5) boundary is crossed in October. The +5 and +2
boundaries are never crossed.

## Audit 4 — Breakdown (October)

| Question | Mean score | BLOCKED now | BLOCKED, axis per house | BLOCKED, axis per judgment | Positive now |
|---|---|---|---|---|---|
| general ("Xfghbf") | −3.12 | 33.3% | 28.7% | 8.3% | 0% |
| career | −3.11 | 39.2% | 33.6% | 33.6% | 0.7% |
| marriage | −3.92 | 50.0% | 33.3% | 25.0% | 1.6% |
| finance | −2.20 | 12.2% | 3.0% | 3.0% | 0.7% |

- **By hour:** flat. BLOCKED is between 33.6% and 33.8% in every hour,
  because each hour repeats the same 12 ascendants.
- **By ascendant (watch minute):** this dominates. BLOCKED ranges from 0%
  (Burj Saur, Jauza, Sunbula, Jadi) to 100% (Burj Hamal). Mean scores range
  from −6.86 (Burj Dalw) to +0.70 (Burj Jadi).
- **By node-axis position** (Ras counted from the matter's Ghar): Ras in the
  7th from the target gives 71.9% BLOCKED; in the 12th, 0%. Variants change
  only the positions where the axis touches a judged house.

## Audit 5 — Sky variation (two years, 2026–2027)

| | Mean score | FULFILLED | MOVING | DELAYED | BLOCKED | REVERSING | UNFORMED |
|---|---|---|---|---|---|---|---|
| Current rules | −3.54 | 1.46% | 3.58% | 17.26% | 38.62% | 10.65% | 28.43% |
| Axis once per house | −2.87 | 1.74% | 4.18% | 19.18% | 30.91% | 11.60% | 32.39% |
| Axis once per judgment | −2.37 | 1.76% | 5.27% | 21.68% | 24.59% | 12.41% | 34.29% |

- The mean score is negative in **all 24 months** (−2.72 to −4.86).
  Monthly BLOCKED ranges from 24% to 54%.
- Positive verdicts (FULFILLED + MOVING) range from 0.4% to 15% by month.
- The lean is **structural, not specific to October's sky**. October 2026 is
  a typical month, not an outlier.

## Golden corpus (111 cases)

- **71 / 111 reproduce exactly.** All 40 differences have one cause: the
  corpus was generated on 2026-09-09, before the owner decision of 2026-10-08.
  That decision stopped a planet that rules both the querent and the matter
  from scoring +2 as "its own friend". Each of the 40 cases lost exactly that
  +2 (9 changed state, 31 changed score only). No unexplained drift.
- The corpus should be regenerated so it reflects the current approved rules.
  That is a scaffolding update, not an engine change.
- Under the variants:
  - **Axis once per house:** 14 cases change, 13 of them BLOCKED → other.
    `property-001` goes UNFORMED (0) → MOVING (+2).
  - **Axis once per judgment:** 22 cases change, with the same pattern.
  - The case lists are in `results.json → goldenCorpus.changed`.

## Findings

1. **No scoring defect.** Every component is applied exactly as written, and
   the replica matches the engine on every reading.
2. **The negative lean is structural and persistent** (24 of 24 months). It
   comes from steps 3 and 4. Occupancy is symmetric; the asymmetry is in the
   gaze rules and in the count of malefics (4) versus benefics (2).
3. **The node axis is the largest single contributor**, but not the only one.
   Counting the axis once per judgment cuts BLOCKED from 38.6% to 24.6% over
   two years, yet the mean score stays negative (−2.37).
4. **Double counting exists beyond the nodes.** A planet witnessing both judged
   houses (45.8% of readings) and the matter's ruler also scored as a witness
   (22.9%) are open doctrinal questions of the same kind.
5. **The watch minute (ascendant) decides more than anything else.** Some
   minutes almost always read BLOCKED in a given sky; others almost never do.

## Open questions for the owner (doctrine, not statistics)

1. Do Ras and Dhanab act as **one axis or two independent malefics** in a
   judged house?
2. Should a planet witnessing **both** the matter's Ghar and the 11th count
   once or twice?
3. Should the matter's ruler, already judged for dignity, **also count as a
   witness** on its own Ghar or on the 11th?
4. Is it intended that **Zuhrah gazes only on the 7th** while the four
   malefics and Mushtari gaze on 3 extra houses?

Per the acceptance criterion, any change must be justified by the judgment
doctrine and land with deterministic tests. Statistical balance alone is not
a reason.
