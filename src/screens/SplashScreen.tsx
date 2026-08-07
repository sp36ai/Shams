/**
 * SplashScreen — the gold seal, brand moment (2.5–3.5s).
 * --------------------------------------------------------------------------
 * Matches the reference cover art exactly: the Manazil al-Qamar gold seal
 * (assets/images/sky-clock-disk.png) with a soft upward glow, the
 * "SHAMS AL-ASRĀR" wordmark, a small diamond divider, and the tagline —
 * on the obsidian starfield background used throughout the app.
 *
 * Kept minimal motion (fade-in + slow breathing glow) rather than a fully
 * static image — a completely still splash reads as frozen/broken on a
 * real device, and the design system's MOTION.breathe (8s) is the
 * documented "sacred breathing pulse" cadence for glowing seals.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing as REasing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import StarfieldBackground from '@components/StarfieldBackground';

const SEAL_IMAGE = require('@assets/images/sky-clock-disk.png');

const SEAL_SIZE = 220;
const RAY_HEIGHT = 140;
// Shine sweep bar — wider than the seal so its rotated diagonal still fully
// covers the circular clip at any point along the sweep.
const SHINE_W = SEAL_SIZE * 0.5;
const SHINE_H = SEAL_SIZE * 1.8;
const SHINE_TRAVEL = SEAL_SIZE * 1.15;

// Ray fan: [angleDeg from vertical, length fraction, opacity]
const RAYS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0.55],
  [-6, 0.8, 0.4],
  [6, 0.8, 0.4],
  [-13, 0.6, 0.28],
  [13, 0.6, 0.28],
  [-20, 0.4, 0.16],
  [20, 0.4, 0.16],
];

const SplashScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  // Halo pulse — RN Animated (native driver)
  const haloAnim = useRef(new Animated.Value(0.45)).current;
  // Brand block fade in
  const brandAnim = useRef(new Animated.Value(0)).current;
  // Shine sweep — a slow, occasional light streak crossing the seal, the
  // classic "polished metal/premium seal" cue. Ceremonial pacing (long pause
  // between sweeps), never a continuous shimmer loop.
  const shineAnim = useRef(new Animated.Value(0)).current;
  const haloLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const shineLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    haloLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, {
          toValue: 0.8,
          duration: 4000,
          easing: REasing.inOut(REasing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(haloAnim, {
          toValue: 0.35,
          duration: 4000,
          easing: REasing.inOut(REasing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    haloLoopRef.current.start();

    Animated.sequence([
      Animated.delay(200),
      Animated.timing(brandAnim, {
        toValue: 1,
        duration: 1100,
        easing: REasing.out(REasing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    shineLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shineAnim, {
          toValue: 1,
          duration: 1400,
          easing: REasing.inOut(REasing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2600),
        Animated.timing(shineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    shineLoopRef.current.start();

    return () => {
      haloLoopRef.current?.stop();
      shineLoopRef.current?.stop();
    };
  }, [haloAnim, brandAnim, shineAnim]);

  const shineTranslateX = shineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHINE_TRAVEL, SHINE_TRAVEL],
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      {/* Corner ornaments */}
      {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map(pos => (
        <View
          key={pos}
          pointerEvents="none"
          style={[
            styles.cornerOrnament,
            pos === 'topLeft' && { top: 48, left: 20 },
            pos === 'topRight' && { top: 48, right: 20 },
            pos === 'bottomLeft' && { bottom: 48, left: 20 },
            pos === 'bottomRight' && { bottom: 48, right: 20 },
          ]}
        >
          <Text style={{ color: colors.accent, fontSize: 18, opacity: 0.3 }}>{'✦'}</Text>
        </View>
      ))}

      <Animated.View style={{ opacity: brandAnim, alignItems: 'center' }}>
        {/* Upward radiating glow above the seal */}
        <Svg width={SEAL_SIZE} height={RAY_HEIGHT} style={styles.rays}>
          {RAYS.map(([angle, lenFrac, opacity], i) => {
            const rad = (angle * Math.PI) / 180;
            const len = RAY_HEIGHT * lenFrac;
            const x1 = SEAL_SIZE / 2;
            const y1 = RAY_HEIGHT;
            const x2 = x1 + len * Math.sin(rad);
            const y2 = y1 - len * Math.cos(rad);
            return (
              <Line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={colors.goldBright}
                strokeWidth={1.4}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>

        {/* Outer soft bloom — wide, dim, barely-breathing */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.haloOuter,
            {
              backgroundColor: colors.nebula1,
              shadowColor: colors.goldBright,
              shadowRadius: 70,
              shadowOpacity: 0.4,
              shadowOffset: { width: 0, height: 0 },
              opacity: haloAnim,
            },
          ]}
        />
        {/* Inner warm bloom — tighter, brighter, breathes opposite the outer */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              backgroundColor: colors.nebula2,
              shadowColor: colors.goldBright,
              shadowRadius: 40,
              shadowOpacity: 0.7,
              shadowOffset: { width: 0, height: 0 },
              opacity: Animated.subtract(1.15, haloAnim),
            },
          ]}
        />

        {/* Ground contact shadow — gives the disk physical weight/lift */}
        <View pointerEvents="none" style={styles.contactShadow} />

        {/* The seal — Manazil al-Qamar gold disk, circular-clipped for the shine sweep */}
        <View style={styles.sealClip}>
          <Image
            source={SEAL_IMAGE}
            style={styles.sealImage}
            resizeMode="contain"
            fadeDuration={0}
            accessibilityIgnoresInvertColors
          />

          {/* Rim light — simulates a convex, polished metal edge catching light */}
          <Svg width={SEAL_SIZE} height={SEAL_SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={SEAL_SIZE / 2}
              cy={SEAL_SIZE / 2}
              r={SEAL_SIZE / 2 - 1.5}
              stroke={colors.goldBright}
              strokeOpacity={0.5}
              strokeWidth={2}
              fill="none"
            />
            <Circle
              cx={SEAL_SIZE / 2}
              cy={SEAL_SIZE / 2}
              r={SEAL_SIZE / 2 - 1.5}
              stroke="#000000"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={`${Math.PI * SEAL_SIZE * 0.4} ${Math.PI * SEAL_SIZE}`}
              strokeDashoffset={-Math.PI * SEAL_SIZE * 0.15}
            />
          </Svg>

          {/* Shine sweep — a slow light streak, premium polished-metal cue.
              Three stacked soft-edged bars fake a gradient falloff without
              needing an SVG LinearGradient. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.shineWrap, { transform: [{ translateX: shineTranslateX }] }]}
          >
            <View style={[styles.shineBar, styles.shineBarOuter]} />
            <View style={[styles.shineBar, styles.shineBarMid]} />
            <View style={[styles.shineBar, styles.shineBarCore]} />
          </Animated.View>
        </View>

        {/* Wordmark */}
        <Text
          style={[
            typography('hero'),
            {
              color: colors.goldBright,
              textAlign: 'center',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginTop: 18,
              lineHeight: 44,
            },
          ]}
        >
          {'SHAMS\nAL-ASRĀR'}
        </Text>

        {/* Diamond divider */}
        <Text
          style={{
            color: colors.goldBright,
            fontSize: 14,
            opacity: 0.6,
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          {'❖'}
        </Text>

        {/* Tagline */}
        <Text
          style={[
            typography('subheading'),
            {
              color: colors.text,
              textAlign: 'center',
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              paddingHorizontal: 40,
              lineHeight: 26,
            },
          ]}
        >
          {t('app.tagline')}
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
  rays: {
    marginBottom: -40, // let the rays overlap into the halo/seal above it
  },
  haloOuter: {
    position: 'absolute',
    top: RAY_HEIGHT - 60,
    width: SEAL_SIZE + 100,
    height: SEAL_SIZE + 100,
    borderRadius: (SEAL_SIZE + 100) / 2,
    alignSelf: 'center',
  },
  halo: {
    position: 'absolute',
    top: RAY_HEIGHT - 40,
    width: SEAL_SIZE + 60,
    height: SEAL_SIZE + 60,
    borderRadius: (SEAL_SIZE + 60) / 2,
    alignSelf: 'center',
  },
  contactShadow: {
    position: 'absolute',
    top: RAY_HEIGHT - 40 + SEAL_SIZE - 14,
    width: SEAL_SIZE * 0.62,
    height: 26,
    borderRadius: 20,
    backgroundColor: '#000000',
    opacity: 0.4,
    alignSelf: 'center',
  },
  sealClip: {
    // overflow: 'hidden' clips any shadow set on this same node (iOS), so
    // the "grounded" lift comes from the separate contactShadow layer below
    // it instead — this node is purely the circular mask for the image +
    // rim light + shine sweep.
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    borderRadius: SEAL_SIZE / 2,
    overflow: 'hidden',
  },
  sealImage: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
  },
  shineWrap: {
    position: 'absolute',
    top: (SEAL_SIZE - SHINE_H) / 2,
    left: (SEAL_SIZE - SHINE_W) / 2,
    width: SHINE_W,
    height: SHINE_H,
  },
  // Three concentric, decreasingly-wide, increasingly-opaque bars fake a
  // soft horizontal gradient falloff (no SVG LinearGradient dependency).
  shineBar: {
    position: 'absolute',
    top: 0,
    height: SHINE_H,
    backgroundColor: '#FFF6DE',
  },
  shineBarOuter: {
    width: SHINE_W,
    left: 0,
    borderRadius: SHINE_W / 2,
    opacity: 0.1,
  },
  shineBarMid: {
    width: SHINE_W * 0.55,
    left: SHINE_W * 0.225,
    borderRadius: (SHINE_W * 0.55) / 2,
    opacity: 0.18,
  },
  shineBarCore: {
    width: SHINE_W * 0.2,
    left: SHINE_W * 0.4,
    borderRadius: (SHINE_W * 0.2) / 2,
    opacity: 0.32,
  },
  cornerOrnament: {
    position: 'absolute',
    fontSize: 18,
  },
});

export default SplashScreen;
