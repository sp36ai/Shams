# Golden-corpus replay — before vs after owner decision OD-002 (phase 1)

Generated with `functions/scripts/generate-golden-corpus.ts` on the engine before and after the
phase-1 rule changes. "Before" is a fresh capture from the unmodified engine, not the committed
corpus under `docs/audit/golden-corpus/`, which predates later remedy-selection changes and no longer
matches the engine. This lists what changed; it does not say which side is right.

- Cases: 111; state unchanged: 35; state changed: 76. Scores are shown per case.

| Before → after | Cases |
|---|---|
| BLOCKED → DELAYED | 36 |
| DELAYED → DELAYED | 21 |
| DELAYED → FULFILLED | 11 |
| UNFORMED → MOVING | 10 |
| BLOCKED → UNFORMED | 9 |
| REVERSING → REVERSING | 4 |
| BLOCKED → BLOCKED | 4 |
| BLOCKED → REVERSING | 4 |
| UNFORMED → UNFORMED | 4 |
| REVERSING → FULFILLED | 4 |
| FULFILLED → FULFILLED | 2 |
| MOVING → FULFILLED | 1 |
| UNFORMED → FULFILLED | 1 |

| Case | Type | Question | Before | After |
|---|---|---|---|---|
| ambiguous-001 | career | Will it work out? | DELAYED (2) | FULFILLED (5) **changed** |
| ambiguous-002 | general | Should I do it or not? | UNFORMED (0) | MOVING (3) **changed** |
| ambiguous-003 | general | What should I do? | DELAYED (-2) | DELAYED (2) |
| business-001 | business | Will my new business succeed? | BLOCKED (-9) | DELAYED (-5) **changed** |
| business-002 | marriage | Should I take on a business partner? | DELAYED (3) | FULFILLED (6) **changed** |
| business-003 | finance | Will my shop turn a profit this year? | UNFORMED (-2) | MOVING (2) **changed** |
| business-004 | business | Should I expand my business to a new city? | REVERSING (-2) | REVERSING (1) |
| business-005 | business | Will my startup get funded? | FULFILLED (7) | FULFILLED (9) |
| business-006 | marriage | Is my business partner trustworthy? | BLOCKED (-8) | DELAYED (-3) **changed** |
| business-007 | business | Should I close my failing business? | BLOCKED (-5) | DELAYED (-2) **changed** |
| disputes-001 | legal | Will I win my court case? | BLOCKED (-11) | BLOCKED (-6) |
| disputes-002 | business | Is my business rival trying to sabotage me? | DELAYED (2) | FULFILLED (5) **changed** |
| disputes-003 | legal | Will the legal notice against me be withdrawn? | DELAYED (-2) | DELAYED (2) |
| disputes-004 | legal | Should I settle out of court? | BLOCKED (-6) | DELAYED (-1) **changed** |
| disputes-005 | general | Does my colleague mean me harm? | DELAYED (-2) | DELAYED (2) |
| education-001 | education | Will I pass my upcoming exam? | REVERSING (-2) | REVERSING (2) |
| education-002 | education | Will I get admission to this university? | BLOCKED (-6) | REVERSING (-2) **changed** |
| education-003 | travel | Should I pursue a higher degree abroad? | UNFORMED (-4) | UNFORMED (0) |
| education-004 | education | Will I win the scholarship I applied for? | DELAYED (-4) | DELAYED (0) |
| education-005 | children | Should my child change schools? | MOVING (4) | FULFILLED (8) **changed** |
| employment-001 | career | Will I get the job I interviewed for? | BLOCKED (-5) | REVERSING (-1) **changed** |
| employment-002 | career | Should I resign from my current job? | REVERSING (1) | FULFILLED (4) **changed** |
| employment-003 | career | Will I get promoted this year? | DELAYED (2) | FULFILLED (5) **changed** |
| employment-004 | career | Is my job at risk of layoffs? | BLOCKED (-7) | DELAYED (-3) **changed** |
| employment-005 | general | Should I switch careers entirely? | DELAYED (-2) | DELAYED (2) |
| employment-006 | career | Will my visa sponsorship for this job be approved? | BLOCKED (-5) | UNFORMED (-1) **changed** |
| family-001 | children | Will I be blessed with a child soon? | BLOCKED (-7) | UNFORMED (-2) **changed** |
| family-002 | enemies | Will my family conflict be resolved? | DELAYED (-2) | DELAYED (1) |
| family-003 | health | Is my son's health going to improve? | BLOCKED (-9) | DELAYED (-4) **changed** |
| family-004 | general | Will my parents reconcile? | UNFORMED (0) | MOVING (3) **changed** |
| family-005 | legal | Will my daughter's custody case go in my favour? | REVERSING (-2) | REVERSING (1) |
| finance-001 | finance | Will I recover the money I lent? | BLOCKED (-7) | DELAYED (-4) **changed** |
| finance-002 | finance | Should I invest my savings in this fund? | DELAYED (-3) | DELAYED (1) |
| finance-003 | finance | Will I get out of debt this year? | UNFORMED (-2) | MOVING (2) **changed** |
| finance-004 | finance | Will my loan application be approved? | UNFORMED (-4) | UNFORMED (0) |
| finance-005 | general | Is it safe to buy gold now? | DELAYED (-2) | DELAYED (2) |
| finance-006 | legal | Will my inheritance dispute be resolved in my favour? | DELAYED (0) | DELAYED (3) |
| general-001 | general | What does my future hold? | BLOCKED (-8) | DELAYED (-3) **changed** |
| general-002 | general | Is this a good time for me overall? | DELAYED (-2) | DELAYED (0) |
| health-001 | health | Will my illness be cured soon? | BLOCKED (-8) | DELAYED (-3) **changed** |
| health-002 | health | Should I undergo the surgery my doctor recommends? | DELAYED (-1) | DELAYED (1) |
| lostitem-001 | health | Will I recover my lost ring? | DELAYED (-2) | DELAYED (2) |
| marriage-001 | marriage | Will I marry the person I love? | BLOCKED (-8) | DELAYED (-3) **changed** |
| marriage-002 | marriage | When will my marriage proposal be accepted? | BLOCKED (-5) | DELAYED (-2) **changed** |
| marriage-003 | marriage | Should I marry the person my family has chosen? | BLOCKED (-12) | BLOCKED (-7) |
| marriage-004 | general | Will my engagement survive? | REVERSING (2) | FULFILLED (5) **changed** |
| marriage-005 | marriage | Is my spouse being faithful to me? | BLOCKED (-7) | DELAYED (-2) **changed** |
| marriage-006 | general | Will my divorce be finalised soon? | BLOCKED (-8) | DELAYED (-3) **changed** |
| marriage-007 | marriage | Should I reconcile with my ex-partner? | DELAYED (3) | FULFILLED (6) **changed** |
| marriage-008 | general | Will my in-laws accept me? | BLOCKED (-9) | DELAYED (-4) **changed** |
| multiintent-001 | career | Will I get the job and also be able to marry my partner this year? | BLOCKED (-5) | UNFORMED (-1) **changed** |
| multiintent-002 | finance | Should I take the loan to start my business and move house at the same time? | DELAYED (-4) | DELAYED (2) |
| multiintent-003 | health | Will my health improve and will I also win the court case? | BLOCKED (-7) | DELAYED (-1) **changed** |
| pad-business-05 | business | Will my business deal close this week? | BLOCKED (-8) | DELAYED (-3) **changed** |
| pad-business-06 | business | Should I sign the new business contract? | BLOCKED (-5) | DELAYED (-2) **changed** |
| pad-business-07 | general | Will my e-commerce store take off? | BLOCKED (-9) | DELAYED (-4) **changed** |
| pad-business-08 | business | Will I be able to hire the right staff for my business? | BLOCKED (-13) | BLOCKED (-6) |
| pad-disputes-23 | general | Will my neighbour drop the complaint against me? | DELAYED (-3) | DELAYED (1) |
| pad-disputes-24 | general | Should I file a police report about this matter? | BLOCKED (-7) | DELAYED (-1) **changed** |
| pad-education-19 | general | Will I clear my entrance test this attempt? | DELAYED (-3) | DELAYED (1) |
| pad-education-20 | health | Should I choose engineering or medicine? | UNFORMED (0) | MOVING (3) **changed** |
| pad-employment-09 | career | Will my transfer request at work be approved? | BLOCKED (-5) | DELAYED (1) **changed** |
| pad-employment-10 | career | Will I clear my job probation period? | REVERSING (1) | FULFILLED (4) **changed** |
| pad-employment-11 | general | Should I ask for a raise this quarter? | BLOCKED (-9) | DELAYED (-4) **changed** |
| pad-family-21 | health | Will my grandmother recover from her illness? | BLOCKED (-9) | UNFORMED (-4) **changed** |
| pad-family-22 | general | Will my brother and I reconcile? | DELAYED (-2) | DELAYED (2) |
| pad-finance-12 | finance | Will I be able to pay off my credit card debt? | UNFORMED (-4) | UNFORMED (0) |
| pad-finance-13 | health | Will the stock I bought recover? | FULFILLED (5) | FULFILLED (8) |
| pad-finance-14 | career | Will my salary increase this year? | BLOCKED (-5) | UNFORMED (-1) **changed** |
| pad-general-27 | general | Is now a favourable time to start something new? | BLOCKED (-8) | DELAYED (-3) **changed** |
| pad-general-28 | general | Will things improve for me soon? | BLOCKED (-9) | DELAYED (-4) **changed** |
| pad-lostitem-26 | lostitem | Will my missing phone be found? | DELAYED (-1) | FULFILLED (4) **changed** |
| pad-property-15 | property | Will construction on my new house finish on time? | DELAYED (1) | FULFILLED (4) **changed** |
| pad-property-16 | property | Should I buy agricultural land this season? | DELAYED (-4) | DELAYED (0) |
| pad-relationship-01 | marriage | Will my relationship with my partner last? | BLOCKED (-8) | DELAYED (-3) **changed** |
| pad-relationship-02 | marriage | Should I trust my partner right now? | DELAYED (3) | FULFILLED (6) **changed** |
| pad-relationship-03 | marriage | Will my long-distance relationship survive? | REVERSING (-2) | REVERSING (1) |
| pad-relationship-04 | marriage | Will my ex come back to me? | BLOCKED (-11) | BLOCKED (-7) |
| pad-spiritual-25 | general | Will I overcome the evil eye affecting me? | BLOCKED (-9) | UNFORMED (-4) **changed** |
| pad-travel-17 | career | Will my visa interview go well? | BLOCKED (-9) | DELAYED (-3) **changed** |
| pad-travel-18 | travel | Is it safe for me to travel by road tomorrow? | BLOCKED (-6) | DELAYED (-1) **changed** |
| property-001 | property | Will I be able to buy this house? | UNFORMED (0) | FULFILLED (4) **changed** |
| property-002 | property | Should I sell my land now or wait? | UNFORMED (-4) | UNFORMED (0) |
| property-003 | property | Will the property dispute with my neighbour end well? | BLOCKED (-6) | DELAYED (-1) **changed** |
| property-004 | general | Will my rental agreement be renewed? | UNFORMED (0) | MOVING (3) **changed** |
| property-005 | property | Should I take a mortgage for this property? | DELAYED (-1) | FULFILLED (4) **changed** |
| spiritual-001 | general | Am I under the effect of black magic? | BLOCKED (-9) | DELAYED (-4) **changed** |
| spiritual-002 | general | Will my dua for guidance be answered? | UNFORMED (0) | MOVING (3) **changed** |
| timing-00 | career | Will I get the job I interviewed for? | BLOCKED (-5) | UNFORMED (-1) **changed** |
| timing-01 | career | Will I get the job I interviewed for? | BLOCKED (-5) | UNFORMED (-1) **changed** |
| timing-04 | career | Will I get the job I interviewed for? | BLOCKED (-5) | UNFORMED (-1) **changed** |
| timing-05 | career | Will I get the job I interviewed for? | UNFORMED (-4) | MOVING (1) **changed** |
| timing-06 | career | Will I get the job I interviewed for? | UNFORMED (-4) | MOVING (1) **changed** |
| timing-09 | career | Will I get the job I interviewed for? | UNFORMED (-4) | MOVING (1) **changed** |
| timing-10 | career | Will I get the job I interviewed for? | BLOCKED (-10) | DELAYED (-5) **changed** |
| timing-14 | career | Will I get the job I interviewed for? | BLOCKED (-10) | DELAYED (-5) **changed** |
| timing-15 | career | Will I get the job I interviewed for? | DELAYED (0) | DELAYED (3) |
| timing-19 | career | Will I get the job I interviewed for? | DELAYED (0) | DELAYED (3) |
| timing-20 | career | Will I get the job I interviewed for? | BLOCKED (-9) | DELAYED (-3) **changed** |
| timing-24 | career | Will I get the job I interviewed for? | BLOCKED (-9) | DELAYED (-3) **changed** |
| timing-25 | career | Will I get the job I interviewed for? | BLOCKED (-5) | DELAYED (1) **changed** |
| timing-29 | career | Will I get the job I interviewed for? | BLOCKED (-5) | DELAYED (1) **changed** |
| timing-30 | career | Will I get the job I interviewed for? | BLOCKED (-5) | REVERSING (-1) **changed** |
| timing-44 | career | Will I get the job I interviewed for? | DELAYED (2) | FULFILLED (5) **changed** |
| timing-45 | career | Will I get the job I interviewed for? | BLOCKED (-7) | DELAYED (-3) **changed** |
| timing-59 | career | Will I get the job I interviewed for? | DELAYED (-4) | DELAYED (0) |
| travel-001 | travel | Will my visa be approved for the trip? | BLOCKED (-6) | DELAYED (-1) **changed** |
| travel-002 | travel | Should I travel abroad this month? | REVERSING (4) | FULFILLED (7) **changed** |
| travel-003 | travel | Will my flight be delayed? | BLOCKED (-6) | REVERSING (-2) **changed** |
| travel-004 | travel | Is it a good time to relocate to another country? | DELAYED (2) | FULFILLED (4) **changed** |
| travel-005 | travel | Will my pilgrimage journey go smoothly? | DELAYED (0) | DELAYED (2) |
