# Phase 5H — Formal Closure

This document formally closes Phase 5H, per its own explicit
authorization ("PHASE 5H — FORMAL CLOSURE AUTHORIZATION"). It records
no new evidence and performs no production-code change — it exists
solely to give the 5H chain the same explicit closure record every
other completed chain in this project (5E, 5F, 5G) already has.

## 1. Chain history

| Step | Commit | Outcome |
|---|---|---|
| Reconnaissance | `0d4d7b4` | Finding 5H-1 (P1): a client-side TTS-text concatenation (`ChatBubble.speakableTextFor()`, pre-5H) could reconstruct a ground-truth claim split across two validated `NarrationFields`, producing a spoken string `validateNarration()` never checked as a whole. |
| 5H-R implementation | `00b0e3d` | Closed 5H-1 by moving the TTS-string join server-side (`buildSpeakableText()`) and validating the joined artifact through the same `validateNarration()` pipeline, before it ever reaches the client. |
| 5H-R independent review | `523c592` | **FAIL.** Proved a new P1 (Finding 5H-R-Review-1): the join's `'. '` separator inserted an artificial sentence boundary at every field seam, and six of the seven Phase 5E ground-truth claim families (`checkHouseClaims`, `checkSupportingHouseClaims`, `checkSignClaims`, `checkDirectionClaims`, `checkRetrogradeClaims`, `checkRulerRelationClaims`) bound a "sentence" by the nearest literal `.` — so a fabricated claim split exactly across that artificial seam bypassed detection. |
| 5H-R2 implementation | `1917b50` | Closed Finding 5H-R-Review-1 by changing `buildSpeakableText()`'s join separator from `'. '` to `' '` — never injecting a period the model's own text didn't write — without touching `narrationValidator.ts` or `textSecurity.ts`. |
| 5H-R2 independent review | `2204a8f` | **PASS.** Confirmed the six-claim-family seam bypass closed (fabricated split claims rejected, genuine split/unsplit claims still accepted), all pre-existing 5C-R/5D-R protections (confusable substitution, mid-word punctuation, ZWJ, terminology/internal-data leakage) intact through the fixed artifact, and — after an initial finding that only "composition identity" had been proven — a direct, end-to-end interception proof that the literal argument passed to the app's only `Tts.speak()` call site is byte-for-byte identical to the server-validated artifact ("delivery identity," not just composition identity). |

The implementation checkpoint this closure ratifies is **`1917b50`**,
validated by the independent Review Gate at **`2204a8f`**, exactly as
named in the governing authorization.

## 2. Residuals — none new; all carried forward unchanged

No residual originates from Phase 5H itself. The 5H chain closed the one
finding it was scoped to close (5H-1, then the review-surfaced
5H-R-Review-1) without introducing a new one; `narrationValidator.ts`
and `textSecurity.ts` were never modified across the entire chain.

Every residual accepted at the closure of 5E, 5F, and 5G remains exactly
as recorded in `PHASE_5E_CLOSURE.md`, `PHASE_5F_CLOSURE.md`, and
`PHASE_5G_CLOSURE.md`, unmodified and unreopened by this chain:

- Unrelated "ruler" noun collision (P3).
- Retrograde meta-commentary false-positive shape (P3).
- ZWJ-inside-"fortune"/three-tier-fallback interaction (P3, informational).
- Diagnostic-cause claim fabrication — no ground-truth check exists.
- Non-house/non-date ordinal residual (`DATE_LIKE_PATTERN` scope boundary).
- Repeated-character padding (P2, open since Phase 5D reconnaissance).
- Discussion-reply validation covers only the anchor reading, not
  `compareReadingIds` comparison readings (5F).
- Legacy readings cast before Phase 5F shipped skip discussion
  validation entirely (5F).
- Celestial-entity validation bounded to the 9 grahas the engine
  currently represents (5G-1, P3).

This closure record does not classify, dispose of, fix, or re-scope any
of these — that is the explicit purpose of the separately authorized
Residual Disposition Gate.

## 3. Regression state at closure

Restated from the last independently-verified checkpoint in the chain
(`2204a8f`, the 5H-R2 Review Gate), not re-run fresh by this closure
record, since no code changed between that review and this document:

- Functions tests, app tests, typecheck, lint: all clean on both
  packages.
- `node functions/scripts/sync-engine.mjs --check`: clean.
- Golden corpus: 111/111, byte-identical, untouched.
- Replay check: 24/24, byte-identical.
- 11,923-case adversarial harness: 0 false negatives, 0 false
  positives, 0 exceptions, 0 contract mutations.
- Prohibited-path diff (`523c592..1917b50`, every prohibited path at
  once): empty.
- `narrationValidator.ts` / `textSecurity.ts`: untouched across the
  entire 5H chain.

## 4. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- This closure's own commit sits after `cde9722` (the separately
  recorded, later Phase 5I independent Review Gate) — Phase 5I's own
  work is historical fact by the time this document is written, but is
  not itself closed or affected by this record. This document closes
  only the 5H chain, on its own governing checkpoints (`1917b50` /
  `2204a8f`), per its own authorization.
- Working tree: clean before and after this document.
- No production, test, engine, prompt, or UI file is touched by this
  closure — the only file this phase adds is this document.

## 5. Phase 5I closure remains a separate, not-yet-issued step

This document closes Phase 5H only. It does not close Phase 5I (which
has its own passed implementation and review, `ff50613` / `cde9722`,
but — per the governing authorization's own stated sequence — awaits
its own, separately authorized closure record next), and it does not
close Phase 5 overall. The Residual Disposition Gate, audit-record
backfill (5B closure, 5C-R dedicated review, 5D-R closure), final
Phase 5 regression, and Phase 5 closure all remain separate, not-yet-
authorized steps, per the sequence already agreed.

---

## Status

**PHASE 5H: CLOSED.**

| Phase | Status |
|---|---|
| 5E | ✅ CLOSED |
| 5F | ✅ CLOSED |
| 5G | ✅ CLOSED |
| 5H | ✅ CLOSED (this document) |
| 5I | 🔒 implementation + review PASS — closure record not yet authorized |

Awaiting the separate Phase 5I formal closure authorization next.

---

## Addendum — 2026-09-09: comparison-reading residual since resolved

§2's residual list, restated from `PHASE_5E_CLOSURE.md`/`PHASE_5F_CLOSURE.md`/
`PHASE_5G_CLOSURE.md` as they stood at this document's own commit
(`528211c`), included:

> Discussion-reply validation covers only the anchor reading, not
> `compareReadingIds` comparison readings (5F).

This was accurate at the time. It is **no longer accurate**: Phase 5F-R2
(`docs/audit/PHASE_5F_R2_HARDENING.md` / `_REVIEW.md` / `_CLOSURE.md`,
implementation `a33b183`, independent review PASS `a1510f9`, formal
closure `5b44018`) closed this specific item, extending validation to
every comparison reading a discussion reply names, independently
authoritative against its own persisted `ReadingContract`. This addendum
does not alter §2's original text (an accurate record of this document's
own commit) and does not reopen Phase 5H — it corrects a reader's
understanding of the item's *current* status, per this project's
established append-only audit convention. See
`docs/audit/PHASE_5_FINAL_RESIDUAL_GATE.md` §6 for the discovery of this
staleness and `docs/audit/PHASE_5_CLOSURE.md` for the fully reconciled,
current disposition of every Phase 5 residual.
