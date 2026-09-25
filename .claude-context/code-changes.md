# Code Changes Tracker
**Branch:** `claude/eager-newton-lhajbq`  
**Last Sync:** Auto-updated on commit  

## Recent Changes
```
### [Timestamp] - [Commit Hash]
- **File:** Path to file
- **Change:** What changed
- **Why:** Reason for change
- **Test Status:** ✅ Passing / ⚠️ Needs test / ❌ Failing
- **Production Ready:** Yes/No
```

## Active Files (Oracle Pipeline)
- `src/server/oracle.ts` - askWatchOracle entry point
- `src/server/rkp-watch-engine.ts` - RKP judgment calculation
- `src/server/response-composer.ts` - Response formatting
- `src/client/oracle-ui.tsx` - Oracle interface
- `src/client/voice-input.tsx` - Voice-to-text pipeline

## In Review
(Awaiting feedback)

## Deployed
(Merged to production)

---
**Process:**
1. Code change → commit with message
2. Auto-update this file
3. Push to branch
4. Claude Chrome reads changes
5. Chrome can validate/test

### 2026-09-25 07:05 UTC - 8723f60
**Message:** `Add phone sync dashboard for 3-way context sharing

- Create context-server.js: Express server on :3333 for phone access
- Create public/index.html: Mobile-friendly dashboard
- Tabs: Task, Code Changes, Oracle Decisions, Session Log, Feedback
- Phone can submit feedback which auto-commits to Git
- Dashboard auto-refreshes every 30s
- APIs for context files, git status, feedback logging
- PHONE_SYNC_SETUP.md: Complete setup + troubleshooting guide

Enables:
✅ Phone → Read current task, code changes, Oracle decisions
✅ Phone → Log feedback which auto-syncs to session-log.md
✅ Claude Code → Reads phone feedback and responds
✅ Claude Chrome → Can also access same dashboard
✅ All three tools share one source of truth

Installation: npm install express cors
Run: node context-server.js
Access: http://[computer-ip]:3333

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation

### 2026-09-25 07:12 UTC - 77abb54
**Message:** `Add regression test locking voice/text parity through askWatchOracle

Traced the mic → sendMessage → askWatchOracle path in ReadingScreen.tsx
to verify the project's core invariant that voice never carries its own
astrology logic. Confirmed by reading: `kind` ('text'/'voice') is only
stored on the message for display — it is never threaded into the
runAsk/runDiscuss branch or the askWatchOracle/discussReading payload.

That invariant had zero regression coverage: ReadingScreen.test.tsx's
own header explicitly deferred all voice behavior to the STT/TTS hook
tests, which only exercise the hook in isolation and can't see whether
a future change routes voice through a different call. Added a test
that drives the mocked recognizer end-to-end (start → transcript →
stop) and asserts the resulting askWatchOracle call is shape-identical
to a typed send, with no kind/inputMethod field leaking into the
payload.

Also confirmed the two files.ts. TTS/STT test act() console warnings
flagged in Sept 25 audit are not bugs — useTextToSpeech.test.ts.ts:47-51
documents wrapping hook calls in act() as unreliable against this
project's pinned react/test-renderer combination. Left untouched.

Full suite: 27 suites, 308 tests passing. tsc --noEmit and eslint clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation
