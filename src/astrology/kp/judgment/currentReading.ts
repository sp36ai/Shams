/**
 * currentReading — RKP's "Watch of Currents" layer.
 * --------------------------------------------------------------------------
 * RKP's defining role (see docs/RKP_RULES_FROM_SARFARAZ.md and
 * docs/RKP_VS_KP_SEPARATION.md): it reads the LIVE MOVEMENT of the
 * conditions around a question — not only a final YES/NO seal. This module
 * computes that reading (flow, drift, interference) purely from data
 * judgeHorary() has already produced. It adds no new astronomy and no new
 * scoring — it reframes the existing significator/ruling-planet/dasha
 * signal as situational momentum.
 *
 * THE SEVEN CANONICAL SYMBOLIC OUTPUTS (source: RKP product spec, "Watch of
 * Currents — Typical symbolic output"):
 *   - "current is open"
 *   - "current is unstable"
 *   - "current is blocked"
 *   - "current is turning"
 *   - "current is favorable but delayed"
 *   - "current is pressured by interference"
 *   - "current weakens after initial movement"
 *
 * THE ALGORITHM:
 *
 *  1. STRUCTURAL BLOCK — if the promise layer already failed (judgeHorary's
 *     STEP 0), there is no live current to read at all: the chart itself
 *     blocks the matter, independent of dasha or ruling-planet motion.
 *     flow='blocked', structural=true, label="current is blocked".
 *
 *  2. BASE FLOW — otherwise derived directly from the verdict already
 *     reached: YES/DELAYED → 'open'; NO → 'blocked'; CONDITIONAL/UNCLEAR →
 *     'unstable' (no directional dominance between confirmed and denied
 *     significators).
 *
 *  3. DRIFT — compares the Mahadasha lord's alignment (favorable/denial/
 *     neutral against the confirmed/denied significator sets) with the
 *     Pratyantardasha lord's alignment. If the near-term period (PD) trends
 *     the opposite way from the outer period (MD), the current is moving,
 *     not flat: 'strengthening' (blocked/unstable now, opening soon) or
 *     'weakening' (open now, fading soon).
 *
 *  4. TURNING — a blocked or unstable base flow whose drift is
 *     'strengthening' is promoted to flow='turning': the matter reads as
 *     denied/mixed today but the nearer dasha window is already moving
 *     toward favorable. This is the direct answer to "is this path opening
 *     or closing?".
 *
 *  5. INTERFERENCE — retrograde on any of the three decisive witnesses
 *     (Moon's sub-lord, Jupiter, Venus — the same set judgeHorary uses for
 *     its DELAYED modifier) or combustion on a planet that is itself acting
 *     as a significator witness in this reading. Interference does not
 *     change the verdict; it changes how the current READS.
 *
 *  6. LABEL — the most specific symbolic reading wins, in this priority:
 *       open + weakening drift        → "current weakens after initial movement"
 *       open + interference           → "current is favorable but delayed"
 *       (any) + interference          → "current is pressured by interference"
 *       turning                       → "current is turning"
 *       open                          → "current is open"
 *       blocked                       → "current is blocked"
 *       unstable                      → "current is unstable"
 *
 * Determinism guarantee: identical inputs always produce an identical
 * CurrentReading. Pure function, no I/O, no randomness.
 */

import type { Planet } from '@astrology/types/chart';
import type { ReasoningStep, VerdictKind, VerdictTiming } from '@astrology/types/verdict';

/** The dominant directional read of the current around the question. */
export type CurrentFlow = 'open' | 'blocked' | 'turning' | 'unstable';

/** Whether the confirming alignment is gaining or losing strength MD → PD. */
export type CurrentDrift = 'strengthening' | 'weakening' | 'steady';

export interface CurrentReading {
  /** The dominant directional read — see module docstring for the taxonomy. */
  readonly flow: CurrentFlow;
  /** Directional momentum across the dasha chain (Mahadasha → Pratyantardasha). */
  readonly drift: CurrentDrift;
  /** True only for a structural (promise-layer) block — see LAYER 1. Absent → 'blocked' is a fructification-level, potentially temporary, denial. */
  readonly structural: boolean;
  /** Planets creating interference on the decisive witnesses (retrograde or combust). */
  readonly interference: readonly Planet[];
  /** One of the seven canonical symbolic labels — see module docstring. */
  readonly label: string;
  readonly reasoning: readonly ReasoningStep[];
}

export interface CurrentReadingInput {
  readonly verdict: VerdictKind;
  readonly stage: 'promise_failed' | 'fructification';
  readonly moonSubLord: Planet;
  readonly confirmedSignificators: readonly Planet[];
  readonly deniedSignificators: readonly Planet[];
  readonly retrogradeFlags: readonly Planet[];
  readonly combustFlags: readonly Planet[];
  readonly timing?: VerdictTiming;
}

function step(ruleId: string, description: string): ReasoningStep {
  return { ruleId: `CURRENT_${ruleId}`, description, weight: 0 };
}

type Alignment = 'favorable' | 'denial' | 'neutral';

function alignmentOf(
  planet: Planet | undefined,
  confirmed: readonly Planet[],
  denied: readonly Planet[],
): Alignment {
  if (planet === undefined) {
    return 'neutral';
  }
  if (confirmed.includes(planet)) {
    return 'favorable';
  }
  if (denied.includes(planet)) {
    return 'denial';
  }
  return 'neutral';
}

/** Structural block — no live current to read, see LAYER 1. */
function structuralBlock(): CurrentReading {
  return {
    flow: 'blocked',
    drift: 'steady',
    structural: true,
    interference: Object.freeze([]),
    label: 'current is blocked',
    reasoning: Object.freeze([
      step(
        'STRUCTURAL',
        'Promise layer failed — the chart itself blocks this matter; there is no live current to read',
      ),
    ]),
  };
}

export function computeCurrentReading(input: CurrentReadingInput): CurrentReading {
  if (input.stage === 'promise_failed') {
    return structuralBlock();
  }

  const {
    verdict,
    moonSubLord,
    confirmedSignificators,
    deniedSignificators,
    retrogradeFlags,
    combustFlags,
    timing,
  } = input;
  const reasoning: ReasoningStep[] = [];

  // ── Base flow from the verdict already reached ─────────────────────────────
  let flow: CurrentFlow;
  if (verdict === 'YES' || verdict === 'DELAYED') {
    flow = 'open';
  } else if (verdict === 'NO') {
    flow = 'blocked';
  } else {
    // CONDITIONAL / UNCLEAR — no directional dominance either way.
    flow = 'unstable';
  }
  reasoning.push(step('BASE', `Verdict ${verdict} → base flow '${flow}'`));

  // ── Drift: does the confirming alignment strengthen or fade MD → PD? ────────
  let drift: CurrentDrift = 'steady';
  if (timing !== undefined) {
    const mdAlign = alignmentOf(timing.activeDasha, confirmedSignificators, deniedSignificators);
    const pdAlign = alignmentOf(
      timing.activePratyantardasha,
      confirmedSignificators,
      deniedSignificators,
    );
    if (mdAlign !== pdAlign) {
      if (mdAlign === 'favorable' || pdAlign === 'denial') {
        drift = 'weakening';
      } else if (mdAlign === 'denial' || pdAlign === 'favorable') {
        drift = 'strengthening';
      }
    }
    reasoning.push(
      step(
        'DRIFT',
        `MD=${timing.activeDasha}(${mdAlign}) → PD=${timing.activePratyantardasha}(${pdAlign}) → drift '${drift}'`,
      ),
    );

    // A blocked/unstable current whose near-term dasha is already turning
    // favorable is a current in motion, not a flat block — see LAYER 4.
    if ((flow === 'blocked' || flow === 'unstable') && drift === 'strengthening') {
      flow = 'turning';
      reasoning.push(
        step(
          'TURNING',
          'Near-term dasha (PD) trends favorable while the outer verdict does not — current is turning',
        ),
      );
    }
  }

  // ── Interference: retrograde/combust on the decisive witnesses ─────────────
  const decisive = new Set<Planet>([moonSubLord, 'Jupiter', 'Venus']);
  const interference = Array.from(
    new Set<Planet>([
      ...retrogradeFlags.filter(p => decisive.has(p)),
      ...combustFlags.filter(
        p => confirmedSignificators.includes(p) || deniedSignificators.includes(p),
      ),
    ]),
  );
  if (interference.length > 0) {
    reasoning.push(step('INTERFERENCE', `Interference from: ${interference.join(', ')}`));
  }

  // ── Label — most specific symbolic reading wins ────────────────────────────
  let label: string;
  if (flow === 'open' && drift === 'weakening') {
    label = 'current weakens after initial movement';
  } else if (flow === 'open' && interference.length > 0) {
    label = 'current is favorable but delayed';
  } else if (interference.length > 0) {
    label = 'current is pressured by interference';
  } else if (flow === 'turning') {
    label = 'current is turning';
  } else if (flow === 'open') {
    label = 'current is open';
  } else if (flow === 'blocked') {
    label = 'current is blocked';
  } else {
    label = 'current is unstable';
  }
  reasoning.push(step('LABEL', label));

  return {
    flow,
    drift,
    structural: false,
    interference: Object.freeze(interference),
    label,
    reasoning: Object.freeze(reasoning),
  };
}
