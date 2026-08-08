/**
 * kotamraju — Kotamraju Verification Filter.
 * --------------------------------------------------------------------------
 * Shared by BOTH judgment engines: a candidate witness planet is rejected
 * if ITS OWN sub-lord occupies a denial house. An advanced, legitimate KP
 * verification technique (docs/RKP_KP_FORENSIC_AUDIT.md §B: "a legitimate
 * and advanced KP verification step"), not an RKP-specific adaptation —
 * hence shared rather than duplicated per engine. Moved out of
 * judgeHorary.ts verbatim; no behavior change.
 */

import type { Chart, Planet } from '../../types/chart';
import { getSubLords } from '../../primitives/subLord';
import { houseOfPlanet } from './significations';

export function applyKotamrajuFilter(
  significators: readonly Planet[],
  favorable: readonly number[],
  denial: readonly number[],
  chart: Chart,
): Planet[] {
  void favorable;
  return significators.filter(planet => {
    const planetData = chart.planets[planet];
    if (planetData === undefined) {
      return false;
    }
    const subLord = getSubLords(planetData.siderealLongitude).subLord as Planet;
    const subLordHouse = houseOfPlanet(subLord, chart);
    return !denial.includes(subLordHouse);
  });
}
