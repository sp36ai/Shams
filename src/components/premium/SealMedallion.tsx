/**
 * SealMedallion — reusable "instrument dome" mount for an icon/glyph/image.
 * --------------------------------------------------------------------------
 * Generalizes the dome-and-tick-ring treatment HoraBadge pioneered for the
 * current-hora glyph (an engraved tick ring around a glossy radial-gradient
 * dome — a miniature astrolabe, not a flat circle) into a component any
 * screen can mount a badge, tier seal, or CTA icon inside.
 *
 * Content is layered as a normal RN View centered over the SVG dome (not
 * baked into the SVG via SvgText) so callers can pass emoji, an <Image>,
 * or a nested icon component and get correct font/asset rendering.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';

function polar(r: number, deg: number, cx: number, cy: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export type SealRingStyle = 'ticks' | 'plain' | 'ornate';

export interface SealMedallionProps {
  size?: number;
  /** 'ticks' = 24-hour astrolabe ring (HoraBadge style). 'plain' = single ring, no ticks — for mounting artwork/photos. 'ornate' = double ring + ticks + cardinal gems. */
  ringStyle?: SealRingStyle;
  /** Dome + ring accent. Defaults to theme.colors.goldBright. */
  accentColor?: string;
  children?: React.ReactNode;
}

const SealMedallion: React.FC<SealMedallionProps> = ({
  size = 64,
  ringStyle = 'ticks',
  accentColor,
  children,
}) => {
  const colors = useColors();
  const accent = accentColor ?? colors.goldBright;
  const CX = size / 2;
  const CY = size / 2;
  const R_OUTER = size * 0.47;
  const R_TICK_IN = size * 0.4;
  const R_INNER = size * 0.34;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="sealMedallionDome" cx="38%" cy="30%" rx="70%" ry="70%">
            <Stop offset="0%" stopColor={colors.surfaceElevated} stopOpacity={0.95} />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity={0.98} />
          </RadialGradient>
        </Defs>

        {/* Glossy dome fill */}
        <Circle cx={CX} cy={CY} r={R_OUTER} fill="url(#sealMedallionDome)" />

        {/* Outer engraved ring */}
        <Circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="none"
          stroke={colors.borderAccent}
          strokeWidth={1.2}
          opacity={0.8}
        />

        {ringStyle === 'ornate' && (
          <Circle
            cx={CX}
            cy={CY}
            r={R_INNER}
            fill="none"
            stroke={accent}
            strokeWidth={0.6}
            opacity={0.4}
          />
        )}

        {ringStyle !== 'plain' && (
          <>
            <Circle
              cx={CX}
              cy={CY}
              r={R_TICK_IN}
              fill="none"
              stroke={colors.borderAccent}
              strokeWidth={0.5}
              opacity={0.35}
            />
            {Array.from({ length: 24 }).map((_, i) => {
              const deg = i * 15;
              const major = i % 6 === 0;
              const o = polar(R_OUTER, deg, CX, CY);
              const inner = polar(major ? R_TICK_IN - 3 : R_TICK_IN + 2, deg, CX, CY);
              return (
                <Line
                  key={`t${i}`}
                  x1={inner.x}
                  y1={inner.y}
                  x2={o.x}
                  y2={o.y}
                  stroke={accent}
                  strokeWidth={major ? 1.4 : 0.6}
                  opacity={major ? 0.75 : 0.35}
                />
              );
            })}
          </>
        )}

        {ringStyle === 'ornate' &&
          [0, 90, 180, 270].map(deg => {
            const p = polar(R_OUTER, deg, CX, CY);
            return (
              <Circle key={`gem${deg}`} cx={p.x} cy={p.y} r={1.4} fill={accent} opacity={0.85} />
            );
          })}
      </Svg>

      {children !== undefined && (
        <View pointerEvents="none" style={styles.contentOverlay}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SealMedallion;
