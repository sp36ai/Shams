# Phase 5F — Discussion-Surface Validation

**Status: PASS**

## 1. Scope

Closes exactly Finding F1 from `docs/audit/PHASE_5F_RECONNAISSANCE.md`:
`discussReading`, the follow-up-conversation callable, had zero
deterministic content validation, despite receiving authoritative
`ReadingContract` data. This phase extends the existing validation
architecture to that path. Finding F2 (the legacy Firestore field, P3,
informational, no live read path) was explicitly out of this phase's
scope per the reconnaissance's own recommendation, and was not touched.

## 2. Mandatory reconnaissance (before any code was written)

### 2.1 Exact data flow, re-confirmed fresh

```
client → discussReading.ts:
  load readings/{id}  (ownership-checked, turn-budget-checked, transactional)
  → toGrounding()      builds ReadingGrounding from stored fields
  → composeDiscussionReply()
      → toApiMessages() + buildDiscussionBrief()   [system brief: settled facts]
      → Claude Opus 5 (fetch)                      [Claude-generated text enters here]
      → parsed.answer                              [the exact field — see §2.2]
  → DiscussReadingResponse.answer  → client
```

### 2.2 Where Claude-generated text enters the server, and the exact response field

Confirmed by re-reading `discussionComposer.ts`'s `composeDiscussionReply()`
in full: the model's raw JSON response is parsed at
`JSON.parse(stripJsonFence(raw))`, and `parsed.answer` (after a
non-empty-string check) is the ONLY place free-form Claude text enters the
function. It flows, before this phase, directly into the returned
`DiscussionReply.answer` with only `.trim()` applied — no check of any
kind. `discussReading.ts` copies `reply.answer` verbatim into
`DiscussReadingResponse.answer`, the exact field returned to the client
and rendered in `ChatBubble.tsx`.

### 2.3 Authoritative `ReadingContract` fields available at that point

This is the reconnaissance step that most shaped the design.
`discussReading.ts` loads `readings/{id}` — a `ReadingDoc` — and, before
this phase, the ONLY watch-specific data persisted there was:

- `verdict: VerdictKind` — a six-value enum (`YES`/`NO`/`CONDITIONAL`/...),
  not the full `DisplayWatchVerdict`.
- `confidence: number`.
- `watchOracle?: WatchOracleComposition` — itself only a REDUCED
  `diagnosis` (outcome/primaryPattern/secondaryPatterns/timingPosture/
  confidence/obstructingAgent/rationale — missing `targetHouse`,
  `supportingHouses`, `obstructingHouses`, `qType`,
  `interventionNeeded`) and `protocol` (interventionRequired/guidance/
  steps/rationale).

**The full `judgment` (`DisplayWatchVerdict`) — `targetHouse`,
`targetSignName`, `direction`, `rulerRelation`, `reversal`, `factors`,
everything the entire Phase 5E chain's seven ground-truth checks compare
against — was never persisted to Firestore at all.** Confirmed by reading
`askWatchOracle.ts`'s pre-5F `readingDoc` assembly and `ReadingDoc`'s own
type definition in `types.ts`. Nor was `celestialEntities` (the allow-list
`checkCelestialEntities` needs).

This meant a faithful, type-correct `ReadingContract` (whose `judgment`
field is non-optional) could not be reconstructed from what was persisted
before this phase, at all — not partially degraded, genuinely absent.
Fabricating placeholder values for the missing fields was rejected outright
as a design option: a stub `judgment.targetHouse` would make
`checkHouseClaims` compare a genuine discussion claim against a fake
number, which would silently create NEW false positives — a materially
worse outcome than not running that check at all, and exactly the kind of
outcome this phase's "no new false positives" requirement forbids.

### 2.4 Can `validateNarration()` / the check functions be reused directly?

Yes, in full, once the ground-truth gap in §2.3 is closed — see §3.
Confirmed by reading every check function signature in
`narrationValidator.ts`: none branches on which of the five
`NarrationFields` keys it is nominally checking; each receives
`(contract, field, text)` and operates on `text` uniformly (the `field`
value is carried through only for the returned `ValidationFailure.field`,
used for logging). This makes it possible to reuse the exact same function
against a single free-text discussion reply without any modification to
`narrationValidator.ts` itself — confirmed empty diff, §7.

### 2.5 Existing fallback/error precedent

`discussionComposer.ts`'s own header, unchanged by this phase, already
states the file's design philosophy for a failed generation: "a reply that
failed to generate is simply not a reply. It returns null and the callable
turns that into an error the client can retry, rather than inventing
prose." `discussReading.ts`, on `reply === null`, already refunds the
discussion turn and throws
`HttpsError('unavailable', 'The oracle did not answer. Try again.')`.
This is a real, already-established precedent for exactly this content
type (conversational reply prose) — not analogized from the different
Path A precedent (silent deterministic-fallback substitution), which this
file's own header explicitly says does not apply here.

### 2.6 Safest failure behavior — decision made from the evidence in §2.5, not invented

**A validation failure is treated identically to a generation failure**:
`composeDiscussionReply()` returns `null`; `discussReading.ts`'s existing
`reply === null` branch (turn refund, `unavailable` error) handles it
without any new code path. No new "deterministic fallback discussion
text" was invented — the authorization explicitly warned against inventing
a new policy for convenience, and a fabricated fallback reply would itself
be exactly the kind of un-grounded prose this phase exists to prevent.
This satisfies the authorization's own listed candidate outcome
("rejection/error... or another already-established safe behavior")
using the behavior that was already there.

## 3. Implementation

### 3.1 Persisting the missing ground truth (closing §2.3's gap)

`composeWatchOracleResponse()` already builds a complete, frozen
`ReadingContract` at cast time (`readingContract.ts`) — it was computed,
used to validate the primary narration, and then discarded. This phase
persists it, unchanged, rather than reconstructing a lossy approximation
later:

- `responseComposer.ts`: `composeWatchOracleResponse()`'s return type
  changed from `Promise<WatchOracleComposition>` to
  `Promise<WatchOracleCompositionResult>` — a new, explicit two-field
  wrapper `{ composition, contract }`. `WatchOracleComposition` itself
  (the client-facing shape) is **byte-identical**, unchanged.
- `askWatchOracle.ts`: destructures `{ composition, contract }`; `composition`
  is used everywhere `oracleResponse` was used before (client response,
  `watchOracle` field); `contract` is written to a **new**
  `readingDoc.readingContract` field and is **never** included in the
  object returned to the client (`response`) — confirmed by inspection:
  `response` only ever spreads `oracleResponse` (the composition), never
  `readingContract`.
- `types.ts`: `ReadingDoc.readingContract?: unknown` — typed `unknown` for
  the identical, already-established reason `watchOracle?: unknown` is
  (keeps `types.ts` free of a dependency on the oracle module; narrowed at
  the one place that reads it back).

This is additive persistence of an already-computed value, not a change to
what `ReadingContract` means or how it is built — `readingContract.ts`
itself has a byte-identical diff (§7).

### 3.2 Reusing `validateNarration()` directly (closing §2.4)

`discussionComposer.ts` gained:

- `wrapReplyAsNarrationFields(answer)` — places the same reply text in all
  five `NarrationFields` keys. Safe because (§2.4) no check branches on
  the field name; this produces identical detection to validating the
  reply once, through the unmodified, existing per-field loop.
- `validateDiscussionReply(contract, answer)` — calls
  `validateNarration(contract, wrapReplyAsNarrationFields(answer))`
  unchanged, or skips validation (`{ valid: true }`) when `contract` is
  `null`.
- `DiscussionInput.contract: ReadingContract | null` — new field, the
  anchor reading's contract only (not any comparison reading's — an
  explicit, documented scope boundary, §8).
- `composeDiscussionReply()`: after parsing `answer`, calls
  `validateDiscussionReply(input.contract, answer)`; on failure, logs a
  warning (mirroring `responseComposer.ts`'s own log shape) and returns
  `null` — see §2.6.

`narrationValidator.ts` and `textSecurity.ts` — **zero lines changed**.
No second validator was built.

### 3.3 Wiring in `discussReading.ts`

- `asReadingContract(value)` — narrows `doc.readingContract` (typed
  `unknown`), mirroring the existing `asComposition()` pattern exactly
  (shape-checked, not asserted, since a Firestore round-trip is outside
  TypeScript's own guarantees).
- The anchor's contract is loaded once and passed as
  `composeDiscussionReply({ ..., contract })`.
- The existing `reply === null` branch (turn refund, `unavailable` error)
  is unchanged in its mechanics; its comment now notes it is also where a
  failed-validation reply lands, by design.

## 4. False-positive / false-negative controls and adversarial coverage

23 new permanent tests in
`functions/src/oracle/__tests__/discussionValidation.test.ts`, covering
every point the authorization required:

1. Valid discussion response → accepted.
2. Verdict contradiction → rejected.
3. Timing contradiction → rejected.
4. Unauthorized celestial entity → rejected.
5. Unsupported certainty → rejected.
6. Terminology leakage (6a) and internal-data leakage (6b) → rejected.
7. Fabricated house (7a), direction (7b), retrograde (7c), ruler-relation
   (7d), reversal (7e), and sign (7f) claims → each rejected.
8. Remedy contradiction → rejected.
9. Unicode obfuscation (5C-R: zero-width joiner/non-joiner) → still
   rejected.
10. Mid-word punctuation (5D-R, 10a) and Cyrillic confusable (5D-R, 10b)
    obfuscation → still rejected.
11. Four legitimate, varied-register conversational replies → all remain
    accepted.
12. A `null` contract (legacy reading, cast before this phase) skips
    validation entirely — existing discussion behavior preserved exactly.

Plus three integration tests calling the real `composeDiscussionReply()`
with a mocked Anthropic response, proving the wiring itself: a
contract-contradicting reply is not returned (`null`), a genuine reply is
returned normally, and a `null`-contract legacy reading's reply is not
blocked by validation it cannot run.

All 26 new tests pass; all 367 pre-existing tests continue to pass
unchanged (390 total, up from 367).

## 5. Adversarial harness — proving earlier hardening remains intact

`validateDiscussionReply()` is a thin wrapper over the unmodified
`validateNarration()` — the same function, the same `CHECKS` array, the
same `textSecurity.ts` canonicalization. Re-ran the full Phase 5C
adversarial-harness corpus
(`npx vite-node scripts/adversarial-harness/run.ts --out-dir=docs/audit/phase-5f`)
against that shared, unmodified pipeline:

```
generated: 11923, executed: 11923
falseNegativeCount: 0
falsePositiveCount: 0
exceptionCount: 0
contractMutations: 0
```

Identical to the Phase 5E-R4 baseline. No new bypass mechanism was
discovered by this run or by this phase's own testing; none is reported
here because none was found.

## 6. Regression matrix

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **390/390** (17 test files; was 367).
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304** — unaffected (this phase touches
  only `functions/src`).
- `node scripts/sync-engine.mjs --check` — clean.
- Phase 5C adversarial-harness corpus — **11,923/11,923, 0/0/0/0** (§5).
- Golden corpus: **not regenerated**; `git diff --stat -- docs/audit/golden-corpus/`
  empty.
- Replay check: **24/24** identical.

## 7. Prohibited-path verification

```
git diff --stat f84f97d..HEAD -- \
  src/astrology/ functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/oracle/textSecurity.ts \
  functions/src/oracle/narrationValidator.ts \
  functions/src/prompts/ firestore.rules docs/audit/golden-corpus/
```
Output: **empty** — engine, `kp/`, `ReadingContract`'s own schema/logic,
remedy library/selection, `textSecurity.ts`, `narrationValidator.ts`,
every prompt file, and `firestore.rules` are all byte-identical to the
Phase 5F reconnaissance checkpoint. No prompt architecture change was
required to connect validation — `ORACLE_DISCUSSION_PROMPT` and
`WATCH_ORACLE_SYNTHESIS_PROMPT` are both untouched.

Full changed-file list: `functions/src/functions/askWatchOracle.ts`,
`functions/src/functions/discussReading.ts`,
`functions/src/oracle/discussionComposer.ts`,
`functions/src/oracle/responseComposer.ts`, `functions/src/types.ts`,
the new `functions/src/oracle/__tests__/discussionValidation.test.ts`,
this document, and the `docs/audit/phase-5f/` evidence directory. No
other file.

## 8. Explicit scope boundaries and newly discovered findings

- **Comparison readings are not validated.** `discussReading.ts` supports
  discussing multiple readings at once (`compareReadingIds`); only the
  anchor reading's contract is loaded and validated against. A reply
  fabricating a claim about a COMPARISON reading specifically would not be
  caught by this phase. Recorded as an explicit, deliberate scope boundary
  (matching the authorization's own instruction not to expand scope
  beyond Finding F1's core case), not a silent gap — a future phase could
  extend `validateDiscussionReply()` to accept multiple contracts if the
  project owner decides that is warranted.
- **Legacy readings (cast before this phase shipped) cannot be validated**
  — `readingContract` is absent on them, and `validateDiscussionReply()`
  correctly skips validation rather than rejecting every reply on those
  threads. This is not a regression: those readings had zero validation
  before this phase too; this phase does not make them worse, it simply
  cannot yet make them better. They age out of the discussion surface
  naturally as `DISCUSSION_TURN_LIMIT`-bounded threads complete.
- **No new bypass mechanism was discovered.** The 11,923-case harness and
  this phase's own adversarial-shaped tests (Unicode/punctuation/confusable
  obfuscation combined with fabricated claims) all closed cleanly on the
  first implementation pass — no P1/P2 finding to report here, unlike
  several phases earlier in the 5E chain.
- **No previously accepted 5E residual was reopened.** All six residuals
  from `docs/audit/PHASE_5E_CLOSURE.md` §3 concern Path A's own
  check-specific edge cases (an unrelated "ruler" noun, retrograde
  meta-commentary, the fortune-idiom/ZWJ interaction, diagnostic-cause
  exclusion, the ordinal residual, repeated-character padding) — none is
  touched by extending the SAME checks to a second call site.

## 9. Final status

**PHASE 5F: PASS**

Finding F1 is closed: `discussReading`'s reply surface now runs through
the exact same deterministic validation architecture the primary
narration surface uses, grounded in the same `ReadingContract` a reading
was already validated against at cast time — reused, not duplicated.
Invalid Claude output cannot silently reach the client: confirmed both by
direct unit tests against the validation function and by integration
tests proving `composeDiscussionReply()` itself returns `null` for a
contract-contradicting reply, exactly as it already did for a generation
failure. Zero new judgment introduced, zero semantic/LLM interpretation
substituted for deterministic checks, zero prohibited-path drift, zero
regressions across 390 functions tests, 304 app tests, the 11,923-case
adversarial corpus, the golden corpus (untouched), and the 24-case replay.

Awaiting the independent 5F review gate. Not self-closed here — per the
authorization's own completion rule, this document reports PASS and
stops; it does not declare Phase 5F closed.
