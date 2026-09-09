# Phase 5I — Adversarial Oracle / Production-Behavior Hardening

Implementation checkpoint against `2204a8f` (Phase 5H-R2 independent
review — PASS). This is an implementation checkpoint only; it requires
its own independent Phase 5I Review Gate. It does not close Phase 5H and
does not begin Phase 6.

## 1. Starting checkpoint

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- HEAD at start: `2204a8f`, confirmed via `git rev-parse HEAD`.
- Working tree: clean.
- Baseline, independently re-run before any code was touched: functions
  437/437, app 306/306, both typecheck/lint clean, mirror sync clean,
  golden corpus 111/111 untouched, replay 24/24, adversarial harness
  11923/0/0/0/0.

## 2. Pipeline fresh-read and inventory

Traced the complete path fresh, confirming against the actual current
source (not restated from prior audit documents):

```
ReadingScreen.tsx (the actual chat screen — no file named
  "OracleChatScreen" exists in this codebase)
  → askWatchOracle / discussReading (Cloud Functions)
  → buildWatchChart → judgeWatchChart (engine, deterministic)
  → diagnose → selectRemedyProtocol (deterministic)
  → buildReadingContract (immutable, frozen ReadingContract)
  → responseComposer.narrate() / discussionComposer's fetch (Claude Opus 5)
  → validateNarration() (narrationValidator.ts, 16 checks)
  → buildSpeakableText() (the TTS-artifact join, single-space separator
    since Phase 5H-R2) → validateNarration() again on the joined artifact
  → composition.speakableText (persisted, returned to client, never
    reconstructed client-side)
  → ChatBubble.speakableTextFor() (pure relay)
  → useTextToSpeech.speak() → Tts.speak()
```

**Every model-generated-text entry point**, confirmed by grepping the
entire `functions/src/` tree for `fetch('https://api.anthropic.com...')`
(unchanged from the Phase 5G/5H reconnaissance's own exhaustive count):
exactly four — `askWatchOracle` (primary narration, validated),
`discussReading` (discussion reply, validated), `classifyQuestion` and
`inferProfile` (closed three/four-value enums, no free-text claim
surface, structurally unable to carry a claim).

**Every current validator and fallback**, confirmed directly from
`narrationValidator.ts`'s own `CHECKS` array: `checkVerdictConsistency`,
`checkTimingConsistency`, `checkRemedyConsistency`,
`checkCelestialEntities`, `checkDiagnosisConsistency`,
`checkHouseClaims`, `checkSupportingHouseClaims`, `checkSignClaims`,
`checkDirectionClaims`, `checkRetrogradeClaims`,
`checkRulerRelationClaims`, `checkReversalClaims`,
`checkUnsupportedCertainty`, `checkTerminologyLeakage`,
`checkInternalDataLeakage`, `checkPromptInjectionArtifacts` — 16 total —
plus the structural `checkWellFormed()` (type/emptiness guard, run before
any of the 16) and `buildDeterministicFallbackNarration()` (the sole
fallback, built only from contract fields, never re-validated by design
since it cannot itself state a contract-contradicting claim).

## 3. Workstreams executed, with evidence

Given the codebase has already been through five prior deep,
independently-reviewed hardening phases (5C-R, 5D-R, 5E chain, 5F, 5G,
5H/5H-R/5H-R2) covering exactly this territory, this pass prioritized
genuinely fresh adversarial probing over re-deriving already-settled
conclusions, per the authorization's own instruction: "Do not assume a
defect exists. Prove each finding."

### 5I-B — Structured-output boundary: type confusion (tested, confirmed SAFE)

Hypothesis investigated: `narrate()`'s pre-validation field-presence
check (`!parsed.rkp_finding || ...`) is a truthiness check, not a
`typeof` check — a numeric or object value for a required field would
pass it (since `!123` is `false`), and the subsequent `as
Partial<NarrationFields>` type assertion provides zero runtime safety.
Live-tested: constructed a mocked Claude response with `rkp_finding: 12345`
(a number). Result: **not exploitable**.
`narrationValidator.ts`'s `checkWellFormed()` — run first, before any of
the 16 content checks — independently enforces `typeof value !== 'string'`
on every required field (confirmed by direct read, `narrationValidator.ts`
lines ~1384–1399) and is explicitly documented as "a second,
defense-in-depth check" for exactly this scenario. The live probe
produced `MALFORMED_OUTPUT` and the deterministic fallback, not a crash
and not corrupted content. No finding.

### 5I-D — Prompt-injection boundary (architectural verification, not re-tested exhaustively)

Confirmed by direct trace, not by writing dozens of new injection-phrase
tests (the existing 11,923-case harness already carries a dedicated
35-case `injection-artifacts` category at 0 false-negatives, and the
5C-R/5D-R/5E chains already established the "checks compare against the
contract, not against recognizing the injection attempt" architecture):
`judgeWatchChart()` runs and produces `verdict` in `askWatchOracle.ts`
*before* `composeWatchOracleResponse()` is ever called, and
`composeWatchOracleResponse()` receives `verdict` as an input parameter
— it does not derive it from the question. This makes it structurally
impossible, not merely improbable, for question text (however phrased,
however successfully it might manipulate Claude's own drafted prose) to
retroactively alter judgment truth. A successful injection can only
produce narration *text* that contradicts the (already-fixed) contract
— which is exactly what the 16 checks, run regardless of why the text
says what it says, exist to catch. No new finding; existing coverage
re-confirmed architecturally.

### 5I-E — Debranding / internal leakage: **Finding 5I-1 (P2)**

Probed `PROHIBITED_TERMINOLOGY` (the deny-list `checkTerminologyLeakage()`
scans) with terms outside this app's own internal architecture
vocabulary: `Claude`, `Anthropic`, `OpenAI`, `GPT`, `Firebase`,
`Firestore`, `Cloud Function`, `large language model`, `machine
learning`, `neural network`, `training data`, `system prompt`. **All
twelve passed through `validateNarration()` uncaught** — the deny-list
was scoped entirely to this app's own engine/architecture vocabulary
(`RKP`, `watchJudgment`, `ReadingContract`, ...), with no coverage at
all for vendor, cloud-infrastructure, or AI-industry identity terms.

Reproduction (before fix): `validateNarration(contract,
wrapAsAllNarrationFields('...note that Claude was involved...'))` →
`valid: true`.

Root cause: `PROHIBITED_TERMINOLOGY` was populated only from
previously-demonstrated leaks of this codebase's own internal naming —
no prior phase had specifically probed for vendor/infrastructure
identity terms.

Fix: a twelve-term, narrowly-scoped addition to the existing
`PROHIBITED_TERMINOLOGY` array — the same deny-list mechanism, not a new
check, not a general vendor-name scanner. See §4 for the exact diff and
rationale for each term's inclusion.

Severity: P2. Not a truth-corruption issue (nothing here lets narration
alter engine judgment) and not demonstrated as reachable through the
current, tightly-controlled system prompt (the mystical Shams al-Asrār
voice has no reason to name its own infrastructure) — but a real,
reproducible gap in the defense-in-depth layer that exists specifically
to catch exactly this class of leak regardless of prompt behavior,
matching this check's own stated purpose for every other term already
in the list.

### 5I-A — Contract integrity: structural JSON attacks (tested, confirmed SAFE)

- **Hidden/extra JSON keys**: `narrate()` and `composeDiscussionReply()`
  both destructure only named fields (`parsed.rkp_finding`,
  `parsed.answer`, etc.) from the parsed JSON — never `{...parsed}`.
  Extra keys in Claude's own JSON response are structurally inert; there
  is no code path that reads or forwards them. Confirmed by direct read,
  not exploited live (no plausible attack shape exists to test).
- **Duplicate JSON keys**: `JSON.parse()` follows the JSON/ECMAScript
  spec (last value wins for a duplicate key) — not a distinct attack
  surface from "wrong value for a field," already covered by the
  type-confusion and content-mismatch checks above and throughout the
  16-check pipeline.
- **Contract mutation via any of the above**: not reachable by
  construction — `contract` is built once, before `narrate()`/
  `composeDiscussionReply()` are ever called, from engine output alone,
  and frozen (`buildReadingContract()`); no code path in either composer
  writes back into `contract` from the model's response at any point.

### 5I-F — Fallback integrity (re-confirmed at each layer, not newly probed)

Already extensively tested across 5H/5H-R/5H-R2 (both surfaces:
per-field failure and TTS-artifact-boundary failure) and re-confirmed
here by the fresh regression run (§5): a validation failure at either
layer substitutes `buildDeterministicFallbackNarration(contract)`,
whose own `buildSpeakableText()` output is never independently
re-validated (by design — it cannot itself contradict the contract it
was built from) and cannot be the raw rejected draft. `discussReading.ts`'s
equivalent path returns `null` and the client-visible failure state,
never partial/rejected model text. No new finding.

### 5I-G — Determinism / replay (re-confirmed by the existing 24-case harness, not separately re-derived)

The `replay-check.ts` harness computes each of 24 real cases twice,
in-process, and diffs the result — this already IS the "identical
engine input → identical result" test the workstream calls for, for the
deterministic (engine/contract/validator) layer; narration itself is the
one genuinely non-deterministic layer (Claude's own output varies run to
run) and is explicitly not asserted byte-identical by any phase in this
chain, only *safety*-identical (every validated/rejected outcome is
determined solely by the deterministic validator against the fixed
contract, regardless of the model's specific wording). Re-ran clean
(§5); no new probing was needed to establish this, since it is exactly
what the harness's existing design already proves.

### 5I-C, 5I-H — explicitly NOT exhaustively covered by this pass

Per the authorization's own required "explicit statement of anything
NOT tested":

- **5I-C, full claim-surface matrix**: this pass did not construct a
  from-scratch enumeration of every conceivable claim shape against
  every contract field beyond what §3 above covers. The seven Phase 5E
  ground-truth checks (house, supporting-house, sign, direction,
  retrograde, ruler-relation, reversal) and their existing regression
  suites (extended through 5H-R2's own 24-case seam matrix) remain the
  current, tested claim surface; this pass did not discover or probe any
  claim shape beyond those seven fields plus the verdict/timing/remedy/
  diagnosis/certainty fields the pre-existing checks already cover.
- **5I-H, a new standalone full-pipeline harness**: not built. The
  existing 11,923-case adversarial harness and the `speakableTextValidation.test.ts` /
  `vendorTerminologyLeakage.test.ts` suites together already exercise
  every category this workstream lists (contradiction, injection,
  terminology/internal-data leakage, Unicode/ZWJ/punctuation attacks,
  malformed output, fallback paths, TTS artifact identity, legitimate
  narration) and were re-run, not rebuilt, for this phase (§5). A
  dedicated new harness was judged not demonstrably required by any
  finding this pass produced — the one finding (5I-1) was closed by
  extending an existing, already-integrated deny-list, and is covered by
  a new permanent test file (`vendorTerminologyLeakage.test.ts`), not a
  new harness.
- **5I-D's exhaustive phrase list** (fake system/developer messages,
  markdown/XML instruction injection, Unicode-obfuscated instructions
  embedded in legitimate-looking questions): not individually
  phrase-tested fresh in this pass. Covered architecturally (§3) and by
  the existing 35-case `injection-artifacts` harness category, which
  this pass re-ran clean rather than expanding without a demonstrated
  gap to justify it.

## 4. Files changed and why

- `functions/src/oracle/narrationValidator.ts` — twelve terms added to
  the existing `PROHIBITED_TERMINOLOGY` array (Claude, Anthropic,
  OpenAI, GPT, Firebase, Firestore, Cloud Function, large language
  model, machine learning, neural network, training data, system
  prompt), with a dated comment recording the reproduction and
  rationale. No check logic, no new function, no architectural change —
  a data-list addition to an existing, unmodified check, required by
  Finding 5I-1 (§3).
- `functions/src/oracle/__tests__/vendorTerminologyLeakage.test.ts`
  (new) — 14 permanent regression tests: each of the twelve new terms
  individually rejected, a genuine-narration positive control (no
  over-tightening), and a case-insensitivity control.

No other file was modified. Confirmed by `git diff --stat` against every
prohibited path at once (§6) — engine, `kp/`, `readingContract.ts`,
remedy library/selection, `textSecurity.ts`, prompts, `firestore.rules`,
golden corpus, `discussReading.ts`, `discussionComposer.ts`,
`askWatchOracle.ts`, `responseComposer.ts`, `useTextToSpeech.ts`,
`ChatBubble.tsx` — all empty.

## 5. Regression results (freshly run, after the fix)

| Check | Result |
|---|---|
| `functions`: `npx tsc --noEmit` | clean |
| `functions`: `npm run lint` | clean |
| `functions`: `npx vitest run` | **451/451**, 19 files (was 437/437 — +14 new) |
| app: `npm run typecheck` | clean |
| app: `npm run lint` | clean |
| app: `npm run test` | **306/306**, 27 suites — unchanged, no app-side file touched |
| `node functions/scripts/sync-engine.mjs --check` | clean |
| Golden corpus | 111/111, untouched — `git diff` against it empty |
| `npx vite-node functions/scripts/replay-check.ts` | **24/24** byte-identical |
| Adversarial harness (fresh run, scratch `--out-dir`, no historical evidence overwritten) | **generated 11923, falseNegativeCount: 0, falsePositiveCount: 0, exceptionCount: 0** — unchanged from the pre-fix baseline, confirming no regression and no over-tightening against the existing 11,923-case corpus |
| Working tree | clean before commit |

The +14 are the new permanent regression tests for Finding 5I-1; no
existing test was weakened, skipped, or had its assertions loosened.

## 6. Prohibited-path verification

```
git diff --stat 2204a8f..HEAD -- \
  src/astrology/ functions/src/engine/ \
  functions/src/oracle/readingContract.ts \
  functions/src/oracle/remedySelection.ts \
  functions/src/oracle/remedyLibrary.ts \
  functions/src/oracle/textSecurity.ts \
  functions/src/prompts/ firestore.rules \
  docs/audit/golden-corpus/ \
  functions/src/functions/discussReading.ts \
  functions/src/oracle/discussionComposer.ts \
  functions/src/functions/askWatchOracle.ts \
  functions/src/oracle/responseComposer.ts \
  src/hooks/useTextToSpeech.ts \
  src/components/oracle/ChatBubble.tsx
```

Empty. `narrationValidator.ts` is the one file this phase intentionally
modified, per §4, within the scope 5I-E explicitly authorizes for a
reproduced finding — not a prohibited path under this phase's own
authorization (the MUST-NOT constraint on `narrationValidator.ts` was a
5H-R2-specific boundary; this phase's own authorization explicitly
permits it when "demonstrably required by a reproduced Phase 5I
finding," which Finding 5I-1 is).

## 7. Findings summary

| Finding | Severity | Status |
|---|---|---|
| 5I-1 — vendor/infrastructure terminology leakage uncaught | P2 | Fixed, this checkpoint |

No P0 finding. No P1 finding. No engine-truth mutation was demonstrated
reachable by any probe in this pass. No TTS artifact-identity regression.
No golden-corpus or replay drift. No existing 5C-R/5D-R/5H protection
regressed (confirmed by the unchanged adversarial-harness result).

## 8. Hard-stop status

None triggered. None of the fourteen hard-stop conditions in the
authorization were met by any probe or by the one fix made.

## 9. Explicit statement of what was NOT tested

Recorded in full in §3's final subsection. Summarized: this pass did not
build a new, from-scratch exhaustive claim-surface matrix beyond the
existing seven ground-truth fields plus verdict/timing/remedy/diagnosis/
certainty; did not build a new standalone full-pipeline harness (the
existing 11,923-case harness plus the permanent unit-test suites already
cover the same categories and were re-run, not rebuilt); did not
individually phrase-test the full prompt-injection vocabulary the
authorization enumerates, relying instead on the architectural proof
(judgment is fixed before narration is drafted) plus the existing
35-case harness category. None of these were skipped because a defect
was assumed absent without checking — each is backed by either a direct
architectural trace (§3) or an existing, independently-reviewed test
corpus this pass re-ran and confirmed clean, not merely cited.

## 10. Completion discipline

This document, the two-file diff (§4), and the regression re-run (§5)
are the complete scope of this phase. Per the authorization:

- Phase 5H is **not** declared closed by this document.
- Phase 6 does **not** begin.
- Phase 5 overall is **not** claimed closed.
- This checkpoint is an **implementation checkpoint only**, awaiting its
  own independent Phase 5I Review Gate before Phase 5I can be considered
  passed.
