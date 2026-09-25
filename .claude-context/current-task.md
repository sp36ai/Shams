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

## Next Steps
Stopped here deliberately: further work needs either (a) a specific bug
report / UI complaint to chase, or (b) an explicit go-ahead to build a
named feature (offline banner, history continuation UI, etc.) rather than
inventing scope. Reported to user.
