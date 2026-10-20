# OD-002 phase 1 — review of the experimental implementation

**Status: experimental. Not a verified RKP release. Not for merge or deployment.** This review answers
the audit asks that came with the proposal to pause: provenance of the comparison, the changed cases
grouped by the rule that caused them, the unresolved rules, client/server compatibility, and the missing
source of the legacy tests. It changes no engine behaviour.

## 1. What the comparison shows

- 111 golden cases: **76 changed state, 35 did not. All 76 moved in the positive direction; none moved
  in the negative direction.** (Positive = toward Fulfilled; order Blocked < Reversing < Unformed <
  Delayed < Moving < Fulfilled.)
- Transitions: BLOCKED → DELAYED: 36; DELAYED → FULFILLED: 11; UNFORMED → MOVING: 10; BLOCKED → UNFORMED: 9; BLOCKED → REVERSING: 4; REVERSING → FULFILLED: 4; MOVING → FULFILLED: 1; UNFORMED → FULFILLED: 1.
- No case moved from Blocked to Fulfilled or Moving. 49 moved from Blocked to something milder (36 Delayed,
  9 Unformed, 4 Reversing). 17 moved up into Fulfilled (listed in §4).
- Distribution over 1,952 sampled 2026 moments per question type (before → after, Fulfilled+Moving / Blocked):
  career 0%→11% / 50%→5%; marriage 2%→30% / 59%→10%; health 6%→26% / 54%→0%; children 19%→64% / 22%→0%;
  travel 19%→63% / 23%→0%. Every question type shifted the same way.

This is a strong reason to investigate, not proof the new engine is wrong: the old engine was not shown to
be right either. The goal is to implement the owner's confirmed rules, not to hit a target share of Yes.

## 2. Provenance of the before/after capture

| Item | Value |
|---|---|
| Branch | `claude/chat-qa-36u5ig` |
| Before | commit `72a5021` (parent of the first rule commit `3be9f30`); engine files identical to `origin/main` for `src/astrology` and `functions/src/engine` |
| Engine version | `2.0.0-moshier` (unchanged) |
| Inputs | the 111 golden-case inputs (question, UTC instant, UTC offset), identical in both captures |
| Before capture reproduced | a worktree at `72a5021` was regenerated with `generate-golden-corpus.ts` and compared file-by-file with the capture used in the comparison: **identical** |
| Committed corpus `docs/audit/golden-corpus/` | **left untouched.** It no longer matches the engine even before these changes (remedy step ids differ; it predates later remedy-selection work), so it is preserved as history, not used as the baseline |
| After | commit `ddac7db` (rules `3be9f30`, fixtures `652e28b`, client minute `ddac7db`) |

Attribution method (harness in `attribution-harness/`): the seven rule changes were each reverted from the
new engine (remove-one) and each applied alone to the old engine (add-one), and all 111 cases replayed
through every variant. Two checks passed before anything was trusted: the "old" variant matches the
captured baseline in all 111 cases, and the variant with all seven rules reverted reproduces the old
engine's state, score and timing in all 111 cases. (An earlier draft of this analysis had a patch hitting the
wrong table; it was caught by the second check and redone.) Per-case records: `OD-002_phase1_attribution.json`.

## 3. The 76 changed cases, grouped by the rule responsible

Each rule applied **alone** to the old engine:

| Rule | Cases it moves up | Cases it moves down |
|---|---|---|
| Ras/Dhanab cast no aspects (S5) | 29 | 0 |
| Travel denial Ghars 4, 8 (S6) | 0 | 1 |
| Matter ruler friendly +1 / enemy −1 (2.7) | 7 | 0 |
| Exalted/own benefic +3; malefic aspect −1 (2.3) | 33 | 0 |
| Own/exalted malefic in 3/6/10/11 +2 (S4 A) | 0 | 0 |
| Timing sign modality (4.1) | 0 | 0 |
| New answer ladder (S3) | 19 | 0 |

Applying the rules one at a time moves no case down except the travel denial (1 case). The upachaya
rule and the timing modality never change a state in these 111 cases (modality changes timing only; see §5).

| Cause | Cases | Ids |
|---|---|---|
| only a combination of rules | 30 | ambiguous-001, business-001, business-003, disputes-002, employment-002, employment-003, employment-004, family-003, finance-001, finance-003, marriage-004, marriage-008, pad-business-07, pad-employment-10, pad-employment-11, pad-family-21, pad-general-28, pad-lostitem-26, pad-property-15, pad-spiritual-25, property-005, spiritual-001, timing-05, timing-06, timing-09, timing-10, timing-14, timing-44, timing-45, travel-004 |
| Exalted/own benefic +3; malefic aspect −1 (2.3) (any one of these alone gives the new state) | 9 | ambiguous-002, business-002, family-004, marriage-005, marriage-007, pad-education-20, pad-relationship-02, property-004, spiritual-002 |
| Ras/Dhanab cast no aspects (S5) (any one of these alone gives the new state) | 9 | business-006, family-001, general-001, health-001, marriage-001, marriage-006, pad-business-05, pad-general-27, pad-relationship-01 |
| Ras/Dhanab cast no aspects (S5) + Exalted/own benefic +3; malefic aspect −1 (2.3) (any one of these alone gives the new state) | 8 | disputes-004, education-002, multiintent-003, pad-disputes-24, pad-travel-18, property-003, travel-001, travel-003 |
| Ras/Dhanab cast no aspects (S5) + Matter ruler friendly +1 / enemy −1 (2.7) + Exalted/own benefic +3; malefic aspect −1 (2.3) + New answer ladder (S3) (any one of these alone gives the new state) | 6 | employment-006, multiintent-001, pad-finance-14, timing-00, timing-01, timing-04 |
| Ras/Dhanab cast no aspects (S5) + Exalted/own benefic +3; malefic aspect −1 (2.3) + New answer ladder (S3) (any one of these alone gives the new state) | 5 | employment-001, pad-employment-09, timing-25, timing-29, timing-30 |
| New answer ladder (S3) (any one of these alone gives the new state) | 4 | pad-travel-17, timing-20, timing-24, travel-002 |
| Exalted/own benefic +3; malefic aspect −1 (2.3) + New answer ladder (S3) (any one of these alone gives the new state) | 3 | business-007, marriage-002, pad-business-06 |
| Matter ruler friendly +1 / enemy −1 (2.7) + Exalted/own benefic +3; malefic aspect −1 (2.3) + New answer ladder (S3) (any one of these alone gives the new state) | 1 | education-005 |
| partly Ras/Dhanab cast no aspects (S5) / Exalted/own benefic +3; malefic aspect −1 (2.3); the rest needs a combination | 1 | property-001 |

"Only a combination" (30 cases) means no single rule moves the case by itself; the change comes from two or
more rules together. Which combination was not broken down further (a pairwise replay would do it). Those
are the cases most worth reading by hand.

## 4. Priority lists

### Moved up into Fulfilled (17)

| Case | Type | Question | Before → after |
|---|---|---|---|
| ambiguous-001 | career | Will it work out? | DELAYED (2) → FULFILLED (5) |
| business-002 | marriage | Should I take on a business partner? | DELAYED (3) → FULFILLED (6) |
| disputes-002 | business | Is my business rival trying to sabotage me? | DELAYED (2) → FULFILLED (5) |
| education-005 | children | Should my child change schools? | MOVING (4) → FULFILLED (8) |
| employment-002 | career | Should I resign from my current job? | REVERSING (1) → FULFILLED (4) |
| employment-003 | career | Will I get promoted this year? | DELAYED (2) → FULFILLED (5) |
| marriage-004 | general | Will my engagement survive? | REVERSING (2) → FULFILLED (5) |
| marriage-007 | marriage | Should I reconcile with my ex-partner? | DELAYED (3) → FULFILLED (6) |
| pad-employment-10 | career | Will I clear my job probation period? | REVERSING (1) → FULFILLED (4) |
| pad-lostitem-26 | lostitem | Will my missing phone be found? | DELAYED (-1) → FULFILLED (4) |
| pad-property-15 | property | Will construction on my new house finish on time? | DELAYED (1) → FULFILLED (4) |
| pad-relationship-02 | marriage | Should I trust my partner right now? | DELAYED (3) → FULFILLED (6) |
| property-001 | property | Will I be able to buy this house? | UNFORMED (0) → FULFILLED (4) |
| property-005 | property | Should I take a mortgage for this property? | DELAYED (-1) → FULFILLED (4) |
| timing-44 | career | Will I get the job I interviewed for? | DELAYED (2) → FULFILLED (5) |
| travel-002 | travel | Should I travel abroad this month? | REVERSING (4) → FULFILLED (7) |
| travel-004 | travel | Is it a good time to relocate to another country? | DELAYED (2) → FULFILLED (4) |

### Blocked → Delayed / Unformed / Reversing (49)

Listed in `golden_replay_OD-002_phase1.md` and the attribution file. None became Fulfilled or Moving.

## 5. Timing

Timing changed in the same-state cases below; the cause is the sign modality (×0.8 movable, ×1.25 fixed)
and, where state moved, the new ruler/weak classification. Old → new window in days:

| Case | Question | Old | New |
|---|---|---|---|
| ambiguous-003 | What should I do? | 11–21 | 8–17 |
| business-005 | Will my startup get funded? | 42–63 | 34–50 |
| disputes-001 | Will I win my court case? | 11–21 | 8–17 |
| disputes-005 | Does my colleague mean me harm? | 11–21 | 8–17 |
| employment-005 | Should I switch careers entirely? | 11–21 | 8–17 |
| finance-002 | Should I invest my savings in this fund? | 11–21 | 8–17 |
| finance-005 | Is it safe to buy gold now? | 11–21 | 8–17 |
| finance-006 | Will my inheritance dispute be resolved in my favour? | 42–63 | 34–50 |
| lostitem-001 | Will I recover my lost ring? | 11–21 | 8–17 |
| marriage-003 | Should I marry the person my family has chosen? | 11–21 | 8–17 |
| multiintent-002 | Should I take the loan to start my business and move house at the same time? | 42–63 | 34–50 |
| pad-business-08 | Will I be able to hire the right staff for my business? | 14–30 | 11–24 |
| pad-family-22 | Will my brother and I reconcile? | 11–21 | 8–17 |
| pad-finance-13 | Will the stock I bought recover? | 42–63 | 34–50 |
| timing-59 | Will I get the job I interviewed for? | 11–21 | 8–17 |

15 cases. **Correction:** the audit note that Case 5 timing "changes from 90–150 to 15–32 days" is wrong. The old
engine already gave Case 5 (health, Aug 2026) 15–32 days, and phase 1 leaves it unchanged. 90–150 days was the
owner's own judgment (Zuhal's base window), so that gap is between the owner and both engine versions.

## 6. The five open rules (audit dispositions, not owner rulings)

| # | Question | Disposition |
|---|---|---|
| 1 | Ordinary/enemy-sign malefic in 3/6/10/11; debilitated −1 | UNKNOWN, not implemented; two separate rules to confirm and test separately |
| 2 | Utarid, Shams, Qamar near malefics | UNKNOWN, not implemented; occupancy, conjunction and aspect recorded separately |
| 3 | Zuhal on the 10th: replace or add; business too | UNKNOWN, not implemented; business confirmed separately |
| 4 | Self-protection +2 | UNKNOWN, not implemented; "opposite Ghar, aspects back" kept apart from "ruler in its own Ghar" |
| 5 | Case 4 (business) | UNRESOLVED; no exception added; owner to give the full judgment (Ghars, planets, reason) |

## 7. Client/server payload compatibility (tested against the real schemas)

| Server | Client | Result |
|---|---|---|
| old (`72a5021`) | old | accepted |
| old (`72a5021`) | **new** (sends `clientSentAtMs`) | **rejected: "Unrecognized key(s) in object: 'clientSentAtMs'"** |
| new | old (no field) | accepted |
| new | new | accepted |
| new | new, malformed field | rejected: "Expected number, received string" |

The server's tolerance behaviour (use the phone's time within 2 minutes, else the server's; `computedAt`
stays the server's) is covered by unit tests in `functions/src/utils/__tests__/localTime.test.ts`.

**The hazard is real:** the new app against the old server fails every question with an invalid-argument
error. Required order: deploy the functions first, confirm the deployed function accepts a payload with the
field, then release the app. Not tested here (no deployed environment): behaviour during a staged app rollout
while some servers are still old. If a safer path is wanted, options are a one-release server-first rollout
gate, or a client that retries once without the field on that specific error. Neither is implemented.

## 8. The legacy "audit finding" tests

15 tests (8 + 2 + 5) in `src/astrology/rkp/__tests__/watchJudgment.test.ts`, three blocks labelled "audit
finding #1 / #2 / #3". The file first appears in commit `cf513e9` (an unrelated e2e commit); no document in the
repository matches those findings. Source UNRECOVERED. (An earlier statement said 14; it is 15.)

## 9. What this review does not establish

- That the new behaviour follows the owner's intended rules: the reply it implements was not authenticated.
- That the owner's own Case 4 judgment can be reproduced from his written rules (the engine gives
  Unformed, −1).
- That the distribution is right. It shows the direction and size of the change only.

## 10. Recommendation

Keep the branch unmerged and undeployed. Make no further judgment-changing commit until the owner (a)
confirms the implemented rules in an attributable way, (b) answers the five open rules, and (c) supplies his
full judgment of Case 4. Then change one rule at a time, replaying this harness after each.
