# Shams al-Asrār — Final Oracle Response Protocol

> Status: implemented. Source: user-supplied "SHAMS AL-ASRĀR — FINAL ORACLE
> RESPONSE ENGINE" specification (chat).

## The one architectural rule

> RKP calculates. Shams al-Asrār interprets. Astro Sarfaraz presents.

The app has three separate engines, and the boundary between them is
enforced in code, not just convention:

```
              SHAMS AL-ASRĀR APP
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
  CALCULATION      JUDGMENT      PRESENTATION
     ENGINE          ENGINE          ENGINE
       │              │                │
  primitives/    judgeRKPWatch.ts   Claude, guided by
  watchChart.ts  → WatchVerdict     oracleSynthesisPrompt.ts
  ephemeris                         via oracleAnchors.ts
```

- **Calculation + Judgment** (`judgeRKPWatch.ts`) are fully deterministic —
  see `docs/RKP_WATCH_ENGINE.md`. Nothing here is language-model output.
- **Presentation** (Claude, via `synthesiseOracleVoice()` in `askOracle.ts`)
  never recalculates and never sees engine internals. It receives only the
  structured anchors below and turns them into oracle language.

## The translation boundary: `oracleAnchors.ts`

`deriveOracleAnchors(verdict: WatchVerdict): OracleAnchors` is the ONE place
where calculation facts become language-model input. It is a pure function
(no I/O), independently unit-tested
(`functions/src/prompts/__tests__/oracleAnchors.test.ts`), so the boundary
is auditable — if the oracle ever says something the calculation didn't
support, the bug is findable in one small file, not scattered through a
392-line prompt.

| Anchor | Derived from |
|---|---|
| `VERDICT` | `verdict.nativeState` (YES_STRONG / YES_CONDITIONAL / DELAY / WAIT / NO_DENIED / INCONCLUSIVE) |
| `CONFIDENCE` | `verdict.confidence` banded per the source material's own bands (VERY_HIGH/HIGH/MODERATE/LOW/UNCERTAIN) |
| `PRIMARY_THEME` | `houseLord.dignity` + `nativeState` (STRONG_OPENING / OPENING / DELAY / AMBIGUITY / OBSTRUCTION / STRUCTURAL_BLOCKAGE / UNCLEAR_SIGNAL) |
| `OBSTRUCTION` | the first obstructing planet (`houseLord.conjunctObstruction`/`aspectObstruction`), else Moon disagreement, else a denial ruling witness, else NONE |
| `SECONDARY_THEME` | ENVIRONMENTAL_FRICTION (activated house's direction is Vastu-afflicted), INNER_CONFLICT (Moon disagrees), or NONE |
| `TIMING` | `verdict.timing` window/range, or UNCLEAR |
| `DIRECTION` | `houseLord.direction` (the real Vastu direction computed in `judgeRKPWatch.ts`) |
| `REVERSAL` | `houseLord.retrograde` → POSSIBLE / NONE |

Raw planet names (e.g. "Saturn") are passed through as-is — the prompt
itself, not this module, is responsible for translating them to Arabic
celestial names (Zuhal, etc.) and folding them into imagery.

## The presentation layer: `oracleSynthesisPrompt.ts`

Reworked from a binary CONFIRMED/DENIED × HIGH/MEDIUM/LOW model to the six
real verdict states the engine actually produces, each with its own fixed
"unveiling" heading, tone, opening image, and forbidden language:

| Native state | Unveiling heading |
|---|---|
| YES_STRONG | "The Unveiling: YES — Strongly Favoured" |
| YES_CONDITIONAL | "The Unveiling: YES — with Condition" |
| DELAY | "The Unveiling: YES — but with Delay" |
| WAIT | "The Unveiling: WAIT" |
| NO_DENIED | "The Unveiling: NO" |
| INCONCLUSIVE | "The Unveiling: The Hour Is Not Clear" |

Everything else from the source spec is now encoded directly in the prompt:

- **Give the verdict early** — the new `unveiling` field is the first thing
  generated, and the app renders it before the poetic opening (see below).
- **The four levels** (promised / obstructing / what changes it / when) —
  a dedicated prompt section requiring every reading (except INCONCLUSIVE)
  to keep these distinct rather than collapsing into "good"/"bad".
- **Graduated timing language** (immediate/near/intermediate/delayed/longer
  cycle) instead of fabricated exact dates — in the `timing` field spec.
- **DIRECTION and REVERSAL as imagery, never a report** — used at most once,
  subtly, never as an instruction ("check your south corner" is a different
  layer of the app, not this oracle voice).
- **Never expose internal terminology** — the forbidden-terminology list now
  explicitly includes "house lord", "watch chart", "confidence score",
  "algorithm", "engine", and the raw anchor names themselves
  (`PRIMARY_THEME`, `OBSTRUCTION`, etc.) — the model must translate, never echo.
- **Qur'an verse / Asmā' al-Ḥusnā / Dua / zikr / sadaqah** selection is now
  keyed off `PRIMARY_THEME` per the mapping the spec gave (patience → ṣabr
  verses, uncertainty → tawakkul, etc.) rather than a flat CONFIRMED/DENIED
  split.
- A new **`warning`** field (Layer V — what must be avoided) is now actually
  requested from Claude. It existed in the type contract and in
  `safetyValidator.ts`'s validated-fields list already, and the client UI
  already rendered it — but the prompt never asked for it, so it was always
  empty. It is now a real field, tied to `OBSTRUCTION`/`REVERSAL`, phrased
  per the existing tone guardrails (observation, not threat).

## Response contract changes

- `functions/src/types.ts`: `OracleResponse.oracle` gains `unveiling?: string`.
- `askOracle.ts`: `synthesiseOracleVoice()` and `buildOracleUserMessage()`
  now take an `OracleAnchors` object instead of ad-hoc verdict/stage/timing
  params; `ORACLE_FALLBACK` gained a matching `unveiling`.
- `src/types/verdict.ts` (`OracleVoice`) and `src/firebase/oracle.ts` mirror
  the new optional `unveiling` field through to the client.
- `AstroVerdictCard.tsx` renders `oracle.unveiling` as a heading above the
  poetic opening, distinct from the existing `VerdictPill` chrome — the
  oracle's own early verdict statement, in its own voice.

## What did not change

- `judgeRKPWatch.ts` and its structured `WatchVerdict` output — this
  protocol only changes how that output becomes language, never the
  calculation itself.
- `runSafetyValidator()` — still validates `hidden_influence`,
  `spiritual_layer`, `timing`, `warning`; passes every other field through
  unmodified, so `unveiling` flows through untouched.
