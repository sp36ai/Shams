# Oracle integrity audit: voice, engine authority, follow-ups (2026-10-15)

Branch `ccr-3eb3a090-nia5b6`, cut from `main` at `d5cb314`. No engine file changed:
`src/astrology/` and `functions/src/engine/` have no diff, and `sync-engine --check` passes.
Nothing was deployed or merged.

## Executive summary

| Domain | Finding | Outcome |
|---|---|---|
| Follow-up continuity | **Confirmed defect.** Every follow-up after the 11th failed with `invalid-argument`, and no retry could recover. The client sent the whole transcript; the server allows 40 follow-ups but accepts at most 20 transcript turns. | **Fixed.** The client sends the most recent 20 turns. |
| Voice (fallback) | **Confirmed defect.** When model prose fails validation, the deterministic fallback leaked engine terms: "Mars is the obstructing influence", "MoonDisagreement", "the querent's ruler regards the ruler of the matter as an enemy". It also produced a broken sentence ("Consider Relationship Counselling, … are indicated"). | **Fixed.** Rewritten in the warm, direct voice; still deterministic and contract-only. |
| Voice (narrator brief) | **Confirmed defect.** The model's brief named the obstructing agent by its raw engine ID ("Mars", "MoonDisagreement"), and the prompt tells the model to use the brief's names. | **Fixed.** Both briefs (reading and follow-up) use the classical short name (Mirrikh, Qamar). |
| Voice (follow-ups) | Inconsistent register: the follow-up prompt said "measured, unhurried"; the reading prompt says warm and direct. | **Aligned.** The follow-up prompt now names the same voice and the same banned stock images. |
| Engine authority | **No defect found.** No client-side judgment, no alternate verdict path, and model output cannot change verdict, timing, diagnosis or remedies. | **Proven by a new test** (`verdictInvariance.test.ts`). |

## Root causes (with evidence)

1. **Follow-ups stop after 11.** `DISCUSSION_TURN_LIMIT = 40` (functions/src/config.ts), but
   `DiscussReadingSchema.turns.max(20)` (functions/src/middleware/validate.ts).
   `discussionTurnsFor()` (src/stores/readingThreadsStore.ts) returned every post-reading turn, so
   follow-up *n* sent 2(n−1) turns. Follow-up 12 sends 22 turns, the schema throws, the client shows
   a generic failure, and a retry sends the same 22 turns. Reproduced by a unit test that failed
   before the fix (30 turns sent).
2. **Fallback and brief leak engine terms.** `diagnosis.obstructingAgent` is documented as "a display
   name" (engine/rkp/diagnosis.ts:86), but it is `verdict.obstruction`: an English planet ID, the
   node short forms Ras/Dhanab (renamed at the boundary), or `MoonDisagreement`. The fallback
   interpolated it directly, as did both narrator briefs. The fallback also appended raw
   `diagnosis.rationale` lines (engine audit text). The sweep test fails against the old fallback
   and passes against the new one.

The discrepancy between the documented field (display name) and the actual value (raw ID) is
recorded, not resolved in the engine. Changing the engine value would change contract
fingerprints and stored readings. It is handled at the narration boundary (`oracle/agentNames.ts`)
using the engine's own `PLANET_NAME_SHORT` / `PLANET_ARCHETYPE`.

## Architecture (as found, unchanged by this audit)

```
Seeker text ──► askWatchOracle ─┬─ scope gate (questionScope) ── declined → no charge
                                ├─ buildWatchChart → classifyQuestion → judgeWatchChart   (RKP engine)
                                ├─ diagnose → selectRemedyProtocol → ReadingContract      (deterministic)
                                ├─ narrate (Claude, prose only) → validateNarration ── fail → deterministic fallback
                                └─ Firestore /readings/{id} (+ contract) → client → MMKV thread
Follow-up ────► discussReading ─┬─ load /readings/{id} server-side (ownership checked; verdict never from client)
                                ├─ bounded transcript (≤20 turns, now enforced client-side too)
                                ├─ Claude reply → validateDiscussionReply ── fail → rewrite once → else no reply
                                └─ isNewQuestion → client offers "ask as new Reading" (new engine run)
```

Boundaries hold: the conversation state, the LLM, the UI and the fallback never decide the verdict.

## Requirements traceability (summary)

Status values: PASS (evidence), FAIL, NOT TESTED, BLOCKED, N/A.

| ID | Requirement | Evidence | Status |
|---|---|---|---|
| B1 | Baseline: branch, tests, call graph | functions 728/728; app 419/419 (+ rules suite needs emulator, fails on `main` too) | PASS |
| V1 | One authoritative voice spec | `watchOracleSynthesisPrompt.ts`; follow-up prompt aligned to it | PASS |
| V2 | Fallback in the same voice, no invented claims | `narrationFallback.ts`; `fallbackVoice.test.ts` (1,728 cases validate) | PASS |
| V3 | No engine terms or English planet names to seekers | `fallbackVoice.test.ts`; briefs via `agentNames.ts` | PASS (fallback); model prose relies on the prompt + brief |
| V4 | Audio uses the same text | `speakableText` is built from validated narration (existing `speakableTextValidation.test.ts`) | PASS |
| V5 | Streaming | The app does not stream responses | N/A |
| V6 | Error/low-confidence copy in the same voice | Client i18n strings still use the older manuscript register (for example `failedGeneric`) | NOT CHANGED (owner copy decision) |
| V7 | No fabricated religious content | The model may not name practices; remedies are copied from `remedyLibrary.ts` | PASS for the model; library text authenticity is **BLOCKED** (needs human/scholar review) |
| V8 | "Remove the brand name" voice test | Subjective; needs real outputs | NOT TESTED |
| E1 | Engine is the sole verdict authority | `verdictInvariance.test.ts`: 6 model behaviours, identical engine fields | PASS |
| E2 | No client/alternate judgment path | grep: the app imports engine types and names only; no judge/diagnose calls | PASS |
| E3 | Remedies only from the library | `verdictInvariance.test.ts` (injected remedy rejected) | PASS |
| E4 | No invented timing | fallback sweep; validator `TIMING_*` checks (existing) | PASS |
| E5 | Model failure is not a fabricated result | HTTP 500 / timeout / malformed → `narration: null`, judgment intact | PASS |
| E6 | Determinism, bracket and timezone rules | `verdictInvariance.test.ts` (identical inputs; 5-min bracket; local minute) | PASS |
| E7 | Golden corpus unchanged | No engine diff; engine outputs cannot change | PASS (by construction; full corpus replay not re-run) |
| E8 | Doc/code discrepancy recorded | `obstructingAgent` documented display name vs raw ID (above) | RECORDED |
| C1 | Long conversations keep working | `readingThreadsStore.test.ts` (fails before the fix); `validate.test.ts` pins 20/21 | PASS |
| C2 | Restart keeps the same judgment and transcript | new restart test (same readingId, same turns, interrupted → retryable) | PASS |
| C3 | Retries don't duplicate | requestId idempotency (existing `idempotency.test.ts`) | PASS |
| C4 | Concurrent replies can't cross-wire | replies are routed by captured (threadId, messageId); sends are serialized | PASS by code review; NOT TESTED as an integration test |
| C5 | New question → new engine run | `isNewQuestion` → "ask as new Reading" (existing) | PASS (existing tests) |
| C6 | Ambiguous follow-up → clarify | Prompt-level only | NOT TESTED |
| C7 | Adversarial override of a prior verdict | `validateDiscussionReply` (existing `discussionValidation.test.ts`) | PASS |
| G-E | Production evidence | Branch not deployed; no emulator or staging run | NOT TESTED |

## Findings reported, not changed (need an owner decision)

- `classifyQuestion` (functions/src/functions/classifyQuestion.ts) is a deployed LLM callable with no
  caller in the app. It is not a judgment path, but it is dead, billable surface.
- The KP sub-lord fields are still computed by the shared `chartBuilder` (`primitives/subLord.ts`),
  but no RKP judgment reads them. The RKP rule files still live under a `kp/` folder name.
- Follow-up transcripts come from the client. A forged "oracle" turn could steer prose, but only
  within the validator's bounds; the verdict itself always comes from Firestore.
- Remedy-library religious text (duʿā, names, counts) should be verified by a qualified reviewer.

## Commands run

```
functions: npm run sync-engine; npx tsc --noEmit; npx eslint src --ext .ts --max-warnings=0; npx vitest run  → 740 passed
app:       npx eslint src/stores --max-warnings=0; npx jest  → all suites pass except firestore.rules.test.ts (emulator-only, fails on main too)
```
