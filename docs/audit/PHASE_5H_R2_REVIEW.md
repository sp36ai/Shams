# Phase 5H-R2 — Independent Review Gate

Review of implementation commit `1917b50` ("Phase 5H-R2: close Finding
5H-R-Review-1 -- fix the join separator, not the checks"), against the
central invariant the Phase 5H-R2 authorization required:

> The exact final TTS artifact must be deterministically validated after
> construction and before delivery to `Tts.speak()`.

Review-only. No production code, test, or configuration file was
modified by this review; the one temporary evidence file created during
review (an end-to-end interception test, described below) was deleted
before this document was written and was never committed.

## 1. Checkpoint

- Repository: `sp36ai/shams`.
- Branch: `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: `1917b50`, on parent `523c592` (the Phase 5H-R
  independent review that returned FAIL on Finding 5H-R-Review-1).
- Working tree: clean throughout.

## 2. Evidence supplied and independently checked

Delivered directly in-conversation (inline text, not tool-call output
only, after an earlier evidence pass was found not to have reached the
reviewer):

1. The exact PHASE 5H-R2 authorization block that governed `1917b50`.
2. The complete `git diff 523c592..1917b50` (all three changed files,
   full headers) — confirmed byte-identical across two independent
   pastes via a local `diff`.
3. The full `functions/src/oracle/responseComposer.ts` source.
4. The full `functions/src/oracle/__tests__/speakableTextValidation.test.ts`
   source (837 lines, all tests, including the six-claim-family
   seam-boundary matrix — section D).
5. The relevant `narrationValidator.ts` implementation:
   `findSentenceContaining()`, `extractHouseNumbers()` and
   `HOUSE_NUMBER_PATTERN`, and all six checks (`checkHouseClaims`,
   `checkSupportingHouseClaims`, `checkSignClaims`,
   `checkDirectionClaims`, `checkRetrogradeClaims`,
   `checkRulerRelationClaims`).
6. The actual TTS delivery code: `ChatBubble.tsx`'s `speakableTextFor()`
   and its `onToggleSpeech(message.id, speakableTextFor(reading), ...)`
   call site, and `useTextToSpeech.ts`'s `speak()` →
   `startUtterance()` → `Tts.speak(segment)` chain — the only
   `Tts.speak()` call site in the repository.
7. A fresh end-to-end delivery-identity test, built specifically to
   close the gap the first review pass identified (composition identity
   proven, delivery identity not yet proven):
   - Step one (functions-side, real `composeWatchOracleResponse()`, no
     mocks beyond `fetch`): drafted genuine, non-trivial narration,
     confirmed `narration === drafted` (i.e., validation passed, not the
     deterministic-fallback path), and captured the exact
     `composition.speakableText` string that call produced.
   - Step two (app-side, real `ChatBubble`, real `useTextToSpeech`,
     the app's own established `react-native-tts` jest mock): fed that
     exact server-produced string into a `WatchReading` fixture,
     rendered the component via the app's own `renderScreen` helper,
     pressed the real play button, and asserted
     `mockedTts.speak.mock.calls[0][0] === SERVER_VALIDATED_SPEAKABLE_TEXT`
     — strict `Object.is` equality, not a looser comparison — with the
     captured argument printed directly:
     `"The seventh house carries this matter, and it weighs upon it
     heavily. This is not an outright denial, but real caution is
     warranted here. Wait for a clearer window before taking any
     irreversible step."`
   - Result: pass. The argument the mocked native module actually
     received was byte-for-byte identical to the string the real
     server-side validation pipeline produced and approved — not two
     independently reconstructed strings compared after the fact.
8. Freshly re-run regression evidence at `1917b50`, raw: golden corpus
   111/111 (`git diff` against it empty); 24-case replay, all
   `"identical": true`; 11,923-case adversarial harness (fresh run,
   scratch `--out-dir`, no historical evidence overwritten) —
   `falseNegativeCount: 0, falsePositiveCount: 0, exceptionCount: 0`;
   prohibited-path diff (`523c592..1917b50`, all ten paths at once) —
   empty; full three-file changed-list confirmed unchanged from the
   implementation's own claim.

## 3. Gate assessment

| Gate | Result |
|---|---|
| Six seam-bypass classes (house, supporting-house, sign, direction, retrograde, ruler-relation) | PASS |
| Fabricated split claims rejected | PASS |
| Fabricated unsplit controls rejected | PASS |
| Genuine split claims accepted (no over-tightening) | PASS |
| Genuine unsplit controls accepted | PASS |
| Existing protections (confusable substitution, mid-word punctuation, ZWJ, terminology leakage, internal-data leakage) re-tested through the fixed artifact | PASS |
| Composition artifact identity (`composition.speakableText === buildSpeakableText(composition.narration)`) | PASS |
| **Actual `Tts.speak()` delivery identity** (captured runtime argument === the real, server-validated artifact) | **PASS** |
| Golden corpus 111/111, unchanged | PASS |
| Replay 24/24, byte-identical | PASS |
| 11,923-case adversarial harness | PASS — 0 FN / 0 FP / 0 exceptions |
| Prohibited-path diff | PASS — empty |
| Working tree | PASS — clean |
| `narrationValidator.ts` / `textSecurity.ts` untouched | PASS |
| Judgment/diagnosis recomputation introduced | PASS — none |
| Golden corpus regenerated or changed | PASS — no |
| Scope expansion beyond the six authorized claim classes | PASS — none found |

## 4. The decisive point

The first review pass on this same evidence chain established composition
identity (`composition.speakableText === buildSpeakableText(narration)`)
but not delivery identity — the distinction between "the right string was
validated" and "the string that was actually spoken was the string that
was validated." The end-to-end test in §2.7 closes that gap directly: it
does not reconstruct an equivalent string and compare two independently
derived values — it captures the literal argument the mocked native TTS
module received, at the real call site, and compares it against the
literal output of the real, unmodified server-side validation pipeline.
That is the stronger claim the authorization's requirement B ("Prove
that the string validated is byte-for-byte identical to the string
supplied to `Tts.speak()`") called for, and it now has direct,
reproducible evidence rather than an architectural inference from an
unchanged diff.

## 5. Findings

None. No P0, P1, P2, or P3 finding was raised against `1917b50` by this
review. The six-class seam remediation is architecturally sound (single
join computed once, validated once, relayed verbatim — no second
representation, no client-side reconstruction) and is now directly
evidenced end to end.

## 6. Final disposition

**PHASE 5H-R2 REVIEW GATE: PASS.**

This is a review-gate PASS for the `1917b50` implementation checkpoint,
not a declaration that Phase 5H as a whole is closed. Per the governing
authorization and this review's own scope:

- Phase 5H remains **not closed**.
- Phase 5I remains **not started, not authorized**.
- This review does not reopen 5H-R2 for additional hardening.
- This review does not modify the validator architecture based on any
  hypothetical future bypass class.
- `1917b50` stands as the accepted implementation checkpoint; this
  document is the independent record of the Review Gate that evaluated
  it.

Formal closure of Phase 5H — separate from this implementation-level
Review Gate — awaits its own explicit authorization, as established
throughout this chain.
