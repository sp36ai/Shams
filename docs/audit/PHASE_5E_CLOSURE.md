# Phase 5E — Formal Closure Record

**PHASE 5E: CLOSED**

This document is the closure record only. No production code, test, or
engine behavior was modified to produce it; no golden corpus regeneration
occurred. It records the complete chain's final state and the residuals
carried forward, unreopened.

## 1. Chain summary

| Step | Result | Record |
|---|---|---|
| 5E Reconnaissance | PASS WITH FINDINGS | `docs/audit/PHASE_5E_RECONNAISSANCE.md` |
| 5E-R (implementation) | PASS | `docs/audit/PHASE_5E_R_HARDENING.md` |
| 5E-R Review | PASS WITH DOCUMENTED GAPS | `docs/audit/PHASE_5E_R_REVIEW_GATE.md` |
| 5E-R2 (implementation) | PASS | `docs/audit/PHASE_5E_R2_HARDENING.md` |
| 5E-R2 Review | PASS WITH DOCUMENTED FINDINGS | `docs/audit/PHASE_5E_R2_REVIEW.md` |
| 5E-R3 (implementation) | PASS | `docs/audit/PHASE_5E_R3_HARDENING.md` |
| 5E-R3 Review | PASS WITH DOCUMENTED FINDINGS (new P1 found) | `docs/audit/PHASE_5E_R3_REVIEW.md` |
| 5E-R4 (implementation) | PASS | `docs/audit/PHASE_5E_R4_HARDENING.md` |
| 5E-R4 Review | PASS | `docs/audit/PHASE_5E_R4_REVIEW.md` |

Every step in this chain was independently reviewed against fresh source
and fresh adversarial probes before the next step was authorized — no
implementation phase self-certified its own closure. The 5E-R3 Review's
discovery of a new P1 (the "misfortune" substring bypass), and its
remediation and independent re-review in 5E-R4/5E-R4 Review, is the
clearest evidence this discipline did its job: a real regression was
introduced by an earlier remediation step, caught by the next review
before reaching production, and closed under the same evidence standard
as every other finding in this chain.

## 2. What Phase 5E closes

Two authorized findings from `PHASE_5E_RECONNAISSANCE.md`:

- **Finding 5E-1 (P1):** narration could fabricate a wrong house number,
  sign, direction, retrograde status, ruler-relation, reversal
  likelihood, or supporting-house claim about a correctly-named,
  allow-listed entity, with zero detection. Closed by seven new
  deterministic ground-truth checks in `narrationValidator.ts`
  (`checkHouseClaims`, `checkSupportingHouseClaims`, `checkSignClaims`,
  `checkDirectionClaims`, `checkRetrogradeClaims`,
  `checkRulerRelationClaims`, `checkReversalClaims`), each comparing
  narration against a value the engine already computed — no new
  judgment introduced anywhere in the chain.
- **Finding 5E-2 (P1):** `checkTimingConsistency`'s date pattern
  false-positived on any "the Nth" ordinal phrase with no date context,
  rejecting the exact house-number phrasing `PHASE_3_CLAIM_SURFACE.md`
  explicitly allows. Closed by a narrow negative lookahead excluding only
  the demonstrated ordinal-plus-house/ghar collision.

Across the chain's four remediation-plus-review cycles, four further
false-positive classes were found and closed in the new ground-truth
checks (ruler-relation, retrograde, direction, and — across two rounds —
reversal), each via the smallest evidence-based discriminator available,
none broadening the validator toward semantic or LLM interpretation.

## 3. Final accepted residuals — recorded, not reopened

- **Unrelated "ruler" noun collision** (`PHASE_5E_R_REVIEW_GATE.md`
  Finding 5E-R-Review-1 / `PHASE_5E_R2_REVIEW.md` Finding
  5E-R2-Review-1) — P3. The "ruler" keyword discriminator in
  `checkRulerRelationClaims` does not verify the word refers to the
  astrological ruler specifically.
- **Retrograde meta-commentary limitation** (Finding 5E-R-Review-2 /
  5E-R2-Review-2) — P3. `checkRetrogradeClaims`'s planet/ruler-context
  requirement does not distinguish a genuine assertion from explicit
  disclaiming commentary.
- **Documented three-tier fallback interaction** (Finding
  5E-R2-Review-4) — P3/informational, no realistic exploitation path. A
  Unicode obfuscation character planted inside the word "fortune" itself
  defeats the reversal-idiom exclusion on the raw-text fallback tier —
  self-defeating for an attacker, since it only makes a benign phrase
  MORE likely to be (safely) rejected, not less.
- **Diagnostic-cause fabrication** (`diagnosis.rationale`'s free-text
  content) remains intentionally unimplemented — recognizing an
  arbitrary narrated "because X" clause well enough to compare it against
  a free-text rationale array would require the generic
  natural-language interpretation this entire chain was repeatedly
  instructed not to build.
- **Non-house/non-date ordinal residual** (Finding 5E-2, scope boundary)
  — an ordinal referring to neither a house nor a date (e.g. "the 3rd
  point") remains a pre-existing false positive in
  `checkTimingConsistency`, unchanged by this chain's narrow fix.
- **Repeated-character padding** — out of scope for this entire chain,
  carried forward unchanged from Phase 5D's own reconnaissance
  (`docs/audit/PHASE_5D_RECONNAISSANCE.md`); Phase 5D-R's own
  false-positive analysis found no safe blanket normalization exists for
  it. Not touched by any phase in the 5E chain.

None of these six residuals were modified, reopened, or re-scoped by this
closure record.

## 4. Standing invariants confirmed intact at closure

- `functions/src/oracle/textSecurity.ts` — untouched across the entire
  5E chain (confirmed independently at every review gate).
- The engine (`functions/src/engine/`, `src/astrology/`), `kp/`,
  `ReadingContract` authority, remedy taxonomy/selection/library,
  prompts, UI, app, and `firestore.rules` — untouched across the entire
  chain (confirmed independently at every review gate via prohibited-path
  git diffs).
- The three-tier validator fallback (full canonical → Unicode-noise-only
  → raw text), established in Phase 5D-R, remains intact and unmodified
  in its own logic — the 5E chain's checks consume it exactly as every
  pre-existing check does, with no special-casing added.
- The golden corpus and 24-case replay determinism — byte-identical
  throughout the entire chain; never regenerated as a matter of course,
  confirmed at every review gate.
- Engine mirror sync — clean at every review gate.

## 5. Final regression state at closure (from 5E-R4 Review, the chain's last independently-verified checkpoint)

- Functions: **367/367**
- App: **304/304**
- Phase 5C adversarial corpus: **11,923/11,923, 0 false negatives, 0
  false positives, 0 exceptions, 0 contract mutations**
- Golden corpus: untouched, byte-identical
- Replay: **24/24** identical
- Engine mirror: synchronized
- Prohibited-path diff: empty, `commit fddc19c..8013c5d`

## 6. Closure

**PHASE 5E: CLOSED.**

No production code, test, or engine behavior was modified by this
closure record. No golden corpus regeneration occurred. Phase 5F is not
authorized by this document — it requires its own explicit authorization,
scoped fresh rather than inferred from any earlier roadmap, per the
project owner's own stated discipline for this chain.

Stopping here. Awaiting explicit Phase 5F authorization.
