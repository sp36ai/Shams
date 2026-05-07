/**
 * dasha.ts — Vimshottari Dasha primitives for RKP.
 * --------------------------------------------------------------------------
 * Implements the calculation of active Dasha, Antardasha, and Pratyantardasha
 * based on the Moon's sidereal longitude in the chart.
 */

import type { Chart, PlanetName } from '../../types/chart';
import { DASHA_SEQUENCE, DASHA_YEARS, TOTAL_DASHA_YEARS, NAKSHATRA_SPAN_DEG } from '../rules/vimshottari';

export interface DashaPeriod {
  mahadasha: PlanetName;
  antardasha: PlanetName;
  pratyantardasha: PlanetName;
}

/**
 * Calculates the active Vimshottari Dasha levels for a given chart.
 * In KP astrology, the lords at a specific longitude correspond to
 * the MD (Star Lord), AD (Sub Lord), and PD (Sub-Sub Lord).
 */
export function calculateDasha(chart: Chart): DashaPeriod {
  const moon = chart.planets.Moon;
  const longitude = moon.longitude;

  return {
    mahadasha: moon.starLord as PlanetName,
    antardasha: moon.subLord as PlanetName,
    pratyantardasha: calculateSubSubLord(longitude),
  };
}

/**
 * Calculates the sub-sub lord (Pratyantardasha level) for a given longitude.
 * KP divides each sub-lord's portion into 9 sub-sub portions proportionally.
 */
export function calculateSubSubLord(longitude: number): PlanetName {
  const lon = ((longitude % 360) + 360) % 360;
  const nakIdx = Math.floor(lon / NAKSHATRA_SPAN_DEG);
  const startLordIdx = nakIdx % 9;
  const degInNak = lon % NAKSHATRA_SPAN_DEG;

  let cumulativeSub = 0;
  for (let i = 0; i < 9; i++) {
    const subLordIdx = (startLordIdx + i) % 9;
    const subLord = DASHA_SEQUENCE[subLordIdx];
    const subSpan = NAKSHATRA_SPAN_DEG * (DASHA_YEARS[subLord] / TOTAL_DASHA_YEARS);

    if (degInNak >= cumulativeSub && degInNak < cumulativeSub + subSpan) {
      const degInSub = degInNak - cumulativeSub;
      let cumulativeSubSub = 0;
      for (let j = 0; j < 9; j++) {
        const subSubLordIdx = (subLordIdx + j) % 9;
        const subSubLord = DASHA_SEQUENCE[subSubLordIdx];
        const subSubSpan = subSpan * (DASHA_YEARS[subSubLord] / TOTAL_DASHA_YEARS);

        if (degInSub >= cumulativeSubSub && degInSub < cumulativeSubSub + subSubSpan) {
          return subSubLord as PlanetName;
        }
        cumulativeSubSub += subSubSpan;
      }
      return DASHA_SEQUENCE[(subLordIdx + 8) % 9] as PlanetName;
    }
    cumulativeSub += subSpan;
  }
  return DASHA_SEQUENCE[(startLordIdx + 8) % 9] as PlanetName;
}