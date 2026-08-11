/**
 * GlassPanel — decorative overlay that gives a flat card a "frosted glass /
 * brushed metal" premium finish: a soft specular highlight band across the
 * top edge plus a faint corner glow, layered above the card's own
 * background/border so it reads as a lit, curved surface instead of a flat
 * rectangle.
 *
 * Purely decorative — absolutely fills its parent, `pointerEvents="none"`.
 * Drop it as the FIRST child inside an `overflow: 'hidden'`, `borderRadius`-ed
 * container (same placement contract as GlowWash).
 *
 * Uses RadialGradient + Circle only — react-native-svg's LinearGradient/Rect
 * fail TS resolution in this project (see GlowWash).
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface GlassPanelProps {
  width: number;
  height: number;
  /** Highlight tint — usually colors.goldBright or colors.text. */
  tint: string;
  /** Overall highlight strength, 0–1. Default 0.16 (subtle). */
  intensity?: number;
}

const GlassPanel: React.FC<GlassPanelProps> = ({ width, height, tint, intensity = 0.16 }) => {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const topBandRy = height * 0.55;
  const topBandR = width * 0.85;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        {/* Wide, flattened radial anchored above the top edge — reads as a
            horizontal specular sheet sliding off a curved glass surface. */}
        <RadialGradient id="glassTopBand" cx="50%" cy="0%" rx="70%" ry={`${topBandRy}`}>
          <Stop offset="0%" stopColor={tint} stopOpacity={intensity} />
          <Stop offset="100%" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
        {/* Tight corner glint, top-left, like light catching a bevel. */}
        <RadialGradient id="glassCorner" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={tint} stopOpacity={intensity * 1.4} />
          <Stop offset="100%" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={width / 2} cy={0} r={topBandR} fill="url(#glassTopBand)" />
      <Circle cx={width * 0.14} cy={height * 0.08} r={width * 0.22} fill="url(#glassCorner)" />
    </Svg>
  );
};

export default GlassPanel;
