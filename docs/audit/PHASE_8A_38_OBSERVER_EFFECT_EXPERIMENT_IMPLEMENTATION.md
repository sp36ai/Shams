# Phase 8A-38 — Observer-Effect Control Experiment: Implementation

Implements the control experiment `PHASE_8A_35` §4 raised as a
hypothesis but did not test: whether this audit chain's own guest-side
`adb shell dumpsys cpuinfo` polling (Phase 8A-30) is a contributing or
triggering factor in the SystemUI ANR (A1), given the ANR's logged
`Reason` names SystemUI's own diagnostic dump service
(`SystemUIAuxiliaryDumpService`). **Adds a `workflow_dispatch` input
only — no change to the sampler's own behavior when the input is left
at its default (`false`), no AVD/emulator config change, no flow
change, no application code change.**

## 1. What was added

A new `workflow_dispatch` input, `disable_observer` (boolean, default
`false`), and a single-line gate on the guest-cpuinfo sampler:

```diff
+      disable_observer:
+        description: >-
+          Observer-effect control experiment (Finding A, A1): skip
+          starting the guest-side `adb shell dumpsys cpuinfo` sampler
+          ...
+        type: boolean
+        default: false
```

```diff
-            nohup bash -c 'while true; do date -u +%FT%TZ; adb shell dumpsys cpuinfo 2>&1; echo; sleep 3; done' > "$HOME/guest-cpuinfo.txt" 2>&1 &
+            [ "${{ inputs.disable_observer }}" = "true" ] || nohup bash -c 'while true; do date -u +%FT%TZ; adb shell dumpsys cpuinfo 2>&1; echo; sleep 3; done' > "$HOME/guest-cpuinfo.txt" 2>&1 &
```

Plus a log-visible marker of which mode each run used, appended to
the existing clock-offset capture line:

```bash
echo "PHASE 8A-38 observer-effect experiment mode: disable_observer=${{ inputs.disable_observer }} (guest-cpuinfo sampler $( [ "${{ inputs.disable_observer }}" = "true" ] && echo DISABLED -- control run || echo enabled -- normal/treatment run ))"
```

## 2. Why this design

- **Gates only the guest-side `dumpsys cpuinfo` sampler** — the
  specific mechanism `PHASE_8A_35`'s hypothesis names, since it's the
  only one of this chain's diagnostics that repeatedly queries the
  guest OS via `adb shell dumpsys`. The host-side `resource-usage.txt`
  sampler (`free`/`ps`, no `adb shell` calls) and the one-time
  clock-offset capture are left unconditionally on — they don't touch
  the guest OS's dump-service machinery, so gating them would only
  make the two conditions differ in more ways than the hypothesis
  requires, weakening the comparison.
- **`logcat` capture and the FATAL/ANR searches stay unconditional in
  both modes** — both conditions need identical detection capability
  so the ANR (if it occurs) is equally visible whether or not the
  guest-cpuinfo sampler ran.
- **Single self-contained line, not a multi-line construct** —
  `PHASE_8A_31` documented exactly why a multi-line shell block breaks
  under `reactivecircus/android-emulator-runner`'s one-`sh -c`-
  invocation-per-line execution model (`#438`). `[ cond ] || nohup ...`
  is one physical line, using the same short-circuit pattern already
  proven safe elsewhere in this file.
- **Default `false` (sampler enabled)** preserves every existing run's
  behavior unchanged — this is purely additive for anyone not
  explicitly requesting the control mode.

## 3. Verification performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid

$ git diff --stat
 .github/workflows/ci.yml | 30 +++++++++++++++++++++++++++++-
 1 file changed, 29 insertions(+), 1 deletion(-)

$ git diff --stat -- .maestro/ android/
(no output — both untouched)

$ grep -n "disable_observer" .github/workflows/ci.yml | cat -A
(confirmed: every new/changed line is a single physical line, no
 leftover fragments, no multi-line brace constructs)
```

`inputs.disable_observer`'s safety on non-`workflow_dispatch` triggers
(push/pull_request) is inherited from the pre-existing
`inputs.upload_debug_apk` pattern already used elsewhere in this same
file — confirmed that pattern predates this change and is already
relied upon, so the same safe-empty-string behavior applies here.

## 4. What this document does and does not establish

**Does:**
- Implement the mechanism needed to run the control experiment
  `PHASE_8A_35` proposed.

**Does not:**
- Run the experiment itself — that is a separate CI trigger (two runs:
  one default/"treatment", one with `disable_observer: true`), covered
  in the next step.
- Prove or disprove the observer-effect hypothesis — no data yet.
- Change AVD/emulator resource allocation, Maestro flows, or
  application code.
- Address Finding B, A2, or `#436`.
- Change the production-readiness verdict, which remains unchanged.

## 5. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here.

---

## Status

**PHASE 8A-38 OBSERVER-EFFECT EXPERIMENT IMPLEMENTATION: COMPLETE.**

| Layer | Status |
|---|---|
| `disable_observer` input | ✅ Added, default `false` (no behavior change by default) |
| Sampler gate | ✅ Single-line-safe, YAML valid |
| Experiment mode marker | ✅ Logged per run |
| `.maestro/`, `android/` | ✅ Untouched |
| Experiment executed | 🔲 Not yet — next step |
| A1 hypothesis | 🔲 Still untested |
| Production readiness | ❌ NOT READY — unchanged |

Proceeding next to trigger the two comparison runs.
