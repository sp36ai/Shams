# Current Task
**Status:** Exploration Complete — Ready for Work  
**Assigned to:** Claude Code + Claude Chrome  
**Branch:** `claude/eager-newton-lhajbq`  
**Last Updated:** 2026-09-25 07:15 UTC  

## Project Status

### What's Live ✅
- **Oracle Core:** RKP Watch Engine (server-side) working correctly
- **Frontend:** OracleScreen (home), ReadingScreen (chat), ChatComposer, ChatBubble
- **Chat Components:** RkpWatchCard, RemedyProtocolCard (verdict rendering)
- **Voice:** Speech-to-text, Text-to-speech hooks integrated
- **Testing:** 8 test suites passing (minor act() warnings in TTS tests)
- **Context Sync:** 3-way sync live (Code + Chrome + Phone) ✅

### What Needs Work
- [ ] TTS test warnings (useTextToSpeech.test.ts — act() wrapping)
- [ ] Oracle UI refinement (WhatsApp-style conversational interface)
- [ ] Voice + text response parity validation
- [ ] History/continuation features
- [ ] Error state handling (timeout, quota, network)
- [ ] Loading states polish

## Blockers
None

## Progress (Automatic Mode)

### ✅ Done
1. **TTS test warnings investigated** — NOT a bug. `useTextToSpeech.test.ts:47-51`
   documents this as a deliberate choice: act() wrapping is unreliable against
   this project's pinned react/test-renderer combo. Left untouched.
2. **Voice/text parity verified + locked in** — Traced mic → sendMessage →
   askWatchOracle. Confirmed `kind` ('voice'/'text') never enters judgment
   logic, only display. Added regression test in ReadingScreen.test.tsx
   (commit 77abb54) so a future regression can't silently give voice its
   own call path. Full suite: 27 suites / 308 tests passing, tsc clean,
   eslint clean.

### ✅ Audited — no defect found
3. **Error/loading state audit.** ChatBubble.tsx already distinguishes
   sending/failed/sent per message, casting vs. discussion pending states,
   retry affordance on failure, and errorMessageFor() in ReadingScreen.tsx
   maps every Firebase callable error code (deadline-exceeded,
   unauthenticated, resource-exhausted, aborted, unavailable, not-found) to
   a seeker-facing message. Covered by existing tests. No NetInfo-based
   offline banner exists, but that's a feature addition, not a fix to an
   observed defect — flagged as an owner decision, not built speculatively.
4. **ChatBubble.tsx read in full.** Well-iterated (PHASE 2B, 5H-R markers
   show real audit history). WhatsApp-style polish item has no concrete,
   evidenced gap to fix — building UI changes without one would be exactly
   the shotgun-redesign the project's own engineering rule warns against.

### ✅ Real bug found + fixed (server-side)
5. **`functions/` had never been tested in this environment** — dependencies
   weren't installed. Installed them, ran the real suite: 543 passing, no
   pre-existing failures.
6. **Found and fixed a genuine defect in `discussReading.ts`.** When
   `composeDiscussionReply()` returns null (Claude unreachable / malformed
   reply / failed validation), the handler refunded the spent discussion
   turn but never released its idempotency claim — unlike the catch block
   right above it, which does both. Effect: the client's Retry button
   reuses the same requestId by design, so it hit claimRequest's in-flight
   branch and was told "already being read" for up to 3 minutes even
   though nothing was running. Fixed with one `await release()` call.
   Added `discussReadingRetry.test.ts` (4 tests) using the repo's own
   fake-Firestore pattern (readings.test.ts / idempotency.test.ts style).
   Verified the test actually catches the bug by reverting the fix and
   confirming it fails, then restoring it. Functions suite: 27 files, 547
   tests passing. tsc + eslint clean. Commit 6fb34e5.

## Next Steps
Continuing to audit remaining Oracle server-side surface area (askOracle
sibling paths, quota/rate-limit edges) for the same class of issue —
claim/refund symmetry on every failure branch — since that's where the
one real bug this session actually lived.
