/**
 * VerdictSeal — the one statement of a Reading's verdict.
 * --------------------------------------------------------------------------
 * RkpWatchCard and RemedyProtocolCard each used to open with their own
 * headline — "The way is closed" over "The chart does not carry this" — so a
 * seeker read the same answer twice, in two vocabularies, a screen apart. This
 * states it once, above both cards, and the cards are rendered without their
 * own headlines beneath it.
 *
 * Presentation only. The headline is the engine's watch state
 * (STATE_HEADLINE), the state the diagnosis is itself derived from; the
 * posture is the diagnosis's own; timing and confidence are the verdict's.
 * Nothing is recomputed or reconciled here.
 */

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import type { WatchOracleComposition } from '../../types/watchOracle';
import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import { STATE_HEADLINE, STATE_TONE, timingLabel } from './RkpWatchCard';
import { POSTURE_LABEL } from './RemedyProtocolCard';
import { SealGlyph, StrengthPips, pipsForConfidence, useReadingText } from './readingDesign';

/**
 * The line under the headline: what to do, when, and how sure. Each part is
 * left out when the reading does not carry it, never filled with a guess.
 */
export function verdictSubline(
  verdict: DisplayWatchVerdict,
  diagnosis?: WatchOracleComposition['diagnosis'] | null,
): string {
  const parts: string[] = [];
  const posture =
    diagnosis !== undefined && diagnosis !== null
      ? (POSTURE_LABEL[diagnosis.timingPosture] ?? null)
      : null;
  if (posture !== null) {
    parts.push(posture);
  }
  if (verdict.timing !== null && verdict.timing !== undefined) {
    parts.push(timingLabel(verdict));
  }
  if (typeof verdict.confidence === 'string') {
    parts.push(`${verdict.confidence.replace('_', ' ').toLowerCase()} confidence`);
  }
  return parts.join('  ·  ');
}

interface VerdictSealProps {
  verdict: DisplayWatchVerdict;
  diagnosis?: WatchOracleComposition['diagnosis'] | null;
  /**
   * Play the three-phase reveal (sealed → turning → unveiled). Only for a
   * verdict that has just arrived: a Reading opened later shows its seal
   * already open. Reduce Motion turns the whole reveal into one short fade.
   */
  reveal?: boolean;
}

/** Phase timings from the design: I 0–600 ms, II 600–1300 ms, III 1300–1900 ms. */
const PHASE_I_MS = 600;
const PHASE_II_MS = 700;
const PHASE_III_MS = 600;
const REDUCED_FADE_MS = 200;

const SEAL_SIZE = 116;

const VerdictSeal: React.FC<VerdictSealProps> = ({ verdict, diagnosis, reveal = false }) => {
  const colors = useColors();
  const text = useReadingText();

  const tone = {
    maqbool: colors.maqbool,
    caution: colors.caution,
    mardood: colors.mardood,
    muted: colors.textMuted,
  };
  const stateColor = tone[STATE_TONE[verdict.state]] ?? colors.textMuted;
  const headline = STATE_HEADLINE[verdict.state] ?? 'This reading could not be described';
  const subline = verdictSubline(verdict, diagnosis);
  const pips = pipsForConfidence(verdict.confidence);
  const confidenceWords =
    typeof verdict.confidence === 'string'
      ? `${verdict.confidence.replace('_', ' ').toLowerCase()} confidence`
      : '';

  // 0 → 1 per phase. Start open unless this verdict is to be revealed.
  const sealIn = useRef(new Animated.Value(reveal ? 0 : 1)).current;
  const turn = useRef(new Animated.Value(reveal ? 0 : 1)).current;
  const unveil = useRef(new Animated.Value(reveal ? 0 : 1)).current;

  useEffect(() => {
    if (!reveal) {
      return;
    }
    let cancelled = false;
    let running: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduced => {
        if (cancelled) {
          return;
        }
        const timing = (value: Animated.Value, duration: number) =>
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          });
        running = reduced
          ? Animated.parallel([
              timing(sealIn, REDUCED_FADE_MS),
              timing(turn, REDUCED_FADE_MS),
              timing(unveil, REDUCED_FADE_MS),
            ])
          : Animated.sequence([
              timing(sealIn, PHASE_I_MS),
              timing(turn, PHASE_II_MS),
              timing(unveil, PHASE_III_MS),
            ]);
        running.start();
      });
    return () => {
      cancelled = true;
      running?.stop();
    };
    // The reveal runs once, for the verdict this seal was mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringOpacity = turn.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const sealScale = sealIn.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const sealOpacity = sealIn.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const starRotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['-45deg', '0deg'] });
  const rise = unveil.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <View style={styles.seal} accessibilityRole="header" testID="verdict-seal">
      <Animated.View
        style={[styles.sealArt, { opacity: sealOpacity, transform: [{ scale: sealScale }] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: ringOpacity }]}>
          <SealGlyph size={SEAL_SIZE} color={stateColor} fillColor={colors.surface} layer="ring" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: starRotate }] }]}>
          <SealGlyph size={SEAL_SIZE} color={stateColor} hiColor={colors.goldBright} layer="star" />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[styles.words, { opacity: unveil, transform: [{ translateY: rise }] }]}
        testID="verdict-seal-words"
      >
        <Text style={[text.eyebrow, styles.centred, { color: stateColor }]}>{'The verdict'}</Text>
        {pips > 0 && <StrengthPips filled={pips} color={stateColor} label={confidenceWords} />}
        <Text style={[text.headline, styles.centred, { color: colors.goldBright }]}>
          {headline}
        </Text>
        {subline.length > 0 && (
          <Text style={[text.meta, styles.centred, { color: colors.textMuted }]}>{subline}</Text>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  seal: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
    gap: 12,
  },
  sealArt: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
  },
  words: {
    alignItems: 'center',
    gap: 10,
  },
  centred: {
    textAlign: 'center',
  },
});

export default VerdictSeal;
