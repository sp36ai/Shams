# Phase 8A-19 — Finding B Deeper Investigation (Artifact-Storage Quota)

Implements: "Investigation authorization — Finding B, artifact
quota." Extends `docs/audit/PHASE_8A_14_FINDINGS_INVESTIGATION.md` §B
with a precise timeline built from all data points gathered since,
across runs `#429` (last success), `#431`, `#432` attempt 1, and
`#432` attempt 2 (externally triggered). **Read-only — no
application, test, or workflow file is changed. No remediation is
proposed.**

## 1. Precise timeline (previously approximate, now exact)

```
$ get_workflow_job(102990191309)  -- run #429's E2E job
"Upload Maestro results": started_at 2026-09-10T18:23:56Z, conclusion: success
```

This is the last confirmed successful artifact upload to this
repository. Every quota failure since, measured precisely from that
point:

| Event | Timestamp | Gap since last success |
|---|---|---|
| `#429` — last successful upload | `2026-09-10T18:23:56Z` | — |
| `#431` — quota failure | `2026-09-11T03:19:24Z` | 8h 55m |
| `#432` attempt 1 — quota failure | `2026-09-11T06:08:42Z` | 11h 45m |
| `#432` attempt 2 — quota failure (external rerun) | `2026-09-11T08:18:43Z` | **13h 55m** |

## 2. What this changes: the pure recalculation-lag hypothesis is now weaker than previously ranked

Phase 8A-14 §B3 ranked "GitHub's own recalculation lag" (up to the
error message's own stated 6-12 hours) as the best-supported
explanation, based on the single ~9-hour gap then available (`#429`
to `#431`).

**That framing needs revision now that three data points exist, not
one.** The critical fact: **`#429` succeeded** — meaning the quota was
demonstrably *not* exhausted at `18:23:56Z` on 2026-09-10, after the
owner's cleanup had already taken effect. The quota exhaustion
observed in `#431`, `#432` attempt 1, and `#432` attempt 2 is
therefore not "the cleanup's benefit hasn't been credited yet" — the
benefit *was* credited (as `#429`'s own success proves) and then the
quota became exhausted *again* afterward, and **has now remained
exhausted continuously for nearly 14 hours** — longer than the error
message's own stated worst case (12 hours) for a *single* recalculation
lag.

This does not disprove recalculation lag as a contributing factor
(GitHub's own recalculation could plausibly be an ongoing, non-
monotonic process rather than a single one-time catch-up from one
event — a nuance the original investigation did not consider), but it
means **"recalculation lag from the original cleanup" alone can no
longer be the leading explanation** — something must have caused the
quota to fill again after `18:23:56Z`, and that refill has now
persisted longer than one full lag cycle.

## 3. Ruling out this repository as the source of the renewed exhaustion

Re-confirmed, extending Phase 8A-14 §B2's check across the full
window now available (`18:23:56Z` `#429` through `08:18:43Z` `#432`
attempt 2, ~14 hours):

- `ci.yml` is this repository's only artifact-producing workflow on
  ordinary runs. Across all three failing runs in this window, the
  `Upload Maestro results` step **itself failed** every time — a
  failed upload does not create a partial or partially-successful
  artifact; **zero new bytes were added to this repository's own
  artifact storage across this entire ~14-hour window**, because
  every attempt to add any failed outright.
- `app-debug-apk` correctly never uploaded on any of these runs
  (opt-in-only policy, confirmed `skipped` every time).
- No other workflow in this repository ran during this window (same
  check as Phase 8A-14 §B2, re-confirmed for the extended time range —
  no new `export-upload-cert.yml`, `release-play-store.yml`, or other
  workflow activity observed).

**This repository contributed zero new artifact-storage consumption
during the entire period the quota has remained exhausted.** Whatever
is filling or keeping the account-level quota exhausted is not
originating from `sp36ai/shams`'s own workflows.

## 4. Revised hypothesis ranking

1. **(Now best supported)** Usage attributable to something **outside
   this repository** — either another repository on the same GitHub
   account independently consuming the shared account-level quota
   (established as architecturally possible in
   `PHASE_8A_10_ARTIFACT_QUOTA_INVESTIGATION.md` — the quota is
   account-level, not per-repository), or an ongoing/recurring
   recalculation dynamic on GitHub's side more complex than a single
   lag window. **Not verifiable from this session**: this session's
   tool access remains scoped to `sp36ai/shams` only, per this
   session's repository-access policy — there is no way to inspect
   any other repository's Actions usage or the account's aggregate
   billing/storage state from here. This is the same capability gap
   documented in every prior phase that touched this finding, restated
   because it is now the load-bearing explanation rather than a
   secondary caveat.
2. **(Demoted, but not eliminated)** A single, one-time recalculation
   lag from the original cleanup. Weakened by §2's finding that the
   quota was demonstrably clear at `18:23:56Z` and became exhausted
   again afterward — a single lag from the *original* cleanup event
   does not explain a renewed exhaustion nearly 14 hours later.

**No remediation is proposed.** Per the authorization's own framing
and Phase 8A-14's original conclusion: neither hypothesis is
addressable by a workflow-file change. §4.1 requires owner-level
account/billing access this session does not have; §4.2, even if
still partially true, would resolve with time rather than a code
change.

## 5. What would resolve this with more confidence (not authorized or performed here)

- Owner-level access to the GitHub account's Actions usage/billing
  dashboard (Settings → Billing → Actions, or the equivalent API with
  account-scope credentials) would directly show whether other
  repositories are consuming the shared quota, and the account's
  actual current usage-vs-limit numbers — closing §4.1's gap
  decisively. This is outside this session's tool surface and outside
  the scope of this investigation-only authorization.
- Continued passive observation: if a future CI run (under a separate
  CI Rerun Authorization) succeeds at uploading without any repo-side
  change having been made, that would itself be evidence the account-
  level usage cleared on its own — supporting §4.1's recurring-
  recalculation framing over a hard external consumer.

## 6. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected.
- `claude/shams-phase-0-baseline-lnlmy6`: this document is committed
  to it, adding one new commit. Working tree clean before and after.
- No application, test, or workflow file is modified by this
  investigation.

---

## Status

**PHASE 8A-19 FINDING B DEEPER INVESTIGATION: COMPLETE (diagnostic
record; no remediation proposed).**

| Layer | Status |
|---|---|
| Precise timeline established | ✅ Last success (`#429`, 18:23:56Z) through three subsequent failures, exact gaps computed |
| Pure recalculation-lag hypothesis | 🟡 Weakened — quota was demonstrably clear once, then re-exhausted, and has now stayed exhausted longer than one stated lag window |
| In-repo new consumption | ✅ Ruled out for the entire ~14-hour window — every upload attempt in this window failed outright, adding zero bytes |
| Cross-repository/account-level usage | 🔴 Now the best-supported explanation — still unverifiable from this session's scoped access |
| Remediation | 🔲 Not proposed — neither hypothesis is addressable by a workflow-file change |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for any next step —
requesting owner-level billing/usage access, a future CI rerun to
passively test whether the quota has cleared, or Finding A's own next
step.
