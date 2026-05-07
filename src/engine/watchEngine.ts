/**
 * watchEngine — numerological watch-time analysis types.
 *
 * The actual computation runs server-side. This file is the client-side
 * type contract so UI components can be statically typed.
 */

export type WatchVerdictKind = 'YES' | 'NO' | 'CONDITIONAL' | 'UNCLEAR';

export interface WatchFormula {
  /** Human-readable formula name. */
  name: string;
  /** Raw computed value (e.g. digital root, vighati count). */
  value: string | number;
  /** One-line interpretation. */
  interpretation: string;
  /** Whether this formula supports the question affirmatively. */
  supportive: boolean;
}

export interface WatchVerdictResult {
  mode: 'watch';
  verdict: WatchVerdictKind;
  confidence: number; // 0-100
  dominantPlanet: string;
  /** Exactly 3 formula rows: Digital Root, Janma Vighati, Hora. */
  formulas: [WatchFormula, WatchFormula, WatchFormula];
  /** Number of formulas that agree (0-3). */
  agreementCount: number;
  narrative: string;
  /** ISO timestamp of the watch-time reading. */
  createdAt: string;
  /** Optional: switch to full KP analysis. */
  onSwitchMode?: () => void;
}
