/**
 * houseMatrix.ts — RKP House Signification Matrix
 * Source of truth: docs/RKP_RULES_FROM_SARFARAZ.md §2
 */

export interface HouseGroup {
  favorable: number[];
  denial: number[];
  primary: number;
  secondary: number[];
}

export const HOUSE_MATRIX: Record<string, HouseGroup> = {
  career: { favorable: [6, 10, 11], denial: [5, 8, 12], primary: 10, secondary: [6, 11] },
  marriage: { favorable: [7, 11, 2], denial: [6, 8, 12], primary: 7, secondary: [2, 11] },
  finance: { favorable: [2, 6, 11], denial: [8, 12], primary: 2, secondary: [6, 11] },
  health: { favorable: [1, 5, 11], denial: [6, 8, 12], primary: 1, secondary: [5, 11] },
  property: { favorable: [4, 11, 2], denial: [8, 12], primary: 4, secondary: [11, 2] },
  travel: { favorable: [3, 9, 12], denial: [], primary: 9, secondary: [3, 12] },
  business: { favorable: [7, 10, 11], denial: [6, 8, 12], primary: 7, secondary: [10, 11] },
  legal: { favorable: [6, 11], denial: [8, 12], primary: 6, secondary: [11] },
  children: { favorable: [5, 11, 2], denial: [1, 4, 10], primary: 5, secondary: [2, 11] },
  education: { favorable: [4, 9, 11], denial: [8, 12], primary: 4, secondary: [9, 11] },
  lostitem: { favorable: [2, 4, 11], denial: [8, 12], primary: 2, secondary: [4, 11] },
  enemies: { favorable: [6, 11], denial: [8, 12], primary: 6, secondary: [11] },
  spiritual: { favorable: [5, 9, 12], denial: [6, 8], primary: 9, secondary: [5, 12] },
  general: { favorable: [1, 11], denial: [8, 12], primary: 1, secondary: [11] },
};

/** Remedies mapping for Step 5 narration/trace */
export const REMEDY_DATA: Record<string, { action: string; avoid: string; mantra: string; charity: string }> = {
  Sun: { action: 'Offer water to the Sun', avoid: 'Salt on Sundays', mantra: 'Om Hraam Hreem Hroum Sah Suryaya Namah', charity: 'Wheat or Copper' },
  Moon: { action: 'Respect mother-figures', avoid: 'Late night milk', mantra: 'Om Shraam Shreem Shroum Sah Chandramase Namah', charity: 'Rice or Silver' },
  Mars: { action: 'Physical exercise', avoid: 'Spicy food', mantra: 'Om Kraam Kreem Kroum Sah Bhaumaya Namah', charity: 'Red lentils or Coral' },
  Mercury: { action: 'Plant green trees', avoid: 'Using harsh words', mantra: 'Om Braam Breem Broum Sah Budhaya Namah', charity: 'Green gram or Emerald' },
  Jupiter: { action: 'Listen to elders', avoid: 'Disrespecting teachers', mantra: 'Om Graam Greem Groum Sah Gurave Namah', charity: 'Chana dal or Yellow cloth' },
  Venus: { action: 'Keep environment clean', avoid: 'Laziness', mantra: 'Om Draam Dreem Droum Sah Shukraya Namah', charity: 'Sugar or White silk' },
  Saturn: { action: 'Help the needy', avoid: 'Lying or cheating', mantra: 'Om Praam Preem Proum Sah Shanaye Namah', charity: 'Black sesame or Iron' },
  Rahu: { action: 'Social service', avoid: 'Intoxicants', mantra: 'Om Bhraam Bhreem Bhroum Sah Rahave Namah', charity: 'Coconut or Lead' },
  Ketu: { action: 'Meditation', avoid: 'Isolation', mantra: 'Om Sraam Sreem Sroum Sah Ketave Namah', charity: 'Blankets or Flag' },
};