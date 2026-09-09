# Phase 5E-R — Ground-Truth Validation Hardening

**Status: PASS**

## 1. Original findings

`docs/audit/PHASE_5E_RECONNAISSANCE.md` (PASS WITH FINDINGS) documented two
findings this phase was authorized to remediate:

- **Finding 5E-1 (P1):** narration could state a fabricated house number,
  sign, direction, retrograde status, ruler-relation, reversal likelihood,
  diagnostic cause, or supporting-house claim about a correctly-named,
  allow-listed entity, with zero detection — 100% bypass across 8 tested
  categories × 11 real contracts.
- **Finding 5E-2 (P1, unrelated pre-existing defect):**
  `checkTimingConsistency`'s date pattern false-positived on any "the Nth"
  ordinal phrase with no date context, rejecting the exact house-number
  phrasing `docs/audit/PHASE_3_CLAIM_SURFACE.md` explicitly lists as
  Allowed.

## 2. Exact implementation

Both fixes live entirely in `functions/src/oracle/narrationValidator.ts`.
`functions/src/oracle/textSecurity.ts` was **not** touched — the new checks
consume the existing three-tier canonicalization (`canonicalText` →
`unicodeOnlyText` → raw `text`) exactly as every other check already does,
via the unmodified `CHECKS` array loop; no new normalization stage was
needed or added.

**Finding 5E-1 — seven new deterministic checks**, added to the `CHECKS`
array between `checkDiagnosisConsistency` and `checkUnsupportedCertainty`:

| Check | Failure code | Contract field compared |
|---|---|---|
| `checkHouseClaims` | `HOUSE_CLAIM_CONTRADICTION` | `judgment.targetHouse` |
| `checkSupportingHouseClaims` | `SUPPORTING_HOUSE_CONTRADICTION` | `diagnosis.supportingHouses` |
| `checkSignClaims` | `SIGN_CLAIM_CONTRADICTION` | `judgment.targetSignName` |
| `checkDirectionClaims` | `DIRECTION_CLAIM_CONTRADICTION` | `judgment.direction` |
| `checkRetrogradeClaims` | `RETROGRADE_CLAIM_CONTRADICTION` | `judgment.factors` / `diagnosis.rationale` (see §4) |
| `checkRulerRelationClaims` | `RULER_RELATION_CONTRADICTION` | `judgment.rulerRelation` |
| `checkReversalClaims` | `REVERSAL_CLAIM_CONTRADICTION` | `judgment.reversal` |

Every one follows the same idiom Phase 4/4A already established
(`checkVerdictConsistency`, `checkDiagnosisConsistency`): a small, named
phrase list or a single bounded regex anchors on a specific claim SHAPE,
`findSentenceContaining()` (pre-existing, reused unchanged) narrows to the
sentence making the claim, a small bounded extractor reads the claimed
value out of that sentence, and the result is compared against one
specific, already-authoritative `ReadingContract` field. **No new
judgment is computed anywhere** — every comparison target is a value
`judgeWatchChart()`/`diagnose()` already produced before narration ever
ran.

**The eighth category, diagnostic-cause fabrication
(`diagnosis.rationale`'s free-text content), was deliberately NOT
implemented.** Reliably recognizing an arbitrary narrated "because X"
clause well enough to compare it against a free-text rationale array would
require exactly the generic natural-language interpretation this phase was
instructed not to build (`docs/audit/PHASE_5E_RECONNAISSANCE.md` itself
anticipated this: "the correct fix there is closer to a deny-list phrase
check than a contract cross-check," and even that was judged too fragile
to commit to here). This is an explicit, documented exclusion per this
phase's own instruction ("Document any claim that cannot be reliably
recognized rather than inventing semantic parsing"), not an oversight —
recorded again in §9 as an open finding.

**Finding 5E-2 — one narrowed regex**, in `DATE_LIKE_PATTERN`:

```diff
- /\b\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?\b|\bthe\s+\d{1,2}(st|nd|rd|th)\b/i
+ /\b\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?\b|\bthe\s+\d{1,2}(st|nd|rd|th)\b(?!\s+(?:house|ghar)\b)/i
```

A negative lookahead excludes only the demonstrated collision — an ordinal
directly followed by "house" or "ghar" (this codebase's own two words for
a chart house; see `engine/rkp/nomenclature.ts`'s `gharLabel()`/
`HOUSE_META`, and the golden corpus's own "2nd Ghar" phrasing). It does
**not** exempt every ordinal that isn't a date (see §9's documented
residual).

## 3. Field provenance

Traced fresh, not assumed, before writing any check:

- `functions/src/oracle/readingContract.ts` — full schema re-read.
  `ReadingContract.judgment` is `DisplayWatchVerdict` verbatim,
  `ReadingContract.diagnosis` is `RkpDiagnosis` verbatim (both type aliases
  documented as "reused rather than restated" in that file's own header) —
  confirming there is no second copy of any of these values to compare
  against; the contract field IS the engine's own output.
- `functions/src/engine/rkp/watchJudgment.ts` — `WatchVerdict` interface
  (lines 54–93): `targetHouse`, `targetSignName`, `rulerRelation`,
  `direction`, `afflictedDirection`, `reversal`, `factors` all confirmed
  present, all engine-computed, all already flowing into the contract
  unmodified.
- `functions/src/engine/rkp/diagnosis.ts` — `RkpDiagnosis` interface
  (lines 74–95): `supportingHouses`, `obstructingHouses`, `rationale`
  confirmed present.
- `functions/src/engine/rkp/nomenclature.ts` — `SIGN_META` (classical name,
  English gloss, per-sign `direction`), `Direction` type (exactly 4
  cardinal values — no intercardinal claim is even representable),
  `HOUSE_META`/`gharLabel()` (confirming "Ghar" is this codebase's own
  domain term for a house, used in the golden corpus itself).

## 4. Claim-recognition strategy — and one correction made before shipping

The initial design for the retrograde check was a blanket deny-list:
reject any narration containing the word "retrograde," on the premise
(carried over from the reconnaissance report) that "no retrograde field
exists on `WatchVerdict`." **Re-reading `watchJudgment.ts` fresh for this
phase's field-provenance step (§3) showed this premise was incomplete**:
there is no standalone boolean, but `judgment.factors` and
`diagnosis.rationale` are both engine-generated, verbatim text arrays that
DO contain a literal "is retrograde" sentence — and only when
`rulerPos.isRetrograde` is genuinely true (confirmed by reading the exact
`factors.push(...)` call site, gated by `if (rulerPos.isRetrograde)`, and
the equivalent gate in `diagnosis.ts` producing "A ruling planet is
retrograde — reversal remains possible.").

A blanket deny-list would have created a real false positive: contract
`employment-001`, already in the existing real 11-contract pool, is
genuinely retrograde, and narration accurately reflecting that (something
the system should be able to say) would have been wrongly rejected.
`checkRetrogradeClaims` was corrected to a genuine ground-truth
cross-check instead — narration asserting retrograde status is valid
exactly when `judgment.factors` or `diagnosis.rationale` already says so,
and a contradiction only when neither does. This is recorded here because
it is exactly the kind of correction this project's audit discipline
exists to catch and document (the same spirit as 5D-R's own "newly
discovered findings" — a design draft that would have shipped a false
positive, corrected before commit, not after).

## 5. False-positive controls

Ten permanent tests in `narrationValidatorGroundTruth.test.ts` directly
target false-positive safety (one "correct claim → VALID" and one "omitted
claim → VALID" per category), plus:

- The classical sign name with no "Burj" prefix and no English gloss is
  recognized as the correct sign, not merely the exact contract string —
  confirming the alias breadth (`signAliases()`) prevents a
  register-mismatch false positive.
- The genuinely-retrograde control (`employment-001`) narrating its own
  retrograde status stays VALID; a non-retrograde contract
  (`business-007`) narrating the identical sentence is INVALID — the
  precise pair that would have caught §4's near-miss.
- The engine's own real phrasing ("reversal remains possible," taken
  verbatim from `diagnosis.ts`'s rationale text) is recognized, not just
  an invented "reversal is possible" phrasing.
- Every category's phrase anchors were checked against the golden corpus
  and existing test files for accidental collision before implementation
  (`grep` across `docs/audit/golden-corpus/cases/*.json` and
  `functions/src/oracle/__tests__/*.ts`) — the only two hits were a
  golden-corpus `factors` string (not narration; golden corpus is never
  passed through `validateNarration()`) and a test contract's own
  `rationale` fixture (`diagnosis.rationale`, not narration text — outside
  what any of these checks reads).
- Full regression (§8) confirms zero new false positives against the
  existing 11,923-case adversarial-harness corpus and all 320 (was 277)
  functions tests.

## 6. P5E-2 date/ordinal solution

See §2 for the exact diff. Verified directly:

- `"The matter is governed by the 10th house of the chart."` — no longer
  flagged (was `TIMING_FABRICATION` before this phase).
- `"10th house"` (no leading "the") — never collided in the first place
  (the original regex required `the\s+`); confirmed still fine.
- `"10th ghar"` — confirmed excluded, same as "house."
- Multiple house references in one sentence (`"the 5th house and the 9th
  house"`) — both correctly excluded (regex re-scans from the position
  after a failed lookahead, not a single fixed match attempt).
- A genuine bare-ordinal date (`"Revisit this matter on the 21st."`) —
  still caught (fix is narrow, not a disabling).
- A genuine date with a month name (`"September 19th"`) — still caught,
  unaffected (`MONTH_DATE_PATTERN` is a separate, untouched alternative).
- A malformed but date-shaped string (`"13/45/2026"`) — still caught,
  unaffected (the first `DATE_LIKE_PATTERN` alternative is untouched).
- `"Consider the 3rd point carefully."` (an ordinal that is neither a
  house nor a date) — **still a false positive, unchanged from before this
  phase.** This is the deliberate scope boundary: exempting every ordinal
  that isn't a date would require guessing the referent of an arbitrary
  noun following an ordinal, which is exactly the generic
  natural-language interpretation this phase was instructed not to build.
  Recorded as a known, pre-existing, out-of-scope residual — not silently
  expanded past the one demonstrated collision, and not something this
  phase introduced.

## 7. Adversarial test matrix

`functions/src/oracle/__tests__/narrationValidatorGroundTruth.test.ts`,
43 tests, against two real engine-produced contracts (`employment-001`
and `business-007`, reproduced locally via the same
`buildWatchChart`→`judgeWatchChart`→`diagnose`→`selectRemedyProtocol`→
`buildReadingContract` chain `narrationValidatorUnicodeSecurity.test.ts`
already uses — the adversarial-harness `contracts.ts` script directory
sits outside `functions/src`'s TypeScript `rootDir` and cannot be
imported from a compiled test file).

Covers every point the authorization required, per category (house,
supporting-house, sign, direction, retrograde, ruler-relation, reversal):
correct claim → VALID; contradictory claim → INVALID; omitted claim →
VALID; correct claim + Unicode obfuscation (ZWJ) → VALID; wrong claim +
obfuscation → INVALID; wrong claim + 5D-R punctuation mechanism → INVALID;
wrong claim + 5D-R confusable mechanism → INVALID; case variation; and (for
house claims specifically) both claim shapes ("house number N" and "Nth
house"), plus a multiple-claims-in-one-narration case. Separately, 8 tests
for Finding 5E-2 cover exactly the punch list the authorization specified:
"the 10th house," "10th house," "10th ghar," multiple house references,
a genuine bare-ordinal date, a genuine date with a month name, a malformed
date, and the documented "ordinal that is not a date" residual.

## 8. Regression results

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **320/320** (16 test files; was
  277/277 before this phase — the 43 new tests above).
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304** — unaffected (this phase touches
  only `functions/src/oracle/narrationValidator.ts`).
- `node scripts/sync-engine.mjs --check` — clean.
- Phase 5C adversarial-harness corpus re-run
  (`npx vite-node scripts/adversarial-harness/run.ts --out-dir=docs/audit/phase-5e-r`):
  **11,923/11,923, 0 false negatives, 0 false positives, 0 exceptions, 0
  contract mutations** — unchanged from the Phase 5D-R review-gate
  baseline.
- Golden corpus: **not regenerated**, per this phase's own explicit
  instruction ("must not be regenerated automatically"). Confirmed
  structurally unaffected — `scripts/generate-golden-corpus.ts` never
  calls `validateNarration()` or imports `narrationValidator.ts` (grepped
  directly) — and confirmed via `git diff --stat -- docs/audit/golden-corpus/`,
  empty.
- Replay check: `npx vite-node functions/scripts/replay-check.ts` —
  **24/24** identical.
- Prohibited-path proof: `git diff --stat 62c3985..HEAD -- src/astrology/
  functions/src/engine/ functions/src/oracle/readingContract.ts
  functions/src/oracle/remedySelection.ts functions/src/oracle/remedyLibrary.ts
  functions/src/prompts/ firestore.rules docs/audit/golden-corpus/` —
  **empty**. `functions/src/oracle/textSecurity.ts` also unmodified,
  confirmed by the same full diff (only `narrationValidator.ts` and the
  new test file changed).

## 9. Newly discovered findings

- **The retrograde-check design correction in §4** — not a new bug in
  shipped code, but a near-miss caught during this phase's own
  implementation before it could ship as one. Recorded per this project's
  standing discipline of documenting self-caught corrections, same as
  5D-R's "newly discovered findings" section.
- **The "ordinal that is neither a house nor a date" residual (§6/§9)** —
  pre-existing (present before Phase 5E-R), not newly introduced,
  explicitly out of this phase's authorized scope, and left open rather
  than silently expanded into.
- **Diagnostic-cause claim fabrication (`diagnosis.rationale`) remains an
  open finding**, documented rather than implemented, per §2's reasoning.
  No mitigation exists for it today; it is not silently covered by any of
  the seven checks above.

No P0/P1 scope-expanding issue was discovered that required a hard stop.

## 10. Prohibited-path verification

Confirmed in §8 (git diff, empty against every path this phase was
instructed not to touch). Additionally, by inspection: no check added
computes a NEW fact — every one performs a single string/regex comparison
against a value already present on the frozen `ReadingContract` before
`validateNarration()` is ever called; none constructs a `WatchVerdict`,
`RkpDiagnosis`, or `RemedyProtocol`, and none is reachable from anywhere
but `narrationValidator.ts`'s own `CHECKS` array. The validator remains
synchronous and deterministic — no check added makes a network call, calls
Claude, or touches Firestore.

## 11. Demonstrating completion, not merely green tests

Per this phase's own completion condition:

- **The original 5E-1 reproductions now fail validation** — directly
  re-run against `employment-001` (§ verified during implementation, not
  merely inferred from the new test suite): fabricated house number →
  `HOUSE_CLAIM_CONTRADICTION`; fabricated sign → `SIGN_CLAIM_CONTRADICTION`;
  fabricated direction → `DIRECTION_CLAIM_CONTRADICTION`; fabricated
  ruler-relation → `RULER_RELATION_CONTRADICTION`; fabricated reversal →
  `REVERSAL_CLAIM_CONTRADICTION`; fabricated supporting-house →
  `SUPPORTING_HOUSE_CONTRADICTION`. (The retrograde reproduction correctly
  now stays VALID for this specific contract, since `employment-001` is
  genuinely retrograde — a more precise outcome than the reconnaissance
  report's original binary framing, and the intended behavior per §4.)
- **Legitimate claims remain valid** — §5's false-positive controls, all
  passing.
- **5C-R and 5D-R protections remain intact** — the three-tier
  canonicalization fallback in `validateNarration()`'s loop is unmodified;
  `narrationValidatorUnicodeSecurity.test.ts`'s 88 tests all still pass;
  the 5D-R obfuscation-combination tests in the new suite (§7) confirm the
  new checks correctly see canonicalized text exactly like every
  pre-existing check does, with no special-casing needed.

## 12. Final status

**PHASE 5E-R: PASS**

Both authorized findings closed within their documented scope. No new
judgment introduced — every new check compares narration against a
value the engine already computed. Zero regressions across 320 functions
tests, 304 app tests, the 11,923-case adversarial-harness corpus, the
golden corpus (untouched), and the 24-case replay. Prohibited paths
confirmed untouched. Diagnostic-cause claim fabrication and the
non-house/non-date ordinal residual remain explicitly open, documented,
not silently absorbed. Awaiting the independent 5E-R review gate before
any Phase 5F authorization.
