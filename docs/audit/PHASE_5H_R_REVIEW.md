# Phase 5H-R — Independent Review Gate

Review-only. No production code, test, configuration, or prompt file was
modified by this review. All probe scripts used below were written fresh,
run from inside the tracked tree only long enough to execute, and removed
before this document was written; `git status --porcelain` is clean.

## 1. Checkpoint verification

- Repository: `sp36ai/shams` (confirmed via `git remote -v`).
- Branch: `claude/shams-phase-0-baseline-lnlmy6`.
- HEAD: `00b0e3d` — confirmed via `git rev-parse HEAD`, matches the claimed
  implementation commit.
- Working tree: clean before this review began.
- Implementation diff since the 5H reconnaissance checkpoint
  (`git diff --stat 0d4d7b4..00b0e3d`): exactly the seven files
  `PHASE_5H_R_HARDENING.md`, `discussionComposer.test.ts` (fixture only),
  `speakableTextValidation.test.ts` (new), `responseComposer.ts`,
  `ChatBubble.tsx`, `ChatBubble.test.ts`, `watchOracle.ts` — matches the
  hardening document's own claimed file list exactly.

## 2. Source-code trace (fresh read, not from the hardening doc)

Read `responseComposer.ts`, `ChatBubble.tsx`, `watchOracle.ts`,
`narrationValidator.ts`, `textSecurity.ts`, and the full TTS invocation
path (`useTextToSpeech.ts`) directly.

1. **Where validated narration originates**: `composeWatchOracleResponse()`
   drafts `NarrationFields` via `narrate()`, then runs
   `validateNarration(contract, drafted)` (per-field, unchanged).
2. **Where the TTS artifact is constructed**: `buildSpeakableText(narration)`
   — a new function in `responseComposer.ts` — joins
   `rkp_finding + '. ' + interpretation + '. ' + recommended_approach`
   (empty fields filtered), excluding `why_this_remedy` and `signature`.
3. **Where validation occurs**: a second `validateNarration()` call, against
   `wrapAsAllNarrationFields(buildSpeakableText(drafted))` — same function,
   unchanged, called on the wrapped join. On failure of either the
   per-field or this check, `narration` is replaced by
   `buildDeterministicFallbackNarration(contract)`, and
   `speakableText = buildSpeakableText(narration)` is then (re)computed
   from whichever `narration` was finally decided.
4. **What exact value reaches `Tts.speak()`**: `ChatBubble.speakableTextFor()`
   now returns `reading.oracle.speakableText` verbatim (or a fixed
   `STATE_HEADLINE` string when absent) — traced directly to
   `useTextToSpeech.ts`'s `speak()`, which stores it in `playbackRef.current.text`
   and passes it unmodified to `Tts.speak()` via `startUtterance()`.
5. **Whether anything can mutate the value between validation and speech**:
   traced `useTextToSpeech.ts` in full — `speak()` never transforms `text`;
   `resume()` passes `playback.text.slice(playback.base)`, a pure suffix
   substring of the original, never a superset or an alteration (see §5's
   own note on this).
6. **Alternate TTS paths**: see §9 — exactly one `Tts.speak()` call site in
   the whole repository.
7. **Retries/replays/cancellation**: traced — none reconstruct or
   substitute a different string (see §6, §9).

## 3. Original 5H-1 reproduction (independently reconstructed)

Built a real engine-backed contract (`judgment.reversal = 'NONE'`,
`travel`/`business`-equivalent fixture, fresh `readingId` distinct from
any prior test file) and fresh wording for a reversal claim split across
`rkp_finding`/`interpretation`. Confirmed, via the real
`composeWatchOracleResponse()` and real `validateNarration()`:

- **Before-hardening-equivalent check** (per-field only): both fields
  pass individually — no `REVERSAL_CLAIM_CONTRADICTION`.
- **After-hardening behavior**: the TTS-artifact check
  (`validateNarration()` against the joined string) correctly fires;
  `composeWatchOracleResponse()` substitutes the deterministic fallback;
  the raw drafted text does not survive into `narration` or
  `speakableText`.

5H-1's own original reproduction (a reversal claim split at exactly this
boundary) is genuinely closed by this implementation. This is confirmed,
not merely restated from the hardening document's own tests.

## 4. Exact artifact identity evidence

Built a fresh test rendering the real `ChatBubble` component (via the
app's own `renderScreen` test helper, `ThemeProvider`/`I18nProvider`
included) with a `WatchReading` fixture carrying a distinctive
`speakableText` value, tapped the real play button, and intercepted
`react-native-tts`'s mocked `Tts.speak` — the app's own established
mock, from `jest.setup.js`, not one built for this review.

- `mockedTts.speak.mock.calls[0][0] === serverValidatedText` — **`true`**,
  strict `===` equality on the full string. This is the strongest
  possible form of the requested evidence: not two independently
  reconstructed strings compared after the fact, but the literal argument
  the mocked native module received, compared directly against the value
  the fixture declared as the server-validated `speakableText`.
- The excluded fields' content (`why_this_remedy`/`signature`, each set
  to a distinctive "must never be spoken" string) did not appear in the
  intercepted argument.
- A second case (legacy reading, `speakableText` absent) intercepted the
  argument as the fixed `STATE_HEADLINE` string ("The way is closed" for
  this fixture's verdict state) — never a reconstruction, never the
  narration prose.

Both cases pass. **The identity `validatedTtsText === exactArgumentPassedToTtsSpeak`
holds** for the initial `speak()` call — by construction, since the
client performs no computation at all on this value, only a relay.

**Precise caveat, not a violation**: `resume()` (mid-playback pause/resume)
passes `playback.text.slice(playback.base)` — a suffix substring of the
original validated text, not the byte-identical full string. This is not
a mutation in the sense of altering or introducing content: a substring
drawn from within an already-validated string cannot contain any
sentence, phrase, or claim that was not already present in the validated
whole. `speak()`'s own argument (the case that matters for "was this
string validated") is exact; `resume()`'s argument is always a suffix of
it. Recorded precisely here so the identity claim is not overstated.

## 5. Mutation-gap analysis

Checked every candidate: trimming (none — `speak()`/`toggle()` pass
`text` through unmodified; `buildSpeakableText()` does not trim, per
§4's Unicode/whitespace-preservation evidence), concatenation
(`ChatBubble.tsx` no longer concatenates anything — confirmed by its own
diff and by §4's identity proof), punctuation insertion (none found),
whitespace normalization (none — a whitespace-only field is preserved
verbatim, per the hardening doc's own transformation tests, reconfirmed
by direct read of `buildSpeakableText`'s single `.filter(s => s.length >
0).join('. ')` line), Unicode normalization (none — no `.normalize()`
call anywhere in the changed files), casing (none), field reordering
(the join order is fixed literally in source, not data-driven), fallback
substitution (the ONLY fallback path is the pre-existing, unmodified
`buildDeterministicFallbackNarration()`, and its output is *also* run
through `buildSpeakableText()` before being validated-by-construction —
see §7), client-side transformation (none — eliminated entirely by this
phase's own design), helper functions (`wrapAsAllNarrationFields()` only
wraps, does not alter, the string it is given), retry handling (a client
retry re-invokes the full `askWatchOracle`/`discussReading` callable,
which always re-runs the same validated pipeline; no cached/partial
value is ever substituted), state restoration (`playbackRef` holds only
the original `text`, sliced, never replaced by a different value).

**No mutation-gap was found on the path validated string → `Tts.speak()`.**
The genuine issue found by this review (§6 below) is not a mutation
after validation — it is that validation, though run on the exact
artifact, is structurally unable to detect certain contradictions
*within* that artifact.

## 6. Central finding: sentence-scoped ground-truth checks are structurally blind to the join boundary itself

This is the review's material finding, discovered through the review's
own fresh probing (not present in the hardening document or its tests).

**Mechanism.** `buildSpeakableText()` joins its three fields with the
literal separator `'. '` — a period. Six of the sixteen checks in
`narrationValidator.ts`'s `CHECKS` array
(`checkHouseClaims`, `checkSupportingHouseClaims`, `checkSignClaims`,
`checkDirectionClaims`, `checkRetrogradeClaims`, `checkRulerRelationClaims`)
require their anchor phrase and the claimed value to appear in the *same
sentence*, using `findSentenceContaining()` — which bounds a "sentence"
strictly between the nearest surrounding periods. Because
`buildSpeakableText()`'s own join inserts a period exactly at every
field boundary, any claim an attacker (or, without any adversarial
intent at all, simply an unlucky placement of Claude's own drafted
prose) splits so that the anchor phrase lands in one field and the
claimed value lands in the immediately adjacent field will *always* be
parsed by `findSentenceContaining()` as two separate sentences — because
the join itself inserted the separating period. This is deterministic,
not wording-dependent: it holds regardless of how the surrounding prose
is phrased, for any claim of these six shapes, on any contract.

By contrast, `checkReversalClaims`'s `REVERSAL_CLAIM_PATTERN` uses a
character-count window (`[\s\S]{0,40}?`, which matches *through* a
period) rather than sentence-scoping — this is why the *original* 5H-1
reversal-claim finding is genuinely closed (§3): that specific check's
own detection mechanism happens to survive the join's separator. The
four unbounded-substring checks this review also probed (verdict
polarity, unsupported certainty, terminology leakage) require their
anchor phrase to appear as one *contiguous* substring — the join's
inserted period breaks the phrase itself if split at the boundary, so
these are also safe, for a different, unrelated reason (confirmed by
direct probe, §8).

**Reproduction — six claim families, one real contract, fresh wording,
none copied from the implementation's own tests.** Built a real
engine-backed contract (`marriage`, fresh `readingId`,
`targetHouse = 7`, `targetSignName = 'Burj Qaus'`, `direction = 'East'`,
`reversal = 'NONE'`, `rulerRelation = 'Neutral'`, not retrograde,
`supportingHouses = [7, 11, 2]`). For each of the six claim types, split
a false claim across the `rkp_finding`/`interpretation` boundary and ran
it through the real `composeWatchOracleResponse()`:

| Claim type | Claimed (false) | Actual | Result |
|---|---|---|---|
| House | 3 | 7 | **accepted unchanged** — bypass |
| Direction | North | East | **accepted unchanged** — bypass |
| Retrograde | asserted | not retrograde | **accepted unchanged** — bypass |
| Ruler relation | friend | Neutral | **accepted unchanged** — bypass |
| Sign | Hamal | Burj Qaus | **accepted unchanged** — bypass |
| Supporting house | 1 (not in [7,11,2]) | — | **accepted unchanged** — bypass |

In every case, `composition.narration` and `composition.speakableText`
were the raw, drafted, ground-truth-contradicting text — the
deterministic fallback was never triggered, and the exact string a
seeker would hear via TTS contained the false claim.

**Control (unsplit)**: the identical house-claim wording, placed whole
within a single field rather than split, was correctly rejected — the
existing `HOUSE_CLAIM_CONTRADICTION` fired and the fallback was used.
This isolates the gap precisely to the field-boundary split, not a
general weakness in the check.

**Control (genuine claim, same split shape)**: the identical
field-boundary split, but with a *true* house claim (the reading's own
actual house number), was correctly *accepted* — confirming this is a
false-negative gap, not an over-tightening/false-positive regression.

**Combined with existing obfuscation mechanisms**: the house-claim split
combined with Cyrillic confusable substitution, and separately with
mid-word ASCII punctuation insertion, both also bypassed — expected,
since the boundary trick alone is already sufficient; the combination
does not change the underlying mechanism.

**Severity.** This is a reproducible bypass, requiring no client
tampering and no forged request — only Claude's own drafted prose
happening to place a claim's anchor phrase and its value on opposite
sides of one of the two join seams — that lets a fabricated house,
sign, direction, retrograde, ruler-relation, or supporting-house claim
reach the exact string handed to `Tts.speak()`, for six of the seven
Phase 5E ground-truth claim types (all except reversal). It directly
contradicts the phase's own stated central invariant as clarified by
this review's own instructions (§3 of the authorization): "the
question is specifically whether the final spoken artifact is
validated" — the artifact *is* run through `validateNarration()`, but
that validation is structurally incapable of detecting this class of
contradiction in the artifact it is given, for the majority of the
ground-truth claim types the whole Phase 5E chain exists to protect.

This meets hard-stop condition 1 (an artifact reaches `Tts.speak()`
without effective validation against six specific, reproducible claim
shapes) and is a P1 finding directly affecting the central invariant
this phase was authorized to establish. Per this review's own
classification rule, **a P0/P1 finding affecting the invariant is
automatically FAIL.**

Not fixed here, per this review's own governing rule — documented only.

## 7. Failure-path evidence

- Fabricated reversal (unsplit, and split-but-caught by the window regex):
  fallback triggered, confirmed.
- Fabricated timing, house, sign, direction claims (unsplit): fallback
  triggered, confirmed (house shown explicitly in §6's control; the
  others share the identical per-field mechanism, unchanged by this
  phase, already covered by the 5E-chain's own extensive regression
  suite, re-run clean in §12).
- Prohibited terminology, internal-data leakage: unbounded substring
  checks, confirmed still catch a fresh split attempt (§8).
- Confusable substitution, zero-width/Unicode obfuscation, punctuation
  obfuscation: confirmed still caught when the underlying claim is NOT
  additionally split across the join boundary (unchanged, per-field
  mechanism); confirmed NOT caught when combined with the boundary split
  for the six affected claim types (§6).
- Validation failure never falls through to another speech invocation:
  traced — the only path from a failed `composeWatchOracleResponse()`
  validation is the deterministic fallback, which is then itself run
  through `buildSpeakableText()` (never re-validated, by the same
  established precedent `buildDeterministicFallbackNarration()`'s own
  output always has been) and returned as `speakableText`; there is no
  code path that retries the model call or falls back to the rejected
  draft.

## 8. Genuine-content controls

Confirmed accepted, unsplit and via the real pipeline: ordinary valid
narration (no claim-shaped phrases at all); a genuine reversal claim on
a `reversal = 'POSSIBLE'` contract, at the exact same field-boundary
split Finding 5H-1 itself used (positive control from the
implementation's own test suite, independently re-run); a genuine house
claim at the same split, on the `marriage` fixture (§6's own positive
control); legitimate remedy language; ordinary Unicode and punctuation.
No false positive was found anywhere in this review's probing — every
rejection traced to a real, demonstrated contradiction or a defensible
degradation (legacy fallback), never a legitimate claim.

Additionally probed (§6's unbounded-substring control): a verdict-polarity
phrase ("the matter will succeed") split at the identical field boundary
does **not** reconstruct — `lower.includes('the matter will succeed')`
requires the phrase as one contiguous substring, and the join's own
inserted `'. '` breaks it. This positively confirms the asymmetry this
review's central finding describes: substring-anchored checks are safe
from the boundary trick; sentence-scoped checks are not.

## 9. Alternate TTS-path inventory

Grepped the entire repository for every `Tts.` reference, every
`useTextToSpeech(` instantiation, and every alternate speech/audio
library:

| Path | Classification |
|---|---|
| `useTextToSpeech.ts:285`, `Tts.speak(segment)` — the only `Tts.speak()` call site in the repository | the artifact boundary itself; VALIDATED (subject to §6's finding for six claim types) |
| `ChatBubble.tsx:255`, reading branch → `onToggleSpeech(id, speakableTextFor(reading), lang)` | VALIDATED (relays `oracle.speakableText`, subject to §6) |
| `ChatBubble.tsx:228`, discussion branch → `onToggleSpeech(id, message.text, lang)` | VALIDATED — `message.text` is `discussReading`'s single validated `answer` field (Phase 5F), untouched by this phase, not subject to the join-boundary mechanism at all (nothing is joined) |
| `useTextToSpeech()` — instantiated exactly once, in `ReadingScreen.tsx:171` | NOT a separate path — the single hook both bubble types share |
| `classifyQuestion`, `inferProfile` (closed-enum model surfaces, from the 5G reconnaissance) | NON-NARRATION — no free text, nothing ever reaches TTS from these |
| `useSpeechToText.ts` | NON-NARRATION — speech-to-text for the seeker's own spoken question (an input surface, not a response/speech-output surface) |
| `package.json` — exactly one TTS dependency, `react-native-tts` | confirms no second engine/library exists |

No alternate, narration-capable path to speech exists anywhere in the
codebase. The complete reachable speech surface is the two `onToggleSpeech`
call sites above, both accounted for.

## 10. Server/client boundary analysis

The client receives, via `WatchOracleComposition`: the five raw
`narration` fields (rendered individually, each its own screen element —
unchanged by this phase, confirmed by the 5H reconnaissance and
reconfirmed here by an empty diff against `RemedyProtocolCard.tsx`) *and*
the separately-validated `speakableText` field (new). It never receives
the `ReadingContract` itself (confirmed unchanged: `askWatchOracle.ts`'s
client-facing `response` object was not touched by this phase, and its
own prohibited-path diff is empty). The client cannot alter the speech
artifact after validation: `ChatBubble.speakableTextFor()` performs no
computation on `speakableText`, only a presence check and a relay (§2,
§4). No client-side concatenation or reconstruction exists anywhere in
the diff — this is exactly what makes §4's identity proof hold as
strongly as it does. The server/client boundary itself introduces no
gap; the gap found in §6 is entirely server-side, in the mismatch
between how the artifact is joined and how six of the checks scope
their own detection.

## 11. Regression matrix (freshly run, not copied from the hardening document)

| Check | Result |
|---|---|
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | **406/406**, 18 files |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | **306/306**, 27 suites |
| Adversarial harness (fresh run, scratch `--out-dir`, not overwriting `docs/audit/phase-5f/` or any historical evidence) | **generated 11923, caught 10374, accepted 1549, falseNegative 0, falsePositive 0, exceptions 0, contractMutations 0** |
| Golden corpus | 111/111 present, `git diff` against it empty |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24** byte-identical |
| `node functions/scripts/sync-engine.mjs --check` | clean |
| Prohibited-path diff (`0d4d7b4..00b0e3d`, `narrationValidator.ts`/`textSecurity.ts`/engine/`readingContract.ts`/prompts/`firestore.rules`/golden corpus) | empty |
| Working tree | clean before and after this review |

All figures independently reproduced, matching the hardening document's
own claims exactly. The adversarial-harness result is unsurprising and
does not contradict §6's finding: that harness attacks per-field
validation directly (the mechanism 5C-R/5D-R protect), not the
join-boundary-specific gap this review found, which requires a claim
split across two fields — a shape the harness was never built to
generate.

## 12. Protected-path verification

Verified zero modifications, via `git diff --stat` against each path
individually and all together, `0d4d7b4..00b0e3d`:
`narrationValidator.ts` — empty; `textSecurity.ts` — empty; engine
(`functions/src/engine/`, `src/astrology/`) — empty; `readingContract.ts`
— empty; prompts (`functions/src/prompts/`) — empty; astronomical
calculations — covered by the engine diff, empty; watch/judgment logic
— covered by the engine diff, empty; `firestore.rules` — empty. The six
5E residuals and 5G-1 were not touched, referenced, or retested by this
phase's implementation (confirmed: neither `responseComposer.ts`'s diff
nor any new test references any of them). No unexpected modification
was found anywhere.

## 13. Findings and severity

### Finding 5H-R-Review-1 (P1) — sentence-scoped ground-truth checks bypassed by the join's own separator

See §6 for the full mechanism, reproduction (six claim families), and
positive/negative controls. Directly affects the central invariant this
phase was authorized to establish. Not fixed by this review, per its
own governing rule.

### No P0 finding.

(5H-R-Review-1 is assessed as P1 rather than P0: it requires the model's
own drafted prose to place a claim's anchor phrase and value on opposite
sides of a field seam — not guaranteed on every reading, and the
existing, unrelated per-field validation still catches the same claim
whenever it is NOT split this way, which is the common case. It is not
trivially or universally triggered the way a structural absence of any
validation would be. It is nonetheless a real, reproducible, P1-severity
bypass of the specific invariant this phase claims to establish.)

### No other new findings.

Every other required check (§4–§5, §7–§10) returned clean: the exact
artifact identity holds, no mutation gap exists, no alternate TTS path
exists, the server/client boundary introduces no gap of its own, and no
existing protection (5C-R/5D-R, the unbounded-substring checks, the
reversal window check) regressed.

## 14. Final classification

**FAIL**

The central invariant — every string supplied to `Tts.speak()` has
effectively passed the deterministic narration validator — is not
proven. §4 proves the *identity* invariant (the validated string and
the spoken string are the same value) holds without exception. But §6
demonstrates, with a real engine-backed contract, fresh wording, and
the actual production pipeline, that for six of the seven Phase 5E
ground-truth claim types, "passed the validator" does not mean "the
validator was capable of detecting a genuine contradiction in this
artifact" — a fabricated house, sign, direction, retrograde,
ruler-relation, or supporting-house claim, split across the exact
boundary the join itself introduces, reaches `Tts.speak()` unrejected.
Per this review's own classification rule, a P0/P1 finding affecting
the invariant is automatically FAIL, and Finding 5H-R-Review-1 is such
a finding.

This is not a rejection of the architecture chosen in §4 of the
hardening document (single server-side computation, client relay only —
that piece is sound and well-evidenced) — it is a gap in what the
*existing* `narrationValidator.ts` checks can detect once fed a string
containing the join's own artificial sentence boundaries, which
`buildSpeakableText()`'s new validation call inherited without
accounting for.

## 15. Explicit statement that no 5I work began

No Phase 5I reconnaissance, scoping, or implementation was performed at
any point in this review. This review does not fix Finding
5H-R-Review-1, does not begin a second 5H-R remediation round on its
own initiative, and does not declare Phase 5H closed. It stops at
publishing this evidence, per its own governing instruction, and awaits
your explicit scope decision.
