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
import Svg, { Line } from 'react-native-svg';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import StarfieldBackground from '@components/StarfieldBackground';

const SEAL_IMAGE = require('@assets/images/sky-clock-disk.png');

const SEAL_SIZE = 220;
const RAY_HEIGHT = 140;

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
  const haloLoopRef = useRef<Animated.CompositeAnimation | null>(null);

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

    return () => {
      haloLoopRef.current?.stop();
    };
  }, [haloAnim, brandAnim]);

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

        {/* Breathing halo behind the seal */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              backgroundColor: colors.nebula1,
              shadowColor: colors.goldBright,
              shadowRadius: 50,
              shadowOpacity: 0.6,
              shadowOffset: { width: 0, height: 0 },
              opacity: haloAnim,
            },
          ]}
        />

        {/* The seal — Manazil al-Qamar gold disk */}
        <Image
          source={SEAL_IMAGE}
          style={styles.sealImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />

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
  halo: {
    position: 'absolute',
    top: RAY_HEIGHT - 40,
    width: SEAL_SIZE + 60,
    height: SEAL_SIZE + 60,
    borderRadius: (SEAL_SIZE + 60) / 2,
    alignSelf: 'center',
  },
  sealImage: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
  },
  cornerOrnament: {
    position: 'absolute',
    fontSize: 18,
  },
});

export default SplashScreen;
