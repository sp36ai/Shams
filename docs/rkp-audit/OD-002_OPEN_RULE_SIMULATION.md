# Read-only simulation of the open OD-002 rules

**Nothing here is implemented.** Each reading below was applied to a throw-away copy of the current engine
(`attribution-harness/build_sim_variants.py`, `run_sim.ts`); `src/` and `functions/src/` are unchanged. A
simulation shows what a reading would do, not which reading is the owner's. Distribution figures are over the
same 1,952 sampled 2026 moments per question type used before; they show direction and size, not accuracy.

## Checks that came out of the latest review

| Item | Finding |
|---|---|
| **Case 3 "Mushtari at 30.0°"** | A rounding artefact in the first AI prompt (one decimal). The engine's unrounded sidereal longitude puts Mushtari at **29.9700° of Jauza** (sign 3), and the sign is derived from the unrounded value, so there is no sign or Ghar error. It is 0.03° (about 108 arc-seconds) from the Jauza/Sartan boundary: far larger than the ephemeris error, but any change of ayanamsa convention would matter here. |
| **"Six malefic aspect hits per chart"** | True as a count over the whole chart: with the old table every chart carries exactly **6** node aspect relations (2 nodes × 3). On the matter's Ghar plus the 11th, the old engine put on average **1.0 (career) to 1.43 (marriage, business, health, travel)** node-aspect hits, and **every career chart (100%) had at least one**, against 71% for the other four types. |
| **Stacking of occupancy and aspect** | A planet cannot both sit in and aspect the same Ghar (no aspect distance equals 1), so no planet is scored twice for one Ghar; each distinct planet scores once per Ghar. |
| **Timing "contradiction" (B)** | The degree-distance timing came from an unsourced outside AI proposal; the owner's replies confirmed the base windows and the ×1.5 / ×1.5 / ×0.7 multipliers and added modality. Production keeps the owner-confirmed model; degree-distance timing is not part of any owner answer. |
| **Shams, Utarid (C, D)** | The conflicting rules were the outside AI's classification suggestions, not the owner's sheet answers. The owner's wording ("Utarid conjunct a malefic: 0 or −1"; Shams +1 career/health, −1 in the 7th for marriage) is what remains open, and it does not say whether aspect counts or whether a benefic mitigates. Not implemented. |
| **Qamar bright half (E)** | The owner's "waxing, elongation between 72° and 288°" cannot mean waxing: 180°–288° is waning. A formula must be given: forward elongation = (Moon − Sun) mod 360; is the bright half 72°–288° inclusive, or the 180°-symmetric reading? Not implemented. |
| **"HYP-024 to 026"** | These IDs do not exist in this repository's ledger (it uses L-rows and OD entries); there is no `watchAspects.ts` either — aspects live in `rkp/rules.ts`. No new IDs were created. |

## The five cases under each reading

States are Fulfilled / Moving / Delayed / Unformed / Reversing, with the score; owner's own judgments for
reference: 1 Moving-or-Fulfilled, 2 Delayed-or-Reversing, 3 Yes, 4 Yes-moving, 5 Delayed.

| Reading | Case 1 job | Case 2 job | Case 3 marriage | Case 4 business | Case 5 health |
|---|---|---|---|---|---|
| Current branch (phase 1) | Moving (+2) | Reversing (0) | Fulfilled (+4) | **Unformed (−1)** | Delayed (+1) |
| S7 strict: ruler in the opposite Ghar, 7th aspect back, +2 (target and 11th) | Fulfilled (+4) | Reversing (0) | Fulfilled (+6) | **Unformed (−1)** | Delayed (+1) |
| S7 broad: ruler casts any aspect onto its own Ghar, +2 | Fulfilled (+4) | Reversing (0) | Fulfilled (+6) | **Moving (+1)** | Delayed (+3) |
| S7 broad + 11th ruler sitting in the 11th +2 | Fulfilled (+4) | Reversing (0) | Fulfilled (+8) | **Moving (+1)** | Delayed (+3) |
| S4 B1: neutral/friendly malefic in 3/6/10/11 = 0 for career, legal, business, finance | Moving (+2) | Reversing (0) | Fulfilled (+4) | Unformed (−1) | Delayed (+1) |
| S4 B2: any malefic that is not own/exalted/debilitated = 0 for those four; debilitated −1 for all | Moving (+3) | Reversing (0) | Fulfilled (+4) | Unformed (−1) | Delayed (+1) |

**Case 4 is decided by one question:** whether "a ruler casting an aspect onto its own house" includes
special aspects. Mushtari, the 11th's ruler, sits in the 7th and aspects the 11th by its 5th aspect. Counted
(broad), Case 4 becomes Moving (+1), the owner's judgment. Not counted (strict), it stays Unformed. The S4
readings do not change Case 4 (it has no malefic in a growing Ghar that those readings reach).

## Distribution (Fulfilled + Moving % / Blocked %)

| Reading | career | marriage | business | health | travel | finance | legal |
|---|---|---|---|---|---|---|---|
| Current branch | 11 / 5 | 30 / 10 | 31 / 10 | 26 / 0 | 63 / 0 | 41 / 1 | 24 / 8 |
| S7 strict | 14 / 5 | 32 / 9 | 33 / 8 | 35 / 0 | 69 / 0 | 41 / 1 | 25 / 6 |
| S7 broad | 16 / 5 | 32 / 9 | 33 / 8 | 37 / 0 | 73 / 0 | 41 / 1 | 25 / 6 |
| S7 broad + 11th ruler in 11th | 18 / 3 | 35 / 9 | 35 / 8 | 43 / 0 | 73 / 0 | 42 / 1 | 26 / 6 |
| S4 B1 | 17 / 2 | 30 / 10 | 32 / 9 | 26 / 0 | 63 / 0 | 43 / 0 | 24 / 1 |
| S4 B2 | 17 / 0 | 30 / 10 | 32 / 5 | 26 / 0 | 63 / 0 | 43 / 0 | 27 / 1 |

Each open rule would push the engine further toward positive results, in line with phase 1. S4 B2 would take
career blocks to 0% and legal to 1%.

## What this does not settle

- It does not choose a reading. The owner must.
- Only two of the five cases were judged by the owner, and not blind (see OD-002), so no error rate can be
  computed. There is no reference set that would make a target approval rate defensible.
- Utarid, Shams and Qamar are not simulated: their rules are not specified enough to simulate without inventing
  one.
