# Phase 8A-10 — CI Artifact-Policy Change

Implements: *"I authorize the CI artifact-policy change against
baseline bb1a7bc: restructure ci.yml so app-debug-apk is not uploaded
on ordinary CI runs, provide a manual/debug upload path, preserve
Maestro results and the 30-day Play Store AAB policy, and make no
unrelated changes."*

## 1. Exact change

Two edits to `.github/workflows/ci.yml`, nothing else:

**1. A `workflow_dispatch` input added** (the trigger already existed,
with no inputs):

```yaml
  workflow_dispatch:
    inputs:
      upload_debug_apk:
        description: >-
          Upload the debug APK as a run artifact (for manual device
          sideloading). Off by default...
        type: boolean
        default: false
```

**2. The "Upload debug APK" step's condition narrowed**, from
unconditional to manual-opt-in-only:

```diff
-        if: always()
+        if: always() && github.event_name == 'workflow_dispatch' && inputs.upload_debug_apk == true
```

Its `retention-days: 7` (from `a699ff4`) is left in place as
belt-and-braces, so even a manually-requested upload can't silently
revert to the account's unbounded default.

## 2. What did not change — verified, not assumed

```
$ git diff --stat
 .github/workflows/ci.yml | 37 ++++++++++++++++++++++++++++---------
 1 file changed, 28 insertions(+), 9 deletions(-)
```

**One file.** Confirmed directly:

- **"Upload Maestro results"** (line 219) — condition (`if: always()`),
  path, and `retention-days: 7` (from `a699ff4`) are byte-for-byte
  unchanged. Maestro results still upload on every run, exactly as the
  authorization required ("preserve Maestro results").
- **`release-play-store.yml`'s `shams-aab-*` upload** —
  `retention-days: 30`, unchanged; that file has no diff at all.
- **"Build debug APK" and "Setup Android emulator"** — both unchanged.
  The APK is still built and installed on the emulator for every
  ordinary run; Maestro still needs it locally on the runner to
  install and test against. **Only whether the built APK is
  additionally retained as a downloadable run artifact afterward has
  changed** — the build/test path itself is untouched.
- No application code, dependency, Firebase rule, or other workflow
  file touched.

## 3. Why this design, not a separate workflow file

The authorization allowed either "restructure `ci.yml`... provide a
manual/debug upload path" — read as permitting either an in-file
conditional or a separate file. Chose the minimal in-file conditional
(a `workflow_dispatch` input gating the existing step) over splitting
into a second workflow file, because:

- It reuses the E2E job's own build/emulator/Maestro setup exactly —
  a separate workflow would either duplicate all of that setup or
  need to depend on this one, adding real complexity for no benefit
  the authorization asked for.
- `workflow_dispatch` already existed on `ci.yml` with no inputs, so
  adding one input is the smallest change that satisfies "provide a
  manual/debug upload path" — a maintainer runs this exact same
  workflow manually (Actions UI "Run workflow", or `gh workflow run
  ci.yml -f upload_debug_apk=true`) and gets the same build, same
  tests, plus the APK artifact, with one extra click/flag.
- Matches "make no unrelated changes" most literally — no new file,
  no duplicated job definitions.

## 4. Validation performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
YAML parses OK
```

Confirmed the parsed `workflow_dispatch.inputs.upload_debug_apk` block
matches exactly what was authored (`type: boolean`, `default: false`).
No GitHub Actions run was triggered by this validation — it is a local
YAML parse only, not a dispatch.

## 5. What this change does and does not do

- **Does**: stop `app-debug-apk` from being uploaded — and therefore
  from consuming any storage at all — on the hundreds of ordinary
  push/PR-triggered CI runs going forward, on whichever branch carries
  this fix. Preserves a manual path to get the APK when actually
  needed for device sideloading.
- **Does not**: free any of the artifact storage already consumed by
  prior runs (unchanged from `PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md`'s
  own finding — still requires the owner's own action outside this
  session). Does not, by itself, unblock the next CI run on `main`,
  since `main` doesn't have this fix yet (see §6). Does not authorize
  a CI rerun, artifact deletion, or promotion to `main` — none of
  those were part of this specific authorization.

## 6. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this change is written against: `bb1a7bc` (the
  artifact sizing forensics).
- **This change is committed to the feature branch, not `main`** —
  same caveat `PHASE_8A_10_RETENTION_DAYS_CONFIG.md` §5 already
  recorded for the `retention-days` fix: `main`'s own `ci.yml` still
  uploads `app-debug-apk` unconditionally until this fix is
  separately promoted.
- Working tree: clean before and after this change and document.

---

## Status

**CI ARTIFACT-POLICY CHANGE: COMPLETE (on the hardened branch only).**

| Layer | Status |
|---|---|
| `app-debug-apk` no longer uploads on ordinary runs | ✅ Complete |
| Manual/debug upload path (`workflow_dispatch` input) | ✅ Complete |
| Maestro results upload | ❌ Unchanged, as required |
| Play Store AAB / 30-day retention | ❌ Unchanged, as required |
| Unrelated files | ❌ Untouched |
| Storage already consumed | 🔴 Still unresolved — outside this session's reach |
| This fix present on `main` | 🔲 Not yet — feature-branch only |
| CI rerun | 🔲 Not authorized or attempted |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting the owner's own action to clear the existing quota, and,
separately, a decision on when/whether to promote this fix (and the
earlier `retention-days` fix) to `main`.
