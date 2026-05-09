/**
 * SplashScreen — animated mandala with rotating zodiac, 2.5s brand moment.
 * --------------------------------------------------------------------------
 * Visual elements (premium v2):
 *   1. StarfieldBackground (120 stars + nebula + shooting stars)
 *   2. Two layered halo rings: outer pulsing corona + inner soft glow
 *   3. Outer rotating zodiac ring (60s) with SVG tick marks
 *   4. Middle ring — same zodiac, slightly smaller, counter-rotating (80s)
 *   5. Inner counter-rotating 8-petal mandala (40s) with SVG RadialGradient sun
 *   6. 3 slow-orbiting accent dots (120s orbital period) via Reanimated
 *   7. Brand block with slow fade-in on mount
 *
 * Reanimated v3: useSharedValue + withRepeat(withTiming(...)) — all on UI thread.
 * RN Animated: StarfieldBackground + halo pulse use native driver.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing as REasing, StyleSheet, Text, View } from 'react-native';
import Animated2, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import StarfieldBackground from '@components/StarfieldBackground';

const ZODIAC_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

const OUTER_DURATION_MS = 60_000;
const MID_DURATION_MS = 80_000;
const INNER_DURATION_MS = 40_000;
const ORBIT_DURATION_MS = 120_000;

const RING_RADIUS = 122;
const MID_RING_RADIUS = 88;
const PETAL_RADIUS = 66;
const ORBIT_RADIUS = 150;

const SplashScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  // Reanimated rotation values
  const outerProgress = useSharedValue(0);
  const midProgress = useSharedValue(0);
  const innerProgress = useSharedValue(0);
  const orbitProgress = useSharedValue(0);

  // Halo pulse — RN Animated (native driver)
  const haloAnim = useRef(new Animated.Value(0.4)).current;
  // Brand block fade in
  const brandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Rotations
    outerProgress.value = withRepeat(
      withTiming(360, { duration: OUTER_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
    midProgress.value = withRepeat(
      withTiming(-360, { duration: MID_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
    innerProgress.value = withRepeat(
      withTiming(-360, { duration: INNER_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
    orbitProgress.value = withRepeat(
      withTiming(360, { duration: ORBIT_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );

    // Halo pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, {
          toValue: 0.75,
          duration: 2200,
          easing: REasing.inOut(REasing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(haloAnim, {
          toValue: 0.3,
          duration: 2200,
          easing: REasing.inOut(REasing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Brand fade in (delayed by 300ms)
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(brandAnim, {
        toValue: 1,
        duration: 900,
        easing: REasing.out(REasing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [outerProgress, midProgress, innerProgress, orbitProgress, haloAnim, brandAnim]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerProgress.value}deg` }],
  }));
  const midStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${midProgress.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerProgress.value}deg` }],
  }));

  // 3 orbiting dots at 120° apart
  const dot0Style = useAnimatedStyle(() => {
    const a = orbitProgress.value * (Math.PI / 180);
    return {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accent,
      opacity: 0.8,
      transform: [
        { translateX: ORBIT_RADIUS * Math.cos(a) - 3 },
        { translateY: ORBIT_RADIUS * Math.sin(a) - 3 },
      ],
    };
  });
  const dot1Style = useAnimatedStyle(() => {
    const a = (orbitProgress.value + 120) * (Math.PI / 180);
    return {
      position: 'absolute',
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.amber,
      opacity: 0.6,
      transform: [
        { translateX: ORBIT_RADIUS * Math.cos(a) - 2.5 },
        { translateY: ORBIT_RADIUS * Math.sin(a) - 2.5 },
      ],
    };
  });
  const dot2Style = useAnimatedStyle(() => {
    const a = (orbitProgress.value + 240) * (Math.PI / 180);
    return {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accent,
      opacity: 0.4,
      transform: [
        { translateX: ORBIT_RADIUS * Math.cos(a) - 2 },
        { translateY: ORBIT_RADIUS * Math.sin(a) - 2 },
      ],
    };
  });

  const svgSize = (RING_RADIUS + 32) * 2;
  const center = svgSize / 2;
  const svgSizeMid = (MID_RING_RADIUS + 20) * 2;
  const centerMid = svgSizeMid / 2;
  const svgSizeInner = (PETAL_RADIUS + 10) * 2;
  const centerInner = svgSizeInner / 2;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      {/* Deep starfield */}
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      {/* Outer pulsing corona halo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            backgroundColor: colors.nebula1,
            shadowColor: colors.accent,
            shadowRadius: 60,
            shadowOpacity: 0.5,
            shadowOffset: { width: 0, height: 0 },
            opacity: haloAnim,
          },
        ]}
      />

      {/* Inner soft glow */}
      <View
        pointerEvents="none"
        style={[
          styles.innerHalo,
          {
            backgroundColor: colors.nebula2,
            shadowColor: colors.amber,
            shadowRadius: 30,
            shadowOpacity: 0.35,
          },
        ]}
      />

      <View style={styles.mandalaWrap}>
        {/* Outer orbiting dots */}
        <Animated2.View style={dot0Style} />
        <Animated2.View style={dot1Style} />
        <Animated2.View style={dot2Style} />

        {/* Outer rotating ring (zodiac glyphs) */}
        <Animated2.View style={[styles.absCenter, outerStyle]}>
          <Svg width={svgSize} height={svgSize}>
            {/* Outer glow ring */}
            <Circle
              cx={center}
              cy={center}
              r={RING_RADIUS + 12}
              stroke={colors.accent}
              strokeOpacity={0.08}
              strokeWidth={18}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={RING_RADIUS}
              stroke={colors.accent}
              strokeOpacity={0.3}
              strokeWidth={1.2}
              fill="none"
            />
            {ZODIAC_GLYPHS.map((glyph, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x = center + RING_RADIUS * Math.cos(angle);
              const y = center + RING_RADIUS * Math.sin(angle);
              return (
                <SvgText
                  key={glyph}
                  x={x}
                  y={y + 6}
                  fontSize={18}
                  fill={colors.accent}
                  textAnchor="middle"
                  opacity={0.9}
                >
                  {glyph}
                </SvgText>
              );
            })}
            {ZODIAC_GLYPHS.map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x1 = center + (RING_RADIUS - 14) * Math.cos(angle);
              const y1 = center + (RING_RADIUS - 14) * Math.sin(angle);
              const x2 = center + (RING_RADIUS - 24) * Math.cos(angle);
              const y2 = center + (RING_RADIUS - 24) * Math.sin(angle);
              return (
                <Line
                  key={`t-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={colors.accent}
                  strokeWidth={1.4}
                  opacity={0.55}
                />
              );
            })}
          </Svg>
        </Animated2.View>

        {/* Middle counter-rotating ring (smaller, accent dots) */}
        <Animated2.View style={[styles.absCenter, midStyle]}>
          <Svg width={svgSizeMid} height={svgSizeMid}>
            <Circle
              cx={centerMid}
              cy={centerMid}
              r={MID_RING_RADIUS}
              stroke={colors.amber}
              strokeOpacity={0.2}
              strokeWidth={1}
              fill="none"
            />
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x = centerMid + MID_RING_RADIUS * Math.cos(angle);
              const y = centerMid + MID_RING_RADIUS * Math.sin(angle);
              const isMain = i % 3 === 0;
              return (
                <Circle
                  key={`md-${i}`}
                  cx={x}
                  cy={y}
                  r={isMain ? 2.5 : 1.2}
                  fill={isMain ? colors.amber : colors.accent}
                  opacity={isMain ? 0.75 : 0.45}
                />
              );
            })}
          </Svg>
        </Animated2.View>

        {/* Inner counter-rotating petal mandala */}
        <Animated2.View style={[styles.absCenter, innerStyle]}>
          <Svg width={svgSizeInner} height={svgSizeInner}>
            <Defs>
              <RadialGradient id="sunRad" cx="50%" cy="50%">
                <Stop offset="0%" stopColor={colors.amber} stopOpacity="1" />
                <Stop offset="45%" stopColor={colors.amber} stopOpacity="0.6" />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="petalRad" cx="50%" cy="0%">
                <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity="0.02" />
              </RadialGradient>
            </Defs>
            <G transform={`translate(${centerInner} ${centerInner})`}>
              {/* 8 petals */}
              {Array.from({ length: 8 }).map((_, i) => {
                const rotate = i * 45;
                const petalPath = `M 0 0 Q ${PETAL_RADIUS * 0.42} ${-PETAL_RADIUS * 0.62} 0 ${-PETAL_RADIUS} Q ${-PETAL_RADIUS * 0.42} ${-PETAL_RADIUS * 0.62} 0 0 Z`;
                return (
                  <Path
                    key={`petal-${i}`}
                    d={petalPath}
                    transform={`rotate(${rotate})`}
                    fill="url(#petalRad)"
                    stroke={colors.accent}
                    strokeOpacity={0.6}
                    strokeWidth={1.2}
                  />
                );
              })}
              {/* Glow rings */}
              <Circle r={34} fill="url(#sunRad)" />
              <Circle r={12} fill={colors.amber} fillOpacity={0.95} />
              <Circle
                r={18}
                fill="none"
                stroke={colors.amber}
                strokeOpacity={0.5}
                strokeWidth={1.5}
              />
              <Circle
                r={28}
                fill="none"
                stroke={colors.amber}
                strokeOpacity={0.2}
                strokeWidth={1}
              />
            </G>
          </Svg>
        </Animated2.View>
      </View>

      {/* Brand block — fades in */}
      <Animated.View style={[styles.brandBlock, { opacity: brandAnim }]}>
        <Text style={[typography('hero'), { color: colors.text, textAlign: 'center' }]}>
          {t('app.name')}
        </Text>
        <Text
          style={[
            typography('subheading'),
            {
              color: colors.accent,
              textAlign: 'center',
              marginTop: 4,
              letterSpacing: 1.5,
            },
          ]}
        >
          {t('app.tagline')}
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.accent }]} />
        <Text
          style={[
            typography('caption'),
            { color: colors.textMuted, textAlign: 'center', letterSpacing: 2.0 },
          ]}
        >
          {t('app.poweredBy').toUpperCase()}
        </Text>
        <Text
          style={[
            typography('bodyItalic'),
            { color: colors.textFaint, textAlign: 'center', marginTop: 28, letterSpacing: 0.5 },
          ]}
        >
          {t('splash.invocation')}
        </Text>
      </Animated.View>
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
    width: 420,
    height: 420,
    borderRadius: 210,
  },
  innerHalo: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.5,
  },
  mandalaWrap: {
    width: 340,
    height: 340,
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
  divider: {
    width: 40,
    height: 1,
    marginVertical: 10,
    opacity: 0.5,
  },
});

export default SplashScreen;
