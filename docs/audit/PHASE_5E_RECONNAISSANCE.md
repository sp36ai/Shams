# Phase 5E — Reconnaissance: Narration Structural/Relational Claim Fabrication

**PHASE 5E: RECONNAISSANCE COMPLETE — PASS WITH FINDINGS**

Reconnaissance only. No production code was modified — confirmed by
`git diff --stat` against every commit back through Phase 5D-R's review
gate (`4c36be8..HEAD`) and against the working tree, both empty (§11).

## 1. Exact 5E scope

Phase 5C-R and 5D-R closed obfuscation bypasses of **already-existing**
checks (Unicode noise, confusable substitution, mid-word ASCII punctuation
— techniques for sneaking already-prohibited content past detection). This
phase asked: what is the next weakness *after* those — not another
obfuscation variant on the same checks, but a different kind of gap.

Established from the project's own written history (§2), not invented:
**narration can state fabricated structural, positional, and relational
facts — house placement, zodiacal sign, direction, retrograde/dignity
status, ruler-to-ruler relationship, and reversal likelihood — about a
correctly-named, allow-listed celestial entity or reading element, and no
existing check inspects any of it.** This is Phase 3's own documented,
still-open "Forbidden claims" category (`PHASE_3_CLAIM_SURFACE.md`: "New
planetary facts," "Invented causes") and the "ground-truth cross-check" gap
`SAFETY_VALIDATION_REDESIGN.md` named and Phase 4/4A only partially closed.
It is orthogonal to obfuscation: the underlying fact is fabricated in
plain, unobfuscated English; 5C-R/5D-R's protections have nothing to act
on, because there is no detector for this content to evade in the first
place (confirmed directly, §9).

A second, unrelated finding was discovered incidentally during this
reconnaissance (§7) and is documented, not fixed, per this phase's own
hard-stop instruction.

## 2. Files inspected

- `functions/src/oracle/narrationValidator.ts` (full re-read: every check
  function, the `CHECKS` array, `validateNarration()`'s orchestration loop)
- `functions/src/oracle/textSecurity.ts`
- `functions/src/oracle/readingContract.ts` (full schema)
- `functions/src/oracle/responseComposer.ts` (composition/fallback call site)
- `functions/src/oracle/narrationFallback.ts`
- `functions/src/engine/rkp/diagnosis.ts` (`RkpDiagnosis` shape)
- `functions/src/engine/rkp/watchJudgment.ts` (`WatchVerdict`/
  `DisplayWatchVerdict` shape)
- `functions/scripts/adversarial-harness/contracts.ts` (existing real
  11-contract pool, reused rather than rebuilt)
- `docs/audit/PHASE_3_CLAIM_SURFACE.md`
- `docs/audit/SAFETY_VALIDATION_REDESIGN.md`
- `docs/audit/PHASE_5A_REPORT.md`, `PHASE_5B_REPORT.md`, `PHASE_5C_REPORT.md`,
  `PHASE_5C_R_REMEDIATION.md`, `PHASE_5D_RECONNAISSANCE.md`,
  `PHASE_5D_R_HARDENING.md`, `PHASE_5D_R_REVIEW_GATE.md`

## 3. Production data-flow trace

`ReadingContract` (immutable, built once from `judgeWatchChart()` +
`diagnose()` + `selectRemedyProtocol()` output — Phase 3) → Claude Opus 5
narration generation, structurally bounded to `NarrationFields`
(`responseComposer.ts` — Phase 4's own header confirms the model cannot
return a remedy name/instruction/brand seal; those are copied verbatim) →
`validateNarration()` (Phase 4/4A/5C-R/5D-R — the deterministic,
non-network, non-model safety boundary; every check receives the
three-tier canonicalized text established in 5D-R and compares it against
specific `ReadingContract` fields) → on failure, `fallbackRequired: true`
propagates to the caller, which substitutes a fixed, contract-agnostic
fallback narration (`narrationFallback.ts` — read in full; it contains no
per-reading facts of any kind, so it carries no claim-fabrication surface
of its own and was out of scope for this reconnaissance for that reason)
→ persistence/client delivery (unchanged by any Phase 4–5D-R work,
re-confirmed untouched here).

The trace confirms the attack surface for this phase is entirely inside
`validateNarration()`'s `CHECKS` array: what fields of `ReadingContract`
each check does, and does not, compare narration text against.

## 4. Attack model

`ReadingContractJudgment` (`= DisplayWatchVerdict`) carries, beyond the
fields already checked (`obstruction`→obstructingAgent via
`checkDiagnosisConsistency`, `celestialEntities`→name allow-list via
`checkCelestialEntities`, `timing`→posture via `checkTimingConsistency`,
`state`→outcome polarity via `checkVerdictConsistency`): `targetHouse`,
`targetSignName`, `targetRuler`/`targetRulerName`, `lagnaRuler`,
`rulerRelation`, `direction`, `afflictedDirection`, `reversal`. No field on
this list — nor `RkpDiagnosis.rationale`, `.supportingHouses`,
`.obstructingHouses` — appears anywhere in `narrationValidator.ts` (`grep`
confirmed zero matches for all of them, §5). The attack model: construct
narration text asserting a specific, checkable value for one of these
fields that **contradicts** the contract's actual value, using plain
English (no obfuscation — that is a separate, already-closed axis), and
confirm the validator has no mechanism that could ever reject it,
regardless of how obviously wrong the claim is relative to the contract
sitting right next to it.

## 5. Test methodology

Reused the existing, real, engine-produced 11-contract pool from
`functions/scripts/adversarial-harness/contracts.ts`
(`buildContractPool()`) rather than hand-picking or fabricating contracts —
the same pool Phase 5C/5C-R/5D-R's own harness uses, spanning 10 distinct
real questions/moments plus one synthetic no-intervention variant. For each
contract, constructed one narration sentence per attack category (house
number, sign, direction, retrograde, ruler-relation, reversal, diagnosis
rationale, supporting-house), asserting a value provably different from
the contract's own value (computed programmatically per-contract, not a
fixed string), and ran each through the real, unmodified
`validateNarration()`. A parallel valid-preservation control asserted the
**correct** value for the same fields on the same contracts. Wrote the
probe as a standalone script under `functions/scripts/`, ran it via
`vite-node`, and deleted it before finishing — never committed, consistent
with "no production code changes."

An initial pass produced misleading results due to an incidental,
previously-unknown collision (§7) with an unrelated check; the methodology
section below documents the correction, not just the clean final numbers,
per this phase's own transparency standard (established in prior phases —
e.g. 5D-R's own "newly discovered findings" discipline).

## 6. Corpus/test counts

Clean run (collision-free phrasing, isolating the true attack model from
the unrelated defect in §7): **44 cases** across 11 contracts × 4 mutation
categories (fabricated house number, fabricated diagnosis rationale,
fabricated supporting-house, plus a valid-preservation control for the
correct house number) — **100% bypass on all three fabrication categories
(33/33), 100% correct-value preservation on the control (11/11).**

A broader first-pass sweep (110 cases, 11 contracts × 10 mutation
categories including sign/direction/retrograde/ruler-relation/reversal,
run before the §7 collision was isolated and controlled for) additionally
confirmed **100% bypass (55/55)** for sign, direction, retrograde,
ruler-relation, and reversal fabrication specifically — these categories
never intersect the "the Nth" collision pattern at all (their attack
sentences don't contain ordinal-number phrasing), so their bypass results
stand uncomplicated by §7.

Combined: **8 independent fabrication categories tested, 8/8 show 100%
bypass, 0 false positives on the corresponding valid-preservation controls
once the unrelated §7 collision is avoided.**

## 7. Findings, with severity

### Finding 5E-1 (P1) — No check exists for fabricated structural/relational/causal facts

**Category: true bypass, newly discovered, in the authorized-scope target
of this reconnaissance.**

Every one of the following, stated in narration about a correctly-named,
allow-listed entity or reading element, passes `validateNarration()`
unconditionally — confirmed reproducible on all 11 real contracts:

| Fabricated claim | Checked field | Example reproduction (contract `employment-001`) |
|---|---|---|
| Wrong house number | `judgment.targetHouse` | `"House number 11 governs this matter."` (actual: 10) — **BYPASS** |
| Wrong zodiacal sign | `judgment.targetSignName` | `"Zuhal rules this matter through the sign of Aries."` (actual: Burj Jadi) — **BYPASS** |
| Wrong direction | `judgment.direction` | `"The matter's energy points toward the North."` (actual: South) — **BYPASS** |
| Invented retrograde status | (no such field exists at all) | `"Zuhal is currently retrograde, which complicates this matter further."` — **BYPASS** (the engine never computes or exposes a retrograde flag; this claim is unsupportable by construction, and nothing says so) |
| Inverted ruler-to-ruler relation | `judgment.rulerRelation` | `"... regards ... as a friend"` (actual: Neutral) — **BYPASS** |
| Inverted reversal likelihood | `judgment.reversal` | `"A reversal of this outcome is none."` vs `"... is a real possibility"` (actual: POSSIBLE) — **BYPASS** |
| Invented diagnostic cause | `diagnosis.rationale` (array) | `"This outcome traces back to a hidden affliction from an unaspected malefic influence."`, confirmed absent from the real `rationale` array — **BYPASS** |
| Wrong supporting house | `diagnosis.supportingHouses` | `"House number 1 actively supports this outcome."` (actual supporting set did not include 1) — **BYPASS** |

Every value in the table above is drawn from a field `ReadingContract`
already carries — this is not a request to invent new engine output, only
to check narration against structured facts the engine already computed
and the contract already exposes. Confirmed via `grep` that
`narrationValidator.ts` contains zero references to `targetHouse`,
`targetSignName`, `direction`, `afflictedDirection`, `rulerRelation`,
`reversal`, `diagnosis.rationale`, `supportingHouses`, or
`obstructingHouses`, anywhere in the file.

**Severity: P1.** This is squarely inside the risk category Phase 4 itself
was commissioned to close deterministically (rather than rely on
system-prompt instruction alone) and that `SAFETY_VALIDATION_REDESIGN.md`
named explicitly as undone. A narration claiming the wrong house, sign,
direction, an invented retrograde, an inverted relationship, or a fabricated
cause is exactly the "narration claim becomes materially unsupported [or]
contradictory... despite the authoritative contract remaining correct"
failure mode this reconnaissance was commissioned to look for — the engine
stays correct throughout (confirmed: none of this touches
`judgeWatchChart`/`diagnose`/`ReadingContract` itself), but the seeker
receives a fabricated astrological claim with no deterministic backstop.

### Finding 5E-2 (P1, unrelated production defect — documented only, per hard-stop) — `checkTimingConsistency`'s date pattern false-positives on any ordinal-number phrase, including the very house-number claims Phase 3 explicitly allows

Discovered incidentally while constructing 5E-1's reproductions, **not
part of the attack model this phase was authorized to build**, and
matches this phase's own hard-stop condition ("an unrelated production
defect is discovered → document, do not fix").

`DATE_LIKE_PATTERN` in `narrationValidator.ts`
(`/\b\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?\b|\bthe\s+\d{1,2}(st|nd|rd|th)\b/i`)
has a second alternative, `\bthe\s+\d{1,2}(st|nd|rd|th)\b`, with **no
requirement that a month or any date context be present**. It matches any
occurrence of "the" followed by an ordinal number 1–99, anywhere in the
text, and `checkTimingConsistency` treats every match as `TIMING_FABRICATION`.

Reproduced directly, independent of any house-related content:

```
"The matter is governed by the 10th house of the chart."  → TIMING_FABRICATION
"This concerns the 7th house directly."                    → TIMING_FABRICATION
"The 1st house shows the self."                             → TIMING_FABRICATION
"Consider the 3rd point carefully." (no house, no time)     → TIMING_FABRICATION
```

**This directly contradicts Phase 3's own `PHASE_3_CLAIM_SURFACE.md`**,
which lists "Which house governs the matter
(`contract.diagnosis.targetHouse`)" as an **Allowed claim** — narration is
explicitly licensed to state the house number, and the most natural English
phrasing for doing so ("the Nth house") is rejected by existing,
already-shipped Phase 4A code as if it were a fabricated calendar date.
The fourth reproduction above shows the pattern is not even house-specific:
any ordinal-number reference at all is caught.

**Severity: P1, unrelated to 5E's own scope.** This is a false-positive
defect in already-shipped, already-reviewed (Phase 4A) code, not a bypass
of anything, and not something this reconnaissance was authorized to
create or fix. It is flagged at P1 rather than lower because of its
apparent operational reach: any narration turn that describes the target
house using ordinal phrasing — plausibly common, unprompted, correct
narration language for a system whose Claim Surface explicitly licenses
stating the house — would currently be rejected and silently replaced with
the fixed fallback narration in production, today, independent of this
phase's own work. This project's own instructions class this as a STOP
condition: documented here, not touched.

### Findings NOT made — explicitly ruled out to keep this list honest

- **False positive in the 5E-1 attack model itself:** none found. Every
  valid-preservation control (stating the *correct* house number, using
  phrasing that avoids the Finding 5E-2 collision) validated cleanly.
- **Interaction with 5C-R/5D-R mechanisms:** tested directly (§9) — none
  found, because there is no detector for the obfuscation to evade in the
  first place. This is itself informative, not a null result: it confirms
  5E-1 is a genuinely separate axis from 5C-R/5D-R's, not a residual of
  either.
- **Harmless variation:** several plausible attack shapes were considered
  and rejected as not worth reporting, e.g. narration restating the
  *correct* sign/direction/house in different words — these are Derived
  Presentation per Phase 3, not attacks, and were used as the
  valid-preservation controls instead.
- **Already-covered mechanism:** the specific obstruction-planet claim
  (`checkDiagnosisConsistency`) and entity-name allow-listing
  (`checkCelestialEntities`) remain correctly out of scope for new findings
  here — both were re-confirmed still functioning correctly during this
  reconnaissance (not regressed by anything touched in 5C-R/5D-R).

## 8. Concrete reproductions

Every bypass in the table in §7 is directly reproducible against the real
`buildContractPool()[0]` (`employment-001`) contract, via
`validateNarration(contract, { ...baseFields, interpretation: <claim text> })`
returning `{ valid: true }`. Exact input/output pairs recorded in §7's
table are copy-pasteable reproductions, not paraphrases — each was run
directly, not inferred.

## 9. False-positive analysis

Ran the correct/true value of each fabricated field (the same house number,
the same sign, phrased identically to its fabricated counterpart) through
the same 11 contracts. All 11 valid-preservation controls for house-number
(collision-free phrasing) passed as `valid: true`, matching the
authoritative contract value. No new false positive was introduced by this
reconnaissance's own probing — the one false-positive-shaped result found
(§7, Finding 5E-2) is a pre-existing defect in code shipped in Phase 4A,
not something this reconnaissance's attack model created, and was isolated
and controlled for rather than left to contaminate the 5E-1 bypass counts.

## 10. Interaction with prior 5C-R/5D-R protections

Directly tested: the collision-free fabricated-house-number claim, combined
with each of 5D-R's own closed mechanisms layered on top (a zero-width
joiner inside "number", mid-word ASCII punctuation in "num.ber" and
"gove-rns", and a Cyrillic confusable substituted into "governs") — **all
four combinations still bypass, identically to the unobfuscated case.**
This confirms 5E-1 is not a residual of 5C-R/5D-R's own attack surface and
that those phases' fixes neither help nor hinder it: there is no check
present for the obfuscation techniques to interfere with or evade in the
first place. 5C-R/5D-R's own regression suites (277/277 functions tests,
including 88 dedicated Unicode-security tests) remain fully green,
confirming no interaction broke anything already closed.

## 11. Regression results

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **277/277** (15 test files) — unchanged
  from the Phase 5D-R review-gate baseline.
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304** (27 test suites) — unchanged.
- `node scripts/sync-engine.mjs --check` — clean.
- Golden corpus: **not regenerated** (no code changed this phase, so there
  is nothing for it to drift from) — confirmed via
  `git diff --stat -- docs/audit/golden-corpus/`, empty.
- Replay check: `npx vite-node functions/scripts/replay-check.ts` —
  **24/24** identical.
- Prohibited-path / full boundary proof: `git status --porcelain` empty;
  `git diff --stat 4c36be8..HEAD` (the Phase 5D-R review-gate commit to
  current) — **empty**; working-tree `git diff --stat` — **empty**. No
  file, prohibited or otherwise, changed during this reconnaissance. The
  only artifacts of this phase are this document and the two scratch probe
  scripts, which were deleted before finishing and were never committed.

## 12. Recommendation

**A 5E-R remediation phase is recommended for Finding 5E-1**, scoped
narrowly to exactly the fields enumerated in §7's table — a deterministic
cross-check between narration text and `ReadingContract.judgment`/
`.diagnosis` structured fields, mirroring the existing pattern
`checkVerdictConsistency`/`checkTimingConsistency`/`checkDiagnosisConsistency`
already establish (phrase-detection paired with a specific contract field),
not a semantic/fuzzy claim-extraction system. Recommend the project owner
sequence this the same way 5D→5D-R was sequenced: a separate authorization
defining exactly which of the 8 categories in §7 are in scope, since (per
this project's own discipline) not every open finding needs to be folded
into the same remediation phase, and some (e.g. "invented retrograde,"
where no engine field exists at all to check against — the correct fix
there is closer to a deny-list phrase check than a contract cross-check)
may warrant different mechanisms than others.

**Finding 5E-2 is explicitly NOT part of that recommendation and should be
triaged separately and, given its apparent production reach, likely with
higher urgency** — it is an existing false-positive defect, not a security
bypass, and fixing it (narrowing `DATE_LIKE_PATTERN`'s ordinal alternative
to require actual date/month context) is a different, smaller, and
arguably more time-sensitive change than 5E-1's remediation. This
reconnaissance takes no position on sequencing beyond flagging that it
should not be silently folded into "5E-R" without an explicit decision,
since it was not part of the scope this phase was authorized to construct.

---

**PHASE 5E: RECONNAISSANCE COMPLETE — PASS WITH FINDINGS**

No implementation was performed. No hard-stop condition required halting
reconnaissance itself (Finding 5E-2 triggered the "unrelated production
defect" hard-stop correctly — it was documented, not fixed). Awaiting
authorization for any remediation. Phase 5F not begun.
