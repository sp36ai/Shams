/**
 * favoredQuestion — "this hour favors…" mapping for the home dashboard.
 * --------------------------------------------------------------------------
 * Classical significations of the current hora lord, mapped onto the
 * existing quick-reply chip categories (see INITIAL_CHIPS in
 * oracleChips.ts) so the home screen can point at the exact chip that's
 * astrologically favored right now. Traditional rationale per planet:
 *
 *   Sun     — authority, standing, career
 *   Moon    — body, mind, domestic/health matters
 *   Mars    — conflict, courage, disputes
 *   Mercury — documents, details, missing things (KP's classic significator
 *             for lost-and-found queries)
 *   Jupiter — wealth, growth, fortune
 *   Venus   — relationships, love, beauty
 *   Saturn  — delay and patience — fits a broad "will it happen" question
 *   Rahu    — foreign lands, sudden/unplanned travel
 *   Ketu    — detachment/hidden matters — no clean chip fit, falls back to
 *             the same broad "will it happen" as Saturn
 */

import type { Planet } from '@astrology/types/chart';
import { INITIAL_CHIPS } from './oracleChips';

type Lang = 'en' | 'ur' | 'hi';

const CHIP_INDEX: Record<Planet, number> = {
  Sun: 1, // Career & livelihood
  Moon: 4, // Health
  Mars: 6, // Legal matter
  Mercury: 7, // Lost item
  Jupiter: 3, // Finance
  Venus: 2, // Marriage & love
  Saturn: 0, // Will I succeed?
  Rahu: 5, // Travel
  Ketu: 0, // Will I succeed?
};

export function favoredChipForPlanet(planet: Planet, lang: Lang): string {
  const chips = INITIAL_CHIPS[lang] ?? INITIAL_CHIPS.en;
  const idx = CHIP_INDEX[planet] ?? 0;
  return chips[idx] ?? chips[0] ?? '';
}
