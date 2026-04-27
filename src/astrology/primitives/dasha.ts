/**
 * Vimshottari Dasha calculator — MD / AD / PD periods.
 * --------------------------------------------------------------------------
 * The Vimshottari system assigns 120 years of dashas to the 9 planets.
 * The birth nakshatra of the Moon determines which dasha is running at birth
 * and how far into it the native is (balance of dasha).
 *
 * For KP horary (not natal), the moon position AT THE TIME OF THE QUESTION
 * determines the dasha balance. This is the "horary chart" convention.
 *
 * Calculation steps:
 *   1. Get Moon's sidereal longitude at question time.
 *   2. Identify nakshatra → nakshatra lord = current Mahadasha lord.
 *   3. Fraction elapsed within nakshatra → fraction of that MD elapsed.
 *   4. Calculate MD start/end dates.
 *   5. Sub-divide each MD into 9 ADs proportional to years.
 *   6. PDs (Pratyantardasha) = same proportional sub-division of each AD.
 *
 * Time unit: KP uses solar year = 365.25 days (VIMSHOTTARI_DAYS_PER_YEAR).
 *
 * References:
 *   - Krishnamurti, *KP Reader I & II*
 *   - docs/RKP_RULES_FROM_SARFARAZ.md §3
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
import { VIMSHOTTARI_DAYS_PER_YEAR } from './constants';

// ────────────────────────────────────────────────────────────────────────────
// Period interfaces
// ────────────────────────────────────────────────────────────────────────────

export interface DashaPeriod {
  lord: Graha;
  /** Period start as JS Date */
  start: Date;
  /** Period end as JS Date */
  end: Date;
  /** Period length in days */
  lengthDays: number;
}

export interface VimshottariDasha {
  /** Moon's sidereal longitude used for the calculation */
  moonSiderealLon: number;
  /** Current MD (Mahadasha) */
  mahadasha: DashaPeriod;
  /** All 9 Antardashas (sub-periods) within the current MD */
  antardashas: DashaPeriod[];
  /** Current Antardasha (active AD at the question moment) */
  currentAntardasha: DashaPeriod;
  /** All 9 Pratyantar dashas within the current AD */
  pratyantar: DashaPeriod[];
  /** Current Pratyantar (active PD at the question moment) */
  currentPratyantar: DashaPeriod;
}

// ────────────────────────────────────────────────────────────────────────────
// Core calculation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Vimshottari Dasha for a given Moon sidereal longitude and moment.
 *
 * @param moonSiderealLon  Moon's sidereal longitude in degrees (Lahiri)
 * @param momentMs         Unix epoch ms for the question/birth moment
 * @returns                Full dasha tree for that moment
 */
export function calculateDasha(moonSiderealLon: number, momentMs: number): VimshottariDasha {
  const lon = normalize360(moonSiderealLon);
  const nakshatraIndex = nakshatraIndexFromLongitude(lon);

  const nakshatraLord = NAKSHATRA_LORDS[nakshatraIndex];
  if (nakshatraLord === undefined) {
    throw new RangeError(`calculateDasha: nakshatra index ${nakshatraIndex} out of range`);
  }

  // Fraction elapsed within the current nakshatra
  const nakshatraStart = nakshatraIndex * NAKSHATRA_SPAN_DEG;
  const posInNakshatra = lon - nakshatraStart;
  const fractionElapsed = posInNakshatra / NAKSHATRA_SPAN_DEG; // [0, 1)

  // Balance of dasha at the moment (fraction remaining × total MD years)
  const mdLord = nakshatraLord;
  const mdTotalDays = DASHA_YEARS[mdLord] * VIMSHOTTARI_DAYS_PER_YEAR;
  const mdElapsedDays = fractionElapsed * mdTotalDays;
  const mdStartMs = momentMs - mdElapsedDays * 86400_000;
  const mdEndMs = mdStartMs + mdTotalDays * 86400_000;

  const mahadasha: DashaPeriod = {
    lord: mdLord,
    start: new Date(mdStartMs),
    end: new Date(mdEndMs),
    lengthDays: mdTotalDays,
  };

  // Build all 9 Antardashas within this MD
  const mdSeqStart = DASHA_SEQUENCE.indexOf(mdLord);
  const antardashas: DashaPeriod[] = [];
  let adCursor = mdStartMs;

  for (let i = 0; i < 9; i++) {
    const adLord = DASHA_SEQUENCE[(mdSeqStart + i) % 9] as Graha;
    const adDays = mdTotalDays * (DASHA_YEARS[adLord] / TOTAL_DASHA_YEARS);
    const adEndMs = adCursor + adDays * 86400_000;
    antardashas.push({
      lord: adLord,
      start: new Date(adCursor),
      end: new Date(adEndMs),
      lengthDays: adDays,
    });
    adCursor = adEndMs;
  }

  // Current AD = the one that contains momentMs
  const currentAntardasha =
    antardashas.find(ad => ad.start.getTime() <= momentMs && momentMs < ad.end.getTime()) ??
    (antardashas[antardashas.length - 1] as DashaPeriod);

  // Build all 9 Pratyantar dashas within the current AD
  const adSeqStart = DASHA_SEQUENCE.indexOf(currentAntardasha.lord);
  const adDays = currentAntardasha.lengthDays;
  const pratyantar: DashaPeriod[] = [];
  let pdCursor = currentAntardasha.start.getTime();

  for (let i = 0; i < 9; i++) {
    const pdLord = DASHA_SEQUENCE[(adSeqStart + i) % 9] as Graha;
    const pdDays = adDays * (DASHA_YEARS[pdLord] / TOTAL_DASHA_YEARS);
    const pdEndMs = pdCursor + pdDays * 86400_000;
    pratyantar.push({
      lord: pdLord,
      start: new Date(pdCursor),
      end: new Date(pdEndMs),
      lengthDays: pdDays,
    });
    pdCursor = pdEndMs;
  }

  const currentPratyantar =
    pratyantar.find(pd => pd.start.getTime() <= momentMs && momentMs < pd.end.getTime()) ??
    (pratyantar[pratyantar.length - 1] as DashaPeriod);

  return {
    moonSiderealLon: lon,
    mahadasha,
    antardashas,
    currentAntardasha,
    pratyantar,
    currentPratyantar,
  };
}
