# Phase 4A — Surgical Validator Hardening

**Date:** 2026-09-08
**Scope:** fix the concrete defects demonstrated in
`docs/audit/PHASE_4_REVIEW_GATE.md` (P1 timing bypass, P2 certainty/
terminology/celestial findings, and one stale comment) with the smallest
possible change to `narrationValidator.ts`. No redesign, no second timing
engine, no new validator authority, no engine/prompt/contract changes.

---

## 1. Exact files changed

| File | Nature of change |
|---|---|
| `functions/src/oracle/narrationValidator.ts` | Timing immediacy tiers + hedge detection; month/date detection fix; certainty phrase additions; RKP obfuscation regex. All additive within existing functions — no function signature changed, no `CHECKS` orchestration touched. |
| `functions/src/functions/askWatchOracle.ts` | One stale comment corrected. Zero behavior change. |
| `functions/src/oracle/__tests__/narrationValidatorHardening.test.ts` | **New.** 32 permanent regression tests covering the required matrix. |
| `functions/src/oracle/__tests__/fixtures/adversarial-narration/timing-immediacy-bypass.json` | **New.** Additive fixture. |
| `functions/src/oracle/__tests__/fixtures/adversarial-narration/certainty-word-order.json` | **New.** Additive fixture. |
| `functions/src/oracle/__tests__/fixtures/adversarial-narration/terminology-obfuscation.json` | **New.** Additive fixture. |
| `docs/audit/PHASE_4_REVIEW_GATE.md` | Appended addendum section (2026-09-08). Existing content untouched. |
| `docs/audit/PHASE_4A_HARDENING.md` | **New** (this file). |

Nothing else changed. Confirmed via `git status --porcelain` and
`git diff --stat` against every engine/prompt/contract/app path — see
§6 below.

---

## 2. Exact validation changes

### 2a. Timing — the "tomorrow" bypass (P1)

`IMMEDIACY_SIGNALS` (one flat list, unconditionally flagged on
WAIT/WAIT_LONG) is now two lists:

- `STRONG_IMMEDIACY_SIGNALS` — `immediately`, `immediate resolution`,
  `right now`, `right away`, `today`, `tomorrow`, `this instant`,
  `this week`, `without delay`. Flagged unconditionally, same as before,
  just a longer list. These are minimum-necessary additions named
  directly in the Phase 4A brief — not every temporal word in English.
- `SOFT_IMMEDIACY_SIGNALS` — `soon`, `shortly`. Flagged only when the
  sentence containing the hit (via the pre-existing
  `findSentenceContaining()` helper) does not also contain one of
  `HEDGE_QUALIFIERS` (`may`, `might`, `could`, `possibly`, `perhaps`).

This distinguishes "This will resolve soon." (unhedged, rejected) from
"The matter may begin moving soon, but the final outcome remains within
the indicated period." (hedged, accepted) — the exact pair the Phase 4A
brief itself used to define "do not overreject."

### 2b. Timing — exact-date detection false positive (self-discovered)

While verifying 2a against the brief's own required-accept sentence
"Movement may begin before the final outcome," the original bare-word
`MONTH_NAMES.find(m => lower.includes(m))` check flagged it as
`TIMING_FABRICATION`, because "may" (the modal verb) is also "May" (the
month). This was not one of the review gate's reported findings — it
surfaced only while proving the fix satisfies the required matrix.

Fixed by replacing the bare substring check with `MONTH_DATE_PATTERN`, a
regex requiring a month name to be adjacent (only whitespace/comma/
optional "of" between) to a 1-2 digit day number:

```
\b(month)\b[\s,]*\d{1,2}(st|nd|rd|th)?\b|\b\d{1,2}(st|nd|rd|th)?[\s,]*(of\s+)?\b(month)\b
```

A bare month mention with no adjacent day number ("Since September the
matter has waited.") is no longer flagged — correctly, since it names no
specific day either.

### 2c. Certainty ordering (P2)

`CERTAINTY_PHRASES` gained three literal entries: `will definitely`,
`will certainly`, `certainly will` — alongside the pre-existing
`definitely will`, `absolutely will`, `guaranteed`, etc. No
normalization, no word-order-agnostic matcher — three strings added to
an existing flat array.

### 2d. RKP terminology obfuscation (P2)

One new regex, applied after the existing `scanForDenyList` call inside
`checkTerminologyLeakage`:

```ts
const RKP_OBFUSCATED_PATTERN = /r[\s.\-_]+k[\s.\-_]+p\b/i;
```

Deliberately scoped to "RKP" only.

### 2e. Celestial transliteration (P2) — investigated, not changed

See §4 (false-negative analysis) and the Review Gate addendum §10 for the
full reasoning. No alias added; no repository evidence supports one.

### 2f. Stale comment

`askWatchOracle.ts`'s comment claiming a
`readings/{readingId}/validationLog` Firestore subcollection was rewritten
to describe the actual mechanism (`logger.warn()` in
`responseComposer.ts`). No `validationLog` collection was created — the
Phase 4A brief explicitly forbade inventing one just because the old
comment mentioned it.

---

## 3. Rationale

Every change follows the brief's "smallest safe fix" instruction:

- Timing: two-tier signal list + sentence-scoped hedge check, reusing an
  existing helper (`findSentenceContaining`) rather than adding new
  machinery. No second timing engine — every check still reads only
  `contract.diagnosis.timing`/`timingPosture`, unchanged fields.
- Certainty: three literal string additions to an existing array.
- Terminology: one regex, scoped to the single demonstrated bypass term
  ("RKP"), explicitly not generalized to "KP" or the rest of the deny
  list — reasoned in the code comment and re-verified below.
- Celestial: no code change — the repository has no evidence for an
  alternate spelling, and inventing one would violate the brief's own
  "do not invent aliases" instruction.

---

## 4. False-positive analysis

Each fix was tested against a case constructed specifically to try to
break it:

- **Timing:** the brief's own hedged-"soon" sentence, and the
  "Movement may begin..." sentence, both verified to return `null` (no
  false reject). The "since September" bare-month sentence, with no day
  number, verified to return `null`.
- **Certainty:** `may`, `likely`, and an open conditional sentence
  ("It could go either way, depending on effort.") all verified to
  return `null` — none of these are in `CERTAINTY_PHRASES` and the
  additions did not introduce any substring collision with them.
- **Terminology:** "Her keen partner waits with patience." — a sentence
  constructed to place "r", "k", and "p" as the first letters of three
  consecutive words, the closest plausible collision shape for a
  separator-tolerant "r...k...p" pattern — verified to return `null`.
  The regex requires each letter to be followed by *only*
  whitespace/punctuation before the next target letter; "her keen
  partner" has intervening letters ("er", "een", "artner") that break
  the match. General prose with no near-RKP letter sequence also
  verified clean.
- **Celestial:** no code changed, so no new false-positive surface was
  introduced.

---

## 5. False-negative analysis

- **Timing:** the two-tier split still catches every case the brief's
  must-reject matrix specifies: tomorrow, today, this week, immediate
  resolution, right away, unhedged soon, unhedged shortly. Exact-date
  fabrication (numeric `9/19`, ISO `2026-09-19`, `September 19`, `19th of
  May`, `next Monday`) all still caught — re-verified after the
  `MONTH_DATE_PATTERN` change, since that was the one part of this check
  most at risk of accidentally narrowing coverage. The relative-date case
  ("in 3 days") is still caught via the pre-existing day-count/range
  check, unrelated to the calendar-date detection this phase touched.
- **Certainty:** `will definitely`/`will certainly`/`certainly will` now
  caught alongside the pre-existing orderings; no new gap identified in
  this pass (word order was the one demonstrated gap).
- **Terminology:** `RKP`, `R.K.P.`, `r.k.p.`, `R-K-P`, `R K P` all now
  caught. `KP` alone remains uncaught by design (see §2d) — an accepted,
  documented gap, not an oversight: "KP" is deleted-methodology
  terminology from a system this brief does not authorize expanding
  detection for, and a separator-tolerant 2-letter pattern would trade a
  narrow true-positive gain for a much larger false-positive surface on
  ordinary English prose.
- **Celestial:** `Zohal` (and any other unattested transliteration)
  remains uncaught by the validator. Documented, not fixed, per §2e/§4
  reasoning above. The prompt-level instruction to use only the given
  name is the standing mitigation.

---

## 6. Regression evidence

All of the following were re-run after the code changes above, in this
session:

- `functions`: `npx tsc --noEmit` → clean.
- `functions`: `npx vitest run` → **189/189 passed**
  (14 test files: the pre-existing 154 plus 32 new in
  `narrationValidatorHardening.test.ts`; `adversarialNarration.test.ts`
  now 16/16 with the 3 new fixtures included, corpus-count assertion
  (`>= 10`) still passes).
- `functions`: `npm run lint` (`tsc --noEmit && eslint . --max-warnings=0`)
  → clean (one prettier-formatting pass applied via `eslint --fix` to the
  new test file before this final run; no logic changed by that fix).
- App root: `npm run typecheck` → clean.
- App root: `npm run lint` → clean.
- App root: `npm run test` (Jest) → **304/304 passed**, 27 suites.
- Golden corpus: `npx vite-node functions/scripts/generate-golden-corpus.ts`
  re-run and diffed byte-for-byte (`diff -rq`) against a pre-run backup
  → **111/111 identical**, corpus directory untouched by this session.
- Replay check: `npx vite-node functions/scripts/replay-check.ts` →
  **24/24 `identical: true`**, 0 `identical: false` — no nondeterminism
  introduced.
- `git status --porcelain` at the repository root, and `git diff --stat`
  scoped individually to `functions/src/engine/`,
  `functions/src/engine/rkp/watchJudgment.ts`,
  `functions/src/engine/rkp/diagnosis.ts`,
  `functions/src/oracle/remedySelection.ts`, `functions/src/prompts/`,
  `functions/src/oracle/readingContract.ts`,
  `functions/src/oracle/responseComposer.ts`, and `src/` — **every one
  empty**. The only modified files are the two listed in §1; everything
  else is new, additive test/fixture/doc content.

---

## Conclusion

All 16 acceptance criteria from the Phase 4A brief are met:

1. "Tomorrow" on a WAIT (45-90 day) contract now rejected. ✅
2. Other materially accelerated timing claims (today, this week, right
   away, immediate resolution, unhedged soon/shortly) rejected. ✅
3. Legitimate hedged/delayed timing prose still accepted. ✅
4. Certainty ordering ("will definitely" etc.) now covered. ✅
5. "R.K.P." (and other separator variants) can no longer bypass
   terminology detection. ✅
6. Zohal/celestial transliteration bypass addressed safely — investigated,
   documented, deliberately not aliased without repository evidence, per
   explicit instruction. ✅
7. All previously-passing validator tests still pass (37/37 original +
   13/13 original adversarial, unchanged). ✅
8. `functions` test suite passes (189/189). ✅
9. App test suite passes (304/304). ✅
10. `functions` typecheck passes. ✅
11. App typecheck passes. ✅
12. `functions` lint passes. ✅
13. App lint passes. ✅
14. Golden corpus 111/111, unmodified. ✅
15. Replay check 24/24. ✅
16. Zero engine/judgment/diagnosis/remedy/prompt/contract/app changes;
    zero new AI calls; zero second validator authority introduced —
    every change is inside `narrationValidator.ts`'s existing check
    functions or a comment-only edit. ✅

**PHASE 4A: PASS**
