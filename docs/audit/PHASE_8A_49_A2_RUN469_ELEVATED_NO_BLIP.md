# Phase 8A-49 — Run #469: elevated duration with NO transport_id blip — breaks the assumed link

Run `#469` (id `35099325587`, head `41e0200`, triggered by this session's ongoing A2 watch loop) hit **`Setup Android emulator`: 22m36s (1356s)** — elevated, continuing a run of three consecutive elevated/A2-range occurrences (`#467`: 1654s, `#468`: 1574s, `#469`: 1356s). This duration sits just below the previously observed A2-band floor (1409s) but far above baseline (300–460s).

## 1. The key finding: no transport-loss blip this time

`Show ADB transport-layer state` fully retrievable (lines 1549–4970 of 4999). Step window: `13:11:54Z`–`13:34:30Z`. Sampler coverage confirmed comprehensive: first in-window sample `13:15:21Z` (~3m27s into the step), last `13:34:09Z` (~21s before step end) — the entire established ~13–15 minute window where all four prior occurrences (`#457`/`#460`/`#467`/`#468`) showed their blip is well inside this coverage.

**Result: 356 in-window samples, zero losses.** No `transport_id` change observed anywhere in the step.

## 2. Why this matters — it breaks a hasty causal story

`PHASE_8A_43/46/47/48` established a 4/4 replication of a specific transport-loss signature co-occurring with A2-band durations, and speculated the signature might be *the* mechanism behind A2. **This run disproves that as a strict requirement**: it is clearly an elevated/A2-adjacent duration (3x baseline, `failure` conclusion, same step) with **no transport-layer anomaly at all** during the entire comprehensively-sampled window.

This means one of the following, not yet distinguishable from current evidence:
- **(a)** There are two distinct causes of elevated `Setup Android emulator` duration — one that produces the transport_id blip (seen in 4/4 prior cases) and one that does not (seen here) — and A2 is not a single phenomenon.
- **(b)** The transport-loss blip is a *symptom* of whatever the real underlying cause is (e.g. host resource contention), and that cause doesn't always manifest as an ADB-visible transport drop — sometimes the same underlying condition elongates the step without ever dropping the ADB connection.
- **(c)** This run's elongation has a genuinely different root cause unrelated to the previous four (e.g. a slow APT/SDK download, a different stall point in Gradle/emulator boot) that happens to fall in a similar duration range by coincidence.

No sampler currently distinguishes between these. This is exactly the kind of evidence that argues against prematurely proposing a "fix" based on the transport_id pattern alone — that pattern, however consistent across 4 cases, is not necessary for an elevated-duration run.

## 3. What this does and does not establish

**Does:** Adds a critical negative data point to the A2 evidence base. Confirms the `PHASE_8A_44` relocation and sampler continue working (comprehensive coverage, no gaps). Revises the working duration-tier picture: A2-range durations now span at least 1356s–1654s, and are not always accompanied by the transport_id signature.

**Does not:** Establish root cause. Does not touch `ci.yml`, AVD/emulator config, RAM/CPU, application code, or the judgment engine. Does not change the production-readiness verdict.

## 4. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- No file changed by this document besides itself.
- Run `#469` triggered by this session's watch loop, per standing authorization.

---

## Status

**PHASE 8A-49: ELEVATED-DURATION RUN WITH NO TRANSPORT_ID BLIP — BREAKS THE ASSUMED 1:1 LINK, A2 MAY NOT BE A SINGLE MECHANISM.**

| Layer | Status |
|---|---|
| `PHASE_8A_44` relocation | ✅ Confirmed working a sixth consecutive time |
| Transport_id 1→2 signature | 🟠 Now 4/5 — not universal to elevated-duration runs |
| Sampler coverage this run | ✅ Comprehensive (3m27s–21m9s into the step, fully spans the established blip window) |
| Duration-tier picture | 🟠 Revised — A2-range now spans ≥1356s–1654s, mechanism not uniform |
| A2 root cause | 🔲 Still open, now more clearly not a single simple mechanism |
| `ci.yml` / AVD / judgment engine | ✅ Untouched by this document |
| Production readiness | ❌ NOT READY — unchanged |

Watch loop continues per standing stop conditions (PR merge or A2 root cause established).
