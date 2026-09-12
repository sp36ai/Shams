# Phase 8A-32 — Clock-Offset Block Fix (PR #110, Supersedes Broken PR #109)

Implements: "Fix the clock-offset block and open a new PR." Corrects
the self-inflicted defect `PHASE_8A_31_CI_VERIFICATION_RUN438.md`
identified in the Phase 8A-30 clock-offset capture, which aborted run
`#438` before Maestro ever ran. **A prior attempt at this same fix
(PR #109) was independently verified broken — it corrupted
`.github/workflows/ci.yml` into invalid YAML. This document's fix is a
new, from-scratch edit against the same base commit, not a correction
built on top of PR #109's branch.**

## 1. What was done

- Checked out `claude/shams-phase-0-baseline-lnlmy6` fresh at
  `441fad9` (confirmed via `git rev-parse HEAD` before branching).
- Created `claude/ci-fix-8a30-clock-offset-v2` from that exact commit.
- Replaced the broken multi-line brace block with two independent,
  self-contained lines:

```diff
-            {
-              echo "host (date -u):  $(date -u +%FT%T.%3NZ)"
-              echo "guest (adb shell date -u): $(adb shell date -u 2>&1)"
-            } > "$HOME/clock-offset.txt"
+            echo "host (date -u):  $(date -u +%FT%T.%3NZ)" > "$HOME/clock-offset.txt"
+            echo "guest (adb shell date -u): $(adb shell date -u 2>&1)" >> "$HOME/clock-offset.txt"
```

  First line truncates (`>`), second appends (`>>`) — both fully
  self-contained, consistent with every other physical line in this
  `script:` block, and safe under
  `reactivecircus/android-emulator-runner`'s one-`sh -c`-invocation-
  per-line execution model (the exact property the original brace
  block violated).
- Committed, pushed, and opened **PR #110**
  (`https://github.com/sp36ai/Shams/pull/110`), head
  `claude/ci-fix-8a30-clock-offset-v2` → base
  `claude/shams-phase-0-baseline-lnlmy6`.

## 2. Verification performed — the standard adopted after PR #109's failure

Following the standard agreed after PR #109 (raw bytes → exact diff →
YAML parse → surrounding-content check → only then a disposition),
performed **twice** — once locally before pushing, once again against
the pushed PR itself via the GitHub API and a fresh `git fetch`:

```
$ cat -A (the two new lines)
            echo "host (date -u):  $(date -u +%FT%T.%3NZ)" > "$HOME/clock-offset.txt"$
            echo "guest (adb shell date -u): $(adb shell date -u 2>&1)" >> "$HOME/clock-offset.txt"$
```
Correct 12-space indentation, matching every sibling line — no
leftover fragments, no stray characters.

```
$ git diff --stat
 .github/workflows/ci.yml | 6 ++----
 1 file changed, 2 insertions(+), 4 deletions(-)

$ git diff --stat -- .maestro/ android/
(no output — both untouched)
```

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
```

Repeated against the actual pushed branch after opening the PR:

```
$ git fetch origin claude/ci-fix-8a30-clock-offset-v2
$ git show origin/claude/ci-fix-8a30-clock-offset-v2:.github/workflows/ci.yml > pr110_final.yml
$ python3 -c "import yaml; yaml.safe_load(open('pr110_final.yml')); print('YAML valid')"
YAML valid
$ diff pr110_final.yml .github/workflows/ci.yml
(no output — identical)
```

Also independently fetched via `get_file_contents` against
`refs/heads/claude/ci-fix-8a30-clock-offset-v2` (the GitHub API path,
distinct from the local `git fetch`/`git show` path) — content
byte-identical to both of the above.

`pull_request_read` (`get`) confirms `mergeable_state: "clean"`,
`additions: 2`, `deletions: 4`, `changed_files: 1` — matching exactly.

## 3. Why PR #109 is not reused or built upon

PR #109 (head `1a7cec3`) was independently confirmed, twice, via two
separate retrieval paths (GitHub API file fetch and a direct `git
fetch`/`git show` against the real remote), to contain corrupted
lines that fail YAML parsing outright
(`yaml.scanner.ScannerError: mapping values are not allowed here,
line 321, column 112`). Rather than attempt to patch that already-
corrupted branch, this fix starts fresh from the same clean base
commit (`441fad9`) PR #109 also started from, avoiding any risk of
carrying forward whatever produced the corruption. **PR #109 remains
open and unmerged; it should not be merged.** This document does not
touch it.

## 4. Scope — what this fix does and does not affect

**Does:**
- Fix the exact defect that made run `#438` void as diagnostic
  evidence (§`PHASE_8A_31`) — a shell-syntax error that aborted the
  script before `maestro test` ever ran.

**Does not:**
- Touch emulator RAM/CPU/AVD configuration.
- Touch the `.maestro/` flows or `android/` application code (verified
  via `git diff --stat`, both above and via the PR's own diff).
- Touch Finding A (SystemUI ANR — runs `#435`/`#437`; ADB/device-
  transport loss — run `#434`; the unclassified `#436` assertion
  failure) — all remain separate, open, and unaffected.
- Touch Finding B (artifact storage quota) — remains separate, open,
  unaffected.
- Merge anything, or trigger a CI rerun. PR #110 is opened and
  verified clean; it is **not merged** by this document.

## 5. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: unchanged by this document
  — the fix lives on `claude/ci-fix-8a30-clock-offset-v2`, proposed
  via PR #110 against this branch as base. This audit document itself
  is committed directly to `claude/shams-phase-0-baseline-lnlmy6`.
- PR #109 (`claude/ci-fix-8a30-clock-offset-syntax`): untouched, left
  open and unmerged, confirmed broken.
- PR #110 (`claude/ci-fix-8a30-clock-offset-v2`): open, unmerged,
  verified clean.

---

## Status

**PHASE 8A-32 CLOCK-OFFSET FIX (PR #110): COMPLETE — AWAITING MERGE AUTHORIZATION.**

| Layer | Status |
|---|---|
| Fix applied | ✅ Two independent, self-contained lines replacing the broken brace block |
| Raw bytes | ✅ Verified — correct indentation, no leftover fragments |
| Exact diff | ✅ Verified — 2 insertions / 4 deletions, confined to this block |
| YAML parse | ✅ Verified valid — twice, via two independent retrieval paths |
| Surrounding content (`.maestro/`, `android/`) | ✅ Verified untouched |
| PR #110 | ✅ Opened, `mergeable_state: clean` |
| PR #109 | ❌ Left as-is — broken, unmerged, not reused |
| Finding A | 🔲 Untouched, still open |
| Finding B | 🔲 Untouched, still open |
| Merge | 🔲 Not performed — requires separate, explicit authorization |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization to merge PR #110, or any
other action the owner chooses.
