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

### 2026-09-25 07:43 UTC - 0a90fae
**Message:** `Fix: subscription.activated silently drops an unrecognized plan_id

Bug: unlike payment.captured's own unknown-plan branch (which logs a
warning and returns 200), subscription.activated's `if (plan) { ... }`
had no else — an unrecognized razorPlan (e.g. a new pricing plan added
in the Razorpay dashboard before RAZORPAY_PLAN_MAP is updated here)
fell through silently. Zero log line, zero audit trail, 200 OK sent to
Razorpay. A payer would be charged and never upgraded, with nothing in
Cloud Logging to explain why — the only way to notice was a support
ticket.

Fix: invert to `if (!plan)`, log the same shape of warning
payment.captured already uses for this exact situation, then return.
No behavior change for the mapped-plan path — just restructured to add
the missing branch.

Added two regression tests: one locks in payment.captured's existing
(already-correct) unknown-plan warning, which had no test either; the
other catches the subscription.activated gap. Verified the second test
actually catches the bug: reverted the fix, confirmed it fails, restored
it, confirmed it passes.

Functions suite: 28 files, 562 tests passing. tsc --noEmit and
eslint --max-warnings=0 clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation

### 2026-09-25 07:46 UTC - 8040d7d
**Message:** `Fix: Play Store acknowledge failures were invisible, risking silent auto-refunds

Bug: httpsPostAuth() — the call that acknowledges a Play subscription
purchase to prevent Google's auto-refund — resolved its promise on ANY
HTTP response, never checking res.statusCode. A rejected acknowledgement
(expired OAuth token, malformed request, a Play API outage) was
indistinguishable from a successful one: verifyGooglePlayPurchase still
granted the plan and logged nothing. Google auto-refunds an
unacknowledged subscription days later, with zero trail in Cloud
Logging pointing at why a paying seeker's subscription vanished.

Fix (observability only, no behavior change to entitlement granting —
the seeker already paid, so a failed acknowledgement still must not
block their plan):
  - httpsPostAuth now returns { status, body } like httpsGet already does
  - extracted isAckFailure(status) as a small exported pure predicate,
    matching this codebase's existing pattern (extractNonEmptyString,
    isUnverifiableEntitlementTarget in razorpay.ts) for testability
    without standing up a full https-mocking harness for one call site
  - the call site now logs a warning with status + response body on
    failure

Added 4 tests for isAckFailure covering Play's documented 200/204
success responses, 4xx/5xx, and the res.statusCode-absent (0) case.

Functions suite: 28 files, 566 tests passing. tsc --noEmit and
eslint --max-warnings=0 clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation

### 2026-09-25 07:47 UTC - 7747977
**Message:** `Add test coverage for activateTrial's idempotent-replay guarantee

No bug found in activateTrial.ts itself — read it in full, the
transactional get-then-set is correct. But its own header states
"idempotent... preserves the original trial start date" and nothing
verified that: the existing test file only covered rate-limiting.
Added 3 tests locking in the stated property: a second call returns
the original startedAt/expiresAt unchanged (not a fresh window),
performs no Firestore write on replay, and two different users get
independent trials.

Functions suite: 28 files, 569 tests passing. tsc --noEmit and
eslint --max-warnings=0 clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation

### 2026-09-25 07:50 UTC - a307175
**Message:** `Fix: getIp() trusted the spoofable first X-Forwarded-For entry

Bug: requestMeta.ts's getIp() returned the FIRST entry of
X-Forwarded-For — the one position any caller can set to an arbitrary
value, since a client's own XFF header is never stripped by proxies,
only appended to. This value feeds:
  - razorpay.ts's checkIpRateLimit — an attacker could send a fresh
    X-Forwarded-For value on every webhook request to make each one
    land in its own rate-limit bucket, bypassing the 30 req/min per-IP
    limit meant to slow HMAC brute-forcing/probing entirely.
  - ipHash on every securityEvents/auditLogs record across every
    function that logs one (razorpay, googlePlay, askWatchOracle,
    discussReading) — a spoofed IP poisons the one field ops would use
    to correlate abuse from logs.

Fix: trust the SECOND-TO-LAST entry instead, matching Google's
documented HTTPS Load Balancer / GFE behavior (Cloud Functions v2 runs
on Cloud Run, behind GFE): GFE appends exactly two entries to whatever
arrived — the client IP as GFE itself observed it on the TCP
connection, then GFE's own IP. The last entry is always GFE's own IP;
the second-to-last is the one entry a caller cannot forge, since GFE
appends it after whatever the client already sent.

Confidence note: this environment's network egress blocks every Google
documentation domain I tried (cloud.google.com, firebase.google.com,
discuss.google.dev, googlecloudcommunity.com) and several third-party
ones (stackoverflow.com, wikipedia.org), so this is backed by a web
search summary plus my own prior knowledge of GCP's documented LB
behavior, not a freshly-fetched primary source. Worth a maintainer
double-check against real Cloud Functions request logs (compare a
known real client IP against the logged X-Forwarded-For header) before
fully trusting this in a security-sensitive context — though any
interpretation other than "trust the client-supplied first entry" is
strictly safer than what shipped before.

Extracted trustedClientIp() as a small exported pure function so the
position logic is directly testable. Added 11 tests: the fix itself,
proof the old first-entry behavior differs from the new one on the
same attacker-crafted header, whitespace/empty-entry handling, and
requestMetaFromHttp's end-to-end wiring.

Functions suite: 29 files, 580 tests passing. tsc --noEmit and
eslint --max-warnings=0 clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation

### 2026-09-25 07:55 UTC - a527719
**Message:** `Add test coverage for validate.ts — every callable's sole input gate

No bug found — read sanitizeName() and every exported schema in full.
The narrow threat model (strip prompt-breakout/structural characters
from seekerName/motherName, the one field reaching a Claude prompt) is
deliberate and coherent: Unicode obfuscation (zero-width joiners, bidi
overrides) is a separate, already-covered concern at the output
boundary (narrationValidatorUnicodeSecurity.test.ts), not duplicated
here by design.

But validate.ts had zero test coverage despite gating every callable's
input. Added 44 tests covering all 5 exported schemas: boundary values
(question length, utcOffsetMinutes civil-offset range + 15-min step,
requestId length, batch size limits), .strict() rejecting smuggled
fields, and the seekerName/motherName sanitization pipeline (structural
character stripping, control-character deletion, whitespace collapse,
the 100-char cap, and the reject-rather-than-store-empty guarantee when
a name sanitizes down to nothing).

Also confirmed, via test, that SyncReadingsSchema's inner reading
object safely handles a smuggled userId field by Zod's default STRIP
mode (silently dropped, not merely unvalidated) — and separately, that
readings.ts's handler never spreads the raw parsed object into its
Firestore write regardless, reconstructing it field-by-field with its
own verifyAuth()-derived userId. Two independent safety mechanisms,
not one relying on the other.

Functions suite: 30 files, 624 tests passing. tsc --noEmit and
eslint --max-warnings=0 clean.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KU9dh1P1XrP6YVhVAdCvEW`
**Auto-logged by:** Claude Code
**Status:** Ready for Chrome validation
