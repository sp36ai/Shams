# Phase 6D-4 — Independent Review Gate: Remediation

Independent verification of `docs/audit/PHASE_6D_4_REMEDIATION.md`
(`88da486`), per the Phase 6D-4 Independent Review Gate authorization
(baseline `88da486`). **Read-only in its final state — no production,
dependency, Firebase-rule, deployment, CI, or configuration file was
left modified by this review.** Two throwaway test files were created,
run, and deleted as part of §4's mutation-detection evidence (never
committed); `git status --porcelain` was confirmed clean before the
first command, after each temporary file was deleted, and again before
this document was written.

## 1. Baseline

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Review target: the 6D-4 remediation at `88da486`.
- Prior checkpoint: `9656d14` (Finding 6 independent review of the
  reconnaissance).
- Working tree: clean throughout.

## 2. Independent methodology

The diff was re-read directly from committed history, not from the
remediation document's quoted excerpts. Beyond re-reading source, this
review went further than a read-only trace: it wrote genuine, executed
proof — two throwaway Jest test files (never committed) — demonstrating
that `ensureAppCheckReady()` is actually called, and called *before*
the corresponding callable is built, at three of the five remediated
sites, including the one requiring structural restructuring
(`getQuota`). Each proof was then mutation-tested: the gate was
temporarily removed from the real source file, the same proof was
re-run to confirm it fails, then the file was restored exactly and the
proof re-run to confirm it passes again.

## 3. Diff re-verification

```
$ git diff --stat 9656d14..88da486
 docs/audit/PHASE_6D_4_REMEDIATION.md | 302 +++++++
 src/firebase/account.ts              |  11 ++
 src/firebase/trial.ts                |  13 ++
 src/hooks/usePurchase.ts             |  12 ++
 src/hooks/useQuota.ts                |  61 ++---
 src/screens/OnboardingScreen.tsx     |  11 ++
 6 files changed, 389 insertions(+), 21 deletions(-)
```

The full diff of all 5 production files was read directly and confirmed
identical to what `PHASE_6D_4_REMEDIATION.md` §2 shows — every import,
every constant, every gate placement, character-for-character.

## 4. Executed proof, not just source reading

### 4.1 `deleteAccount` and `activateTrialOnServer` — call-order proof

A throwaway test (`src/firebase/__tests__/_review6d4_scratch.test.ts`,
never committed) mocked `../appCheck` and `../functionsRegion`,
recorded call order into a shared array, and invoked both exported
functions directly:

```
PASS  deleteAccount calls ensureAppCheckReady before building the callable
PASS  activateTrialOnServer calls ensureAppCheckReady before building the callable
```

Both passed with `callOrder` exactly `['ensureAppCheckReady',
'httpsCallable:<name>']` — the gate genuinely runs first, not merely
present somewhere in the file.

**Mutation check**: `account.ts`'s gate line was temporarily commented
out (`// MUTATION: await withTimeout(...)`), the same proof re-run:

```
FAIL  deleteAccount calls ensureAppCheckReady before building the callable
  - Expected: ["ensureAppCheckReady", "httpsCallable:deleteAccount"]
  + Received: ["httpsCallable:deleteAccount"]
```

Confirmed genuinely sensitive, not vacuous. The file was then restored
from a backup (`cp <backup> src/firebase/account.ts`); `git diff
--stat src/firebase/account.ts` produced no output, confirming an exact
restoration, and the proof was re-run green.

### 4.2 `getQuota`/`refresh` — the structurally significant one, proven via a real render

A second throwaway test
(`src/hooks/__tests__/_review6d4_scratch_useQuota.test.ts`, never
committed) mocked `../../firebase/appCheck`, `../../firebase/functionsRegion`,
and `@stores/quotaStore`, then used `renderHook(() => useQuota())` —
an actual React render, not a direct function call, since `refresh` is
invoked internally by the hook's own mount `useEffect`:

```
PASS  calls ensureAppCheckReady before building the getQuota callable on a cache miss
```

`callOrder` was exactly `['ensureAppCheckReady', 'httpsCallable:getQuota']`,
proving the async-IIFE restructuring in `PHASE_6D_4_REMEDIATION.md`
§2.3 genuinely gates the real, hook-internal call path — not merely
that the source *looks* correctly ordered.

**Mutation check**: the same gate line in `useQuota.ts` was temporarily
commented out, the proof re-run:

```
FAIL  calls ensureAppCheckReady before building the getQuota callable on a cache miss
  - Expected: ["ensureAppCheckReady", "httpsCallable:getQuota"]
  + Received: ["httpsCallable:getQuota"]
```

Confirmed genuinely sensitive. Restored from backup; `git diff --stat
src/hooks/useQuota.ts` produced no output; the proof was re-run green.
Both throwaway test files were then deleted entirely (never staged,
never committed) — `git status --porcelain` confirmed clean
immediately after.

### 4.3 `verifyGooglePlayPurchase` and `inferProfile` — verified by direct source inspection, not a new harness

These two were not given a throwaway executed proof, for reasons
specific to each rather than an inconsistency in rigor:

- `verifyWithServer` (`usePurchase.ts`) is not itself exported — it is
  a `useCallback` internal to `usePurchase()`, reached only through
  `purchase()`, `restore()`, or the `purchaseUpdatedListener` callback,
  all of which depend on `react-native-iap`'s own native-module API
  surface (`getSubscriptions`, `requestSubscription`,
  `purchaseUpdatedListener`, etc.). Constructing a faithful mock of
  that surface to reach `verifyWithServer` indirectly was judged
  disproportionate to what direct source inspection already settles
  unambiguously: the diff (§3) shows `await withTimeout(...)` as the
  literal first statement inside the function's own `try` block, before
  any other statement, including the `regionalFunctions()` call — there
  is no control-flow path that could reach the callable build without
  passing through the gate first.
- `inferProfile` (`OnboardingScreen.tsx`) is a module-local, non-exported
  `async function` — reachable only by rendering the entire
  `OnboardingScreen` component and simulating three quiz-answer
  interactions. Same conclusion from the diff: the gate is the first
  statement inside the function's `try` block, before the callable
  build.

For both, this review's confidence rests on the same class of evidence
this whole audit chain has repeatedly relied on for client-side,
native-module-adjacent code no Jest environment can fully exercise
(consistent with `PHASE_6D_4_REVIEW.md` §9's own observation that even
the 2 original compliant sites have no dedicated test for this exact
behavior) — direct, careful reading of the literal statement order in
committed source, not an assumption.

## 5. Independent regression, re-run fresh

| Check | Result |
|---|---|
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** — unaffected, re-confirmed both before and after the two throwaway test files existed and after their removal |
| `npx jest src/utils/__tests__/withTimeout.test.ts` | **4/4** |
| `grep -rn "enforceAppCheck" functions/src/functions/ functions/src/functions/payments/` | 11 distinct matches (one per `onCall` export), unchanged |

Every figure matches `PHASE_6D_4_REMEDIATION.md` §4 exactly, each
independently re-run rather than accepted from the document.

## 6. Scope verification

```
$ git diff --stat 9656d14..88da486 -- functions/ firestore.rules .github/ \
    package.json package-lock.json src/firebase/appCheck.ts \
    src/firebase/watchOracle.ts src/firebase/oracleDiscussion.ts \
    src/utils/withTimeout.ts
(no output)
```

The entire `functions/` backend, `firestore.rules`, every CI workflow,
both dependency manifests, the 2 already-compliant client sites, and
the shared `appCheck.ts`/`withTimeout.ts` utilities are all confirmed
untouched. `origin/main` re-fetched and confirmed unchanged (`ce536bc`
— the same commit on record since Phase 6A-R1); `88da486` confirmed
not an ancestor of `main`.

## 7. Hard-stop assessment

None of the governing hard-stop conditions is present:

- No P0/P1 vulnerability was found or introduced. Server-side
  `enforceAppCheck` is independently reconfirmed unchanged across all
  11 `onCall` exports — this remediation cannot become, and does not
  touch, the actual security boundary.
- No existing behavior changed for any caller of the 5 modified
  functions — external signatures unchanged, confirmed both by
  typecheck (which would fail on a signature mismatch) and by the
  executed proofs in §4, which invoke each function exactly as its
  real callers do.
- No unrelated production, dependency, rule, CI, or deployment file
  changed (§6).
- No evidence contradicts the remediation's own claims — every claim
  checked in this review was independently reproduced and matched, and
  the two claims given the deepest scrutiny (call ordering at
  `deleteAccount`/`activateTrialOnServer`, and the `getQuota`
  restructuring's correctness) were proven by actual execution and
  mutation testing, not merely re-read.

## 8. Final disposition

**PHASE 6D-4 REMEDIATION — INDEPENDENT REVIEW: ✅ PASS.**

The remediation's diff was independently re-verified against
committed history. Three of the five gated call sites were proven
correct by genuine, executed, mutation-tested evidence — not merely
re-reading source — including `getQuota`, the one site the prior
review's own structural finding flagged as needing care rather than a
copy-paste insertion; the remaining two were verified by direct,
unambiguous source inspection, with the reasons a live harness was not
built for them stated explicitly rather than left implicit. The full
regression suite, `withTimeout`'s own test suite, and server-side
App Check enforcement were all independently re-confirmed unchanged.
Scope is confirmed exact — no file outside the five authorized targets
and this review's own (deleted) throwaway tests was touched at any
point. No hard-stop condition was found.

**No further remediation was performed and no closure document was
created by this review.** This is a review-gate PASS for the `88da486`
checkpoint only. Per the governing sequence, the next step is a
separately authorized 6D-4 closure record. Findings 3 (Options A/B),
5, and 7 remain untouched; production readiness remains unestablished.
