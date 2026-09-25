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

### 2026-09-25 07:26 UTC - 6fb34e5
**Message:** `Fix: discussReading leaves its idempotency claim taken after a null reply

Bug: when composeDiscussionReply() returns null (Claude unreachable, a
malformed response, or a reply that failed PHASE 5F validation),
discussReading.ts refunded the spent discussion turn but never released
the idempotency claim before throwing 'unavailable' — unlike the
load/transaction-failure catch block right above it, which does both.

Real-world effect: the client's Retry button on a failed follow-up
reuses the SAME requestId by design (ReadingScreen.tsx's handleRetry —
"under its own SAME requestId, so the turn is not spent twice"). With
the claim still held, that retry lands on claimRequest's in-flight
branch and is told "This question is already being read. Give it a
moment" for up to IN_PROGRESS_TIMEOUT_MS (3 minutes) — even though
nothing is running and the first attempt already finished failing.

Fix: call release() in the null-reply branch too, mirroring the
existing catch block.

Verified the regression test actually catches the bug: reverted the
fix locally, confirmed the "releases the claim" test fails
(releaseRequest: 0 calls), restored the fix, confirmed it passes again.

Functions suite: 27 files, 547 tests passing. tsc --noEmit and
eslint --max-warnings=0 clean across functions/.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation

### 2026-09-25 07:38 UTC - 7844d46
**Message:** `Add direct test coverage for quotaSlots.ts — the app's quota gate

Audited every claim/refund call site in functions/ for the same
release-symmetry bug class as the discussReading fix (commit 6fb34e5):
askWatchOracle.ts (clean, single catch-all handles both refund+release)
and quotaSlots.ts itself, which had zero direct tests despite being the
sole quota gate askWatchOracle depends on to charge a seeker for a
reading — askWatchOracle.ts has no test file of its own, and quota.ts's
tests only exercise the read path (getQuota), never
claimQuotaSlot/refundQuotaSlot.

13 tests covering: free-plan claim/exhaustion/day-rollover, trial
active/expired precedence over the free limit, unlimited (paid) plans
never decrementing `used`, an expired paid plan correctly reverting to
free, and refundQuotaSlot's three no-op guards (no doc, stale day,
already-zero) plus its normal decrement.

Also verified quotaSlots.ts and rateLimit.ts on direct read — both
correct, no claim left unreleased on any failure path.

Functions suite: 28 files, 560 tests passing. tsc --noEmit and
eslint --max-warnings=0 clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation
