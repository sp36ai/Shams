# Phase 8A-25 — Finding A: Root-Cause Correction (SystemUI ANR, Not a Bundle Defect)

Records a joint diagnostic review of run `#435`'s captured evidence
that materially corrects the working theory of Finding A's cause.
**Read-only — no application or workflow file is changed. No
remediation is authorized or performed by this document.**

## 1. What was proposed, and why it doesn't hold up

A detailed diagnosis was proposed attributing Finding A to the debug
E2E build still running in dev mode — trying to load JS from a Metro
dev server that doesn't exist in CI, so the RN UI never mounts and
every testID assertion fails identically. The evidence cited: repeated
`Failed to connect to /10.0.2.2:8081` / `ReactNativeJNI` websocket
errors, zero `ReactNativeJS`-tagged log lines, and a captured
view-hierarchy dump showing zero elements under
`com.astrosarfaraz.shamsalasrar:id`.

**Independently verified, and does not support that conclusion:**

- `android/app/build.gradle` already implements `-Pe2eBundleJs=true`
  correctly: `debuggableVariants = []` is the React Native Gradle
  Plugin's documented mechanism for forcing bundle embedding on the
  debug variant. This is not a dead comment or broken flag — the
  `Build debug APK (embedded JS bundle)` step also completes without
  error on every sampled run.
- The `10.0.2.2:8081` retries and absent `ReactNativeJS` tag are real
  (confirmed directly in the logs), but on their own are consistent
  with several explanations, not only "the bundle never loaded" —
  RN's dev-support manager can poll for a dev server independent of
  whether the main bundle is embedded, and plain `console.log`
  output being absent doesn't by itself prove the JS engine never ran
  (native-bridge activity for this app's own process — `ReactNativeJNI`,
  `RNFBCrashlyticsInit` — was observed in earlier captures, per
  `PHASE_8A_21_CI_VERIFICATION_RUN433.md`).
- **The decisive correction**: the view-hierarchy dump's "zero app
  elements" finding is real, but what is actually on screen at that
  moment is not blank/unrendered — it's a system dialog titled
  **"System UI isn't responding"** (`android:id/alertTitle`,
  `android:id/aerr_close`/`aerr_wait` — the standard Android ANR
  dialog for `com.android.systemui`, not the app under test). A
  SystemUI-level ANR sits on top of everything and would hide any
  app underneath, regardless of that app's own state. "No app
  elements visible" is explained by this overlay, not established as
  proof the app never rendered.

## 2. Verified: the pattern recurs across (at least) two of the three flows, with identical bounds

Confirmed directly in run `#435`'s job log (`103343316452`):

```
Occurrence 1 (line 1715): "text": "System UI isn't responding" ... "bounds": "[133,1000][947,1071]"
Occurrence 2 (line 3126): "text": "System UI isn't responding" ... "bounds": "[133,1000][947,1071]"
```

**Identical bounds in both captured instances.** This is consistent
with one persistent SystemUI ANR sitting on screen for an extended
period, not three independently-triggered app-level failures — each
flow's assertion simply times out against whatever is on top of the
screen at that moment, which happens to be the same stuck dialog.

**Precision note, not a contradiction**: a third occurrence was
proposed (three snapshots, one per flow) but this session's own fetch
of the same job log contains only **two** occurrences of "System UI
isn't responding" — the log itself appears complete (ends in normal
job-cleanup output, not cut short). The most likely explanation is
that the third flow's hierarchy dump exceeded the pre-existing
`<50KB` inline-size filter (the same filter `PHASE_8A_22` found
excludes `commands-*.json` unless specifically handled — the
`ai-report-*.html`/hierarchy files are still subject to it
unmodified) and was simply never inlined into this log, not that a
third, differently-shaped snapshot exists. **This is recorded as an
open, unresolved gap in the evidence, not a finding either way for
the third flow specifically.**

## 3. Revised understanding of Finding A

The evidence, taken together, now points toward: **the runner's
Android emulator's own SystemUI process becomes unresponsive during
the run, obscuring the screen** — and Maestro's timeout-bound
assertions fail against that overlay rather than against the app's
own (possibly perfectly fine) auth screen underneath. This is
consistent with, and now provides a much more concrete mechanism for,
this audit chain's standing resource-constraint observations
(`PHASE_8A_11_RUNNER_DISK_INVESTIGATION.md`,
`PHASE_8A_18_FINDING_A_DEEPER_INVESTIGATION.md`): the AVD's own
`config.ini` specifies `hw.ramSize = 1536M` and `hw.cpu.ncore = 2` —
a tight budget on a shared CI runner, plausible grounds for the
emulator's own system UI thread to stall under load.

**This is a materially different, and better-supported, working
theory than a JS-bundle/dev-mode defect.** No app code, Maestro
assertion, or build-config change is indicated by this evidence.

## 4. Explicitly ruled out by this review

- **The proposed `-Pe2eBundleJs`/`bundleInDebug` build-config fix.**
  The mechanism is already correctly implemented; there is no
  evidence it is failing. Making that change now would be an
  unevidenced fix for a defect this review does not confirm exists —
  correctly not implemented, per the standing engineering discipline
  against shotgun fixes.

## 5. What remains open, and the two forward paths offered

- Whether the SystemUI ANR is itself caused by emulator RAM/CPU
  constraints specifically (vs. some other CI-runner-level
  contention) is not established — only that the symptom (a stuck
  SystemUI dialog) is now directly evidenced, and that resource
  constraints are the most plausible explanation given this audit
  chain's standing findings.
- The third flow's hierarchy-dump gap (§2) is unresolved.
- **Two next steps were offered and neither is authorized or
  performed by this document**: (a) push further on the
  resource-constraint angle (e.g., correlating disk/memory signals
  already captured, or considering increased emulator RAM/cores as a
  narrow CI-only lever), or (b) treat this document as sufficient for
  now and move to a different priority. Either — and any `ci.yml`
  change specifically — requires its own separate, explicit
  authorization, per this audit chain's standing discipline for every
  prior workflow-file change.

## 6. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  document.

---

## Status

**PHASE 8A-25 FINDING A ROOT-CAUSE CORRECTION: COMPLETE.**

| Layer | Status |
|---|---|
| Proposed build-config (dev-mode/Metro) theory | ❌ Ruled out — `debuggableVariants = []` correctly implemented, build step succeeds every run |
| SystemUI ANR ("System UI isn't responding") | ✅ Confirmed — identical bounds across 2 of 3 flow snapshots |
| Third flow's snapshot | 🔲 Not captured in this log — open gap, not a contradiction |
| Revised working theory | 🟠 Emulator/runner resource constraint causing a SystemUI-level hang — best-supported, not fully proven |
| Any code/workflow change | ❌ None made — none warranted by current evidence |
| Finding A | 🔴 Still open — root-cause theory materially revised |
| Finding B | 🔴 Still open — untouched, separate |
| Option A | ✅ Closed/verified — unaffected |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for either forward path
in §5, or any other action the owner chooses.
