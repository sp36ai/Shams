/**
 * AstroVerdictResult — client-side shape of a KP/RKP oracle judgment.
 *
 * This mirrors the shape of Reading.verdictJson + Reading.chartJson as
 * returned by the Firebase oracle function. Use this type when rendering
 * verdict cards; for persistence use the Reading interface in readingsStore.
 */

import type { VerdictKind } from '@stores/readingsStore';

// ── Oracle voice fields (Claude synthesis layer) ───────────────────────────

export interface OracleRemedy {
  quran_verse?: string;
  asma?: string;
  dua?: string;
  zikr?: string;
  sadaqah?: string;
}

export interface OracleVoice {
  opening: string;
  interpretation: string;
  spiritual_layer: string;
  hidden_influence: string;
  timing?: string | null;
  warning?: string;
  remedy: OracleRemedy;
  signature: string;
}

export type { VerdictKind };

export interface HousePill {
  house: number;
  label: string;
  /** true = favorable signification, false = denial house */
  favorable: boolean;
}

export interface RulingPlanetEntry {
  planet: string;
  role: 'dayLord' | 'horaLord' | 'ascSignLord' | 'ascStarLord' | 'moonSignLord' | 'moonStarLord';
  /** true if this planet also appears in the sub-lord chain (highlighting) */
  matching: boolean;
}

export interface AstroTiming {
  window: 'days' | 'weeks' | 'months' | 'years';
  range: { min: number; max: number };
  activeDasha?: string;
  activeAntardasha?: string;
}

export interface AstroRemedy {
  planet: string;
  action: string;
  avoid: string;
  zikr?: string;
  charity?: string;
}

// ── Classical KP engine result (separate screen, see KPReadingScreen) ──────

export interface KpWitnessEntry {
  planet: string;
  role: 'dayLord' | 'ascSignLord' | 'ascStarLord' | 'moonSignLord' | 'moonStarLord';
  status: 'confirmed' | 'denied' | 'neutral';
}

export interface KpTiming {
  window: 'days' | 'weeks' | 'months' | 'years';
  range: { min: number; max: number };
  activeDasha?: string;
  activeAntardasha?: string;
}

export interface KpRemedy {
  planet: string;
  action: string;
  avoid: string;
  zikr?: string;
  charity?: string;
}

/**
 * Classical KP engine's result for a reading — rendered on its own screen
 * (KPReadingScreen), not inside the RKP chat's AstroVerdictCard/
 * WatchVerdictCard toggle. See docs/KP_RULES_CLASSICAL.md.
 */
export interface KpVerdictResult {
  verdict: VerdictKind;
  confidence: number;
  /** The 5 Classical Witnesses — no Hora Lord. */
  witnesses: KpWitnessEntry[];
  confirmedCount: number;
  deniedCount: number;
  timing?: KpTiming;
  /** Absent for DENIED verdicts (promise failed before remedy is computed). */
  remedy?: KpRemedy;
  /** Narrative in the question's language — analytical register, no jargon. */
  narrative: string;
  category: string;
  question?: string;
  createdAt: string;
  /** Classical KP's own horary-number witness (1–249), if the reading used one. */
  horaryNumber?: number;
  horarySubLord?: string;
  horarySubLordHouse?: number;
  reasoning?: ReadonlyArray<{ ruleId: string; description: string; weight: number }>;

  /**
   * 4-tier significator lists (favorable/denial/neutral) — the classical KP
   * mechanism §5 verdicts are actually derived from. "Expert" detail per
   * RKP_KP_FORENSIC_AUDIT.md §I — opaque to a general reader, but the core
   * of what a KP practitioner would want to verify.
   */
  significators?: { favorable: string[]; denial: string[]; neutral: string[] };

  /**
   * Cuspal sub-lords (promise layer) for the question's primary + secondary
   * houses — same shared computation RKP's reading already carries
   * (favorable/denial houses come from the one HOUSE_MATRIX both engines
   * use), surfaced here too since it's the literal "promise" gate KP
   * judgment starts from. "Expert" detail, see above.
   */
  cuspSubLords?: Array<{ house: number; subLord: string; subLordHouse: number }>;
}

export interface AstroVerdictResult {
  mode: 'astro';
  verdict: VerdictKind;
  confidence: number; // 0-100
  /** Moon's sub-lord planet name. */
  subLord: string;
  /** House the sub-lord occupies. */
  subLordHouse: number;
  /** Favorable and denial houses derived from the sub-lord analysis. */
  houses: HousePill[];
  rulingPlanets: RulingPlanetEntry[];
  timing?: AstroTiming;
  remedy?: AstroRemedy;
  /** Narrative in the question's language. */
  narrative: string;
  /** ISO timestamp of the chart moment. */
  createdAt: string;
  category: string;
  /** The seeker's original question text — used for the share summary. */
  question?: string;
  /**
   * Ordered trace of the engine's scoring steps that produced this verdict —
   * the same data judgeHorary() returns server-side. Shown behind "View
   * Chart Details" for anyone who wants to independently verify the
   * reading (e.g. checking it against classical KP rules with an AI).
   */
  reasoning?: ReadonlyArray<{ ruleId: string; description: string; weight: number }>;
  /** Optional: switch to numerological watch analysis. */
  onSwitchMode?: () => void;

  // ── Chart wheel display data (absent for UNCLEAR / old readings) ──────────
  planetDegrees?: Record<string, number>;
  cuspDegrees?: Record<number, number>;
  cuspSigns?: Record<number, string>;
  planetChain?: Record<string, { manzilLord: string; subLord: string; subSubLord: string }>;
  significators?: { favorable: string[]; denial: string[]; neutral: string[] };
  confirmedSignificators?: string[];
  deniedSignificators?: string[];

  /** al-Qamar's Arabic lunar mansion at chart moment — display only. */
  manzila?: {
    number: number;
    name: string;
    arabic: string;
    nature: 'benefic' | 'malefic' | 'mixed';
    element: 'fire' | 'earth' | 'air' | 'water';
    oracleDescriptor: string;
  };

  // ── Oracle voice (Claude synthesis) — absent for old readings / synthesis failure ──
  oracle?: OracleVoice;
}
