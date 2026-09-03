/**
 * Multi-Vector Event Judgment Engine Implementation
 *
 * Concrete implementation of the Shams Method logic for complex life events.
 * Follows the worked examples in docs/EVENT_FORMULATION_MATRIX.md § 5.
 *
 * Key principle: The **Sub-Lord holds veto power** over the Star-Lord verdict.
 * A promissory Star-Lord can be reversed by a negating Sub-Lord signification.
 *
 * Example: Litigation Query
 *   - 6th CSL: Venus (Star Lord: Saturn, Sub Lord: Rahu)
 *   - Saturn→11 (victory) is reversed by Rahu→12 (loss) → DENIED_WITH_PENALTY
 */

import type {
  ComplexEventType,
  CompoundEventJudgment,
  CuspSubLordData,
  EventConfidence,
  EventVerdictState,
  LitigationJudgment,
  FinancialJudgment,
  VectorEvaluationResult,
} from './eventFormulationTypes';

import {
  getEventVectorSignification,
  confidenceFromScore,
  verdictFromFactors,
} from './eventFormulationTypes';
import type { WatchChart } from './watchChart';
import type { HouseIndex } from '@astrology/types/chart';

/**
 * Central evaluation function for multi-vector Shams Method judgment.
 *
 * Invoked from askWatchOracle when a complex event is detected.
 * Returns a fully formed CompoundEventJudgment with factors and diagnostics.
 */
export function evaluateMultiVectorEvent(
  chart: WatchChart,
  eventType: ComplexEventType,
  queryText: string,
): CompoundEventJudgment {
  const vectorSig = getEventVectorSignification(eventType);
  const primaryHouse = vectorSig.primary;
  const secondaryHouses = vectorSig.secondary;
  const negatingHouses = vectorSig.negating;

  // Step 1: Extract CSL data for primary and secondary houses
  const primaryCSL = extractCuspSubLordData(chart, primaryHouse);
  const secondaryCSLs = secondaryHouses.map(h => extractCuspSubLordData(chart, h));
  const negatingCSLs = negatingHouses.map(h => extractCuspSubLordData(chart, h));

  const allCSLs = [primaryCSL, ...secondaryCSLs, ...negatingCSLs];

  // Step 2: Evaluate each vector type
  const primaryVectorResult = evaluateSingleVector(primaryCSL, 'PRIMARY', [primaryHouse], chart);

  const secondaryVectorResults = secondaryCSLs.map((csl, idx) =>
    evaluateSingleVector(csl, 'SECONDARY', [secondaryHouses[idx]], chart),
  );

  const negatingVectorResults = negatingCSLs.map((csl, idx) =>
    evaluateSingleVector(csl, 'NEGATING', [negatingHouses[idx]], chart),
  );

  // Step 3: Evaluate Star-Lord → Sub-Lord veto chain
  const vetoResult = evaluateVetoLogic(primaryCSL, chart, eventType, primaryHouse);

  // Step 4: Combine vectors to compute final verdict
  const computedVerdictState = computeVerdictState(
    primaryVectorResult,
    secondaryVectorResults,
    negatingVectorResults,
    vetoResult,
    eventType,
  );

  // Step 5: Calculate confidence score
  const confidenceScore = calculateConfidenceScore(
    primaryVectorResult,
    secondaryVectorResults,
    negatingVectorResults,
    vetoResult,
  );

  const confidence: EventConfidence = confidenceFromScore(confidenceScore);

  // Step 6: Extract factors and diagnostics
  const factors = constructFactorList(
    primaryVectorResult,
    secondaryVectorResults,
    negatingVectorResults,
    vetoResult,
    eventType,
  );

  const diagnostics = constructDiagnosticsTrace(
    eventType,
    primaryCSL,
    vetoResult,
    computedVerdictState,
    confidenceScore,
  );

  // Step 7: Detect blockers
  const blockers = identifyBlockers(vetoResult, primaryVectorResult, eventType);

  // Step 8: Construct base judgment
  const baseJudgment: CompoundEventJudgment = {
    eventType,
    queryText,
    verdict: computedVerdictState,
    confidence,
    score: confidenceScore,
    timing: extractTimingVector(chart, eventType, computedVerdictState),
    vectorAnalysis: {
      primary: primaryVectorResult,
      secondary: secondaryVectorResults,
      negating: negatingVectorResults,
    },
    cslDataset: allCSLs,
    factors,
    diagnostics,
    blockers,
  };

  // Step 9: Type-specific enhancements
  if (eventType.startsWith('LITIGATION')) {
    return enhanceLitigationJudgment(baseJudgment as LitigationJudgment, chart, primaryCSL);
  } else if (eventType.startsWith('WINDFALL') || eventType === 'FINANCIAL_INSOLVENCY_DEBT') {
    return enhanceFinancialJudgment(baseJudgment as FinancialJudgment, chart, primaryCSL);
  }

  return baseJudgment;
}

/**
 * Extract Cusp Sub-Lord (CSL) data for a given house.
 *
 * Returns: CSL planet + Star Lord + Sub Lord + their significations.
 */
function extractCuspSubLordData(chart: WatchChart, house: HouseIndex): CuspSubLordData {
  const cuspLongitude = chart.getHouseCuspLongitude(house);
  const cslPlanet = chart.getCuspSubLord(cuspLongitude);
  const starLord = chart.getStarLord(cslPlanet);
  const subLord = chart.getSubLord(cslPlanet);

  const starSignifications = chart.getSignifiedHouses(starLord, ['A', 'B']);
  const subSignifications = chart.getSignifiedHouses(subLord, ['A', 'B']);

  const hasMarsKetu =
    cslPlanet.name === 'Mars' ||
    cslPlanet.name === 'Ketu' ||
    starLord.name === 'Mars' ||
    starLord.name === 'Ketu';

  const isAffluent = chart.isBenefic(cslPlanet) || chart.isBenefic(starLord);

  return {
    house,
    cslPlanet,
    starLord,
    subLord,
    starSignifications,
    subSignifications,
    hasMarsKetu,
    isAffluent,
  };
}

/**
 * Evaluate a single vector's alignment score.
 *
 * Compares expected houses (from matrix) against actual significations
 * by the CSL's Star/Sub Lords.
 */
function evaluateSingleVector(
  cslData: CuspSubLordData,
  vectorType: 'PRIMARY' | 'SECONDARY' | 'NEGATING' | 'EVENT_SPECIFIC_NEGATOR',
  expectedHouses: HouseIndex[],
  _chart: WatchChart,
): VectorEvaluationResult {
  // Combine Star and Sub significations
  const actualHouses = Array.from(
    new Set([...cslData.starSignifications, ...cslData.subSignifications]),
  );

  // Calculate alignment: intersection of expected vs actual
  const aligned = expectedHouses.filter(h => actualHouses.includes(h));
  const alignmentScore = aligned.length / Math.max(expectedHouses.length, 1);

  // Special scoring for PRIMARY vectors: must be very strong
  let isSatisfied = false;
  if (vectorType === 'PRIMARY') {
    isSatisfied = aligned.length >= 1; // At least one expected house present
  } else if (vectorType === 'SECONDARY') {
    isSatisfied = aligned.length >= 1; // At least one expected house present
  } else if (vectorType === 'NEGATING') {
    isSatisfied = aligned.length > 0; // Any negating house is a concern
  }

  return {
    vectorType,
    expectedHouses,
    actualHouses,
    alignmentScore,
    isSatisfied,
    relevantCSLs: [cslData.house],
  };
}

/**
 * Evaluate the Star-Lord → Sub-Lord veto chain.
 *
 * The Sub-Lord's significations can **reverse** or **confirm** the Star-Lord's promise.
 * This is the critical decision point in Shams Method.
 *
 * Example (Litigation Scenario A):
 *   - Star Lord (Saturn): signifies 11 (victory) + 8 (penalty) → Promise: WIN (but with penalty)
 *   - Sub Lord (Rahu): signifies 12 (loss) → Veto: REVERSE
 *   - Final: DENIED_WITH_PENALTY
 *
 * Example (Windfall Scenario B):
 *   - Star Lord (Moon): signifies 8 (sudden) + 11 (gain) → Promise: WINDFALL
 *   - Sub Lord (Mercury): signifies 2 (bank) + 11 (fulfillment) → Confirm: YES
 *   - Final: PROMISED_ABSOLUTE
 */
function evaluateVetoLogic(
  primaryCSL: CuspSubLordData,
  _chart: WatchChart,
  eventType: ComplexEventType,
  _primaryHouse: HouseIndex,
): {
  starLordVerdict: 'PROMISSORY' | 'NEGATING' | 'NEUTRAL';
  subLordVerdict: 'CONFIRMING' | 'REVERSING' | 'NEUTRAL';
  vetoApplied: boolean;
  vetoAuthority: 'ABSOLUTE' | 'STRONG' | 'MODERATE' | 'WEAK';
  starSignifications: HouseIndex[];
  subSignifications: HouseIndex[];
  expectedVectorHouses: HouseIndex[];
} {
  const vectorSig = getEventVectorSignification(eventType);

  // Determine Star-Lord verdict
  const starSupportsEvent = primaryCSL.starSignifications.some(h =>
    vectorSig.secondary.includes(h),
  );
  const starOpposesEvent = primaryCSL.starSignifications.some(h => vectorSig.negating.includes(h));

  let starLordVerdict: 'PROMISSORY' | 'NEGATING' | 'NEUTRAL';
  if (starSupportsEvent && !starOpposesEvent) {
    starLordVerdict = 'PROMISSORY';
  } else if (starOpposesEvent && !starSupportsEvent) {
    starLordVerdict = 'NEGATING';
  } else {
    starLordVerdict = 'NEUTRAL';
  }

  // Determine Sub-Lord verdict (VETO authority)
  const subSupportsEvent = primaryCSL.subSignifications.some(h =>
    [...vectorSig.secondary, vectorSig.primary].includes(h),
  );
  const subOpposesEvent = primaryCSL.subSignifications.some(h => vectorSig.negating.includes(h));

  let subLordVerdict: 'CONFIRMING' | 'REVERSING' | 'NEUTRAL';
  let vetoApplied = false;
  let vetoAuthority: 'ABSOLUTE' | 'STRONG' | 'MODERATE' | 'WEAK';

  if (subSupportsEvent && !subOpposesEvent) {
    subLordVerdict = 'CONFIRMING';
    vetoApplied = false;
    vetoAuthority = 'ABSOLUTE'; // Sub confirms, no reversal needed
  } else if (subOpposesEvent && !subSupportsEvent) {
    subLordVerdict = 'REVERSING';
    vetoApplied = true;
    vetoAuthority = 'ABSOLUTE'; // Sub **reverses** Star-Lord promise
  } else if (subSupportsEvent && subOpposesEvent) {
    // Dual signification: Sub is mixed
    subLordVerdict = 'NEUTRAL';
    vetoApplied = false;
    vetoAuthority = 'WEAK'; // Insufficient clarity
  } else {
    subLordVerdict = 'NEUTRAL';
    vetoApplied = false;
    vetoAuthority = 'WEAK';
  }

  return {
    starLordVerdict,
    subLordVerdict,
    vetoApplied,
    vetoAuthority,
    starSignifications: primaryCSL.starSignifications,
    subSignifications: primaryCSL.subSignifications,
    expectedVectorHouses: [...vectorSig.secondary, vectorSig.primary],
  };
}

/**
 * Compute the final verdict state based on vector alignment and veto logic.
 *
 * Decision flow:
 *   1. If Sub-Lord veto is applied → verdict is reversed
 *   2. If vectors are strongly aligned → PROMISED
 *   3. If vectors are negated → DENIED
 *   4. If vectors are mixed → CONTINGENT
 *   5. Otherwise → INDETERMINATE
 */
function computeVerdictState(
  primaryVector: VectorEvaluationResult,
  _secondaryVectors: VectorEvaluationResult[],
  negatingVectors: VectorEvaluationResult[],
  vetoResult: ReturnType<typeof evaluateVetoLogic>,
  _eventType: ComplexEventType,
): EventVerdictState {
  // Veto logic takes absolute precedence
  if (vetoResult.vetoApplied && vetoResult.vetoAuthority === 'ABSOLUTE') {
    // Star-Lord promise is reversed by Sub-Lord
    if (vetoResult.starLordVerdict === 'PROMISSORY' && vetoResult.subLordVerdict === 'REVERSING') {
      return 'DENIED'; // Star promised, but Sub denied
    } else if (
      vetoResult.starLordVerdict === 'NEGATING' &&
      vetoResult.subLordVerdict === 'CONFIRMING'
    ) {
      return 'REVERSIBLE'; // Star denied, but Sub confirmed (reversal possible)
    }
  }

  // Score based on vector alignment
  const primaryScore = primaryVector.alignmentScore;
  // Secondary score calculation removed - not currently used in verdict computation
  // TODO: Integrate secondary vector strength into overall verdict weighting
  const negatingScore =
    negatingVectors.length > 0
      ? negatingVectors.reduce((sum, v) => sum + v.alignmentScore, 0) / negatingVectors.length
      : 0;

  const isMixedAlignment = primaryScore > 0.4 && negatingScore > 0.4;
  const hasNegation = negatingScore > 0.6;

  // Construct composite verdict
  return verdictFromFactors(primaryScore, hasNegation, isMixedAlignment, false);
}

/**
 * Calculate numeric confidence score (0.0 to 1.0).
 *
 * High confidence when:
 *   - Primary vector strongly aligned (>0.7)
 *   - Secondary vectors support primary
 *   - Negating vectors absent (<0.3)
 *   - Veto logic is clear and unambiguous
 */
function calculateConfidenceScore(
  primaryVector: VectorEvaluationResult,
  secondaryVectors: VectorEvaluationResult[],
  negatingVectors: VectorEvaluationResult[],
  vetoResult: ReturnType<typeof evaluateVetoLogic>,
): number {
  let score = 0.0;

  // Primary vector weight (50%)
  score += primaryVector.alignmentScore * 0.5;

  // Secondary vector weight (25%)
  if (secondaryVectors.length > 0) {
    const avgSecondary =
      secondaryVectors.reduce((sum, v) => sum + v.alignmentScore, 0) / secondaryVectors.length;
    score += Math.max(0, avgSecondary) * 0.25;
  }

  // Negating vector weight (25%, inverted)
  if (negatingVectors.length > 0) {
    const avgNegating =
      negatingVectors.reduce((sum, v) => sum + v.alignmentScore, 0) / negatingVectors.length;
    score += Math.max(0, 1.0 - avgNegating) * 0.25;
  } else {
    score += 0.25; // No negating vectors → full credit
  }

  // Veto authority adjustment
  if (vetoResult.vetoApplied) {
    if (vetoResult.vetoAuthority === 'ABSOLUTE') {
      score *= 0.95; // High confidence in veto reversal
    } else if (vetoResult.vetoAuthority === 'STRONG') {
      score *= 0.85;
    } else if (vetoResult.vetoAuthority === 'WEAK') {
      score *= 0.7; // Low confidence, ambiguous
    }
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Construct human-readable factor list explaining the judgment.
 *
 * Factors are listed in the order they were applied:
 *   1. Primary vector status
 *   2. Star-Lord significations
 *   3. Sub-Lord significations
 *   4. Veto application (if any)
 *   5. Blocking conditions
 */
function constructFactorList(
  primaryVector: VectorEvaluationResult,
  secondaryVectors: VectorEvaluationResult[],
  negatingVectors: VectorEvaluationResult[],
  vetoResult: ReturnType<typeof evaluateVetoLogic>,
  _eventType: ComplexEventType,
): string[] {
  const factors: string[] = [];

  // Primary vector
  if (primaryVector.isSatisfied) {
    factors.push(
      `Primary vector (${primaryVector.expectedHouses.join(',')}) satisfied: actual=${primaryVector.actualHouses.join(',')}`,
    );
  } else {
    factors.push(
      `Primary vector (${primaryVector.expectedHouses.join(',')}) NOT satisfied: actual=${primaryVector.actualHouses.join(',')}`,
    );
  }

  // Star-Lord significations
  factors.push(`Star Lord signifies: ${vetoResult.starSignifications.join(',')}`);
  factors.push(`Star-Lord verdict: ${vetoResult.starLordVerdict}`);

  // Sub-Lord significations
  factors.push(`Sub-Lord signifies: ${vetoResult.subSignifications.join(',')}`);
  factors.push(
    `Sub-Lord verdict: ${vetoResult.subLordVerdict} (Veto Authority: ${vetoResult.vetoAuthority})`,
  );

  // Veto application
  if (vetoResult.vetoApplied) {
    factors.push(`Veto Logic Applied: Sub-Lord reverses Star-Lord promise`);
  } else if (vetoResult.subLordVerdict === 'CONFIRMING') {
    factors.push(`Veto Logic Result: Sub-Lord confirms Star-Lord promise`);
  }

  // Secondary vectors
  if (secondaryVectors.some(v => v.isSatisfied)) {
    factors.push(
      `Secondary vectors reinforcing: ${secondaryVectors.filter(v => v.isSatisfied).length} / ${secondaryVectors.length}`,
    );
  }

  // Negating vectors
  if (negatingVectors.some(v => v.isSatisfied)) {
    factors.push(
      `Negating vectors present: ${negatingVectors.filter(v => v.isSatisfied).length} / ${negatingVectors.length} (blocks outcome)`,
    );
  } else {
    factors.push(`No negating vectors detected`);
  }

  return factors;
}

/**
 * Construct stage-tagged diagnostics for debug tracing.
 *
 * Used for production debugging and audit compliance.
 */
function constructDiagnosticsTrace(
  _eventType: ComplexEventType,
  primaryCSL: CuspSubLordData,
  vetoResult: ReturnType<typeof evaluateVetoLogic>,
  verdict: EventVerdictState,
  confidence: number,
): Array<{
  stage: string;
  check: string;
  result: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  detail: string;
}> {
  return [
    {
      stage: 'STAGE 1',
      check: 'HOUSE_SIGNIFICATION_CHECK',
      result: primaryCSL.starSignifications.length > 0 ? 'PASS' : 'FAIL',
      detail: `Primary CSL (${primaryCSL.house}) Star Lord: ${primaryCSL.starLord.name}, Significations: ${primaryCSL.starSignifications.join(',')}`,
    },
    {
      stage: 'STAGE 2',
      check: 'STAR_LORD_VERDICT',
      result: vetoResult.starLordVerdict !== 'NEUTRAL' ? 'PASS' : 'INCONCLUSIVE',
      detail: `Star Lord (${primaryCSL.starLord.name}): ${vetoResult.starLordVerdict}`,
    },
    {
      stage: 'STAGE 3',
      check: 'VETO_LOGIC_EVALUATION',
      result: vetoResult.vetoAuthority !== 'WEAK' ? 'PASS' : 'INCONCLUSIVE',
      detail: `Sub-Lord (${primaryCSL.subLord.name}): ${vetoResult.subLordVerdict}, Veto Applied: ${vetoResult.vetoApplied}, Authority: ${vetoResult.vetoAuthority}`,
    },
    {
      stage: 'STAGE 4',
      check: 'VERDICT_COMPUTATION',
      result: verdict !== 'INDETERMINATE' ? 'PASS' : 'INCONCLUSIVE',
      detail: `Verdict: ${verdict}, Confidence: ${confidence.toFixed(2)}`,
    },
  ];
}

/**
 * Identify blocking conditions that override or weaken the verdict.
 */
function identifyBlockers(
  vetoResult: ReturnType<typeof evaluateVetoLogic>,
  primaryVector: VectorEvaluationResult,
  eventType: ComplexEventType,
): Array<{
  type: string;
  description: string;
  severity: 'FATAL' | 'MAJOR' | 'MINOR';
}> {
  const blockers: Array<{
    type: string;
    description: string;
    severity: 'FATAL' | 'MAJOR' | 'MINOR';
  }> = [];

  // Veto reversal is a major blocker
  if (vetoResult.vetoApplied && vetoResult.vetoAuthority === 'ABSOLUTE') {
    blockers.push({
      type: 'VETO_REVERSAL',
      description: `Sub-Lord (${vetoResult.subLordVerdict}) reverses Star-Lord promise`,
      severity: 'FATAL',
    });
  }

  // Surgery-specific: Mars/Ketu absence
  if (eventType === 'HEALTH_SURGICAL_INTERVENTION' && !primaryVector.relevantCSLs) {
    blockers.push({
      type: 'MARS_KETU_ABSENT',
      description: 'Mars or Ketu absent from 8th CSL chain; surgery not mandated',
      severity: 'FATAL',
    });
  }

  return blockers;
}

/**
 * Extract timing vector from Dasha-Bhukti-Antara (DBA) and Ruling Planets.
 *
 * Returns min/max days for event manifestation, or null if timing is indeterminate.
 */
function extractTimingVector(
  _chart: WatchChart,
  _eventType: ComplexEventType,
  verdict: EventVerdictState,
): {
  minDays: number;
  maxDays: number;
  certainty: 'HIGH' | 'MEDIUM' | 'LOW';
} | null {
  // Timing depends on operative Dasha-Bhukti
  // This is a placeholder; full DBA logic required

  if (verdict === 'INDETERMINATE' || verdict === 'DENIED') {
    return null;
  }

  // Default timing: 30–180 days for PROMISED/CONTINGENT/REVERSIBLE
  return {
    minDays: 30,
    maxDays: 180,
    certainty: 'MEDIUM',
  };
}

/**
 * Enhance judgment with litigation-specific fields.
 */
function enhanceLitigationJudgment(
  baseJudgment: LitigationJudgment,
  _chart: WatchChart,
  _primaryCSL: CuspSubLordData,
): LitigationJudgment {
  return {
    ...baseJudgment,
    financialOutcome:
      baseJudgment.verdict === 'DENIED'
        ? 'LOSS'
        : baseJudgment.verdict === 'PROMISED'
          ? 'GAIN'
          : 'BREAKEVEN',
    statusImpact:
      baseJudgment.verdict === 'DENIED'
        ? 'DAMAGED'
        : baseJudgment.verdict === 'PROMISED'
          ? 'ENHANCED'
          : 'UNCHANGED',
    legalPhase: 'JUDGMENT', // Placeholder; would extract from chart
  };
}

/**
 * Enhance judgment with financial-specific fields.
 */
function enhanceFinancialJudgment(
  baseJudgment: FinancialJudgment,
  _chart: WatchChart,
  _primaryCSL: CuspSubLordData,
): FinancialJudgment {
  return {
    ...baseJudgment,
    amountEstimate:
      baseJudgment.verdict === 'PROMISED'
        ? {
            minAmount: 10000, // Placeholder; extract from planets
            maxAmount: 1000000,
            currencyCode: 'INR',
          }
        : undefined,
    assetType:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_primaryCSL as any).starSignifications?.includes(4) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_primaryCSL as any).subSignifications?.includes(4)
        ? 'REAL_ESTATE'
        : 'LIQUID_FUNDS',
    claimViability: baseJudgment.verdict === 'PROMISED' ? 'STRONG' : 'WEAK',
  };
}
