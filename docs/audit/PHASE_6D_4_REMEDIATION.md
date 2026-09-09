# Phase 6D-4 — Targeted Remediation: App Check Readiness Gap Closed on the 5 Uncovered Callables

Authorized against **Finding 6** from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / `docs/audit/PHASE_6D_4_RECONNAISSANCE.md` /
`docs/audit/PHASE_6D_4_REVIEW.md`. Baseline: `9656d14`. Scope: the 5
client `httpsCallable` sites that did not await `ensureAppCheckReady()`
— `deleteAccount`, `activateTrial`, `getQuota`,
`verifyGooglePlayPurchase`, `inferProfile` — using the existing
per-callable pattern already established at the 2 compliant sites
(`askWatchOracle`, `discussReading`), not a new shared wrapper, per the
authorizing recommendation. No Review Gate or Closure Gate is claimed
or performed by this document; both remain separate, not-yet-issued
authorizations.

## 1. The pattern being replicated, re-confirmed before writing anything

`watchOracle.ts` and `oracleDiscussion.ts` both do, as the first
statement in their exported async function:

```ts
await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);
```

with a locally-defined `const APP_CHECK_GATE_TIMEOUT_MS = 8000;`. This
is the exact shape replicated at 4 of the 5 gaps; `getQuota` required a
structural accommodation, described in §2.3.

## 2. Implementation

### 2.1 `deleteAccount` (`src/firebase/account.ts`)

Already a plain `async function` — direct, drop-in insertion matching
the reference pattern exactly:

```diff
 import { regionalFunctions } from './functionsRegion';
+import { ensureAppCheckReady } from './appCheck';
+import { withTimeout } from '../utils/withTimeout';
+
+const APP_CHECK_GATE_TIMEOUT_MS = 8000;

 export async function deleteAccount(): Promise<DeleteAccountResult> {
+  await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);
+
   const fn = regionalFunctions().httpsCallable('deleteAccount');
```

### 2.2 `activateTrialOnServer` (`src/firebase/trial.ts`)

Same drop-in shape. Added despite `PHASE_6D_4_RECONNAISSANCE.md` §3 /
`PHASE_6D_4_REVIEW.md` §4.2's independently-confirmed finding that this
function's own client trigger (`quotaStore.startTrial()`) has no
caller anywhere in `src/` today — for consistency with every other
callable, and so the client is already correct the moment that trigger
is wired up, rather than leaving a known gap that would need
remembering later.

### 2.3 `getQuota` (`src/hooks/useQuota.ts`) — the one site requiring real restructuring, exactly as the review's §5 finding anticipated

`refresh`'s external contract is `refresh: () => void` — a
fire-and-forget function a mount effect calls bare, not an `async`
function. Its own existing comment documents a specific reason it
avoids `async`/`await`: `regionalFunctions().httpsCallable(...)` is
built *synchronously*, and a synchronous throw there must be caught
separately from the async `.catch()` on the resulting promise, or it
would escape the mount effect and crash the screen.

Simply making `refresh` `async` would have changed its call signature
(callers currently treat it as synchronous-void; `useEffect(() => {
refresh(); }, [refresh])` doesn't await it, which is fine either way,
but the exported `QuotaState.refresh: () => void` type is part of this
hook's public contract). Instead, the network path is wrapped in an
async IIFE, preserving `refresh`'s own signature and its exact,
pre-existing try/catch guard around the synchronous build:

```diff
     setLoading(true);
-    // Building the callable is synchronous: ...
-    try {
-      regionalFunctions()
-        .httpsCallable<object, { remaining: number }>('getQuota')({})
-        .then(r => { ... })
-        .catch(() => setServerRemaining(null))
-        .finally(() => setLoading(false));
-    } catch {
-      setServerRemaining(null);
-      setLoading(false);
-    }
+    void (async () => {
+      await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);
+
+      // Building the callable is synchronous: ...
+      try {
+        regionalFunctions()
+          .httpsCallable<object, { remaining: number }>('getQuota')({})
+          .then(r => { ... })
+          .catch(() => setServerRemaining(null))
+          .finally(() => setLoading(false));
+      } catch {
+        setServerRemaining(null);
+        setLoading(false);
+      }
+    })();
   }, []);
```

What this preserves, deliberately:

- The cache-hit early return (`if (_cachedRemaining !== null && now -
  _lastFetchAt < QUOTA_TTL_MS) { ...; return; }`) is **above** this
  block, untouched — a fresh cache still short-circuits before
  `setLoading(true)` is even reached, so the App Check gate is never
  awaited when no network call is going to happen at all.
- The synchronous-build try/catch is unchanged in every detail — same
  catch body, same comment, now simply running one `await` later
  inside the IIFE instead of directly in `refresh`'s own body.
- `refresh`'s exported type (`() => void`) and every existing caller
  (the mount `useEffect`, and any manual `refresh()` call elsewhere) is
  unaffected — `void (async () => {...})()` is still a synchronous
  call from the caller's perspective.
- `withTimeout(...)` is placed **outside** the try/catch, matching the
  reference sites, because it never throws (§3) — nothing here needed
  its own additional error handling.

### 2.4 `verifyGooglePlayPurchase` / `verifyWithServer` (`src/hooks/usePurchase.ts`)

Already an `async` `useCallback`. Gate placed as the first statement
inside the existing `try` block (the function's own body is entirely
wrapped in one `try { ... } catch { return { verified: false } }`, so
there is no separate "before the try" position the way the plain
`async function` sites have — placing it as the try block's first line
achieves the same effect: nothing else in the function runs before it):

```diff
     ): Promise<{ verified: boolean; planExpiry?: string }> => {
       try {
+        await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS);
+
         const fn = regionalFunctions().httpsCallable('verifyGooglePlayPurchase');
```

This is the single call site the review's §6 identified as the most
consequential of the five — reached via all three of `verifyWithServer`'s
callers (the deliberate `purchase()`/`restore()` paths, and the
mount-registered `purchaseUpdatedListener` the review traced as the one
with no user-facing retry if verification fails).

### 2.5 `inferProfile` (`src/screens/OnboardingScreen.tsx`)

Already a plain `async function`. Direct, drop-in insertion, same shape
as §2.1.

## 3. What was deliberately left alone

- **The 2 already-compliant sites** (`watchOracle.ts`,
  `oracleDiscussion.ts`) — untouched. No shared wrapper was introduced;
  the duplicated `APP_CHECK_GATE_TIMEOUT_MS = 8000` constant now exists
  in 7 files instead of 2, matching the existing pattern exactly rather
  than deduplicating it — deduplication was evaluated and explicitly
  not chosen (`PHASE_6D_4_REVIEW.md` §7), per the authorizing
  recommendation to use the existing precedent, not a new wrapper.
- **`appCheck.ts` and `withTimeout.ts` themselves** — untouched. Both
  are re-used exactly as they already exist; their own behavior is
  independently proven by `withTimeout.test.ts`'s existing 4 tests
  (re-run fresh in §4, not merely trusted).
- **`functions/`** — untouched. This remediation is entirely
  client-side; server-side `enforceAppCheck` on all 11 `onCall` exports
  is unaffected (re-confirmed in §4).
- **No new test file was added.** Consistent with existing practice in
  this codebase: neither of the 2 pre-existing compliant sites has a
  dedicated test exercising `ensureAppCheckReady()` either (confirmed:
  `grep -rln "ensureAppCheckReady" src/ --include="*.test.ts"
  --include="*.test.tsx"` returns nothing, before or after this
  remediation) — this is a pattern the whole codebase already follows
  for this specific native-module-timing concern, not a gap this
  remediation introduces.
- **Findings 3 (Options A/B), 5, and 7** — untouched. No file relevant
  to any of them appears in this remediation's diff.

## 4. Regression evidence

| Check | Result |
|---|---|
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** — unaffected; no existing test exercised any of these 5 files' network paths before or after |
| `npx jest src/utils/__tests__/withTimeout.test.ts` | **4/4** — the shared timing primitive's guarantees (resolve `undefined` on timeout or rejection, never hang, never throw) re-confirmed fresh against the exact code this remediation now relies on at 5 additional call sites |
| `grep -rn "enforceAppCheck" functions/src/functions/` | 11 matches, one per `onCall` export — unchanged, server-side enforcement independently unaffected |

## 5. Scope verification

```
$ git status --porcelain
 M src/firebase/account.ts
 M src/firebase/trial.ts
 M src/hooks/usePurchase.ts
 M src/hooks/useQuota.ts
 M src/screens/OnboardingScreen.tsx

$ git diff --stat
 src/firebase/account.ts          | 11 ++++++++
 src/firebase/trial.ts            | 13 +++++++++
 src/hooks/usePurchase.ts         | 12 ++++++++
 src/hooks/useQuota.ts            | 61 ++++++++++++++++++++++++++--------------
 src/screens/OnboardingScreen.tsx | 11 ++++++++
 5 files changed, 87 insertions(+), 21 deletions(-)

$ git diff -- src/firebase/appCheck.ts src/firebase/watchOracle.ts \
    src/firebase/oracleDiscussion.ts src/utils/withTimeout.ts functions/
(no output)
```

Exactly the 5 authorized files were changed. `useQuota.ts`'s larger
insertion/deletion count reflects the async-IIFE restructuring in §2.3,
not any change beyond what that restructuring required. The 2
already-compliant client sites, the shared `appCheck.ts`/`withTimeout.ts`
utilities, and the entire `functions/` backend are confirmed untouched.

`origin/main` was fetched and confirmed unchanged (`ce536bc` — the same
commit on record since Phase 6A-R1).

## 6. Hard-stop assessment

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was found or introduced — `PHASE_6D_4_REVIEW.md`
  §8 already established this gap category cannot become an
  authentication/security bypass in either direction; this remediation
  only closes the client-side readiness gap that existed, it does not
  touch the server-side enforcement that was always the actual security
  boundary.
- No existing behavior was changed for any caller of the 5 modified
  functions — every external signature (`Promise<DeleteAccountResult>`,
  `Promise<ActivateTrialResult>`, `refresh: () => void`,
  `Promise<{verified, planExpiry?}>`, `Promise<SeekerProfile>`) is
  identical before and after.
- No unrelated production code, dependency, Firestore rule, CI
  workflow, or deployment configuration changed.
- No evidence contradicts this document's own claims — every check in
  §4 was run directly against the final state.

## 7. What this remediation does and does not establish

- **Does establish**: all 7 real client `httpsCallable` sites in this
  codebase now await `ensureAppCheckReady()` (bounded by the same
  8-second `withTimeout` gate) before firing — closing the specific
  cold-start race `appCheck.ts`'s own doc comment describes, at every
  site the reconnaissance and review identified, including the one
  (`getQuota`) that required genuine structural care rather than a
  copy-paste insertion.
- **Does not establish**: that this has been observed working on a
  real device. Like every client-side timing behavior in this app, this
  is not something a Jest unit test can meaningfully exercise (no
  existing test does, for either the 2 original sites or these 5) —
  verified here by direct source inspection, typecheck, lint, and the
  full regression suite, not by a live device run this environment
  cannot perform.
- **Does not establish** production readiness in any sense. Findings 3
  (Options A/B), 5, and 7 remain untouched by this remediation.
- **Does not fully resolve** the entitlement-application risk
  `PHASE_6D_4_REVIEW.md` §6 traced for `verifyGooglePlayPurchase`'s
  listener path — this remediation closes the *timing* gap that made
  that risk more likely, but the underlying fact that a failed
  verification (for any reason, App-Check-timing or otherwise) leaves
  no automatic in-app retry (`restore()` remains button-only) is
  unchanged. That was explicitly outside this remediation's own scope
  (closing the App Check readiness gap, not redesigning the purchase
  recovery flow) and is disclosed here rather than implied to be fixed.

## 8. Deliverable / commit discipline

The only changes made under this authorization:

- `src/firebase/account.ts` (§2.1)
- `src/firebase/trial.ts` (§2.2)
- `src/hooks/useQuota.ts` (§2.3)
- `src/hooks/usePurchase.ts` (§2.4)
- `src/screens/OnboardingScreen.tsx` (§2.5)
- `docs/audit/PHASE_6D_4_REMEDIATION.md` (this document)

No other file is touched. This authorization does not perform or claim
a Review Gate or a Closure Gate — both remain separate, not-yet-issued
authorizations.

---

## Status

**PHASE 6D-4 IMPLEMENTATION: COMPLETE, pending independent review.**

| Layer | Status |
|---|---|
| Finding 6 reconnaissance | ✅ Complete (`1aa7f45`) |
| Finding 6 independent review | ✅ PASS (`9656d14`) |
| 6D-4 implementation | ✅ Complete (this document) |
| 6D-4 regression evidence | ✅ Recorded (this document, §4) |
| 6D-4 Review Gate | 🔲 Not yet authorized |
| 6D-4 Closure | 🔲 Not yet authorized |
| Finding 3 (Options A/B), 5, 7 | ⛔ Not addressed by this authorization |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for the 6D-4 Review Gate.
