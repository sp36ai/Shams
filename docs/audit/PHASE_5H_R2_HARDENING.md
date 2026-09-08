# Phase 5H-R2 — TTS Seam-Boundary Remediation

Closes Finding 5H-R-Review-1 only (`docs/audit/PHASE_5H_R_REVIEW.md`).
Implementation checkpoint against `523c592` (Phase 5H-R independent
review — FAIL).

## 1. Starting checkpoint

- Repository: `sp36ai/shams`.
- Branch: `claude/shams-phase-0-baseline-lnlmy6`.
- HEAD at start: `523c592`, confirmed via `git rev-parse HEAD`.
- Working tree: clean.
- Baseline, independently re-run before any code was touched: functions
  406/406, app 306/306, both typecheck/lint clean, mirror sync clean,
  golden corpus 111/111 untouched, replay 24/24, prohibited-path diff
  empty.

## 2. Exact P1 reproduction (before this remediation)

Reproduced fresh, using the pre-fix `buildSpeakableText()` (the `'. '`
join) against a real engine-backed contract (`marriage`-equivalent
fixture): a fabricated house claim split across the
`rkp_finding`/`interpretation` boundary
(`rkp_finding: "Consider this: house number 3"`,
`interpretation: "governs this matter above all else in the chart."`)
passed both per-field validation and the Phase 5H-R TTS-artifact check
unrejected — `composition.narration` and `composition.speakableText`
were the raw, fabricated text. Reproduced identically for all six claim
families named in the finding (house, supporting-house, sign, direction,
retrograde, ruler-relation), each against its own real contract and
fresh wording, before any production code was modified.

## 3. Discriminator design

**Root cause, precisely stated.** `buildSpeakableText()`'s join
inserted a literal `'. '` between every field, *regardless of what the
field's own text already ended with*. Six of `narrationValidator.ts`'s
ground-truth checks (`checkHouseClaims`, `checkSupportingHouseClaims`,
`checkSignClaims`, `checkDirectionClaims`, `checkRetrogradeClaims`,
`checkRulerRelationClaims`) require their anchor phrase and the claimed
value to appear in the same "sentence," using `findSentenceContaining()`,
which bounds a sentence strictly by the nearest literal `.` characters.
The join's own inserted period is indistinguishable, to that function,
from a period the model itself wrote — so it manufactured a sentence
boundary exactly where an attacker (or ordinary unlucky phrasing) could
place a claim's anchor on one side and its value on the other, evading
detection regardless of wording.

**Chosen fix.** Change `buildSpeakableText()`'s separator from `'. '` to
a single space `' '` — never inserting a sentence-terminating character
the field's own text did not already contain. Two fields that already
end in genuine terminal punctuation (the overwhelmingly common case —
Claude drafts each field as a complete sentence) still read as two
separate sentences after the join, completely unchanged from before,
because the punctuation was already there. Two fields where the first
ends mid-thought — the split-claim attack shape — now correctly read as
ONE continuous run of text, because nothing artificial separates them,
which is exactly how a listener perceives spoken TTS prose with no hard
pause inserted, and exactly what lets `findSentenceContaining()` see the
whole claim as one sentence, closing the gap with no change to
`narrationValidator.ts` itself.

**Why not other options considered:**
- *Use a different separator for validation than for speech* (e.g.
  validate a differently-joined string but speak the `'. '`-joined one):
  rejected outright — this would break the artifact-identity invariant
  Phase 5H-R and its own review established (`validatedTtsText ===
  exactArgumentPassedToTtsSpeak`), reintroducing exactly the "validated
  something different from what's spoken" class of defect this whole
  chain exists to prevent.
- *Modify `narrationValidator.ts`'s sentence-scoping* (e.g. make
  `findSentenceContaining` seam-aware): explicitly prohibited for this
  phase, and would touch the one file every phase since 5C-R has kept
  deliberately stable.
- *Detect and reject any split claim generically*: would require
  semantic understanding of what constitutes "a claim," which is exactly
  the kind of general-purpose interpretation this codebase's own
  established discipline (documented repeatedly across the 5D-R/5E
  chain) has consistently avoided in favor of narrow, evidence-driven
  fixes.

## 4. Pre-implementation verification

Before modifying `responseComposer.ts`, the candidate discriminator
(`.join(' ')` in place of `.join('. ')`) was tested as a standalone
function against `validateNarration()` directly — no production code
changed yet:

- All six seam-bypass classes (house, direction, retrograde,
  ruler-relation, sign, supporting-house), split at the exact same
  boundary as their original reproductions: all now correctly rejected.
- Genuine multi-field narration (each field independently
  period-terminated): correctly accepted, unchanged.
- A genuine, contract-true claim split at the identical boundary:
  correctly accepted (no over-tightening).
- **Adjacency false-positive risk, tested explicitly**: an unrelated
  number with no trailing punctuation immediately before a genuine,
  unrelated true claim in the next field (e.g. "...about 3" + "months,
  and house number 7 governs this matter..."). Concern: joining without
  a period could merge an incidental nearby number into the same
  "sentence" as an unrelated claim's own number extraction. Verified
  this does **not** occur: `extractHouseNumbers()` (and the equivalent
  extraction/matching in each of the other five checks) is itself
  bounded to claim-shaped phrasing (e.g. "house number N"), not bare
  digits — an incidental "3" in "about 3 months" is never extracted at
  all, regardless of what sentence it shares with a real claim.

Only after all of the above passed was `responseComposer.ts` modified.

## 5. Implementation files

- `functions/src/oracle/responseComposer.ts` — `buildSpeakableText()`'s
  separator changed from `.join('. ')` to `.join(' ')`; its own doc
  comment, and `WatchOracleComposition.speakableText`'s doc comment,
  updated to explain why. No other line in this file was touched beyond
  these comments and the one-character separator change.
- `functions/src/oracle/__tests__/speakableTextValidation.test.ts` —
  section A's byte-exact expectations updated for the new separator (the
  old `'. '`-based expectations were themselves testing the vulnerable
  behavior); one new case added confirming genuine terminal punctuation
  still produces two sentences, not a run-on; a new section D (24 tests:
  all six claim families × {split-fabricated, unsplit-fabricated,
  split-genuine, unsplit-genuine}); a new section E (6 tests: existing
  5C-R/5D-R mechanisms re-run through the fixed artifact, plus the
  adjacency false-positive control).

No other file needed to change. `ChatBubble.tsx` — confirmed by an empty
diff — required no modification at all: it already relayed
`oracle.speakableText` verbatim (Phase 5H-R's own architecture), so a
change to what string is *computed and validated* server-side requires
no client-side change whatsoever. The artifact-identity property Phase
5H-R's own review proved (§4 of `PHASE_5H_R_REVIEW.md`) is therefore
untouched by this phase and continues to hold by the identical,
unmodified mechanism.

## 6. Exact artifact-validation architecture (unchanged by this phase)

`composeWatchOracleResponse()`'s wiring — per-field validation, then the
TTS-artifact validation via `wrapAsAllNarrationFields(buildSpeakableText(drafted))`
run through the same, unmodified `validateNarration()`, falling back to
`buildDeterministicFallbackNarration()` on either failure — is
byte-for-byte unchanged from Phase 5H-R. Only the string
`buildSpeakableText()` produces changed. This phase is a one-line fix to
an existing, correctly-wired check, not a redesign of the check-wiring
itself.

## 7. Test results

### A — Exact seam reproductions (required matrix)

All six claim families, all four required cases each (24 tests total,
`speakableTextValidation.test.ts` section D):

| Claim type | Split fabricated | Unsplit fabricated | Split genuine | Unsplit genuine |
|---|---|---|---|---|
| House | REJECT ✓ | REJECT ✓ | ACCEPT ✓ | ACCEPT ✓ |
| Supporting-house | REJECT ✓ | REJECT ✓ | ACCEPT ✓ | ACCEPT ✓ |
| Sign | REJECT ✓ | REJECT ✓ | ACCEPT ✓ | ACCEPT ✓ |
| Direction | REJECT ✓ | REJECT ✓ | ACCEPT ✓ | ACCEPT ✓ |
| Retrograde | REJECT ✓ | REJECT ✓ | ACCEPT ✓ | ACCEPT ✓ |
| Ruler-relation | REJECT ✓ | REJECT ✓ | ACCEPT ✓ | ACCEPT ✓ |

24/24 as expected.

### B — Artifact identity

Unchanged from Phase 5H-R (§6 above): `ChatBubble.tsx` performs no
computation on `speakableText`, only a presence check and relay — a
diff against it is empty. The identity `validatedTtsText ===
exactArgumentPassedToTtsSpeak`, already proven with live `Tts.speak()`
interception in `PHASE_5H_R_REVIEW.md` §4, continues to hold by the same
unmodified mechanism; nothing in this phase's diff touches the relay
path at all.

### C — Existing protections, re-tested through the complete fixed artifact

`speakableTextValidation.test.ts` section E (6 tests): Cyrillic
confusable substitution combined with the house-claim seam split;
mid-word ASCII punctuation bridging combined with the same; zero-width-joiner
obfuscation combined with the reversal-claim seam split; terminology
leakage through the fixed artifact; internal-data-pattern leakage
through the fixed artifact; the adjacency false-positive control (§4)
re-run through the real `speakableValid()` helper. All 6 pass as
expected — obfuscated/combined attacks still rejected, the false-positive
control still accepted.

### D — Regression (freshly run)

| Check | Result |
|---|---|
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | **437/437**, 18 files (was 406/406 — +31 new: 7 updated/added in section A, 24 in section D, 6 in section E, minus none removed) |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | **306/306**, 27 suites — unchanged, no app-side file needed modification |
| Adversarial harness (fresh run, scratch `--out-dir`, no historical evidence overwritten) | **generated 11923, caught 10374, accepted 1549, falseNegative 0, falsePositive 0, exceptions 0** |
| Golden corpus | 111/111 present, untouched — `git diff` against it empty |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24** byte-identical |
| `node functions/scripts/sync-engine.mjs --check` | clean |
| Prohibited-path diff (`523c592..HEAD`) | empty |
| Working tree | clean before commit |

### E — Boundary safety

All six seam classes: covered in full (§7.A). Multiple fields: the
fabricated/genuine split cases all use exactly the `rkp_finding` /
`interpretation` boundary (the one demonstrated in both 5H-1 and
5H-R-Review-1); the `recommended_approach` field is present but
unclaimed in every case, confirming the fix does not depend on which of
the two seams is exploited (`buildSpeakableText()` has only one
separator, applied uniformly at both). Beginning/end-of-field positions:
every fabricated case places the anchor phrase at the very end of one
field and the claimed value at the very start of the next — the
tightest possible seam exploitation. Whitespace variation: covered by
section A's whitespace-only-field case, unaffected by the separator
change. Capitalization: the six claim-family cases use natural sentence
capitalization (a claim's value capitalized mid-clause where grammar
demands it); no check in `narrationValidator.ts` is case-sensitive in a
way this phase's change affects. Combined attacks: section C. Legitimate
narration: section A's genuine-content case, and section D's four
"genuine" columns. Existing valid reversal behavior: `possibleReversal`'s
own genuine reversal claim (already covered by Phase 5H-R's own
positive control, re-run clean in this phase's full suite run).

## 8. Artifact-identity proof

See §7.B. No new proof was required or constructed: this phase changes
only what string is computed server-side, not how it reaches the
client or the TTS engine — the identity proof from
`docs/audit/PHASE_5H_R_REVIEW.md` §4 (live `Tts.speak()` interception,
strict `===` equality) continues to apply unmodified, confirmed by the
empty diff against every client-side file in this phase's changeset.

## 9. Hard-stop status

None triggered.

1. No fabricated seam-crossing claim can still reach `Tts.speak()` — all
   24 required matrix cases (§7.A) confirm rejection.
2. The validated artifact does not differ from the spoken artifact —
   unchanged mechanism, §7.B.
3. No existing valid narration became invalid unexpectedly — section A's
   genuine-content case and section D's four "genuine" columns confirm
   this, plus the full 306/306 app-suite and 437/437 functions-suite
   re-runs show no unrelated test broke.
4. No 5C-R/5D-R protection regressed — section C, plus the fresh
   11,923-case adversarial harness at 0/0/0/0.
5. `narrationValidator.ts` and `textSecurity.ts` did not need
   modification, and were not modified — confirmed by empty diff.
6. Judgment or diagnosis was not recomputed — this phase touches only a
   string-join separator; no engine, contract, or diagnosis code path
   was touched.
7. Golden corpus and replay output did not change — confirmed identical
   (§7.D); this phase's change has no bearing on engine determinism, and
   none was expected.
8. No previously accepted residual (the six 5E residuals, 5G-1) was
   reopened — none was touched, referenced, or retested by this phase's
   implementation.

## 10. Prohibited-path verification

```
git diff --stat 523c592..HEAD -- \
  src/astrology/ functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/oracle/textSecurity.ts \
  functions/src/oracle/narrationValidator.ts \
  functions/src/prompts/ firestore.rules \
  docs/audit/golden-corpus/ \
  functions/src/functions/discussReading.ts \
  functions/src/oracle/discussionComposer.ts \
  functions/src/functions/askWatchOracle.ts \
  src/hooks/useTextToSpeech.ts
```

Empty. The complete changed-file list for this phase is exactly two
files: `functions/src/oracle/responseComposer.ts` and
`functions/src/oracle/__tests__/speakableTextValidation.test.ts`. No
client-side file, no engine file, no validator file, no security-rule
file, no prompt file was touched.

## 11. Residual findings

None identified specific to this remediation's own scope. One
observation, not a finding requiring action: the visible spoken prose
now uses single periods between fields that each end in their own
terminal punctuation (e.g. "Sentence one. Sentence two." instead of the
prior "Sentence one.. Sentence two.."), a side effect of removing the
injected separator — this is a formatting improvement, not a regression,
and was verified not to change which claims validate (section A/D/E
above cover this explicitly). No other residual risk was found.

## 12. No Phase 5I work began

This document, its accompanying two-file diff, and its tests are the
entire scope of this phase. No Phase 5I reconnaissance, scoping, or
implementation was performed. This phase does not declare Phase 5H
closed — it awaits the independent Phase 5H-R2 Review Gate.
