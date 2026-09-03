/**
 * Node Resolution Engine: Rahu/Ketu as Cosmic Proxies
 *
 * In the Shams Method, Rahu (North Node) and Ketu (South Node) are "Shadow Entities"
 * without physical mass or inherent zodiacal ownership. They operate as Cosmic Proxies—
 * absorbing, amplifying, and executing the agendas of other planets.
 *
 * Core Principle: A Node is ALWAYS STRONGER than the planet it represents.
 * (The "Eclipse Override Rule")
 *
 * Ref: docs/EVENT_FORMULATION_MATRIX.md § 7
 */

import type { Planet, HouseIndex } from '@astrology/types/chart';
import type { WatchChart } from './watchChart';

/**
 * The 4-tier Proxy Resolution Hierarchy.
 *
 * When a Node appears in evaluation, the engine scans this hierarchy
 * from top to bottom, accumulating significations at each active level.
 */
export type ProxyResolutionTier =
  | 'CONJUNCTION'
  | 'ASPECT'
  | 'SIGN_LORD'
  | 'STAR_LORD'
  | 'BASE_OCCUPATION';

/**
 * Complete node evaluation result with full proxy array.
 */
export interface NodeResolutionResult {
  /** The node being evaluated (Rahu or Ketu) */
  node: 'Rahu' | 'Ketu';

  /** House the node physically occupies (Level B) */
  baseOccupation: HouseIndex;

  /** All houses signified by the node via full proxy resolution */
  signifiedHouses: HouseIndex[];

  /** Breakdown by resolution tier (for debugging) */
  tierBreakdown: {
    baseOccupation: HouseIndex[];
    conjunction: HouseIndex[];
    aspect: HouseIndex[];
    signLord: HouseIndex[];
    starLord: HouseIndex[];
  };

  /** Planets contributing to proxy array */
  proxyPlanets: {
    tier: ProxyResolutionTier;
    planet: Planet;
    contributes: HouseIndex[];
  }[];

  /** Eclipse Override active? (Node stronger than proxied planets) */
  eclipseOverrideActive: boolean;

  /** Event character modifier when node is operative */
  eventCharacter: 'SUDDEN' | 'UNEXPECTED' | 'TRANSFORMATIVE' | 'COMPOUND' | 'WILDCARD' | 'STANDARD';

  /** Composite "multi-house trigger" strength */
  triggerStrength: 'MASSIVE' | 'VERY_STRONG' | 'STRONG' | 'MODERATE';
}

/**
 * Node evaluation in a specific multi-vector judgment context.
 *
 * If CSL, Star-Lord, or Sub-Lord is a Node, this provides full signification.
 */
export interface NodeInJudgmentContext {
  /** Whether the CSL itself is a Node */
  cslIsNode: boolean;

  /** Whether the Star Lord is a Node */
  starLordIsNode: boolean;

  /** Whether the Sub-Lord is a Node */
  subLordIsNode: boolean;

  /** Full signification array for CSL (if it's a Node) */
  cslSignifications?: HouseIndex[];

  /** Full signification array for Star Lord (if it's a Node) */
  starLordSignifications?: HouseIndex[];

  /** Full signification array for Sub-Lord (if it's a Node) */
  subLordSignifications?: HouseIndex[];

  /** Eclipse Override active at any level? */
  eclipseOverrideActive: boolean;

  /** Combined event character modification */
  eventCharacterModifier: 'SUDDEN_UNEXPECTED_TRANSFORMATIVE' | 'STANDARD';
}

/**
 * Main entry point: Resolve a Node's complete signification array.
 *
 * Implements the recursive 4-tier hierarchy for node proxy resolution.
 */
export function resolveNodeSignifications(node: Planet, chart: WatchChart): NodeResolutionResult {
  if (node.name !== 'Rahu' && node.name !== 'Ketu') {
    throw new Error(`resolveNodeSignifications: Expected Rahu or Ketu, got ${node.name}`);
  }

  const nodeName = node.name as 'Rahu' | 'Ketu';
  const signifiedHouses = new Set<HouseIndex>();
  const tierBreakdown: NodeResolutionResult['tierBreakdown'] = {
    baseOccupation: [],
    conjunction: [],
    aspect: [],
    signLord: [],
    starLord: [],
  };
  const proxyPlanets: NodeResolutionResult['proxyPlanets'] = [];

  // Base Level (Level B): The house the Node occupies
  const baseHouse = node.house as HouseIndex;
  signifiedHouses.add(baseHouse);
  tierBreakdown.baseOccupation.push(baseHouse);

  // Priority 1: Conjunction (Absorb occupant's owned/occupied houses)
  const conjunctPlanets = chart.getConjoinedPlanets(node);
  for (const planet of conjunctPlanets) {
    const planetHouses = getBasePlanetSignifications(planet, chart);
    for (const h of planetHouses) {
      signifiedHouses.add(h);
      tierBreakdown.conjunction.push(h);
    }
    proxyPlanets.push({
      tier: 'CONJUNCTION',
      planet,
      contributes: planetHouses,
    });
  }

  // Priority 2: Aspect (Absorb aspecting planet's owned/occupied houses)
  const aspectingPlanets = chart.getAspectingPlanets(node);
  for (const planet of aspectingPlanets) {
    const planetHouses = getBasePlanetSignifications(planet, chart);
    for (const h of planetHouses) {
      signifiedHouses.add(h);
      tierBreakdown.aspect.push(h);
    }
    proxyPlanets.push({
      tier: 'ASPECT',
      planet,
      contributes: planetHouses,
    });
  }

  // Priority 3: Sign Lord (Absorb sign ruler's owned/occupied houses)
  const signLord = chart.getSignLord(node.sign);
  if (signLord.name !== 'Rahu' && signLord.name !== 'Ketu') {
    // If sign lord is not a Node, get its significations
    const signLordHouses = getBasePlanetSignifications(signLord, chart);
    for (const h of signLordHouses) {
      signifiedHouses.add(h);
      tierBreakdown.signLord.push(h);
    }
    proxyPlanets.push({
      tier: 'SIGN_LORD',
      planet: signLord,
      contributes: signLordHouses,
    });
  } else {
    // If sign lord is also a Node, recursively resolve it
    const recursiveResult = resolveNodeSignifications(signLord, chart);
    for (const h of recursiveResult.signifiedHouses) {
      signifiedHouses.add(h);
      tierBreakdown.signLord.push(h);
    }
    proxyPlanets.push({
      tier: 'SIGN_LORD',
      planet: signLord,
      contributes: Array.from(recursiveResult.signifiedHouses),
    });
  }

  // Priority 4: Star Lord (Absorb star ruler's significations)
  const starLord = chart.getStarLord(node.nakshatra);
  if (starLord.name !== 'Rahu' && starLord.name !== 'Ketu') {
    // If star lord is not a Node, get its significations
    const starLordHouses = getBasePlanetSignifications(starLord, chart);
    for (const h of starLordHouses) {
      signifiedHouses.add(h);
      tierBreakdown.starLord.push(h);
    }
    proxyPlanets.push({
      tier: 'STAR_LORD',
      planet: starLord,
      contributes: starLordHouses,
    });
  } else {
    // If star lord is also a Node, recursively resolve it
    const recursiveResult = resolveNodeSignifications(starLord, chart);
    for (const h of recursiveResult.signifiedHouses) {
      signifiedHouses.add(h);
      tierBreakdown.starLord.push(h);
    }
    proxyPlanets.push({
      tier: 'STAR_LORD',
      planet: starLord,
      contributes: Array.from(recursiveResult.signifiedHouses),
    });
  }

  // Determine trigger strength and event character
  const houseCount = signifiedHouses.size;
  let triggerStrength: 'MASSIVE' | 'VERY_STRONG' | 'STRONG' | 'MODERATE';
  if (houseCount >= 7) {
    triggerStrength = 'MASSIVE';
  } else if (houseCount >= 5) {
    triggerStrength = 'VERY_STRONG';
  } else if (houseCount >= 3) {
    triggerStrength = 'STRONG';
  } else {
    triggerStrength = 'MODERATE';
  }

  // Eclipse Override: Active if Node is proxying multiple planets
  const eclipseOverrideActive = proxyPlanets.length >= 2;

  // Event character: Modified by node's unpredictable nature
  let eventCharacter:
    | 'SUDDEN'
    | 'UNEXPECTED'
    | 'TRANSFORMATIVE'
    | 'COMPOUND'
    | 'WILDCARD'
    | 'STANDARD';
  if (proxyPlanets.length >= 4) {
    eventCharacter = 'COMPOUND'; // Node firing 4+ planets
  } else if (proxyPlanets.length >= 3) {
    eventCharacter = 'WILDCARD';
  } else if (eclipseOverrideActive) {
    eventCharacter = 'TRANSFORMATIVE';
  } else if (triggerStrength === 'MASSIVE' || triggerStrength === 'VERY_STRONG') {
    eventCharacter = 'UNEXPECTED';
  } else {
    eventCharacter = 'SUDDEN';
  }

  return {
    node: nodeName,
    baseOccupation,
    signifiedHouses: Array.from(signifiedHouses).sort((a, b) => a - b),
    tierBreakdown,
    proxyPlanets,
    eclipseOverrideActive,
    eventCharacter,
    triggerStrength,
  };
}

/**
 * Get a standard planet's base significations (owned + occupied houses).
 *
 * Does not recursively resolve Nodes.
 */
function getBasePlanetSignifications(planet: Planet, chart: WatchChart): HouseIndex[] {
  const owned = chart.getOwnedHouses(planet);
  const occupied = planet.house ? [planet.house as HouseIndex] : [];

  const combined = new Set([...owned, ...occupied]);
  return Array.from(combined).sort((a, b) => a - b);
}

/**
 * Get Star-Lord result, with Node resolution if needed.
 *
 * When evaluating a planet's Star Lord, check if it's a Node.
 * If so, resolve its full proxy array.
 */
export function getStarLordResult(
  planet: Planet,
  chart: WatchChart,
): {
  isNode: boolean;
  significations: HouseIndex[];
} {
  const stl = chart.getStarLord(planet.nakshatra);

  if (stl.name === 'Rahu' || stl.name === 'Ketu') {
    // Star Lord is a Node; resolve its full proxy array
    const resolution = resolveNodeSignifications(stl, chart);
    return {
      isNode: true,
      significations: resolution.signifiedHouses,
    };
  } else {
    // Standard planet; return base significations
    return {
      isNode: false,
      significations: getBasePlanetSignifications(stl, chart),
    };
  }
}

/**
 * Evaluate a Node in the context of a multi-vector judgment.
 *
 * Checks whether CSL, Star Lord, or Sub-Lord is a Node and resolves accordingly.
 * Applies Eclipse Override if multiple nodes or node proxying.
 */
export function evaluateNodeInJudgment(
  cslPlanet: Planet,
  chart: WatchChart,
): NodeInJudgmentContext {
  let cslIsNode = false;
  let cslSignifications: HouseIndex[] | undefined;

  let starLordIsNode = false;
  let starLordSignifications: HouseIndex[] | undefined;

  let subLordIsNode = false;
  let subLordSignifications: HouseIndex[] | undefined;

  let eclipseOverrideActive = false;

  // Step 1: Check if CSL itself is a Node
  if (cslPlanet.name === 'Rahu' || cslPlanet.name === 'Ketu') {
    cslIsNode = true;
    const resolution = resolveNodeSignifications(cslPlanet, chart);
    cslSignifications = resolution.signifiedHouses;
    if (resolution.eclipseOverrideActive) {
      eclipseOverrideActive = true;
    }
  }

  // Step 2: Check if Star Lord is a Node
  const stlResult = getStarLordResult(cslPlanet, chart);
  if (stlResult.isNode) {
    starLordIsNode = true;
    starLordSignifications = stlResult.significations;
    eclipseOverrideActive = true;
  }

  // Step 3: Check if Sub-Lord is a Node
  const sl = chart.getSubLord(cslPlanet);
  if (sl.name === 'Rahu' || sl.name === 'Ketu') {
    subLordIsNode = true;
    const resolution = resolveNodeSignifications(sl, chart);
    subLordSignifications = resolution.signifiedHouses;
    eclipseOverrideActive = true;
  }

  // Step 4: Determine event character modifier
  const eventCharacterModifier: 'SUDDEN_UNEXPECTED_TRANSFORMATIVE' | 'STANDARD' =
    eclipseOverrideActive ? 'SUDDEN_UNEXPECTED_TRANSFORMATIVE' : 'STANDARD';

  return {
    cslIsNode,
    starLordIsNode,
    subLordIsNode,
    cslSignifications,
    starLordSignifications,
    subLordSignifications,
    eclipseOverrideActive,
    eventCharacterModifier,
  };
}

/**
 * Apply Eclipse Override Rule when both a planet and its Node-proxy appear.
 *
 * Rule: The Node SUPERSEDES the planet in execution authority.
 *
 * Example:
 *   If Mars signifies 8 (surgery) AND Rahu proxies Mars (via conjunction/aspect),
 *   Rahu's wildcard nature overrides Mars's predictable timing.
 *   Event manifests with sudden, intense, unpredictable characteristics.
 */
export function applyEclipseOverride(
  planetSignifications: HouseIndex[],
  nodeSignifications: HouseIndex[],
  _chart: WatchChart,
): {
  operative: HouseIndex[];
  supersedesAuthority: 'Node' | 'Planet' | 'Neutral';
  eventModification: 'SUDDEN' | 'UNPREDICTABLE' | 'INTENSE' | 'NONE';
} {
  // Node significations take precedence
  const operative = Array.from(new Set([...nodeSignifications, ...planetSignifications])).sort(
    (a, b) => a - b,
  );

  // Eclipse Override: Node is stronger
  const supersedesAuthority = 'Node' as const;

  // Event modification: Node's influence wildcard nature
  const eventModification =
    nodeSignifications.length > 4
      ? 'INTENSE' // Massive multi-house trigger
      : nodeSignifications.length > 2
        ? 'UNPREDICTABLE'
        : 'SUDDEN'; // Simple node effect

  return {
    operative,
    supersedesAuthority,
    eventModification,
  };
}

/**
 * Pseudo-code reference function: Recursive resolution template.
 *
 * This is the algorithmic foundation from EVENT_FORMULATION_MATRIX.md § 7.
 */
export function pseudoCodeNodeResolution() {
  const pseudoCode = `
def resolve_node_significations(node, chart_state):
    """
    Recursively fetch all significations a Node assumes.

    Args:
        node: Rahu or Ketu object with position, nakshatra, sign
        chart_state: Complete chart with all planets, cusps, aspects

    Returns:
        set of house numbers the Node signifies (Levels B + 1-4)
    """
    signified_houses = set()

    # Base Level (Level B): The house the Node occupies
    signified_houses.add(node.occupied_house)

    # Priority 1: Conjunction (Absorb occupant's owned/occupied houses)
    for planet in chart_state.get_conjoined_planets(node):
        # Recursively resolve if the conjunct is also a Node
        if planet.name in ["Rahu", "Ketu"]:
            signified_houses.update(resolve_node_significations(planet, chart_state))
        else:
            signified_houses.update(get_base_significations(planet, chart_state))

    # Priority 2: Aspect (Absorb aspecting planet's owned/occupied houses)
    for planet in chart_state.get_aspecting_planets(node):
        if planet.name in ["Rahu", "Ketu"]:
            signified_houses.update(resolve_node_significations(planet, chart_state))
        else:
            signified_houses.update(get_base_significations(planet, chart_state))

    # Priority 3: Sign Lord (Absorb sign ruler's owned/occupied houses)
    sign_lord = chart_state.get_sign_lord(node.sign)
    if sign_lord.name in ["Rahu", "Ketu"]:
        signified_houses.update(resolve_node_significations(sign_lord, chart_state))
    else:
        signified_houses.update(get_base_significations(sign_lord, chart_state))

    # Priority 4: Star Lord (Absorb star ruler's significations)
    star_lord = chart_state.get_star_lord(node.nakshatra)
    if star_lord.name in ["Rahu", "Ketu"]:
        signified_houses.update(resolve_node_significations(star_lord, chart_state))
    else:
        signified_houses.update(get_base_significations(star_lord, chart_state))

    return list(signified_houses)
  `;

  return pseudoCode;
}
