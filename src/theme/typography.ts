/**
 * Typography tokens — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Three script families per master prompt:
 *   - Latin (EN)        : Cinzel (display) + Cormorant Garamond (body)
 *   - Urdu (UR, RTL)    : Noto Nastaliq Urdu (everything; Cinzel fallback)
 *   - Devanagari (HI)   : Noto Sans Devanagari (everything; Cinzel fallback)
 *
 * Fonts are bundled via assets/fonts/ + react-native.config.js.
 *
 * Resolution rule (consumed by useTypography hook):
 *   if lang === 'ur' → use urdu set with elevated lineHeight (2.1)
 *   if lang === 'hi' → use devanagari set
 *   else             → use latin set
 *
 * NEVER hardcode fontFamily strings in screens. Always go through the hook
 * so language changes re-style everything in one frame.
 */

import type { TextStyle } from 'react-native';

import type { LangCode } from '@i18n/types';

// Family names match the PostScript names of the bundled .ttf/.otf files.
// react-native.config.js (or manual linking) registers them under these names.
export const FONT_FAMILIES = Object.freeze({
  latin: {
    display: 'Cinzel-SemiBold',
    displayBold: 'Cinzel-Bold',
    body: 'CormorantGaramond-Regular',
    bodyMedium: 'CormorantGaramond-Medium',
    bodySemiBold: 'CormorantGaramond-SemiBold',
    bodyItalic: 'CormorantGaramond-Italic',
  },
  urdu: {
    display: 'NotoNastaliqUrdu-Bold',
    displayBold: 'NotoNastaliqUrdu-Bold',
    body: 'NotoNastaliqUrdu-Regular',
    bodyMedium: 'NotoNastaliqUrdu-Medium',
    bodySemiBold: 'NotoNastaliqUrdu-SemiBold',
    // Nastaliq has no native italic; fall back to regular for type safety
    bodyItalic: 'NotoNastaliqUrdu-Regular',
  },
  devanagari: {
    display: 'NotoSansDevanagari-Bold',
    displayBold: 'NotoSansDevanagari-Bold',
    body: 'NotoSansDevanagari-Regular',
    bodyMedium: 'NotoSansDevanagari-Medium',
    bodySemiBold: 'NotoSansDevanagari-SemiBold',
    // No italic shipped; fall back to regular
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

// Variant scale — tuned for Cinzel display + Cormorant body at @1x dp.
// Nastaliq sizes are bumped +2dp at runtime in useTypography() because
// Nastaliq optical size reads smaller than Latin at the same point size.
export const TYPOGRAPHY_VARIANTS = Object.freeze({
  /** Splash brand wordmark, hero verdict word ("YES" / "NO") */
  hero: { fontSize: 48, letterSpacing: 1.5, weight: '700' as const, role: 'displayBold' as const },
  /** Screen titles ("The Oracle Speaks", "Sky Clock") */
  title: { fontSize: 28, letterSpacing: 1.0, weight: '600' as const, role: 'display' as const },
  /** Section headers within a screen ("Your Question", "Reasoning") */
  heading: {
    fontSize: 20,
    letterSpacing: 0.6,
    weight: '600' as const,
    role: 'displayBold' as const,
  },
  /** Subheading / card title */
  subheading: {
    fontSize: 17,
    letterSpacing: 0.4,
    weight: '600' as const,
    role: 'bodySemiBold' as const,
  },
  /** Standard body — chat messages, descriptions */
  body: { fontSize: 16, letterSpacing: 0.2, weight: '400' as const, role: 'body' as const },
  /** Emphasis within body */
  bodyEmphasis: {
    fontSize: 16,
    letterSpacing: 0.2,
    weight: '500' as const,
    role: 'bodyMedium' as const,
  },
  /** Italic body — used for Sanskrit terms inline */
  bodyItalic: {
    fontSize: 16,
    letterSpacing: 0.2,
    weight: '400' as const,
    role: 'bodyItalic' as const,
  },
  /** Secondary / caption text — timestamps, hints */
  caption: { fontSize: 13, letterSpacing: 0.3, weight: '400' as const, role: 'body' as const },
  /** Small label — chip text, badges */
  label: {
    fontSize: 12,
    letterSpacing: 1.0,
    weight: '600' as const,
    role: 'bodySemiBold' as const,
  },
  /** Button text */
  button: {
    fontSize: 16,
    letterSpacing: 1.2,
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
