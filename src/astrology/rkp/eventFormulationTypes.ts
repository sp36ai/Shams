/**
 * Event Formulation Matrix Type Definitions
 *
 * Bridges docs/EVENT_FORMULATION_MATRIX.md with RKP Watch Engine implementation.
 *
 * These types support multi-vector judgment logic for complex life events:
 * - Litigation outcomes (victory/defeat/settlement)
 * - Health crises (disease/surgery/recovery)
 * - Financial events (windfalls/debt/inheritance)
 * - Competitive selection (exams/government jobs)
 *
 * Ref: docs/EVENT_FORMULATION_MATRIX.md
 */

import type { HouseNumber, Planet } from '@astrology/types/chart';

/**
 * Event categories that require multi-house vector evaluation.
 *
 * These differ from simple yes/no questions by requiring alignment
 * across multiple Cusp Sub-Lords (CSLs) for a definitive judgment.
 */
export type ComplexEventType =
  // Litigation & Conflict Resolution
  | 'LITIGATION_VICTORY'
  | 'LITIGATION_DEFEAT'
  | 'LITIGATION_SETTLEMENT'

  // Health, Disease, Surgery, Recovery
  | 'HEALTH_DISEASE_MANIFESTATION'
  | 'HEALTH_SURGICAL_INTERVENTION'
  | 'HEALTH_RECOVERY_CURE'

  // Financial Windfalls & Losses
  | 'WINDFALL_LOTTERY_SPECULATION'
  | 'WINDFALL_INHERITANCE_INSURANCE'
  | 'FINANCIAL_INSOLVENCY_DEBT'

  // Competitive Selection & Service
  | 'EXAM_SUCCESS_COMPETITIVE'
  | 'GOVERNMENT_JOB_APPOINTMENT'
  | 'BUSINESS_PARTNERSHIP_SUCCESS';

/**
 * The six settled verdict states for complex events.
 * Extends WatchState with multi-vector specificity.
 */
export type EventVerdictState =
  /** All vectors aligned; event guaranteed within timeline. */
  | 'PROMISED'
  /** Vectors opposed; event denied or blocked. */
  | 'DENIED'
  /** Vectors mixed; outcome contingent on secondary factors. */
  | 'CONTINGENT'
  /** Primary vector clear but timing stretched (Saturn effect). */
  | 'DELAYED'
  /** Reversal risk across one or more vectors. */
  | 'REVERSIBLE'
  /** Insufficient vector alignment for judgment. */
  | 'INDETERMINATE';

/**
 * Confidence levels aligned with Shams Method scoring.
 *
 * Confidence reflects the strength of multi-house signification
 * alignment and the absence of contradictory vectors.
 */
export type EventConfidence =
  | 'VERY_HIGH'    // ≥ 0.90 (3+ vectors strongly aligned)
  | 'HIGH'         // 0.80–0.89 (2+ vectors aligned, no negations)
  | 'MODERATE'     // 0.65–0.79 (Primary vector clear, secondary weak)
  | 'LOW'          // 0.50–0.64 (Vectors mixed or timing unclear)
  | 'UNCERTAIN';   // < 0.50 (Insufficient alignment)

/**
 * Primary, secondary, and negating houses for a complex event.
 *
 * Each event type carries specific significations across multiple houses.
 * This structure mirrors the EVENT MATRIX in EVENT_FORMULATION_MATRIX.md.
 */
export interface EventVectorSignification {
  /** Primary anchor house (P) — dominant signification for the event. */
  primary: HouseNumber;

  /** Reinforcing houses (S) — strengthen the primary vector. */
  secondary: HouseNumber[];

  /** Negating/blocking houses (N) — directly oppose the primary vector. */
  negating: HouseNumber[];

  /** Alternative negating houses context-dependent on event specifics. */
  eventSpecificNegators?: HouseNumber[];
}

/**
 * Cusp Sub-Lord (CSL) data for a single house.
 *
 * Encapsulates the CSL planet and its significations at Levels A–D.
 * Used in multi-vector evaluation loops.
 */
export interface CuspSubLordData {
  house: HouseNumber;

  /** The actual Cusp Sub-Lord planet. */
  cslPlanet: Planet;

  /** Star Lord of the CSL (Nakshatra lord). */
  starLord: Planet;

  /** Sub-Lord of the CSL (Vimshottari sub-division). */
  subLord: Planet;

  /** Houses signified by starLord at Level A (most powerful). */
  starSignifications: HouseNumber[];

  /** Houses signified by subLord at Level A. */
  subSignifications: HouseNumber[];

  /** Mars or Ketu involvement (mandatory for surgery gate). */
  hasMarsKetu: boolean;

  /** Benefic/malefic nature of the CSL and lords. */
  isAffluent: boolean;
}

/**
 * Result of evaluating a single vector across CSLs.
 *
 * A vector evaluation checks whether the houses in the EventVectorSignification
 * are actually signified by the relevant CSLs.
 */
export interface VectorEvaluationResult {
  /** The vector being evaluated (primary/secondary/negating). */
  vectorType: 'PRIMARY' | 'SECONDARY' | 'NEGATING' | 'EVENT_SPECIFIC_NEGATOR';

  /** Houses that should be signified per the matrix. */
  expectedHouses: HouseNumber[];

  /** Houses actually signified by relevant CSLs. */
  actualHouses: HouseNumber[];

  /** Strength of alignment (0.0 to 1.0). */
  alignmentScore: number;

  /** Whether this vector reached the threshold for its role. */
  isSatisfied: boolean;

  /** CSLs involved in this vector's evaluation. */
  relevantCSLs: HouseNumber[];
}

/**
 * Compound event judgment with multi-vector breakdown.
 *
 * Extends WatchVerdict with multi-house analysis and factor attribution.
 */
export interface CompoundEventJudgment {
  /** The complex event category. */
  eventType: ComplexEventType;

  /** The user's original question/inquiry. */
  queryText: string;

  /** Computed verdict state (PROMISED/DENIED/CONTINGENT/etc). */
  verdict: EventVerdictState;

  /** Confidence in the verdict (0.0 to 1.0). */
  confidence: EventConfidence;

  /** Numeric score reflecting vector strength. Positive favors event. */
  score: number;

  /** Timeline for event manifestation (days). */
  timing: {
    minDays: number;
    maxDays: number;
    certainty: 'HIGH' | 'MEDIUM' | 'LOW';
  } | null;

  /** Evaluation results for each vector type. */
  vectorAnalysis: {
    primary: VectorEvaluationResult;
    secondary: VectorEvaluationResult[];
    negating: VectorEvaluationResult[];
    eventSpecificNegators?: VectorEvaluationResult[];
  };

  /** CSL data for all houses involved in the evaluation. */
  cslDataset: CuspSubLordData[];

  /** Human-readable judgment factors in order applied. */
  factors: string[];

  /** Stage-tagged diagnostics for debug tracing. */
  diagnostics: {
    stage: string;
    check: string;
    result: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
    detail: string;
  }[];

  /** Any blocker planets or conditions that override verdict. */
  blockers: {
    type: 'MARS_KETU_ABSENT' | 'NEGATION_DOMINANCE' | 'TIMING_RETROGRADE' | 'LEGAL_DISPUTE' | 'OTHER';
    description: string;
    severity: 'FATAL' | 'MAJOR' | 'MINOR';
  }[];

  /** Secondary outcome if primary verdict is reversed. */
  contingency?: {
    condition: string;
    alternateVerdict: EventVerdictState;
    alternateScore: number;
  };
}

/**
 * Specific judgment for litigation outcomes.
 * Extends CompoundEventJudgment with litigation-specific fields.
 */
export interface LitigationJudgment extends CompoundEventJudgment {
  eventType: 'LITIGATION_VICTORY' | 'LITIGATION_DEFEAT' | 'LITIGATION_SETTLEMENT';

  /** Primary adversary planet (if known from opponent's chart). */
  opponentSignifier?: Planet;

  /** Expected financial outcome (gain/loss/breakeven). */
  financialOutcome: 'GAIN' | 'LOSS' | 'BREAKEVEN';

  /** Expected personal status impact. */
  statusImpact: 'ENHANCED' | 'DAMAGED' | 'UNCHANGED';

  /** Legal phase assessment (filing/hearing/judgment/appeal). */
  legalPhase: string;
}

/**
 * Specific judgment for health crises.
 * Extends CompoundEventJudgment with medical-specific fields.
 */
export interface HealthJudgment extends CompoundEventJudgment {
  eventType: 'HEALTH_DISEASE_MANIFESTATION' | 'HEALTH_SURGICAL_INTERVENTION' | 'HEALTH_RECOVERY_CURE';

  /** Disease/condition severity if manifestation is promised. */
  severity?: 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL';

  /** Whether hospitalization is indicated. */
  hospitalizationRequired: boolean;

  /** Surgical intervention necessity (only for SURGERY type). */
  surgeryMandatory?: boolean;

  /** Recovery timeline in months (only for RECOVERY type). */
  recoveryMonths?: number;

  /** Complication risk percentage (0–100). */
  complicationRisk?: number;

  /** Post-operative prognosis quality. */
  prognosisQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

/**
 * Specific judgment for financial events.
 * Extends CompoundEventJudgment with financial-specific fields.
 */
export interface FinancialJudgment extends CompoundEventJudgment {
  eventType: 'WINDFALL_LOTTERY_SPECULATION' | 'WINDFALL_INHERITANCE_INSURANCE' | 'FINANCIAL_INSOLVENCY_DEBT';

  /** Estimated amount range if windfall/inheritance promised. */
  amountEstimate?: {
    minAmount: number;
    maxAmount: number;
    currencyCode: string;
  };

  /** Asset type for inheritance judgments. */
  assetType?: 'LIQUID_FUNDS' | 'REAL_ESTATE' | 'MOVABLE_PROPERTY' | 'MIXED';

  /** Creditor or claim type for insolvency/inheritance. */
  claimantType?: string;

  /** Legal viability of financial claim (for inheritance/insurance). */
  claimViability?: 'STRONG' | 'MODERATE' | 'WEAK';

  /** Dispute likelihood (for multi-party claims). */
  disputeRisk?: number; // 0–1 probability
}

/**
 * Specific judgment for competitive/selection events.
 * Extends CompoundEventJudgment with education/career-specific fields.
 */
export interface SelectionJudgment extends CompoundEventJudgment {
  eventType: 'EXAM_SUCCESS_COMPETITIVE' | 'GOVERNMENT_JOB_APPOINTMENT' | 'BUSINESS_PARTNERSHIP_SUCCESS';

  /** Exam/test type (IITJEE, UPSC, Medical, etc.). */
  testType?: string;

  /** Expected rank/performance if success promised. */
  expectedRank?: string;

  /** Government post type (IAS, Police, Banking, etc.). */
  postType?: string;

  /** Post number or grade (e.g., "Grade A Officer"). */
  postDesignation?: string;

  /** Partner name/type for partnership events. */
  partnerInfo?: string;

  /** Interview/selection phase assessment. */
  selectionPhase?: 'APPLICATION' | 'WRITTEN_EXAM' | 'INTERVIEW' | 'FINAL_MERIT' | 'APPOINTMENT';

  /** Merit ranking visibility (high/medium/low). */
  meritVisibility?: 'STRONG' | 'MODERATE' | 'WEAK';

  /** Expected number of retakes/attempts if failure. */
  retakeCount?: number;
}

/**
 * Multi-vector event evaluation request.
 * Sent to the RKP Watch Engine for complex judgment.
 */
export interface CompoundEventEvaluationRequest {
  /** UTC timestamp of the inquiry. */
  inquiryTimestamp: number;

  /** Geographic location (for Hora & ruling planets). */
  location: {
    latitude: number;
    longitude: number;
    timezoneName?: string;
  };

  /** Native's birth chart data (for Ruling Planets confirmation). */
  nativeChart: {
    birthTimestamp: number;
    latitude: number;
    longitude: number;
  };

  /** The complex event being inquired. */
  eventType: ComplexEventType;

  /** User's free-text question. */
  queryText: string;

  /** Optional: context data (e.g., opponent's birth chart for litigation). */
  contextData?: Record<string, unknown>;

  /** Enable stage-tagged diagnostics for debugging. */
  includeDiagnostics: boolean;
}

/**
 * Multi-vector event evaluation response.
 * Returned from the RKP Watch Engine.
 */
export interface CompoundEventEvaluationResponse {
  /** Request correlation ID for audit tracing. */
  requestId: string;

  /** ISO 8601 timestamp of evaluation. */
  evaluatedAt: string;

  /** The computed judgment (polymorphic based on eventType). */
  judgment:
    | LitigationJudgment
    | HealthJudgment
    | FinancialJudgment
    | SelectionJudgment
    | CompoundEventJudgment;

  /** Whether the judgment reached definitive status. */
  isDefinitive: boolean;

  /** Suggested follow-up questions if judgment is CONTINGENT. */
  followUpQuestions?: string[];

  /** Audit trail for compliance and debugging. */
  auditTrail: {
    chartComputed: boolean;
    cslsExtracted: boolean;
    vectorsEvaluated: boolean;
    verdictComputed: boolean;
    diagnosticsGenerated: boolean;
  };
}

/**
 * Utility function to derive EventVectorSignification from ComplexEventType.
 *
 * Maps each event type to its house matrix per EVENT_FORMULATION_MATRIX.md.
 */
export function getEventVectorSignification(eventType: ComplexEventType): EventVectorSignification {
  const vectorMap: Record<ComplexEventType, EventVectorSignification> = {
    LITIGATION_VICTORY: {
      primary: 6,
      secondary: [1, 10, 11],
      negating: [12, 5],
    },
    LITIGATION_DEFEAT: {
      primary: 12,
      secondary: [7, 8, 5],
      negating: [6, 11],
    },
    LITIGATION_SETTLEMENT: {
      primary: 5,
      secondary: [7, 9, 11],
      negating: [6, 1],
    },
    HEALTH_DISEASE_MANIFESTATION: {
      primary: 6,
      secondary: [1, 8],
      negating: [5, 11],
    },
    HEALTH_SURGICAL_INTERVENTION: {
      primary: 8,
      secondary: [6, 12],
      negating: [1, 5, 11],
      eventSpecificNegators: [], // Mars/Ketu mandatory check supersedes
    },
    HEALTH_RECOVERY_CURE: {
      primary: 5,
      secondary: [11, 1],
      negating: [6, 8, 12],
    },
    WINDFALL_LOTTERY_SPECULATION: {
      primary: 5,
      secondary: [11, 2, 8],
      negating: [12, 4],
    },
    WINDFALL_INHERITANCE_INSURANCE: {
      primary: 8,
      secondary: [2, 4, 11],
      negating: [7, 12],
    },
    FINANCIAL_INSOLVENCY_DEBT: {
      primary: 12,
      secondary: [8, 6, 2],
      negating: [2, 5, 11],
    },
    EXAM_SUCCESS_COMPETITIVE: {
      primary: 4,
      secondary: [6, 9, 11],
      negating: [8, 12],
    },
    GOVERNMENT_JOB_APPOINTMENT: {
      primary: 10,
      secondary: [6, 11, 4, 9],
      negating: [8, 12],
      eventSpecificNegators: [7], // 7th CSL → 12 indicates legal dispute
    },
    BUSINESS_PARTNERSHIP_SUCCESS: {
      primary: 7,
      secondary: [10, 11, 2],
      negating: [6, 8, 12],
    },
  };

  return vectorMap[eventType];
}

/**
 * Utility function to convert numeric confidence score to EventConfidence.
 */
export function confidenceFromScore(score: number): EventConfidence {
  if (score >= 0.90) return 'VERY_HIGH';
  if (score >= 0.80) return 'HIGH';
  if (score >= 0.65) return 'MODERATE';
  if (score >= 0.50) return 'LOW';
  return 'UNCERTAIN';
}

/**
 * Utility function to convert verdict factors and score to EventVerdictState.
 */
export function verdictFromFactors(
  score: number,
  hasNegation: boolean,
  isMixedAlignment: boolean,
  hasReversalRisk: boolean
): EventVerdictState {
  if (score >= 0.75 && !hasNegation && !hasReversalRisk) {
    return 'PROMISED';
  }
  if (score <= 0.40 && hasNegation) {
    return 'DENIED';
  }
  if (hasReversalRisk) {
    return 'REVERSIBLE';
  }
  if (isMixedAlignment) {
    return 'CONTINGENT';
  }
  if (score >= 0.60 && !hasNegation) {
    return 'DELAYED';
  }
  return 'INDETERMINATE';
}
