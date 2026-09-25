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

### ✅ Claim/refund symmetry audit — closed out
7. Swept every `claimQuotaSlot`/`refundQuotaSlot`/`claimRequest`/
   `releaseRequest` call site in `functions/`: only 2 real callables use
   it (askWatchOracle — clean; discussReading — fixed in #6). Read
   `quotaSlots.ts` and `rateLimit.ts` in full: both correct. Added 13
   direct tests for `quotaSlots.ts` (free/trial/paid/expired-plan claim
   paths, all 3 refund no-op guards) since neither it nor
   `askWatchOracle.ts` had any prior direct test. Commit 7844d46.
8. **Verified the retired KP path is genuinely gone**, not just
   documented as gone: no `askOracle.ts` file exists, `index.ts` exports
   only `askWatchOracle`. Matches the project's core principle exactly.
9. **Firestore security rules — actually run, not just read.**
   `firestore.rules.test.ts` is excluded from the default `npm test`
   script and needs a real emulator (Java + firebase-tools), so it was
   unverified in this environment. Installed/ran it against the real
   emulator: all 26 tests passed — deny-by-default, no cross-user reads,
   no privileged-field writes (plan/admin/used/etc.), admin-only
   collections, catch-all deny. No defect found; genuinely confirmed.

## Session summary
One real, fixed, tested bug (discussReading idempotency leak). Two new
test suites closing real coverage gaps (voice/text parity,
quotaSlots.ts). One environment gap closed (functions/ deps were never
installed here). One security surface verified live, not assumed
(Firestore rules, 26/26 passing). Everything else audited came back
clean — reported as such rather than manufacturing findings.

## Round 2 — "keep auditing and fix" (deeper pass on payments + shared utils)

### ✅ 4 more real findings, all fixed and tested
10. **razorpay.ts — subscription.activated silently drops unknown plans.**
    Unlike payment.captured's branch, `if (plan) {...}` had no `else` —
    an unrecognized plan_id fell through with zero log line, zero audit
    trail, 200 OK. A payer charged and never upgraded, no way to
    diagnose from Cloud Logging. Fixed + 2 new regression tests
    (locked in payment.captured's existing behavior too, which was also
    untested). Commit 0a90fae.
11. **googlePlay.ts — acknowledge failures were invisible.** `httpsPostAuth`
    resolved on ANY HTTP response regardless of status — a failed Play
    Store acknowledgement (prevents Google's auto-refund) was
    indistinguishable from success. Extracted `isAckFailure()` as a
    testable predicate, added warning log on failure (non-fatal —
    entitlement still granted, seeker already paid). 4 new tests.
    Commit 8040d7d.
12. **activateTrial.ts — no bug, but its own stated core property
    (idempotent replay preserves original trial dates) had zero test
    coverage.** Added 3 tests. Commit 7747977.
13. **requestMeta.ts — SECURITY: getIp() trusted the spoofable FIRST
    X-Forwarded-For entry.** Any caller could set an arbitrary XFF
    header to bypass razorpay.ts's 30 req/min per-IP rate limit
    (fresh "IP" every request) and poison every securityEvents/
    auditLogs ipHash used for abuse correlation. Fixed to trust the
    second-to-last entry (GFE's own observed client IP — matches
    Google's documented LB append behavior: GFE always appends
    `<client-ip>,<GFE-ip>` to whatever arrived). Extracted
    `trustedClientIp()`, added 11 tests. Commit a307175.
    ⚠️ **Confidence caveat, told to user:** this environment's network
    egress blocks every Google docs domain and several third-party ones
    I tried to verify against — this is backed by web search + prior
    knowledge, not a freshly-fetched primary source. Flagged for a
    maintainer to double-check against real Cloud Functions request
    logs before fully trusting in a security context, though any
    interpretation beats trusting the client-supplied first entry.

### Files read, found clean, no changes
- quotaSlots.ts / rateLimit.ts (round 1)
- activateTrial.ts's own transaction logic (correct, just untested)
- razorpay.ts's overall structure (extensive prior PHASE 6A-R1 hardening
  — the unknown-plan gap was the one thing that slipped through)

## Session total: 5 real bugs found+fixed+tested, 4 coverage gaps closed
Everything committed, pushed, verified with full suite + tsc + eslint
after each change. Two fixes (discussReading, razorpay unknown-plan)
had their regression tests proven to actually catch the bug via
revert→fail→restore→pass.

### ✅ More coverage gaps closed (no further bugs)
14. readings.ts read in full — already thoroughly PHASE 6A-R1 hardened,
    no defect. validate.ts (every callable's Zod input gate) had ZERO
    tests — added 44 covering all 5 schemas + sanitizeName's prompt-
    injection defense. Confirmed the codebase's Unicode-obfuscation
    defense (zero-width/bidi chars) is deliberately handled at a
    separate output layer (narrationValidator), not duplicated here —
    coherent design, not a gap. Commit a527719.

## E2E CI failures (user-reported: signup-journey, settings-signout)
Pulled actual job logs from the latest main CI run (36105627106) rather
than guessing.

15. **settings-signout — fixed.** E2E_TEST_ACCOUNT_EMAIL/PASSWORD repo
    secrets are empty (known gap, issue #130). Flow typed blank
    credentials, Firebase rejected sign-in, flow burned 90s + emulator
    overhead before a confusing "settings-gear-btn not visible" failure
    ~7 min in. Added a guard step (settings-signout leg only) that fails
    in seconds with an actionable message. Same gate, same red result —
    doesn't change CI/deploy blocking, just makes the failure fast and
    diagnosable. **Actually fixing this leg still needs the owner to
    provision a pre-seeded Firebase test account and set both GitHub
    secrets** — that's a Firebase Console + repo settings action I
    cannot perform. Commit 8ec4c4a.
16. **signup-journey — diagnosed, not a code fix.** Confirmed via the
    run's own adb_watch.txt (sampled every 15s specifically to answer
    this) that the emulator device never actually disappeared — present
    in every sample for the full ~14min run. Maestro's own dadb client
    (not the host's real adb) transiently lost its connection under
    sustained CPU starvation: load 4.4-4.7 on a 2-vCPU runner, qemu at
    ~187% CPU despite the existing -cores 1 cap. dmesg shows no OOM
    kill. This is exactly the threshold ci.yml's OWN prior investigation
    named as "evidence a bigger runner is needed, not a guess" — every
    free mitigation (cores cap, 720x1600 res, disk cleanup) is already
    in place. Reported to user rather than guessing at further tuning;
    needs either a paid runner tier or a Maestro adb-client
    investigation — both owner decisions.

## Session grand total: 5 real bugs (client+server), 6 coverage gaps
closed, 2 E2E CI failures investigated (1 fixed fast-fail, 1 correctly
diagnosed as needing owner infra decision). Every code change verified
with full suite + tsc + eslint; two fixes proven via revert→fail→
restore→pass.

## Next Steps
Awaiting direction. Remaining unaudited: the RKP judgment engine itself
(heavily tested already — watchChart/watchJudgment/narration validator
suites), quota.ts's read path, admin.ts. Two things need the user's own
action, not more of mine: (1) verify the requestMeta IP-spoofing fix
against real Cloud Functions logs, (2) provision the E2E test account +
GitHub secrets, or decide on a bigger CI runner for signup-journey.
