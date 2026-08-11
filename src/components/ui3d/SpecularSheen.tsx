/**
 * SpecularSheen — a soft glint of light that sweeps once across a card when
 * it mounts (and optionally loops), like light catching a polished gem
 * facet. Reserved for the app's highest-value CTAs (premium tier cards, the
 * primary "Ask" button) — overuse cheapens the effect.
 *
 * Placement contract matches GlowWash/GlassPanel: first child inside an
 * `overflow: 'hidden'` container of known width/height.
 *
 * Built from a single soft radial blob (RadialGradient + Circle, same trick
 * as GlowWash — react-native-svg's LinearGradient/Rect fail TS resolution in
 * this project) translated diagonally across the card on a native-driver
 * transform, which is cheap enough to loop indefinitely.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface SpecularSheenProps {
  width: number;
  height: number;
  color: string;
  /** Loop the sweep forever instead of firing once on mount. Default false. */
  loop?: boolean;
  /** Delay before the (first) sweep starts, ms. Default 400. */
  delayMs?: number;
}

const SWEEP_DURATION = 1100;
const LOOP_GAP = 3400;

const SpecularSheen: React.FC<SpecularSheenProps> = ({
  width,
  height,
  color,
  loop = false,
  delayMs = 400,
}) => {
  const progress = useSharedValue(0);
  const blobSize = Math.max(width, height) * 0.85;

  useEffect(() => {
    const sweepOut = withTiming(1, { duration: SWEEP_DURATION, easing: Easing.out(Easing.quad) });
    const reset = withTiming(0, { duration: 0 });
    if (loop) {
      progress.value = withDelay(
        delayMs,
        withRepeat(withSequence(sweepOut, withDelay(LOOP_GAP, reset)), -1, false),
      );
    } else {
      progress.value = withDelay(delayMs, sweepOut);
    }
  }, [loop, delayMs, progress]);

  const blobStyle = useAnimatedStyle(() => {
    const travel = width + blobSize * 1.3;
    return {
      transform: [
        { translateX: -blobSize * 0.65 + progress.value * travel },
        { translateY: -blobSize * 0.65 + (1 - progress.value) * height * 0.4 },
      ],
    };
  });

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip, { width, height }]}
    >
      <Animated.View style={[{ width: blobSize, height: blobSize }, blobStyle]}>
        <Svg width={blobSize} height={blobSize} viewBox={`0 0 ${blobSize} ${blobSize}`}>
          <Defs>
            <RadialGradient id="sheenBlob" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <Stop offset="55%" stopColor={color} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={blobSize / 2} cy={blobSize / 2} r={blobSize / 2} fill="url(#sheenBlob)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});

export default SpecularSheen;
