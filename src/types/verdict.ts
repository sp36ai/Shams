/**
 * AstroVerdictResult — client-side shape of a KP/RKP oracle judgment.
 *
 * This mirrors the shape of Reading.verdictJson + Reading.chartJson as
 * returned by the Firebase oracle function. Use this type when rendering
 * verdict cards; for persistence use the Reading interface in readingsStore.
 */

import type { VerdictKind } from '@stores/readingsStore';

export type { VerdictKind };

export interface HousePill {
  house: number;
  label: string;
  /** true = favorable signification, false = denial house */
  favorable: boolean;
}

export interface RulingPlanetEntry {
  planet: string;
  role: 'dayLord' | 'horaLord' | 'minuteLord';
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
  mantra?: string;
  charity?: string;
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
  /** Optional: switch to numerological watch analysis. */
  onSwitchMode?: () => void;
}
