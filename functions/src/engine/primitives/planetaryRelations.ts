/**
 * planetaryRelations — natural planetary friendship / enmity (naisargika maitri).
 * --------------------------------------------------------------------------
 * Required by the RKP triad protocol: "Evaluate the relationship between the
 * 1st House Ruler and the Target House Ruler. Enemy Relationship (e.g. Sun
 * vs. Saturn): hard bureaucratic delay, rigid rules, refusal to adjust.
 * Friendly Relationship (e.g. Moon vs. Jupiter): swift resolution,
 * unexpected support."
 *
 * PROVENANCE: the RKP material supplies the RULE and two worked examples
 * (Sun/Saturn = enemies, Moon/Jupiter = friendly) but not the full 7x7
 * table. The table below is the standard classical naisargika-maitri set
 * (Brihat Parashara Hora Shastra), which is undisputed across sources and
 * reproduces both supplied examples exactly. It is a CONFIRMED CLASSICAL
 * DEFAULT applied to the RKP framework, in the same way the dignity /
 * drishti toolkit in judgeRKPWatch.ts is — not itself sourced from the RKP
 * documents. See docs/RKP_WATCH_ENGINE.md.
 *
 * ASYMMETRY: the classical table is directional — Jupiter counts Moon a
 * friend while Moon counts Jupiter neutral. RKP asks about the relationship
 * BETWEEN two rulers, i.e. a single mutual verdict, so relationBetween()
 * combines the two directions (see its docstring). That combination is what
 * makes Moon/Jupiter come out "friendly" as the source material states.
 *
 * RAHU / KETU: classical texts do not agree on natural friendships for the
 * shadow grahas, and the RKP material gives none. They are therefore
 * NEUTRAL to everything here rather than assigned invented relationships.
 * Their malefic effect on the triad is captured separately (rkpTriad.ts
 * treats Rahu/Ketu/Mars affliction of the target and 11th houses as its own
 * blocking condition, which is exactly how the source material uses them).
 */

import type { Planet } from '../types/chart';

export type PlanetaryRelation = 'friend' | 'neutral' | 'enemy';

/** Directional classical table: FRIENDS_OF[a] = planets that `a` regards as friends. */
const FRIENDS_OF: Readonly<Record<Planet, readonly Planet[]>> = Object.freeze({
  Sun: ['Moon', 'Mars', 'Jupiter'],
  Moon: ['Sun', 'Mercury'],
  Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'],
  Jupiter: ['Sun', 'Moon', 'Mars'],
  Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus'],
  Rahu: [],
  Ketu: [],
});

/** Directional classical table: ENEMIES_OF[a] = planets that `a` regards as enemies. */
const ENEMIES_OF: Readonly<Record<Planet, readonly Planet[]>> = Object.freeze({
  Sun: ['Venus', 'Saturn'],
  Moon: [],
  Mars: ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'],
  Venus: ['Sun', 'Moon'],
  Saturn: ['Sun', 'Moon', 'Mars'],
  Rahu: [],
  Ketu: [],
});

/** How `from` regards `to`, one direction only. */
export function relationFrom(from: Planet, to: Planet): PlanetaryRelation {
  if (FRIENDS_OF[from].includes(to)) {
    return 'friend';
  }
  if (ENEMIES_OF[from].includes(to)) {
    return 'enemy';
  }
  return 'neutral';
}

/**
 * The mutual relationship between two planets — what RKP's ruler-clash test
 * actually asks for.
 *
 * Combination rule (deterministic, and chosen so both examples the source
 * material gives come out right):
 *   - either side calls the other an ENEMY  -> 'enemy'   (Sun/Saturn: both do)
 *   - otherwise either side calls the other a FRIEND -> 'friend'
 *     (Moon/Jupiter: Jupiter counts Moon a friend, Moon counts Jupiter
 *      neutral -> friendly, as the source material states)
 *   - otherwise -> 'neutral'
 *
 * Enmity dominating friendship reflects the source material's own emphasis:
 * a clash between the querent's ruler and the matter's ruler is described as
 * the decisive obstruction, not something a one-sided friendship cancels.
 *
 * A planet compared with itself (the same planet ruling both houses —
 * e.g. Mercury ruling Gemini and Virgo) is 'friend': one hand governing both
 * ends of the matter is the absence of a clash.
 */
export function relationBetween(a: Planet, b: Planet): PlanetaryRelation {
  if (a === b) {
    return 'friend';
  }
  if (relationFrom(a, b) === 'enemy' || relationFrom(b, a) === 'enemy') {
    return 'enemy';
  }
  if (relationFrom(a, b) === 'friend' || relationFrom(b, a) === 'friend') {
    return 'friend';
  }
  return 'neutral';
}
