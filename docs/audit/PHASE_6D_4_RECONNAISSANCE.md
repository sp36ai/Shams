# Phase 6D-4 — Reconnaissance: Finding 6 (App Check Readiness Gaps)

Read-only reconnaissance on **Finding 6** from `docs/audit/PHASE_6C_1_CLOSURE.md`
§6 / originally `docs/audit/PHASE_6B_CLOSURE.md` §2: *"App Check
readiness: only 2 of 7 real client `httpsCallable()` sites await
`ensureAppCheckReady()`."* Baseline: `7e6b547`. **No repository file is
modified by this document.**

## 1. The race this finding is about, re-read from source

`src/firebase/appCheck.ts` documents the exact defect this gate closes,
in its own code comments (re-read in full, not summarized from a prior
phase): `App.tsx` fires App Check initialization in a mount effect
without awaiting it, by design (nothing should block the UI on a
native attestation round-trip). Firebase Auth's token is typically
already cached and fast; Play Integrity's first exchange routinely is
not. A Cloud Function call fired in the first second or two after a
cold start — into an already-authenticated session — can go out with
no App Check header attached at all, not a rejected token but an
**absent** one. `ensureAppCheckReady()` (idempotent, memoized) plus
`withTimeout(..., 8000)` is the established, working pattern this
codebase already uses at two call sites to close that window: wait up
to 8 seconds for App Check to finish initializing, then proceed either
way (a fire-and-forget gate, not a hard block).

## 2. The count — independently re-enumerated, confirmed exactly

```
$ grep -rn "httpsCallable" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
watchOracle.ts:134        askWatchOracle
account.ts:20              deleteAccount
trial.ts:18                 activateTrial
oracleDiscussion.ts:86    discussReading
useQuota.ts:52              getQuota
usePurchase.ts:71          verifyGooglePlayPurchase
OnboardingScreen.tsx:72   inferProfile
```

7 real call sites, confirmed exactly as every prior phase reported.

```
$ grep -n "ensureAppCheckReady" <each file>
watchOracle.ts        — present (await withTimeout(ensureAppCheckReady(), 8000))
oracleDiscussion.ts   — present (same pattern)
account.ts            — absent
trial.ts              — absent
useQuota.ts            — absent
usePurchase.ts        — absent
OnboardingScreen.tsx  — absent
```

**2 of 7 confirmed exactly.** The finding's own headline count is
accurate and unchanged.

## 3. What every prior phase's "2 of 7" count never established — actual exposure per gap, traced individually

No prior phase examined *when* each of the 5 uncovered call sites
actually fires, or what happens to the user when the race is lost.
Both determine whether this finding is one risk repeated five times or
five materially different ones. Each was traced to its real trigger
and its actual failure-mode handling.

| Callable | Trigger | Exposure to the cold-start race window | Failure mode if App Check isn't ready |
|---|---|---|---|
| `activateTrial` | `quotaStore.startTrial()` | **None currently** — `startTrial()` has zero callers anywhere in `src/` (confirmed via `grep -rni "starttrial" src/`; only its own definition and one test mock exist). This client code path is not wired into any screen or flow in the current build. | N/A — unreachable today |
| `deleteAccount` | A destructive-action button in `SettingsScreen`, behind a confirmation `Alert`, several navigation steps deep in Settings | Lowest of the five reachable sites — requires real, multi-step user navigation; essentially never coincides with a cold-start window | Graceful: caught, logged to Crashlytics, a clear "delete failed" alert shown, loading flag reset — user can retry |
| `getQuota` | `useQuota()`'s `useEffect` — fires on mount of whatever screen uses the hook | **Direct, textbook exposure** — a screen-mount effect is exactly the class of trigger `appCheck.ts`'s own doc comment describes | Graceful: `.catch(() => setServerRemaining(null))`, loading flag resets in `.finally()` — UI shows "unknown remaining" rather than crashing |
| `verifyGooglePlayPurchase` | Three call sites in `usePurchase.ts`: (a) a `purchaseUpdatedListener` registered in a mount effect — fires for pending/deferred purchases delivered by the native IAP layer, genuinely possible right at cold start; (b) after a deliberate `purchase()` user action; (c) after a deliberate `restore()` user action | **Mixed** — path (a) has the same direct cold-start exposure as `getQuota`; paths (b)/(c) require real user interaction first, low exposure | Graceful in code (`catch { return { verified: false } }`), but the **most consequential outcome of the five**: a legitimately completed purchase could fail verification and not have its plan applied — a business/entitlement-correctness defect, not a security one |
| `inferProfile` | A 3-question onboarding quiz in `OnboardingScreen`, called after the user answers all three | Moderate — the quiz takes real interaction time (cushion against the race), but this is specifically the **first-launch, never-before-attested-device** scenario `appCheck.ts` itself identifies as the worst case for Play Integrity's first exchange | Graceful: `catch { return 'clarity' }` — a safe, silent fallback profile, not a hard failure |

**This reconnaissance's own conclusion, not present in any prior
phase**: of the five uncovered call sites, one (`activateTrial`) has no
live exposure at all today because its own client trigger is dead
code; one (`deleteAccount`) has low realistic exposure due to its deep,
deliberate navigation path; two (`getQuota`, and the
`purchaseUpdatedListener` path of `verifyGooglePlayPurchase`) have
genuine, direct cold-start exposure matching the exact race this
gate exists for; and one (`inferProfile`) has moderate exposure
specifically because it targets the first-launch scenario. Every one
of the five degrades gracefully in its own error handling — none
crashes the app or leaves the UI stuck — but `verifyGooglePlayPurchase`
is the one whose failure mode (an unapplied paid entitlement) is
qualitatively worse than the others' (a blank quota display, a wrong
onboarding profile, a "please retry" alert).

## 4. What a remediation would look like — two shapes, laid out, neither chosen

Not evaluated for a final decision or implemented by this
reconnaissance:

- **Option A — match the existing per-file pattern exactly.** Add
  `await withTimeout(ensureAppCheckReady(), APP_CHECK_GATE_TIMEOUT_MS)`
  (or import a shared constant instead of the two already-duplicated
  8000ms literals in `watchOracle.ts` and `oracleDiscussion.ts`) at the
  start of each of the 5 gaps' async functions, mirroring exactly what
  the 2 compliant call sites already do. Smallest, most
  precedent-consistent diff; touches 5 files individually.
- **Option B — a shared callable wrapper.** `regionalFunctions()`
  (`src/firebase/functionsRegion.ts`) is synchronous today and returns
  the raw Functions module; every call site invokes
  `.httpsCallable(name)(data)` on it directly. A new shared async
  helper (e.g. `callFunction(name, data)`) could fold the App Check
  gate in once, and all 7 call sites — including the 2 already-
  compliant ones — could migrate to it, removing the duplicated
  8000ms constant and any future risk of a new callable being added
  without the gate. Larger diff, touches files that are not currently
  broken, and was not assessed for compatibility with each call site's
  own typed generics (`httpsCallable<Req, Res>`) or error-handling
  shape.

**This reconnaissance takes no position on which is correct**, or on
whether `activateTrial`'s dead client-code-path status makes it a
lower priority than the other four regardless of which option is
chosen.

## 5. Hard-stop determination

**No hard-stop condition was triggered.** Checked explicitly:

- No P0/P1 vulnerability was found. This finding was already
  classified P2 (a reliability/UX gap in a fire-and-forget best-effort
  gate, not an authentication or authorization bypass — every one of
  these 11 callables still enforces App Check server-side regardless
  of whether the client pre-warms it; a lost race produces a rejected
  call, not an unauthenticated one) and nothing in this reconnaissance
  changes that classification.
- The `activateTrial` dead-code discovery is a reachability
  clarification, not a newly discovered live defect.
- Nothing in this reconnaissance required stopping before completion.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this reconnaissance is written against: `7e6b547` (the
  6D-3 Closure / Finding 5 closure).
- Working tree: clean before and after this document.
- No production, test, Firestore-rule, CI-workflow, deployment-
  configuration, or dependency file is touched — the only file this
  phase adds is this document.
- No implementation occurred. No client code was changed.

---

## Status

**PHASE 6D-4 RECONNAISSANCE (Finding 6): COMPLETE.**

| Layer | Status |
|---|---|
| Finding 5 | ✅ CLOSED (`7e6b547`) |
| 6D-4 reconnaissance (Finding 6) | ✅ Complete (this document) |
| 6D-4 implementation | 🔲 Not yet authorized |
| 6D-4 Review / Closure | 🔲 Not applicable until implementation is scoped |
| Finding 3 (Options A/B) | 🔲 Undecided — untouched |
| Finding 7 | ⛔ Untouched |
| Production readiness | ❌ Not established |

Awaiting a separate, explicit authorization for whichever remediation
shape (if any) the owner wants pursued among §4's options, or a
decision to close Finding 6 with this more precise, per-call-site
characterization and no further code change.
