/**
 * textMutators.ts — reusable, deterministic text-transform primitives shared
 * across every Phase 5C mutation category. No randomness — every function
 * is a pure, seed-free transform so the whole harness is reproducible byte
 * for byte on every run.
 */

export function upper(s: string): string {
  return s.toUpperCase();
}

export function lower(s: string): string {
  return s.toLowerCase();
}

/** Alternate character-by-character casing — a common obfuscation shape. */
export function alternatingCase(s: string): string {
  let out = '';
  let flip = false;
  for (const ch of s) {
    out += flip ? ch.toUpperCase() : ch.toLowerCase();
    if (/[a-zA-Z]/.test(ch)) {
      flip = !flip;
    }
  }
  return out;
}

/** Doubles every space and adds leading/trailing padding. */
export function extraWhitespace(s: string): string {
  return `   ${s.replace(/ /g, '  ')}   `;
}

/** Replaces spaces with tabs. */
export function tabsInsteadOfSpaces(s: string): string {
  return s.replace(/ /g, '\t');
}

/** Inserts a zero-width joiner inside every word longer than 3 chars, at its midpoint. */
export function insertZeroWidthJoiner(s: string): string {
  return s.replace(/\b(\w{4,})\b/g, w => {
    const mid = Math.floor(w.length / 2);
    return w.slice(0, mid) + '‍' + w.slice(mid);
  });
}

/** Same, but zero-width non-joiner. */
export function insertZeroWidthNonJoiner(s: string): string {
  return s.replace(/\b(\w{4,})\b/g, w => {
    const mid = Math.floor(w.length / 2);
    return w.slice(0, mid) + '‌' + w.slice(mid);
  });
}

/** Same, but a zero-width space. */
export function insertZeroWidthSpace(s: string): string {
  return s.replace(/\b(\w{4,})\b/g, w => {
    const mid = Math.floor(w.length / 2);
    return w.slice(0, mid) + '​' + w.slice(mid);
  });
}

/** Wraps the whole string in RTL override/mark characters. */
export function wrapRtl(s: string): string {
  return `‏${s}‏`;
}

/** Replaces plain ASCII letters with NFKC-equivalent fullwidth forms for a few common letters. */
export function fullwidthify(s: string): string {
  const map: Record<string, string> = {
    a: 'ａ', e: 'ｅ', i: 'ｉ', o: 'ｏ', s: 'ｓ', t: 'ｔ', r: 'ｒ',
  };
  return s.replace(/[aeiostr]/g, ch => map[ch] ?? ch);
}

/** Adds combining diacritics after vowels (decomposed form — base + combining mark, two codepoints). */
export function addCombiningMarks(s: string): string {
  return s.replace(/[aeiou]/g, ch => ch + '́');
}

/**
 * PHASE 5C-R: same visual effect as `addCombiningMarks`, but PRECOMPOSED —
 * a single codepoint (e.g. "á" U+00E1) rather than base+combining-mark.
 * Distinct attack shape: a naive "strip Unicode category Mn" fix (compose
 * first via NFKC, then strip Mn) would miss this, since a precomposed
 * character carries no separate Mn codepoint to strip — the actual reason
 * `canonicalizeForSecurityMatching` decomposes (NFKD) BEFORE stripping,
 * not after. This mutator exists specifically to prove that ordering
 * matters, not just to duplicate `addCombiningMarks`.
 */
export function precomposedAccent(s: string): string {
  const map: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
  return s.replace(/[aeiou]/g, ch => map[ch] ?? ch);
}

/** Inserts a word joiner (U+2060, category Cf) inside every word longer than 3 chars. */
export function insertWordJoiner(s: string): string {
  return s.replace(/\b(\w{4,})\b/g, w => {
    const mid = Math.floor(w.length / 2);
    return w.slice(0, mid) + '⁠' + w.slice(mid);
  });
}

/** Inserts a left-to-right mark (U+200E, category Cf, a bidi control) inside every word longer than 3 chars. */
export function insertBidiControl(s: string): string {
  return s.replace(/\b(\w{4,})\b/g, w => {
    const mid = Math.floor(w.length / 2);
    return w.slice(0, mid) + '‎' + w.slice(mid);
  });
}

/** Inserts a variation selector (U+FE0F, category Mn) inside every word longer than 3 chars. */
export function insertVariationSelector(s: string): string {
  return s.replace(/\b(\w{4,})\b/g, w => {
    const mid = Math.floor(w.length / 2);
    return w.slice(0, mid) + '️' + w.slice(mid);
  });
}

/** Adds excessive punctuation. */
export function excessivePunctuation(s: string): string {
  return s.replace(/\./g, '!!!').replace(/,/g, ',,,');
}

/** Wraps in smart/curly quotes. */
export function smartQuotes(s: string): string {
  return `“${s}”`;
}

/** Title-cases every word — a common stylistic variant, no internal chars altered. */
export function titleCase(s: string): string {
  return s.replace(/\b\w/g, ch => ch.toUpperCase());
}

/** Collapses any run of whitespace to a single space (opposite of extraWhitespace). */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Appends a single zero-width space at the very END of the string, outside
 * any word — contrasts with the mid-word insertions below (UNICODE_AXES in
 * generators.ts), which land INSIDE a target phrase and are what actually
 * defeats substring matching. This variant changes nothing about any
 * phrase's own characters, so it is a genuine presentation-neutral control.
 */
export function appendTrailingZeroWidthSpace(s: string): string {
  return `${s}​`;
}

export const PRESENTATION_MUTATORS: ReadonlyArray<{ name: string; fn: (s: string) => string }> = [
  { name: 'upper', fn: upper },
  { name: 'lower', fn: lower },
  { name: 'alternatingCase', fn: alternatingCase },
  { name: 'extraWhitespace', fn: extraWhitespace },
  { name: 'tabsInsteadOfSpaces', fn: tabsInsteadOfSpaces },
  { name: 'zeroWidthJoiner', fn: insertZeroWidthJoiner },
  { name: 'zeroWidthNonJoiner', fn: insertZeroWidthNonJoiner },
  { name: 'zeroWidthSpace', fn: insertZeroWidthSpace },
  { name: 'wordJoiner', fn: insertWordJoiner },
  { name: 'bidiControl', fn: insertBidiControl },
  { name: 'variationSelector', fn: insertVariationSelector },
  { name: 'wrapRtl', fn: wrapRtl },
  { name: 'fullwidthify', fn: fullwidthify },
  { name: 'addCombiningMarks', fn: addCombiningMarks },
  { name: 'precomposedAccent', fn: precomposedAccent },
  { name: 'excessivePunctuation', fn: excessivePunctuation },
  { name: 'smartQuotes', fn: smartQuotes },
  { name: 'titleCase', fn: titleCase },
  { name: 'collapseWhitespace', fn: collapseWhitespace },
  { name: 'appendTrailingZeroWidthSpace', fn: appendTrailingZeroWidthSpace },
];
