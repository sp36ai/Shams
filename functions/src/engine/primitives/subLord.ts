/**
 * KP Sub-lord and Sub-sub-lord calculation.
 * --------------------------------------------------------------------------
 * In KP astrology, each nakshatra (13°20') is sub-divided into 9 sub-portions
 * in the Vimshottari sequence, with each sub-lord's portion proportional to
 * its Mahadasha years out of 120.
 *
 * Sub-portion span = NAKSHATRA_SPAN_DEG × (planetYears / 120)
 *   e.g. Ketu sub-lord span = 13.333° × 7/120 = 0.7778°
 *        Venus sub-lord span = 13.333° × 20/120 = 2.2222°
 *        Sun   sub-lord span = 13.333° × 6/120  = 0.6667°
 *
 * The sub-sub-lord (SSL) applies the same logic recursively WITHIN each sub.
 *
 * The starting planet of each nakshatra's sub-sequence is the nakshatra lord
 * itself (not Ketu): Ashwini is owned by Ketu → subs start at Ketu.
 *                     Bharani is owned by Venus → subs start at Venus.
 *                     etc.
 *
 * Algorithm:
 *   1. Get nakshatra index from sidereal longitude.
 *   2. Nakshatra lord = NAKSHATRA_LORDS[index] (this is the starting sub-lord).
 *   3. Walk DASHA_SEQUENCE from the nakshatra lord, accumulating sub-span per
 *      planet, until we find which sub-lord "owns" the position within the nakshatra.
 *   4. For SSL: repeat step 3 within the sub-lord's sub-portion.
 *
 * References:
 *   - Krishnamurti, *KP Reader II* — sub-lord tables                 [KP]
 *   - docs/RKP_RULES_FROM_SARFARAZ.md §4
 */

import {
  DASHA_SEQUENCE,
  DASHA_YEARS,
  NAKSHATRA_SPAN_DEG,
  TOTAL_DASHA_YEARS,
  type Graha,
} from '../kp/rules/vimshottari';
import { nakshatraIndexFromLongitude, NAKSHATRA_LORDS } from '../kp/rules/nakshatras';
import { normalize360 } from './angles';

// ────────────────────────────────────────────────────────────────────────────
// Sub-portion geometry
// ────────────────────────────────────────────────────────────────────────────

/** Span of one sub-portion in degrees for a given planet. */
function subSpan(planet: Graha): number {
  return NAKSHATRA_SPAN_DEG * (DASHA_YEARS[planet] / TOTAL_DASHA_YEARS);
}

/** Span of a sub-sub-portion: fraction of the sub-lord's span. */
function subSubSpan(sub: Graha, subSub: Graha): number {
  return subSpan(sub) * (DASHA_YEARS[subSub] / TOTAL_DASHA_YEARS);
}

// ────────────────────────────────────────────────────────────────────────────
// Core sub-lord resolver
// ────────────────────────────────────────────────────────────────────────────

/**
 * Given a position within a nakshatra (as degrees offset from nakshatra start,
 * range [0, NAKSHATRA_SPAN_DEG)), and the starting planet of the sub-sequence,
 * walk the sub-portions to find which planet owns the position.
 *
 * @param withinNakshatra  Position within nakshatra, degrees [0, 13.333...)
 * @param startPlanet      The nakshatra lord (first sub-sequence planet)
 * @returns                Sub-lord planet
 */
function resolveSubLord(withinNakshatra: number, startPlanet: Graha): Graha {
  const startIdx = DASHA_SEQUENCE.indexOf(startPlanet);
  let accumulated = 0;

  for (let i = 0; i < 9; i++) {
    const planet = DASHA_SEQUENCE[(startIdx + i) % 9] as Graha;
    accumulated += subSpan(planet);
    if (withinNakshatra < accumulated) {
      return planet;
    }
  }
  // Floating-point safety: return last planet if we overshoot by epsilon
  return DASHA_SEQUENCE[(startIdx + 8) % 9] as Graha;
}

/**
 * Given a position within a sub-lord's span, resolve the sub-sub-lord.
 *
 * @param withinSub   Position within the sub-lord's span, degrees
 * @param subLord     The sub-lord (defines the span and starting planet for SSL)
 * @returns           Sub-sub-lord planet
 */
function resolveSubSubLord(withinSub: number, subLord: Graha): Graha {
  const startIdx = DASHA_SEQUENCE.indexOf(subLord);
  let accumulated = 0;

  for (let i = 0; i < 9; i++) {
    const planet = DASHA_SEQUENCE[(startIdx + i) % 9] as Graha;
    accumulated += subSubSpan(subLord, planet);
    if (withinSub < accumulated) {
      return planet;
    }
  }
  return DASHA_SEQUENCE[(startIdx + 8) % 9] as Graha;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export interface SubLordResult {
  /** Nakshatra index (0–26) */
  nakshatraIndex: number;
  /** Nakshatra lord */
  nakshatraLord: Graha;
  /** Sub-lord (KP significator layer 2) */
  subLord: Graha;
  /** Sub-sub-lord (KP significator layer 3) */
  subSubLord: Graha;
  /** Degrees within the nakshatra [0, 13.333...) */
  posInNakshatra: number;
  /** Degrees within the sub [0, subSpan) */
  posInSub: number;
}

/**
 * Compute nakshatra lord, sub-lord, and sub-sub-lord for a sidereal longitude.
 *
 * @param siderealLonDeg  Sidereal ecliptic longitude in degrees (Lahiri-corrected)
 * @returns               Full sub-lord analysis
 */
export function getSubLords(siderealLonDeg: number): SubLordResult {
  const lon = normalize360(siderealLonDeg);
  const nakshatraIndex = nakshatraIndexFromLongitude(lon);
  const nakshatraStart = nakshatraIndex * NAKSHATRA_SPAN_DEG;
  const posInNakshatra = lon - nakshatraStart;

  const nakshatraLord = NAKSHATRA_LORDS[nakshatraIndex];
  if (nakshatraLord === undefined) {
    throw new RangeError(`getSubLords: nakshatra index ${nakshatraIndex} out of range`);
  }

  const subLord = resolveSubLord(posInNakshatra, nakshatraLord);

  // Position within the sub-lord's span
  const subLordStartIdx = DASHA_SEQUENCE.indexOf(nakshatraLord);
  let subStart = 0;
  for (let i = 0; i < 9; i++) {
    const p = DASHA_SEQUENCE[(subLordStartIdx + i) % 9] as Graha;
    if (p === subLord) {
      break;
    }
    subStart += subSpan(p);
  }
  const posInSub = posInNakshatra - subStart;

  const subSubLord = resolveSubSubLord(posInSub, subLord);

  return {
    nakshatraIndex,
    nakshatraLord,
    subLord,
    subSubLord,
    posInNakshatra,
    posInSub,
  };
}
