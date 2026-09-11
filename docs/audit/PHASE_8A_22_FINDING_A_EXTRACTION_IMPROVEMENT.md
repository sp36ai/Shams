# Phase 8A-22 — Finding A Diagnostic Extraction Improvement

Implements: "Authorization: granted. Proceed with the narrowly scoped
`commands-*.json` diagnostic-extraction improvement from checkpoint
`e747468`." Closes the gap `PHASE_8A_21_CI_VERIFICATION_RUN433.md` §4
identified: Maestro's per-flow `commands-*.json` trace — the most
likely file to show the app's actual UI state when a failing
assertion gave up — was being silently excluded by the existing
`<50KB` inline filter. **No application behavior change, no Maestro
assertion change, no dependency/toolchain change, no Finding B
workaround, no cache change, no CI rerun, no merge/promotion/
deployment — all explicitly excluded by the authorization and none
performed here.**

## 1. What was changed

Confined to the `Show logcat and preserved Maestro debug artifacts`
step, the same step Phase 8A-20 added:

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 34 +++++++++++++++++++++++++++++++++-
 1 file changed, 33 insertions(+), 1 deletion(-)
```

Two parts:

### 1a. Exclude `commands-*.json` from the existing generic filter

```diff
-          find "$HOME/.maestro/tests" -type f \( -iname "*.xml" -o -iname "*.json" -o -iname "*.txt" \) -size -50k -print -exec cat {} \; 2>/dev/null || true
+          find "$HOME/.maestro/tests" -type f \( -iname "*.xml" -o -iname "*.json" -o -iname "*.txt" \) ! -iname "commands-*.json" -size -50k -print -exec cat {} \; 2>/dev/null || true
```

Prevents double-handling now that these files get their own dedicated
treatment below — every other file type (`.xml`, other `.json`,
`.txt`, all still `<50KB`) is unaffected.

### 1b. New dedicated segment-extraction group

```yaml
echo "::group::commands-*.json -- last entries per flow (diagnostic segment)"
shopt -s nullglob
for f in "$HOME"/.maestro/tests/*/commands-*.json; do
  echo "--- $f ($(wc -c < "$f") bytes) ---"
  if command -v jq >/dev/null 2>&1 && jq -e 'type == "array"' "$f" >/dev/null 2>&1; then
    jq '.[-10:]' "$f" 2>/dev/null || tail -c 20000 "$f"
  else
    tail -c 20000 "$f"
  fi
  echo
done
shopt -u nullglob
echo "::endgroup::"
```

Implements the authorization's **preferred approach** (a relevant
segment, not an indiscriminate full dump): the last 10 array elements
via `jq` (preinstalled on GitHub-hosted `ubuntu-latest` runners) when
the file parses as a JSON array — Maestro appends commands as it
executes them, so the tail of the array is the state nearest the
failing assertion — with a raw `tail -c 20000` byte-fallback if `jq`
is unavailable or the file's actual shape differs from what's
assumed. This is deliberately defensive: the exact schema of
`commands-*.json` was inferred from its name and Phase 8A-21's
observation that it's "Maestro's own command trace," not confirmed
against Maestro's own documentation or source — if the `jq` array
assumption is wrong, the fallback still produces something readable
rather than silently emitting nothing.

## 2. Explicit confirmation of exclusions

| Exclusion (from the authorization) | Status |
|---|---|
| No app-code changes | ✅ Zero files outside `.github/workflows/ci.yml` touched |
| No Maestro assertion changes | ✅ No `.maestro/ci/*.yaml` file touched |
| No dependency/toolchain changes | ✅ Nothing installed, pinned, or version-changed |
| No Finding B workaround | ✅ Unrelated to the artifact-upload path entirely — this is log-output only, same delivery mechanism established in Phase 8A-20 |
| No cache changes | ✅ `Restore Gradle cache` / `Save Gradle cache` steps untouched |
| Preserve all Phase 8A-20 instrumentation | ✅ All four other diagnostic pieces (toolchain versions, logcat FATAL grep, logcat tail, artifact listing) byte-identical; the one existing line touched (§1a) only narrows what it excludes, no capability removed — the excluded file type is picked up by the new dedicated group instead |
| No CI rerun | ✅ Not triggered by this document |
| No merge, promotion, or deployment | ✅ Not performed |

## 3. Verification performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
$ git diff .github/workflows/ci.yml | grep "^-[^-]"
-          find "$HOME/.maestro/tests" -type f \( -iname "*.xml" -o -iname "*.json" -o -iname "*.txt" \) -size -50k -print -exec cat {} \; 2>/dev/null || true
```

Exactly one real line changed (the exclusion filter in §1a); everything
else is additive. Same class of boundary as every prior CI-config
change in this chain: the only real proof this extraction actually
surfaces useful content is an actual CI run — **not performed here**,
per this authorization's scope (no CI rerun without separate
authorization).

## 4. What this does and does not establish

**Does:**
- Implement exactly the improvement authorized, confined to
  `commands-*.json` extraction.
- Give the next CI run (once separately authorized) a realistic chance
  to surface the actual UI-state/command-trace evidence Phase 8A-21
  identified as missing.

**Does not:**
- Prove the extraction works as intended — `commands-*.json`'s exact
  structure was inferred, not confirmed against Maestro's own docs;
  the fallback path exists precisely because this is unverified.
- Establish anything new about Finding A's cause — no run has
  exercised this change yet.
- Address Finding B.
- Change the production-readiness verdict, which remains unchanged.

## 5. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — this commit is on the feature
  branch only, not yet promoted.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here. Working tree clean before and after.
- No merge to `main` and no CI rerun is performed or requested by this
  document.

---

## Status

**PHASE 8A-22 FINDING A EXTRACTION IMPROVEMENT: COMPLETE.**

| Layer | Status |
|---|---|
| `commands-*.json` segment extraction | ✅ Implemented (jq-preferred, tail-fallback) |
| Existing Phase 8A-20 instrumentation | ✅ Preserved — only one filter line narrowed, no capability removed |
| All explicit exclusions honored | ✅ Confirmed (§2) |
| YAML validity / diff scope | ✅ Verified — valid, minimally scoped, `e2e` job only |
| Actual extraction value | 🔲 Not yet observed — requires a separate CI Rerun Authorization |
| Finding A root cause | 🔲 Still not confirmed |
| Finding B | 🔲 Untouched, still open |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun to exercise this improved extraction, or any other action the
owner chooses.
