# Phase 8A-10 — CI Artifact Retention-Days Configuration Change

Narrowly scoped follow-up per "Retention-days config change
authorization — baseline c06dd72," implementing the option
`docs/audit/PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md` §6 identified
but did not apply. **This change addresses recurrence prevention
only** — it does not, and cannot, free the artifact storage already
consumed that is currently blocking CI (per that investigation's own
§3 finding). It does not resume the paused post-merge verification
chain, does not rerun CI, and does not constitute the "quota
legitimately resolved" precondition the owner's Phase 8A-10 CI
Artifact-Quota Investigation Authorization required before any rerun.

## 1. Exact change

```diff
       - name: Upload debug APK
         if: always()
         uses: actions/upload-artifact@v4
         with:
           name: app-debug-apk
           path: android/app/build/outputs/apk/debug/app-debug.apk
           if-no-files-found: warn
+          retention-days: 7

       ...

       - name: Upload Maestro results
         if: always()
         uses: actions/upload-artifact@v4
         with:
           name: maestro-results
           path: |
             maestro-results.xml
             ~/.maestro/tests/
+          retention-days: 7
```

One file, `.github/workflows/ci.yml`, 14 insertions (the two
`retention-days: 7` lines plus explanatory comments), zero deletions,
zero lines changed elsewhere. Both artifact uploads themselves —
what is uploaded, from where, under what name — are byte-for-byte
unchanged; only their retention window is now bounded explicitly
instead of falling through to the account default (commonly 90 days,
per the investigation's own finding). Confirmed via `git diff --stat`
and a full read of the diff before committing.

## 2. Why 7 days

The investigation found ~33 MB debug APKs (plus a small Maestro-results
artifact) accumulating across 423 CI runs with no explicit retention
set. These are debug sideload builds and per-run E2E results — useful
for pulling down a recent run's APK for manual device testing or
inspecting a recent failure's Maestro output, not release artifacts
anyone needs months later. 7 days is ample for that purpose while
bounding how much any single run can contribute to standing storage
consumption, matching the investigation's own framing of this as a
future-prevention measure, not an immediate fix.

## 3. What this does not do — stated plainly, matching the investigation's own boundary

- **Does not free the artifact storage already consumed.** Existing
  artifacts from all 423 prior runs keep whatever retention they were
  uploaded under (the account default) until they individually expire
  on their own schedule, or until the owner deletes them directly —
  neither of which this change touches.
- **Does not unblock the next CI run on its own.** The quota is
  already exhausted; a shorter retention window only slows *future*
  re-accumulation once the account has headroom again.
- **Does not authorize, trigger, or imply a CI rerun.** The Phase
  8A-10 investigation's own precondition — "If the quota can be
  legitimately resolved, rerun the normal CI" — is unaffected by this
  change and remains unmet until the owner's own action (artifact
  deletion or a storage-plan increase) actually clears it.
- **Does not touch the E2E test logic, the Maestro flows, the APK
  build, application code, dependencies, Firebase rules, or Finding 3
  Options A/B.**

## 4. Validation performed

```
$ git diff --stat
 .github/workflows/ci.yml | 14 ++++++++++++++
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
YAML parses OK
```

No CI run was triggered by this commit review process itself; the
actual push (below) will trigger a real `CI` run exactly as any other
push to `main`... except this change lands on the feature branch, not
`main` — see §5.

## 5. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this change is written against: `c06dd72` (the
  artifact-quota investigation).
- **This change is committed to the feature branch, not `main`.**
  `main` (`origin/main`, still `61ddf4a`) is unaffected — this
  authorization scoped a configuration change, not a second merge.
  Whether/when this specific fix reaches `main` is a separate decision
  outside this document's scope; until then, `main`'s own `ci.yml`
  still has no `retention-days` set, and will keep re-accumulating
  artifacts at the same unbounded rate on every future push, even
  after the current quota exhaustion is manually cleared, unless this
  fix is separately promoted.
- Working tree: clean before and after this change and document.

---

## Status

**RETENTION-DAYS CONFIG CHANGE: COMPLETE (on the hardened branch only).**

| Layer | Status |
|---|---|
| `retention-days: 7` added to both artifact uploads | ✅ Complete |
| E2E artifact step itself | ❌ Unchanged — not weakened or bypassed |
| Storage already consumed | 🔴 Still exhausted — unaffected by this change |
| CI rerun | 🔲 Not authorized or attempted by this document |
| This fix present on `main` | 🔲 Not yet — feature-branch only |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting the owner's own action to actually clear the existing quota
exhaustion (artifact deletion or storage-plan increase), and,
separately, a decision on whether/when this `retention-days` fix
itself should be promoted to `main`.
