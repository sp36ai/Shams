/**
 * remedyRenderer — display-ready remedy objects for the UI layer.
 *
 * The library stores no descriptions — titles come from the library,
 * descriptions are derived at render time from effectDimensionLabel.
 * This module maps selected TaggedRemedy objects to the shape AstroVerdictCard expects.
 */

import { REMEDY_LIBRARY, type RemedyTag, type TaggedRemedy } from './remedyLibrary';

export interface RenderedRemedy {
  id: string;
  title: string;
  category: string;
  effectDimension: string;
  intensity: 'gentle' | 'moderate' | 'deep';
  themeTags: RemedyTag[];
}

/** Look up remedy objects by ID, preserving selection order. */
export function renderRemedies(selectedIds: string[]): RenderedRemedy[] {
  return selectedIds
    .map(id => REMEDY_LIBRARY.find(r => r.id === id))
    .filter((r): r is TaggedRemedy => r !== undefined)
    .map(r => ({
      id: r.id,
      title: remedyTitle(r.id),
      category: r.category,
      effectDimension: r.effectDimension,
      intensity: r.intensity,
      themeTags: r.themeTags,
    }));
}

/** Returns true if remedy content is available for this reading context. */
export function hasRemedyContent(selectedIds: string[]): boolean {
  return selectedIds.some(id => REMEDY_LIBRARY.some(r => r.id === id));
}

/**
 * Curated title map — keyed by remedy ID.
 * Titles are sacred-register display strings, never generated.
 */
const REMEDY_TITLES: Record<string, string> = {
  salawat_01: 'Salawat Upon the Prophet',
  salawat_02: 'Salawat as Anchor in Storm',
  salawat_03: 'Salawat as Balm for the Heart',
  dua_01: 'Dua of Release and Surrender',
  dua_02: 'Dua for Provision and Sufficiency',
  dua_03: 'Dua for Mending What Is Broken',
  dua_04: 'Dua in the Place of Loss',
  dua_05: 'Dua Against Stagnation',
  istikhara_01: 'Salat al-Istikhara — The Prayer of Seeking',
  istikhara_02: 'Istikhara for a Scattered Mind',
  sadaqa_01: 'Sadaqa as the Opening of Closed Doors',
  sadaqa_02: 'Sadaqa Offered in Grief',
  sadaqa_03: 'Sadaqa to Soften the Ego',
  sadaqa_04: 'Sadaqa and the Trust of Provision',
  fasting_01: 'A Voluntary Fast to Still the Body',
  fasting_02: 'A Fast to Humble the Self',
  fasting_03: 'A Fast Held in Grief',
  quran_01: 'Recitation for Inner Quiet',
  quran_02: 'Recitation to Clear the Spiritual Path',
  quran_03: 'Recitation as Comfort in Loss',
  quran_04: 'Recitation and Trust in Provision',
  dhikr_01: 'Dhikr as Grounding for a Restless Heart',
  dhikr_02: 'Dhikr as Comfort in Sorrow',
  dhikr_03: 'Dhikr While Waiting',
  dhikr_04: 'Dhikr of Gratitude for What Has Arrived',
  charity_01: 'Giving to Open What Is Blocked',
  charity_02: 'Giving to Soften What Pride Has Hardened',
  charity_03: 'Giving as a Response to Loss',
  gratitude_04: 'Sharing the Good That Has Come',
  night_prayer_01: 'Tahajjud as Spiritual Return',
  night_prayer_02: 'Tahajjud in the Night of Worry',
  night_prayer_03: 'Tahajjud and the Surrender of Outcome',
  silence_01: 'A Day of Deliberate Stillness',
  silence_02: 'Silence Before the Hasty Word',
  silence_03: 'Sitting With What Cannot Be Spoken',
  tawbah_01: 'Tawbah as the Clearing of What Blocks',
  tawbah_02: 'Tawbah for What Was Left Unrepaired',
  tawbah_03: 'Tawbah in the Moment of Doubt',
};

function remedyTitle(id: string): string {
  return REMEDY_TITLES[id] ?? id;
}
