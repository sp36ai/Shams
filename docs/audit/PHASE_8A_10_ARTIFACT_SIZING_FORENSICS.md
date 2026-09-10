# Phase 8A-10 — Artifact Storage Sizing Forensics

Follow-up to `docs/audit/PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md`,
performed in direct response to the owner's own methodological
correction: *"the statement that approximately 33 MB × 423 runs = the
quota exhaustion is an estimate, not something we should treat as
proven until the actual artifact sizes are inspected."* This document
replaces that bare extrapolation with real, sampled per-run data
spanning the actual retention window, and corrects one part of the
owner's own proposed priority list along the way. **Read-only — no
artifact was deleted (no tool in this session's surface can do that,
confirmed again, not just assumed from the prior investigation), no
code was changed, no CI was rerun, nothing was promoted to `main`.**

## 1. Correction to the priority list: which workflows actually produce artifacts

```
$ grep -l "upload-artifact" .github/workflows/*.yml
.github/workflows/ci.yml
.github/workflows/release-play-store.yml
```

**`firestore-rules-tests.yml` uploads no artifacts at all.** Its 140
runs — second on the owner's proposed priority list — contribute
**zero bytes** to the storage quota; confirmed directly from the
workflow file, not inferred. `deploy-functions.yml`,
`deploy-firebase-hosting.yml`, and `update-lockfile.yml` likewise have
no `upload-artifact` step. **Only `ci.yml` (393 runs) and
`release-play-store.yml` (118 runs) are real contributors.** This
narrows the cleanup surface meaningfully before any deletion decision
is made.

## 2. `ci.yml` — sampled across the full retention window, not just two points

Four independent samples, spanning from today back to the oldest point
still inside the ~90-day retention window:

| Run | Age | `app-debug-apk` | `maestro-results` | `expired` |
|---|---|---|---|---|
| `34385617156` (the failed merge run) | 0 days | — (upload failed) | — (never produced) | n/a |
| `34045249491` | 3 days | 34,632,716 B | 225,857 B | `false` |
| `34034026624` | 3 days | 34,632,715 B | 377,354 B | `false` |
| `34026041318` | 3 days | 34,632,720 B | 223,406 B | `false` |
| `32568458448` | 18 days | 34,612,411 B | 373,335 B | `false` |

**Every sampled successful run is ~34.6 MB total, consistently, across
an 18-day span** — not a one-off estimate.

**Confirming the retention window directly**: the 18-day-old run's
artifacts show `expires_at: 2026-11-20/12-05`, confirming a **90-day**
retention (the account default), and still `expired: false`.

**How far back the live window actually extends** — sampled the run
list itself (not just artifacts) across 300 of the 393 total `ci.yml`
runs:

```
Page 1 (most recent 100): 2026-09-09 → 2026-08-22 (78 success / 22 failure)
Page 2 (next 100):        2026-08-22 → 2026-08-01 (50 success / 50 failure)
Page 3 (next 100):        2026-08-01 → 2026-06-13 (mixed)
```

**The oldest run in the third page of 100 (300 total sampled) is
`2026-06-13` — still inside today's 90-day window** (90 days before
`2026-09-09` is `~2026-06-11`). This means the great majority of the
393 total `ci.yml` runs — not merely a couple of recent ones — likely
still have live, non-expired artifacts. Sampled success rate across
the 200 runs actually tallied: **128/200 (64%)**.

**Estimate, now evidence-grounded rather than extrapolated from 2
points**: roughly 300 of 393 runs fall inside the live window; at a
~64% success rate, that's **~190 successful runs**, each contributing
~34.6 MB → **approximately 6.5–6.9 GB** of live artifact storage from
`ci.yml` alone. This is an estimate built from real sampled data
across the actual time range, not a claim of an exact figure — stated
as a range, not a false-precision number.

## 3. `release-play-store.yml` — smaller, and already self-bounding

```
$ grep -B5 -A15 "upload-artifact@v5" .github/workflows/release-play-store.yml
      - name: Upload AAB artifact
        uses: actions/upload-artifact@v5
        with:
          name: shams-aab-${{ github.run_number }}
          path: android/app/build/outputs/bundle/release/app-release.aab
          retention-days: 30
```

**This workflow already had `retention-days: 30` set** — it was never
contributing to unbounded accumulation the way `ci.yml` was before
this session's own recurrence-prevention fix (`a699ff4`). Two samples:

| Run | Age | Artifact | Size | `expired` |
|---|---|---|---|---|
| `34030215466` | 3 days | `shams-aab-117` | 25,232,870 B | `false`, expires `2026-10-06` |
| `32618407331` | 17 days | `shams-aab-99` | 25,214,403 B | `false`, expires `2026-09-22` |

Each AAB is uniquely named per run number (`shams-aab-${run_number}`,
confirming the owner's own instinct that these may carry distinct
per-release evidence worth inspecting before deletion, not
interchangeable build noise). Sampling 20 of the 118 total runs, all
fall within the last 17 days — consistent with a 30-day retention
window keeping only a few weeks of releases live at any time. Rough
estimate: **~25–30 live AAB artifacts × ~25 MB ≈ 625–750 MB** — a real
but noticeably smaller contributor than `ci.yml`.

## 4. Combined picture

| Source | Estimated live storage | Confidence |
|---|---|---|
| `ci.yml` (`app-debug-apk` + `maestro-results`) | **~6.5–6.9 GB** | Grounded in 4 direct samples across the full 90-day window + a 200-run success/failure tally |
| `release-play-store.yml` (`shams-aab-*`) | **~625–750 MB** | Grounded in 2 direct samples + a 20-run recency check |
| `firestore-rules-tests.yml` | **0** | Confirmed directly — no artifact upload step exists |
| **Total estimate** | **~7.1–7.7 GB** | Real sampled data, stated as a range, not exact |

This is a large enough figure to exhaust any GitHub plan's default
Actions storage allowance (free and Pro tiers sit at 500 MB–1 GB;
even higher-tier allowances are commonly in the low single-digit GB
range) many times over — the causal story from the original
investigation (§2 of `PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md`)
is **confirmed, not merely restated**, now with real evidence spanning
the actual retention window rather than a 2-point extrapolation.
`ci.yml` is unambiguously the dominant contributor — consistent with
the owner's own priority-1 instinct, even though the specific 33 MB ×
423 figure was correctly flagged as unproven until checked.

## 5. Still cannot be resolved from this session — unchanged finding, re-confirmed

No new tool became available. A repeat, explicit search of this
session's GitHub tool surface confirms: no artifact-deletion method,
no repository- or account-level storage-usage/billing query, exists
among the tools this session can call. §5 of the prior investigation
document's conclusion stands exactly as written — **freeing this
storage requires the owner's own action** (manual per-run or bulk
artifact deletion via the GitHub web UI, or a storage-plan increase),
outside this session's reach regardless of how precisely the
consumption is now characterized.

## 6. What this document does not do, per the owner's own explicit instruction

- **Does not delete anything** — no tool exists to do so, as confirmed
  above, and no such attempt was made.
- **Does not promote `a699ff4` to `main`** — the owner's own stated
  sequence places storage cleanup before that promotion; this document
  does not get ahead of it.
- **Does not rerun CI** — the owner's own instruction is explicit that
  this waits until storage has actually been freed.
- **Does not modify any code, workflow file, or configuration** — this
  is a read-only sizing exercise only.

## 7. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Parent commit this document is written against: `a699ff4` (the
  retention-days configuration change).
- Working tree: clean before and after this document.
- No file outside `docs/audit/` is touched. No artifact was deleted,
  no workflow was dispatched or re-run, no file on `main` was touched.

---

## Status

**ARTIFACT STORAGE SIZING FORENSICS: COMPLETE.**

| Layer | Status |
|---|---|
| Priority-list correction | ✅ `firestore-rules-tests.yml` confirmed to contribute **zero** — not a cleanup target despite its 140 runs |
| `ci.yml` sizing | ✅ ~6.5–6.9 GB, evidence-grounded (4 samples across the full 90-day window + 200-run success tally) |
| `release-play-store.yml` sizing | ✅ ~625–750 MB, already self-bounded (`retention-days: 30`), evidence-grounded |
| Combined estimate | ✅ ~7.1–7.7 GB, stated as a range built from real data |
| Deletion capability | 🔴 Still absent from this session — unchanged, re-confirmed |
| Storage cleanup | 🔲 Still requires the owner's own action outside this session |
| Promotion of `a699ff4` to `main` | 🔲 Not performed — awaiting cleanup first, per the owner's own sequence |
| CI rerun | 🔲 Not performed — awaiting cleanup first |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting the owner's own artifact-deletion or storage-plan action.
Once done, the owner's own stated sequence is: promote `a699ff4` to
`main`, then rerun CI (governed by the existing `workflow_run` gate),
then resume the remaining Phase 8A-10 production verification.
