/**
 * GlowWash — a warm radial glow anchored to one corner, meant to sit as the
 * first child inside an `overflow: 'hidden'` container to fake a gradient
 * tint across a card/button. Works around `react-native-svg`'s
 * `LinearGradient`/`Rect` failing TypeScript resolution in this project —
 * a `RadialGradient`-filled `Circle`, clipped by the parent's border radius,
 * reads as a directional wash instead.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface GlowWashProps {
  width: number;
  height: number;
  color: string;
  /** Fraction of width/height where the glow is centered — 0 = left/top edge. */
  anchorX?: number;
  anchorY?: number;
  opacity?: number;
}

const GlowWash: React.FC<GlowWashProps> = ({
  width,
  height,
  color,
  anchorX = 0.08,
  anchorY = 0.5,
  opacity = 0.5,
}) => {
  const cx = width * anchorX;
  const cy = height * anchorY;
  const r = Math.max(width, height) * 0.9;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <RadialGradient id="glowWash" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} fill="url(#glowWash)" />
    </Svg>
  );
};

export default GlowWash;
