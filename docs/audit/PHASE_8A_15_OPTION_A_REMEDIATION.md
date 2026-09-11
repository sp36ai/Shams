# Phase 8A-15 — Option A Remediation: Split Gradle Cache Save

Implements: "I authorize remediation of Option A's cache-save behavior
only." Fixes the root cause confirmed in
`docs/audit/PHASE_8A_14_FINDINGS_INVESTIGATION.md` §C1–C2: the combined
`actions/cache@v4` action's save step is unconditionally gated on
`post-if: success()`, hardcoded in the action's own `action.yml` and
unaffected by `save-always`. **Scoped to Option A only** — Finding A
(Maestro assertion failures) and Finding B (recurring artifact quota)
are explicitly out of scope for this remediation, per the
authorization's own wording.

## 1. What was changed

Confined entirely to the `e2e` job in `.github/workflows/ci.yml`:

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 46 +++++++++++++++++++++++++++++++++++++---------
 1 file changed, 37 insertions(+), 9 deletions(-)
```

**Replaces** the combined `actions/cache@v4` step (with its now-proven-
ineffective `save-always: true`) with the two-part composite-action
pattern `PHASE_8A_14_FINDINGS_INVESTIGATION.md` §C2 identified as the
correct fix:

```diff
-      - name: Cache Gradle
-        uses: actions/cache@v4
+      - name: Restore Gradle cache
+        id: gradle-cache
+        uses: actions/cache/restore@v4
         with:
           path: |
             ~/.gradle/caches
             ~/.gradle/wrapper
           key: gradle-${{ hashFiles('android/**/*.gradle*', 'android/gradle.properties') }}
           restore-keys: gradle-
-          save-always: true
```

and adds an explicit save step near the end of the job — after
`Publish test report`, the last step in the job's normal sequence:

```yaml
      - name: Save Gradle cache
        if: always() && steps.gradle-cache.outputs.cache-hit != 'true'
        uses: actions/cache/save@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: gradle-${{ hashFiles('android/**/*.gradle*', 'android/gradle.properties') }}
```

### Why this is the correct fix, restated from the investigation

- `if: always()` **on the save step itself** is a plain GitHub Actions
  step-level condition, evaluated independently of the combined
  action's own internal `post-if: success()` — it is not subject to
  the mechanism that blocked the previous attempt at all. This is the
  actual point of the fix: the save no longer depends on the
  combined action's post-step machinery, or on the job's overall
  success state, in any way.
- `steps.gradle-cache.outputs.cache-hit != 'true'` reproduces the one
  behavior `save-always` genuinely governs (per `saveImpl.ts`, read
  directly in the investigation): don't attempt to save when the
  restore already found an exact match on the primary key — there is
  nothing new to write in that case. On a partial match (`restore-keys`
  prefix hit, not the exact key) `cache-hit` is `''`/falsy, so the
  condition is true and a new cache entry is correctly saved under
  today's exact key.
- Placed near the end of the job (after `Publish test report`) so it
  captures the fullest possible cache state from the run — but its
  actual execution is governed entirely by its own `if: always()`,
  not by its position in the step list.

## 2. Verification performed

### 2a. Syntax and scope

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
$ grep -n "Cache Gradle\|gradle-cache\|steps\." .github/workflows/ci.yml
177:        id: gradle-cache
324:        if: always() && steps.gradle-cache.outputs.cache-hit != 'true'
```

Valid YAML. The new step `id` (`gradle-cache`) is referenced in
exactly one place (the new save step's condition) — no dangling or
stale reference to the old combined step anywhere else in the file.
Confirmed via diff that no other job (`app-quality`,
`functions-quality`) is touched, and no other part of the `e2e` job
(disk instrumentation, Build debug APK, emulator/Maestro steps,
artifact uploads) is altered.

### 2b. What could and could not be verified from this environment

Same class of boundary as every prior CI-config remediation in this
audit chain: there is no local harness to execute a GitHub Actions
job. What was done instead:

- The fix's correctness rests on `actions/cache/restore@v4` and
  `actions/cache/save@v4` being the officially documented composite
  parts of the same action this workflow already uses (confirmed via
  the same upstream source read in `PHASE_8A_14_FINDINGS_INVESTIGATION.md`
  — these are not third-party or unfamiliar actions, they are the
  same `actions/cache` repository's own split entrypoints).
- The `cache-hit` output name and its exact/partial-match semantics
  are read directly from `actions/cache`'s documented behavior, not
  assumed.
- **The only real proof this works is an actual CI run** where the
  `E2E Tests (Maestro)` job fails downstream of the restore step (as
  it has on every sampled run to date) and `Save Gradle cache` is
  observed to actually execute and populate the cache. **Not performed
  by this document** — per standing practice, this requires its own
  separate, explicit CI Rerun Authorization.

## 3. What this remediation does and does not establish

**Does:**
- Implement the fix Phase 8A-14 identified, using the officially
  documented split-action pattern rather than the deprecated,
  confirmed-ineffective `save-always` input.
- Remain scoped exactly to Option A, per the authorization — no file
  or step related to Finding A (Maestro/UI) or Finding B (artifact
  quota) is touched.
- Stay purely additive/substitutive to the same single step this
  audit chain has been iterating on since Phase 8A-12 — no other part
  of the `e2e` job's build → emulator → Maestro acceptance chain is
  altered.

**Does not:**
- Prove the fix works in practice — that requires an actual CI run,
  not performed here.
- Address Finding A or Finding B — both remain open, each still
  awaiting its own separate remediation authorization.
- Change the production-readiness verdict, which remains unchanged.

## 4. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — this commit is on the feature
  branch only, not yet promoted.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here. Working tree clean before and after.
- No merge to `main` and no CI rerun is performed or requested by this
  document.

---

## Status

**PHASE 8A-15 OPTION A REMEDIATION: COMPLETE.**

| Layer | Status |
|---|---|
| Root cause addressed | ✅ Split into `restore`/`save`, save step's `if: always()` decoupled from `post-if: success()` |
| Scope discipline | ✅ Confined to Option A only — Findings A and B untouched |
| YAML validity / diff scope | ✅ Verified — valid, no dangling references, `e2e` job only |
| Actual effectiveness | 🔲 Not Verified — requires a separate CI Rerun Authorization |
| Finding A (Maestro/UI) | 🔲 Still open — separate authorization required |
| Finding B (artifact quota) | 🔲 Still open — separate authorization required |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun, remediation of Finding A or B, or any other next action the
owner chooses.
