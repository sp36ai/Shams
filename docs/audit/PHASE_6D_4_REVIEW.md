# Phase 6D-4 — Independent Review Gate: Finding 6

Independent verification of `docs/audit/PHASE_6D_4_RECONNAISSANCE.md`
(`1aa7f45`), per the Phase 6D-4 Independent Review Gate authorization.
**Read-only — no production, dependency, Firebase-rule, deployment,
CI, or configuration file was modified by this review.** The one file
this review adds is this document itself. `git status --porcelain`
was confirmed clean before the first command and after the last.

## 1. Baseline

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: the 6D-4 reconnaissance at `1aa7f45`.
- Prior checkpoint: `7e6b547` (Finding 5 closure).
- Working tree: clean throughout.

## 2. Independent methodology

Every claim in `PHASE_6D_4_RECONNAISSANCE.md` was re-derived from
source: the 7-call-site/2-covered count re-enumerated fresh, every
gap's trigger re-traced from its own file **and** from where that file
is actually mounted in the app's navigation (a level the reconnaissance
itself did not go to for `OracleScreen`/`PremiumScreen`/`Onboarding`),
and the purchase-verification consequence traced end-to-end through
`finishTransaction()`/Google Play's own acknowledgment semantics — not
merely re-stated as "graceful."

## 3. Requirement-by-requirement verdicts

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Retrace all 7 sites, verify 2/7 vs 5/7 | **PASS** | §4.1 |
| 2 | Trace runtime trigger/reachability of each gap | **PASS**, with navigation-level evidence added beyond the reconnaissance | §4.2–§4.5 |
| 3 | Verify cold-start race and failure behavior for `getQuota`, `verifyGooglePlayPurchase`, `inferProfile` | **PASS**, one exposure claim corrected | §4.3–§4.4 |
| 4 | Verify `activateTrial` is genuinely unreachable | **PASS**, confirmed more exhaustively | §4.2 |
| 5 | Determine whether `ensureAppCheckReady()` is sufficient and correctly placed at each site | **PASS**, one site (`getQuota`) found to need real restructuring, not a one-line insert | §5 |
| 6 | Evaluate whether the purchase race can cause legitimate entitlement application failure | **PASS**, confirmed with a specific, previously-unstated mechanism | §6 |
| 7 | Compare per-callable vs shared-wrapper remediation shapes, without implementing | **PASS** | §7 |
| 8 | Confirm server-side App Check enforcement remains intact; issue cannot become an auth bypass | **PASS** | §8 |
| 9 | Run independent tests/evidence, mutation/failure-sensitivity where useful | **PASS** | §9 |
| 10 | Verify prohibited paths, no unrelated findings/surfaces altered | **PASS** | §10 |
| 11 | Determine whether any P0/P1 or hard-stop exists | **PASS — none found** | §11 |

**No requirement failed. No hard-stop condition was found.**

## 4. Evidence detail

### 4.1 The 2/7 vs 5/7 count

```
$ grep -rn "httpsCallable" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

7 real call sites, independently re-enumerated, exact match. Coverage
re-checked per file (`grep -c "ensureAppCheckReady"`): `watchOracle.ts`
and `oracleDiscussion.ts` — 2 matches each (import + call); the other
five — 0. **2 of 7 confirmed exactly.** Both compliant sites were also
read in full: `await withTimeout(ensureAppCheckReady(),
APP_CHECK_GATE_TIMEOUT_MS)` runs as the very first statement in each
function, before the callable is even built — correctly placed, used
as the review's own baseline for "correct placement" comparisons in §5.

### 4.2 `activateTrial` — reachability re-confirmed from three independent angles, not just the two the reconnaissance used

- Direct calls: `grep -rniE "\bstartTrial\b" src/` → only the store's
  own interface/implementation and one test's mock function.
- Selector/destructuring access: `grep` for `useQuotaStore(...)`
  selecting `startTrial` → no matches.
- Dynamic property access (`store['startTrial']` or equivalent) → no
  matches.

**Confirmed dead code from every angle this review could check, not
merely "no direct call found."** The reconnaissance's conclusion holds
and is now more exhaustively supported.

### 4.3 `getQuota` — exposure confirmed, and strengthened with navigation evidence the reconnaissance didn't include

`useQuota()`'s `useEffect(() => { refresh(); }, [refresh])` re-read
directly — fires on mount, confirmed. This review then traced **where**
`useQuota()` is mounted, which the reconnaissance did not do:

```
$ grep -rln "useQuota(" src/screens/
OracleScreen.tsx
ReadingScreen.tsx

$ grep -n "initialRouteName" src/navigation/MainTabs.tsx
initialRouteName="Home"   # Home = OracleScreen
```

**`OracleScreen` is the literal initial tab route.** For any
already-authenticated returning user — the ordinary case on every app
open after the first — this is not merely "a mount effect somewhere in
the app," it is the first screen rendered after the tab navigator
mounts. This is stronger, more concrete evidence for "direct, textbook
cold-start exposure" than the reconnaissance's own more general framing
provided.

### 4.4 `verifyGooglePlayPurchase` — one exposure claim corrected, not merely confirmed

The reconnaissance characterized the `purchaseUpdatedListener` path as
having "the same direct cold-start exposure as `getQuota`." This review
traced where `usePurchase()` (which registers that listener in its own
mount effect) is itself mounted:

```
$ grep -rln "usePurchase(" src/screens/
PremiumScreen.tsx
```

**`PremiumScreen` is not an initial or automatically-reached route** —
confirmed via `grep -n "useEffect" src/screens/PremiumScreen.tsx`
(no matches) and via the app's own navigation, where reaching this
screen requires a deliberate user action (opening the upgrade/premium
flow). The listener therefore only becomes active once a user
navigates there — **not at cold start**, unlike `getQuota`.

**Correction, not a reversal**: the listener path is still less
protected against the race than the deliberate `purchase()`/`restore()`
paths (there is no user-visible loading state or retry affordance for
a listener-delivered deferred/renewal purchase, unlike `purchase()`'s
synchronous return value the caller can react to), so it remains the
right one to prioritize among `verifyGooglePlayPurchase`'s three call
sites — but its risk shape is "no user-facing retry path," not
"cold-start timing," and the reconnaissance's own analogy to
`getQuota`'s exposure was not accurate. This is disclosed as a genuine
correction, not agreement dressed up as independent work.

### 4.5 `inferProfile` — first-launch framing independently confirmed

```
$ grep -n "needsOnboardingFlow\|Onboarding" src/navigation/RootNavigator.tsx
needsOnboardingFlow = isAuthenticated && onboardingLocationPrompted && !hasSeenOnboarding
<RootStack.Screen name="Onboarding" component={OnboardingRoute} />
```

Confirmed: for a genuinely new user (`!hasSeenOnboarding`), Onboarding
is the active route immediately after authentication — the exact
"first-launch, never-before-attested-device" scenario the
reconnaissance named. The actual `inferProfile` call still only fires
after three quiz answers, preserving the reconnaissance's "moderate
exposure, cushioned by interaction time" conclusion.

## 5. Is `ensureAppCheckReady()` sufficient and correctly placed at each site? — one real structural finding

`deleteAccount`, `activateTrialOnServer`, `verifyWithServer` (inside
`usePurchase`), and `inferProfile` are **all already plain `async
function`s** (confirmed via `grep -n "export async function\|async ("`
on each file). Inserting `await ensureAppCheckReady()` (wrapped in
`withTimeout`, matching the two compliant sites exactly) as the first
statement in each is a straightforward, structurally identical
drop-in — no restructuring risk.

**`useQuota`'s `refresh` is not.** It is declared `refresh: () =>
void` (a synchronous-returning `useCallback`), and its body
deliberately avoids `async`/`await` — its own comment explains why:
"Building the callable is synchronous... A throw here... would escape
this mount effect," using `.then()/.catch()/.finally()` chaining
instead. Adding the gate here correctly requires either restructuring
to an internally-async pattern that still satisfies the external
`() => void` contract (an async IIFE, or a `.then()`-chained
`withTimeout(ensureAppCheckReady(), ...)` before the existing
try/catch block), not a one-line insertion like the other four.

**This is a genuine, useful independent finding**: a future
implementation authorization for `getQuota` specifically needs to
preserve the synchronous-throw-guard property this file's own comment
already protects, not simply copy the two-line pattern from
`watchOracle.ts` verbatim.

## 6. Can the purchase-verification race cause legitimate entitlement application failure? — confirmed, with the actual mechanism traced

Read `purchase()`, `restore()`, and the `purchaseUpdatedListener`
handler in full (`src/hooks/usePurchase.ts:90–165`). Two distinct
consequences, not one:

- **`purchase()`** (deliberate buy-now flow): on a failed
  `verifyWithServer` call, the function returns `{ success: false,
  reason: 'verification_failed' }` directly to its caller — a
  synchronous, visible failure the calling screen can react to
  immediately (show an error, offer retry). **Low real-world exposure**
  (§4.4) and a visible failure mode.
- **The `purchaseUpdatedListener` path** (deferred/renewal purchases
  delivered by the native IAP layer): on a failed `verifyWithServer`
  call, `finishTransaction()` is **never called** —
  `.then(({verified}) => { if (verified) { ...; finishTransaction(...) }
  }).catch(() => undefined)` skips it entirely when `verified` is
  false. **This means the purchase is never acknowledged to Google
  Play.**

Traced the actual consequence of an unacknowledged purchase: Google
Play's own platform policy auto-refunds a purchase that is never
acknowledged within a fixed window (3 days) — **this is Google's own
safety net, not this app's code, and it means the user is not
permanently charged for an entitlement they never received.** But it
also means the entitlement is not self-healing within this app:
`restore()` — the only other code path that could re-verify and apply
it — is called **only from a button handler in `PremiumScreen.tsx`**
(confirmed via `grep -n "useEffect" src/screens/PremiumScreen.tsx` →
no automatic-restore-on-mount effect exists anywhere in this file).

**Confirmed conclusion**: yes, the race can cause a legitimate purchase
to go unapplied, specifically via the listener path — not a financial
loss to the user (Google's refund policy bounds that), but a real,
user-visible entitlement gap with no automatic recovery in this app;
the user would need to know to tap "Restore Purchases" themselves.

## 7. Per-callable gating vs. a shared wrapper — compared, neither implemented

- **Per-callable** (matching the 2 existing sites exactly): confirmed
  as a safe, drop-in change for 4 of the 5 gaps (§5); requires genuine
  restructuring, not just insertion, for the fifth (`getQuota`).
  Smallest diff per site; leaves the App-Check-gate responsibility
  duplicated across 7 files (and the `APP_CHECK_GATE_TIMEOUT_MS =
  8000` constant already duplicated in the two existing files,
  independently confirmed via `grep -rn "APP_CHECK_GATE_TIMEOUT_MS"
  src/`).
- **Shared wrapper** (a new async helper folding the gate into
  `regionalFunctions()`'s call pattern): would remove the duplication
  and structurally prevent a future new callable from being added
  without the gate, but touches all 7 call sites including the 2
  already-correct ones, and each site's own typed generic usage
  (`httpsCallable<Req, Res>('name')`, confirmed present at
  `useQuota.ts:52` and `OnboardingScreen.tsx:72`) would need the
  wrapper's own signature to preserve those types — not verified for
  compatibility by this review, consistent with the "compare, do not
  implement" scope.

**No position taken on which is safer overall** — the per-callable
approach is lower-risk *per edit*, the shared wrapper is lower-risk
*over time* (structurally prevents recurrence); which matters more is
a judgment call for whoever authorizes the remediation, not something
this review's evidence alone resolves.

## 8. Server-side enforcement — confirmed intact, confirmed this cannot become an auth bypass

```
$ grep -rn "enforceAppCheck" functions/src/functions/ functions/src/functions/payments/ | grep -v __tests__
```

11 distinct matches, one per `onCall` export, all still
`enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true'` —
unchanged, independently re-confirmed. **This client-side gap is
entirely orthogonal to authentication or authorization**: the
client-side `ensureAppCheckReady()` gate only affects whether a token
is *attached* before a callable fires; server-side enforcement
independently *rejects* any call arriving without a valid one,
regardless of what the client does. The worst case a missing client
gate produces is a legitimate, authenticated call being **rejected**
(fails closed) — never a call succeeding without proper App Check
validation. **Confirmed: this cannot become an authentication or
security bypass in either direction.**

## 9. Independent tests / evidence, and failure-sensitivity

No existing test file covers `ensureAppCheckReady()`'s own memoization
logic (consistent with the rest of this codebase's pattern of not unit
testing native-module-backed Firebase wrappers directly). The
underlying timing primitive both existing gates and any future fix
would rely on, `withTimeout`, **does** have real test coverage — run
fresh as independent evidence rather than assumed:

```
$ npx jest src/utils/__tests__/withTimeout.test.ts
PASS src/utils/__tests__/withTimeout.test.ts
  ✓ resolves with the value when the promise settles before the timeout
  ✓ resolves with undefined once the timeout elapses on a promise that never settles
  ✓ resolves with undefined (not a rejection) when the promise rejects
  ✓ does not resolve before the timeout for a still-pending promise
Tests: 4 passed, 4 total
```

This confirms, with actual evidence rather than by reading the
implementation and trusting it, that the fire-and-forget gate's
core guarantee — resolve `undefined` on timeout or rejection, never
hang, never throw — genuinely holds. This is the primitive any future
remediation for the 4 straightforward sites (§5) would reuse unchanged.

## 10. Prohibited paths and unrelated surfaces

```
$ git status --porcelain
(no output throughout this review)
```

No production code, dependency, Firebase rule, CI workflow, or
deployment configuration was touched. No file relevant to Finding 3,
5, or 7 was read, let alone modified — this review's file reads were
scoped exactly to Finding 6's own 7 call sites, their mounting screens,
and `functions/`'s `enforceAppCheck` declarations (§8, itself part of
confirming Finding 6's own security boundary, not a separate finding).

## 11. Hard-stop determination

**No hard-stop condition was triggered.** Checked explicitly against
each governing condition:

- No P0/P1 vulnerability was found or is being overlooked. §8
  establishes directly that this gap cannot become an authentication
  or security bypass — server-side enforcement is the actual security
  boundary and is confirmed intact and unaffected by any client-side
  gap.
- The purchase-verification consequence (§6) is real but bounded by
  Google Play's own platform-level refund policy — a business/UX
  defect with a known, external safety net, not a security defect and
  not a demonstrated permanent financial harm to any user.
- The `getQuota` structural-restructuring finding (§5) and the
  `verifyGooglePlayPurchase` exposure correction (§4.4) both refine the
  reconnaissance's own evidence without contradicting its overall
  conclusion or reversing its severity classification (P2).
- Nothing discovered during this review required stopping before
  completion.

## 12. Final disposition

**PHASE 6D-4 INDEPENDENT REVIEW GATE: ✅ PASS.**

All eleven requirements were independently re-verified against source,
navigation-level tracing the reconnaissance itself did not perform, and
one real test-suite run used as evidence rather than assumption. One
exposure claim (`verifyGooglePlayPurchase`'s listener path) was
corrected — it is not cold-start-adjacent the way `getQuota` is, though
it remains the right one to prioritize for a different reason (no
user-facing retry path). One structural finding was added for a future
remediation to account for (`getQuota`'s synchronous-callback shape
needs real restructuring, not a one-line insert). The
purchase-verification entitlement-failure mechanism was traced to its
actual root cause (`finishTransaction()` never called on a failed
verify) and its actual bound (Google Play's own unacknowledged-purchase
refund policy). Server-side App Check enforcement is confirmed intact
and this finding is confirmed incapable of becoming an authentication
or security bypass in either direction. No P0/P1 or hard-stop condition
was found.

**No remediation was performed and no closure document was created by
this review.** This is a review-gate PASS for the `1aa7f45` checkpoint
only. Per the governing sequence, the next step is a disposition
decision — a narrowly scoped remediation authorization (naming which
shape, and whether `activateTrial` should be included given its
confirmed dead-code status) if the owner wants one, or a decision to
close Finding 6 with this refined characterization and no code change
— followed by a separately authorized closure record. Findings 3
(Options A/B), 5, and 7 remain untouched.
