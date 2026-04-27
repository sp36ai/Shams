/**
 * ════════════════════════════════════════════════════════════════════
 * Vimshottari Dasha Constants
 * ════════════════════════════════════════════════════════════════════
 *
 * Source of truth: docs/RKP_RULES_FROM_SARFARAZ.md §3
 *
 * USED BY: Phase 2 (dasha calc primitive), Phase 3 (timing layer).
 *
 * ════════════════════════════════════════════════════════════════════
 */

export type Graha =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu';

/** Vimshottari sequence — order matters. Cycle starts at Ketu. */
export const DASHA_SEQUENCE: readonly Graha[] = Object.freeze([
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
]) as readonly Graha[];

/** Mahadasha length per planet, in solar years. */
export const DASHA_YEARS: Readonly<Record<Graha, number>> = Object.freeze({
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
});

/** Total Vimshottari cycle length in years. */
export const TOTAL_DASHA_YEARS = 120;

/** Span of one nakshatra in degrees. 360 / 27. */
export const NAKSHATRA_SPAN_DEG = 360 / 27;

/**
 * Sub-lord proportions: each nakshatra is divided into 9 sub-portions
 * in the same Vimshottari sequence, with portion-length proportional
 * to the dasha years of that planet.
 *
 * portion_deg = NAKSHATRA_SPAN_DEG * (DASHA_YEARS[planet] / TOTAL_DASHA_YEARS)
 *
 * Used by: getSubLord(longitudeDeg) in Phase 2.
 */
export function subPortionDeg(planet: Graha): number {
  return NAKSHATRA_SPAN_DEG * (DASHA_YEARS[planet] / TOTAL_DASHA_YEARS);
}

/** Returns the planet that comes immediately after `planet` in the Vimshottari cycle. */
export function nextInDasha(planet: Graha): Graha {
  const idx = DASHA_SEQUENCE.indexOf(planet);
  if (idx === -1) {
    throw new Error(`[vimshottari] Unknown planet in DASHA_SEQUENCE: ${planet}`);
  }
  const nextIdx = (idx + 1) % DASHA_SEQUENCE.length;
  // Safe because nextIdx is always a valid index of a frozen non-empty array.
  return DASHA_SEQUENCE[nextIdx] as Graha;
}
