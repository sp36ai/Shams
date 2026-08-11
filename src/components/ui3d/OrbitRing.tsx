/**
 * OrbitRing — a slow, continuously-rotating ring of tick marks/dots meant to
 * sit behind a badge/seal/emblem, like a celestial instrument's bezel
 * turning around a fixed dial. Purely decorative, absolutely positioned to
 * fill its box; place the badge as a sibling centered on top.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

function polar(r: number, deg: number, cx: number, cy: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

interface OrbitRingProps {
  size: number;
  color: string;
  /** Number of orbiting dots. Default 8. */
  dotCount?: number;
  /** Full rotation duration in ms. Default 24000 (slow, ambient). */
  durationMs?: number;
  /** Spin direction. Default 'cw'. */
  direction?: 'cw' | 'ccw';
}

const OrbitRing: React.FC<OrbitRingProps> = ({
  size,
  color,
  dotCount = 8,
  durationMs = 24000,
  direction = 'cw',
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(direction === 'cw' ? 360 : -360, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
  }, [direction, durationMs, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (size <= 0) {
    return null;
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { width: size, height: size }, animatedStyle]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={0.6} opacity={0.25} />
        {Array.from({ length: dotCount }).map((_, i) => {
          const deg = (360 / dotCount) * i;
          const p = polar(r, deg, cx, cy);
          const major = i % 2 === 0;
          return (
            <Circle
              key={`orbit-dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={major ? 1.6 : 0.9}
              fill={color}
              opacity={major ? 0.8 : 0.4}
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OrbitRing;
