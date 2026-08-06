/**
 * VerdictPill.tsx
 * MAQBOOL / MARDOOD verdict display — the sacred-terms pill used for the
 * astro engine's full verdict range, matching the manuscript badge terms
 * used elsewhere (HistoryScreen's `verdictBadgeFor`).
 *
 * Usage:
 *   <VerdictPill verdict="YES" confidence="HIGH" />
 *   <VerdictPill verdict="DENIED" confidence="MEDIUM" />
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { useColors } from '@theme/ThemeProvider';
import { RADIUS, MOTION } from '@theme/themes';

export type PillVerdictKind =
  | 'YES'
  | 'NO'
  | 'CONDITIONAL'
  | 'DELAYED'
  | 'UNCLEAR'
  | 'PENDING'
  | 'DENIED';
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface Props {
  verdict: PillVerdictKind;
  confidence?: Confidence;
  /** Arabic label override — defaults to the verdict's own sacred term. */
  arabicLabel?: string;
}

// Manuscript verdict badge — Arabic/sacred terms per the design brief.
// Mirrors HistoryScreen's `verdictBadgeFor` so the same reading is worded
// identically whether seen fresh in chat or later in Reading History.
const VERDICT_LABEL: Record<PillVerdictKind, string> = {
  YES: 'MAQBOOL',
  NO: 'MARDOOD',
  CONDITIONAL: 'MASHROOT',
  DELAYED: "TA'KHEER",
  DENIED: 'MARDOOD',
  UNCLEAR: 'GHAYR WAZEH',
  PENDING: 'MUNTAZIR',
};

const VERDICT_ARABIC: Record<PillVerdictKind, string> = {
  YES: 'مَقْبُول',
  NO: 'مَرْدُود',
  CONDITIONAL: 'مَشْرُوط',
  DELAYED: 'تَأْخِير',
  DENIED: 'مَرْدُود',
  UNCLEAR: 'غَيْر وَاضِح',
  PENDING: 'مُنْتَظِر',
};

export function VerdictPill({ verdict, confidence = 'HIGH', arabicLabel }: Props) {
  const c = useColors();

  const isFavorable = verdict === 'YES';
  const accentColor =
    verdict === 'YES'
      ? c.maqbool
      : verdict === 'NO' || verdict === 'DENIED'
        ? c.mardood
        : verdict === 'CONDITIONAL' || verdict === 'DELAYED'
          ? c.caution
          : c.textMuted;
  const label = VERDICT_LABEL[verdict];
  const arabic = arabicLabel ?? VERDICT_ARABIC[verdict];

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

  // Dot pulse (favorable/MAQBOOL verdicts only)
  const dotScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isFavorable) {
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
  }, [isFavorable]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: accentColor + (isFavorable ? '18' : '14'),
            borderColor: accentColor + (isFavorable ? '90' : '70'),
          },
          Platform.select({
            ios: {
              shadowColor: accentColor,
              shadowOpacity: isFavorable ? 0.35 : 0.2,
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
                transform: isFavorable ? [{ scale: dotScale }] : [],
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
