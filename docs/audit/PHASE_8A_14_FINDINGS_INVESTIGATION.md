# Phase 8A-14 — Investigation of the Three Phase 8A-13 Findings

Implements: "Starting investigations with my authority" — read-only
investigation of the three findings from
`docs/audit/PHASE_8A_13_CI_VERIFICATION_RUN431.md` (Finding A: Maestro
assertion failures; Finding B: recurring artifact-storage quota;
Option A: `Post Cache Gradle` still skipped). **Read-only — no
application, test, or workflow file is changed by this document. No
fault is assumed for any component before evidence is gathered, per
the authorization's own instruction.**

---

## Finding A — Maestro/UI assertion failures

### A1. What was ruled out first: a code/flow regression

```
$ git log --oneline 0a1cb7a0..c337180 -- src/screens/AuthScreen.tsx src/App.tsx src/navigation .maestro/
b9c8f94 Trigger Play Store release retry after API recovery   (1-line comment only, src/App.tsx)
```

`0a1cb7a0` is run `#416`'s commit — the last run in this audit chain's
sampled history where Maestro fully passed (3/3 flows green,
2026-09-06). Between that commit and `c337180` (this investigation's
subject), **`AuthScreen.tsx`, the navigation tree, and all three
`.maestro/ci/*.yaml` flow files are byte-identical** — the only touch
in scope was a single-line trigger comment in `src/App.tsx`, unrelated
to rendering or auth logic. The testIDs the failed assertions look for
(`auth-tab-signup`, `auth-tab-signin`, `settings-gear-btn`) are
confirmed present in the current source
(`src/screens/AuthScreen.tsx:372,380`, `src/screens/OracleScreen.tsx:214`).

**This rules out a UI/flow-code regression or a testID rename as the
cause.** The same code, with the same flows, passed five days earlier.

### A2. What was checked next: render-blocking gates

`src/App.tsx` runs two `useEffect`s at boot:

1. `ensureAppCheckReady()` — fire-and-forget (`.catch()` only logs);
   does **not** block `RootNavigator` from rendering. Ruled out as a
   render-blocking cause.
2. `runSecurityChecks()` (`src/utils/security.ts`) — **does** gate
   rendering: if `passed: false`, the app renders a static "Integrity
   Error" screen instead of `RootNavigator`, which would explain all
   three flows failing at the very first visibility wait (nothing
   else would ever render). This file is also confirmed byte-identical
   between `#416` and `c337180` (empty diff). Reading its actual logic:
   all three blocking checks (Hermes, Debugger, Root/Frida) are
   `__DEV__`-gated to pass automatically in a debug build, and the
   emulator-detection check is explicitly implemented as
   **observe-only by design** — the code's own comment states this
   is deliberate, specifically so it does not "blank... any
   emulator-based E2E run." **Assessed as an unlikely cause**, based
   on reading the (unchanged) logic — not confirmed impossible, since
   this session cannot inspect the actual runtime value of `__DEV__`
   inside this specific `-Pe2eBundleJs=true` embedded-bundle debug
   build without device-level instrumentation this session does not
   have.

### A3. Why flow `01_auth_validation.yaml` failing rules out a Firebase-config explanation specifically

`01_auth_validation.yaml`'s first three steps require **zero network
calls**: it waits for `auth-tab-signin` to render, asserts static
text, and does client-side validation only (empty-submit and
weak-password checks never reach a Firebase call). This flow does not
depend on `GOOGLE_SERVICES_JSON` being the real secret vs. the CI
mock at all — yet it still failed at the very first wait. This is
notable because `02_signup_journey.yaml`'s own header comment claims
this flow needs "the real Firebase backend," which is not true of
`01`'s opening steps — **a Firebase secret/config difference between
runs cannot, by itself, explain flow `01`'s failure**, since flow `01`
never asks the app to reach Firebase before the point it already
failed.

### A4. What this investigation could not determine — and why

The single most direct piece of evidence that would settle this —
Maestro's own failure screenshots and view-hierarchy dump, which
Maestro writes automatically on any failed assertion — was **not
retrievable**, because the `Upload Maestro results` step (Finding B)
failed on the same run before those artifacts could be uploaded. This
is a direct, evidenced dependency between the two findings: **Finding
B's recurrence directly destroyed the primary diagnostic evidence for
Finding A**, on this specific run. This is not a coincidence worth
ignoring — a future rerun where Finding B is not present would, for
the first time, actually let a screenshot/hierarchy dump be inspected
after a Maestro failure.

Additionally, `ci.yml` has no logcat-capture step at all — if the app
crashed natively or threw an unhandled JS exception during boot, there
is no captured record of it in this workflow's artifacts today,
regardless of the quota issue.

### A5. Ranked hypotheses

1. **(Best supported by process of elimination, not direct evidence)**
   A transient/environmental issue specific to this run (emulator
   boot timing, a slow/failed resource fetch during React Native's own
   bundle/asset initialization, or similar) caused the app to not
   finish rendering within each flow's 20-second `extendedWaitUntil`
   window. Supported by: identical code + identical flows passing five
   days prior; not confirmed because no crash log or screenshot exists
   for this run.
2. **(Plausible, not ruled out)** Something about the emulator/runner
   state introduced by Options A/B's changes (§ this doc's Option A
   section; the pre-build cleanup) altered boot timing enough to push
   an already-marginal render time past the 20s timeout on this run
   specifically. The pre-build cleanup step was verified in
   `PHASE_8A_12_RUNNER_DISK_REMEDIATION.md` §1b to touch nothing
   Android/Node/Java-related, which argues against this, but a timing
   (not correctness) side effect was not separately measured.
3. **(Unsupported by evidence gathered, not excluded)** A genuine
   application-code regression outside the specific files diffed in
   §A1 (e.g., a dependency version drift, a Firebase SDK behavior
   change, or something in the wider 121-commit range between `#416`
   and `c337180` not captured by the targeted file list checked here).
   The targeted diff in §A1 was scoped to the files most directly
   implicated by the failing assertions, not the full 121-commit diff
   — **Not Verified**: whether some other file in that range could
   plausibly affect initial render timing.

**No hypothesis is confirmed.** Per the authorization's own
instruction, no fault is assigned to the app or the Maestro flows on
this evidence.

---

## Finding B — Recurring artifact-storage quota error

### B1. Timing evidence

- Run `#429` (2026-09-10, ~18:23 UTC): `Upload Maestro results`
  **succeeded**, no quota error.
- Run `#431` (2026-09-11, ~03:19 UTC): `Upload Maestro results`
  **failed** on the same quota error investigated in
  `PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md`.
- Gap between the two: **~9 hours** — inside the error message's own
  stated recalculation window: *"Usage is recalculated every 6-12
  hours."*

### B2. Ruling out new in-repo accumulation

Checked every workflow in this repository for activity in the
intervening ~9 hours:

```
$ list_workflows → 8 workflows total (CI, Deploy Cloud Functions,
  Deploy Firebase Hosting, Export upload key certificate, Firestore
  Rules Testing, Release to Play Store, Update package-lock.json,
  pages-build-deployment)
```

- `export-upload-cert.yml`: ran exactly once, in June — not a factor.
- `pages-build-deployment`: not an active/runnable workflow in this
  repo (404 on run listing) — not a factor.
- `ci.yml` (this repo's only artifact-producing workflow on ordinary
  runs, per `PHASE_8A_10_ARTIFACT_SIZING_FORENSICS.md`'s own findings):
  between `#429` and `#431`, `app-debug-apk` correctly did not upload
  on either run (opt-in-only, confirmed `skipped` on both), and
  `maestro-results` is the only other artifact — a few KB, `retention-days: 7`.

**No new artifact accumulation within this repository's own workflows
explains a fresh quota exhaustion in 9 hours.**

### B3. Ranked hypotheses

1. **(Best supported)** GitHub's own recalculation lag. The prior
   cleanup (91 artifacts, ~3.03 GiB, independently verified deleted in
   this conversation) may not have been reflected in the account's
   billed/enforced usage yet at the time of run `#431` — the error's
   own text states recalculation can take up to 12 hours, and only ~9
   had elapsed.
2. **(Plausible, not verifiable from this session)** The GitHub Actions
   artifact-storage quota is **account-level, not per-repository**
   (established in `PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md`).
   This session's tool access is scoped to `sp36ai/shams` only (per
   this session's repository-access policy) — **Not Verified: whether
   any other repository on this account is independently consuming
   the same shared quota.** This cannot be ruled in or out from here;
   it requires account-level billing/storage access, which remains
   outside this session's tool surface, exactly as documented in the
   original investigation.

**No remediation is proposed here** — per the authorization's
instruction not to weaken or bypass E2E artifact handling, and because
neither hypothesis above is something a workflow-file change can fix:
§B3.1 resolves itself with time; §B3.2 requires owner-level access
this session doesn't have.

---

## Option A — Why `Post Cache Gradle` is still skipped despite `save-always: true`

### C1. Root cause, confirmed from the action's own source (not inferred)

Fetched directly from `actions/cache`'s upstream repository (`main`
branch):

- `action.yml`'s input list confirms `save-always` exists but is
  **marked deprecated**, described as: *"Run the post step to save the
  cache even if another step before fails."*
- `src/saveImpl.ts` (the actual save logic) contains **no reference to
  `save-always` anywhere** — its only early-exit conditions are: the
  cache feature being unavailable, an unsupported event type, a
  missing primary key, or an **exact cache hit on the primary key**
  (in which case there's nothing new to save).
- `action.yml`'s post-entrypoint condition, quoted verbatim:
  **`post-if: success()`**.

`success()` is a GitHub Actions built-in that evaluates `true` only if
every step *before it in the job* has succeeded. `Cache Gradle`'s post
step (the save) runs at the end of the job, by which point
`Setup Android emulator` — a step that runs *after* `Cache Gradle` in
the main step sequence — has already failed on both sampled runs
(`#429`, `#431`). At the moment the post-step's `post-if: success()`
condition is evaluated, it is false, so the save is skipped.

**`save-always` has no effect on this specific gate.** Per the source,
it only controls whether to skip saving on an *exact cache hit* (a
different scenario entirely — ours was a total miss on both runs, so
`save-always` was never even reachable as a deciding factor). The
`post-if: success()` condition is hardcoded in `action.yml` and is
**not parameterized by any input** — there is no combination of inputs
to the combined `actions/cache@v4` action that saves a cache when a
later step in the same job has failed.

### C2. What this means for Option A as implemented

**Option A does not, and structurally cannot, achieve its stated goal**
(breaking the "failure → no-cache-warm → another cold run" loop
identified in `PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md` §3a) using the
combined `actions/cache@v4` action, regardless of `save-always`'s
value. This is not a matter of the setting being ineffective by
chance on two runs — it is the documented, confirmed behavior of the
action itself.

The commonly-used fix for exactly this scenario (well-documented as a
known limitation of the combined action) is to split the action into
its two composite parts: `actions/cache/restore@v4` for the restore
(unconditional, as today), and a separate, explicit
`actions/cache/save@v4` step placed later in the job with
**`if: always()`** set directly on that step (not relying on the
combined action's own internal `post-if`). This decouples the save
from the job's overall `success()` state entirely. **Not implemented
here** — this is a diagnosis only, per the investigation's scope; the
actual fix requires its own remediation authorization.

---

## Summary table

| Finding | Root cause status | Fault assigned? |
|---|---|---|
| A — Maestro assertion failures | Not confirmed. Code/flow regression ruled out (identical to last pass). Render-blocking security gate assessed unlikely from unchanged logic. Primary diagnostic evidence (Maestro screenshots) unavailable because of Finding B. | None — genuinely unresolved |
| B — Recurring artifact quota | Not confirmed which of two hypotheses (recalculation lag vs. cross-repo/account-level usage this session cannot see) is responsible. New in-repo accumulation ruled out. | None — genuinely unresolved, and partly outside this session's visibility |
| Option A — cache save skipped | **Confirmed**, from the action's own source: `post-if: success()` is hardcoded and unaffected by `save-always`. `save-always` only governs the exact-hit-skip case, never reached on either sampled run. | N/A — this is a structural fact about the tool, not a fault to assign |

## Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — no file touched.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  investigation.

---

## Status

**PHASE 8A-14 INVESTIGATION: COMPLETE (diagnostic record; no remediation implemented).**

| Layer | Status |
|---|---|
| Finding A root cause | 🔲 Not confirmed — code/flow regression ruled out; hypotheses ranked, none proven |
| Finding B root cause | 🔲 Not confirmed — in-repo accumulation ruled out; account-level visibility gap remains |
| Option A root cause | ✅ Confirmed from source — `post-if: success()` is unaffected by `save-always` |
| Cross-finding dependency identified | ✅ Finding B's recurrence destroyed Finding A's primary diagnostic evidence on this run |
| Remediation | 🔲 Not implemented — awaiting separate authorization(s) |
| CI rerun / merge / deployment | 🔲 Not attempted |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting separate, explicit remediation authorization(s) before any
`ci.yml`, application, or test file is changed.
