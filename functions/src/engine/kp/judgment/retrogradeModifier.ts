/**
 * retrogradeModifier — shared KP doctrine: the DELAYED modifier.
 * --------------------------------------------------------------------------
 * Shared by BOTH judgment engines: a YES verdict becomes DELAYED when the
 * Moon's sub-lord, Jupiter, or Venus is retrograde at the chart moment —
 * the matter is still promised but its arrival is obstructed. This is
 * established KP behaviour (docs/RKP_KP_FORENSIC_AUDIT.md §A/§C: "Retrograde
 * modifier... correct KP behavior"), not an RKP-specific adaptation, hence
 * shared rather than duplicated per engine.
 */

import type { Chart, Planet } from '../../types/chart';
import type { VerdictKind } from '../../types/verdict';

export interface RetrogradeDelayResult {
  readonly verdict: VerdictKind;
  readonly retrogradeWitnesses: readonly Planet[];
  /** Human-readable summary of which planet(s) triggered the delay, if any. */
  readonly note?: string;
}

/**
 * Applies the DELAYED modifier: a YES verdict becomes DELAYED when the
 * Moon's sub-lord, Jupiter, or Venus is retrograde at the chart moment.
 * Non-YES verdicts pass through unchanged.
 */
export function applyRetrogradeDelay(
  verdict: VerdictKind,
  chart: Chart,
  moonSubLord: Planet,
): RetrogradeDelayResult {
  if (verdict !== 'YES') {
    return { verdict, retrogradeWitnesses: [] };
  }

  const mslRetro = chart.planets[moonSubLord].isRetrograde;
  const jupRetro = chart.planets.Jupiter.isRetrograde;
  const venRetro = chart.planets.Venus.isRetrograde;

  if (!mslRetro && !jupRetro && !venRetro) {
    return { verdict, retrogradeWitnesses: [] };
  }

  const witnesses: Planet[] = [];
  if (mslRetro) {
    witnesses.push(moonSubLord);
  }
  if (jupRetro) {
    witnesses.push('Jupiter');
  }
  if (venRetro) {
    witnesses.push('Venus');
  }

  const who = [mslRetro && `${moonSubLord}(MSL)`, jupRetro && 'Jupiter', venRetro && 'Venus']
    .filter(Boolean)
    .join(', ');

  return {
    verdict: 'DELAYED',
    retrogradeWitnesses: witnesses,
    note: `retrograde planet(s): ${who}`,
  };
}
