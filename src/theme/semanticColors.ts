/**
 * semanticColors.ts — fixed confidence signal colors.
 * --------------------------------------------------------------------------
 * Gold (and its confidence siblings) is not theme decoration in this app —
 * it is the visual signal for how confident a verdict is. A CONFIRMED-HIGH
 * reading must look identical no matter which of the app's themes is
 * active, so this mapping lives OUTSIDE the swappable theme token set
 * (see theme/themes.ts, ThemeColors) and is never read off `useColors()`.
 *
 * Previously the verdict badge (VerdictPill) and the reading-result cards
 * (AstroVerdictCard, WatchVerdictCard) derived their CONFIRMED coloring from
 * `colors.maqbool` / `colors.positive` — theme-scoped fields that differ per
 * theme (e.g. Layl al-Baḥr's "maqbool" is green, not gold). That meant a
 * CONFIRMED-HIGH verdict didn't reliably render as gold. This module is the
 * fix: components resolve confidence color from here, not from the active
 * theme.
 *
 * Each gradient is a two-stop tuple [start, end], matching the app's
 * existing gradient-token convention (see ThemeColors.sealGradient) — use
 * with react-native-linear-gradient when available, or index [0] as a flat
 * color fallback (the convention every current consumer uses, since the app
 * has no gradient-rendering dependency installed).
 */

export type ConfidenceBucket = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SemanticColors {
  /** CONFIRMED verdict + HIGH confidence — the app's one true "gold" signal. */
  confirmedHigh: readonly [string, string];
  /** CONFIRMED verdict + MEDIUM confidence. */
  confirmedMedium: string;
  /** CONFIRMED verdict + LOW confidence. */
  confirmedLow: readonly [string, string];
  /** DENIED (or NO) verdict, at any confidence. */
  denied: string;
}

export const SEMANTIC_COLORS: Readonly<SemanticColors> = Object.freeze({
  confirmedHigh: ['#D4A017', '#F0982E'] as const,
  confirmedMedium: '#5EEAD4',
  confirmedLow: ['#C084FC', '#60A5FA'] as const,
  denied: '#6B6478',
});

/** 0–100 engine confidence score → display bucket. */
export function confidenceBucket(confidence: number): ConfidenceBucket {
  if (confidence >= 70) {
    return 'HIGH';
  }
  if (confidence >= 40) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Resolves the fixed, theme-independent color for a CONFIRMED (favorable)
 * verdict at the given confidence bucket. Flat (gradient[0]) for
 * single-color needs — borders, text, dots, shadow colors; the full
 * gradient stays available on SEMANTIC_COLORS for surfaces that can render
 * one.
 */
export function confirmedConfidenceColor(bucket: ConfidenceBucket): string {
  switch (bucket) {
    case 'HIGH':
      return SEMANTIC_COLORS.confirmedHigh[0];
    case 'MEDIUM':
      return SEMANTIC_COLORS.confirmedMedium;
    case 'LOW':
      return SEMANTIC_COLORS.confirmedLow[0];
  }
}

/** DENIED / NO verdict color — fixed, theme-independent. */
export const DENIED_COLOR: string = SEMANTIC_COLORS.denied;
