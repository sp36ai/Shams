# Phase 5F-R2 — Independent Review Gate

Review of implementation checkpoint `a33b183` ("Phase 5F-R2: close the
comparison-reading validation trust boundary"), against the central
requirement of the governing 5F-R2 authorization: every reading a
discussion response relies upon — anchor and comparison alike — must be
independently authoritative and validation-covered, without weakening
existing anchor behavior, widening scope into the judgment engine, or
touching `classifyQuestion.ts` / Phase 6 infrastructure.

Review-only. No production code, test, or existing audit document was
modified by this review. The one temporary evidence script used during
review (`functions/scripts/_review-evidence-5fr2.ts`, run against the
real, unmodified `a33b183` code) was deleted before this document was
written and was never committed.

## 1. Checkpoint

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: `a33b183`, on parent `bf5198c` (the Phase 5 Residual
  Disposition Gate, which is where Finding item 6 — the defect this
  phase closes — was first classified REMEDIATE BEFORE PHASE 5 CLOSURE).
- Working tree: clean throughout.

## 2. Evidence supplied and independently checked

A ten-scenario live evidence battery, run against the real,
unmodified `segmentReplyByGrounding`, `validateDiscussionReply`,
`validateDiscussionReplyAgainstGroundings`, `labelsFor`, and `dedupeIds`
at `a33b183`, using genuine engine-computed `ReadingContract`s (not
fixtures with hand-set claim fields):

1. **Comparison claim → comparison contract.** A fabricated house claim
   attributed to a comparison reading (house 8, real value 7) — rejected,
   correctly localized to `[the business reading]`.
2. **Anchor claim → anchor contract.** A fabricated house claim with no
   comparison label at all (house 11, real value 10) — rejected,
   correctly localized to `[the career reading]`.
3. **Mixed claim → correct contract per segment.** Two genuine claims,
   one before any label (anchor) and one after a comparison label — both
   independently accepted; segmentation output inspected directly and
   matches the expected split.
4. **Malformed/ambiguous label boundary.** Two groundings deliberately
   given an identical label — segmentation collapses to one whole-text
   segment against `groundings[0]`, confirmed by object identity (the
   anchor's own contract, not the colliding grounding's) rather than by
   label string alone.
5. **Trailing anchor text after a comparison label (the disclosed
   residual).** A genuine anchor claim placed after a comparison label
   is attributed to the comparison reading's segment and rejected
   against that contract, even though it is true of the anchor. Directly
   confirms the hardening report's own characterization: this is
   over-rejection of a genuine claim, not an unchecked path — the claim
   is still checked, just against the wrong (but real) authority.
6. **Fabricated comparison claim, a second check family.** A timing
   contradiction (immediacy asserted against business's WAIT posture)
   attributed to the comparison reading — rejected, with a
   `TIMING_ALTERATION` failure correctly localized, distinct from
   scenario 1's `HOUSE_CLAIM_CONTRADICTION` family.
7. **Genuine comparison claim that differs from anchor truth.** The
   decisive scenario: business's real house (7) stated as belonging to
   the business reading, while career's real house is different (10).
   Checked against the anchor alone (the pre-5F-R2 call shape): **wrongly
   rejected** — direct, live proof of the over-rejection bug the fix
   closes, not merely the security-gap framing. Checked through the fix:
   **correctly accepted.**
8. **Multiple comparison readings and duplicate IDs.** Three groundings,
   both comparison claims genuine → accepted; second one fabricated →
   rejected, correctly localized to the second reading specifically, not
   the first or the anchor. `dedupeIds` and `labelsFor` exercised
   directly and produce the documented, deterministic output.
9. **Missing contracts/readings.** A comparison grounding with
   `contract: null` → its own segment skipped (valid), while the anchor
   still validates normally alongside it; a missing/foreign/invalid
   comparison id is confirmed to never reach `segmentReplyByGrounding`
   at all (existing, unchanged upstream filter).
10. **Fallback behavior at the actual discussion-response boundary.**
    `composeDiscussionReply()` itself requires the Firebase Functions
    params runtime for the bound API key, unavailable to a standalone
    script — so this was proven via the already-committed integration
    tests instead (`discussionComparisonValidation.test.ts`, re-run
    fresh: 29/29 passing), specifically *"a comparison-reading-fabricating
    reply is not returned — `composeDiscussionReply()` returns null"*
    (log confirms the real rejection path,
    `oracle discussion reply failed validation — no reply returned`,
    correctly attributed) and *"a genuine multi-reading reply is
    returned normally, at the actual output boundary."*

Also independently re-confirmed: full regression matrix at `a33b183`
(functions 489/489, app 306/306, typecheck/lint clean both sides, mirror
sync clean, golden corpus 111/111 untouched, replay 24/24, adversarial
harness 11,923 at 0 FN/FP/exceptions), and the prohibited-path diff
(`bf5198c..a33b183`, every prohibited path at once, `classifyQuestion.ts`
included) — empty.

## 3. Gate assessment

| Gate | Result |
|---|---|
| Comparison claim checked against comparison contract | PASS |
| Anchor claim checked against anchor contract (unweakened) | PASS |
| Mixed claim correctly attributed per segment | PASS |
| Fabricated comparison claim rejected — house-claim family | PASS |
| Fabricated comparison claim rejected — timing family | PASS |
| Genuine comparison claim differing from anchor truth accepted | PASS |
| Pre-fix over-rejection bug directly reproduced and shown closed | PASS |
| Ambiguous/duplicate label boundary falls back safely, not silently | PASS |
| Multiple comparison readings independently authoritative | PASS |
| Duplicate comparison IDs handled deterministically | PASS |
| Missing comparison contract skips only its own segment | PASS |
| Missing/invalid comparison reading never reaches attribution | PASS |
| Real output boundary (`composeDiscussionReply`) enforces the fix | PASS |
| `validateDiscussionReply()` reused unmodified — no second validator | PASS |
| `narrationValidator.ts` / `textSecurity.ts` untouched | PASS |
| `classifyQuestion.ts` untouched | PASS |
| Judgment engine / astronomical calc / verdict / timing / remedy logic untouched | PASS |
| Terminology/debranding scope unchanged | PASS |
| Functions tests | 489/489 |
| App tests | 306/306 |
| Typecheck / lint | clean, both sides |
| Mirror synchronization | clean |
| Golden corpus | 111/111, untouched |
| Replay | 24/24 |
| Adversarial harness | 11,923 — 0 FN / 0 FP / 0 exceptions |
| Prohibited-path diff | empty |
| Phase 6 work performed | none |
| P0/P1 finding remaining from this pass | none |

## 4. Disclosed residual — retained, not reopened

Scenario 5 independently confirms the residual limitation disclosed in
`PHASE_5F_R2_HARDENING.md` §6: text returning to the anchor's own subject
after a comparison label has been named is attributed to that comparison
reading's segment, not the anchor's, until the next label or the end of
the reply. The live evidence establishes this produces over-rejection of
a genuine claim, never an unchecked fabrication path — the asymmetry the
governing authorization's "do not weaken existing validation" instruction
required. This review does not treat it as a gate failure and does not
recommend reopening 5F-R2's scope to build full semantic claim
attribution; it is retained as a documented, carried-forward residual.

## 5. Findings

None. No P0, P1, P2, or P3 finding was raised against `a33b183` by this
review. The remediation is architecturally sound (existing single-
contract validator reused unmodified; attribution added as a bounded,
deterministic layer in front of it) and directly evidenced against both
the security framing (a fabrication must not pass) and the correctness
framing (a genuine comparison-reading claim must not be wrongly rejected)
of the original defect.

## 6. Final disposition

**PHASE 5F-R2 REVIEW GATE: PASS.**

This is a review-gate PASS for the `a33b183` implementation checkpoint,
not a declaration that Phase 5F-R2 itself is closed, that Phase 5 overall
is closed, or that Phase 6 begins. Per the governing authorization's own
completion condition and this review's scope:

- Phase 5F-R2 remains **not closed** by this document — closure is its
  own, separately authorized next step.
- Phase 5 overall remains **not closed**.
- Phase 6 remains **not started, not authorized**.
- This review does not reopen 5F-R2 for additional hardening, does not
  build a semantic-attribution replacement for the disclosed residual,
  and does not touch any file outside this review's own evidence
  gathering (all of which was deleted before this document was written).

The next actions — the 5F-R2 closure record, and the already-defined
outstanding Phase 5 residual/closure sequence — each await their own
separate, explicit authorization.
