# Phase 8A-26 — Resource-Constraint Diagnostic Implementation

Implements: "Authorize the resource-constraint diagnostic on ci.yml."
Adds observability-only instrumentation to test whether host-side
(runner) memory/CPU pressure correlates with the SystemUI ANR
`PHASE_8A_25_FINDING_A_ROOT_CAUSE_CORRECTION.md` found obscuring the
screen at assertion-failure time. **No application behavior change,
no Maestro assertion change, no emulator RAM/CPU-allocation change
(the actual remediation lever, if this diagnostic supports it, remains
a separate future authorization), no Finding B change, no CI rerun,
no merge/promotion/deployment.**

## 1. What was changed

Confined to the `e2e` job:

```
$ git diff --stat .github/workflows/ci.yml
 .github/workflows/ci.yml | 27 +++++++++++++++++++++++++++
 1 file changed, 27 insertions(+)
```

Purely additive (0 deletions). Two pieces, following the exact
`nohup ...` pattern Phase 8A-20 already established for logcat
capture (necessary because each `script:` line in the
`reactivecircus/android-emulator-runner@v2` action runs in its own
separate shell):

### 1a. Runner memory/CPU sampler

Started inside the emulator step's `script:`, immediately after the
logcat capture, running for the whole Maestro test duration:

```bash
nohup bash -c 'while true; do date -u +%FT%TZ; free -h; echo "--- top by CPU ---"; ps aux --sort=-%cpu | head -8; echo "--- top by MEM ---"; ps aux --sort=-%mem | head -8; echo; sleep 10; done' > "$HOME/resource-usage.txt" 2>&1 &
```

Every 10 seconds: a UTC timestamp, `free -h` (memory), and the top 8
processes by CPU and by memory. The timestamp allows this data to be
correlated against the exact moment a SystemUI ANR or assertion
failure occurs.

### 1b. Display step + kernel-level OOM check

New step `Show runner resource usage and OOM check`, `if: always()`,
placed after `Disk usage after Android SDK/emulator setup`:

```yaml
- name: Show runner resource usage and OOM check
  if: always()
  run: |
    echo "::group::Memory/CPU samples during Maestro run (every 10s)"
    cat "$HOME/resource-usage.txt" 2>/dev/null || echo "resource-usage.txt not found"
    echo "::endgroup::"
    echo "::group::dmesg -- OOM-killer / memory-pressure evidence"
    sudo dmesg 2>/dev/null | grep -iE "oom|out of memory|killed process|memory pressure" || echo "no OOM-related dmesg lines found (or dmesg unavailable)"
    echo "::endgroup::"
```

The `dmesg` check specifically looks for kernel-level
out-of-memory-killer activity — a direct, unambiguous signal if the
runner's kernel had to forcibly kill a process under memory pressure,
which would be strong independent corroboration (or, if absent,
evidence against) the resource-constraint theory.

## 2. Why this design

- **Sampling interval (10s)** balances resolution against log volume
  — the SystemUI ANR timeout is itself on the order of many seconds
  to reach the dialog state, so 10s sampling should catch memory/CPU
  trends leading into and during any stall without producing an
  unreadable volume of output over a multi-minute Maestro run.
- **Delivered via the job's own log output**, consistent with every
  prior diagnostic in this audit chain (Phase 8A-20/8A-22) — no
  dependency on the artifact-upload path Finding B still blocks.
- **`dmesg` requires `sudo`** on GitHub-hosted runners; this matches
  the existing precedent in `ci.yml`'s own `Free disk space
  (pre-build)` step (Phase 8A-12), which already uses `sudo rm -rf`
  without issue — no new permission surface introduced.
- **Deliberately does not change emulator RAM or CPU allocation.**
  The authorization was for the diagnostic only; whether to actually
  raise `hw.ramSize`/`hw.cpu.ncore` (or move to a larger runner) is a
  separate remediation decision this document does not make, pending
  what this instrumentation actually shows.

## 3. Verification performed

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
YAML valid
$ git diff .github/workflows/ci.yml | grep "^-[^-]"
(no output — zero real deletions, confirmed purely additive)
```

Same class of boundary as every prior CI-config change in this audit
chain: the only real proof this instrumentation produces useful,
correlatable data is an actual CI run — **not performed here**; this
authorization did not include a CI rerun.

## 4. What this does and does not establish

**Does:**
- Implement exactly the authorized diagnostic — resource sampling
  plus a kernel-level OOM check, both observability-only.
- Set up the next CI run (once separately authorized) to produce data
  that can directly test Phase 8A-25's resource-constraint theory
  against the SystemUI ANR's own timestamp.

**Does not:**
- Prove or disprove the resource-constraint theory — no run has
  exercised this instrumentation yet.
- Change emulator resource allocation or any other remediation.
- Address Finding B.
- Change the production-readiness verdict, which remains unchanged.

## 5. Exact repository state

- Repository: `sp36ai/shams`.
- `main` (`origin/main`): unaffected — this commit is on the feature
  branch only.
- `claude/shams-phase-0-baseline-lnlmy6`: this commit and this
  document are both added here. Working tree clean before and after.
- No merge to `main` and no CI rerun is performed or requested by
  this document.

---

## Status

**PHASE 8A-26 RESOURCE-CONSTRAINT DIAGNOSTIC: COMPLETE.**

| Layer | Status |
|---|---|
| Memory/CPU sampler (10s interval) | ✅ Implemented |
| dmesg OOM-killer check | ✅ Implemented |
| Emulator RAM/CPU allocation | ✅ Unchanged — diagnostic only, per authorization scope |
| YAML validity / diff scope | ✅ Verified — valid, purely additive, `e2e` job only |
| Actual diagnostic value | 🔲 Not yet observed — requires a separate CI Rerun Authorization |
| Finding A root cause | 🔲 Still not confirmed |
| Finding B | 🔲 Untouched, still open |
| Promotion to `main` | 🔲 Not authorized here |
| Production readiness | ❌ NOT READY — unchanged |

Awaiting a separate, explicit authorization for the next step — a CI
rerun to exercise this instrumentation, or any other action the owner
chooses.
