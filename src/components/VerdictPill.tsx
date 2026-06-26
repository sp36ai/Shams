/**
 * VerdictPill.tsx
 * MAQBOOL / MARDOOD verdict display.
 * Fully theme-aware — reads colors from context.
 *
 * Usage:
 *   <VerdictPill kind="CONFIRMED" confidence="HIGH" />
 *   <VerdictPill kind="DENIED"    confidence="MEDIUM" />
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { useColors } from '@theme/ThemeProvider';
import { RADIUS, MOTION } from '@theme/themes';

type VerdictKind = 'CONFIRMED' | 'DENIED';
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface Props {
  kind: VerdictKind;
  confidence?: Confidence;
  /** Arabic label override — defaults to مَقْبُول / مَرْدُود */
  arabicLabel?: string;
}

export function VerdictPill({ kind, confidence = 'HIGH', arabicLabel }: Props) {
  const c = useColors();

  const isConfirmed = kind === 'CONFIRMED';
  const accentColor = isConfirmed ? c.maqbool : c.mardood;
  const label = isConfirmed ? 'MAQBOOL' : 'MARDOOD';
  const arabic = arabicLabel ?? (isConfirmed ? 'مَقْبُول' : 'مَرْدُود');

  // Entrance animation
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: MOTION.base,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dot pulse (CONFIRMED only)
  const dotScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isConfirmed) {
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(dotScale, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: isConfirmed ? `${c.maqbool}18` : `${c.mardood}14`,
            borderColor: accentColor + (isConfirmed ? '90' : '70'),
          },
          Platform.select({
            ios: {
              shadowColor: accentColor,
              shadowOpacity: isConfirmed ? 0.35 : 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 4 },
          }),
        ]}
      >
        {/* Pulsing dot */}
        <View style={styles.dotWrap}>
          <Animated.View
            style={[
              styles.dotOuter,
              {
                backgroundColor: accentColor + '30',
                transform: isConfirmed ? [{ scale: dotScale }] : [],
              },
            ]}
          />
          <View style={[styles.dotInner, { backgroundColor: accentColor }]} />
        </View>

        {/* Verdict word */}
        <Text style={[styles.label, { color: accentColor, fontFamily: 'Cinzel-SemiBold' }]}>
          {label}
        </Text>

        {/* Arabic */}
        <Text style={[styles.arabic, { color: accentColor, fontFamily: 'Amiri-Bold' }]}>
          {arabic}
        </Text>
      </View>

      {/* Confidence sub-label (only on MEDIUM / LOW) */}
      {confidence !== 'HIGH' && (
        <Text style={[styles.confidence, { color: c.textFaint, fontFamily: 'Spectral-Italic' }]}>
          {confidence === 'MEDIUM' ? 'Confidence: Moderate' : 'Confidence: Tentative'}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    height: 48,
    paddingHorizontal: 22,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    gap: 10,
  },
  dotWrap: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotOuter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 13,
    letterSpacing: 2,
  },
  arabic: {
    fontSize: 15,
  },
  confidence: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 0.3,
  },
});
