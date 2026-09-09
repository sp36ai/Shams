# Phase 5H-R — TTS Post-Validation Hardening

Closes Finding 5H-1 (`docs/audit/PHASE_5H_RECONNAISSANCE.md`) only.
Implementation checkpoint against `0d4d7b4` (Phase 5H reconnaissance).

## 1. Original 5H-1 reproduction

`ChatBubble.speakableTextFor()` used to build the text-to-speech string
client-side by joining three of the five `NarrationFields`
(`rkp_finding`, `interpretation`, `recommended_approach`), filtering
empty ones, with `'. '` as separator — entirely after
`validateNarration()` (server-only) had already run per field.
Reproduced again here, before any change, using a real engine-built
`ReadingContract` (`judgment.reversal = 'NONE'`) and the real validator:
a claim split across the `rkp_finding` / `interpretation` boundary
("...there may be a reversal" / "remains possible, though nothing about
this is settled yet.") passed per-field validation on both fields, while
the exact join a seeker would have heard failed with
`REVERSAL_CLAIM_CONTRADICTION`. See
`functions/src/oracle/__tests__/speakableTextValidation.test.ts`'s "B."
describe block, which reproduces this exact case as a permanent
regression test.

## 2. Exact TTS transformation

Established by pre-implementation probing against the real, unmodified
`ChatBubble.speakableTextFor()` (via its own existing test file's
import path, run through the app's jest suite, not a hand-written
approximation) before any production code was touched:

- Exactly three of the five fields, in this order: `rkp_finding`,
  `interpretation`, `recommended_approach`. `why_this_remedy` and
  `signature` are never included.
- Each field is filtered by `s.length > 0` — a whitespace-only field
  counts as non-empty and is included as-is (confirmed:
  `'A.' , '   ', 'C.'` joins to `'A..    . C.'`, not `'A.. C.'`).
  An entirely-empty field is dropped, with no extra separator left
  behind (`'A.', '', 'C.'` joins to `'A.. C.'`).
  A single populated field returns unjoined (no trailing/leading
  separator).
  All three empty returns `''`.
- Fields are joined with the literal string `'. '` — no trimming,
  no case changes, no Unicode normalization; punctuation and Unicode in
  each field are passed through verbatim (confirmed against a
  Devanagari/Arabic/em-dash mixed case).

This exact semantics is reproduced field-for-field in
`buildSpeakableText()` (`functions/src/oracle/responseComposer.ts`).

## 3. Pre-implementation discriminator/probe results

Six probe cases were run against the real, then-still-client-side
`speakableTextFor()` before any file was edited (via its existing
`ChatBubble.test.ts` import path): all three fields populated; empty
middle field; single field only; all fields empty; Unicode +
punctuation; whitespace-only field. Results matched exactly what §2
states and were used verbatim to write `buildSpeakableText()` — no
detail was invented or approximated. The probe scripts themselves were
temporary, run outside the tracked tree, and removed before any
production file was edited.

## 4. Chosen architecture and rationale

**Preferred option, and the one implemented**: move the join server-side,
compute it once as part of `composeWatchOracleResponse()`, validate that
exact string through the unmodified `validateNarration()` pipeline
before it is ever included in the composition, and have the client read
the resulting field directly instead of reconstructing anything.

Why this over validating client-side: the client structurally never has
a `ReadingContract` to validate against — it is deliberately never sent
to the client (established Phase 5F, reconfirmed Phase 5G/5H
reconnaissance: `firestore.rules` blocks client reads of anything but
its own reading document's fields as returned by the callable, and the
callable's own response never includes `readingContract`). Client-side
post-validation is therefore not merely inconvenient but architecturally
impossible without either sending the contract to the client (which
would be a much larger, unauthorized trust-boundary change) or
duplicating validation logic client-side against something the client
cannot obtain. This is exactly the constraint the authorization's §
"Authorized implementation" anticipated ("If the current client
architecture makes server-side post-validation impossible, document
that constraint before choosing an alternative") — resolved here in the
opposite direction: server-side post-validation is not merely possible,
it is the only architecturally sound option, since the `ReadingContract`
already exists there and nowhere else.

Why move the transformation itself server-side, rather than duplicating
`buildSpeakableText`'s three-line join in both the client and the
server and validating the server's copy: two independent
implementations of the same join create a drift risk that would
silently reopen 5H-1 the moment either copy diverged from the other,
with nothing to catch it. Computing the string exactly once, server-side,
and having the client relay the resulting field verbatim makes "the
validated string" and "the spoken string" the same value by
construction, not merely by two authors' agreement — the strongest form
of the invariant this phase was asked to establish
(`Tts.speak(input) must only ever receive input that has passed the same
deterministic validation pipeline after the exact production
transformation`), and the only form that cannot regress through
independent edits to one side.

`wrapAsAllNarrationFields()` is a local, second copy of
`discussionComposer.ts`'s `wrapReplyAsNarrationFields()` — itself a
six-line mapping utility, not validator logic — rather than an import
from that file. Importing it directly was not possible without either a
circular import (`discussionComposer.ts` already imports types from
`responseComposer.ts`) or moving it into `narrationValidator.ts`, an
explicitly prohibited edit for this phase. Duplicating this specific
six-line utility (never the validator's own check functions, all of
which remain single-sourced in the untouched `narrationValidator.ts`)
was judged the narrowest compliant option.

## 5. Exact files changed

- `functions/src/oracle/responseComposer.ts` — added `speakableText` to
  `WatchOracleComposition`; added `buildSpeakableText()` and
  `wrapAsAllNarrationFields()`; extended the existing per-field
  validation branch in `composeWatchOracleResponse()` to also validate
  the TTS artifact and fall back to the same, unmodified deterministic
  fallback narration on either failure; compute `speakableText` from
  whichever `narration` was ultimately used.
- `functions/src/oracle/__tests__/discussionComposer.test.ts` — one
  fixture updated to include the now-required `speakableText` field (no
  behavioral change to the test).
- `functions/src/oracle/__tests__/speakableTextValidation.test.ts` (new)
  — 16 tests covering transformation semantics, the 5H-1 reproduction,
  positive/negative controls, and adversarial re-composition through the
  real `composeWatchOracleResponse()` pipeline.
- `src/types/watchOracle.ts` — added optional `speakableText?: string |
  null` to the client's hand-mirrored `WatchOracleComposition` type.
- `src/components/oracle/ChatBubble.tsx` — `speakableTextFor()` now
  relays `reading.oracle?.speakableText` instead of reconstructing the
  join itself; falls back to the existing deterministic
  `STATE_HEADLINE` both when `oracle` is absent (unchanged prior
  behavior) and when `speakableText` specifically is absent (a reading
  composed before this field existed) — never attempts to reconstruct
  the join for such a reading, which would reopen the exact gap this
  phase closes.
- `src/components/oracle/__tests__/ChatBubble.test.ts` — updated for the
  new relay behavior; added a case for the legacy-record (missing
  `speakableText`) fallback and a case for `speakableText: null`.

No change was made to `askWatchOracle.ts`: `speakableText` flows through
automatically as part of the same `oracleResponse`/`result.composition`
object that file already persists to `readings/{id}.watchOracle` and
returns to the client as `oracle` — no new plumbing was needed there.

## 6. Proof that the validated artifact equals the spoken artifact

By construction, not merely by test: `speakableText` in the returned
`WatchOracleComposition` is the literal return value of
`buildSpeakableText(narration)`, computed once, where `narration` is
whichever value (validated draft or deterministic fallback) the
function already decided to use. `ChatBubble.speakableTextFor()` no
longer computes anything — it reads this field and returns it verbatim,
or falls back to a fixed, non-model string when the field is absent.
There is no second computation anywhere in the client or server that
could diverge from the validated one. This is verified structurally by
the diff itself (§5) and exercised by
`speakableTextValidation.test.ts`'s integration tests, each of which
asserts `composition.speakableText === buildSpeakableText(composition.narration)`
directly against the real `composeWatchOracleResponse()` output.

## 7. Failure-path behavior

- Validation failure (either per-field or TTS-artifact) → the existing,
  unmodified deterministic-fallback path
  (`buildDeterministicFallbackNarration(contract)`) is used for
  `narration`, and `speakableText` is then computed from that same
  fallback — never from the rejected draft. No new fallback behavior was
  invented; the exact pre-existing "no reply/substitute the safe
  template" precedent (Phase 4) is reused for both failure reasons
  identically.
- The deterministic fallback's own three-field join cannot itself fail
  the TTS-artifact check (verified as a permanent regression case in
  `speakableTextValidation.test.ts`'s "B." block): the fallback is built
  directly from `contract` fields, so it cannot state a claim
  `contract` doesn't already support, and it is not re-validated for the
  same reason `buildDeterministicFallbackNarration()`'s own output never
  has been.
- Synthesis failure (no draft at all — API key missing, HTTP error,
  timeout, malformed JSON) leaves both `narration` and `speakableText`
  `null`, exactly as `narration` alone did before this phase — verified
  as a permanent regression case.
- `Tts.speak()` itself was not modified and cannot be called with
  anything other than what `speakableTextFor()` returns; that function
  now returns only the server-validated field or a fixed,
  non-model deterministic headline — never a client-side reconstruction.
- Repeated playback (pause/resume) in `useTextToSpeech.ts` — unmodified
  by this phase — operates only on slices of the single string already
  handed to `speak()`; there is no path where resume, retry, or a
  dropped connection causes a different, unvalidated string to reach
  `Tts.speak()`. Traced directly in the unmodified file: `playbackRef.current.text`
  is set once per `speak()` call and only ever sliced, never replaced,
  until the next explicit `speak()`/`toggle()` call, which always
  originates from `ChatBubble`'s own `onToggleSpeech(..., speakableTextFor(reading), ...)` —
  the same relay described above.
- Discussion-reply audio is unaffected: `ChatBubble.tsx`'s discussion
  branch passes `message.text` (the single validated `answer` field)
  directly to `onToggleSpeech`, unchanged by this phase — confirmed by
  an empty diff against every line involved in that branch.

## 8. Adversarial results

Re-tested through the actual `composeWatchOracleResponse()` pipeline
(mocked `fetch`, real engine-built contract, real validator — not a
hand-written approximation), each attacking the same field-boundary
split Finding 5H-1 demonstrated:

| Attack | Result |
|---|---|
| Original split-field reversal claim (5H-1 reproduction) | rejected — fallback used, raw text does not survive into `narration` or `speakableText` |
| Same split, Cyrillic а (U+0430) confusable substitution inside "reversal" | rejected |
| Same split, mid-word ASCII punctuation ("rever.s.al") | rejected |
| Same split, combined zero-width-joiner + confusable | rejected |
| Same field-boundary split, but on a contract where the claim is genuinely TRUE (`judgment.reversal = 'POSSIBLE'`) | **accepted** — positive control, no false positive introduced |
| A per-field failure unrelated to the TTS boundary (wrong verdict, present entirely within one field) | rejected exactly as before this phase — no regression |
| Ordinary genuine narration with no split claim | accepted, `speakableText` matches `buildSpeakableText(narration)` |

All seven cases are permanent regression tests in
`speakableTextValidation.test.ts`. No existing adversarial protection
(3-tier canonicalization, confusable folding, punctuation bridging) was
touched — the artifact check reuses `validateNarration()` completely
unmodified, so every mechanism those protections provide applies to the
TTS artifact exactly as it already applies to any other field.

## 9. Regression results

| Check | Before this phase | After this phase |
|---|---|---|
| `functions`: `npx tsc --noEmit` | clean | clean |
| `functions`: `npm run lint` | clean | clean |
| `functions`: `npx vitest run` | 390/390, 17 files | **406/406, 18 files** (+16 new) |
| app: `npm run typecheck` | clean | clean |
| app: `npm run lint` | clean | clean |
| app: `npm run test` | 304/304, 27 suites | **306/306, 27 suites** (+2 new) |
| `node functions/scripts/sync-engine.mjs --check` | clean | clean |
| Golden corpus | 111/111, untouched | 111/111, untouched |
| `npx vite-node functions/scripts/replay-check.ts` | 24/24 | 24/24 |
| Working tree | clean | clean before commit |

The +16/+2 are the new/updated tests this phase adds (§5); no existing
test was weakened, skipped, or had its assertions loosened.

## 10. Prohibited-path verification

```
git diff --stat 0d4d7b4..HEAD -- \
  src/astrology/ functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/oracle/textSecurity.ts \
  functions/src/oracle/narrationValidator.ts \
  functions/src/prompts/ firestore.rules \
  docs/audit/golden-corpus/ \
  functions/src/functions/discussReading.ts \
  functions/src/oracle/discussionComposer.ts
```

Empty. Additionally confirmed individually empty for
`functions/src/functions/askWatchOracle.ts` and `src/hooks/useTextToSpeech.ts`
(neither needed a change — see §5). The complete changed-file list is
exactly: `responseComposer.ts`, `discussionComposer.test.ts` (fixture
only), the new `speakableTextValidation.test.ts`, `watchOracle.ts`
(client type), `ChatBubble.tsx`, `ChatBubble.test.ts`. No 5E residual,
no 5G-1, no discussion-validation logic, no engine, contract, prompt, or
security-rule file was touched.

## 11. Residual risks, if any

None identified specific to 5H-1's own closure. Two observations,
neither a new finding and neither requiring action:

- Every reading composed **before** this phase shipped has no
  `speakableText` field; such readings fall back to the deterministic
  `STATE_HEADLINE` for TTS rather than speaking their narration prose at
  all. This is a deliberate, safe degradation (§5/§7) — the alternative
  (reconstructing the join for old data) would reopen 5H-1 for exactly
  the data least able to be re-validated retroactively — not a defect.
- The verbose failure log now lists both the per-field and TTS-artifact
  failures together (occasionally naming the same field twice, once per
  reason) when both fail simultaneously for the same underlying claim.
  Cosmetic only — it does not affect behavior, and every assertion in
  this phase's tests passes regardless.

## 12. No Phase 5I work began

This document, its accompanying code changes, and its tests are the
entire scope of this phase. No reconnaissance, implementation, or
scoping for Phase 5I was performed. Phase 5H-R is not self-closed by
this document — it awaits the independent 5H-R Review Gate.
