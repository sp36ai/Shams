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
|  L1 | Local clock minute → twelve 5-minute brackets → 1st Ghar sign (00–04 Hamal … 55–59 Hoot); rest in zodiac order. The minute is the server's receive time shifted by the phone's UTC offset; seconds ignored | `watchGrid.ts`, `localTime.ts`, `askWatchOracle.ts` | VERIFIED-OWNER | OD-002 (1.1). Mapping and 11:13 → Jauza confirmed. The minute is now the phone's tap-Send minute when within 2 minutes of server time (commit ddac7db); the worked example is a test |
|  L2 | Planets are real sidereal positions placed into the watch frame by sign | `watchChart.ts` | VERIFIED-OWNER | OD-002 (1.2) |
|  L3 | Lahiri ayanamsa | `primitives/ayanamsa.ts` | VERIFIED-OWNER | OD-002 (1.2); also owner doc §3 |
|  L4 | Rahu/Ketu use mean node, always retrograde | `primitives` | VERIFIED-OWNER | OD-002 (1.2): mean node, always retrograde |
|  L5 | House matrix: primary / favourable / denial per question type (career, marriage, finance, health, property, travel, legal, education, business, children, lostitem) | `kp/rules/houseMatrix.ts` | VERIFIED-OWNER | OD-002 (3.1). One row changed by the owner: travel denial Ghars are now 4 and 8 (supersedes "—" in RKP_RULES_FROM_SARFARAZ.md). Implemented |
| L6 | Extension types `enemies`, `spiritual`, `general` | same | HYPOTHESIS | Doc marks them "app-retained", not part of the owner's table |
|  L7 | 11th Ghar is the fulfilment Ghar for every question | `watchJudgment.ts` | VERIFIED-OWNER | OD-002 (2.10) |
| L8 | Benefics = Mushtari, Zuhrah only; malefics = Zuhal, Mirrikh, Ras, Dhanab; Shams, Qamar, Utarid neutral | `rules.ts` | HYPOTHESIS | Code comments give no owner source |
|  L9 | Aspects: all planets 7th; Mirrikh 4,7,8; Mushtari 5,7,9; Zuhal 3,7,10; Ras/Dhanab 5,7,9 | `rules.ts` | PARTLY VERIFIED-OWNER | OD-002 (S5): Ras and Dhanab cast no aspects — implemented. The other planets' aspect table is still HYPOTHESIS |
|  L10 | Exaltation/debilitation signs, own signs; Rahu exalted Saur, Ketu Aqrab | `rules.ts` | VERIFIED-OWNER | OD-002 (2.11), including the node exaltations |
|  L11 | Friendship table, one-way (A→B may differ from B→A) | `rules.ts` | VERIFIED-OWNER | OD-002 (2.8): fixed, one-way |
|  L12 | Strong = exalted or own sign; weak = enemy sign or debilitated; friendly/neutral give 0 | `rules.ts` | VERIFIED-OWNER | OD-002 (2.7): friendly +1, neutral 0, enemy −1, debilitated −2, exalted/own +2 — implemented. "Weak" for the DELAYED rule still means enemy or debilitated |
| L13 | Same planet rules querent and matter → relation step adds nothing | `watchJudgment.ts` S2 | VERIFIED-OWNER | Owner decision 2026-10-08, recorded in doc §2 |
|  L14 | Matter ruler strong +2 / weak −2 | S1 | VERIFIED-OWNER | OD-002 (2.7). Implemented |
| L15 | Querent ruler friend of matter ruler +2 / enemy −2 | S2 | HYPOTHESIS | Weight not in owner material (the 2026-10-08 decision only removes the self case) |
|  L16 | Each benefic on/aspecting target Ghar +2; each malefic −2 | S3 | PARTLY VERIFIED-OWNER | OD-002 (2.3, S4). Implemented: Mushtari/Zuhrah exalted or own +3; malefic sitting −2, aspecting −1; own/exalted malefic sitting in 3/6/10/11 +2. NOT implemented (ambiguous): S4 cases B and C, Utarid/Qamar/Shams |
|  L17 | Same weights for planets on/aspecting the 11th Ghar | S4 | PARTLY VERIFIED-OWNER | As L16, for the 11th Ghar |
| L18 | Matter ruler lands in favourable Ghar +1 / denial −1 | S5 | HYPOTHESIS | Uses the verified matrix (L5) but the ±1 weight is unconfirmed |
|  L19 | Matter ruler retrograde → REVERSING; combust −1 | S6, ladder | VERIFIED-OWNER | OD-002 (2.9). Combustion degrees equal the code's constants. Retrograde now ranks below a +4 score (S3) |
| L20 | Obstruction order: Zuhal, Mirrikh, Ras, Dhanab; occupant before aspect; Qamar in 8/12 = "mind not settled" | `firstObstruction` | HYPOTHESIS | No source |
|  L21 | State ladder: ≤−5 BLOCKED; retrograde REVERSING; ≥5 FULFILLED; Zuhal obstruction or weak ruler DELAYED; ≥2 MOVING; else UNFORMED | `resolveState` | VERIFIED-OWNER | OD-002 (S3), implemented in the owner's order and thresholds (+4 / −6 / +1) |
|  L22 | Confidence bands by score magnitude; downgrade when benefic and malefic both present | `bandConfidence` | VERIFIED-OWNER | OD-002 (2.12), unchanged |
|  L23 | Timing base days per planet, ×1.5 retrograde, ×1.5 weak, ×0.7 exalted | `BASE_TIMING`, `computeTiming` | VERIFIED-OWNER | OD-002 (4.1): base days and ×1.5/×1.5/×0.7 confirmed; modality ×0.8 / ×1.0 / ×1.25 added and implemented |

## Authority is not implementation

Each ledger row says how well a rule is **established as RKP**. It does not say
the code applies the rule correctly. Those are separate questions:

| Question | Current conclusion |
|---|---|
| Does the owner's document specify numerical scoring? | Yes, for the older Moon-sub-lord flow (+2/−2, ±1, ≥3 / ≤−2) |
| Are the watch engine's own weights and thresholds owner-confirmed? | No (L14–L19, L21) |
| Does the code apply those weights as written? | Tested against the *current* behaviour: `src/astrology/rkp/__tests__` (96 tests, passing on this branch) pin the weights, the ladder, obstruction order and timing multipliers |
| Does the verdict follow the owner's intended rules? | Unverified until the owner's rules are recorded here and compared with the code |

Two consequences:

- Those 96 tests freeze today's behaviour, including the HYPOTHESIS rows. They
  show the code does what it says, not that what it says is RKP. A confirmed
  correction will legitimately require changing the matching tests, and that
  change belongs in the same commit as the rule, with the owner's confirmation
  cited here.
- Some tests are labelled "audit finding #1 / #2 / #3" (state-resolution order,
  reversal independent of state, "bespoke" timing model). I could not locate the
  document those findings came from. L21 and L23 should be read with that in
  mind: a previous review already flagged both as engineering choices.

## What each kind of evidence does and does not show

| Evidence | Shows | Does not show |
|---|---|---|
| Owner's confirmation (recorded below) | The intended rule | That the code implements it |
| `src/astrology/rkp/__tests__` (96 tests) | The code does today what the tests say | That the rule is RKP, or that the tests' expectations are right |
| Extractor's aspect cross-check against L9 | The engine's occupancy and aspect output agrees with the documented table | That the L9 table is authoritative RKP |
| Extractor determinism (two runs identical) | The output is reproducible | That it is correct |
| Golden-corpus replay | A change did not alter other verdicts unexpectedly | That the new or old verdicts are right |
| An outside AI's opinion | A hypothesis worth asking the owner | Anything about RKP, unless it names a verifiable RKP source |

The "audit finding #1, #2, #3" references in the tests stay UNRESOLVED until the
original document is found or the rules they describe (state-resolution order,
reversal independent of state, the timing model) are confirmed by the owner.

## Owner decisions log

### OD-001 — reply received 2026-10-20, source NOT VERIFIED

Received in the working chat as a single filled-in copy of
`RKP_RULE_CONFIRMATION_SHEET.md`, introduced by a message saying "Hi am
Sarfaraz". **Status of the whole reply: RECEIVED, PROVENANCE UNVERIFIED.** No row
below changes status and no code changes until the owner confirms in a channel
we can attribute to him (see "Why this is not yet VERIFIED-OWNER").

Why this is not yet VERIFIED-OWNER:

- The text is formatted like machine output (LaTeX arrows, "ready for your
  RKP_RULE_LEDGER.md", a "Quick Summary of Code Changes Confirmed for
  watchJudgment.ts") and uses details of this project's code. It may have been
  drafted by an AI from the sheet and pasted in.
- Part 5 was meant to be blind. The reply quotes the engine's scores ("the
  current app got -6", "-7") and engine factor lists that `case_records_blind.md`
  withholds. Those numbers had been shown in this chat before the blind file was
  made. So the Part 5 judgments are not independent evidence of how he judges.
- The combustion degrees in 2.9 equal the code's `COMBUSTION_THRESHOLD_DEG`
  exactly (Moon 12, Mars 17, Mercury 14/12, Jupiter 11, Venus 10/8, Saturn 15).
  That agrees with the code but is not independent evidence of his teaching.

What the reply says, item by item (wording abridged; the full text is in the
chat of this session, not stored here), and how it bears on the ledger:

| Sheet item | Reply says | Ledger row | Effect if confirmed |
|---|---|---|---|
| 1.1 a, b, d, e, f | Mapping as implemented, nothing else changes it, 11:13 → Jauza, own rule | L1 | UNKNOWN → VERIFIED-OWNER; worked example becomes a test |
| 1.1 c | "use that minute [the client's tap-Send minute]; fall back to server-receive time only if missing" | L1 | Design change with a security trade-off — see issue S1 |
| 1.2 | Confirmed (Lahiri, whole-sign, mean node) | L2, L4 | → VERIFIED-OWNER |
| 2.1 | "Correct it": keep points; new ladder (≤−6 and no strong benefic → BLOCKED; retrograde; ≥+4 FULFILLED; DELAYED rule; ≥+1 MOVING; else UNFORMED) | L21 | Changes thresholds. Has gaps — issues S2, S3 |
| 2.2 | Utarid benefic +2 unless with a malefic; Qamar +1 waxing / −1 waning (72°–288°); Shams contextual (+1 career/health, −1 in 7th for marriage) | L8 | Changes L8. Qamar and Shams are new weights |
| 2.3 | Exalted/own benefic = +3; malefic sitting −2, malefic aspecting −1 | L16, L17 | Changes the ± weights |
| 2.4 | Upachaya: own/exalted malefic in 3/6/10/11 = +2; ordinary malefic there = 0 for career/legal/business/finance; debilitated = −1 | L16, L17 | New rule. Issue S4 |
| 2.5 | Zuhal and work: exalted/own on or aspecting the 10th = +2; neutral/friendly = −1 and DELAYED, never BLOCKED; debilitated/combust = −2, obstruction | L20, L21 | Changes obstruction. Conflicts with 2.1 — issue S2 |
| 2.6 | Nodes do not cast 5th/9th aspects; act only where they sit, "plus their natural 7th axis opposition" | L9 | Removes node aspects. Ambiguous on the 7th — issue S5 |
| 2.7 | Exalted/own +2, friendly +1, neutral 0, enemy −1 (was −2), debilitated −2 | L12, L14 | Changes L12, L14 |
| 2.8 | Friendship table confirmed, fixed, one-way | L11 | → VERIFIED-OWNER |
| 2.9 | Retrograde → REVERSING unless "a clear Fulfilled +5 or Blocked −6"; combust −1 with the degrees above | L19 | Conflicts with 2.1 ladder order — issue S3 |
| 2.10 | 11th Ghar confirmed | L7 | → VERIFIED-OWNER |
| 2.11 | All exaltation/own/node signs confirmed | L10 | → VERIFIED-OWNER |
| 2.12 | Confidence confirmed as implemented | L22 | → VERIFIED-OWNER |
| 3.1 | All rows confirmed except travel denial Ghars become 4 and 8 | L5 | Contradicts the owner's document (travel denial "—"). Issue S6 |
| 4.1 | Base days and ×1.5/×1.5/×0.7 confirmed; adds modality ×0.8 cardinal, ×1.0 dual, ×1.25 fixed | L23 | Confirms base; adds a new multiplier |
| Summary | "House 7/11 self-protection: if the ruler of the Target Ghar or 11th Ghar sits in or aspects its own house, add +2" | new | Appears only in the summary, nowhere in the answers to 2.1–2.12 — issue S7 |

Open issues to put back to the owner before any code change:

- **S1 Client time.** The server deliberately uses its own receive time and only
  trusts the phone's UTC offset, so a user cannot pick the minute and re-roll a
  reading. Using the phone's tap-Send minute reopens that. A bounded option
  (accept the client minute only if within about a minute or two of the server's
  time, else use the server's) is a design choice for the owner and engineering.
- **S2 Zuhal and career.** 2.1 says Zuhal's DELAYED rule applies when
  "question != career"; 2.5 says neutral/friendly Zuhal on the 10th sets DELAYED
  for career. Which?
- **S3 Ladder order.** 2.1 puts retrograde before FULFILLED; 2.9 says a clear
  Fulfilled overrides retrograde. The numbers also differ (+4/−6 vs +5/−6/−5).
  What happens to a score ≤ −6 when a strong benefic is present? 2.1 leaves that
  case without an outcome.
- **S4 Upachaya scope.** "Business (7th/11th)" is not clear: is the exception
  about the matter's Ghar, any Ghar counted from the 1st, or the 11th only? Does
  it apply to the malefic's own aspects, and to every question type or only the
  four named?
- **S5 Nodes and the 7th.** If nodes do not aspect, "their natural 7th axis
  opposition" still looks like a 7th-house aspect. Does either node affect the
  Ghar opposite it?
- **S6 Travel.** The owner's own rules document says travel has no denial Ghar.
  The reply changes it to 4 and 8. This is a change of an owner-verified row and
  needs an explicit, attributed "I change my table".
- **S7 Self-protection.** Not in any answer. Confirm, with exact conditions.

### OD-002 — reply received 2026-10-20, written in this session

Channel: written message in the working chat, from the project owner's session.
It begins "Yes, I am Sarfaraz, and I confirm these rules" and answers S1–S7 and
the two blind charts. The message opens with a line addressed to someone who will
"send back to Claude", so it was drafted with an AI's help. We record it as the
owner's written confirmation, since he states in the first person that he is
Sarfaraz and confirms; we cannot verify identity beyond that. It also settles
OD-001, whose items he says he confirms. Verbatim answers (the text before
"My blind judgment"):

> **S1.** "Use the phone's tap-Send minute. If the phone's clock differs from the server time by more than 2 minutes, fall back to the server's receive minute so bad device clocks don't break the chart."
>
> **S2.** "For a job/career question, a neutral or friendly Zuhal on or aspecting the 10th adds −1 AND forces the state to Delayed (unless the final score reaches +4 or higher for Fulfilled). It should never force Blocked on its own."
>
> **S3.** "Check in this exact order: Score >= +4 -> Fulfilled (Yes) (overrides retrograde). Score <= -6 AND no exalted/own-sign benefic sits in or aspects the target Ghar -> Blocked (No). (If a strong benefic is present at <= -6, cap it at Delayed instead of Blocked). Target ruler is retrograde -> Reversing. Zuhal sits in/aspects target Ghar (and is not own/exalted) OR target ruler is weak -> Delayed. Score >= +1 -> Moving (Yes). Otherwise (-5 to 0) -> Unformed."
>
> **S4.** "Always counted as Ghars 3, 6, 10, and 11 from the 1st Ghar. If a malefic sits in 3, 6, 10, or 11 in its own or exalted sign, it scores +2 for ALL question types. If an ordinary (neutral/friendly) malefic sits in 3, 6, 10, or 11, it scores 0 (no penalty) only for career, legal, business, and finance questions (when checking both the target Ghar and the 11th Ghar). For other questions (like marriage or health), keep the normal malefic penalty."
>
> **S5.** "They act only in the Ghar they sit in. Do not give them 5th, 7th, or 9th aspects."
>
> **S6.** "Update the table to use 4 and 8 as the denying Ghars for travel. Leaving it empty was an omission in the old doc."
>
> **S7.** "If the ruler of the target Ghar sits in the target Ghar or casts a 7th aspect on the target Ghar, add +2 (note: if it sits in its own Ghar, it is already in its own sign so it gets the +2 strong-ruler score—do not double-count; the extra +2 is specifically when the ruler sits in the opposite Ghar and aspects its own Ghar back). Apply the same rule to the 11th Ghar ruler aspecting the 11th Ghar."

His blind judgments: case-3 YES (fulfilled after slight delay, 2–3 months); case-4
YES (moving, 15–30 days). Their text still said the "current app" gave −6/−7, so
they are recorded as the owner's view, not as an independent blind test.

How each answer is applied, and what is held back as ambiguous. The rule used for
the implementation is written next to each; anything not listed here is NOT
implemented and stays as it was.

| Rule | Implemented? | How it is read / what is still open |
|---|---|---|
| S1 client minute | Yes | Client sends its tap-Send instant; server uses it if within 2 minutes of server time, else its own. Optional field, so old app versions keep working |
| S3 ladder | Yes | Exactly the six steps above. "Strong benefic" = Mushtari or Zuhrah, exalted or own sign, sitting in or aspecting the target Ghar. "Weak ruler" = existing definition (enemy sign or debilitated). Zuhal check is explicit (sits in or aspects the target Ghar, not own/exalted) |
| S5 nodes | Yes | Ras and Dhanab have no aspects at all |
| S6 travel | Yes | Denial Ghars 4 and 8; supersedes the "—" in `RKP_RULES_FROM_SARFARAZ.md` |
| 2.7 sign strength | Yes | Matter ruler: exalted/own +2, friendly +1, neutral 0, enemy −1, debilitated −2 |
| 2.3 scaling | Yes | Mushtari or Zuhrah exalted/own sitting or aspecting target/11th: +3. Malefic sitting −2, malefic aspecting −1 |
| S4 upachaya, Case A | Yes | Own/exalted malefic sitting in Ghar 3/6/10/11 counted on the target or 11th Ghar: +2, all question types |
| 4.1 modality | Yes | Cardinal ×0.8, dual ×1.0, fixed ×1.25 on the matter ruler's sign, after the existing multipliers |
| S4 upachaya, Cases B and C | **No** | Open: S4 says "neutral/friendly" malefic = 0 for four question types; the sheet (2.4 Case B/C) says everything except own/exalted/debilitated = 0, and debilitated = −1 for all types. What about an enemy-sign malefic, and is the debilitated −1 for all types? |
| 2.2 Utarid, Qamar, Shams | **No** | Open: Utarid conjunct a malefic is "0 or −1"; is the Shams +1 for sitting only, or also aspecting? Qamar ±1 needs the same sitting/aspect rule |
| S2 / 2.5 Zuhal on the 10th, scoring | **No** | Open: does the Zuhal −1 / +2 / −2 table replace or add to the generic malefic score (−2 sitting, −1 aspecting)? Does it also apply to business, where the 10th is a helping Ghar and not the matter's Ghar? |
| S7 self-protection | **No** | Open: the answer is internally inconsistent. Read as "the extra +2 is only when the ruler sits in the opposite (7th-from) Ghar and aspects back". Does the 11th ruler sitting in the 11th itself get +2, given the 11th ruler has no strong-ruler credit today? |

### OD-003 — message received 2026-10-20, source NOT VERIFIED, no new decisions

A restatement of OD-002's Parts 3–5 in the same AI-assisted format, ending with a
"Summary of Engine Divergences". Nothing in it settles an open rule. What it adds
or changes, recorded for the owner to confirm:

- **Case 4 timing** is now "20 to 38 days" (was "20 to 40"). The engine gives no
  timing for Case 4 because its state is Unformed.
- **Case 3 timing** says Mushtari, "Dual sign × 1.0", 60–90 days. Mushtari is in
  Jauza, an enemy sign for Mushtari, so the owner's own multiplier (×1.5 for a
  weak ruler) gives 90–135 days, which is what the engine returns. His judgment and
  his written rule disagree.
- **S7 is restated more broadly:** "A ruler casting an aspect onto its own house
  grants +2 protection." OD-002's S7 said a 7th aspect only. These differ, and the
  difference decides Case 4: the 11th's ruler Mushtari sits in the 7th and casts its
  5th aspect onto the 11th. Counted, Case 4 moves from −1 (Unformed) to +1 (Moving),
  the owner's own verdict. Not counted, it stays Unformed. Recorded as a question
  for the owner, not applied.
- The summary lists S4 case B ("no blanket −2 for career, business, legal,
  financial") as a divergence. It is still not implemented (see dispositions).

Read-only simulation of the open readings (S7 strict vs broad, S4 B1/B2), with the
Case 3 longitude check and the node-aspect counts: `OD-002_OPEN_RULE_SIMULATION.md`.
Nothing there is implemented.

### Self-protection (S7): two interpretations, recorded separately, neither selected

Neither is implemented; the branch applies no self-protection. Status of both: UNKNOWN until the owner
chooses. Neither is the default, and neither is chosen because of what it does to Case 4.

| | S7-A strict | S7-B broad |
|---|---|---|
| Text it rests on | OD-002 S7: the ruler "casts a 7th aspect on the target Ghar"; the extra +2 only when it sits in the opposite Ghar and aspects back; same for the 11th ruler | OD-003 summary: "A ruler casting an aspect onto its own house grants +2 protection" |
| Aspects that count | the 7th aspect only | any aspect, including special aspects (Mushtari 5th/9th, Mirrikh 4th/8th, Zuhal 3rd/10th) |
| Applies to | ruler of the target Ghar; ruler of the 11th | same |
| Simulated effect (read-only) | Case 4 stays Unformed (−1); Case 1 Fulfilled; Case 3 Fulfilled (+6); distribution up modestly | Case 4 Moving (+1); Case 1 Fulfilled; Case 3 Fulfilled (+6); distribution up further |

Conditions recorded for whichever is chosen:
- Special aspects (Mushtari's 5th, Mirrikh's and Zuhal's special aspects) are separate influences until the
  owner says whether each counts for self-protection.
- No implicit stacking: one credit per planet per Ghar. A ruler that sits in its own Ghar already scores the
  strong-ruler +2 (matter's ruler only) and does not also get this credit; a relationship already credited
  elsewhere (a benefic aspect on the Ghar, say) is not credited a second time under this rule unless the owner
  says it stacks.
- Whether the 11th ruler sitting in the 11th itself gets +2 is a third, separate question (the 11th ruler has
  no strong-ruler credit today).

### Other open decisions, recorded independently (none inferred from the five cases)

| Decision | What the owner must state |
|---|---|
| Utarid affliction | Which planets afflict it; whether aspect counts as well as conjunction; whether a benefic mitigates; "0 or −1" |
| Shams contextual weights | +1 career/health, −1 marriage: does the matter's Ghar or the Ghar Shams occupies control the override; sitting only or aspecting too |
| Qamar bright half | Forward elongation (Moon − Sun) mod 360; inclusive or exclusive at 72° and 288°; treatment of new and full Moon; the "waxing" label does not fit 180°–288° |
| S4 cases B and C | Ordinary and enemy-sign malefics in 3/6/10/11; debilitated −1 for all types or only four |
| Zuhal on the 10th | Replace or add to the malefic score; business separately |
| Case 4 | The owner's own reason for Yes, not reverse-engineered from the engine |

Entry format for each decision once confirmed:

```
Decision ID:    OD-001a
Date received:  <date>
Channel:        <how it was given: written message, voice note transcript, document>
Sheet item:     <e.g. 1.1 a–f>
Verbatim:       "<his exact words>"
Ledger rows:    <e.g. L1>
New status:     VERIFIED-OWNER | HYPOTHESIS | UNKNOWN | CONTRADICTED
Code change:    none | <exact change, files, tests>
Worked example: <input → expected result>, becomes test <name>
```

The earlier template, for reference — one entry per decision, in his words:

```
Decision ID:    OD-001
Date received:  <date>
Channel:        <how it was given: written message, voice note transcript, document>
Sheet item:     <e.g. 1.1 a–f>
Verbatim:       "<his exact words>"
Ledger rows:    <e.g. L1>
New status:     VERIFIED-OWNER | HYPOTHESIS | UNKNOWN | CONTRADICTED
Code change:    none | <exact change, files, tests>
Worked example: <input → expected result>, becomes test <name>
```

When a reply arrives: log it first and change the row's status; then name the
precise implementation change, if any; change the code and the matching tests in
one commit; run the engine unit tests, the extractor (with its cross-check) and
the golden-corpus replay; review every changed verdict before any merge.

## Cross-references

How the other audit documents point to ledger rows. A line in either document
that maps to no row, or a row no document asks about, is a gap.

| Verification prompt | Confirmation sheet | Ledger |
|---|---|---|
| A1 | 1.1 | L1 |
| A2, A3 | 1.2 | L2, L3, L4 |
| B1 | 3.1 | L5, L6 |
| B2 | 2.10 | L7 |
| B3 | 2.2 | L8 |
| B4 | 2.6 | L9 |
| B5 | 2.11 | L10 |
| B6, B6a | 2.8 | L11 |
| B7 step 1 / H4 | 2.7, 2.1 | L12, L14 |
| B7 step 2 | 2.1 | L13, L15 |
| B7 steps 3–4 / H1 | 2.3, 2.1 | L16, L17 |
| B7 step 5 | 2.1 | L18 |
| B7 step 6 | 2.9 | L19 |
| B8 | 2.1 | L21 |
| B9 / H3 / H5 | 2.5 | L20 |
| B10 | 4.1 | L23 |
| H2 | 2.4 | L16, L17 (a NEW rule the engine does not have) |
| — | 2.12 | L22 |

## Status after OD-002 (phase 1 implemented)

> **EXPERIMENTAL IMPLEMENTATION — not a verified RKP release.** The branch
> `claude/chat-qa-36u5ig` applies the owner's answers as written in OD-002. It is
> not for merge or deployment. Passing tests show the code does what it says,
> not that the rules are authentic. No further judgment-changing commit until the
> review in `OD-002_PHASE1_REVIEW.md` is answered.
>
> **Authentication of OD-002 is not established.** The reply was produced in an
> AI-assisted conversation and states in the first person that it is the owner's.
> It is recorded as written, not as an authenticated confirmation of each
> implementation detail. Before release, each implemented rule needs a
> confirmation attributable to the owner (for example a signed note or a recorded
> voice confirmation of the list of rules in the review).

Commits on `claude/chat-qa-36u5ig`: `3be9f30` (rules), `652e28b` (fixtures and
golden replay report), `ddac7db` (client minute). Engine unit tests (134),
functions tests (747) and client tests (435) pass. Not merged, not deployed.
Before/after: `golden_replay_OD-002_phase1.md` (76 of 111 golden cases changed
state).

Rows still unresolved or only partly applied, and why:

- L8 (Utarid, Qamar, Shams): owner decision recorded, NOT implemented — Utarid
  conjunct a malefic is "0 or −1"; Shams/Qamar need a sitting-or-aspecting rule.
- L16/L17: S4 cases B and C (enemy-sign and debilitated malefic in 3/6/10/11).
- L20 (obstruction): unchanged except that a malefic scored as helping is no
  longer named as the obstruction. That is a consequence of S4, not a stated
  owner rule. Zuhal-on-the-10th scoring (S2, 2.5) is not implemented.
- S7 self-protection: not implemented.

Check against the owner's own blind judgments (`case_records.md`, engine after phase 1):

| Case | Owner | Engine now | Match |
|---|---|---|---|
| 3 marriage | Yes, fulfilled | FULFILLED (+4) | yes |
| 4 business | Yes, moving | UNFORMED (−1) | **no** |
| 1 job | Moving / fulfilled | MOVING (+2) | yes |
| 2 job | Delayed / reversing | REVERSING (0) | yes |
| 5 health | Delayed | DELAYED (+1) | yes (timing differs: owner 90–150 days, engine 15–32) |

Case 4 is the open one: with every confirmed rule applied the 7th Ghar carries
Mirrikh and Dhanab sitting (−2 each), Zuhal counts the 7th's ruler an enemy
(−2), and nothing in the owner's answers adds enough to reach +1. Either a rule
that drives his judgment is not yet written down (for example the 7th's ruler
standing in the 10th), or the pending rules above move it. This needs the owner.

## Dispositions of the open questions (audit recommendation, not an owner ruling)

| # | Question | Disposition | Why |
|---|---|---|---|
| 1 | Ordinary or enemy-sign malefic in the 3rd/6th/10th/11th; debilitated −1 for all types | UNKNOWN, not implemented | Two separate rules — a Ghar exception and a dignity penalty — to be confirmed and tested separately |
| 2 | Utarid, Shams, Qamar near malefics | UNKNOWN, not implemented | Occupancy, conjunction and aspect must be recorded separately; weights per question not stated |
| 3 | Zuhal on the 10th: replace or add to the malefic score; business too | UNKNOWN, not implemented | Replace vs add changes scoring materially; business must be confirmed on its own, not inherited from career |
| 4 | Self-protection +2 | UNKNOWN, not implemented | The "opposite Ghar, aspects back" reading and the "ruler in its own Ghar" reading are different rules |
| 5 | Case 4 (business) | UNRESOLVED | No special exception. Needs the owner's full judgment of the original question: Ghars, ruling planets, and the reason it is affirmative |

## Unrecovered source of the legacy "audit finding" tests

`src/astrology/rkp/__tests__/watchJudgment.test.ts` has 15 tests (8 + 2 + 5) in
three blocks labelled "audit finding #1 / #2 / #3" (state-resolution order,
reversal independent of state, the "bespoke" timing model). The file first
appears in commit `cf513e9`, whose message is about an unrelated end-to-end wait;
no audit document matching those findings exists in the repository
(`RKP_KP_FORENSIC_AUDIT.md` covers the KP flow). The source is UNRECOVERED. An
earlier note here said "14"; the count is 15.

## Summary

- VERIFIED-OWNER: L3, L5, L13.
- Everything that decides a verdict (L7–L12, L14–L23) is HYPOTHESIS.
- UNKNOWN: L1, L4. L1 is the central mechanism and should be confirmed first.

Nothing in this ledger says the hypotheses are wrong. It says they are not yet
established, which matters because three of the four verdicts that look most
implausible (cases 2–4 in `case_records.md`) are decided entirely by rows
L14–L17 and L21.

## Frozen reference points (rollback and comparison)

| Point | Commit | What it is | Test results recorded |
|---|---|---|---|
| Pre-change baseline | `72a5021` | Engine as on `origin/main` before any OD-002 rule; fresh golden capture reproduced from it byte for byte | Two counts, two scopes, both re-measured at this commit: `npx jest src/astrology/rkp` → 5 suites, **96** tests; `npx jest src/astrology` (also the KP-rules and primitives tests) → 8 suites, **122** tests. Neither replaces the other. Full functions and app counts at this commit itself were not captured |
| Phase 1 | `ddac7db` | Rules `3be9f30`, fixtures `652e28b`, client minute `ddac7db`. Engine version `2.0.0-moshier` | `src/astrology`: 134 passing; functions: 747 passing (2 skipped); app: 435 passing; typecheck and lint clean |
| Audit artefacts since | later docs-only commits | No source change after `ddac7db`: `git diff ddac7db HEAD -- src functions/src` is empty | — |

Rollback, drilled on a disposable worktree branch (since deleted) on 2026-10-20: from the current head,
`git checkout 72a5021 -- src/astrology functions/src/engine functions/src/oracle/__tests__`.

| Step | Result |
|---|---|
| Engine files only (`src/astrology`, `functions/src/engine`) | `src/astrology` tests 122 pass, but **4 functions tests fail**: the validator fixtures were re-picked for the new engine, so they need the old moments back |
| Plus `functions/src/oracle/__tests__` | functions tests 747 pass (2 skipped) |
| App tests after the rollback | 422 pass and 1 fails: `useTextToSpeech › speak()`, an intermittent failure that also failed before these changes (checked earlier on the unmodified engine) |

The client-minute change (`ddac7db`: `clientSentAtMs` in the schema, callable, client wrapper and screen) is
independent of the rules and stays unless it is reverted separately. Compare any later experiment with the
phase-1 case records (`case_records.json`, `OD-002_phase1_attribution.json`) and the per-case golden replay
(`golden_replay_OD-002_phase1.md`).

Tags: annotated tags `rkp-baseline-pre-od002` (`72a5021`) and `rkp-phase1-od002` (`ddac7db`) exist locally in the
session that created them; pushing them was refused (HTTP 403), so they are NOT on the remote. They are to be
created and pushed from an authorised machine; until then the commit ids above are the references.

Intake of the returned open-decisions form: `node functions/scripts/rkp-form-intake.mjs <form.md>` (from
`functions/`). It parses every tick-box, flags no answer, several ticked, UNKNOWN and an empty "other", checks the
sign-off block, lists which rule groups are complete, and drafts a ledger entry quoting the answers verbatim. It
decides nothing and changes no engine file; a complete group is only a candidate, and the release controls below
still apply. Tested on a synthetic form (not committed).

## Release controls (apply to every rule change)

1. **No owner answer, no rule change.** Unanswered items stay UNKNOWN and current behaviour is kept.
2. **Verbatim and attributed.** Each decision is logged in the owner's exact words, with the date, the channel
   and who gave it. A message that cannot be attributed is recorded as received, not as confirmed.
3. **Dependencies first.** Rules that depend on each other are settled together before any is implemented
   (for example self-protection with its stacking condition, before Case 4's scoring is touched).
4. **One rule at a time.** Each change gets positive, negative and exception tests, and every verdict
   transition against the frozen baseline is recorded (`attribution-harness/`).
5. **Regression gate before merge or deploy.** Replay the golden corpus, inspect every unexpected positive
   and negative transition, and obtain approval. The functions are deployed before the app build.
6. **Decision and code must agree.** A signed decision establishes the intended rule; it does not show the
   code implements it. The ledger entry, the code and the tests must say the same thing, and a test must
   exist for the worked example the owner gave.

Current disposition: engine frozen at phase 1, branch experimental and unmerged, all unresolved rules UNKNOWN.

## Release gate for any change to a HYPOTHESIS row

1. The new rule traces to owner confirmation or a named source, recorded here.
2. Each changed rule has a positive, a negative and (where it applies) an
   exception test.
3. The golden corpus (`functions/scripts/generate-golden-corpus.ts`,
   `replay-check.ts`) is replayed and every changed verdict is listed and
   explained, not silently accepted.
4. Rules still UNKNOWN stay as they are and are named in the release notes.
