/**
 * remedyGuard — deterministic gate ensuring every remedy that reaches a seeker
 * is exclusively Islamic.
 *
 * Product decision (locked): remedies must draw ONLY from the Quran, the 99
 * Names of Allah (Asmā' al-Ḥusnā), authentic Islamic supplication / dhikr, and
 * Islamic charity (sadaqah). Nothing from Hindu/Vedic, occult, or astrological
 * "propitiation" traditions may ever appear — no gemstones, ratna, rudraksha,
 * yantra, mantra, chakra, puja/havan, graha-dosha remedies, crystals, tarot,
 * numerology, or idol/deity references.
 *
 * The oracle synthesis prompt is the first line of defence. This is the second:
 * a DETERMINISTIC scan (no LLM, cannot fail-open) over the five remedy fields.
 * If any forbidden term is found, the whole remedy object is replaced with the
 * sanctioned Islamic fallback — a corrupt remedy is never partially shown.
 */

import type { OracleResponse } from '../types';

type OracleRemedy = NonNullable<NonNullable<OracleResponse['oracle']>['remedy']>;

/**
 * The sanctioned Islamic fallback remedy. Used whenever a synthesised remedy
 * trips the guard. Quran verse + a Name of Allah + dua + dhikr + sadaqah.
 */
export const ISLAMIC_FALLBACK_REMEDY: OracleRemedy = Object.freeze({
  quran_verse: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ — Al-Imran 3:173',
  asma: 'Ya Hafiz — يا حفيظ — The Preserver. 99 times before sleep.',
  dua: 'Allahumma ihdini fiman hadayt — O Allah, guide me among those You have guided.',
  zikr: 'SubhanAllah 33 times after each prayer for three days.',
  sadaqah: 'Give water to someone who is thirsty, or to a living creature.',
});

/**
 * Forbidden vocabulary. Word-boundary, case-insensitive. Each entry is a term
 * that has no legitimate place in a Quran / Asmā' / sadaqah remedy — so a match
 * inside a remedy field is a reliable signal the content drifted non-Islamic.
 */
const FORBIDDEN_REMEDY_PATTERNS: readonly RegExp[] = [
  // Vedic gemstone / bead propitiation
  /\bnav[ ]?ratnas?\b/i,
  /\bratnas?\b/i,
  /\brattis?\b/i,
  /\brudraksh(?:a|as|am)?\b/i,
  /\bgem[ ]?stones?\b/i,
  /\bbirth[ ]?stones?\b/i,
  /\bnavgraha\b/i,
  // Ritual apparatus
  /\byantras?\b/i,
  /\bmantras?\b/i,
  /\btalismans?\b/i,
  /\bamulets?\b/i,
  /\btaw?[ei]z\b/i,
  // Hindu rites
  /\bp(?:oo|u)jas?\b/i,
  /\bhavans?\b/i,
  /\bhoma\b/i,
  /\byag(?:na|ya|ana)\b/i,
  /\bgrah[a]?[ ]?shanti\b/i,
  /\bgrah[a]?[ ]?dosha?\b/i,
  /\bdoshas?\b/i,
  /\bnivaran\b/i,
  // Occult / new-age
  /\bchakras?\b/i,
  /\bcrystals?\b/i,
  /\breiki\b/i,
  /\btarot\b/i,
  /\bnumerolog\w*\b/i,
  /\bhoroscope\b/i,
  // Idol / deity worship
  /\bidols?\b/i,
  /\bmurt[hi]?[iy]?\b/i,
  /\bdeit(?:y|ies)\b/i,
];

/**
 * Scan a single string for forbidden non-Islamic vocabulary.
 * Returns the first matched term (for logging) or null when clean.
 */
export function findForbiddenTermInText(text: string | undefined | null): string | null {
  if (typeof text !== 'string') {
    return null;
  }
  for (const pattern of FORBIDDEN_REMEDY_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Scan every string value in a remedy object for forbidden vocabulary.
 * Returns the first matched term (for logging) or null when clean.
 */
export function findForbiddenRemedyTerm(remedy: OracleRemedy | undefined | null): string | null {
  if (!remedy) {
    return null;
  }
  for (const value of Object.values(remedy)) {
    const match = findForbiddenTermInText(typeof value === 'string' ? value : null);
    if (match) {
      return match;
    }
  }
  return null;
}

export interface RemedyGuardResult {
  remedy: OracleRemedy | undefined;
  blocked: boolean;
  /** The forbidden term that triggered the block, when blocked. */
  matchedTerm?: string;
}

/**
 * Deterministic guard. If the remedy is clean it passes through untouched;
 * if any forbidden term is present the entire remedy is replaced with the
 * sanctioned Islamic fallback.
 */
export function guardOracleRemedy(remedy: OracleRemedy | undefined): RemedyGuardResult {
  const matchedTerm = findForbiddenRemedyTerm(remedy);
  if (matchedTerm === null) {
    return { remedy, blocked: false };
  }
  return { remedy: { ...ISLAMIC_FALLBACK_REMEDY }, blocked: true, matchedTerm };
}
