/**
 * readingDesign — the drawing primitives of the Reading screen's design.
 * --------------------------------------------------------------------------
 * The production design (Claude Design handoff, "Prod 3 Reading", 2026-11-16)
 * draws the Reading from a handful of shared parts: a seal (tick ring, two
 * turned squares, a core), small line icons, a diamond-led section eyebrow,
 * strength pips and a caps "meta" line. They live here so the bubble, the
 * verdict seal, the composer and the screen header all draw them the same way.
 *
 * Presentation only. Nothing here reads a reading or decides anything about
 * one: callers pass the colours and counts they already hold. Colours always
 * come from the active theme (never the design's sample palette), so every
 * theme keeps working.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTypography } from '@theme/useTypography';
import { useI18n } from '@i18n/I18nProvider';
import { FONT_FAMILIES } from '@theme/typography';

/* -------------------------------------------------------------------------- */
/*  Text styles                                                               */
/* -------------------------------------------------------------------------- */

export interface ReadingText {
  /** Section eyebrow: caps, wide tracking ("CELESTIAL INTERPRETATION"). */
  eyebrow: TextStyle;
  /** Meta line: caps, small ("21:14 · SENT", "CAST MON 16 NOV · 21:14"). */
  meta: TextStyle;
  /** Header title ("Marriage · Reading"). */
  title: TextStyle;
  /** Button label: caps ("ASK AGAIN"). */
  button: TextStyle;
  /** Verdict headline under the seal. */
  headline: TextStyle;
  /** Bubble / section body. */
  body: TextStyle;
  /** Quiet italic line (signature, notes). */
  italic: TextStyle;
}

/**
 * The design's type scale on the app's own fonts (Cinzel for display, the
 * body face for prose). Caps and letter-spacing apply to Latin only: Urdu
 * (Nastaliq/Amiri) must never be letter-spaced or upper-cased, and Hindi has
 * no case — both fall back to the app's caption/label styles at sizes that
 * stay readable in those scripts.
 */
export function useReadingText(): ReadingText {
  const typography = useTypography();
  const { lang } = useI18n();
  return useMemo(() => {
    const latin = lang === 'en';
    const cinzel = (size: number, tracking: number, bold = false): TextStyle =>
      latin
        ? {
            fontFamily: bold ? FONT_FAMILIES.latin.displayBold : FONT_FAMILIES.latin.display,
            fontSize: size,
            lineHeight: Math.round(size * 1.3),
            letterSpacing: Math.round(size * tracking * 10) / 10,
            textTransform: 'uppercase',
            includeFontPadding: false,
          }
        : typography('label');
    return {
      eyebrow: cinzel(10.5, 0.22),
      meta: cinzel(10, 0.14),
      button: cinzel(12, 0.14, true),
      title: latin
        ? {
            fontFamily: FONT_FAMILIES.latin.display,
            fontSize: 15,
            lineHeight: 20,
            letterSpacing: 0.9,
            includeFontPadding: false,
          }
        : typography('subheading'),
      headline: { ...typography('heading'), fontSize: latin ? 23 : typography('heading').fontSize },
      body: typography('body'),
      italic: typography('bodyItalic'),
    };
  }, [typography, lang]);
}

/* -------------------------------------------------------------------------- */
/*  Seal                                                                      */
/* -------------------------------------------------------------------------- */

interface SealGlyphProps {
  size: number;
  /** Ring, ticks and the verdict's tone. */
  color: string;
  /** The turned squares and the core. Defaults to `color`. */
  hiColor?: string;
  /** Inner disc fill (the card's surface), so the glow reads as a halo. */
  fillColor?: string;
  /** The full seal (tick ring, inner disc, glow) or the mini author seal. */
  variant?: 'full' | 'mini';
  /** Draw only the ring layer, or only the squares+core layer (for animation). */
  layer?: 'all' | 'ring' | 'star';
}

/** Tick angles, every 15° — the design's 24-tick outer ring. */
const TICKS = Array.from({ length: 24 }, (_, i) => (i * 15 * Math.PI) / 180);

/**
 * The Shams seal: a tick ring, two squares turned 45° to each other, a core.
 * Drawn on a 100-unit box and scaled to `size`, so the same shape serves as
 * the 22 dp author mark and the 116 dp verdict seal.
 */
export const SealGlyph: React.FC<SealGlyphProps> = ({
  size,
  color,
  hiColor,
  fillColor = 'transparent',
  variant = 'full',
  layer = 'all',
}) => {
  const hi = hiColor ?? color;
  const mini = variant === 'mini';
  const showRing = layer !== 'star';
  const showStar = layer !== 'ring';
  // The mini mark's squares sit wider in its circle, as in the design.
  const sq = mini ? 46 : 40;
  const sqStart = (100 - sq) / 2;
  const stroke = mini ? 4.5 : 1.4;
  const gradientId = `sealGlow-${variant}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {!mini && (
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="38%" ry="38%">
            <Stop offset="0" stopColor={color} stopOpacity={0.32} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
      )}
      {showRing && mini && (
        <Circle cx="50" cy="50" r="47" stroke={color} strokeWidth={4.5} fill="none" />
      )}
      {showRing && !mini && (
        <G>
          {TICKS.map(a => (
            <Line
              key={a}
              x1={50 + 49.5 * Math.cos(a)}
              y1={50 + 49.5 * Math.sin(a)}
              x2={50 + 46 * Math.cos(a)}
              y2={50 + 46 * Math.sin(a)}
              stroke={color}
              strokeWidth={1}
            />
          ))}
          <Circle cx="50" cy="50" r="46" stroke={color} strokeWidth={0.9} fill={fillColor} />
          <Circle
            cx="50"
            cy="50"
            r="38"
            stroke={color}
            strokeOpacity={0.22}
            strokeWidth={0.9}
            fill={`url(#${gradientId})`}
          />
        </G>
      )}
      {showStar && (
        <G>
          <Rect
            x={sqStart}
            y={sqStart}
            width={sq}
            height={sq}
            stroke={hi}
            strokeWidth={stroke}
            fill="none"
          />
          <Rect
            x={sqStart}
            y={sqStart}
            width={sq}
            height={sq}
            stroke={hi}
            strokeWidth={stroke}
            fill="none"
            transform="rotate(45 50 50)"
          />
          {!mini && <Circle cx="50" cy="50" r="6" fill={hi} />}
        </G>
      )}
    </Svg>
  );
};

/* -------------------------------------------------------------------------- */
/*  Line icons                                                                */
/* -------------------------------------------------------------------------- */

export type GlyphName = 'back' | 'share' | 'play' | 'pause' | 'arrowUp' | 'eclipse' | 'retry';

interface GlyphProps {
  name: GlyphName;
  color: string;
  size?: number;
  /** Second colour, used by the eclipse's shadow disc. */
  bgColor?: string;
}

/** The small line icons the Reading uses in place of emoji and text glyphs. */
export const Glyph: React.FC<GlyphProps> = ({
  name,
  color,
  size = 18,
  bgColor = 'transparent',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" testID={`glyph-${name}`}>
    {name === 'back' && (
      <Path
        d="M15 5 L8 12 L15 19"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
    {name === 'share' && (
      <G stroke={color} strokeWidth={1.5} fill={color}>
        <Circle cx="18" cy="5" r="2.6" />
        <Circle cx="6" cy="12" r="2.6" />
        <Circle cx="18" cy="19" r="2.6" />
        <Line x1="8.3" y1="10.8" x2="15.7" y2="6.2" />
        <Line x1="8.3" y1="13.2" x2="15.7" y2="17.8" />
      </G>
    )}
    {name === 'play' && <Path d="M9 6.5 L18 12 L9 17.5 Z" fill={color} />}
    {name === 'pause' && (
      <G fill={color}>
        <Rect x="7" y="6" width="3.6" height="12" rx="1" />
        <Rect x="13.4" y="6" width="3.6" height="12" rx="1" />
      </G>
    )}
    {name === 'arrowUp' && (
      <Path
        d="M12 19 L12 5 M6 11 L12 5 L18 11"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
    {name === 'retry' && (
      <Path
        d="M19 12 A7 7 0 1 1 16.9 7 M19 4.5 L19 8.5 L15 8.5"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
    {name === 'eclipse' && (
      <G>
        <Circle cx="12" cy="12" r="8" fill={color} />
        <Circle cx="15" cy="9" r="7.4" fill={bgColor} />
      </G>
    )}
  </Svg>
);

/* -------------------------------------------------------------------------- */
/*  Small parts                                                               */
/* -------------------------------------------------------------------------- */

/** A 5 dp diamond, the design's bullet for eyebrows and list items. */
export const Diamond: React.FC<{ color: string; size?: number; filled?: boolean }> = ({
  color,
  size = 5,
  filled = true,
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderWidth: 1,
      borderColor: color,
      backgroundColor: filled ? color : 'transparent',
      transform: [{ rotate: '45deg' }],
    }}
  />
);

/** Diamond + caps label: the head of every section inside the Oracle's card. */
export const SectionEyebrow: React.FC<{ label: string; color: string; testID?: string }> = ({
  label,
  color,
  testID,
}) => {
  const text = useReadingText();
  return (
    <View style={styles.eyebrowRow} accessibilityRole="header" testID={testID}>
      <Diamond color={color} />
      <Text style={[text.eyebrow, { color }]}>{label}</Text>
    </View>
  );
};

/**
 * How many of three pips a verdict's confidence fills. A display mapping of
 * the engine's own confidence band — nothing is re-judged. An unrecorded
 * confidence (older cached reading) shows no pips rather than a guess.
 */
export function pipsForConfidence(confidence: unknown): 0 | 1 | 2 | 3 {
  switch (confidence) {
    case 'VERY_HIGH':
    case 'HIGH':
      return 3;
    case 'MODERATE':
      return 2;
    case 'LOW':
    case 'UNCERTAIN':
      return 1;
    default:
      return 0;
  }
}

export const StrengthPips: React.FC<{ filled: number; color: string; label: string }> = ({
  filled,
  color,
  label,
}) => (
  <View style={styles.pips} accessible accessibilityLabel={label} testID="verdict-strength-pips">
    {[1, 2, 3].map(n => (
      <Diamond key={n} color={color} size={7} filled={n <= filled} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
});
