# KP Judgment-Rules Correctness — Audit

Compared the runtime engine against `docs/RKP_RULES_FROM_SARFARAZ.md` (Astro
Sarfaraz's source of truth). This is the product's core: a wrong verdict is the
most damaging possible defect.

## Result — faithful, no correctness bug

Every owner-critical value and rule matches the documented ruleset exactly:

| Ruleset element | Doc § | Verdict |
|---|---|---|
| House matrix (favorable / denial / primary, all 11 owner types + 3 extensions) | §2 | ✅ exact (sets, order-independent) |
| Vimshottari order (Ketu→…→Mercury) + years (total 120) | §3 | ✅ exact |
| Day-lord table (Sun…Saturn) | §4 | ✅ exact |
| Hora Chaldean order (Sun→Venus→Mercury→Moon→Saturn→Jupiter→Mars) | §4 | ✅ exact |
| 5-step scoring: STEP 0 promise gate → DENIED; STEP 3 Moon-sub-lord house ±2; STEP 5 ≥3 YES / ≤−2 NO / else CONDITIONAL | §5 | ✅ exact |
| Retrograde modifier: YES + (Moon-sub-lord \| Jupiter \| Venus retrograde) → DELAYED | §5 | ✅ exact |

Supporting logic verified sound and deterministic:
- **`houseOfPlanet`** uses the wrap-around-correct cusp lookup.
- **Significators** follow the classical KP 4-tier ranking (nakshatra-lord of
  occupant → occupant → nakshatra-lord of house-lord → house-lord), and a planet
  that signifies *both* a favorable and a denial house is excluded as neutral.
- **`checkPromise`** correctly gates on the primary cusp's sub-lord occupying a
  denial house.

## Enhancements beyond the doc's pseudocode (not bugs)

Two runtime behaviours are richer than §5/§6's simplified pseudocode; the doc
frames itself as "aligned to the current runtime engine" and references
"Phase B/D", so these are engine details the pseudocode elides — both are sound
KP technique:
- **Kotamraju filter** on STEP 4: a ruling planet whose own sub-lord falls in a
  denial house is dropped before scoring (a standard RP purification; makes
  verdicts more conservative).
- **Dasha-convergence timing** instead of §6's "rough" `dashaYears × 12 ×
  score/maxScore` formula (MD/AD convergence is more precise).

**Recommendation (doc, not code):** update §5/§6 of the ruleset doc to mention
the Kotamraju filter and dasha-convergence timing, so a future maintainer isn't
surprised by engine behaviour the pseudocode omits.

## Change

Added `src/__tests__/rulesetConformance.test.ts` (15 assertions) pinning the
house matrix, Vimshottari order/years, day-lord table, and hora Chaldean order
to the documented values — so a silent typo in any of these verdict-critical
constants fails CI. Exported `DAY_LORDS` / `HORA_SEQUENCE` (both engine mirrors)
so §4 is testable.
