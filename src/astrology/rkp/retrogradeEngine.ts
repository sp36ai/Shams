/**
 * Retrograde (Vakra) Planet Logic Engine
 *
 * Retrograde planets act as temporal circuit breakers within the deterministic engine.
 * Behavior is not a loss of strength, but an alteration in directionality and timing.
 *
 * Key Principle: Retrograde status depends on the planet's position in the stellar
 * hierarchy (CSL, Star Lord, Sub Lord) and the nature of the event (forward vs. reversal).
 *
 * Ref: docs/EVENT_FORMULATION_MATRIX.md § 8
 */

import type { Planet } from '@astrology/types/chart';
import type { ComplexEventType } from './eventFormulationTypes';

/**
 * Retrograde verdict states specific to vakra (backward motion).
 */
export type RetrogradVerdictState =
  | 'PROMISED_AND_DIRECT' // All planets direct; normal execution
  | 'PROMISED_VIA_RETROGRADE' // Retrograde enables reversal/return
  | 'DELAYED' // Star Lord retrograde; execution suspended
  | 'EVENT_REQUIRES_RESTART' // CSL retrograde; multiple attempts needed
  | 'DENIED' // Sub Lord retrograde; event aborts (unless reversal)
  | 'UNCERTAIN'; // Mixed retrograde signals

/**
 * Result of retrograde impact evaluation.
 */
export interface RetrogradEvaluationResult {
  /** Verdict based on retrograde status */
  verdict: RetrogradVerdictState;

  /** Confidence in retrograde verdict (0.0–1.0) */
  confidence: number;

  /** Which planet is causing the retrograde effect (if any) */
  affectedPlanet?: Planet;

  /** Human-readable explanation */
  detail: string;

  /** If DELAYED, the date when the planet turns direct */
  directMotionDate?: Date;

  /** If DELAYED, the new execution window */
  newExecutionDate?: Date;

  /** Number of expected retries (if EVENT_REQUIRES_RESTART) */
  expectedRetries?: number;

  /** Timeline adjustment in days */
  timelineShift: number;
}

/**
 * Complete retrograde analysis across the CSL → Star Lord → Sub Lord chain.
 */
export interface RetrogradAnalysis {
  /** CSL retrograde status and impact */
  csl: {
    planet: Planet;
    isRetrograde: boolean;
    impact: 'REVERSALS' | 'NONE';
    expectedRetries?: number;
  };

  /** Star Lord retrograde status and impact */
  starLord: {
    planet: Planet;
    isRetrograde: boolean;
    impact: 'DELAYED' | 'ENABLED_REVERSAL' | 'NONE';
    directMotionDate?: Date;
  };

  /** Sub Lord retrograde status and impact (MOST CRITICAL) */
  subLord: {
    planet: Planet;
    isRetrograde: boolean;
    impact: 'DENIED' | 'ENABLED_REVERSAL' | 'NONE';
  };

  /** Overall retrograde verdict */
  overallVerdict: RetrogradVerdictState;
  overallConfidence: number;
  overallTimelineShift: number;
}

/**
 * Main entry point: Evaluate retrograde impact across the CSL chain.
 *
 * This is the deterministic retrograde judgment function.
 */
export function evaluateRetrogradImpact(
  csl: Planet,
  starLord: Planet,
  subLord: Planet,
  eventType: ComplexEventType,
  queryIntent: 'FORWARD' | 'REVERSAL',
): RetrogradEvaluationResult {
  // Determine if this is a "return to past" event
  const isReversalEvent =
    queryIntent === 'REVERSAL' ||
    ['RECONCILIATION', 'RECOVERY', 'REINSTATEMENT', 'RETRIEVAL', 'REVERSAL_OF_JUDGMENT'].includes(
      eventType,
    );

  // === SUB LORD CHECK (FATAL VETO) ===
  // This is the most critical point in retrograde logic
  if (subLord.isRetrograde && !isNodePlanet(subLord)) {
    if (isReversalEvent) {
      // Retrograde Sub Lord ENABLES reversal in return-to-past queries
      return {
        verdict: 'PROMISED_VIA_RETROGRADE',
        confidence: 0.9,
        affectedPlanet: subLord,
        detail: `Retrograde ${subLord.name} enables reversal/return to past state. Event will manifest through backward motion.`,
        timelineShift: -7, // Retrograde can accelerate reversals
      };
    } else {
      // Retrograde Sub Lord DENIES in forward queries
      return {
        verdict: 'DENIED',
        confidence: 0.95,
        affectedPlanet: subLord,
        detail: `Sub Lord ${subLord.name} is retrograde. Event will abort at the final stage before materialization.`,
        timelineShift: 0, // Event doesn't happen
      };
    }
  }

  // === STAR LORD CHECK (DELAY or ENABLE) ===
  if (starLord.isRetrograde && !isNodePlanet(starLord)) {
    if (isReversalEvent) {
      // Retrograde Star Lord ENABLES reversal
      return {
        verdict: 'PROMISED_VIA_RETROGRADE',
        confidence: 0.88,
        affectedPlanet: starLord,
        detail: `Retrograde ${starLord.name} enables return to previous state. Event will manifest through backward motion.`,
        timelineShift: -7,
      };
    } else {
      // Retrograde Star Lord DELAYS in forward queries
      const directMotionDate = estimateDirectMotionDate(starLord);
      const newExecutionDate = addDays(directMotionDate, 14); // 2-week buffer after direct

      return {
        verdict: 'DELAYED',
        confidence: 0.85,
        affectedPlanet: starLord,
        detail: `Star Lord ${starLord.name} is retrograde. Event is mathematically promised but suspended in time. Execution deferred until ${directMotionDate.toDateString()}.`,
        directMotionDate,
        newExecutionDate,
        timelineShift: daysBetween(new Date(), newExecutionDate),
      };
    }
  }

  // === CSL RETROGRADE CHECK (REVERSALS, NOT DENIAL) ===
  if (csl.isRetrograde && !isNodePlanet(csl)) {
    return {
      verdict: 'EVENT_REQUIRES_RESTART',
      confidence: 0.7,
      affectedPlanet: csl,
      detail: `CSL ${csl.name} is retrograde. Native will face false starts, reversals, and multiple attempts. Expected retries: 2–3 before success.`,
      expectedRetries: 2,
      timelineShift: 90, // Add 3 months for retries
    };
  }

  // === NODAL SPECIAL CASE ===
  // Rahu/Ketu are always retrograde; check their Star Lord and Sign Lord instead
  if (isNodePlanet(starLord)) {
    const nodeStarLord = getStarLordOfNode(starLord);
    const nodeSignLord = getSignLordOfNode(starLord);

    if (nodeStarLord?.isRetrograde || nodeSignLord?.isRetrograde) {
      return {
        verdict: 'DELAYED',
        confidence: 0.82,
        affectedPlanet: starLord,
        detail: `Node's proxy (${nodeStarLord?.name || nodeSignLord?.name}) is retrograde. Promise suspended.`,
        timelineShift: 30,
      };
    }
  }

  // === NO RETROGRADE ISSUES ===
  return {
    verdict: 'PROMISED_AND_DIRECT',
    confidence: 0.95,
    detail: 'All planets in direct motion. Event proceeds normally without temporal obstruction.',
    timelineShift: 0,
  };
}

/**
 * Complete retrograde analysis across all three levels.
 *
 * Returns breakdown of retrograde impact at each stage of the CSL chain.
 */
export function analyzeRetrogradChain(
  csl: Planet,
  starLord: Planet,
  subLord: Planet,
  eventType: ComplexEventType,
  queryIntent: 'FORWARD' | 'REVERSAL',
): RetrogradAnalysis {
  const isReversalEvent =
    queryIntent === 'REVERSAL' ||
    ['RECONCILIATION', 'RECOVERY', 'REINSTATEMENT', 'RETRIEVAL', 'REVERSAL_OF_JUDGMENT'].includes(
      eventType,
    );

  // Evaluate each level
  const cslAnalysis = analyzeCslRetrograde(csl);
  const starLordAnalysis = analyzeStarLordRetrograde(starLord, isReversalEvent);
  const subLordAnalysis = analyzeSubLordRetrograde(subLord, isReversalEvent);

  // Compute overall verdict
  let overallVerdict: RetrogradVerdictState = 'PROMISED_AND_DIRECT';
  let overallConfidence = 0.95;
  let overallTimelineShift = 0;

  // Sub-Lord takes precedence (most critical)
  if (subLordAnalysis.isRetrograde) {
    overallVerdict = isReversalEvent ? 'PROMISED_VIA_RETROGRADE' : 'DENIED';
    overallConfidence = isReversalEvent ? 0.9 : 0.95;
  } else if (starLordAnalysis.isRetrograde) {
    overallVerdict = isReversalEvent ? 'PROMISED_VIA_RETROGRADE' : 'DELAYED';
    overallConfidence = isReversalEvent ? 0.88 : 0.85;
    overallTimelineShift = isReversalEvent ? -7 : 30; // Vary by event intent
  } else if (cslAnalysis.isRetrograde) {
    overallVerdict = 'EVENT_REQUIRES_RESTART';
    overallConfidence = 0.7;
    overallTimelineShift = 90;
  }

  return {
    csl: cslAnalysis,
    starLord: starLordAnalysis,
    subLord: subLordAnalysis,
    overallVerdict,
    overallConfidence,
    overallTimelineShift,
  };
}

/**
 * Analyze retrograde impact at the CSL level.
 */
function analyzeCslRetrograde(csl: Planet): RetrogradAnalysis['csl'] {
  if (isNodePlanet(csl)) {
    return {
      planet: csl,
      isRetrograde: false, // Nodes always retrograde; ignore
      impact: 'NONE',
    };
  }

  return {
    planet: csl,
    isRetrograde: csl.isRetrograde,
    impact: csl.isRetrograde ? 'REVERSALS' : 'NONE',
    expectedRetries: csl.isRetrograde ? 2 : undefined,
  };
}

/**
 * Analyze retrograde impact at the Star Lord level.
 */
function analyzeStarLordRetrograde(
  starLord: Planet,
  isReversalEvent: boolean,
): RetrogradAnalysis['starLord'] {
  if (isNodePlanet(starLord)) {
    // Check Node's Star Lord and Sign Lord
    const nodeStarLord = getStarLordOfNode(starLord);
    const isNodeProxyRetrograde = nodeStarLord?.isRetrograde || false;

    return {
      planet: starLord,
      isRetrograde: isNodeProxyRetrograde,
      impact: isNodeProxyRetrograde ? (isReversalEvent ? 'ENABLED_REVERSAL' : 'DELAYED') : 'NONE',
      directMotionDate: isNodeProxyRetrograde ? estimateDirectMotionDate(nodeStarLord!) : undefined,
    };
  }

  const directMotionDate = starLord.isRetrograde ? estimateDirectMotionDate(starLord) : undefined;

  return {
    planet: starLord,
    isRetrograde: starLord.isRetrograde,
    impact: starLord.isRetrograde ? (isReversalEvent ? 'ENABLED_REVERSAL' : 'DELAYED') : 'NONE',
    directMotionDate,
  };
}

/**
 * Analyze retrograde impact at the Sub Lord level (MOST CRITICAL).
 */
function analyzeSubLordRetrograde(
  subLord: Planet,
  isReversalEvent: boolean,
): RetrogradAnalysis['subLord'] {
  if (isNodePlanet(subLord)) {
    return {
      planet: subLord,
      isRetrograde: false, // Nodes always retrograde; ignore
      impact: 'NONE',
    };
  }

  return {
    planet: subLord,
    isRetrograde: subLord.isRetrograde,
    impact: subLord.isRetrograde ? (isReversalEvent ? 'ENABLED_REVERSAL' : 'DENIED') : 'NONE',
  };
}

/**
 * Check if a planet is Rahu or Ketu (Node planets).
 *
 * Nodes are always retrograde; special handling applies.
 */
function isNodePlanet(planet: Planet): boolean {
  return planet.name === 'Rahu' || planet.name === 'Ketu';
}

/**
 * Get the Star Lord of a Node.
 *
 * Used in retrograde analysis when Node is Star Lord.
 */
function getStarLordOfNode(_node: Planet): Planet | null {
  // Placeholder: Would fetch from chart
  return null;
}

/**
 * Get the Sign Lord of a Node.
 *
 * Used in retrograde analysis when Node is in a specific sign.
 */
function getSignLordOfNode(_node: Planet): Planet | null {
  // Placeholder: Would fetch from chart
  return null;
}

/**
 * Estimate the date when a retrograde planet turns direct.
 *
 * Retrograde periods vary by planet (5–23 weeks).
 */
function estimateDirectMotionDate(planet: Planet): Date {
  // Placeholder: Would query ephemeris
  // Venus/Mercury: ~3 weeks retrograde
  // Mars: ~3 months retrograde
  // Outer planets: ~4–6 months retrograde

  const today = new Date();
  const daysToAdd = planet.name === 'Mercury' ? 21 : planet.name === 'Venus' ? 21 : 120;
  return addDays(today, daysToAdd);
}

/**
 * Add days to a date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate days between two dates.
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Decision table for retrograde verdict based on position and event type.
 *
 * Reference from EVENT_FORMULATION_MATRIX.md § 8.
 */
export const RETROGRADE_DECISION_TABLE: Record<
  string,
  {
    position: 'CSL' | 'STAR_LORD' | 'SUB_LORD';
    forwardQuery: RetrogradVerdictState;
    reversalQuery: RetrogradVerdictState;
    confidence: number;
  }
> = {
  CSL_RETROGRADE: {
    position: 'CSL',
    forwardQuery: 'EVENT_REQUIRES_RESTART',
    reversalQuery: 'EVENT_REQUIRES_RESTART',
    confidence: 0.7,
  },
  STAR_LORD_RETROGRADE_FORWARD: {
    position: 'STAR_LORD',
    forwardQuery: 'DELAYED',
    reversalQuery: 'PROMISED_VIA_RETROGRADE',
    confidence: 0.85,
  },
  SUB_LORD_RETROGRADE_FORWARD: {
    position: 'SUB_LORD',
    forwardQuery: 'DENIED',
    reversalQuery: 'PROMISED_VIA_RETROGRADE',
    confidence: 0.95,
  },
};
