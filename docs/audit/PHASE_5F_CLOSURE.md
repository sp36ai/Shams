# Phase 5F — Formal Closure Record

This is a documentation-only closure. No production code, test, or engine
file is modified by this record. It closes the Phase 5F chain
(reconnaissance → implementation → independent review) on the strength of
the clean `PHASE 5F REVIEW: PASS` recorded in `docs/audit/PHASE_5F_REVIEW.md`
(`f263745`) — there is no remediation round to fold in, unlike the 5E
chain, because the review found no findings.

Chain checkpoint:

| Commit | Stage |
|---|---|
| `f84f97d` | Phase 5F reconnaissance |
| `8eb8d45` | Phase 5F implementation |
| `f263745` | Phase 5F independent review — PASS |
| (this commit) | Phase 5F formal closure |

---

## Invariant re-verification, at the current HEAD

Re-run independently as part of closure, not merely restated from the
review:

| Invariant | Verified |
|---|---|
| `ReadingContract` remains authoritative and server-side | `readingContract` field exists only on `ReadingDoc` (server type), is never spread into `askWatchOracle`'s client-facing `response`, and `discussReading`'s `DiscussReadingResponse` carries no contract-shaped field |
| No client-supplied contract can enter the discussion path | `DiscussReadingSchema` remains `.strict()` at every level (outer object and each `turns[]` entry); a forged `contract`/`verdict`/`judgment`/`readingContract` field is rejected by Zod before the handler runs |
| `validateNarration()` remains the single deterministic validator | no second validator exists; `validateDiscussionReply()` is a thin wrapper that calls it unmodified |
| `textSecurity.ts` remains unchanged | empty diff, `8eb8d45..HEAD` |
| Engine/judgment computation remains untouched | empty diff, `functions/src/engine/`, `8eb8d45..HEAD`; no engine/judgment function is called anywhere in the discussion path |
| `kp/` remains untouched | empty diff (no `kp/` changes under `functions/src/engine/`) |
| Existing 5C-R/5D-R protections remain intact | `narrationValidator.ts` and `textSecurity.ts` both empty-diffed; this review's own confusable-substitution and mid-word-punctuation probes against the discussion surface were correctly caught |
| Golden corpus remains byte-identical | `git diff --stat 8eb8d45..HEAD -- docs/audit/golden-corpus/` empty; 111 case files present, untouched |
| Replay remains 24/24 | `npx vite-node functions/scripts/replay-check.ts` → all 24 cases byte-identical across two in-process invocations |
| Functions remain 390/390 | `npx vitest run` (functions) → 390 passed, 390 total, 17 files |
| App remains 304/304 | `npm run test` (app) → 304 passed, 304 total, 27 suites |
| Mirror sync clean | `node scripts/sync-engine.mjs --check` → "functions/src/engine/ matches src/astrology/" |
| Typecheck/lint clean, both sides | `npx tsc --noEmit` (functions), `npm run lint` (functions), `npm run typecheck` (app), `npm run lint` (app) — all clean |
| Working tree clean before this commit | `git status --porcelain` empty |

All thirteen invariants hold at the current HEAD. No drift since the
review commit `f263745`.

---

## Scope closed

Phase 5F closes Finding F1 from `docs/audit/PHASE_5F_RECONNAISSANCE.md`
(P0: the discussion-reply surface had zero deterministic content
validation) by extending `validateNarration()`'s existing, unmodified
check pipeline to discussion replies via `validateDiscussionReply()` /
`wrapReplyAsNarrationFields()`, backed by a newly-persisted, server-only
`ReadingContract` per reading.

## Accepted, documented residuals carried forward (not reopened by this closure)

- Only the anchor reading (`groundings[0]`) is validated; comparison
  readings (`compareReadingIds`) are not — an explicit, documented scope
  boundary from `PHASE_5F_HARDENING.md`, not a gap discovered here.
- Legacy readings cast before Phase 5F shipped have no persisted
  `readingContract` and skip discussion validation — pre-existing
  behavior (they had zero validation before this phase either), not a
  regression, and not silently migrated (confirmed: no code path writes
  `readingContract` outside `askWatchOracle.ts`'s single cast-time write).
- The six residuals accepted at Phase 5E's own closure
  (`docs/audit/PHASE_5E_R4_HARDENING.md` / the 5E closure record) remain
  untouched and out of scope for this phase; nothing in the 5F diff
  touches the files or checks those residuals concern.
- The ground-truth checks' bounded, phrase-anchored detection shape
  (established across the 5E chain) applies identically to discussion
  replies as to primary narration — not a general semantic-claim
  detector on either surface. This review's fresh adversarial battery
  (§7 of `PHASE_5F_REVIEW.md`) deliberately targeted the documented
  anchors and found no gap within that boundary.

No new finding was raised at any point in the 5F chain's review that
required remediation.

---

## Status

**PHASE 5F: CLOSED.**

This closure record does not authorize or begin any Phase 5G work. Phase
5G remains frozen pending separate, explicit authorization.
