# KP and RKP Are Two Engines, Not One

> Status: current as of the addition of `judgeKP.ts`
> Companion docs: `docs/RKP_RULES_FROM_SARFARAZ.md` (RKP source rules),
> `RKP_KP_FORENSIC_AUDIT.md` (the gap analysis this split is built from)

This codebase runs **two distinct judgment algorithms** over the same
astronomical chart. They are not two names for the same thing, they are not
one algorithm with a display-mode toggle, and they are allowed to disagree
on the same chart. This doc is the map of what's shared and what's separate.

---

## 1. The two engines

| | Classical KP | RKP |
|---|---|---|
| Entry point | `judgeKP()` — `src/astrology/kp/judgment/judgeKP.ts` | `judgeHorary()` — `src/astrology/kp/judgment/judgeHorary.ts` |
| Output type | `KPVerdict` — `src/astrology/types/kpVerdict.ts` | `Verdict` — `src/astrology/types/verdict.ts` |
| Decision method | Analytical: promise check, then significator majority (confirmed vs denied counts) | Numeric: weighted score against fixed thresholds |
| Ruling-planet witnesses | 5 classical (Day, Asc Sign, Asc Star, Moon Sign, Moon Star lords) | 6 (adds Hora Lord as a confirmatory 6th witness), optional horary-number 7th witness |
| Promise layer | Hard gate: primary cusp's sub-lord must itself be a favorable significator, or DENIED before fructification ever runs | No promise gate — scores Moon's Sub-Lord placement directly, can reach any verdict even when KP would deny the chart outright |
| Confidence | None — qualitative `strength` (`strong`/`moderate`/`mixed`/`none`) only | Numeric `confidence` 0–100 |
| Remedy / narration | Absent — not a classical KP output | Present — product/spiritual layer |
| Retrograde modifier | YES → DELAYED (Moon's sub-lord, Jupiter, or Venus retrograde) | Same rule, applied identically |
| Timing | `computeConvergenceTiming()` (dasha/antardasha/pratyantardasha convergence) | Same function — timing convergence is astronomical, not a scoring concept, so both engines share it |

They intentionally reach different verdicts on the same chart when the
promise layer and the scoring layer disagree — see
`judgeKP.test.ts`, test *"KP and RKP are independent"*, which runs both
engines on one identical chart and asserts they diverge (KP: `DENIED`,
promise never clears; RKP: scores anyway, since it has no promise gate).

---

## 2. What's shared (pure astronomy, not judgment)

Both engines are built on the same primitives and must never duplicate this
logic themselves:

- Ephemeris, ayanamsa, Placidus cusps (`primitives/`)
- Sub-lord / sub-sub-lord chain (`primitives/subLord.ts`)
- Ruling-planet computation — Day/Hora/Asc/Moon lords (`primitives/rulingPlanets.ts`)
- 4-tier KP significator ranking (`kp/judgment/significators.ts`)
- House-occupancy lookup (`kp/judgment/significations.ts`)
- Dasha and dasha-transit-convergence timing (`primitives/dasha.ts`, `kp/judgment/timing.ts`)
- The house matrix — which houses matter for which question type
  (`kp/rules/houseMatrix.ts`)
- The Kotamraju filter (reject a ruling-planet witness whose own sub-lord
  sits in a denial house) — a legitimate advanced KP check both engines
  apply the same way

## 3. What's NOT shared (judgment-specific, lives in exactly one engine)

- Numeric scoring, weights, and YES/NO/CONDITIONAL thresholds — RKP only
- The promise-vs-fructification hard gate — KP only
- Hora Lord and horary-number witnesses — RKP only
- Remedy selection, narration templates — RKP/product layer only
- `KPVerdict` and `Verdict` are separate types on purpose (see
  `kpVerdict.ts` module docstring) — do not merge them into one "verdict"
  shape just because they judge the same chart.

## 4. Where each is wired in today

`functions/src/functions/askOracle.ts` (the production Cloud Function)
currently calls `judgeHorary()` only — the app's shipped verdicts are RKP.
`judgeKP()` exists as a fully independent, tested engine
(`src/__tests__/judgeKP.test.ts`) that is not yet wired into the callable
function or the UI. Wiring a second, user-facing "classical KP" verdict
path is a separate, larger product decision (would need its own UI
surface, since `KPVerdict` has no remedy/narration/numeric confidence for
`AstroVerdictCard` to render) — not assumed here.

## 5. Keeping both copies in sync

`src/astrology/` is the single source of truth for all engine code.
`functions/src/engine/` is a **generated** copy — never hand-edit it.
Run `npm run sync-engine` (in `functions/`) after any change under
`src/astrology/` to regenerate it; this also rewrites `@astrology/...`
import aliases to the correct relative paths for the functions build.
