# Phase 5F — Reconnaissance

**PHASE 5F: RECONNAISSANCE COMPLETE — PASS WITH FINDINGS**

Reconnaissance only. No production code was modified — confirmed by
`git status --porcelain` empty at the end of this phase and no diff
against the Phase 5E closure checkpoint (`5c01517`) anywhere.

## 1. Baseline established at the 5E closure checkpoint

- `cd functions && npx tsc --noEmit` — clean.
- `cd functions && npm run lint` — clean.
- `cd functions && npx vitest run` — **367/367** (16 test files).
- `npm run typecheck` (app root) — clean.
- `npm run lint` (app root) — clean.
- `npm run test` (app root) — **304/304** (27 test suites).
- `node scripts/sync-engine.mjs --check` — clean.
- Golden corpus: not regenerated; `git diff --stat -- docs/audit/golden-corpus/`
  empty.
- Replay check: **24/24** identical.
- `git status --porcelain` — empty at the start of this phase.

Every figure above matches the Phase 5E closure record
(`docs/audit/PHASE_5E_CLOSURE.md` §5) exactly — no drift.

## 2. Verified production data-flow map

Traced from actual source, not documentation. Two structurally distinct
production paths generate user-facing prose about a reading; the 5A–5E
chain hardened only the first.

### Path A — initial reading narration (`askWatchOracle` → `responseComposer.ts`)

```
buildWatchChart → judgeWatchChart → classifyQuestion
      ↓
diagnose() → selectRemedyProtocol()          [deterministic, RKP-authoritative]
      ↓
buildReadingContract()                       [PHASE 3 — immutable, frozen]
      ↓
narrate()  →  Claude Opus 5 (draft prose)
      ↓
validateNarration(contract, drafted)         [PHASE 4/4A/5C-R/5D-R/5E-R…R4]
      ↓ valid                                  ↓ invalid
  drafted narration used              buildDeterministicFallbackNarration(contract)
      ↓
WatchOracleComposition (frozen) → readings/{id}.watchOracle  → client response
                                → readings/{id}.narration.{en,ur,hi}  [legacy field, see §4 Finding F1]
```

Confirmed by reading `askWatchOracle.ts` (full file) and
`responseComposer.ts` (full file). `validateNarration()` runs
unconditionally whenever synthesis produced a draft (`drafted !== null`);
a validation failure is logged and silently replaced with the
deterministic fallback before anything is persisted or returned. This is
exactly what Phases 4/4A/5C–5E hardened, and it holds at this checkpoint.

### Path B — follow-up discussion (`discussReading` → `discussionComposer.ts`)

```
client: readingId + transcript + new message
      ↓
discussReading.ts: load readings/{id} from Firestore, ownership-checked,
  turn-budget-checked (server-loaded grounding — client never supplies
  the verdict/diagnosis/remedy)
      ↓
composeDiscussionReply() → Claude Opus 5 (free-text reply)
      ↓
      NO VALIDATION STEP OF ANY KIND
      ↓
DiscussReadingResponse.answer  →  client, rendered directly in the
                                    conversation UI (ChatBubble.tsx)
```

Confirmed by reading `discussReading.ts` (full file) and
`discussionComposer.ts` (full file), and by `grep`ing
`discussionComposer.ts` for any reference to `validateNarration` or any
of the individual check functions — **zero matches**. The file's own
header states plainly: "Unlike narration, this layer has no deterministic
fallback: a reply that failed to generate is simply not a reply" — this
is true for the *generation-failure* case (HTTP error, timeout,
malformed JSON — all still return `null`, correctly), but there is no
sibling statement about content *validation*, because none exists. The
only defenses this path has are: (a) prompt-injection structural
containment (the transcript travels as chat messages, never interpolated
into the system brief — a real, legitimate mitigation, but only for
injection, not for content fabrication), and (b) `ORACLE_DISCUSSION_PROMPT`,
a system-prompt-only instruction set — the same category of defense the
project's own Phase 4 was explicitly commissioned to move beyond for
Path A, and that Phase 0's own findings (referenced in Phase 4's design
record) judged insufficient on its own.

**This path is live and reachable**, not dead code: `discussReading` is
wired into `src/screens/ReadingScreen.tsx`,
`src/components/oracle/ChatBubble.tsx`, and
`src/stores/readingThreadsStore.ts` — confirmed by `grep` across the
client source tree.

### Path C — profile inference (`inferProfile.ts`)

A third Claude-backed callable, used once during onboarding to classify a
seeker into one of exactly four fixed enum values (`clarity`/`comfort`/
`action`/`surrender`). No free-text prose reaches the user from this
path — the model's raw text output is (per the file, confirmed by
reading it) constrained against `VALID_PROFILES` before use. **Not a
narration-safety surface** — excluded from 5F's scope on this evidence,
not by assumption.

## 3. Already-closed protections (Path A only) — re-confirmed present, not re-tested

- Unicode/confusable/punctuation obfuscation resistance (5C-R/5D-R) — the
  three-tier canonicalization fallback, intact.
- Ground-truth structural/relational claim checks (5E chain) — house,
  sign, direction, retrograde, ruler-relation, reversal, supporting-house.
- Verdict/timing/remedy/celestial/diagnosis consistency (Phase 4/4A).
- Terminology and internal-data leakage deny-lists (Phase 4/4A).
- Prompt-injection-artifact detection (Phase 4).
- Structural remedy containment: remedy names/instructions/evidence
  copied verbatim from `REMEDY_LIBRARY` after the model returns, never
  model-authored (Phase 0 design, unchanged, re-confirmed present in
  `responseComposer.ts`).
- Non-mutation guarantee: `validateNarration()` never rewrites
  `NarrationFields` or `ReadingContract` (5C-R's own dedicated proof,
  still in the test suite).

None of the above apply to Path B — confirmed by the `grep` in §2.

## 4. Remaining gaps, classified

### Finding F1 (P0) — `discussReading`'s narration surface has zero deterministic content validation

**This is the primary finding of this reconnaissance.** Every attack
class the reconnaissance brief asked about applies here, structurally,
because the safety mechanism the 5A–5E chain built simply does not run on
this path at all:

- **Fabricated judgment / narration-contract mismatch:** nothing checks
  whether a discussion reply's claims about the verdict, diagnosis,
  timing, remedies, or any structural fact (house, sign, direction,
  retrograde, ruler-relation, reversal — the exact eight categories the
  5E chain spent four remediation-plus-review cycles on) agree with the
  `ReadingGrounding` the model was actually given. A reply could restate
  the reading's outcome incorrectly, invent a timing claim, or fabricate
  a structural fact, and nothing would catch it before it reaches the
  seeker.
- **Validator bypass, structurally:** not a bypass of
  `narrationValidator.ts`'s specific mechanisms (those were never
  connected to this path to begin with) — a parallel, unguarded surface.
- **Terminology / internal-data leakage:** no deny-list check exists on
  this path. Nothing prevents a discussion reply from surfacing internal
  vocabulary (`RKP`, `house matrix`, a file path, etc.) the way Phase 4A's
  review gate originally demonstrated for the primary narration path,
  before that path was hardened.
- **Authority/provenance:** the grounding itself IS correctly
  authoritative — `discussReading.ts` loads the stored reading
  server-side and never accepts a client-supplied verdict (confirmed by
  reading the file; this is a genuine, correctly-built structural
  guarantee). The gap is not in what the model is TOLD, it is in nothing
  checking what the model SAYS back.
- **Not exploitable via prompt injection alone** (that specific vector is
  structurally contained, per §2) **but does not require injection at
  all** — an ordinary, unprompted model inconsistency or hallucination in
  a free-text reply reaches the seeker with the same lack of a
  deterministic backstop the original narration path had before Phase 4
  existed.

**Reproduction is not yet possible without a live Anthropic API call**
(this reconnaissance made none, per its own "no network calls" boundary
— the same restriction 5A/5D/5E reconnaissance phases operated under).
The finding here is structural and code-verifiable without one: `grep -n
"validateNarration\|ValidationFailure" functions/src/oracle/discussionComposer.ts`
returns nothing, and `composeDiscussionReply()`'s return value
(`reply.answer`) is used by `discussReading.ts` with only a
non-empty-string check (`typeof parsed.answer !== 'string' ||
parsed.answer.trim().length === 0`) before being sent to the client
unmodified.

**Severity: P0.** This is not a narrower variant of anything the 5E chain
already accepted as a residual — none of the six residuals in
`PHASE_5E_CLOSURE.md` §3 concern this path, and this finding does not
reclassify or reopen any of them (confirmed directly in §6 below). This
is the single largest gap in the narration-safety surface as it stands
today: an entire, live, user-facing content-generation surface with none
of nine phases' worth of deterministic hardening applied to it.

### Finding F2 (P3, informational) — the legacy `readings/{id}.narration.{en,ur,hi}` field carries weaker provenance than the structured composition, but has no live client read path

In `askWatchOracle.ts`, the reading document's legacy `narration.{en,ur,hi}`
field is set from `oracleResponse?.narration?.interpretation` when
composition succeeds (in which case it is the SAME validated-or-fallback
text `watchOracle.narration.interpretation` carries — no divergence), but
falls back to raw `verdict.factors.join(' ')` (static, hand-authored
engine strings, never AI-generated or user-influenced) in the narrow case
where `composeWatchOracleResponse()` itself throws — which, given
`narrate()`'s own internal try/catch swallows every synthesis failure
mode already, should be rare, limited to a genuine bug in one of the
deterministic upstream steps (`diagnose`, `selectRemedyProtocol`,
`buildReadingContract`, `validateNarration`, or
`buildDeterministicFallbackNarration` themselves throwing).

Traced whether this field is ever read back by the client: `grep`-ing
the entire client source tree for any Firestore read of the `readings`
collection (`collection('readings')`, `doc('readings...`) — **zero
matches**. The client never re-fetches a reading from Firestore; it
caches the callable's direct response locally (`readingsStore.ts`,
`readingThreadsStore.ts`) and reads exclusively from the structured
`watch_oracle.composition.narration` field thereafter
(`readingShare.ts` confirmed as one such consumer). The legacy field is
effectively write-only from the app's own perspective today.

**Severity: P3, informational.** Not a live attack surface — no reachable
path delivers this field's content to a user. Recorded for completeness
and data-hygiene clarity, not as something 5F needs to remediate; a
future schema cleanup (removing the field, or unifying it with the
structured composition) is a legitimate but separate, non-safety-critical
consideration.

### No further P0/P1 findings

The remaining attack classes the authorization asked about — persisted-
data substitution, client-side reinterpretation, stale/cross-reading
contamination, unsafe fallback behavior beyond F1/F2 — were traced and
found already adequately addressed at this checkpoint:

- **Persisted-data substitution:** `ReadingContract` is built once, frozen,
  and every downstream consumer (validator, discussion grounding) reads
  from it or the reading document it produced — no code path was found
  that reconstructs or second-guesses a contract's fields after the fact.
- **Client-side reinterpretation:** the client renders `NarrationFields`
  and the structured composition largely as opaque strings (confirmed by
  a targeted read of `ChatBubble.tsx`'s rendering — no re-parsing or
  re-derivation of judgment from narration text was found).
- **Stale/cross-reading contamination:** `discussReading.ts`'s
  transaction-scoped ownership and turn-budget check, and its explicit
  per-reading grounding construction (`toGrounding()`), correctly isolate
  one reading's discussion from another's, including the multi-reading
  comparison path (`compareReadingIds`), which is filtered to
  owner-matched documents only inside the same transaction.
- **Unsafe fallback behavior on Path A:** re-confirmed intact at this
  checkpoint (§3); `buildDeterministicFallbackNarration()` was not
  re-audited line-by-line in this pass (it was in scope for Phase 4's own
  original design and has not been touched by 5C–5E), and no evidence
  surfaced suggesting it needs to be.

## 5. The six accepted 5E residuals — explicitly re-checked, not reclassified

Directly re-read against `PHASE_5E_CLOSURE.md` §3 and confirmed none is
silently being folded into 5F's scope by this reconnaissance:

1. Unrelated "ruler" noun collision (P3) — `checkRulerRelationClaims`,
   Path A only. Untouched, not reopened.
2. Retrograde meta-commentary limitation (P3) —
   `checkRetrogradeClaims`, Path A only. Untouched, not reopened.
3. Three-tier fallback / ZWJ-inside-"fortune" interaction (P3,
   informational) — `checkReversalClaims`, Path A only. Untouched, not
   reopened.
4. Diagnostic-cause fabrication, intentionally unimplemented —
   `diagnosis.rationale` free text, Path A only. Untouched, not reopened.
5. Non-house/non-date ordinal residual — `checkTimingConsistency`, Path A
   only. Untouched, not reopened.
6. Repeated-character padding — out of scope since Phase 5D. Untouched,
   not reopened.

All six are Path-A-specific, narrow residuals of an already-hardened
mechanism. Finding F1 is categorically different: it is not a residual
of anything the 5E chain touched — it is a second production surface the
5E chain (and every phase before it back to Phase 4) never reached.

## 6. Is the original planned 5F objective still appropriate?

No conversational record of an original 5F roadmap item exists in this
repository's own committed history (unlike 5C/5D/5E, no
`PHASE_5F_*` groundwork document predates this reconnaissance) — this
phase's own authorization explicitly asked not to assume any prior
roadmap is still accurate, and this reconnaissance found no such roadmap
to compare against in the first place. The scope below is derived
entirely from the evidence in §2–§4, not from an inherited assumption.

## 7. Proposed 5F implementation scope

**Primary: close Finding F1.** Extend deterministic, non-LLM validation
to `discussReading`'s reply path, mirroring — not duplicating — the
architecture Phase 4 already established for Path A:

- A discussion-reply analog of `validateNarration()`, checking a reply's
  claims against the SAME `ReadingGrounding` data
  `discussionComposer.ts` already builds its brief from (verdict,
  diagnosis outcome/pattern/timing/obstructing-agent,
  `oracle.narration` if present) — reusing the existing check functions
  where the shape matches (e.g. verdict-polarity, timing-fabrication,
  terminology/internal-data-leakage checks are largely input-shape-
  agnostic already) rather than reimplementing them.
- A defined fallback behavior for a reply that fails validation —
  `discussionComposer.ts`'s own header already states no deterministic
  fallback exists for a conversational reply; the 5F implementation
  phase should treat this as an open design question, not silently
  invent one during reconnaissance. Candidate shapes (regenerate once,
  fail closed with a retry-prompting error, or a fixed "I can't confirm
  that — here is what your reading actually said" template) are Category
  B decisions in the same sense Phase 5D's own severity rubric uses that
  term — they require the project owner's decision, not a speculative
  default.
- Explicit non-goals to prevent this from becoming Path A's nine-phase
  effort repeated wholesale: this scope note is Category A/B triage, not
  a claim that Path B needs the SAME four-round false-positive-discovery
  cycle Path A's reversal check needed — that emerged from Path A's own
  specific phrase-based discriminators, which a from-scratch Path B
  implementation should design to avoid repeating (e.g. by reusing the
  now-mature Path A check functions directly rather than rebuilding
  bespoke idiom-collision-prone detectors from zero).

**Secondary, optional:** Finding F2's data-hygiene cleanup — explicitly
NOT recommended as part of 5F's own critical path, since it carries no
live risk; note it for the project owner's own backlog only if 5F's
implementation phase has capacity, and not otherwise.

## 8. Explicit exclusions from 5F

- Path A's validator (`narrationValidator.ts`, `textSecurity.ts`) —
  untouched by this reconnaissance and not proposed for further
  hardening; the 5E chain's own closure record stands.
- Any of the six accepted 5E residuals — not reopened.
- `inferProfile.ts` (Path C) — confirmed out of scope, bounded-enum
  output only.
- Engine, `ReadingContract` authority, remedy taxonomy/selection/library,
  prompts, UI/app behavior, `kp/`, golden corpus, replay fixtures — none
  touched or proposed for modification.
- `buildDeterministicFallbackNarration()` (Path A's own fallback
  mechanism) — not re-audited in this pass; out of scope unless a future
  finding specifically implicates it.

## 9. Acceptance criteria for a future 5F remediation phase

Modeled on the acceptance discipline the 5E chain itself established:

1. A deterministic, non-LLM validation step runs on every discussion
   reply before it reaches the client, grounded in the same
   `ReadingGrounding`/reading-document data `discussReading.ts` already
   loads — no new client-supplied trust input.
2. Zero new judgment computed — every check compares the reply against a
   value the engine (or the already-validated Path A narration) already
   produced, exactly as every Path A check does today.
3. A defined, explicit fallback behavior for a reply that fails
   validation, decided by the project owner before implementation begins
   (per §7), not invented silently during the remediation phase.
4. Permanent regression tests: genuine grounding-consistent replies stay
   valid; constructed grounding-contradicting replies are caught;
   legitimate conversational language (empathy, rephrasing, clarifying
   questions) is not falsely flagged — the same "0 new false positives"
   discipline every Path A remediation round in the 5E chain was held to.
5. Full regression matrix (functions/app tests, typecheck, lint, engine
   mirror sync, golden corpus byte-identity, replay determinism,
   prohibited-path diff) clean, exactly as every prior phase's gate.
6. An independent review gate, following this project's own established
   pattern, before any 5F implementation is declared closed.

---

**PHASE 5F: RECONNAISSANCE COMPLETE — PASS WITH FINDINGS**

No implementation was performed. No hard-stop condition was triggered
requiring this reconnaissance to halt (no P0/P1 was found that could not
be cleanly separated from an already-closed phase; Finding F1, though
P0-severity, is a newly-identified, previously-untouched surface, not
drift in anything the 5E chain closed). No production behavior, test,
engine file, `textSecurity.ts`, prompt, UI, golden corpus, replay
fixture, or accepted 5E residual was modified. Awaiting explicit
authorization for the actual 5F implementation scope. Phase 5F-R and
Phase 5G not begun.
