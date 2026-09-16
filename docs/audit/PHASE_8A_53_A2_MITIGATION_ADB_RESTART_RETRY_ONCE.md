# Phase 8A-53 — A2 mitigation: restart adb and retry the Maestro run once on failure

`PHASE_8A_52` established A2's post-blip elongation mechanism: a one-time adb transport-layer hiccup permanently breaks Maestro's own internal driver connection (`dadb`), even though the OS-level adb daemon self-heals in ~3 seconds. Every flow after the hiccup then cascades through Maestro's own fixed ~4-minute `Android driver unreachable` timeout for the rest of the suite, which is what produces the widely varying elevated durations (`#457`/`#460`/`#467`/`#468`/`#474`).

This document applies a targeted mitigation for that specific, now-evidenced mechanism. It is the first `ci.yml` change in this audit made on the basis of an established root cause rather than diagnostic instrumentation alone.

## 1. The change

In the `E2E Tests (Maestro)` job's `Setup Android emulator` step (`reactivecircus/android-emulator-runner@v2`'s `script:` block), the final line previously ran Maestro once with no retry:

```
"$HOME/.maestro/bin/maestro" test --format junit --output maestro-results.xml .maestro/ci/
```

It now runs Maestro, and **on any failure**, restarts the adb server and retries once:

```
bash -c '"$HOME/.maestro/bin/maestro" test --format junit --output maestro-results.xml .maestro/ci/ || { echo "::warning::Maestro run failed; restarting adb and retrying once (PHASE_8A_52 mitigation)"; adb kill-server; adb start-server; adb wait-for-device; sleep 2; "$HOME/.maestro/bin/maestro" test --format junit --output maestro-results.xml .maestro/ci/; }'
```

Written as a single self-contained `bash -c '...'` line — required because `reactivecircus/android-emulator-runner`'s `script:` block executes each line in its own separate shell (a constraint established in `PHASE_8A_31`, after a multi-line construct broke run `#438`).

### Why `adb kill-server` / `start-server` / `wait-for-device` specifically

`PHASE_8A_52` showed the OS-level adb daemon already self-heals on its own within ~3 seconds (re-enumerating under a new `transport_id`) — so the daemon itself isn't what's stuck. What's stuck is Maestro's own `dadb`-based driver connection, which is a client-side TCP forwarding layer built on top of the adb server. `adb kill-server` + `adb start-server` forces a brand new adb server process, so when Maestro retries and opens a fresh connection, it cannot be reusing the same broken forwarding state that caused the cascade. `adb wait-for-device` blocks until the (already-booted) emulator is visible again under the new server before Maestro's retry begins, avoiding a race where Maestro starts before the new adb server has re-discovered the device.

### Why bounded to exactly one retry

A genuine app/flow regression (not an A2 transport hiccup) will fail identically on the retry, so this bounds worst-case CI time to roughly 2x the normal runtime rather than retrying indefinitely, and the job still correctly fails (no `|| true` — the final line's exit code, from the retry attempt, is what the step and therefore the job sees). This is deliberately a narrow mitigation for the *established* mechanism, not a general "retry until green" pattern.

## 2. What this does and does not address

**Does:** Directly targets the confirmed mechanism from `PHASE_8A_52` — a broken Maestro-internal driver connection that doesn't self-heal. If a future run hits the same one-time transport hiccup, the adb-server restart should let the retry's flows run against a fresh driver connection instead of cascading through repeated `Android driver unreachable` failures.

**Does not:**
- Fix the root trigger of the initial transport-layer hiccup itself — why `host:transport:emulator-5554` briefly returns "not found" in the first place remains unestablished (host resource contention remains the leading unconfirmed candidate per `PHASE_8A_29`/`30`). If that trigger recurs during the retry attempt too, the retry will also fail and the job will still show an elevated, failing duration — this mitigation reduces the *impact* of a hiccup, it does not prevent the hiccup.
- Address `#469`'s no-blip elevated case (`PHASE_8A_49`) — if that run's mechanism differs from the transport-hiccup cascade, this retry may not help it. This remains open per `PHASE_8A_52`'s §4.
- Touch AVD/emulator config, RAM/CPU allocation, application code, or the judgment engine (RKP Watch Engine) — none of that was evidenced as necessary by `PHASE_8A_52`, so none of it is changed here, consistent with the audit's minimal-evidence-based-change constraint.
- Guarantee CI is now reliably fast — a run that hits the hiccup will still take roughly double its normal duration (one failed attempt + one retry attempt), just without cascading through all 3 flows' full ~4-minute timeouts each on the *first* attempt only, and should get a green result if the second attempt doesn't also hit the hiccup.
- Change the production-readiness verdict — this is a CI reliability mitigation, not a statement about the app's production readiness, which remains **NOT READY** per the audit's standing verdict.

## 3. Validation performed

- `python3 -c "import yaml; yaml.safe_load(...)"` confirms `ci.yml` remains valid YAML after the edit.
- `git diff --stat` confirms the change is confined to `.github/workflows/ci.yml` (25 insertions, 8 deletions — the retry logic plus an expanded rationale comment; no other file touched).
- The change was **not yet exercised by a live CI run** as of this document — that verification is the natural next step (trigger a run, and ideally observe one that would have hit A2 under the old single-attempt behavior, to see whether the retry succeeds).

## 4. Exact repository state

- Repository: `sp36ai/shams`, branch `claude/shams-phase-0-baseline-lnlmy6`.
- Files changed: `.github/workflows/ci.yml` (the retry mitigation) and this document.
- No AVD/emulator config, RAM/CPU, application code, or judgment-engine file touched.
- No open or merged PR exists for this branch.

---

## Status

**PHASE 8A-53: A2 MITIGATION APPLIED — RESTART ADB AND RETRY THE MAESTRO RUN ONCE ON FAILURE, TARGETING THE PHASE_8A_52 ROOT-CAUSE MECHANISM. NOT YET VALIDATED BY A LIVE CI RUN.**

| Layer | Status |
|---|---|
| Mitigation implemented | ✅ Single retry with adb server restart, in `ci.yml`'s `Setup Android emulator` step |
| Targets established mechanism | ✅ Directly addresses `PHASE_8A_52`'s confirmed Maestro-driver-doesn't-reconnect finding |
| Root trigger of the initial hiccup | 🔲 Still unaddressed/unknown — this mitigation reduces impact, not occurrence |
| `#469`'s no-blip case | 🔲 Not confirmed to be covered by this mitigation |
| Live CI validation | 🔲 Not yet performed — pending a future run |
| YAML validity | ✅ Confirmed |
| Diff scope | ✅ Confined to `ci.yml` + this doc |
| `AVD/emulator config, RAM/CPU, judgment engine` | ✅ Untouched |
| Production readiness | ❌ NOT READY — unchanged; this is a CI reliability mitigation only |
