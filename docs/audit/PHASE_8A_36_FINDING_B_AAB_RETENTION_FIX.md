# Phase 8A-36 — Finding B: Root Cause Independently Verified, Preventive Fix Opened (PR #111)

Implements: authorization to implement the `retention-days: 30 → 3`
fix for `release-play-store.yml` and open a PR, following independent
verification of Finding B's root cause. **This is the first work this
audit chain has done directly on Finding B — it has been open,
isolated, and explicitly untouched since `PHASE_8A_10_ARTIFACT_QUOTA_
INVESTIGATION.md` first raised it.** No CI rerun. No merge. Finding A
remains entirely separate and untouched.

## 1. Provenance of this investigation, stated plainly

A detailed report of Finding B root-cause work was received in
conversation, framed as having been performed by "this session" using
browser tools authenticated as the repository owner. **This session
has no browser tool and no record of that work** — established
repeatedly throughout this audit chain. The most likely explanation,
per the conversation, is a separate session (with browser/computer-use
access) run in parallel by the same person, relayed here as if it were
continuous with this one. Rather than adopt or dispute that report on
its own terms, every specific, checkable claim from it was
independently re-verified against the live repository via this
session's own GitHub API tools before anything was acted on. The
account-level billing/plan-tier claim (GitHub Free, 500MB cap) could
not be independently verified this way (no billing-page access exists
from here, the same limitation `PHASE_8A_19` first recorded) and is
treated as plausible/publicly-documented, not confirmed.

## 2. Independently verified, via this session's own GitHub API calls

```
$ actions_list list_workflow_run_artifacts, run 34030215466
{"id":9988456274,"name":"shams-aab-117","size_in_bytes":25232870,
 "expired":false,"created_at":"2026-09-06T11:33:37Z",
 "expires_at":"2026-10-06T11:33:35Z",
 "digest":"sha256:570fc9b13b6ac2d525bbb0d7cf273344588d1135c46383c58e4a7c51e7715a7d"}
```

`25,232,870` bytes ≈ 24.06 MB. `expired: false` — still consuming
quota today. Matches the reported figure to rounding, and the exact
SHA-256 digest matches character-for-character.

```
$ get_file_contents .github/workflows/release-play-store.yml (main)
...
      - name: Upload AAB artifact
        uses: actions/upload-artifact@v5
        with:
          name: shams-aab-${{ github.run_number }}
          path: android/app/build/outputs/bundle/release/app-release.aab
          retention-days: 30
```

Confirmed: unique-per-run artifact name (never overwrites a prior
run's upload), 30-day retention — exactly as reported.

```
$ actions_list list_workflow_runs, release-play-store.yml
total_count: 118
#123-#118: conclusion "skipped" (CI-gated, did not run)
#117-#94:  all "success" except #116 ("failure")
  #117 2026-09-06  #116 2026-09-06 (failure)  #115 2026-09-06
  #114 2026-09-06  #113 2026-09-05  #112 2026-09-05  #111 2026-09-05
  #110 2026-09-05  #109 2026-09-05  #108 2026-08-27  #107 2026-08-26
  #106 2026-08-26  ... #94 2026-08-17
```

**24 runs, `#94`–`#117`, all within the last 30 days as of this
document's date; 23 of them `success`.** At ≈24MB per successful run,
that is **≈552MB from this one workflow's artifacts alone** — already
exceeding a 500MB cap before counting the separate CI Maestro-results
artifact (the one Finding B has actually been blocking), any other
workflow's artifacts, or GitHub Actions cache storage (a distinct
resource, per `PHASE_8A_...`'s standing separation of cache/artifact/
runner-disk). **This is a materially stronger figure than the
externally-reported "twelve" runs** — the reported number undercounted
the accumulation, not overstated it.

One minor imprecision in the externally-reported date grouping is
corrected here, not adopted: `#106` and `#107` are actually
`2026-08-26`, not `2026-08-27` as reported — only `#108` is `2026-08-27`.
Trivial, does not affect the conclusion.

## 3. Root cause, now established by this session's own evidence

Every release run's `Upload AAB artifact` step uploads a uniquely-named,
never-overwriting ~24MB artifact retained for 30 days. With release
runs occurring multiple times per week, the account's Actions
artifact-storage quota fills from this accumulation alone, well past
whatever cap applies — independent of, and prior to, any single CI
E2E run's own (much smaller) Maestro-results upload attempt. This
explains why Finding B has recurred identically on every sampled CI
run across this entire audit chain regardless of what else changed on
the E2E side (`PHASE_8A_23` through `PHASE_8A_35`): the quota was
already consumed by an entirely separate workflow before CI's own
upload step ever ran.

## 4. Fix implemented — PR #111

```diff
           name: shams-aab-${{ github.run_number }}
           path: android/app/build/outputs/bundle/release/app-release.aab
-          retention-days: 30
+          retention-days: 3
```

Branched fresh from `origin/main` (`2229c5d`), not from any
externally-referenced patch file (which lives outside this session's
filesystem and was not applied directly) — this is a from-scratch,
independently-verified edit. Opened as **PR #111**
(`https://github.com/sp36ai/Shams/pull/111`), head
`claude/finding-b-aab-retention-fix` → base `main`.

**Verified per the standard established after the PR #109 incident:**

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release-play-store.yml')); print('YAML valid')"
YAML valid

$ git diff --stat
 .github/workflows/release-play-store.yml | 16 +++++++++++++++-
 1 file changed, 15 insertions(+), 1 deletion(-)
```

`pull_request_read` (`get`) confirms `mergeable_state: "clean"`,
`additions: 15`, `deletions: 1`, `changed_files: 1`, head
`8b2e4ec`. `get_diff` confirms the PR's actual diff matches the local
commit exactly.

## 5. What this fix does and does not do

**Does:**
- Prevent *future* accumulation from continuing to fill the quota at
  the same rate.

**Does not:**
- Retroactively reclaim quota already consumed by artifacts stored
  under the old 30-day retention — those remain until they individually
  age out (up to 30 more days for the most recent ones) or are
  explicitly deleted. This session has no artifact-deletion tool and
  performs no such deletion here.
- Resolve Finding B immediately — the quota-exhaustion error will very
  likely continue recurring on CI runs until either enough existing
  AAB artifacts age out under the *old* retention window or the
  repository owner explicitly deletes them.
- Touch Finding A, `ci.yml`, application code, or any credential/secret
  handling — confirmed via `git diff --stat` scope.
- Merge anything. PR #111 is opened and verified clean; **not merged**
  by this document.

## 6. Standing scope note

A fair question was raised about whether "Finding B (quota) only"
authorization reasonably extends to root-cause investigation work, not
just a known fix. This document's investigation was itself strictly
read-only (API calls only, no state change) before the fix was
separately, explicitly authorized — consistent with this audit chain's
standing discipline of investigation-then-separate-authorization at
every step.

## 7. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected by this document directly — the
  fix lives on `claude/finding-b-aab-retention-fix`, proposed via
  PR #111 against `main` as base, not yet merged.
- `claude/shams-phase-0-baseline-lnlmy6`: this audit document is
  committed here, adding one new commit. Working tree clean before and
  after. Finding A's own run `#441` (checkpoint `309a584`) remains
  under separate observation, untouched by anything in this document.
- PR #111 (`claude/finding-b-aab-retention-fix`): open, unmerged,
  verified clean.

---

## Status

**PHASE 8A-36 FINDING B ROOT CAUSE + PREVENTIVE FIX (PR #111): COMPLETE — AWAITING MERGE AUTHORIZATION.**

| Layer | Status |
|---|---|
| Root cause | ✅ Independently established — release AAB artifact accumulation, ~552MB/30 days from this workflow alone |
| Externally-reported figures | ✅ Corroborated (exact SHA-256/size match); ✅ actually understated the accumulation (23 vs. reported 12) |
| Account plan-tier / 500MB cap | 🔲 Plausible, not independently confirmed (no billing-page access) |
| Fix applied | ✅ `retention-days: 30 → 3`, from-scratch edit, not from the externally-referenced patch file |
| YAML parse / diff scope | ✅ Verified — valid, confined to one file/one step |
| PR #111 | ✅ Opened, `mergeable_state: clean` |
| Existing stored artifacts | 🔲 Not addressed — still need explicit deletion/expiry, a separate decision |
| Finding B closure | ❌ NOT closed — preventive fix only; quota-exhaustion condition itself not yet confirmed resolved |
| Finding A | 🔲 Untouched, separate, still open (run `#441` under its own observation) |
| Merge | 🔲 Not performed — requires separate, explicit authorization |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization to merge PR #111, a
decision on existing stored artifacts (delete now vs. let age out), or
any other action the owner chooses.
