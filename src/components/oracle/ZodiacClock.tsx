/**
 * ZodiacClock — animated Sun/Moon dial for "the sky at this moment".
 * --------------------------------------------------------------------------
 * Presentation only, same discipline as RkpWatchCard: takes the already-
 * computed `longitude` values from `TransitCoordinates` verbatim — no sign
 * parsing, no re-derivation. `longitude` is `(sign - 1) * 30 + degreeInSign`,
 * computed once, server-side, in `transitCoordinatesOf()`
 * (`astrology/rkp/watchChart.ts`), the same place the verdict itself was
 * judged from.
 *
 * Plain Views + Reanimated transforms, matching RkpWatchCard/ChatBubble's
 * existing lightweight style — no react-native-svg dependency introduced
 * here (CosmicClock.tsx uses svg for its own, unrelated live/decorative
 * clock; this is a different, reading-specific snapshot — see PR #102's
 * history for why those two must stay separate).
 *
 * Theme-aware: every color comes from the active theme's tokens, so this
 * renders correctly across all 6 themes, not just darAlShams.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';

const DIAL_SIZE = 160;
const RING_INSET = 6;

export interface ZodiacClockProps {
  /** 0-360°, already flattened server-side — see TransitCoordinates.sun.longitude. */
  sunLongitude: number;
  /** 0-360°, already flattened server-side — see TransitCoordinates.moon.longitude. */
  moonLongitude: number;
  sunLabel: string;
  moonLabel: string;
}

export const ZodiacClock: React.FC<ZodiacClockProps> = ({
  sunLongitude,
  moonLongitude,
  sunLabel,
  moonLabel,
}) => {
  const colors = useColors();
  const typography = useTypography();

  const sunRotation = useSharedValue(sunLongitude);
  const moonRotation = useSharedValue(moonLongitude);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      // First paint: land directly on position, nothing to animate from.
      sunRotation.value = sunLongitude;
      moonRotation.value = moonLongitude;
      mounted.current = true;
      return;
    }
    // A reading only ever renders once (no re-judging in place), so this
    // branch is for completeness/future re-use, not something today's
    // single-render flow exercises.
    sunRotation.value = withSpring(sunLongitude, { damping: 14, stiffness: 120 });
    moonRotation.value = withTiming(moonLongitude, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [sunLongitude, moonLongitude, sunRotation, moonRotation]);

  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sunRotation.value}deg` }],
  }));
  const moonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${moonRotation.value}deg` }],
  }));

  // 12 zodiac-boundary ticks, one every 30°.
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.dial,
          { borderColor: colors.borderAccent, backgroundColor: colors.surfaceElevated },
        ]}
      >
        {ticks.map(deg => (
          <View key={deg} style={[styles.tickPivot, { transform: [{ rotate: `${deg}deg` }] }]}>
            <View style={[styles.tick, { backgroundColor: colors.border }]} />
          </View>
        ))}

        {/* Sun hand */}
        <Animated.View style={[styles.handPivot, sunStyle]}>
          <View style={[styles.sunMarker, { backgroundColor: colors.accent }]} />
        </Animated.View>

        {/* Moon hand — shorter radius than the Sun's, for visual depth */}
        <Animated.View style={[styles.handPivot, moonStyle]}>
          <View style={[styles.moonMarker, { backgroundColor: colors.text }]} />
        </Animated.View>

        {/* Center anchor — the querent's own position */}
        <View style={[styles.centerPoint, { backgroundColor: colors.text }]} />
      </View>

      <View style={styles.legend}>
        <LegendRow
          dot={colors.accent}
          label="Sun"
          value={sunLabel}
          colors={colors}
          typography={typography}
        />
        <LegendRow
          dot={colors.text}
          label="Moon"
          value={moonLabel}
          colors={colors}
          typography={typography}
        />
      </View>
    </View>
  );
};

interface LegendRowProps {
  dot: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}

const LegendRow: React.FC<LegendRowProps> = ({ dot, label, value, colors, typography }) => (
  <View style={styles.legendRow}>
    <View style={[styles.legendDot, { backgroundColor: dot }]} />
    <Text style={[typography('caption'), { color: colors.textFaint, width: 40 }]}>{label}</Text>
    <Text style={[typography('caption'), { color: colors.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dial: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickPivot: {
    position: 'absolute',
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    alignItems: 'center',
  },
  tick: {
    width: 1,
    height: RING_INSET,
    marginTop: 0,
  },
  handPivot: {
    position: 'absolute',
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    alignItems: 'center',
  },
  sunMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: RING_INSET + 2,
  },
  moonMarker: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: RING_INSET + 18,
  },
  centerPoint: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
  },
  legend: {
    gap: 8,
    flexShrink: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default ZodiacClock;
