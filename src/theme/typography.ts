/**
 * Typography tokens — Dār al-Shams
 * --------------------------------------------------------------------------
 * SACRED MANUSCRIPT TYPOGRAPHY SYSTEM
 * 
 * The app must feel like an illuminated manuscript vault.
 * Typography must be: engraved, ceremonial, archival.
 * 
 * Three script families:
 *   - Latin (EN)        : Cinzel (engraved headings) + Spectral (manuscript body)
 *   - Arabic (UR, RTL)  : Amiri (Quranic, stable, reverent, highly legible)
 *   - Devanagari (HI)   : Noto Sans Devanagari
 *
 * CRITICAL RULES:
 * - Arabic must feel Quranic, not decorative
 * - RTL blocks need increased line-height, centered alignment
 * - Headings must feel engraved and ceremonial
 * - Body text must be readable manuscript prose
 * - Never use decorative Arabic fonts everywhere
 * 
 * Resolution rule:
 *   if lang === 'ur' → use arabic set with elevated lineHeight (2.1)
 *   if lang === 'hi' → use devanagari set
 *   else             → use latin set
 */

import type { TextStyle } from 'react-native';

import type { LangCode } from '@i18n/types';

// Family names match the PostScript names of the bundled .ttf/.otf files.
// react-native.config.js (or manual linking) registers them under these names.
export const FONT_FAMILIES = Object.freeze({
  latin: {
    display: 'Cinzel-SemiBold',
    displayBold: 'Cinzel-Bold',
    body: 'Spectral-Regular',
    bodyMedium: 'Spectral-Medium',
    bodySemiBold: 'Spectral-SemiBold',
    bodyItalic: 'Spectral-Italic',
  },
  urdu: {
    display: 'Amiri-Bold',
    displayBold: 'Amiri-Bold',
    body: 'Amiri-Regular',
    bodyMedium: 'Amiri-Regular',
    bodySemiBold: 'Amiri-Bold',
    bodyItalic: 'Amiri-Regular',
  },
  devanagari: {
    display: 'NotoSansDevanagari-Bold',
    displayBold: 'NotoSansDevanagari-Bold',
    body: 'NotoSansDevanagari-Regular',
    bodyMedium: 'NotoSansDevanagari-Medium',
    bodySemiBold: 'NotoSansDevanagari-SemiBold',
    bodyItalic: 'NotoSansDevanagari-Regular',
  },
});

export type FontRole = keyof typeof FONT_FAMILIES.latin;
export type ScriptFamily = keyof typeof FONT_FAMILIES;

// Per-script line-height multipliers. Nastaliq glyphs need much more vertical
// space than Latin or Devanagari; 2.1 is the minimum that prevents clipping
// of diacritics and connecting strokes on real Android devices.
export const LINE_HEIGHT_MULTIPLIER: Record<ScriptFamily, number> = {
  latin: 1.35,
  urdu: 2.1,
  devanagari: 1.55,
};

export interface TypographyVariant {
  fontSize: number;
  /** Letter spacing in dp (RN unit) */
  letterSpacing: number;
  /** Font weight is set via fontFamily PostScript name (Cinzel-Bold etc).
   *  Keeping `weight` here for accessibility / future system-font fallback. */
  weight: TextStyle['fontWeight'];
  /** Which family slot to use within the active script set */
  role: FontRole;
}

// Variant scale — tuned for Cinzel display + Spectral body
// Arabic (Amiri) sizes are bumped +2dp at runtime for optical balance
export const TYPOGRAPHY_VARIANTS = Object.freeze({
  /** Splash brand wordmark, verdict seal */
  hero: { fontSize: 52, letterSpacing: 2.0, weight: '700' as const, role: 'displayBold' as const },
  /** Screen titles */
  title: { fontSize: 30, letterSpacing: 1.2, weight: '600' as const, role: 'display' as const },
  /** Section headers */
  heading: {
    fontSize: 22,
    letterSpacing: 0.8,
    weight: '600' as const,
    role: 'displayBold' as const,
  },
  /** Subheading / card title */
  subheading: {
    fontSize: 18,
    letterSpacing: 0.5,
    weight: '600' as const,
    role: 'bodySemiBold' as const,
  },
  /** Standard manuscript body */
  body: { fontSize: 17, letterSpacing: 0.3, weight: '400' as const, role: 'body' as const },
  /** Emphasis within body */
  bodyEmphasis: {
    fontSize: 17,
    letterSpacing: 0.3,
    weight: '500' as const,
    role: 'bodyMedium' as const,
  },
  /** Italic body */
  bodyItalic: {
    fontSize: 17,
    letterSpacing: 0.3,
    weight: '400' as const,
    role: 'bodyItalic' as const,
  },
  /** Secondary text */
  caption: { fontSize: 14, letterSpacing: 0.4, weight: '400' as const, role: 'body' as const },
  /** Small label */
  label: {
    fontSize: 13,
    letterSpacing: 1.2,
    weight: '600' as const,
    role: 'bodySemiBold' as const,
  },
  /** Button text */
  button: {
    fontSize: 17,
    letterSpacing: 1.4,
    weight: '600' as const,
    role: 'displayBold' as const,
  },
}) satisfies Readonly<Record<string, TypographyVariant>>;

export type TypographyVariantId = keyof typeof TYPOGRAPHY_VARIANTS;

/**
 * Pure resolver — given variant + active language, return a complete RN TextStyle.
 * Used by useTypography(). Kept pure so theme/i18n providers can memoize cleanly.
 */
export function resolveVariant(variantId: TypographyVariantId, lang: LangCode): TextStyle {
  const variant = TYPOGRAPHY_VARIANTS[variantId];
  const family: ScriptFamily = lang === 'ur' ? 'urdu' : lang === 'hi' ? 'devanagari' : 'latin';
  const familySet = FONT_FAMILIES[family];
  const fontFamily = familySet[variant.role];

  // Nastaliq optical-size bump: +2dp for body/caption/label, +3dp for headings,
  // none for hero (already huge). This compensates for Nastaliq's smaller x-height.
  let fontSize = variant.fontSize;
  if (family === 'urdu') {
    if (variantId === 'caption' || variantId === 'label') {
      fontSize += 1;
    } else if (variantId === 'body' || variantId === 'bodyEmphasis' || variantId === 'bodyItalic') {
      fontSize += 2;
    } else if (variantId === 'subheading' || variantId === 'heading' || variantId === 'title') {
      fontSize += 3;
    }
  }

  return {
    fontFamily,
    fontSize,
    letterSpacing: family === 'urdu' ? 0 : variant.letterSpacing, // Nastaliq must not be letter-spaced
    fontWeight: variant.weight,
    lineHeight: Math.round(fontSize * LINE_HEIGHT_MULTIPLIER[family]),
    // Critical for Urdu rendering on Android — without this, Nastaliq baselines
    // get clipped at the bottom of TextInput/Text components.
    includeFontPadding: family === 'urdu' ? true : false,
    textAlignVertical: 'center',
  };
}
