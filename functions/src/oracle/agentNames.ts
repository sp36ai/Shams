/**
 * agentNames.ts — how the obstructing agent is NAMED to the seeker.
 * --------------------------------------------------------------------------
 * `diagnosis.obstructingAgent` is documented as a display name (see
 * engine/rkp/diagnosis.ts) but carries the engine's raw identifier: 'Saturn',
 * 'Mars', the boundary short forms 'Ras' / 'Dhanab' (utils/planetBoundaryName),
 * or the non-planet 'MoonDisagreement'. Passed through untouched, that put
 * "Mars is the obstructing influence" and "MoonDisagreement" in front of
 * seekers and in the narrator's brief, while every other surface of the app
 * says Mirrikh, Zuhal and Qamar (audit 2026-10-15).
 *
 * This only changes how a name is SPOKEN. The engine value, the reading
 * contract and the validator's allow-lists are untouched. Names come from the
 * engine's own nomenclature (PLANET_NAME_SHORT, PLANET_ARCHETYPE), so every
 * one is already in narrationValidator's PLANET_ALIASES for the same body.
 */

import type { Planet } from '../engine/types/chart';
import { PLANET_ARCHETYPE, PLANET_NAME_SHORT } from '../engine/rkp/nomenclature';

const SHADOW_NODES: ReadonlySet<Planet> = new Set<Planet>(['Rahu', 'Ketu']);

/** The Planet an obstructing-agent value refers to, or null if none. */
function planetOf(agent: string): Planet | null {
  if (agent === 'MoonDisagreement') {
    return 'Moon'; // an affliction OF the Moon, not a separate body
  }
  if (agent === 'Ras') {
    return 'Rahu';
  }
  if (agent === 'Dhanab') {
    return 'Ketu';
  }
  return agent in PLANET_NAME_SHORT ? (agent as Planet) : null;
}

/** Short classical name for the narrator's brief ("Mirrikh"), or null for none. */
export function agentShortName(agent: string | null): string | null {
  if (agent === null) {
    return null;
  }
  const planet = planetOf(agent);
  return planet === null ? agent : PLANET_NAME_SHORT[planet];
}

/**
 * The name with its sense, for seeker-facing prose a reader may not know the
 * term in: "Zuhal, the star of delay", "Dhanab, the shadow point of separation".
 */
export function agentGlossedName(agent: string | null): string | null {
  if (agent === null) {
    return null;
  }
  const planet = planetOf(agent);
  if (planet === null) {
    return agent;
  }
  const kind = SHADOW_NODES.has(planet) ? 'shadow point' : 'star';
  return `${PLANET_NAME_SHORT[planet]}, the ${kind} of ${PLANET_ARCHETYPE[planet].toLowerCase()}`;
}
