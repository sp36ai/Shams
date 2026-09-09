# Phase 6D-4 — Formal Closure: Finding 6

This document formally closes Finding 6 (from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / originally `docs/audit/PHASE_6B_CLOSURE.md` §2: *"App Check
readiness: only 2 of 7 real client `httpsCallable()` sites await
`ensureAppCheckReady()`"*). It records no new evidence and makes no
production-code, test, Firestore-rule, or deployment-configuration
change — it exists solely to give the 6D-4 chain the same explicit
closure record every completed chain in this project's audit trail
already has. It is the only file this closure adds.

## 1. Chain history

| Step | Commit | Outcome |
|---|---|---|
| 6D-4 reconnaissance | `1aa7f45` | Re-confirmed the 2/7 coverage count exactly, then went further than any prior phase: traced each of the 5 uncovered call sites to its actual runtime trigger and failure-mode handling. Found `activateTrial`'s client trigger has zero callers anywhere in `src/` (dead code); `getQuota` fires on `OracleScreen`'s mount (a direct cold-start exposure); `verifyGooglePlayPurchase` has three call sites with mixed exposure; `inferProfile` targets first-launch devices specifically. Flagged `verifyGooglePlayPurchase` as the most consequential of the five (a lost race could leave a legitimate purchase's entitlement unapplied). Laid out two remediation shapes (per-callable vs. shared wrapper) without choosing either. No hard-stop found. |
| 6D-4 independent review (reconnaissance) | `9656d14` | **PASS.** Independently re-confirmed the 2/7 count and `activateTrial`'s dead-code status from three angles. Added navigation-level evidence the reconnaissance didn't reach: `OracleScreen` is `MainTabs`' literal `initialRouteName`, strengthening `getQuota`'s exposure claim; corrected one claim — `PremiumScreen` (where the purchase listener registers) is not an automatic route, so that path is not cold-start-adjacent the way `getQuota` is, though it remains the right priority for a different reason (no user-facing retry). Found a real structural point: 4 of 5 gaps are plain `async` functions (drop-in), but `getQuota`'s `refresh` needed genuine restructuring to preserve its synchronous throw-guard. Traced the purchase-entitlement risk to its exact mechanism (`finishTransaction()` never called on a failed verify) and its actual bound (Google Play's own unacknowledged-purchase refund policy). Confirmed server-side App Check enforcement intact and this gap incapable of becoming an authentication bypass. No hard-stop found. |
| 6D-4 implementation | `88da486` | Added the `withTimeout(ensureAppCheckReady(), 8000)` gate — matching the existing precedent at the 2 already-compliant sites, not a new shared wrapper — to all 5 remaining callables: `deleteAccount`, `activateTrialOnServer`, `getQuota` (restructured via an async IIFE to preserve `refresh`'s `() => void` signature and its synchronous-build throw-guard exactly), `verifyGooglePlayPurchase`/`verifyWithServer`, and `inferProfile`. `activateTrial`'s gate was added despite its confirmed dead client trigger, for consistency. Full regression clean (306/306 app tests, clean typecheck/lint); server-side enforcement independently re-confirmed unaffected. |
| 6D-4 independent review (remediation) | `f0ab6bf` | **PASS.** Independently re-verified the diff, then went beyond source reading: wrote genuine, mutation-tested executed proof (temporary, never committed) that `ensureAppCheckReady()` is called before the callable is built at `deleteAccount`, `activateTrialOnServer`, and — via an actual `renderHook(() => useQuota())` render — `getQuota`'s restructured `refresh()`. Each proof was confirmed sensitive by temporarily removing the real gate, observing the proof fail, then restoring the source exactly and re-confirming green. `verifyGooglePlayPurchase`/`inferProfile` verified by direct source inspection, with the reason a live harness wasn't built for them stated explicitly. Full regression and server-side enforcement re-confirmed unchanged. No hard-stop found. |

This closure ratifies all four checkpoints — `1aa7f45`, `9656d14`,
`88da486`, `f0ab6bf` — exactly as authorized at each step. It performs
no re-verification of its own; it consolidates what those four
documents already established.

## 2. What is ratified

- **All 7 real client `httpsCallable` sites in this codebase now await
  `ensureAppCheckReady()`** (bounded by the same 8-second
  `withTimeout` gate already established at the original 2 compliant
  sites), closing the specific cold-start race
  `src/firebase/appCheck.ts`'s own doc comment describes.
- **The one structurally significant site (`getQuota`) was handled
  deliberately, not copy-pasted** — its restructuring was flagged as a
  requirement by the reconnaissance review, implemented via an async
  IIFE that preserves `refresh`'s external `() => void` contract and
  its pre-existing synchronous-build throw-guard exactly, and then
  proven correct by an actual React render plus mutation testing at
  the remediation review — the deepest verification any single item in
  this finding received.
- **Server-side App Check enforcement was independently re-confirmed
  intact at every step** (all 11 `onCall` exports, unchanged
  throughout). This finding was, at every stage, confirmed incapable
  of becoming an authentication or security bypass — the client-side
  gap only affected whether a token was pre-warmed before firing; the
  server was always the actual, unaffected security boundary.

## 3. What remains explicitly disclosed, not silently resolved

**This is not a claim that every risk this finding touched on is
gone. It is a closure of the specific gap Finding 6 named, with the
following carried forward exactly as each prior document recorded
them:**

- **`activateTrial`'s client trigger remains dead code.** The gate is
  in place and correct, but `quotaStore.startTrial()` still has no
  caller anywhere in `src/` — confirmed at reconnaissance, review,
  and unaffected by this remediation, which did not wire up that
  trigger (out of scope: this finding was about App Check readiness,
  not about completing an unrelated, unimplemented feature).
- **The `verifyGooglePlayPurchase` entitlement-recovery gap is
  unchanged.** This remediation closes the *timing* race that made a
  failed verification more likely on the `purchaseUpdatedListener`
  path; it does not add an automatic retry. `restore()` remains a
  button-only action in `PremiumScreen` — a user whose purchase
  verification fails for any reason (App-Check-timing or otherwise)
  still needs to know to tap "Restore Purchases" themselves. Bounded
  by Google Play's own unacknowledged-purchase refund policy (no
  permanent financial loss), but not self-healing in this app. This
  was explicitly named as out of this remediation's own scope in
  `PHASE_6D_4_REMEDIATION.md` §7 and is restated, not resolved, here.
- **This finding's classification (P2 — a reliability/UX gap, not a
  security defect) is unchanged** by its closure; closing it does not
  retroactively make it more or less severe than it always was.

## 4. Regression evidence at the reviewed checkpoint (`f0ab6bf`, restated from the review, not re-run by this closure since no code changed since that review)

| Check | Result |
|---|---|
| `npm run typecheck` (app root) | clean |
| `npm run lint` (app root) | clean |
| `npm test -- --runInBand` (app root) | **306/306** |
| `npx jest src/utils/__tests__/withTimeout.test.ts` | **4/4** |
| Executed, mutation-tested proof — `deleteAccount` | gate called before the callable is built; mutation removed it, proof failed; restored, proof passed |
| Executed, mutation-tested proof — `activateTrialOnServer` | same result |
| Executed, mutation-tested proof — `getQuota` (via `renderHook`) | same result, on an actual React render exercising the hook's own mount effect |
| `verifyGooglePlayPurchase` / `inferProfile` | verified by direct source inspection (gate is the literal first statement in each function's `try` block); reasons a live harness wasn't built stated explicitly |
| `grep -rn "enforceAppCheck" functions/src/functions/` | 11 matches, one per `onCall` export — unchanged |
| Prohibited-path diff (`9656d14..88da486`: `functions/`, `firestore.rules`, CI, dependency manifests, the 2 original compliant sites, `appCheck.ts`/`withTimeout.ts`) | **empty** |
| `main` | untouched (`ce536bc`, confirmed not an ancestor relationship reversed) |

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this closure is written against: `f0ab6bf` (the 6D-4
  remediation's Independent Review Gate PASS).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, or deployment-configuration
  file is touched by this closure — the only file this phase adds is
  this document.
- No Phase 5, 6A, 6B, 6C, or earlier 6D document is created or
  modified by this closure.

## 6. Finding 3 (Options A/B), Finding 7, and further Phase 6 work

- **Finding 3's remaining options (A/B)** and **Finding 7** remain
  open, unaddressed by this closure. Each is a separately scoped
  candidate for its own future reconnaissance chain, exactly as
  Finding 6 was until this document.
- **No further Phase 6 work has begun.** This closure does not scope,
  begin, or authorize any Finding 7 work, any further Finding 3 work,
  or any other Phase 6 activity.
- **This closure does not declare the application production-ready.**
  It closes the specific App Check readiness remediation and review
  chain authorized against Finding 6. The disclosures in §3 remain
  explicitly open, carried forward for whichever future, separately
  authorized work addresses them.

---

## Status

**PHASE 6D-4 / FINDING 6: CLOSED.**

| Layer | Status |
|---|---|
| Phase 5 | ✅ CLOSED |
| 6A | ✅ CLOSED |
| 6B | ✅ CLOSED |
| 6C-1 | ✅ CLOSED |
| 6C-2 | ✅ CLOSED |
| 6D-1 (Finding 3 / Option C) | ✅ CLOSED |
| Finding 4 | ✅ CLOSED |
| Finding 5 | ✅ CLOSED |
| 6D-4 reconnaissance (Finding 6) | ✅ Complete (`1aa7f45`) |
| 6D-4 Independent Review (recon) | ✅ PASS (`9656d14`) |
| 6D-4 implementation | ✅ Complete (`88da486`) |
| 6D-4 Independent Review (remediation) | ✅ PASS (`f0ab6bf`) |
| 6D-4 Closure | ✅ CLOSED (this document) |
| Finding 3 (Options A/B) | 🔲 Undecided — untouched |
| Finding 7 | ⛔ Untouched |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for the next Phase 6 step.
