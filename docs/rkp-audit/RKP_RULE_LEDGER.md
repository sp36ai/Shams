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
| L1 | Local clock minute → twelve 5-minute brackets → 1st Ghar sign (00–04 Hamal … 55–59 Hoot); rest in zodiac order. The minute is the server's receive time shifted by the phone's UTC offset; seconds ignored | `watchGrid.ts`, `localTime.ts`, `askWatchOracle.ts` | UNKNOWN | Not in the owner document. Code header calls it the "Digital Watch Oracle" mechanism and compares it to KP's number method. Needs the exact rule, boundary handling and a worked example (sheet 1.1) |
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
