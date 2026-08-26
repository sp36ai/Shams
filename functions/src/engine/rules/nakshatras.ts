/**
 * ════════════════════════════════════════════════════════════════════
 * Nakshatras (Lunar Mansions) — Names + Lords (Vimshottari order)
 * ════════════════════════════════════════════════════════════════════
 *
 * Source of truth: docs/RKP_RULES_FROM_SARFARAZ.md §4
 *
 * 27 nakshatras span the 360° zodiac. Each spans 13°20' (NAKSHATRA_SPAN_DEG).
 * Lord sequence is Vimshottari (Ketu → Mercury), repeating every 9.
 *
 * USED BY: Phase 2 (nakshatra/sub-lord primitives), Phase 3 (significators).
 *
 * ════════════════════════════════════════════════════════════════════
 */

import type { Graha } from './vimshottari';
import { DASHA_SEQUENCE, NAKSHATRA_SPAN_DEG } from './vimshottari';

export const NAKSHATRAS: readonly string[] = Object.freeze([
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishtha',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
]);

if (NAKSHATRAS.length !== 27) {
  throw new Error(`[nakshatras] Expected 27 entries, got ${NAKSHATRAS.length}`);
}

/**
 * Lord of each nakshatra, in NAKSHATRAS index order.
 * Built from DASHA_SEQUENCE so the two stay in sync — single source of truth.
 */
export const NAKSHATRA_LORDS: readonly Graha[] = Object.freeze(
  Array.from({ length: 27 }, (_, i) => DASHA_SEQUENCE[i % DASHA_SEQUENCE.length] as Graha),
);

/**
 * Returns nakshatra index (0–26) for a given sidereal longitude in degrees.
 * Caller is responsible for converting tropical → sidereal (apply ayanamsa).
 */
export function nakshatraIndexFromLongitude(siderealLonDeg: number): number {
  const lon = ((siderealLonDeg % 360) + 360) % 360;
  return Math.floor(lon / NAKSHATRA_SPAN_DEG);
}

/**
 * Pada (1–4) within the current nakshatra for a given sidereal longitude.
 * Each pada spans 3°20' (NAKSHATRA_SPAN_DEG / 4).
 */
export function padaFromLongitude(siderealLonDeg: number): 1 | 2 | 3 | 4 {
  const lon = ((siderealLonDeg % 360) + 360) % 360;
  const within = lon % NAKSHATRA_SPAN_DEG;
  const padaSpan = NAKSHATRA_SPAN_DEG / 4;
  const idx = Math.floor(within / padaSpan);
  // Clamp safety against floating-point drift.
  const clamped = Math.min(3, Math.max(0, idx));
  return (clamped + 1) as 1 | 2 | 3 | 4;
}

export interface NakshatraInfo {
  readonly index: number;
  readonly name: string;
  readonly lord: Graha;
  readonly pada: 1 | 2 | 3 | 4;
}

export function nakshatraInfo(siderealLonDeg: number): NakshatraInfo {
  const index = nakshatraIndexFromLongitude(siderealLonDeg);
  const name = NAKSHATRAS[index];
  const lord = NAKSHATRA_LORDS[index];
  if (name === undefined || lord === undefined) {
    throw new Error(`[nakshatras] Index out of range: ${index} (lon=${siderealLonDeg})`);
  }
  return {
    index,
    name,
    lord,
    pada: padaFromLongitude(siderealLonDeg),
  };
}
