# RKP verification — engine answer key (DO NOT paste into Google AI)

Compare these against Google AI's Part C answers. Generated from
`judgeWatchChart` (functions/src/engine/rkp/watchJudgment.ts) on the exact
charts listed in RKP_RULE_VERIFICATION_PROMPT.md. This is what the engine says,
not proof of what RKP says.

| Case | Question | Engine state | Score | Obstruction | Target Ghar / ruler |
|---|---|---|---|---|---|
| 1 | Job, 20 Oct 2026 07:28 | UNFORMED | −2 | Rahu (aspect on 10th) | 10th / Utarid |
| 2 | Job, 12 Mar 2026 16:42 | BLOCKED | −5 | Zuhal (aspect on 10th) | 10th / Utarid |
| 3 | Marriage, 5 Jun 2026 11:13 | BLOCKED | −6 | Zuhal (aspect on 7th) | 7th / Mushtari |
| 4 | Business, 2 Dec 2026 09:51 | BLOCKED | −7 | Mirrikh (sits in 7th) | 7th / Shams |
| 5 | Illness, 17 Aug 2026 20:07 | DELAYED | −1 | Zuhal (aspect on 1st) | 1st / Zuhrah |

Contributing factors the engine applied:

- Case 1: Rahu aspect on 10th −2; Mirrikh on 11th −2; Mushtari on 11th +2.
- Case 2: querent ruler Mushtari counts Utarid enemy −2; Mirrikh aspect on 10th −2;
  Zuhrah aspect +2; Zuhal aspect −2; Mushtari on 11th +2; Rahu on 11th −2;
  Utarid combust −1. Utarid retrograde (no points, but REVERSING is overridden by
  the ≤ −5 BLOCKED rule).
- Case 3: Mushtari weak (enemy sign) −2; Mushtari aspect +2; Zuhrah aspect +2;
  Zuhal aspect −2; Dhanab aspect −2; Mirrikh on 11th −2; Dhanab on 11th −2.
- Case 4: Zuhal (querent ruler) counts Shams enemy −2; Mirrikh sits −2; Mushtari
  sits +2; Dhanab sits −2; Rahu aspect −2; Mushtari on 11th +2; Zuhal on 11th −2;
  Dhanab on 11th −2; Shams in favourable 10th +1.
- Case 5: Zuhrah weak (debilitated) −2; Zuhal aspect −2; Zuhal on 11th −2;
  Mushtari on 11th +2; Zuhrah on 11th +2; Zuhrah in favourable 5th +1.

What to look for when Google AI answers:

1. Case 4 has Mushtari in the 7th (a strong benefic in the target Ghar) and Shams
   (ruler) in the 10th, yet the engine says BLOCKED, −7. If Google AI says
   YES/favourable, the malefic-heavy weighting (H1) is a bug.
2. Case 2 has Zuhrah exalted aspecting the 10th, but the engine says BLOCKED.
3. Case 3 has Mercury, Jupiter and Venus all in the 1st Ghar — if Google AI judges
   this favourable, the engine's −6 is wrong.
4. If Google AI confirms H2 (upachaya), every case with a malefic in 3/6/10/11 is
   scored wrongly by the engine today.
