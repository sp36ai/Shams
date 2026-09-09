# Phase 8A-4 — Independent Review Gate: Narration Safety Validation Remediation

Independent verification of `docs/audit/PHASE_8A_3_REMEDIATION.md` and
its diff (`c65d7fb`). Baseline: `c65d7fb`. **Read-only in outcome — the
review's own mutation-testing pass modified two files temporarily and
restored both exactly; no repository file is left modified by this
review.**

## 1. Scope, as authorized

Independently verify: (1) both live narration paths and their
post-generation validation; (2) the mutation-test evidence, including
the corrected `discussionComposer` test selection; (3) the one
production-code comment change; (4) full functions regression and
relevant integration coverage; (5) no unintended changes to `main`,
dependencies, Firebase rules, CI, or unrelated production code; (6)
that the P1 finding is genuinely remediated on the branch, with no
claim about production until promotion/deployment is separately
verified. No closure, merge, deployment, or Phase 8A promotion work is
performed by this review.

## 2. Diff scope — independently re-derived, not accepted from the remediation doc

```
$ git diff --name-only f58918e..c65d7fb
docs/audit/PHASE_8A_3_REMEDIATION.md
functions/src/oracle/responseComposer.ts
```

**Confirmed: exactly two files.** No dependency manifest
(`package.json`/`package-lock.json`), no `firestore.rules`, no
`.github/workflows/` file, and no other production-code file appears
anywhere in this range. The code diff itself, read directly (not
trusted from the remediation doc's own quotation):

```diff
-    // The system prompt guard is the primary defense; additional post-generation
-    // validation was removed when the KP engine was deleted (PR #92).
+    // narrate() only fetches and shapes the model's draft — it does not
+    // decide whether to trust it. The system prompt guard is the first
+    // line of defense; independent, deterministic post-generation
+    // validation runs one call up, in composeWatchOracleResponse() (PHASE
+    // 4, see narrationValidator.ts), against every field this function
+    // returns. ...
     return drafted;
```

**Confirmed comment-only.** No control-flow token, function signature,
export, or type changed. `discussionComposer.ts` has zero diff in this
range, matching the remediation's own claim that it needed no code
change.

## 3. Independent re-confirmation of the wiring — read directly, not grepped from the doc's claims

```
$ grep -n "validateNarration(\|const drafted = await narrate\|let narration" functions/src/oracle/responseComposer.ts
449:  const drafted = await narrate(narrationContext);
456:  let narration: NarrationFields | null = drafted;
458:    const result = validateNarration(contract, drafted);
467:    const speakableResult = validateNarration(...)

$ grep -n "validateDiscussionReplyAgainstGroundings(\|return null\|return {" functions/src/oracle/discussionComposer.ts
611:    const validation = validateDiscussionReplyAgainstGroundings(input.groundings, answer);
616:      return null;
619:    return { ... }
```

Traced every return path in both functions by hand: `narrate()` has
exactly one success path (line 449's caller), unconditionally validated
before `narration` is finalized; `composeDiscussionReply()`'s other
`return null`s (lines 544, 549, 588, 600) are all pre-generation
failure modes (no API key, empty message list, HTTP error, missing
`answer` field) — none of them bypasses the validation call at line 611
on the one path that actually returns a reply. **Confirmed: no
unvalidated success path exists in either function.**

## 4. Independent mutation testing — a different technique from the remediation's own pass, run against the full relevant suite at once

Rather than reproducing the remediation's exact mutations
(`if (drafted !== null)` → `if (false && ...)` and the analogous change
in `discussionComposer.ts`), this review mutated the **outer guard
clause** in each file instead — `if (!result.valid || !speakableResult.valid)`
→ `if ((!result.valid || !speakableResult.valid) && false)` in
`responseComposer.ts`, and `if (!validation.valid)` →
`if (!validation.valid && false)` in `discussionComposer.ts` — applied
**simultaneously to both files**, then ran the full relevant suite in
one pass rather than per-file:

```
$ npx vitest run speakableTextValidation.test.ts discussionComposer.test.ts \
    discussionValidation.test.ts discussionComparisonValidation.test.ts \
    questionInNarration.test.ts

Test Files  3 failed | 2 passed (5)
     Tests  7 failed | 114 passed (121)
```

- **5 failures in `speakableTextValidation.test.ts`** — matches the
  remediation's own reported count for `responseComposer.ts`.
- **2 failures**, split across `discussionValidation.test.ts` and
  `discussionComparisonValidation.test.ts` — matches the remediation's
  own reported count for `discussionComposer.ts`.
- **Zero failures in `discussionComposer.test.ts` and
  `questionInNarration.test.ts`** — independently confirms the
  remediation's own diagnosis of its initial false negative: these two
  files genuinely do not exercise the validation-integration path (the
  first tests brief-construction/transcript-folding helpers only, the
  second tests prompt-injection defense on the input side), so a
  reviewer or implementer who runs only these two would wrongly
  conclude the control is unwired. **This independently corroborates,
  rather than merely accepts, the remediation doc's account of its own
  corrected methodology.**

Both files were then restored from a pre-mutation backup and confirmed
byte-identical via `git diff --stat` (empty).

## 5. Full regression matrix — re-executed fresh by this review, not accepted from the document

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` (full suite) | **543/543** |
| `cd functions && npm run verify-engine-sync` | clean |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |

All figures match `PHASE_8A_3_REMEDIATION.md` §6 exactly, independently
reproduced rather than accepted. App test suite not re-run, matching
the remediation's own stated reasoning: no app file is in the diff, and
it was last confirmed 306/306 at `3fa6fc9`.

## 6. `main` and unintended-scope check — independently re-derived

```
$ git fetch origin main --quiet && git log origin/main -1 --oneline
ce536bc Force Cloud Functions redeploy to verify mystical Oracle prompt deployment
$ git merge-base --is-ancestor HEAD origin/main
NO
$ git rev-list --count origin/main..HEAD   → 88
$ git rev-list --count HEAD..origin/main   → 0
```

`main` is unchanged and still not merged with — confirmed directly, not
assumed. Combined with §2's diff-scope check, there is no path by which
this remediation could have touched `main`, dependencies, Firebase
rules, or CI: the entire diff since the pre-remediation checkpoint
(`f58918e`) is the two files already enumerated.

## 7. Verdict on "genuinely remediated on the branch, no claim about production"

**Confirmed, precisely bounded**: the P1 finding
(`docs/audit/PHASE_8A_1_RECONNAISSANCE.md`,
`docs/audit/PHASE_8A_2_REVIEW.md`) — independent post-generation
narration safety validation missing on both live composer paths — is
**genuinely remediated on `claude/shams-phase-0-baseline-lnlmy6`**,
proven by this review's own independently-executed mutation testing
using a different technique than the remediation's own, not merely by
re-reading source or accepting the remediation document's claims. This
finding makes **no claim whatsoever about `main` or deployed
production** — both remain exactly as `docs/audit/PHASE_7C_FINAL_DECISION.md`
and `docs/audit/PHASE_8A_1_RECONNAISSANCE.md` described them: `main`
has neither `safetyValidator.ts` nor `narrationValidator.ts`, Cloud
Functions remain deployed at `ce536bc`, and nothing in this review
changes that. Production readiness for this specific control requires
a separately authorized merge and a separately verified deployment,
exactly as `PHASE_8A_3_REMEDIATION.md` §7 itself already stated.

## 8. Hard-stop determination

**No hard-stop condition was triggered.** No new defect was found in
this review; the one thing this review's independent pass adds beyond
re-confirming the remediation's own claims is corroborating, via a
different mutation technique than the remediation used, that its
account of its own initial false-negative methodology error was
accurate rather than self-flattering — an audit-integrity check this
review considered important given that exact kind of error is what
produced the `PHASE_7B_REVIEW.md` correction this whole chain is
downstream of.

## 9. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this review is written against: `c65d7fb` (Phase 8A-3
  Remediation).
- Working tree: clean before and after this document — the review's own
  mutation-testing pass modified two files temporarily and restored
  both exactly, confirmed via `git diff --stat` before writing this
  document.
- No production, test, Firestore-rule, CI-workflow, or
  deployment-configuration file is touched by this review — the only
  file this phase adds is this document.
- No implementation, closure, merge, or deployment occurred.

---

## Status

**PHASE 8A-4 INDEPENDENT REVIEW GATE: ✅ PASS.**

| Layer | Status |
|---|---|
| Phase 8A-3 Remediation | ✅ Complete, independently confirmed (`c65d7fb`) |
| Phase 8A-4 Independent Review | ✅ PASS (this document) |
| P1 finding, on this branch | ✅ Genuinely remediated, independently proven |
| P1 finding, on `main`/production | 🔴 Still open — untouched, unclaimed by this review |
| Phase 8A-5 Closure | 🔲 Not yet authorized |
| `main` | ❌ Unchanged (`ce536bc`), still unmerged (88 ahead, 0 behind) |
| Phase 8A promotion sweep | ⏸️ Still paused |
| Production | ❌ NOT READY |

Awaiting a separate, explicit authorization for Phase 8A-5 Closure,
and, separately, whenever the owner is ready, resumption of the paused
Phase 8A promotion-reconnaissance sweep.
