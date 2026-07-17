/**
 * Guard test — the client practice-library remedies must remain exclusively
 * Islamic. Product decision (locked): remedies draw only from the Quran, the
 * 99 Names of Allah, Islamic supplication / dhikr, and Islamic charity. This
 * test scans every remedy category and its user-visible rendered title for
 * Hindu / Vedic / occult / astrological vocabulary so no non-Islamic practice
 * can be added to the library unnoticed.
 */

import { REMEDY_LIBRARY, type RemedyCategory } from '../remedyLibrary';
import { renderRemedies } from '../remedyRenderer';

// Every category in the library must be one of these Islamic practice forms.
const ALLOWED_CATEGORIES: ReadonlySet<RemedyCategory> = new Set<RemedyCategory>([
  'salawat',
  'dua',
  'istikhara',
  'sadaqa',
  'fasting',
  'quran',
  'dhikr',
  'charity',
  'night_prayer',
  'silence',
  'tawbah',
]);

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bnav[ ]?ratnas?\b/i,
  /\bratnas?\b/i,
  /\brudraksh\w*\b/i,
  /\bgem[ ]?stones?\b/i,
  /\byantras?\b/i,
  /\bmantras?\b/i,
  /\btalismans?\b/i,
  /\bamulets?\b/i,
  /\btaw?[ei]z\b/i,
  /\bp(?:oo|u)jas?\b/i,
  /\bhavans?\b/i,
  /\bhoma\b/i,
  /\bgrah[a]?[ ]?(?:shanti|dosha?)\b/i,
  /\bdoshas?\b/i,
  /\bchakras?\b/i,
  /\bcrystals?\b/i,
  /\breiki\b/i,
  /\btarot\b/i,
  /\bnumerolog\w*\b/i,
  /\bidols?\b/i,
  /\bdeit(?:y|ies)\b/i,
];

describe('remedy library is exclusively Islamic', () => {
  test('every remedy category is an allowed Islamic practice', () => {
    for (const remedy of REMEDY_LIBRARY) {
      expect(ALLOWED_CATEGORIES.has(remedy.category)).toBe(true);
    }
  });

  test('no rendered remedy title contains non-Islamic vocabulary', () => {
    const allIds = REMEDY_LIBRARY.map(r => r.id);
    const rendered = renderRemedies(allIds);
    expect(rendered).toHaveLength(REMEDY_LIBRARY.length);

    for (const remedy of rendered) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(remedy.title).not.toMatch(pattern);
      }
    }
  });
});
