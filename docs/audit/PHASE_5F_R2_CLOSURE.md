# Phase 5F-R2 — Formal Closure

This document formally closes Phase 5F-R2, the narrowly scoped
comparison-reading discussion-validation trust-boundary remediation
authorized directly against Finding item 6 of the Phase 5 Residual
Disposition Gate (`docs/audit/PHASE_5_RESIDUAL_DISPOSITION.md`). It
records no new evidence and makes no production-code, test, or
existing-audit-document change — it exists solely to give the 5F-R2
chain the same explicit closure record every other completed chain in
this project (5E, 5F, 5G, 5H, 5I) already has.

## 1. Chain history

| Step | Commit | Outcome |
|---|---|---|
| Residual Disposition Gate | `bf5198c` | Finding item 6 classified **REMEDIATE BEFORE PHASE 5 CLOSURE**: `validateDiscussionReply()` checked a discussion reply against the anchor reading's `ReadingContract` only — a claim about a `compareReadingIds` comparison reading was never independently validated against that reading's own contract at all. |
| 5F-R2 implementation | `a33b183` | Reproduced first (a genuine comparison-reading claim was shown to be wrongly *rejected* under the pre-fix, anchor-only design — proof that true and fabricated comparison-reading claims were indistinguishable to the validator, since neither was ever checked against that reading's real contract). Closed by reusing the existing single-contract `validateDiscussionReply()` unmodified: every `ReadingGrounding` now carries its own contract; `segmentReplyByGrounding()` attributes reply text to the specific reading it names; `validateDiscussionReplyAgainstGroundings()` runs the existing check once per attributed segment. `labelsFor()`/`dedupeIds()` in `discussReading.ts` make duplicate-category and duplicate-ID cases deterministic. |
| 5F-R2 independent review | `a1510f9` | **PASS.** A ten-scenario live evidence battery independently confirmed: comparison claims checked against their own contract; anchor claims checked against the anchor's, unweakened; mixed replies correctly attributed per segment; fabricated comparison claims rejected across two distinct check families; the pre-fix over-rejection bug directly reproduced and shown closed; ambiguous/duplicate-label and missing-contract/reading cases handled deterministically; the real `composeDiscussionReply()` output boundary enforcing the fix. No P0/P1 finding. |

The implementation checkpoint this closure ratifies is **`a33b183`**,
validated by the independent Review Gate at **`a1510f9`**, exactly as
named in the governing authorization.

## 2. The disclosed residual — preserved exactly, not resolved or reopened

Both the implementation and the review independently characterized, and
this closure restates unchanged, the one disclosed limitation of
label-based attribution:

> Text that is actually about the anchor but appears AFTER a comparison
> label in the same reply is attributed to that comparison reading's
> contract, not the anchor's, until the next label or the end of the
> string.

The review's own live evidence (scenario 5) confirmed this can only ever
cause **over-rejection** of a genuine claim (checked against the wrong,
but still real, contract) — never **under-rejection** (a claim escaping
validation entirely). This closure does not attempt to resolve it, does
not scope a follow-up for it, and does not treat it as a blocking defect
— it is carried forward as a documented residual, on the same footing as
every other accepted residual in this project's audit trail.

## 3. No change to the broader Residual Disposition

This closure does not revisit, reclassify, or act on any other item from
`docs/audit/PHASE_5_RESIDUAL_DISPOSITION.md`. Item 6 alone is closed by
this record; the disposition table's other nine ACCEPT items and the one
DEFER TO PHASE 6 item (P5A-2, the dead `classifyQuestion` callable) are
unchanged and unaddressed here.

## 4. Regression state at closure

Restated from the last independently-verified checkpoint in the chain
(`a1510f9`, the 5F-R2 Review Gate), not re-run fresh by this closure
record, since no code changed between that review and this document:

- Functions tests: **489/489**.
- App tests: **306/306**.
- Typecheck / lint: clean, both packages.
- `node functions/scripts/sync-engine.mjs --check`: clean.
- Golden corpus: **111/111**, untouched.
- Replay check: **24/24**, byte-identical.
- 11,923-case adversarial harness: **0** false negatives, **0** false
  positives, **0** exceptions, **0** contract mutations.
- Prohibited-path diff (`bf5198c..a33b183`, every prohibited path at
  once, `classifyQuestion.ts` included): **empty**.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Working tree: clean before and after this document.
- No production, test, engine, prompt, UI, or existing audit-record file
  is touched by this closure — the only file this phase adds is this
  document.

## 6. Phase 5 overall and Phase 6

- This closure does not create `PHASE_5_CLOSURE.md` and does not declare
  Phase 5 overall closed.
- This closure does not authorize, scope, or begin any Phase 6 work.
  Phase 6 remains frozen, exactly as it has been throughout this chain.
- The next step is a return to the Phase 5 Residual Disposition Gate, to
  address only whatever remains genuinely required — if anything —
  before Phase 5 overall can be closed, as its own separate, narrowly
  scoped authorization.

---

## Status

**PHASE 5F-R2: CLOSED.**

| Phase | Status |
|---|---|
| 5E | ✅ CLOSED |
| 5F | ✅ CLOSED |
| 5G | ✅ CLOSED |
| 5H | ✅ CLOSED |
| 5I | ✅ CLOSED |
| 5F-R2 | ✅ CLOSED (this document) |
| Phase 5 overall | 🔒 not closed |
| Phase 6 | ⛔ not started, not authorized |

Awaiting the next, separately authorized step in the Phase 5 residual/
closure sequence.
