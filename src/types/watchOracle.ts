/**
 * Wire types for the watch oracle composition.
 * --------------------------------------------------------------------------
 * askWatchOracle returns a diagnosis, a remedy protocol and (when synthesis
 * succeeded) the narration. The diagnosis unions are imported from
 * `@astrology/rkp/diagnosis` rather than restated — that module is authored
 * here and mirrored to the server, so it is already the single source of truth
 * for outcome and pattern names.
 *
 * The protocol types below have no such shared home: the remedy library lives
 * only on the server (functions/src/oracle/remedyLibrary.ts), because the APK
 * must not carry the intervention logic. They are mirrored here by hand, and
 * the server's `WatchOracleComposition` is their counterpart.
 */

import type { ImbalancePattern, RkpOutcome, TimingPosture } from '@astrology/rkp/diagnosis';

/** The five levels, in ascending order of claim. */
export type RemedyCategory =
  | 'contemplative'
  | 'devotional'
  | 'astrological'
  | 'behavioral'
  | 'practical';

/**
 * What kind of authority a remedy carries. Surfaced in the UI so a traditional
 * correspondence is never mistaken for a scriptural instruction.
 */
export type EvidenceType = 'scriptural' | 'traditional' | 'astrological' | 'behavioral';

export type RemedyIntensity = 'low' | 'moderate' | 'high';

export interface OracleProtocolStep {
  readonly id: string;
  readonly name: string;
  readonly category: RemedyCategory;
  readonly evidenceType: EvidenceType;
  readonly intensity: RemedyIntensity;
  readonly duration: string | null;
  readonly explanation: string;
  readonly instructions: readonly string[];
  /** True for a forced professional referral, which the card leads with. */
  readonly isEscalation: boolean;
}

/** The prose layer. Null when synthesis failed; the protocol still stands. */
export interface OracleNarration {
  readonly rkp_finding: string;
  readonly interpretation: string;
  readonly recommended_approach: string;
  readonly why_this_remedy: string | null;
  readonly signature: string;
}

export interface WatchOracleComposition {
  readonly narration: OracleNarration | null;
  /**
   * Fixed closing attribution, identical on every reading and never
   * model-written — the server's counterpart is ORACLE_BRAND_SEAL in
   * functions/src/oracle/responseComposer.ts. Optional here so cached
   * readings written by a build predating this field still satisfy the type.
   */
  readonly brandSeal?: string;
  readonly diagnosis: {
    readonly outcome: RkpOutcome;
    readonly primaryPattern: ImbalancePattern;
    readonly secondaryPatterns: readonly ImbalancePattern[];
    readonly timingPosture: TimingPosture;
    readonly confidence: number;
    readonly obstructingAgent: string | null;
    readonly rationale: readonly string[];
  };
  readonly protocol: {
    readonly interventionRequired: boolean;
    /** Shown in place of steps when nothing is prescribed. */
    readonly guidance: string | null;
    readonly steps: readonly OracleProtocolStep[];
    readonly rationale: readonly string[];
  };
}
