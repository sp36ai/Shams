/**
 * ManzilEmblem — the glowing compass-rose emblem for the home dashboard's
 * Moon Manzil card, matching the Dār al-Shams reference mockup: fine
 * radiating lines from a bright breathing core, on a dark circular field.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';

function polar(r: number, deg: number, cx: number, cy: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

interface ManzilEmblemProps {
  size?: number;
}

const ManzilEmblem: React.FC<ManzilEmblemProps> = ({ size = 84 }) => {
  const colors = useColors();
  const CX = size / 2;
  const CY = size / 2;
  const R_OUTER = size * 0.46;

  const glow = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.55,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const spokes = Array.from({ length: 24 }).map((_, i) => {
    const deg = i * 15;
    const major = i % 3 === 0;
    const o = polar(R_OUTER, deg, CX, CY);
    const inner = polar(major ? R_OUTER * 0.2 : R_OUTER * 0.42, deg, CX, CY);
    return (
      <Line
        key={`sp${i}`}
        x1={inner.x}
        y1={inner.y}
        x2={o.x}
        y2={o.y}
        stroke={colors.goldBright}
        strokeWidth={major ? 0.8 : 0.4}
        opacity={major ? 0.5 : 0.22}
      />
    );
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="manzilField" cx="50%" cy="50%" rx="65%" ry="65%">
            <Stop offset="0%" stopColor={colors.surfaceElevated} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity={0.97} />
          </RadialGradient>
        </Defs>
        <Circle cx={CX} cy={CY} r={R_OUTER} fill="url(#manzilField)" />
        <Circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="none"
          stroke={colors.borderAccent}
          strokeWidth={0.8}
          opacity={0.5}
        />
        {spokes}
      </Svg>
      {/* Breathing core glow — plain view, layered above the SVG field */}
      <Animated.View
        style={[
          styles.core,
          {
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: (size * 0.16) / 2,
            backgroundColor: colors.goldBright,
            opacity: glow,
            shadowColor: colors.goldBright,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default ManzilEmblem;
