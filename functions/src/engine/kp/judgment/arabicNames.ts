/**
 * arabicNames — shared planet -> Arabic name lookup for narration.
 * Extracted from judgeHorary.ts so judgeRKPWatch.ts speaks with the same
 * oracle voice instead of duplicating the table.
 */

import type { Planet } from '../../types/chart';

export const ARABIC_PLANET: Readonly<Record<string, string>> = {
  Sun: 'Shams',
  Moon: 'al-Qamar',
  Mars: 'al-Mirrikh',
  Mercury: 'Utarid',
  Jupiter: 'Mushtari',
  Venus: 'Zuhra',
  Saturn: 'Zuhal',
  Rahu: "al-Ra's",
  Ketu: 'al-Dhanab',
};

export function toArabic(planet: Planet | string): string {
  return ARABIC_PLANET[planet] ?? planet;
}
