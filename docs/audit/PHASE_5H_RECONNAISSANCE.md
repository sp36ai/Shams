# Phase 5H — Reconnaissance: The Post-Validation Trust Boundary

## 1. Objective

Authorized as reconnaissance only, following the Phase 5G formal closure.
Phases 5C-R through 5G established that model-generated narration is
validated against deterministic security and ground-truth checks. This
phase asks a different question: once narration has passed
`validateNarration()`, can any downstream transformation, persistence
layer, serialization path, client rendering path, history/cache path,
alternate delivery surface, retry/fallback path, or legacy-record path
cause unvalidated or altered model-originated content to reach the user?
Discovery only — no remediation performed.

## 2. Baseline

HEAD at the start: `423fce4` (Phase 5G formal closure). Independently
re-run, not trusted from any prior report:

| Check | Result |
|---|---|
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | **390/390**, 17 files |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | **304/304**, 27 suites |
| `node functions/scripts/sync-engine.mjs --check` | clean |
| Golden corpus | **111/111** case files present, untouched |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24** byte-identical |
| Prohibited-path diff (`f84f97d..HEAD`, all paths at once) | empty |
| Working tree | clean |

Re-run again at the end of this reconnaissance (§ below) with identical
results — no code was changed at any point.

## 3. Complete response-surface inventory

Reconfirmed from Phase 5G (unchanged): four Anthropic call sites total —
`askWatchOracle` (primary narration, validated), `discussReading`
(discussion reply, validated), `classifyQuestion` and `inferProfile`
(closed-enum classifiers, no claim surface). This phase adds the
**downstream** half of the map: what happens to the validated output of
the first two after `validateNarration()` returns.

## 4. Production data-flow map

Traced from actual current source, both server and client:

```
Claude draft (5 NarrationFields, or 1 reply text)
  → validateNarration() [server, functions/src/oracle/narrationValidator.ts]
  → composition = { narration: validated | deterministic-fallback, ... }
  → Firestore write: readings/{id}.watchOracle (+ .narration legacy copy,
    + .readingContract server-only)                          [askWatchOracle.ts]
    Firestore write: idempotency response record               [discussReading.ts]
  → callable HTTP response → client
  → client: WatchReading / DiscussReadingResult received       [firebase/watchOracle.ts, firebase/oracleDiscussion.ts]
  → client state: readingsStore (MMKV cache) / readingThreadsStore (in-memory + MMKV)
  → client rendering:
      - RemedyProtocolCard.tsx  — visible text, PER-FIELD, unconcatenated
      - ChatBubble.tsx (discussion bubble) — message.text, single field, unconcatenated
      - ChatBubble.tsx (reading bubble, TTS button) — speakableTextFor(),
        CONCATENATES three of the five fields
  → useTextToSpeech (on-device react-native-tts) — speaks whatever string
    it is given, verbatim, no independent generation
```

## 5. Post-validation transformation inventory

Searched systematically for every place validated narration is
concatenated, interpolated, reformatted, templated, truncated,
normalized, translated, decorated, combined with other text, or
reconstructed from structured fields, after `validateNarration()` has
already run.

- **Concatenation — found, and demonstrated exploitable (Finding 5H-1,
  below).** `src/components/oracle/ChatBubble.tsx`'s `speakableTextFor()`:
  ```ts
  export function speakableTextFor(reading: WatchReading): string {
    const narration = reading.oracle?.narration;
    if (narration !== null && narration !== undefined) {
      return [narration.rkp_finding, narration.interpretation, narration.recommended_approach]
        .filter(s => s.length > 0)
        .join('. ');
    }
    return STATE_HEADLINE[reading.verdict.state];
  }
  ```
  This runs entirely client-side, well after `validateNarration()` (a
  server-only function) has already returned. It joins three of the
  five validated `NarrationFields` into one new string that
  `validateNarration()` never saw as a whole — it only ever validated
  each of the five fields independently.
- **Legacy-field derivation — found, confirmed safe.**
  `askWatchOracle.ts`'s `readings/{id}.narration: Record<LangCode,
  string>` field is derived from a single already-validated field
  (`oracleResponse.narration.interpretation`) or the engine's own
  deterministic `factors` array — no concatenation, no new content.
- **Truncation** — `flattenText()` (`discussionComposer.ts`) truncates
  *transcript turns going INTO the model*, not narration coming out; not
  applicable to validated output.
- **Normalization/translation** — no translation pipeline exists
  anywhere; `ReadingDoc.narration` stores the same English-derived string
  under all three language keys (a pre-existing, documented shape, not
  new to this phase). No independent per-language generation occurs.
- **Templating/decoration with additional model output** — none found:
  `RemedyProtocolCard.tsx` renders each narration field as its own
  isolated `<Text>` node (`{narration.rkp_finding}`,
  `{narration.interpretation}`, etc., each a separate render, confirmed
  by direct read of lines 191, 194, 203, 277, 284) — the visible reading
  card never concatenates or decorates.
- **Reconstruction from structured fields** — `RemedyProtocolCard.tsx`
  also renders `protocol.steps` (remedy name/explanation/instructions),
  but those come from the static, deterministic `REMEDY_LIBRARY`, not
  from Claude — not a validation-relevant reconstruction.

## 6. Persistence / serialization analysis

Firestore write/read and JSON serialization fidelity were already
independently probed in the Phase 5F review (live
`JSON.parse(JSON.stringify(...))` round-trip against a real
`ReadingContract`, fingerprint-identical) and reconfirmed structurally
in the Phase 5G reconnaissance (single write point, no migration path,
`firestore.rules` blocking client writes to `/readings/{id}` entirely).
This phase re-traced the same paths for the *composition* (not just the
contract) and found nothing different: `oracleResponse` is written to
Firestore exactly as `composeWatchOracleResponse()` returned it, read
back by the client exactly as stored, with no intermediate
transformation on either side. MMKV persistence
(`src/stores/readingsStore.ts`) caches the server response object
verbatim (`storage.set(KEYS.READINGS_CACHE, JSON.stringify(trimmed))`)
— a straight cache of already-validated data, not a new generation path.

## 7. Client rendering analysis

Two rendering paths exist for the same underlying `WatchOracleComposition`:

1. **Visible screen text** (`RemedyProtocolCard.tsx`) — renders each of
   the five `NarrationFields` in its own `<Text>` element, never
   concatenated. What the seeker *reads* is exactly what
   `validateNarration()` checked, field by field.
2. **Spoken audio text** (`ChatBubble.tsx`'s `speakableTextFor()`, fed to
   `useTextToSpeech`) — concatenates three of the five fields into one
   string with a forced `'. '` separator between each. What the seeker
   *hears*, when they tap play, is a string `validateNarration()` never
   evaluated as a whole. See Finding 5H-1.

A discussion reply has only one field to begin with
(`wrapReplyAsNarrationFields()` places the same text in all five slots
at validation time), so `ChatBubble.tsx`'s discussion branch passes
`message.text` — the single validated `answer` string — directly to both
the visible `<Text>` and `onToggleSpeech`, with no concatenation
possible. The concatenation risk is confined to the **primary reading**
narration surface only.

## 8. Audio/TTS/alternate-surface analysis

`useTextToSpeech.ts` (`react-native-tts`) is confirmed, by direct read of
its own header and implementation, to be pure on-device playback: "no
audio leaves the device, no Cloud Function involved." It takes whatever
string its caller passes to `speak()`/`toggle()` and reads it aloud
verbatim — it does not independently query Claude, cache a different
version of the text, or reformat it beyond what the OS TTS engine does.
It is therefore not itself a new content-generation surface; it is a
faithful (if occasionally string-mangled by pause/resume slicing — an
availability/UX concern, not a safety one) reproduction of whatever text
it is handed. The safety question is entirely about *what string it is
handed* — answered in §5/§7 above.

No other alternate delivery surface exists: no notifications carry
narration text (checked — `PushNotification`-shaped code was not found
referencing oracle content), no export/share surface exists in the
current codebase (`src/data/readingShare.ts` was read; it formats
already-rendered fields for a share sheet, using the same per-field,
unconcatenated values `RemedyProtocolCard.tsx` displays — not the
`speakableTextFor()` concatenation), and no summarization pass exists
anywhere (`useSpeechToText.ts` is speech-to-*text* for the seeker's own
spoken *question*, an input surface, not a response surface — out of
scope for this phase's objective).

## 9. Retry/fallback analysis

- **Primary narration**: on synthesis failure, `narrate()` returns
  `null`; `composeWatchOracleResponse()` leaves `narration: null` — never
  raw or partial text. On validation failure, it substitutes
  `buildDeterministicFallbackNarration(contract)` — a template built only
  from contract fields, re-confirmed in this phase to contain no
  `fetch`/model call. Neither path can fall through to unvalidated
  Claude text.
- **Discussion reply**: on any failure (missing API key, HTTP error,
  timeout, malformed JSON, missing answer, or a failed
  `validateDiscussionReply()`), `composeDiscussionReply()` returns `null`
  — traced exhaustively as the *only* way to reach the caller without a
  valid, validated `answer` (re-confirmed: same seven-return-path
  enumeration as the Phase 5F review, unchanged). `discussReading.ts`'s
  `reply === null` branch throws `HttpsError('unavailable', ...)` — a
  fixed, translated client string, never the model's own text (§ below).
- **Client-side retry**: `ReadingScreen.tsx`'s `runDiscuss()` sets
  `status: 'failed'` with `errorMessage: errorMessageFor(err, t)` on any
  thrown error. `errorMessageFor()` (read in full) maps a small, fixed
  set of Firebase error *codes* to fixed, translated app strings — it
  never surfaces the server's raw error message text, let alone any
  model output. A retry re-invokes the full `discussReading()` call from
  scratch; there is no "resume from partial" or "reuse the rejected
  draft" path anywhere in the client.
- **Idempotent replay**: `claimRequest`/`completeRequest` store and
  replay the already-validated *response object* keyed by `requestId` —
  a replay returns exactly what was already validated and sent once, not
  a re-generation.

No path was found where a validation failure, a retry, or a cached
response can substitute raw, partial, or otherwise-unvalidated
model-originated text for the validated result.

## 10. Legacy-record analysis

- A reading with no `watchOracle`/`oracle` field at all (cast before
  Phase 3, or whose composition failed) renders no narration card at all
  (`RemedyProtocolCard` is conditionally rendered only when
  `reading.oracle !== undefined`), and `speakableTextFor()` falls back to
  `STATE_HEADLINE[reading.verdict.state]` — a fixed, app-defined string
  keyed by the engine's own verdict enum, not model-generated. No
  unvalidated text is ever substituted for a missing composition.
- A reading with no `readingContract` (cast before Phase 5F) — already
  traced in the 5F review and 5G reconnaissance — causes
  `asReadingContract()` to return `null`, which
  `validateDiscussionReply()` treats as "skip validation," preserving
  that reading's pre-5F discussion behavior exactly; not reopened here,
  and no new downstream consequence of this was found.
- No migration, backfill, or "upgrade legacy record" code path exists
  anywhere in the client or server (grepped for `regenerate`/`reNarrate`/
  `retryNarration` across both trees — no matches beyond an unrelated
  doc-comment use of the word "regenerated").

Legacy records degrade to fixed, deterministic, non-model text or to no
narration at all — never to raw or partial model output.

## 11. Trust-boundary / provenance table

| Displayed/spoken string | Source | Validation status | Transformation | Persistence | Rendering surface |
|---|---|---|---|---|---|
| Reading card narration text (screen) | `oracle.narration.<field>` | validated, per-field | none | Firestore `watchOracle` | `RemedyProtocolCard.tsx`, isolated per field |
| Reading TTS playback | same 5 fields, 3 of them | validated, per-field, **never as the concatenation actually spoken** | **join('. ') — new, unvalidated string** | not persisted (computed at render time) | `ChatBubble.tsx` → `useTextToSpeech` |
| Discussion bubble text (screen + TTS) | `discussReading` response `.answer` | validated (wrapped into all 5 fields, `validateDiscussionReply`) | none | Firestore idempotency record | `ChatBubble.tsx`, single field, both surfaces |
| Legacy-reading fallback text | `STATE_HEADLINE[verdict.state]` | not applicable — deterministic, app-defined, never model text | none | none (computed) | `ChatBubble.tsx` |
| Deterministic-fallback narration | `buildDeterministicFallbackNarration(contract)` | not applicable — template from contract fields, never model text | none | Firestore `watchOracle` | `RemedyProtocolCard.tsx` |
| Error/retry text | fixed code→string map | not applicable — never server/model text | none | none | `ChatBubble.tsx` failed state |

Every row is accounted for except the TTS-concatenation row, which is
exactly Finding 5H-1.

## 12. Fresh probe methodology

A minimal, deterministic, reproducible probe was built using the real
engine and the real `validateNarration()` (not a mock): construct a real
`ReadingContract` via the established `buildWatchChart → judgeWatchChart
→ diagnose → selectRemedyProtocol → buildReadingContract` pipeline
(the same fixture used across the 5F/5G reconnaissance work, contract
`judgment.reversal = 'NONE'`); construct a `NarrationFields` object whose
`rkp_finding` ends with an incomplete reversal claim ("...there may be a
reversal") and whose `interpretation` begins with the claim's completion
("remains possible, though nothing about this is settled yet."); run
`validateNarration()` against the fields exactly as the server does
(per-field); separately reproduce `ChatBubble.speakableTextFor()`'s own
join logic verbatim (`[rkp_finding, interpretation,
recommended_approach].filter(s => s.length > 0).join('. ')`) to obtain
the exact string a real seeker's device would pass to
`Tts.speak()`; then validate that concatenated string the same way
`validateDiscussionReply()`'s own established technique does — wrapping
it into a single-field `NarrationFields` object and calling
`validateNarration()` unchanged — to determine whether the server's own
validator would have rejected it, had it ever seen it as one string.

All other required probe areas (§ list below) were addressed by direct,
minimal code tracing rather than a constructed reproduction, with the
reasoning recorded for each — a probe was only built where tracing alone
could not settle the question.

## 13. Probe results

1. **Validated narration altered after validation** — **CONFIRMED,
   Finding 5H-1** (below). Per-field validation passes; the
   client-side TTS concatenation of the same fields contains a claim
   `validateNarration()` would reject.
2. **Alternate response field containing fabricated content** — not
   found. Every field on `WatchOracleComposition`/`DiscussReadingResponse`
   was enumerated (§7, §11); none carries independently-generated,
   unvalidated text.
3. **Cached/stale response substitution** — not found. MMKV and the
   idempotency store both cache the already-validated response object
   verbatim; no code path substitutes an older or different cached
   response for a current request's result.
4. **Serialization round-trip** — re-confirmed lossless (fingerprint-
   identical), consistent with the Phase 5F review's own live probe;
   not re-run from scratch here since nothing in the serialization code
   path changed since that probe.
5. **Retry after validation failure** — traced exhaustively (§9); always
   `null` → fixed error string, never raw text.
6. **Fallback after persistence failure** — `askWatchOracle.ts`'s
   Firestore-write failure is caught by the function's own outer
   `try/catch`, which refunds the quota slot and re-throws before any
   response is returned to the client — no partial/fallback content is
   ever served for a persistence failure.
7. **History/replay retrieval** — `readingsStore`/`readingThreadsStore`
   read back exactly what was cached from a real server response; no
   regeneration or independent replay-time composition exists.
8. **Audio/TTS source** — traced fully (§8); confirmed pure playback, no
   independent generation. The one gap found is in *what text it is
   given* (Finding 5H-1), not in the TTS mechanism itself.
9. **Legacy record without the new contract** — traced (§10); degrades
   safely to deterministic or absent content, never raw model text.
10. **Combined downstream transformation attack** — Finding 5H-1 is
    already the maximal case for this codebase: it requires no
    obfuscation, no Unicode trickery, and no interaction with the
    3-tier canonicalization at all — it is a purely structural gap (the
    validator checks fields the client never displays/speaks in
    isolation, and speaks a string the validator never checked as a
    whole). Layering 5D-R-style obfuscation on top of it was not
    additionally probed, since the base finding already demonstrates
    the bypass without needing it, and doing so would not change the
    finding's classification.

## 14. Findings, with severity

### Finding 5H-1 (P1) — TTS concatenation bypasses per-field validation

`ChatBubble.speakableTextFor()` joins `rkp_finding`, `interpretation`,
and `recommended_approach` — three of the five `NarrationFields` — with
a forced `'. '` separator, entirely client-side, to build the string
handed to on-device text-to-speech. `validateNarration()` runs
server-side, once, per field, and never sees this three-field
concatenation as a single string.

**Demonstrated reproduction** (§12/§13.1): a contract with
`judgment.reversal = 'NONE'`; `rkp_finding` ending "...there may be a
reversal" (no completion word present — `REVERSAL_CLAIM_PATTERN` does
not match this field alone); `interpretation` beginning "remains
possible, though nothing about this is settled yet." (no "reversal"
word present — the same pattern does not match this field alone
either). `validateNarration()` against each field individually: **valid
= true**. The exact string `speakableTextFor()` would produce and hand
to `Tts.speak()`: `"...there may be a reversal. remains possible,
though nothing about this is settled yet. ..."`. Validating that
concatenation the same way the server validates any single field:
**valid = false**, `REVERSAL_CLAIM_CONTRADICTION` — "narration claims
reversal 'possible', but judgment.reversal is NONE."

This means: a narration that passes every one of the 16 deterministic
checks at persist time, and is correctly displayed on screen (§7 — the
screen renders each field separately, so the visible text never forms
this claim), can still cause the seeker to *hear*, via the existing
play-button/TTS feature, a claim about their own reading's ground truth
that directly contradicts `judgment.reversal` — the exact class of harm
Phase 4 through 5F built the entire ground-truth validation pipeline to
prevent. It does not require any client tampering, forged request, or
Firestore access: the vulnerable string is constructed by ordinary,
unmodified, currently-shipping app code from an ordinary, validly
persisted reading.

Not classified as P0: it does not bypass validation on the *primary*,
*visible* surface (the screen still shows exactly what was validated),
it requires a specific claim to be split across a specific field
boundary (not every reading is at risk — this depends on where Claude's
own prose happens to break across the five JSON fields it drafts), and
it is confined to one specific optional feature (the TTS play button)
rather than the reading's default presentation. It is classified P1
because it is a reproducible, demonstrated bypass — not hypothetical —
that can deliver a fabricated/contradicted ground-truth claim to a real
user through a real, currently-shipping downstream surface, matching
the P1 definition in this phase's authorization exactly.

No other check in the 16-check pipeline was separately probed for the
same cross-field boundary risk beyond `checkReversalClaims` — the
mechanism (validator operates per-field; client concatenates
multi-field) applies structurally to every check that can fire from a
short, bounded phrase or pattern (verdict assertions, certainty
phrases, house/sign/direction/retrograde/ruler-relation claims, remedy
substitution, celestial-entity naming) wherever the model's own prose
happens to place the relevant words near a field boundary — this is not
limited to the one check demonstrated.

### No P0 findings.
### No new P2/P3 findings.

## 15. Carried-forward findings — explicitly separated, not reopened

None of the following were touched, retested, or found materially
relevant by any post-validation path traced in this phase; all remain
exactly as previously accepted:

- 5D-R residual punctuation variants
- excluded Cyrillic/Armenian case
- repeated-character padding
- 5E residual ruler-noun collision
- retrograde meta-commentary limitation
- three-tier fallback/ZWJ interaction
- diagnostic-cause fabrication
- ordinal/date residual
- 5G-1 celestial-vocabulary limitation

Finding 5H-1 is new: it is not a variant of any pre-validation
obfuscation/false-positive residual above — those all concern what the
validator does or does not catch *within* a single field's own text.
5H-1 concerns a downstream *architectural* gap (a client-side
transformation the validator structurally cannot see), which is exactly
the distinct-downstream-amplification threshold this authorization's
§6 set for treating something as new rather than carried-forward.

## 16. Scope recommendation for a potential 5H-R

Offered as options only — no scope decision made here:

1. **Validate the concatenation itself, not remediate by broadening any
   check.** The narrowest fix consistent with this codebase's own
   established pattern (`validateDiscussionReply()`'s
   `wrapReplyAsNarrationFields()` technique, Phase 5F) would be for the
   server to additionally validate the exact string
   `speakableTextFor()` will produce — e.g. running
   `validateNarration()` a second time against the three-field join
   (or, more generally, against the full concatenation of all five
   fields) before accepting a draft, at the same point
   `responseComposer.ts` already validates each field individually. This
   would not touch `narrationValidator.ts`'s own check logic at all —
   only where/how many times it is invoked.
2. **Move the join server-side and validate the joined result once,
   instead of per-field.** A larger change: compute the TTS-spoken
   string once, server-side, and validate exactly that string (dropping
   or supplementing today's five-way per-field validation). Larger
   architectural surface, not recommended as the first option given the
   narrower fix above appears sufficient.
3. **Constrain `speakableTextFor()` to a single field instead of
   concatenating three.** Smallest possible client-only change (no
   validator involvement at all) — but changes the TTS feature's own
   content (currently intentionally reads finding + interpretation +
   approach together), a product decision outside this reconnaissance's
   authority to make.
4. **Defer, accepted as a residual**, if the risk is judged acceptable
   given the narrower conditions under which it manifests (a specific
   field-boundary split, TTS feature only, screen text unaffected).

No implementation was attempted for any option.

## 17. Explicit statement that no implementation occurred

No production code, test, engine, validator, prompt, or UI file was
modified during this reconnaissance. All probe code was written to a
scratch location outside the tracked tree and removed before this
report was written. Confirmed at the end of this reconnaissance (all
independently re-run, not restated from §2):

| Check | Result |
|---|---|
| `git status --porcelain` | clean |
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | 390/390 |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | 304/304 |
| `node functions/scripts/sync-engine.mjs --check` | clean |
| Golden corpus | 111/111, untouched |
| Replay | 24/24 |
| `textSecurity.ts` unchanged | empty diff since `f84f97d` |
| `narrationValidator.ts` unchanged | empty diff since `f84f97d` |
| Engine unchanged | empty diff since `f84f97d` |
| `ReadingContract` unchanged | empty diff since `f84f97d` |
| App/UI unchanged | empty diff since `f84f97d` (entire `src/` tree) |

This document does not implement Finding 5H-1's remediation, does not
open Phase 5H-R, does not close Phase 5H itself, and does not begin
Phase 5I.

---

**PHASE 5H: RECONNAISSANCE COMPLETE — FINDINGS**

One P1 finding (5H-1): a client-side TTS-text concatenation
(`ChatBubble.speakableTextFor()`) can reconstruct a ground-truth claim
split across two validated `NarrationFields`, producing a spoken string
`validateNarration()` never checked as a whole and would have rejected
had it done so. Demonstrated with a real engine-built contract and the
real validator, not a hypothetical. No P0 finding. No 5E/5F/5G residual
reopened. Awaiting an explicit scope decision.
