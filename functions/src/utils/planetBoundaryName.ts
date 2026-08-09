/**
 * planetBoundaryName — shadow-node renaming at the server boundary.
 * --------------------------------------------------------------------------
 * Internally the engine computes with 'Rahu'/'Ketu' as the Planet identifiers
 * — the universal astronomical/KP convention, matched against the Meeus
 * ephemeris equations, the Vimshottari dasha sequence and every rule table in
 * `engine/rkp` and `engine/kp`. Nothing about that changes here; see
 * `engine/rkp/nomenclature.ts` for why cosmic markers are kept separate from
 * computation.
 *
 * This module is the ONLY place that translation happens for structured
 * (non-prose) fields: right before a Planet identifier leaves the server,
 * either in a callable's response or in a Firestore write. From that point on
 * — every new API payload and every new database record — the shadow nodes
 * are named exclusively by their classical Arabic/Urdu short forms, matching
 * the display form already used elsewhere (nomenclature.ts PLANET_NAME_SHORT).
 *
 * Only the two shadow nodes are remapped. The other seven planets cross the
 * boundary under their existing names — this is a scoped rename, not a
 * general re-keying of the Planet vocabulary.
 *
 * Free-text narration is untouched by this module: `engine/kp/judgment/
 * judgeHorary.ts` already renders every planet — nodes included — under its
 * classical Arabic name (`toArabic`) when composing prose, so narration
 * fields never carried 'Rahu'/'Ketu' to begin with.
 */

const SHADOW_NODE_BOUNDARY_NAME: Readonly<Record<string, string>> = Object.freeze({
  Rahu: 'Ras',
  Ketu: 'Dhanab',
});

/** Translate a single planet identifier at the boundary. Non-nodes pass through unchanged. */
export function toBoundaryPlanetName(planet: string): string {
  return SHADOW_NODE_BOUNDARY_NAME[planet] ?? planet;
}

/** Translate every entry of a planet-identifier array at the boundary. */
export function toBoundaryPlanetNames(planets: readonly string[]): string[] {
  return planets.map(toBoundaryPlanetName);
}

/**
 * Translate a Record keyed by planet identifier (e.g. planetDegrees,
 * planetChain) at the boundary — remaps both the key and, when provided, the
 * value through `mapValue`.
 */
export function toBoundaryPlanetRecord<T, U = T>(
  record: Readonly<Record<string, T>>,
  mapValue: (value: T) => U = value => value as unknown as U,
): Record<string, U> {
  const out: Record<string, U> = {};
  for (const [key, value] of Object.entries(record)) {
    out[toBoundaryPlanetName(key)] = mapValue(value);
  }
  return out;
}
