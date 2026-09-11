# Phase 8A-16 — CI Verification: Run `#432` (Option A Fix Test)

Implements: "CI Rerun Authorization — checkpoint 3d73998." Verifies
whether the Phase 8A-15 Option A remediation (split
`actions/cache/restore@v4` + explicit `actions/cache/save@v4`) actually
achieves what `save-always` could not. **Read-only — no retry,
dispatch, merge to `main`, or config change is performed by this
document. No fix for Finding A or Finding B is in scope, per the
authorization's own narrow framing.** No production-readiness verdict
is rendered here.

## 1. Run identification

- Run `#432`, id `34567267926`, event `workflow_dispatch`.
- `head_branch`: `claude/shams-phase-0-baseline-lnlmy6`. `head_sha`:
  `3d73998` — confirmed exact match to the authorized checkpoint
  before triggering.
- Final `status`: `completed`. Final `conclusion`: `failure` (expected
  — Findings A and B were not remediated under this authorization).

## 2. The acceptance criterion for this authorization: MET

**`Save Gradle cache` actually executed and saved — the first time
this has happened on any failing run sampled in this audit chain.**

```
Save Gradle cache: started 06:08:43Z, completed 06:09:38Z (~55s), conclusion: success
```

Direct, verbatim confirmation from the job log:

```
2026-09-11T06:09:38.0035888Z Cache saved with key: gradle-22c50f7ea7f3818d3d09372bb16d965f3648dd8bb0605ba1d1d88f6a3c8eacd2
```

This ran **after** every one of the following had already failed in
the same job: `Setup Android emulator` (`failure`), `Upload Maestro
results` (`failure`), `Publish test report` (`failure`). Under the
old combined `actions/cache@v4` step (runs `#429`, `#431`), a failure
anywhere in this sequence meant `Post Cache Gradle` showed `skipped`
every time — this run is the first direct, positive proof that the
Phase 8A-15 fix breaks that pattern, exactly as
`PHASE_8A_14_FINDINGS_INVESTIGATION.md` §C1–C2 predicted from reading
`actions/cache`'s own source: the new save step's `if: always()` is a
plain step-level condition, entirely independent of the combined
action's `post-if: success()`.

**Not retrievable this run**: `Restore Gradle cache`'s own `cache-hit`
output / log line fell outside the tail-truncated log window this
session's log-fetch tool returns (same boundary documented in
`PHASE_8A_13_CI_VERIFICATION_RUN431.md` §2 and
`PHASE_8A_14_FINDINGS_INVESTIGATION.md`). Given the save step did run
(implying `cache-hit != 'true'`, i.e. a miss or partial match — an
exact hit would have skipped it per the save step's own condition),
this is consistent with, though not a direct log-line confirmation of,
another miss. **Not Verified**: the exact restore-step log line.

## 3. Finding A — recurred, identical pattern

```
2026-09-11T06:07:21.4968378Z [Failed] Journey — sign up through onboarding to the Oracle (41s) (Assertion is false: id: auth-tab-signup is visible)
2026-09-11T06:07:53.0918463Z [Failed] Auth — Sign In flow (32s) (Assertion is false: id: auth-tab-signin is visible)
2026-09-11T06:08:21.8277315Z [Failed] Settings — plan display and sign out (29s) (Assertion is false: id: settings-gear-btn is visible)
2026-09-11T06:08:21.8398757Z 3/3 Flows Failed
```

**Identical to run `#431`** — same three flows, same three assertions,
same failure mode (element not visible), similar per-flow timing
(29–41s vs. 32–34s previously). The emulator again booted successfully
(`Boot completed in 72147 ms`, comparable to `#431`'s 77073 ms) —
Options A/B's disk-exhaustion fix continues to hold. This recurrence
was expected and is not treated as a new finding — Finding A remains
exactly as open as it was, not worse, not better. The consistency
between the two runs (down to per-assertion wording) is itself
additional evidence for `PHASE_8A_14`'s ranked hypothesis 1 (a
timing/environmental issue reproducible run-to-run) over a one-off
fluke, though still not confirmed.

## 4. Finding B — recurred, identical error text

```
2026-09-11T06:08:42.9847123Z ##[error]Failed to CreateArtifact: Artifact storage quota has been hit. Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

Byte-for-byte the same error as run `#431`. Gap since `#431`'s failure
(~03:19 UTC) to this run's failure (~06:08 UTC) is **under 3 hours** —
shorter than the previous 9-hour gap and well inside the quota
message's own "6-12 hours" recalculation window, so this is consistent
with (not additional new evidence against) the recalculation-lag
hypothesis from `PHASE_8A_14_FINDINGS_INVESTIGATION.md` §B3 — expected
to still be within that lag window. Not investigated further, per
this authorization's explicit scope.

## 5. Disk-instrumentation evidence

```
06:08:42Z (after Android SDK/emulator setup): /dev/root 72G 63G 8.8G Avail 88% Use%
```

Identical to run `#431`'s after-figure (also 8.8G / 88%) — the
disk-exhaustion fix's effect is stable and repeatable across two
independent runs, not a one-off. The "before" bracket's exact figure
fell in the same untrieved log window as §2's gap; not re-quoted here
since run `#431` already established the pattern and this run's
"after" figure alone confirms consistency.

## 6. Overall CI conclusion

**FAILURE** — `Functions Quality` ✅ and `App Quality` ✅ both passed;
`E2E Tests (Maestro)` ❌ failed, for the same two already-diagnosed,
not-yet-remediated reasons as run `#431` (Findings A and B). No new
failure mode appeared.

## 7. Deploy-gate applicability

Structurally not applicable, same as every prior feature-branch run —
`c337180`'s and `3d73998`'s runs both live on
`claude/shams-phase-0-baseline-lnlmy6`, and all three deploy workflows
filter `branches: [main]`. Not re-verified empirically this round
(already established twice); no reason to expect it changed.

## 8. What this run does and does not establish

**Does:**
- Confirm, with a direct log line, that the Phase 8A-15 Option A fix
  works exactly as the investigation predicted — the save now executes
  regardless of downstream job failure.
- Confirm the disk-exhaustion fix (Options A/B from Phase 8A-12)
  continues to hold on a second independent run (same ~8.8G headroom,
  successful emulator boot).
- Confirm Findings A and B are stable, reproducible patterns — not
  flukes specific to run `#431` — which is useful evidence for
  whoever investigates them next.

**Does not:**
- Fix or further diagnose Finding A or Finding B — explicitly out of
  scope for this authorization.
- Constitute a CI pass. `E2E Tests (Maestro)` failed.
- Change the production-readiness verdict, which remains unchanged.

## 9. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No `ci.yml`, application, test, or deployment-configuration file is
  touched by this document.

---

## Status

**PHASE 8A-16 CI VERIFICATION (run `#432`): COMPLETE.**

| Layer | Status |
|---|---|
| Option A fix — acceptance criterion | ✅ **MET** — `Save Gradle cache` executed and saved (`Cache saved with key: ...`) despite job failure |
| Disk-exhaustion fix (Options A/B, Phase 8A-12) | ✅ Holding on a second independent run — 8.8G headroom, emulator booted |
| Finding A (Maestro assertion failures) | ❌ Recurred — identical pattern to `#431`, not remediated (out of scope) |
| Finding B (artifact quota) | ❌ Recurred — identical error text, not remediated (out of scope) |
| CI conclusion | ❌ FAILURE |
| Deploy gate | N/A — structurally, feature branch |
| Production readiness | ❌ NOT READY — unchanged |

Option A is now verified effective. Findings A and B remain open,
each still awaiting its own separate remediation authorization.
