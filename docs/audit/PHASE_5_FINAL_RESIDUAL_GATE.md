# Phase 5 — Final Residual Disposition Gate

A disposition and closure-readiness audit, not a hardening phase. Answers
one question: **after all work from 5A through 5I and 5F-R2, is there
any evidence-based reason Phase 5 cannot now legitimately close?**

No production code, test, or existing audit document was modified in
producing this file.

## 1. Starting state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- HEAD at the start of this gate: `5b44018` (Phase 5F-R2 formal closure).
- Working tree: clean.
- Controlling inventory: `docs/audit/PHASE_5_RESIDUAL_DISPOSITION.md`
  (commit `bf5198c`), 11 items.

## 2. Cross-check: every residual against its originating and
   subsequent records

| # | Residual | Origin | Disposition (`bf5198c`) | Re-verified this gate |
|---|---|---|---|---|
| 1a | P5A-1/3/8 (naming collision, dead field, stale comment) | 5A | ACCEPT | No later phase touched or reproduced any of these as more than P3. Confirmed unchanged. |
| 1b | P5A-4/5/6/7 (sanitizer asymmetry, Unicode keyword matching, rate-limit ordering, calendar-invalid date) | 5A | ACCEPT | Each still carries its own "not reachable"/"no live exploitation path" finding; the fresh 11,923-case harness run (§4) shows 0 false negatives, consistent with no live path having emerged since. |
| 1c | P5A-2 (dead AI `classifyQuestion` callable) | 5A | DEFER TO PHASE 6 | **Independently re-verified live** (§3): still exported from `functions/src/index.ts`, still unreferenced by any `src/` call site, untouched since `bf5198c` (`git diff --stat` empty for that file). Correctly categorized — no evidence of change. |
| 2 | 5B stale doc-comments (P5B-3) | 5B | ACCEPT | Documentation-only; no behavior claim to re-verify. Unchanged. |
| 3 | Repeated-character padding | 5D | ACCEPT | `textSecurity.ts` untouched since `bf5198c` (§4 prohibited-path diff). Fresh harness run: 0 false negatives — consistent with the accepted, self-limiting characterization. |
| 4 | Residual punctuation-insertion classes | 5D-R | ACCEPT | Same file, same evidence, unchanged. |
| 5 | Cyrillic→Armenian `n → ո` confusable | 5D-R | ACCEPT | Same file, same evidence, unchanged. |
| 6 | Comparison-reading validation boundary | 5F | was REMEDIATE BEFORE PHASE 5 CLOSURE | **CLOSED.** See §3 — independently re-verified as no longer an outstanding blocker. |
| 7 | Legacy readings skip discussion validation | 5F | ACCEPT | Independently re-verified (§3): `asReadingContract(d.readingContract)` still returns `null` for a legacy doc, still causes that grounding's segment to skip validation rather than fail, both for the anchor and (new since 5F-R2) any comparison reading — the same accepted precedent, now applied uniformly rather than narrowed or removed. |
| 8 | Nine-graha celestial-entity boundary (5G-1) | 5G | ACCEPT | `narrationValidator.ts` untouched since `bf5198c`. Unchanged. |
| 9 | Disclosed claim-surface coverage boundary | 5I | ACCEPT | `narrationValidator.ts` untouched since `bf5198c`. Unchanged. |
| 10 | Existing vs. rebuilt full-pipeline harness | 5I | ACCEPT | The same harness was re-run fresh for this gate (§4) — still the reused instrument, not rebuilt. Unchanged. |
| 11 | Prompt-injection vocabulary coverage boundary | 5I | ACCEPT | The structural proof this rests on (verdict frozen before narration) depends on `askWatchOracle.ts`/`responseComposer.ts` ordering, both untouched since `bf5198c`. Unchanged. |

**Result: 9 items remain ACCEPT, 1 item remains DEFER TO PHASE 6, and the
1 item that was REMEDIATE BEFORE PHASE 5 CLOSURE is now CLOSED.** No
item's classification changed as a result of this gate's own findings —
every ACCEPT/DEFER item was independently re-verified against live
source or a fresh regression run, not merely re-asserted from the prior
document.

## 3. Item 6 — independently re-verified as closed, not merely asserted

Beyond reading `PHASE_5F_R2_HARDENING.md`/`_REVIEW.md`/`_CLOSURE.md`,
this gate re-traced the live wiring directly from current source at
`5b44018`:

- `functions/src/functions/discussReading.ts:311` —
  `toGrounding()` attaches `contract: asReadingContract(d.readingContract)`
  for **every** document in `allDocs = [doc, ...compareDocs]` — anchor
  and every comparison reading alike, not only the anchor.
- `functions/src/oracle/discussionComposer.ts:611` — the real
  `composeDiscussionReply()` calls
  `validateDiscussionReplyAgainstGroundings(input.groundings, answer)`,
  not the old single-contract `validateDiscussionReply(input.contract,
  answer)` call the pre-5F-R2 code used (that top-level `contract` field
  no longer exists on `DiscussionInput` at all — confirmed by reading the
  current interface, not by trusting the hardening report's own claim).
- This is the production call path, not a test-only code path: the same
  `composeDiscussionReply()` function `discussReading.ts`'s exported
  Cloud Function calls directly.
- Fresh regression (§4): all 489 functions tests pass, including the 29
  in `discussionComparisonValidation.test.ts` and the 9 in
  `discussReading.test.ts` that exercise this wiring end to end (through
  `composeDiscussionReply()` itself, not only the internal validator
  call).

**Conclusion: the 5F-R2 fix genuinely covers comparison-reading
discussions in the live production code path. Item 6 is no longer an
outstanding Phase 5 blocker.**

## 4. Fresh regression matrix (re-run at this gate's own start, not
   restated from any prior document)

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **489/489**, 21 files |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm run test` (app root) | **306/306**, 27 suites |
| `node scripts/sync-engine.mjs --check` | clean |
| Golden corpus | **111/111**, untouched (`git diff --stat` empty) |
| Replay check | **24/24**, byte-identical |
| 11,923-case adversarial harness (scratch `--out-dir=docs/audit/phase-5-final-gate`) | **0** false negatives, **0** false positives, **0** exceptions, **0** contract mutations |
| Prohibited-path diff (`bf5198c..HEAD`, all ten paths **plus** `classifyQuestion.ts`, at once) | **empty** |

## 5. No phase accidentally reopened

Full changed-file diff, `bf5198c..HEAD`, outside `docs/audit/`:

```
functions/src/functions/__tests__/discussReading.test.ts   | new
functions/src/functions/discussReading.ts                  | modified
functions/src/oracle/__tests__/discussionComparisonValidation.test.ts | new
functions/src/oracle/__tests__/discussionComposer.test.ts  | modified (fixture shape only)
functions/src/oracle/__tests__/discussionValidation.test.ts| modified (fixture shape only)
functions/src/oracle/discussionComposer.ts                 | modified
```

Six files, all exactly the 5F-R2 authorization's own scope. Nothing under
`functions/src/engine/`, `src/astrology/`, `readingContract.ts`,
`remedySelection.ts`, `remedyLibrary.ts`, `textSecurity.ts`,
`narrationValidator.ts`, `functions/src/prompts/`, `firestore.rules`,
`docs/audit/golden-corpus/`, or `classifyQuestion.ts` changed. No file
belonging to the 5C-R/5D-R/5E chain/5F/5G/5H/5I closures was touched.
None of those phases is reopened by this gate or by anything it
reviewed.

Within `docs/audit/`, the only additions since `bf5198c` are 5F-R2's own
three documents (`_HARDENING.md`, `_REVIEW.md`, `_CLOSURE.md`) and its
evidence directory — exactly what each of those three phases' own
completion discipline authorized, no more.

## 6. Contradictions found between closure/review records

One genuine, but non-blocking, inconsistency:

**`PHASE_5H_CLOSURE.md`§2 and `PHASE_5I_CLOSURE.md`§4 both still list**
*"Discussion-reply validation covers only the anchor reading, not
`compareReadingIds` comparison readings (5F)"* **as a carried-forward
residual.** This was accurate when those two documents were written
(`528211c` and `571de00`, both before the Residual Disposition Gate
`bf5198c` even existed) but is now stale: 5F-R2 (`a33b183` /
`a1510f9` / `5b44018`) closed exactly this item. Read in isolation,
either document would misleadingly suggest the gap is still open.

This is a **documentation-currency issue, not a security or process
defect** — it does not misstate the *current* state of the running
system (§3 independently confirms the fix is live), and it does not
indicate any phase's own verdict was wrong at the time it was recorded.
Per this project's own established append-only audit convention (e.g.
`PHASE_5B_REPORT.md`'s dated addenda), the correct fix is a short, dated
addendum appended to `PHASE_5H_CLOSURE.md` and `PHASE_5I_CLOSURE.md`
noting the item was later resolved by 5F-R2 — not a rewrite of either
document's original text. This gate does not perform that edit itself:
its own deliverable is restricted to this one new file. It is recorded
here as a **closure prerequisite** (§8) rather than left undiscovered.

No other contradiction was found between the 5A–5I records, the residual
disposition, and the three 5F-R2 documents. Every regression figure,
commit reference, and disposition claim cross-checked in §2–§5 matches
its source exactly.

## 7. Hard-stop conditions — none triggered

- No P0/P1 issue found genuinely exploitable — the fresh full harness and
  test matrix (§4) both came back clean, and every ACCEPT item's
  no-live-exploitation basis was independently re-checked (§2), not
  re-asserted.
- No residual previously marked ACCEPT was found to be an active
  trust-boundary bypass.
- No contradictory *closure evidence* was found — only the stale residual
  listing in §6, which is a currency issue, not a conflicting claim about
  system behavior.
- No production path was found that bypasses a control the Phase 5
  records claim exists — item 6's fix was traced in live source, not
  taken on faith (§3).
- The 5F-R2 fix was independently confirmed to cover comparison-reading
  discussions in the actual production call path, not merely in
  isolated helper functions.
- No finding here would make a Phase 5 closure claim materially
  misleading, provided the §6 documentation-currency item is addressed
  as part of the closure evidence (§8) rather than silently left as is.

## 8. Minimum evidence required for `PHASE_5_CLOSURE.md`

When separately authorized, the closure document should include, at
minimum:

1. A consolidated 5A→5I→5F-R2 chain table (mirroring this gate's §2 and
   the summary table already in `PHASE_5_RESIDUAL_DISPOSITION.md`),
   restating each item's **final, current** disposition — not a copy of
   the `bf5198c` table, since item 6 has since changed.
2. A short, dated addendum on `PHASE_5H_CLOSURE.md` and
   `PHASE_5I_CLOSURE.md` (or an equivalent note carried in the closure
   document itself, cross-referenced from both) resolving the §6
   documentation-currency item, so no reader of either document is
   misled about the comparison-reading boundary's current status.
3. A fresh, full regression matrix run at the exact commit
   `PHASE_5_CLOSURE.md` is written against (functions/app tests,
   typecheck, lint, mirror sync, golden corpus, replay, adversarial
   harness) — not restated from this gate, since this gate is not the
   closure commit itself.
4. A prohibited-path diff spanning the entire Phase 5 program (from the
   Phase 5C/5C-R starting point through the closure commit), consolidating
   what every individual phase already proved piecewise.
5. An explicit statement of Phase 5's own scope boundary — the
   oracle/narration/discussion adversarial-integrity layer — and an
   explicit statement that Phase 5 closure is **not** a claim of overall
   production readiness (Firebase/Functions infrastructure, App Check,
   auth, Firestore rules at the deployment level, quotas, idempotency,
   payment flows, staging deployment, Android release path — all
   Phase 6's stated objective, untouched and unverified by Phase 5).
6. An explicit list of every item DEFERRED TO PHASE 6 (currently: P5A-2,
   the dead `classifyQuestion` callable) so Phase 6's own scoping starts
   from a known, carried-forward list rather than rediscovering it.
7. An explicit statement that `PHASE_5_CLOSURE.md` does not itself
   authorize Phase 6 — that remains its own, separately issued
   authorization, per the standing discipline this entire chain has held
   to.

The audit-trail backfill items identified earlier (missing 5B closure
record, missing 5C-R dedicated review, missing 5D-R closure record)
remain a separate, optional documentation-completeness bucket — this
gate does not treat them as a closure prerequisite, consistent with how
`PHASE_5_RESIDUAL_DISPOSITION.md` itself scoped them out of dispositioning.

## 9. Final assessment

**Phase 5 is closure-ready**, contingent only on the minimum evidence
in §8 being assembled into the closure document itself (principally item
2 — the stale residual listing — since items 1 and 3–7 are largely a
matter of consolidating evidence this gate and its predecessors have
already produced, not new investigation). No P0/P1 defect, no active
trust-boundary bypass, no reopened phase, and no unresolved
REMEDIATE-classified residual remain. The one item that was blocking
closure (item 6) is independently confirmed closed, in the live
production code path, not merely on paper.

This gate does not create `PHASE_5_CLOSURE.md` and does not authorize
Phase 6. Both remain separate, narrowly scoped authorizations, to be
issued at your discretion.
