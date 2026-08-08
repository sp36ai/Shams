/**
 * remedy — shared remedy table and selection.
 * --------------------------------------------------------------------------
 * Shared by BOTH judgment engines: remedy guidance is a spiritual/product
 * addition layered on top of the judgment, not itself KP doctrine (see
 * docs/RKP_KP_FORENSIC_AUDIT.md §B — "Remedy from Moon's sub-lord planet —
 * a spiritual addition, not a KP output"). It is nonetheless part of what
 * BOTH RKP and classical KP verdicts return, using the same selection basis
 * (the Moon's Sub-Lord) so the underlying table can never drift between
 * engines. Moved out of judgeHorary.ts verbatim; no behavior change for RKP.
 */

import type { Planet } from '@astrology/types/chart';
import type { VerdictRemedy } from '@astrology/types/verdict';

export const REMEDY_TABLE: Readonly<
  Record<Planet, { action: string; avoid: string; zikr?: string; charity?: string }>
> = {
  Sun: {
    action: 'Recite Surah Ad-Duha (93) after Fajr for 7 days',
    avoid: 'Avoid arrogance and heedlessness in speech',
    zikr: 'Ya Nur × 100 daily',
    charity: 'Give sadaqah to an orphan or the poor on Sunday',
  },
  Moon: {
    action: 'Recite Ayat al-Kursi (2:255) before sleeping',
    avoid: 'Avoid emotional decisions at night',
    zikr: 'Ya Quddus × 100 daily',
    charity: 'Offer food or water to someone in need',
  },
  Mars: {
    action: 'Recite Surah Al-Falaq (113) and Al-Nas (114) seven times',
    avoid: 'Avoid anger, haste, and confrontation',
    zikr: 'Ya Matin × 100 daily',
    charity: 'Give sadaqah to protect against harm',
  },
  Mercury: {
    action: 'Recite Surah Al-Qalam (68:1) for clarity of mind and speech',
    avoid: 'Avoid falsehood and idle talk',
    zikr: 'Ya Alim × 100 daily',
    charity: 'Donate books or support education',
  },
  Jupiter: {
    action: 'Recite Surah Al-Fath (48:1) after Fajr',
    avoid: 'Avoid disrespecting scholars and elders',
    zikr: 'Ya Fattah × 70 daily',
    charity: 'Give sadaqah to a student or one seeking knowledge',
  },
  Venus: {
    action: 'Recite Surah Al-Room (30:21) on Friday after Jumuah',
    avoid: 'Avoid excess and heedlessness on Fridays',
    zikr: 'Ya Wadud × 100 daily',
    charity: 'Offer food or gifts to the needy on Friday',
  },
  Saturn: {
    action: 'Recite Surah Al-Inshirah (94) with patience each morning',
    avoid: 'Avoid complaining and ingratitude',
    zikr: 'Ya Sabur × 100 daily',
    charity: 'Give sadaqah to the elderly or those in hardship',
  },
  Rahu: {
    action: 'Recite Surah Al-Ikhlas (112) forty times after Isha',
    avoid: 'Avoid confusion, deception, and impulsive decisions',
    zikr: 'Ya Ahad × 100 daily',
    charity: 'Give sadaqah in secret to purify intention',
  },
  Ketu: {
    action: 'Recite Surah Al-Kafirun (109) each morning for clarity of purpose',
    avoid: 'Avoid doubt and spiritual neglect',
    zikr: 'Ya Hadi × 100 daily',
    charity: 'Give sadaqah to a traveller or wayfarer',
  },
};

/** The remedy for a planet, or undefined if the table has no entry (should not happen — all 9 grahas are covered). */
export function buildRemedy(moonSubLord: Planet): VerdictRemedy | undefined {
  const r = REMEDY_TABLE[moonSubLord];
  if (r === undefined) {
    return undefined;
  }
  return { planet: moonSubLord, ...r };
}

/**
 * Reasoning-trace note for the remedy pick — a plain string so each engine
 * can push it via its own `step()` helper (different ruleId/description
 * conventions per engine) rather than this module dictating one.
 */
export function remedyReasoningNote(moonSubLord: Planet): string {
  return `Remedy planet = Moon's Sub-Lord ${moonSubLord} (PROVISIONAL — owner cultural text pending)`;
}
