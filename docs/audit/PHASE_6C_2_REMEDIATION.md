# Phase 6C-2 — Targeted Remediation: Rate Limiting Missing on 5 Callables

Authorized against **Finding 2** of `docs/audit/PHASE_6B_CLOSURE.md` §2:
*"Rate limiting missing on 5 callables (`syncReadings`, `deleteReading`,
`activateTrial`, `getQuota`, `setAdminClaim`)."* Baseline: `76930fd`.
Scope: this finding only, this exact set of five callables —
reconnaissance, implementation, and regression verification. No Review
Gate or Closure Gate is claimed or performed by this document; both
remain separate, not-yet-issued authorizations. Findings 3–7 are not
addressed.

## 1. Reconnaissance — establishing the gap and the fix pattern before touching anything

### 1.1 The shared rate-limit primitive

`functions/src/middleware/rateLimit.ts` exports one function,
`enforceRateLimit(userId: string): Promise<void>` — a per-user,
sliding-UTC-minute limiter backed by a Firestore transaction against
`/rateLimits/{userId}/minutes/{YYYY-MM-DDTHH:mm}`, throwing
`HttpsError('resource-exhausted', ...)` once the caller's count in the
current minute reaches `RATE_LIMIT_PER_MINUTE` (default 10). This
primitive already existed and needed no change — the finding was about
which callables invoke it, not the mechanism itself.

### 1.2 Confirming the gap, fresh, against the current tree

```
$ grep -rln "enforceRateLimit" functions/src/
functions/src/functions/account.ts
functions/src/functions/askWatchOracle.ts
functions/src/functions/classifyQuestion.ts
functions/src/functions/discussReading.ts
functions/src/functions/inferProfile.ts
functions/src/functions/payments/googlePlay.ts
functions/src/middleware/rateLimit.ts
```

Confirmed exactly as `PHASE_6B_CLOSURE.md` §2 stated: `readings.ts`
(`syncReadings`, `deleteReading`), `activateTrial.ts`, `quota.ts`
(`getQuota`), and `admin.ts` (`setAdminClaim`) do not appear — none of
the five target callables called `enforceRateLimit` anywhere.

### 1.3 The existing call-site convention, read from precedent before writing anything

`account.ts`'s `deleteAccount` (already rate-limited) established the
baseline shape:

```ts
async request => {
  const { userId } = verifyAuth(request);
  await enforceRateLimit(userId);
  // ... business logic
}
```

`askWatchOracle.ts` and `discussReading.ts` — the two callables that
combine `verifyAuth`, a Zod `parse()` step, *and* the `measure()`
telemetry wrapper — established a more specific convention for that
combination: `verifyAuth` → `parse()` → (inside `measure()`)
`enforceRateLimit()` → business logic. This was read directly from
both files before any target file was touched, so the five additions
below match this codebase's own existing convention rather than
introducing a new one.

## 2. Implementation — one `enforceRateLimit()` call added per callable, placed to match existing precedent

### 2.1 `readings.ts` — `syncReadings` and `deleteReading`

```diff
 import { verifyAuth } from '../middleware/auth';
+import { enforceRateLimit } from '../middleware/rateLimit';
 import { parse, SyncReadingsSchema, DeleteReadingSchema } from '../middleware/validate';
```

```diff
   async request => {
     const { userId } = verifyAuth(request);
     const { readings } = parse(SyncReadingsSchema, request.data);
+    await enforceRateLimit(userId);

     if (readings.length === 0) {
```

```diff
   async request => {
     const { userId } = verifyAuth(request);
     const { readingId } = parse(DeleteReadingSchema, request.data);
+    await enforceRateLimit(userId);

     try {
```

Both follow the `verifyAuth` → `parse()` → `enforceRateLimit()` order
these two callables have no `measure()` wrapper to nest inside, so the
call sits directly in the handler body, in the same relative position
`askWatchOracle.ts`/`discussReading.ts` use.

### 2.2 `quota.ts` — `getQuota`

```diff
 import { verifyAuth } from '../middleware/auth';
+import { enforceRateLimit } from '../middleware/rateLimit';
 import { FUNCTION_OPTS, UNLIMITED_PLANS, FREE_LIMIT, TRIAL_DAILY_LIMIT, todayKey } from '../config';
```

```diff
     const { userId } = verifyAuth(request);

     return measure<QuotaResponse>('getQuota', userId, async () => {
+      await enforceRateLimit(userId);
+
       const [snap, trialSnap] = await Promise.all([
```

`getQuota` has no `parse()` step (it takes no meaningful request body),
so the call is placed at the very start of the `measure()` callback —
matching `askWatchOracle.ts`/`discussReading.ts`'s placement *inside*
`measure()`, immediately preceding the callable's actual work.

### 2.3 `activateTrial.ts` — `activateTrial`

```diff
 import { verifyAuth } from '../middleware/auth';
+import { enforceRateLimit } from '../middleware/rateLimit';
 import { FUNCTION_OPTS, TRIAL_DURATION_DAYS } from '../config';
```

```diff
     return measure<ActivateTrialResponse>('activateTrial', userId, async () => {
+      await enforceRateLimit(userId);
+
       const trialRef = db.collection('trials').doc(userId);
```

Same placement rationale as §2.2 — no `parse()` step, so the call opens
the `measure()` callback.

### 2.4 `admin.ts` — `setAdminClaim`

```diff
 import { auth } from '../utils/admin';
+import { enforceRateLimit } from '../middleware/rateLimit';
 import { FUNCTION_OPTS } from '../config';
```

```diff
     if (!request.auth || request.auth.token.admin !== true) {
       throw new HttpsError(
         'permission-denied',
         'Unauthorized: Only admins can manage administrative claims.',
       );
     }

+    // PHASE 6C-2: rate-limit by the calling admin's own uid — request.auth
+    // is already confirmed non-null above.
+    await enforceRateLimit(request.auth.uid);
+
     const { targetUid, isAdmin } = request.data as { targetUid: string; isAdmin: boolean };
```

`setAdminClaim` has neither `verifyAuth()` nor `measure()` — it does its
own inline `request.auth`/`token.admin` check (a pre-existing style
inconsistency, tracked separately as Finding 11, **deliberately not
touched by this remediation** — see §5). The rate-limit call is placed
immediately after that existing check succeeds, keyed to the calling
admin's own `request.auth.uid` (already proven non-null by the check
above it), before the request body is read or any Auth/Firestore call
is made.

### 2.5 What was deliberately left alone

- **The `enforceRateLimit()` implementation itself**
  (`middleware/rateLimit.ts`) — untouched. The mechanism was already
  correct; only its adoption was incomplete.
- **`RATE_LIMIT_PER_MINUTE`'s configured value** (`config.ts`, default
  10/minute) — untouched. Changing the limit itself is a product/ops
  decision outside this finding's scope.
- **`setAdminClaim`'s inline auth-check style** (Finding 11) — untouched,
  as required by the authorization's "do not address Findings 3–7"
  boundary Finding 11 is a separate, later candidate.
- **No other callable** was touched. `account.ts`, `askWatchOracle.ts`,
  `classifyQuestion.ts`, `discussReading.ts`, `inferProfile.ts`, and
  `payments/googlePlay.ts` already called `enforceRateLimit` before this
  phase began and are unmodified.
- **Findings 3–7** — not addressed. No file relevant to any of them
  appears in this remediation's diff (verified in §5).

## 3. Regression evidence

### 3.1 Existing coverage, kept genuinely passing (not merely un-broken)

`functions/src/functions/__tests__/readings.test.ts` already covered
`syncReadings`/`deleteReading` in full (15 tests, from Phase 6A-R1).
Adding a real `enforceRateLimit()` call without accounting for it in
that test file's mocks broke 9 of those 15 tests immediately —
reproduced directly before any fix, confirming the change genuinely
executes on the real code path:

```
FAIL src/functions/__tests__/readings.test.ts > ... > rejects deleting a nonexistent reading
AssertionError: expected Error: unexpected collection: rateLimits to match object { code: 'not-found' }
Test Files  1 failed (1)
     Tests  9 failed | 6 passed (15)
```

Fixed by mocking `../../middleware/rateLimit` in that test file
(defaulting to "allow," matching how every other rate-limited
callable's tests would need to, had any existed) — restoring all 15
original tests to green, unmodified in their own assertions.

### 3.2 New coverage, one file per newly rate-limited callable (or extended, for `readings.ts`)

| File | New/extended | Tests added | What each proves |
|---|---|---|---|
| `readings.test.ts` | extended | +4 | `enforceRateLimit` is called with the caller's own uid for both `syncReadings` and `deleteReading`; a rejection blocks the call before any write — the target document is provably untouched. |
| `quota.test.ts` | new | 3 | Same two properties for `getQuota`, plus a legitimate-call regression check (the call still returns correct quota status when the rate limit allows it). |
| `activateTrial.test.ts` | new | 3 | Same two properties for `activateTrial`, plus a legitimate-call regression check (a new trial still activates). |
| `admin.test.ts` | new | 4 | Same two properties for `setAdminClaim`, plus a legitimate-call regression check, **plus** an explicit test that the pre-existing non-admin rejection still fires and never even reaches the rate limiter — proving this remediation did not weaken or reorder the existing authorization check. |

Every new test uses the same invocation pattern established in Phase
6A-R1 (`readings.test.ts`): the callable's own `.run()` method (the
real Firebase Functions v2 SDK attaches this for local invocation), a
minimal in-memory fake for whatever Firestore/Auth calls that specific
callable makes, and a mocked `enforceRateLimit` whose return value each
test controls directly — not a re-implementation of the callable's own
logic.

### 3.3 Full regression matrix, re-run fresh against the final state

| Check | Result |
|---|---|
| `cd functions && npx tsc --noEmit` | clean |
| `cd functions && npm run lint` | clean |
| `cd functions && npx vitest run` | **543/543**, 26 files (was 529/529 at the 6C-1 baseline; +14 new tests, 0 regressions) |
| `cd functions && npm run verify-engine-sync` | `Check passed — functions/src/engine/ matches src/astrology/.` |
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** (unaffected — this remediation touches no app-root code) |

## 4. Scope verification

```
$ git status --porcelain
 M functions/src/functions/__tests__/readings.test.ts
 M functions/src/functions/activateTrial.ts
 M functions/src/functions/admin.ts
 M functions/src/functions/quota.ts
 M functions/src/functions/readings.ts
?? functions/src/functions/__tests__/activateTrial.test.ts
?? functions/src/functions/__tests__/admin.test.ts
?? functions/src/functions/__tests__/quota.test.ts

$ git diff --stat
 functions/src/functions/__tests__/readings.test.ts | 59 +++++++++++++++++++++-
 functions/src/functions/activateTrial.ts           |  3 ++
 functions/src/functions/admin.ts                   |  5 ++
 functions/src/functions/quota.ts                   |  3 ++
 functions/src/functions/readings.ts                |  3 ++
 5 files changed, 72 insertions(+), 1 deletion(-)

$ git diff --stat -- firestore.rules src/ .github/ package.json \
    functions/package.json functions/package-lock.json firebase.json .firebaserc
(no output)
```

Exactly the five target production files (one addition of an import +
one `await enforceRateLimit(...)` call each, `admin.ts` also carrying a
two-line comment) plus their test coverage. No Firestore rule, no
app-root code, no CI workflow, no dependency manifest or lockfile, no
deployment configuration. No other callable, and no other finding's
area, appears in this diff.

`origin/main` was fetched and confirmed unchanged (`ce536bc` — the
same commit on record since Phase 6A-R1); this branch's HEAD is
confirmed not an ancestor of `main`.

## 5. Findings 3–7 — explicitly not addressed

Per the authorization's scope, this remediation touches only Finding 2.
Findings 3 (no staging environment), 4 (app-root dependency audit), 5
(functions dependency reachability), 6 (App Check readiness gaps), and
7 (Zod validation bypass in `admin.ts`/`inferProfile.ts`/
`classifyQuestion.ts`) remain exactly as `PHASE_6C_1_CLOSURE.md` §6
left them — open, untouched, unaddressed candidates for their own
future, separately authorized remediation. Finding 11 (`setAdminClaim`'s
auth-check style, from the original 6B reconnaissance's observations
list) is likewise untouched, even though this remediation edited the
same file — the rate-limit call was added around the existing check,
not into it.

## 6. Hard-stop assessment

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was discovered or introduced — this is an
  additive control (a new rejection path), not a removal of one.
- No existing authorization/ownership check was weakened. `admin.test.ts`
  directly proves `setAdminClaim`'s non-admin rejection still fires
  before the rate limiter is ever reached; `readings.test.ts`'s restored
  15 original tests directly prove `syncReadings`'s ownership check and
  `deleteReading`'s ownership check are both unchanged.
- No credentials, secrets, or deployment infrastructure needed to
  change.
- No broader shared security primitive was implicated —
  `enforceRateLimit()` itself was already correct and shared; this
  remediation only completed its adoption.
- No unrelated production defect was discovered during this work.

## 7. What this remediation does and does not establish

- **Does establish**: all 11 `onCall` exports in this codebase now call
  `enforceRateLimit()` — confirmed by re-running the same `grep` from
  §1.2 against the final state:

  ```
  $ grep -rln "enforceRateLimit" functions/src/functions/ functions/src/functions/payments/
  functions/src/functions/account.ts
  functions/src/functions/activateTrial.ts
  functions/src/functions/admin.ts
  functions/src/functions/askWatchOracle.ts
  functions/src/functions/classifyQuestion.ts
  functions/src/functions/discussReading.ts
  functions/src/functions/inferProfile.ts
  functions/src/functions/quota.ts
  functions/src/functions/readings.ts
  functions/src/functions/payments/googlePlay.ts
  ```

  Ten files, covering all previously-unlimited callables plus every
  already-limited one — no regression in the ones that already had it.
- **Does not establish**: that a live deployment has been observed
  enforcing this. As with Phase 6C-1, this environment's network
  restrictions prevent triggering or observing a live Cloud Functions
  invocation from here; everything in §3 was verified by running the
  callables' own `.run()` method locally against mocked dependencies,
  not by observing a deployed instance. The two verification boundaries
  named in `PHASE_6B_CLOSURE.md` §4 and carried forward through
  `PHASE_6C_1_CLOSURE.md` §3 remain exactly as unresolved after this
  remediation as before it.
- **Does not establish** production readiness in any sense. Findings
  3–7 remain open, unaddressed by this authorization.
- **One scoping note, not a finding**: the configured rate (10 requests
  per user per minute, `RATE_LIMIT_PER_MINUTE`'s default) was not
  evaluated for appropriateness against any of these five callables'
  actual usage patterns (e.g. `getQuota` may legitimately be polled more
  often than `setAdminClaim` should ever be called) — this remediation
  closes the "some callables have no gate at all" gap Finding 2 named;
  whether the shared limit's specific value is well-tuned per-callable
  is a distinct, out-of-scope product/ops question.

## 8. Deliverable / commit discipline

The only changes made under this authorization:

- `functions/src/functions/readings.ts` (§2.1)
- `functions/src/functions/quota.ts` (§2.2)
- `functions/src/functions/activateTrial.ts` (§2.3)
- `functions/src/functions/admin.ts` (§2.4)
- `functions/src/functions/__tests__/readings.test.ts` (extended, §3.1–3.2)
- `functions/src/functions/__tests__/quota.test.ts` (new, §3.2)
- `functions/src/functions/__tests__/activateTrial.test.ts` (new, §3.2)
- `functions/src/functions/__tests__/admin.test.ts` (new, §3.2)
- `docs/audit/PHASE_6C_2_REMEDIATION.md` (this document)

No other file is touched. This authorization does not perform or claim
a Review Gate or a Closure Gate — both remain separate, not-yet-issued
authorizations.

---

## Status

**PHASE 6C-2 IMPLEMENTATION: COMPLETE, pending independent review.**

| Layer | Status |
|---|---|
| Phase 6C-1 Closure | ✅ CLOSED (`76930fd`) |
| 6C-2 reconnaissance | ✅ Complete (this document, §1) |
| 6C-2 implementation | ✅ Complete (this document, §2) |
| 6C-2 regression evidence | ✅ Recorded (this document, §3) |
| 6C-2 Review Gate | 🔲 Not yet authorized |
| 6C-2 Closure | 🔲 Not yet authorized |
| Findings 3–7 | ⛔ Not addressed by this authorization |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for the 6C-2 Review Gate.
