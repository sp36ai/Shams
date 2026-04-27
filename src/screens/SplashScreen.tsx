/**
 * SplashScreen — animated mandala with rotating zodiac, 2.5s brand moment.
 * --------------------------------------------------------------------------
 * This screen owns ZERO business logic. It exists for one purpose: hold
 * presence while RootNavigator decides where to send the user. The screen
 * does NOT navigate itself — RootNavigator unmounts it once both
 *   (a) MIN_SPLASH_MS has elapsed AND
 *   (b) the shell has decided whether onboarding is still needed.
 *
 * Visual elements:
 *   1. Full-bleed theme.colors.bg background.
 *   2. Starfield (deferred — Starfield component lives in §1.9, will be
 *      slotted in via render once that lands; for now we render a quiet
 *      gradient + dot pattern that won't clash when Starfield drops in).
 *   3. Central mandala: outer rotating zodiac ring (12 glyphs, 60s rotation),
 *      inner counter-rotating petal mandala (8 petals, 40s rotation).
 *      Both implemented with Reanimated `useSharedValue` + `withRepeat` so
 *      they run on the UI thread and don't block JS.
 *   4. Brand wordmark below mandala: "Shams al-Asrār" (Cinzel-equivalent for
 *      now via theme typography 'hero'), tagline "Sun of Secrets", and
 *      attribution "Powered by Astro Sarfaraz".
 *   5. Below attribution, the splash invocation copy: "The heavens are
 *      listening." — sets the spiritual register before the user types
 *      their first question.
 *
 * Reanimated v3 contract:
 *   - useSharedValue → withRepeat(withTiming(...)) on mount, no cleanup
 *     needed (Reanimated cancels animations on unmount).
 *   - useAnimatedStyle returns the rotation transform; this style is read
 *     directly by the worklet and never re-evaluates on the JS side.
 *
 * RTL note:
 *   This screen has no left/right asymmetry — it's all centered. RTL flip
 *   is a no-op visually, but the wordmark (Latin script) renders LTR and
 *   the tagline switches to its translated form via t().
 *
 * Performance:
 *   No images, no Skia, no native modules. Just two rotating SVG-in-View
 *   transforms. Splash should hit 60fps on a 2018 mid-range Android device.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';

const ZODIAC_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

const OUTER_DURATION_MS = 60_000;
const INNER_DURATION_MS = 40_000;

const RING_RADIUS = 120;
const PETAL_RADIUS = 70;

const SplashScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  // Outer ring (zodiac) rotates clockwise.
  const outerProgress = useSharedValue(0);
  // Inner mandala rotates counter-clockwise.
  const innerProgress = useSharedValue(0);

  useEffect(() => {
    outerProgress.value = withRepeat(
      withTiming(360, { duration: OUTER_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
    innerProgress.value = withRepeat(
      withTiming(-360, { duration: INNER_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [outerProgress, innerProgress]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerProgress.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerProgress.value}deg` }],
  }));

  // SVG canvas size — must accommodate the largest ring + glyph padding.
  const svgSize = (RING_RADIUS + 30) * 2;
  const center = svgSize / 2;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      {/* Subtle gradient halo behind the mandala for depth */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            backgroundColor: theme.colors.nebula1,
            shadowColor: theme.colors.accent,
          },
        ]}
      />

      <View style={styles.mandalaWrap}>
        {/* Outer rotating ring with zodiac glyphs */}
        <Animated.View style={[styles.absCenter, outerStyle]}>
          <Svg width={svgSize} height={svgSize}>
            {/* Faint outer circle */}
            <Circle
              cx={center}
              cy={center}
              r={RING_RADIUS}
              stroke={colors.borderAccent}
              strokeOpacity={0.35}
              strokeWidth={1}
              fill="none"
            />
            {/* 12 zodiac glyphs evenly spaced */}
            {ZODIAC_GLYPHS.map((glyph, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180); // start at top
              const x = center + RING_RADIUS * Math.cos(angle);
              const y = center + RING_RADIUS * Math.sin(angle);
              return (
                <SvgText
                  key={glyph}
                  x={x}
                  y={y + 6} // glyph baseline correction
                  fontSize={18}
                  fill={colors.accent}
                  textAnchor="middle"
                  opacity={0.85}
                >
                  {glyph}
                </SvgText>
              );
            })}
            {/* 12 tick marks just inside the ring */}
            {ZODIAC_GLYPHS.map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x1 = center + (RING_RADIUS - 14) * Math.cos(angle);
              const y1 = center + (RING_RADIUS - 14) * Math.sin(angle);
              const x2 = center + (RING_RADIUS - 22) * Math.cos(angle);
              const y2 = center + (RING_RADIUS - 22) * Math.sin(angle);
              return (
                <Line
                  key={`tick-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={colors.accent}
                  strokeWidth={1.2}
                  opacity={0.6}
                />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Inner counter-rotating petal mandala */}
        <Animated.View style={[styles.absCenter, innerStyle]}>
          <Svg width={svgSize} height={svgSize}>
            <G transform={`translate(${center} ${center})`}>
              {/* 8 petals built from a single quadratic-bezier path, rotated */}
              {Array.from({ length: 8 }).map((_, i) => {
                const rotate = i * 45;
                const petalPath = `M 0 0 Q ${PETAL_RADIUS * 0.4} ${-PETAL_RADIUS * 0.6} 0 ${-PETAL_RADIUS} Q ${-PETAL_RADIUS * 0.4} ${-PETAL_RADIUS * 0.6} 0 0 Z`;
                return (
                  <Path
                    key={`petal-${i}`}
                    d={petalPath}
                    transform={`rotate(${rotate})`}
                    fill={colors.accent}
                    fillOpacity={0.1}
                    stroke={colors.accent}
                    strokeOpacity={0.55}
                    strokeWidth={1}
                  />
                );
              })}
              {/* Center sun */}
              <Circle r={10} fill={colors.amber} fillOpacity={0.9} />
              <Circle
                r={16}
                fill="none"
                stroke={colors.amber}
                strokeOpacity={0.4}
                strokeWidth={1}
              />
              <Circle
                r={26}
                fill="none"
                stroke={colors.amber}
                strokeOpacity={0.2}
                strokeWidth={1}
              />
            </G>
          </Svg>
        </Animated.View>
      </View>

      {/* Brand block */}
      <View style={styles.brandBlock}>
        <Text style={[typography('hero'), { color: colors.text, textAlign: 'center' }]}>
          {t('app.name')}
        </Text>
        <Text
          style={[
            typography('subheading'),
            { color: colors.accent, textAlign: 'center', marginTop: 4 },
          ]}
        >
          {t('app.tagline')}
        </Text>
        <Text
          style={[
            typography('caption'),
            { color: colors.textMuted, textAlign: 'center', marginTop: 12, letterSpacing: 1.2 },
          ]}
        >
          {t('app.poweredBy').toUpperCase()}
        </Text>
        <Text
          style={[
            typography('bodyItalic'),
            { color: colors.textFaint, textAlign: 'center', marginTop: 28 },
          ]}
        >
          {t('splash.invocation')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  halo: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.6,
    shadowOpacity: 0.4,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  mandalaWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  absCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});

export default SplashScreen;
