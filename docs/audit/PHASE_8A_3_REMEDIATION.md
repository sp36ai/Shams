# Phase 8A-3 — Remediation: Narration Safety Validation Gap

Authorized scope: restore independent post-generation narration
validation on both live Anthropic-generated narration paths
(`responseComposer.ts`, `discussionComposer.ts`), using the existing
validated mechanism on the hardened branch where applicable, per
"Phase 8A-3 Remediation Authorization — narration safety validation
gap, baseline f58918e." Baseline: `f58918e`.

## 1. Finding, restated

`docs/audit/PHASE_8A_1_RECONNAISSANCE.md` and
`docs/audit/PHASE_8A_2_REVIEW.md` established that `main` (`ce536bc`,
confirmed deployed to production) has no independent post-generation
narration safety validation on either the primary reading-composition
path (`responseComposer.ts`) or the follow-up-discussion path
(`discussionComposer.ts`). This document remediates **the branch this
session is authorized to change** — `claude/shams-phase-0-baseline-lnlmy6`
— which is not `main`; no merge or deployment is performed or
authorized here.

## 2. What was actually found on this branch — the central result of this remediation

**Both paths already have the control, fully wired, predating this
finding's discovery.** Reading both files in full:

- `functions/src/oracle/responseComposer.ts`'s
  `composeWatchOracleResponse()` calls `validateNarration()` twice
  (once for the persisted narration, once for the TTS-artifact join
  via `buildSpeakableText()`/`wrapAsAllNarrationFields()`) immediately
  after `narrate()` returns, and substitutes
  `buildDeterministicFallbackNarration()` on failure — labeled `PHASE
  4` and `PHASE 5H-R`/`5H-R2` in the file's own comments.
- `functions/src/oracle/discussionComposer.ts`'s
  `composeDiscussionReply()` calls
  `validateDiscussionReplyAgainstGroundings()` (which attributes the
  reply to the correct reading via `segmentReplyByGrounding()` and
  validates each attributed segment against its own `ReadingContract`)
  immediately before returning, and returns `null` on failure —
  labeled `PHASE 5F` and `PHASE 5F-R2`.

This is this audit chain's own earlier work (predating the window this
conversation's summary covers), not something this remediation phase
authored. Its existence is exactly what
`PHASE_8A_1_RECONNAISSANCE.md` §3 already described when characterizing
what was lost from `main`; this phase's job was to independently prove
— not merely read — that the wiring actually functions on this branch,
and to fix anything found broken or unproven.

## 3. Independent verification performed (not merely re-reading the code)

**3.1 Baseline test run** — the full narration/discussion-safety
suite, before any change:

```
narrationValidator.test.ts (37), narrationValidatorGroundTruth.test.ts (90),
narrationValidatorHardening.test.ts (32), narrationValidatorUnicodeSecurity.test.ts (88),
adversarialNarration.test.ts (16), discussionComposer.test.ts (11),
speakableTextValidation.test.ts (47), questionInNarration.test.ts (11),
discussionValidation.test.ts (23), discussionComparisonValidation.test.ts (29)
→ 384 tests, all green
```

**3.2 Mutation testing — `responseComposer.ts`.** Temporarily changed
`if (drafted !== null)` to `if (false && drafted !== null)` around the
`validateNarration()` call in `composeWatchOracleResponse()`, disabling
validation while leaving everything else unchanged. Ran
`speakableTextValidation.test.ts`: **5 of 47 tests failed** exactly as
expected (the tests asserting a fabricated/contradicted claim gets
replaced by the deterministic fallback). Restored the file exactly via
the pre-mutation backup; `git diff --stat` on the file empty afterward.
**Proves the wiring is real, not vacuous.**

**3.3 Mutation testing — `discussionComposer.ts`, corrected after an
initial false negative.** First attempt disabled the
`validateDiscussionReplyAgainstGroundings()` check
(`if (!validation.valid)` → `if (false && !validation.valid)`) and ran
only `discussionComposer.test.ts` — all 11 tests still passed, an
apparent false negative. Investigating why: `discussionComposer.test.ts`
itself only exercises `buildDiscussionBrief`, `flattenText`, and
`toApiMessages` — its own top-of-file comment says so explicitly,
pointing to `discussionValidation.test.ts` and
`discussionComparisonValidation.test.ts` for the validation-integration
coverage, which this remediation's first mutation-test pass missed
running. **Corrected by re-running the mutation against the actual
integration files**: `discussionValidation.test.ts` +
`discussionComparisonValidation.test.ts` → **2 of 52 tests failed**
exactly as expected (the two "integration: invalid output never
reaches the caller" tests). Restored the file exactly; `git diff
--stat` empty afterward. **Proves this wiring is real too — the
initial false negative was a methodology error in this remediation's
own first pass, corrected before drawing any conclusion from it, not a
defect in the code.**

## 4. The one defect actually found and fixed

`responseComposer.ts`'s `narrate()` function — the low-level API-call
helper, not the composer that validates its output — still carried the
comment: *"The system prompt guard is the primary defense; additional
post-generation validation was removed when the KP engine was deleted
(PR #92)."* **This was accurate when originally written** (describing
the state before Phase 4 restored validation), **but stale on this
branch since Phase 4 shipped**, and identical, word-for-word, to the
comment that is still accurate on `main` today. A comment this
misleading, sitting in the exact function a future reader would check
first, is precisely the kind of thing that produced the error corrected
in `docs/audit/PHASE_7B_REVIEW.md`'s dated addendum — a stale artifact
inviting the same misreading again. **Fixed**: replaced with a comment
stating plainly that `narrate()` itself does not validate, that
independent validation runs one call up in
`composeWatchOracleResponse()` (naming `narrationValidator.ts` and
`PHASE 4`), and cross-referencing this document and the addendum by
name so a future reader lands on the corrected record directly.

**This is the only production-code change this remediation makes.**
`discussionComposer.ts` required no code change — its wiring and its
comments were both already accurate.

## 5. Exact diff

```
$ git diff --stat
 functions/src/oracle/responseComposer.ts | 14 ++++++++++++--
 1 file changed, 12 insertions(+), 2 deletions(-)
```

One file, comment-only. No function signature, control flow, exported
type, or test file is touched.

## 6. Full regression matrix after the change

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **543/543** |
| `cd functions && npm run verify-engine-sync` | clean |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| App test suite | not re-run — no app file touched, unaffected by this change, already confirmed 306/306 at the last checkpoint that ran it (`a2e716d`/`3fa6fc9`) |

## 7. What this remediation does and does not establish

- **Establishes**: the hardened branch's own narration-safety
  architecture (engine judgment → oracle composition → independent
  output validation → UI/audio presentation) is genuinely, provably
  wired on both live paths — not merely present in source, but
  demonstrated via mutation testing to actually gate what a user
  receives. One stale, misleading comment is corrected.
- **Does not establish**: that `main` or production has this control.
  That remains false until a merge (not authorized by this document)
  and a subsequent deploy (also not authorized) happen, followed by
  the same kind of independent deployment-state verification Phase 7C
  §4 performed for the last merge.
- **Does not reopen or re-litigate** `PHASE_7B_REVIEW.md`'s corrected
  §4.4, `PHASE_8A_1_RECONNAISSANCE.md`, or `PHASE_8A_2_REVIEW.md` — this
  document's §4 comment fix is additive evidence for those, not a
  revision of them.
- **`selectRemedies.ts` remains out of scope**, per the authorization
  and `PHASE_8A_2_REVIEW.md` §4 — disconnected from any live client
  caller, not touched by this remediation.

## 8. Hard-stop determination

**No hard-stop condition was triggered.** The one defect found (a
stale comment) carries no security consequence on this branch — the
actual validation call it sits near was independently proven to
function correctly before the comment was even touched. The corrected
mutation-testing methodology (§3.3) is a process correction within this
remediation's own pass, not a newly discovered production defect.

## 9. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this remediation is written against: `f58918e` (7B
  Review Correction Addendum).
- Working tree: clean except the one file in §5, before this document
  is added.
- No Firestore-rule, CI-workflow, or dependency file is touched. No
  test file is added or modified — existing tests already proved the
  wiring; none needed changing to do so.

---

## Status

**PHASE 8A-3 REMEDIATION: COMPLETE.**

| Layer | Status |
|---|---|
| Phase 8A-1 Reconnaissance | ✅ Complete (`82b7c03`) |
| Phase 8A-2 Independent Review | ✅ PASS WITH SCOPE REFINEMENT (`773e2c4`) |
| 7B Correction Addendum | ✅ Complete (`f58918e`) |
| Phase 8A-3 Remediation | ✅ Complete (this document + the one-file diff) |
| `responseComposer.ts` wiring | ✅ Proven via mutation testing; stale comment fixed |
| `discussionComposer.ts` wiring | ✅ Proven via mutation testing (after correcting an initial methodology error); no code change needed |
| Phase 8A-4 Independent Review | 🔲 Not yet authorized |
| Phase 8A-5 Closure | 🔲 Not yet authorized |
| `main` / production | ❌ Still NOT READY — this remediation does not touch either |
| Phase 8A promotion sweep | ⏸️ Still paused |

Awaiting a separate, explicit authorization for the Phase 8A-4
Independent Review Gate on this remediation.
