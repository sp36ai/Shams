# Phase 0 — Baseline, Freeze & Forensic Starting Point

**Repository:** sp36ai/Shams
**Scope:** Inspection only. No application behavior was changed to produce this report.
**Method:** Executable code was traced (imports, exports, call chains) rather than
relying on prose documentation. Existing audit docs in the repo root were used as
navigation aids and cross-checked against current `HEAD`, not taken as truth — several
were found to describe a state the code has since regressed from (see §I).

---

## A. Repository state

- Working branch: `claude/shams-phase-0-baseline-lnlmy6`
- `HEAD`: `21278cf2a53dfeb15d11de0a0362cce71885febf`
- `main`: `ce536bcba19b3c145e4820fefa3b19bcd9d7049f` — **identical to `HEAD`** (branch is
  main's tip; no unmerged work sits on this branch yet).
- Working tree: clean at time of audit.

---

## B. Runtime pipeline (traced, not assumed)

Confirmed exported callables (`functions/src/index.ts`): `askWatchOracle`,
`discussReading`, `activateTrial`, `getQuota`, `syncReadings`, `deleteReading`,
`deleteAccount`, `verifyGooglePlayPurchase`, `razorpayWebhook`, `setAdminClaim`,
`health`, `classifyQuestion`, `inferProfile`, `selectRemedies`.

**The reading pipeline** (`askWatchOracle`, `functions/src/functions/askWatchOracle.ts`):

```
client question text (typed or voice-transcribed, identical path — see below)
  → askWatchOracle (onCall)
      1. verifyAuth()                      middleware/auth.ts
      2. AskWatchOracleSchema.parse()      middleware/validate.ts  (Zod, strict)
      3. enforceRateLimit()                middleware/rateLimit.ts (Firestore txn, 10/min/user)
      4. claimRequest() [if requestId]     utils/idempotency.ts    (replay-safe)
      5. claimQuotaSlot()                  utils/quotaSlots.ts     (same ledger as legacy askOracle)
      6. buildWatchChart(localMoment)      engine/rkp/watchChart.ts
      7. classifyQuestion(question)        engine/kp/rules/questionKeywords.ts (shared keyword table)
      8. judgeWatchChart(chart, qType)     engine/rkp/watchJudgment.ts   ← THE deterministic judgment
      9. toBoundaryPlanetName() × 3        utils/planetBoundaryName.ts  (server-side node renaming)
     10. composeWatchOracleResponse()      oracle/responseComposer.ts
           a. diagnose(verdict)            engine/rkp/diagnosis.ts        (deterministic)
           b. selectRemedyProtocol()       oracle/remedySelection.ts      (deterministic, library-bound)
           c. narrate() → Claude Opus 5    prompts/watchOracleSynthesisPrompt.ts (prose only)
     11. readings/{id}.set()               Firestore, Admin SDK
     12. auditLogs.add()                   no PII, resultHash/questionHash only
     13. completeRequest()                 idempotency replay cache
  → response → client (readingsStore) → MMKV-backed history, ChatBubble render
  → useTextToSpeech (react-native-tts, on-device) speaks response.oracle.narration text verbatim
```

**Voice path** (`src/hooks/useSpeechToText.ts`): wraps `@react-native-voice/voice`,
produces a transcript string, handed to the **same** `askWatchOracle()` call the text
composer uses (`src/screens/OracleScreen.tsx` / `HomeAskComposer` → same submit
handler). No separate astrology logic found in the voice hook — confirmed by reading
the file in full; it contains only speech-recognition plumbing (permissions, timeout,
error mapping).

**Audio path** (`src/hooks/useTextToSpeech.ts`): wraps `react-native-tts`, an
on-device engine. `speak(messageId, text)` takes whatever text it's given — the
composed narration string — and has no code path that generates or alters judgment.
No network call; nothing leaves the device for audio.

**Sky Clock** (`src/screens/SkyClockScreen.tsx`): imports `buildChart`,
`dayLordAtMoment`, `horaLordAtMoment`, `dignityOf` — chart/dignity **primitives**
only. It does **not** import `judgeWatchChart` or any judgment function. Confirmed
this is a live display of chart state, not an independent judgment path.

**Client engine imports are type-only.** Every client-side import from
`@astrology/rkp/watchJudgment` and `@astrology/rkp/diagnosis` found in
`src/stores/readingsStore.ts`, `src/components/oracle/RkpWatchCard.tsx`,
`src/components/oracle/RemedyProtocolCard.tsx`, `src/types/watchOracle.ts` is an
`import type` — erased at compile time, no runtime judgment logic ships in the APK.
This matches the "server-side; the APK still contains zero engine" claim documented
in `askWatchOracle.ts`'s own header comment, and I did not find a counterexample.

---

## C. Engine authority map

| Decision | Authoritative implementation | Deterministic | AI involved |
|---|---|---|---|
| Question type/classification | `engine/kp/rules/questionKeywords.ts` (`classifyQuestion`) | Yes | No |
| Chart (watch frame) | `engine/rkp/watchChart.ts` (`buildWatchChart`) | Yes | No |
| Judgment (verdict) | `engine/rkp/watchJudgment.ts` (`judgeWatchChart`) | Yes | No |
| Diagnosis | `engine/rkp/diagnosis.ts` (`diagnose`) | Yes | No |
| Remedy selection | `oracle/remedySelection.ts` + `oracle/remedyLibrary.ts` | Yes (library-bound) | No |
| Timing | Inside `diagnose()` — `TimingPosture`/timing window fields | Yes | No |
| Narration prose | `oracle/responseComposer.ts` → Claude Opus 5, `prompts/watchOracleSynthesisPrompt.ts` | No (LLM) | Yes — prose only |

`responseComposer.ts` enforces the prose/fact boundary **structurally**, not just by
instruction: remedy `name`/`instructions`/`evidenceType` are copied verbatim from
`REMEDY_LIBRARY` after the model returns (`OracleProtocolStep`), and the model's
writable surface is limited to `NarrationFields` (`rkp_finding`, `interpretation`,
`recommended_approach`, `why_this_remedy`, `signature`). The brand seal
(`ORACLE_BRAND_SEAL`) is a fixed string, never model-written. I read the full 386-line
file; this separation holds throughout.

---

## D. Legacy (KP) dependency map

The old KP **judgment** engine (the thing the constitution says must never come
back) is gone from both the client and server judgment paths — confirmed no `import`
of a KP judgment function anywhere reachable from `askWatchOracle` or the app's
screens. What remains under paths named `kp/`:

| Path | Contents | Classification |
|---|---|---|
| `functions/src/engine/kp/rules/{nakshatras,houseMatrix,vimshottari,questionKeywords}.ts` | Nakshatra table, house→question-type matrix, Vimshottari dasha lord sequence, keyword classifier | **RUNTIME — legitimate shared primitive.** Imported by `engine/rkp/diagnosis.ts`, `engine/rkp/watchJudgment.ts`, `engine/primitives/subLord.ts`, `oracle/remedySelection.ts`, `oracle/remedyLibrary.ts`, `oracle/suggestedQuestions.ts`, and `askWatchOracle.ts` itself. These are astronomical/astrological reference data and a keyword matcher, not a rival judgment engine. Matches the constitution's "preserve shared mathematical primitives" carve-out. Directory naming (`kp/`) is misleading given the constitution's language but the *content* is not a KP judgment path. |
| `src/astrology/kp/rules/*` | Identical set, client-side source of truth (see §E — `functions/src/engine/` is a generated mirror of `src/astrology/`) | Same as above — RUNTIME primitive, source copy. |
| `functions/src/engine/kp/judgment/__tests__/judgeHorary.test.ts` | A test file importing `judgeHorary` from `'../judgeHorary'` | **DEAD CODE, and currently BROKEN.** No `judgeHorary.ts` exists anywhere in the repository (confirmed via repo-wide search) — it was deleted by commit `18232d7` ("Delete the retired KP/Astronomical judgment engine — completely, not just unwired (#92)"), but this test file was left behind. `sync-engine.mjs` (the tool that mirrors `src/astrology` → `functions/src/engine`) explicitly skips `__tests__` directories, so this file did not arrive via the sync — it is a hand-orphaned leftover. **Currently fails `npm test` in `functions/`** — see §H. |

No other `kp`/`KP`/`Krishnamurti` occurrences were found outside these paths, docs,
and comments referencing the historical removal (e.g. `askWatchOracle.ts`'s doc
header calling itself "Sibling of askOracle" — askOracle itself is fully deleted,
see §E).

---

## E. Duplicate/questionable authority map

1. **Source + generated artifact (not a true duplicate, but a maintenance hazard).**
   `functions/src/engine/` is generated from `src/astrology/` by
   `functions/scripts/sync-engine.mjs` (run via `npm run build`, i.e. predeploy). It
   rewrites `@astrology/X` imports to relative paths and prunes stale files. This
   means the *deployed* server engine is a build artifact of the client-side source
   tree — worth Phase-1 attention (e.g.: is `functions/src/engine/` ever manually
   edited and the sync run backwards? Not observed, but the pattern invites drift if
   someone edits the generated copy directly).

2. **Old astronomical `askOracle` path — server side is gone, client side is not
   fully accounted for.** `functions/src/functions/askOracle.ts` does not exist and
   is not exported from `index.ts` — the old astronomical-chart oracle cannot be
   invoked in production. However, the client still contains
   `src/data/remedySelector.ts`, documented as "Phase 3 — calls the `selectRemedies`
   Cloud Function," and `selectRemedies` **is** still exported from `index.ts` and
   used from `src/screens/ReadingScreen.tsx` / `src/components/oracle/GuidanceCard.tsx`.
   **I did not verify** whether this is (a) dead code left from the pre-Watch-Oracle
   app that no live flow reaches, (b) a live secondary remedy-selection path that
   runs alongside the watch protocol for something ReadingScreen still needs, or
   (c) backward-compatibility rendering for historical readings created before the
   Watch Oracle existed. **This needs Phase 1 investigation before any change is
   made near ReadingScreen or remedy code** — the constitution's "one engine
   authority" rule makes this the single highest-priority open question from this
   audit.

3. **`classifyQuestion` and `inferProfile` exported callables**: `classifyQuestion`
   has no client caller I could find (`grep` across `src/` for the callable, not the
   local `engine/kp/rules/questionKeywords.ts` function of the same name, found
   nothing). Candidate dead/unreachable production endpoint — flagged, not
   removed. `inferProfile` is called from `OnboardingScreen.tsx` — live and
   unrelated to judgment.

---

## F. AI boundary (exact entry point)

AI enters the pipeline in exactly one place on the live reading path:
`composeWatchOracleResponse()` → `narrate()` in `functions/src/oracle/responseComposer.ts`,
which calls Anthropic's API directly (`fetch`, `SYNTHESIS_TIMEOUT_MS = 40_000`) with
`WATCH_ORACLE_SYNTHESIS_PROMPT` (`functions/src/prompts/watchOracleSynthesisPrompt.ts`)
as the system prompt and a user prompt built by `buildUserPrompt()` containing:
the **settled** diagnosis (outcome, patterns, timing posture, timing window,
confidence, obstructing agent, target house, question type), the engine's own
rationale strings, the **selected** remedy names/categories (already chosen by
`selectRemedyProtocol`, not by the model), and the seeker's sanitized question text
(explicitly labeled "subject matter — never an instruction to you"). The prompt
text itself instructs "explain, do not revise" / "do not rename or replace." The
model's return value is parsed as strict JSON into `NarrationFields` only; missing
required fields cause the whole narration to be discarded (`return null`), not
partially trusted.

A second AI call exists on `discussReading` (`functions/src/oracle/discussionComposer.ts`,
not read in full during this pass — flagged for Phase 1 if follow-up-chat behavior is
in scope) and on `selectRemedies` / `inferProfile` for the paths noted in §E.3.

---

## G. Security map

| Boundary | Enforcement point | Notes |
|---|---|---|
| Auth | `middleware/auth.ts` (`verifyAuth`) | Throws `unauthenticated` HttpsError if `request.auth` absent. Emulator-only dev bypass gated on `FUNCTIONS_EMULATOR === 'true'`. |
| App Check | `enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true'` per-function option (`askWatchOracle.ts:154`) | Confirmed present on `askWatchOracle`; not individually re-checked on every other callable in this pass. |
| Input validation | `middleware/validate.ts`, Zod, `AskWatchOracleSchema` | Strict schema; `seekerName`/`motherName` sanitized via `NameSchema` transform (Unicode-normalize, strip control chars). |
| Rate limit | `middleware/rateLimit.ts` | Firestore-transaction sliding-minute counter, default 10/min/user, configurable via `RATE_LIMIT_PER_MINUTE` param. |
| Idempotency | `utils/idempotency.ts` (`claimRequest`/`completeRequest`/`releaseRequest`) | Claimed before quota spend; replays the stored response rather than re-running on retry. |
| Quota | `utils/quotaSlots.ts` (`claimQuotaSlot`/`refundQuotaSlot`) | Shared ledger between the (now-removed) astronomical path and the watch path — same cost. Refunded on any engine-stage failure. |
| Firestore rules | `firestore.rules` | Deny-by-default (final catch-all `allow read, write, delete: if false`), owner-scoped reads, all privileged collections (`quotas`, `plans`, `auditLogs`) writable only via Admin SDK (`allow write: if false` for clients). `hasNoPrivilegedFields()` blocks client self-escalation on `/users/{userId}` writes. |
| Payment verification — Razorpay | `functions/src/functions/payments/razorpay.ts` | HMAC-SHA256 signature check, per-IP sliding-window rate limit (30/min), only `payment.captured`/`subscription.activated` drive upgrades, other events acknowledged-but-ignored. Not re-verified line-by-line for the idempotency claim in commit `81a9d0c` ("Fix Razorpay webhook idempotency race") — flagged for Phase 1 if payments work is in scope. |
| Payment verification — Google Play | `functions/src/functions/payments/googlePlay.ts` | Present, has its own test file (`payments/__tests__/googlePlay.test.ts`, 7 passing tests) — not read in full this pass. |

**AI output safety validation — REGRESSION FOUND.** See §I, finding 1. This is the
single most important security-relevant finding of this audit: the independent
post-generation safety check the repo's own prior audit (`PRODUCTION_AUDIT_2026-08-23.md`)
recorded as **CLOSED** is not present on the current `HEAD`.

---

## H. Test map

### `functions/` (vitest — `npm test` run from `functions/`)

```
Test Files  1 failed | 10 passed (11)
     Tests  89 passed (89)
```

The one failed suite is `src/engine/kp/judgment/__tests__/judgeHorary.test.ts` —
fails to even load (`Failed to load url ../judgeHorary ... Does the file exist?`),
not a logic failure. This is the dead-code artifact from §D. **As of this audit,
`npm test` inside `functions/` does not exit clean.** All 89 tests that *do* run
pass; none are mocked-vs-real-integration flagged in this pass (not individually
audited — Phase 1 item if test-quality is in scope).

Suites covering the live path directly: `oracle/__tests__/discussionComposer.test.ts`,
`oracle/__tests__/remedySelection.test.ts`, `oracle/__tests__/questionInNarration.test.ts`,
`oracle/__tests__/suggestedQuestions.test.ts`, `engine/primitives/__tests__/{julianDay,chartBuilder}.test.ts`,
`utils/__tests__/{idempotency,localTime}.test.ts`, `functions/payments/__tests__/googlePlay.test.ts`,
`__tests__/modelIds.test.ts`. **No test in this run exercises `judgeWatchChart` or
`diagnose` directly by name** (the RKP golden-value tests referenced in commit
`585ccd5` and `PRODUCTION_AUDIT_2026-08-23.md` live under `src/astrology/rkp/__tests__/`
in the **app** repo, not `functions/` — see below). This split — engine logic tested
once under `src/astrology/rkp/__tests__/` (jest, app runner) and never re-tested
against the synced copy under `functions/src/engine/` — is a real gap: a
`sync-engine.mjs` transform bug could silently diverge the deployed engine from its
tested source with nothing in `functions/`'s own suite catching it.

### App (`jest`, root)

```
Test Suites: 29 passed, 29 total
Tests:       356 passed, 356 total
```

Clean pass. Includes `src/astrology/rkp/__tests__/{rules,diagnosis,watchGrid}.test.ts`
(the actual RKP engine tests, run against the **source**, not the synced
`functions/` copy — see gap noted above), `src/hooks/__tests__/useSpeechToText.test.ts`
(passes, but throws repeated `act(...)` warnings from React — cosmetic test-quality
issue, not a failure, flagged as P3 in §I), `screens/__tests__/{OracleScreen,ReadingScreen,ReadingsScreen}.test.tsx`.

### Typecheck

`npx tsc --noEmit` clean in both the app root and `functions/`.

### Not run in this pass

- `test:rules` (`firestore.rules.test.ts` via the Firestore emulator) — requires
  the Firebase emulator; not started in this environment. **Not verified.**
- `test:e2e` (Maestro) — requires a device/emulator; not run. **Not verified.**
- `npm run lint` (ESLint, `--max-warnings=0`) in either package — not run this
  pass; flagged as an omission, not a finding either way.

---

## I. Known risks (ranked)

**P0 — AI output safety validator is currently absent from the live `askWatchOracle`
path, contradicting the repo's own audit record.**
Commit `08aac2b` ("Restore AI output defense-in-depth on the live askWatchOracle
path", 2026-08-23) added `runWatchNarrationSafetyValidator` — an independent
second-model (Haiku) re-check of every narration field for medical/financial/legal
claims, false-certainty language, and fear amplification — and wired it into
`responseComposer.ts`'s `narrate()`. `PRODUCTION_AUDIT_2026-08-23.md` (committed the
same day) records this as **CLOSED**. Two days later, commit `18232d7` ("Delete the
retired KP/Astronomical judgment engine — completely, not just unwired (#92)",
2026-08-25) deleted `functions/src/functions/safetyValidator.ts` and its test in
full. On 2026-09-06, commit `e326807` ("Fix responseComposer conflicts post-merge")
removed the last call site (`return await runWatchNarrationSafetyValidator(...)`)
from `responseComposer.ts` while resolving a merge conflict. **On current `HEAD`,
`grep -rn "safetyValidator" functions/src` returns nothing** — the file, its export,
and its call site are all gone. `responseComposer.ts` (lines 377–378) currently
carries a comment stating *"The system prompt guard is the primary defense;
additional post-generation validation was removed when the KP engine was
deleted"* — worded as if this were an intentional, accepted design decision, when
the git history shows it was a specific security control, deliberately added after
being identified as missing, lost as apparent collateral damage of an unrelated
cleanup and a later merge conflict. This is a genuine regression against the
project's own prior audit finding, not a hypothetical gap — recommend it be the
first item Phase 1 addresses, once explicitly scoped by the owner (do not treat
this report as authorization to restore it — that is implementation work).

**P1 — Duplicate/legacy remedy-selection path of unverified liveness.**
`src/data/remedySelector.ts` ("Phase 3") calls the still-exported `selectRemedies`
callable and is wired into `ReadingScreen.tsx`/`GuidanceCard.tsx`, alongside the
Watch Oracle's own deterministic `oracle/remedySelection.ts` +
`oracle/remedyLibrary.ts`. Whether this is dead code, a live secondary path, or
backward-compat rendering for pre-Watch-Oracle readings was **not resolved** in
this pass (§E.2). Given "one engine authority" is a constitutional rule, this is
the top candidate for Phase 1 scoping.

**P1 — `functions/` test suite currently fails to run clean.**
`src/engine/kp/judgment/__tests__/judgeHorary.test.ts` references a deleted module
(§D, §H). This is cheap to fix (delete the orphaned test) but is explicitly **not**
fixed here per the Phase 0 no-fix rule — flagged for Phase 1 (or a trivial pre-Phase-1
janitorial commit, owner's call).

**P2 — RKP engine logic is tested once (in `src/astrology/`, jest) but never
re-tested against the deployed, synced copy (`functions/src/engine/`, vitest).**
A `sync-engine.mjs` transform regression would not be caught by either suite (§H).

**P2 — `classifyQuestion` exported callable appears to have no client caller.**
Candidate unreachable production endpoint (§E.3). Low risk (it's read-only
classification, not privileged), but worth confirming and either wiring it up or
removing the export in a later phase.

**P3 — `useSpeechToText` test suite passes but emits repeated React `act()`
warnings.** Cosmetic; the underlying async state updates in
`src/hooks/useSpeechToText.ts` aren't wrapped in `act()` inside the test, which is
a test-file issue, not evidence of a runtime bug — noted so it isn't rediscovered
and mis-triaged as a real failure later.

**Not verified / out of scope for this pass:** Firestore rules emulator tests,
Maestro E2E, ESLint on either package, Razorpay webhook idempotency re-verification
beyond reading the file header, `discussReading`'s full AI boundary, App Check
enforcement on callables other than `askWatchOracle`, Google Play verification
internals.

---

## Answer to the Phase 0 success condition

*"If a user submits a question right now, exactly which code determines the
answer, exactly which code generates the explanation, and exactly which security
boundaries protect the transaction?"*

The answer: `engine/rkp/watchChart.ts` + `engine/rkp/watchJudgment.ts` +
`engine/rkp/diagnosis.ts` + `oracle/remedySelection.ts` determine the answer
(deterministic, no AI, single traced path from both text and voice input).
`oracle/responseComposer.ts`'s call to Claude Opus 5, constrained to a fixed prose
schema and fed only settled facts, generates the explanation. The transaction is
protected by Firebase Auth, App Check, Zod validation, a Firestore-transactional
rate limiter, an idempotency claim taken before quota spend, a quota ledger shared
with the legacy path, and deny-by-default Firestore rules — but as of this `HEAD`,
the AI narration's own independent post-generation safety check is **not** one of
those boundaries, despite the repository's own prior audit believing it was.

---

## Addendum — evidence tightening (requested after provisional acceptance)

This addendum was added in a second inspection pass, in response to a request to
prove §I finding 1 and §E finding 2 with exact repository evidence rather than
prose summary, produce a precise `kp/` dependency table, and confirm baseline
integrity. **No application source was changed to produce this addendum** — see
§4 below. Historical claims below are git evidence (commit hash, author, date,
diff content, quoted verbatim); anything not directly evidenced is labeled
inference or marked UNRESOLVED.

### 1. P0 validator regression — exact evidence chain

| Step | Commit | Date | Evidence |
|---|---|---|---|
| **Introduced** | `3db4c65` "Stop leaking raw API errors into oracle readings shown to users (#56)" | 2026-08-07 19:23:01 +0530 | First commit to add `functions/src/functions/safetyValidator.ts` (`git log --diff-filter=A`). |
| **Generalized + wired into the live path** | `08aac2b` "Restore AI output defense-in-depth on the live askWatchOracle path" | 2026-08-23 06:06:03 +0000 | Diff (already quoted in the original report) adds `runFieldValidation`/`runWatchNarrationSafetyValidator` and a call site in `responseComposer.ts`: `return await runWatchNarrationSafetyValidator(drafted, readingId, apiKey);`. Commit message: *"That function turned out to be dead code the shipped app never calls... askWatchOracle, the function actually shipping to users, had only its system-prompt guardrails as a single line of defense."* |
| **Marked CLOSED in repo's own audit doc** | `b13f8c7` "Adopt precise CLOSED/OPEN status taxonomy for the two remaining gate items" (content originates same-day in `d3c3417`) | 2026-08-23 06:36:11 +0000 (30 min after `08aac2b`) | `PRODUCTION_AUDIT_2026-08-23.md`, still present verbatim at current `HEAD`: status table row `\| AI output defense-in-depth \| **CLOSED** \|`, and detail row #5: *"Closed. `safetyValidator.ts`'s per-field validation engine was generalized (`runFieldValidation`) and a new `runWatchNarrationSafetyValidator` wraps it for `askWatchOracle`'s narration fields. Wired into `oracle/responseComposer.ts`'s `narrate()`..."* This doc has **not** been updated since — it still asserts CLOSED today. |
| **File deleted** | `18232d7` "Delete the retired KP/Astronomical judgment engine — completely, not just unwired (#92)" | 2026-08-25 16:49:57 +0530 | `git show 18232d7 --stat`: `functions/src/functions/safetyValidator.ts \| 182 -----` (182 deletions, file removed). Commit message's own stated rationale: *"Its dedicated LLM voice-composition prompt (prompts/oracleSynthesisPrompt.ts) and its dedicated safety-validation gate (functions/safetyValidator.ts, used nowhere else — askWatchOracle.ts never called it)."* **This claim was false at the time it was merged to `main`**, but not through negligence on this commit's own terms: `git merge-base --is-ancestor 08aac2b 18232d7` returns **false** — `08aac2b` is not an ancestor of `18232d7`. The branch `18232d7` was built on forked before `08aac2b` landed, so from that branch's own point of view the claim was accurate; it became stale only once the two histories were merged. `18232d7` itself does **not** touch `responseComposer.ts` at all (`git show 18232d7 -- functions/src/oracle/responseComposer.ts` returns empty) — so the call site survived this commit intact and pointed at a now-missing file, in the merged history. |
| **Call site removed** | `e326807` "Fix responseComposer conflicts post-merge" | 2026-09-06 09:27:14 +0000 | Full diff quoted in the original report. Commit message states plainly: *"Remove safetyValidator.ts import and call (file deleted in PR #92)"* and *"Simplify safety layer comment: only system prompt guardrails remain."* This is the commit that actually took the validator off the live path — a **deliberate, documented choice made while resolving a merge conflict** (choosing to drop the caller rather than restore the deleted file), not a silent accident. It is also the commit that introduced the now-misleading comment at `responseComposer.ts:377-378`. |

**Current state, directly verified at `HEAD` (`241dd96` / `21278cf`):**
- `grep -rn "safetyValidator\|runWatchNarrationSafetyValidator\|runFieldValidation" functions/src src` → **zero matches** (exit code 1).
- `functions/src/functions/safetyValidator.ts` does not exist in the working tree or at `HEAD` (`git show HEAD:functions/src/functions/safetyValidator.ts` → `fatal: path ... does not exist in 'HEAD'`).
- `functions/src/oracle/responseComposer.ts:377-378` currently reads: *"The system prompt guard is the primary defense; additional post-generation validation was removed when the KP engine was deleted (PR #92)."* This sentence is misleading on two independently verifiable points: (a) the validator was not deleted *because* it was KP functionality — the deletion commit's own text describes it as "used nowhere else," a claim about reachability, not about being part of the KP engine; safetyValidator.ts validated the watch-oracle narration fields, unrelated to `judgeHorary`/KP; (b) its removal from the live call path did not happen in PR #92 at all — it happened three weeks later, in a separate merge-conflict-resolution commit (`e326807`).

**Distinguishing evidence from inference:** every commit hash, date, diff line, and quoted sentence above was read directly from `git log`/`git show` output in this session. The characterization of `e326807`'s removal as "deliberate" is drawn directly from that commit's own message, not inferred. The characterization of `18232d7`'s claim as "false when merged, accurate on its own branch" is inference from the ancestry check (`merge-base --is-ancestor`) plus the empty diff against `responseComposer.ts`, not a git fact stated anywhere directly — flagged as inference. **Not restored. Not modified.**

### 2. Remedy duplicate-authority finding — traced conclusively, not left unresolved

This was traceable to a definite conclusion, not left uncertain — reported as
**CONFIRMED LIVE**, not UNRESOLVED, because every link in the call chain was
followed to source.

**Caller inventory:**

| Caller | Kind | Reachable? | Side |
|---|---|---|---|
| `src/screens/ReadingScreen.tsx:249` — `runGuidanceSelection()` | Production | **Yes — unconditional.** Called at `ReadingScreen.tsx:317`, directly inside `runAsk()`'s success path, immediately after every successful `askWatchOracle()` call (`result.reading` is typed `WatchReading`, confirming this fires on watch-oracle readings, not just legacy ones). No feature flag or gating condition around the call. | Client → calls server `selectRemedies` callable |
| `functions/src/functions/selectRemedies.ts` | Production (exported from `index.ts`, confirmed in original report §B) | Yes | Server |
| `src/data/remedySelector.ts` (`enrichWithDescriptions`, `selectRemedies` wrapper) | Production | Yes, imported and called as above | Client |
| `src/data/__tests__/remedySelector.test.ts` | Test | N/A (test-only import of `enrichWithDescriptions`) | — |
| `src/data/watchRemedyContext.ts` | Production | Imports `categoryToThemes` from `remedySelector.ts` — live, used for the deterministic-side context building, not the LLM call itself | Client |

**Can it produce user-visible remedies?** Yes, directly verified in
`src/components/oracle/ChatBubble.tsx:273-276`:
```
{reading.oracle !== undefined && <RemedyProtocolCard composition={reading.oracle} />}
{message.selectedRemedies !== undefined && (
  <GuidanceCard remedies={message.selectedRemedies} />
```
Both cards render in the same chat bubble, unconditionally, whenever both pieces
of data are present — which, given `runGuidanceSelection` fires on every
successful reading, is the common case for any reading that hasn't failed or
finished loading yet.

**Does the Watch protocol's own deterministic remedy selection also produce
user-visible remedies?** Yes — `RemedyProtocolCard` renders `reading.oracle`
(`WatchOracleComposition.protocol`), sourced from `oracle/remedySelection.ts` +
`oracle/remedyLibrary.ts` inside `askWatchOracle`'s own response (traced in the
original report §B/§C). This is the same response object `runGuidanceSelection`
reads `reading.verdict` from to build its own, separate request.

**Can the two paths disagree?** Structurally, yes — confirmed by direct
comparison, not assumption. They draw from two **entirely separate remedy
libraries** with disjoint id namespaces:
- `functions/src/oracle/remedyLibrary.ts` (653 lines) — ids like
  `astro_favourable_window`, `behavioral_commit`, `devotional_dhikr_steadiness`
  — selected **deterministically** by `selectRemedyProtocol()` from the settled
  RKP diagnosis.
- `src/data/remedyLibrary.ts` (411 lines) — ids like `salawat_01`, `dua_01`,
  `istikhara_01` — up to 8 candidates ranked client-side
  (`rankCandidates.ts`), then **an LLM (`selectRemedies`'s `SELECTION_PROMPT`,
  server-side) picks 1-3** from those candidates.

`diff` of the two id sets confirms **zero overlap**.

**Is this an accident or a documented design?** `src/components/oracle/GuidanceCard.tsx`'s
own header comment states this is intentional, verbatim: *"They share no remedy
ids and are not alternatives to each other; showing both is the intent, which is
why this renders below the protocol rather than in place of it."* So the
codebase's own authors framed this as two answers to two different questions
(RKP's prescribed intervention vs. an LLM-suggested devotional practice), not as
an unintentional duplicate. **This report does not resolve the tension between
that stated intent and the constitution's "ONE ENGINE AUTHORITY" / "remedy is
machine-owned" rules** — it is reported as a fact for owner scoping, not
adjudicated here. What is conclusively established, and not in question: a
second, LLM-driven selection mechanism, reading from a second library, does
currently determine part of the user-visible remedy content on every reading,
live, in production, today.

### 3. KP namespace classification — precise table

Every path under a `kp/` directory found in the repository (`functions/src/engine/kp/`
and `src/astrology/kp/` — no other `kp/` directories exist per repo-wide search),
with concrete importer evidence rather than directory-name inference:

| Path | Imported by | Runtime? | Purpose | Canonical? | Phase 2 candidate action (not performed) |
|---|---|---|---|---|---|
| `functions/src/engine/kp/rules/houseMatrix.ts` | `engine/types/question.ts`, `engine/rkp/diagnosis.ts`, `engine/rkp/watchJudgment.ts`, `oracle/remedySelection.ts`, `oracle/suggestedQuestions.ts`, `oracle/remedyLibrary.ts` | **Yes** — reachable from live `askWatchOracle` via `diagnosis.ts`/`watchJudgment.ts` | House→question-type matrix + `QuestionType` union — shared astrological reference data | Yes, as data (not judgment logic) | None identified — leave in place; directory name is the only thing "legacy" about it |
| `src/astrology/kp/rules/houseMatrix.ts` | `stores/readingsStore.ts` (type-only), `astrology/types/question.ts`, `astrology/rkp/diagnosis.ts`, `astrology/rkp/watchJudgment.ts` | Yes — this is the **source**; `sync-engine.mjs` mirrors it into the `functions/` copy above | Same as above | Yes | Same as above |
| `functions/src/engine/kp/rules/nakshatras.ts` | `engine/primitives/subLord.ts` | **Yes** — `subLord.ts` is imported by `chartBuilder.ts`, which builds every watch chart | Nakshatra index/lord table | Yes, as data | None identified |
| `src/astrology/kp/rules/nakshatras.ts` | `astrology/primitives/subLord.ts` | Yes — source copy | Same | Yes | Same |
| `functions/src/engine/kp/rules/vimshottari.ts` | `engine/primitives/subLord.ts` | **Yes** — same reachability as nakshatras.ts above | Vimshottari dasha lord sequence | Yes, as data | None identified |
| `src/astrology/kp/rules/vimshottari.ts` | `astrology/primitives/subLord.ts` | Yes — source copy | Same | Yes | Same |
| `functions/src/engine/kp/rules/questionKeywords.ts` | `functions/functions/askWatchOracle.ts` (direct `require()`) | **Yes** — directly required on the live reading path (step 7 of the pipeline in original report §B) | Keyword-based question classifier (`classifyQuestion`) | Yes | None identified |
| `src/astrology/kp/rules/questionKeywords.ts` | **No client-side call site found** (`classifyQuestion` from this module has zero callers under `src/` outside its own file/tests) | Source copy only — inert client-side, becomes live only via the synced server copy above | Same classifier, client source | Yes (as the source of the live server copy), but note it is not itself directly exercised client-side | None identified — this is expected given the sync-engine architecture, not a finding |
| `functions/src/engine/kp/judgment/__tests__/judgeHorary.test.ts` | Nothing — it is a leaf test file | **No.** `import { judgeHorary } from '../judgeHorary'` resolves to a file that does not exist anywhere in the repository (confirmed by repo-wide search; `judgeHorary.ts`, `significations.ts`, `significators.ts`, `timing.ts` were all deleted by `18232d7`, which the commit message itself lists explicitly: *"judgeHorary() and its three helpers... The full KP verdict algorithm."*) | Orphaned regression test for a deleted engine | No | **Genuinely dead** — candidate for deletion once Phase 1 explicitly authorizes it; currently breaks `functions/`'s `npm test` (§H of the original report) |

No `kp/`-named path was classified as legacy solely because of its directory
name — the four `rules/*` files are classified **RUNTIME / canonical** precisely
*despite* living under `kp/`, on the strength of direct importer evidence. Only
`judgment/__tests__/judgeHorary.test.ts` is classified dead, and that is because
its one and only import target does not exist in the repository, not because of
its path.

### 4. Baseline integrity — confirmed

- `origin/main` SHA (unchanged since Phase 0 began): `ce536bcba19b3c145e4820fefa3b19bcd9d7049f`
- Working branch: `claude/shams-phase-0-baseline-lnlmy6`
- Current `HEAD`: `241dd967a2ffed2597936fb6d71105895a1acb08`
- `git log origin/main..HEAD --oneline`: exactly one commit —
  `241dd96 Phase 0: baseline forensic audit (inspection only, no behavior changes)`
- `git diff origin/main..HEAD --stat`:
  ```
  docs/audit/PHASE_0_BASELINE.md | 346 +++++++++++++++++++++++++++++++++++++++++
  1 file changed, 346 insertions(+)
  ```
  **One file changed. Zero application source files touched. Zero deletions
  (nothing removed, including no removal of `kp/` paths, the validator, or the
  remedy-selection duplication).**
- `git status --short`: empty — working tree clean; this addendum's own edit to
  `docs/audit/PHASE_0_BASELINE.md` is the only pending change, still confined to
  the same audit-documentation file.
- No judgment behavior changed: no file under `functions/src/engine/`,
  `functions/src/oracle/`, `functions/src/functions/`, `src/astrology/`, or
  `src/` was modified in this pass — every finding above was produced by `git
  log`/`git show`/`grep`/`diff` against existing history and the current working
  tree, not by editing code.

---

## STOP

This concludes the Phase 0 addendum. No fixes were applied — the P0 validator
was not restored, the remedy-selection duplication was not touched, and no
`kp/`-named path was modified or removed. Awaiting the next phase instruction.
