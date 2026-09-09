# Phase 8A-2 — Independent Review Gate: Narration Safety Validation Gap Reconnaissance

Independent verification of `docs/audit/PHASE_8A_1_RECONNAISSANCE.md`
(`82b7c03`). Baseline: `82b7c03`. **Read-only — no repository file is
modified by this review.**

## 1. Methodology

Every claim in `PHASE_8A_1_RECONNAISSANCE.md` was independently
re-derived directly against `main`'s committed tree (`git show
ce536bc:...`), not accepted from the document or checked against the
local working tree. Beyond re-verification, this review deliberately
widened the search the reconnaissance ran — enumerating **every**
direct Anthropic API call site in `functions/src/`, not just the one
(`responseComposer.ts`) the reconnaissance characterized — specifically
to check whether the same gap class exists anywhere else the
reconnaissance didn't look. This is the same kind of widening this
audit chain applied at the 6D-3 review (which found a 4th `uuid` call
site the reconnaissance missed).

## 2. Point-by-point re-verification

| Claim | Re-verified | Result |
|---|---|---|
| `safetyValidator.ts` absent from `main` | `git show ce536bc:functions/src/oracle/safetyValidator.ts` | ✅ Confirmed absent |
| `narrationValidator.ts` absent from `main` | same method | ✅ Confirmed absent |
| `narrate()`'s exact "removed when the KP engine was deleted" comment | `git show ce536bc:...responseComposer.ts \| grep` | ✅ Confirmed, exact text and line numbers match |
| `readingId` declared but never used in `responseComposer.ts` | `git show ce536bc:...responseComposer.ts \| grep -n readingId` | ✅ Confirmed — exactly one match, the interface declaration; no destructuring use anywhere in the file |
| `validationLog` is a single orphaned repo-wide reference | `git grep -n "validationLog" ce536bc` | ✅ Confirmed — exactly one match, the comment itself |
| Hardened-branch replacement is 2,112 lines across 4 files | `wc -l` on all 4 files | ✅ Confirmed exactly (1539+80+327+166=2112) |
| No output-side narration-safety test exists on `main` | re-read `discussionComposer.test.ts` / `questionInNarration.test.ts` directly | ✅ Confirmed — both are input-side (`sanitizeQuestion`) tests, not output-side |
| This is the live, common-case production path | traced `askWatchOracle.ts` → `composeWatchOracleResponse` → `narrate()` | ✅ Confirmed |

**Every claim in the reconnaissance independently re-verified exactly
as stated. No inaccuracy found in what it reported.**

## 3. Value-added finding: the reconnaissance's scope was incomplete — a second live, unvalidated path exists

Widening the search past `responseComposer.ts` to every
`api.anthropic.com` call site in `functions/src/` on `main` surfaced:

```
$ git grep -n "api.anthropic.com" ce536bc -- functions/src/
functions/src/functions/classifyQuestion.ts:48
functions/src/functions/inferProfile.ts:42
functions/src/functions/selectRemedies.ts:78
functions/src/functions/selectRemedies.ts:168
functions/src/oracle/discussionComposer.ts:294
functions/src/oracle/responseComposer.ts:315
```

**`discussionComposer.ts` (the follow-up-conversation composer behind
the `discussReading` callable) is a second, materially significant
gap the reconnaissance did not mention at all.** Traced independently:

- `functions/src/functions/discussReading.ts` imports and calls
  `composeDiscussionReply` from `discussionComposer.ts` — a live,
  exported, Zod-input-validated `onCall` function
  (`DiscussReadingSchema`), the server side of this app's "explain a
  settled reading without re-judging" follow-up-chat feature.
- `discussionComposer.ts` calls the Anthropic API directly on `main`,
  with **no import of `validateNarration`, `safetyValidator`, or any
  other output check** — confirmed by `grep -n
  "validateNarration\|narrationValidator\|import.*validat"` returning
  nothing on `main`'s file.
- **The hardened branch's own fix already covers this second path**:
  its `discussionComposer.ts` imports `validateNarration` (line 75)
  and calls it via `validateDiscussionReply()` (line 368) — meaning
  the Phase 4 work this audit chain already produced anticipated and
  closed exactly this second exposure, but `main` has neither the
  original nor the replacement validation on this path.
- `discussionComposer.test.ts` exists on `main` too, but — like
  `responseComposer.ts`'s tests — only exercises the input-side
  `sanitizeQuestion` injection defense, not output content.

**This does not change the reconnaissance's central conclusion — it
strengthens it.** The gap is not confined to one function; it is a
missing capability at the composer-layer level, present everywhere
`main`'s code generates free-text model output for a user to read.
Any remediation authorization that follows this review must scope to
**both** `responseComposer.ts` and `discussionComposer.ts`, not
`responseComposer.ts` alone as `PHASE_8A_1_RECONNAISSANCE.md` §9
implicitly framed it (its "narrow port" option listed the 4
replacement files and "the two call sites' wiring in
`responseComposer.ts`" — which undercounts the wiring work by one
file's call sites).

## 4. A third, lower-priority surface — disclosed for completeness, not treated as equally urgent

`selectRemedies.ts` — a third exported `onCall` function, also calling
the Anthropic API directly with no output validation, returning
free-text `selectionReason` and `descriptions` fields. Independently
traced its client-side status: `src/screens/ReadingScreen.tsx`'s own
comments and `src/data/watchRemedyContext.ts`'s own comments state
this path was **"disconnected in Phase 2B"** — a decision this audit
chain's own earlier work made, not something this review is
discovering fresh. No live client caller reaches it under normal app
use, mirroring `classifyQuestion`'s already-established dead-code
status from Finding 7 (`PHASE_6D_5_RECONNAISSANCE.md` §3.3). Named
here for completeness — a directly-authenticated client could still
invoke this exported callable bypassing the UI, the same residual
exposure Finding 7 already accepted for `classifyQuestion` without
requiring remediation — but this review does not treat it as urgent
as the two reachable-by-normal-use paths in §3, and does not expand
scope to include it in any forthcoming remediation authorization
unless the owner directs otherwise.

`classifyQuestion.ts` and `inferProfile.ts` (the other two call sites)
are unrelated to this finding — already characterized under Finding 7
(6D-5), and their outputs are constrained to fixed enums before use,
which is a structurally different mitigation than narration-content
validation addresses. Re-litigating Finding 7 is out of this review's
scope.

## 5. Severity re-assessment

The reconnaissance's **P1** classification holds, and this review's
widened scope reinforces rather than undercuts it: the missing control
is not an isolated omission on one function but a pattern absent from
the composer layer generally on `main`, while being present and
actively tested (adversarial fixtures, ground-truth tests,
unicode-security hardening) on the hardened branch for exactly the
functions that need it. No P0 escalation is warranted — no
authentication bypass, no cross-user access, no unbounded financial
effect follows from either path.

## 6. Hard-stop determination

**No new, separate hard-stop condition is triggered by this review.**
The `discussionComposer.ts` gap is the same finding class already
under a hard-stop (missing post-generation narration safety
validation), found at a second call site during this review's own
widened search — not a new defect category requiring its own halt.
It is folded into this finding's scope, to be carried into whatever
remediation authorization follows, rather than treated as a separate
P0/P1 event.

## 7. Verdict

**PHASE 8A-2 INDEPENDENT REVIEW GATE: ✅ PASS, WITH SCOPE REFINEMENT.**

Every factual claim in `PHASE_8A_1_RECONNAISSANCE.md` was independently
re-verified and found accurate. The reconnaissance's root-cause
tracing, severity assessment, and reachability analysis all hold. The
one material addition this review makes is **broadening the finding's
known scope from one call site to two** (`responseComposer.ts` +
`discussionComposer.ts`), with a third, lower-priority, disconnected
surface (`selectRemedies.ts`) disclosed for completeness. **Any
remediation authorization that follows this review should scope to
both `responseComposer.ts` and `discussionComposer.ts`** — the
reconnaissance's §9 "narrow port" option undercounted the wiring work
needed by focusing on one file.

This review does not authorize remediation, does not write the
`PHASE_7B_REVIEW.md` correcting addendum (a separately authorized,
narrowly scoped action per the standing sequence), and does not
resume the paused Phase 8A promotion sweep.

## 8. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this review is written against: `82b7c03` (Phase 8A-1
  reconnaissance).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, CI-workflow, or
  deployment-configuration file is touched — the only file this phase
  adds is this document.
- No implementation occurred. No remediation was chosen or begun.

---

## Status

**PHASE 8A-2 INDEPENDENT REVIEW: COMPLETE — PASS WITH SCOPE REFINEMENT.**

| Layer | Status |
|---|---|
| Phase 8A-1 Reconnaissance | ✅ Complete (`82b7c03`), independently confirmed accurate |
| Phase 8A-2 Independent Review | ✅ PASS, WITH SCOPE REFINEMENT (this document) |
| Narration safety validation gap — scope | 🔴 Confirmed at 2 live call sites (`responseComposer.ts`, `discussionComposer.ts`); 1 disconnected surface disclosed (`selectRemedies.ts`) |
| Remediation | 🔲 Not yet authorized — scope for it now includes both files |
| `PHASE_7B_REVIEW.md` correcting addendum | 🔲 Owed, not yet authorized or written |
| Phase 8A promotion sweep | ⏸️ Still paused |
| Production | ❌ NOT READY |

Awaiting a separate, explicit authorization for: (a) remediation of
this finding across its now-confirmed two-file scope, (b) the
`PHASE_7B_REVIEW.md` correcting addendum, and/or (c) resumption of the
paused Phase 8A promotion-reconnaissance sweep.
