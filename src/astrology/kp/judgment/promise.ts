/**
 * promise — KP Promise Layer (Step 0).
 * --------------------------------------------------------------------------
 * Shared by BOTH judgment engines (RKP: judgeHorary.ts, classical KP:
 * judgeKP.ts): the sub-lord of the PRIMARY cusp must NOT occupy a denial
 * house. If it does, the chart itself cannot deliver an answer regardless
 * of planetary positions — the matter is DENIED before any
 * scoring/significator analysis begins.
 *
 * This is genuine, doctrine-level KP — "the promise layer... what makes KP
 * different from everything else" (docs/RKP_KP_FORENSIC_AUDIT.md §A) — not
 * an RKP-specific adaptation, which is why it lives here once instead of
 * being duplicated per engine. Moved out of judgeHorary.ts verbatim; no
 * behavior change.
 */

import type { Chart, Planet, HouseIndex } from '@astrology/types/chart';
import { houseOfPlanet } from './significations';

export type PromiseCheckResult =
  | { readonly denied: false }
  | {
      readonly denied: true;
      readonly cuspHouse: number;
      readonly cuspSubLord: Planet;
      readonly cuspSubLordHouse: HouseIndex;
    };

/**
 * KP promise check: the sub-lord of the PRIMARY cusp must NOT occupy a
 * denial house. If it does, the chart itself cannot deliver an answer
 * regardless of planetary positions — return DENIED before any scoring.
 */
export function checkPromise(
  chart: Chart,
  denial: readonly number[],
  primary: number,
): PromiseCheckResult {
  const primaryCusp = chart.cusps[primary - 1];
  if (primaryCusp === undefined) {
    return { denied: false };
  }

  const cuspSubLord = primaryCusp.subLord as Planet;
  const cuspSubLordHouse = houseOfPlanet(cuspSubLord, chart);

  if ((denial as number[]).includes(cuspSubLordHouse)) {
    return { denied: true, cuspHouse: primary, cuspSubLord, cuspSubLordHouse };
  }
  return { denied: false };
}
