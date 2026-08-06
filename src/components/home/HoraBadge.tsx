/**
 * HoraBadge — small circular "instrument" emblem for the home dashboard's
 * Current Hora card, matching the Dār al-Shams reference mockup: an engraved
 * tick ring around the current hora lord's planetary glyph, on a glossy
 * radial-gradient dome (a miniature astrolabe, not a flat icon).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';

function polar(r: number, deg: number, cx: number, cy: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

interface HoraBadgeProps {
  glyph: string;
  size?: number;
}

const HoraBadge: React.FC<HoraBadgeProps> = ({ glyph, size = 86 }) => {
  const colors = useColors();
  const CX = size / 2;
  const CY = size / 2;
  const R_OUTER = size * 0.47;
  const R_TICK_IN = size * 0.4;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="horaBadgeDome" cx="38%" cy="30%" rx="70%" ry="70%">
            <Stop offset="0%" stopColor={colors.surfaceElevated} stopOpacity={0.95} />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity={0.98} />
          </RadialGradient>
        </Defs>
        <Circle cx={CX} cy={CY} r={R_OUTER} fill="url(#horaBadgeDome)" />
        <Circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="none"
          stroke={colors.borderAccent}
          strokeWidth={1.2}
          opacity={0.8}
        />
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
              stroke={colors.goldBright}
              strokeWidth={major ? 1.4 : 0.6}
              opacity={major ? 0.75 : 0.35}
            />
          );
        })}
        <SvgText
          x={CX}
          y={CY}
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={size * 0.32}
          fill={colors.goldBright}
        >
          {glyph}
        </SvgText>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HoraBadge;
