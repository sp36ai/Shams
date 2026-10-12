/**
 * MandalaEmblem — the gold geometric mandala at the top of the Home hero:
 * concentric rings, a ring of petals, two interlaced squares (an eight-point
 * star) and a crescent with a five-point star at the centre.
 *
 * Drawn entirely in react-native-svg from the active theme's gold tokens, so
 * it follows whichever theme the user picked. Purely decorative — it carries
 * no data, so it is hidden from screen readers.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';

function polar(r: number, deg: number, cx: number, cy = cx): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** A closed SVG path through the given points. */
function closedPath(pts: { x: number; y: number }[]): string {
  return `M${pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L')} Z`;
}

/** Path of a regular star polygon. */
function starPath(cx: number, cy: number, outer: number, inner: number, tips: number): string {
  const pts = Array.from({ length: tips * 2 }).map((_, i) =>
    polar(i % 2 === 0 ? outer : inner, (i * 180) / tips, cx, cy),
  );
  return closedPath(pts);
}

/** Path of a square inscribed in radius r, rotated by rotDeg. */
function squarePath(c: number, r: number, rotDeg: number): string {
  return closedPath([0, 90, 180, 270].map(d => polar(r, d + rotDeg, c)));
}

interface MandalaEmblemProps {
  size?: number;
}

const PETALS = 16;

const MandalaEmblem: React.FC<MandalaEmblemProps> = ({ size = 200 }) => {
  const colors = useColors();
  const c = size / 2;
  const R = size * 0.48;

  // Petal ring — each petal is a pointed arch between two radii.
  const petals = Array.from({ length: PETALS }).map((_, i) => {
    const deg = (i * 360) / PETALS;
    const half = 180 / PETALS;
    const base1 = polar(R * 0.62, deg - half, c);
    const base2 = polar(R * 0.62, deg + half, c);
    const tip = polar(R * 0.9, deg, c);
    const ctrl1 = polar(R * 0.84, deg - half * 0.9, c);
    const ctrl2 = polar(R * 0.84, deg + half * 0.9, c);
    const d =
      `M${base1.x.toFixed(2)},${base1.y.toFixed(2)} ` +
      `Q${ctrl1.x.toFixed(2)},${ctrl1.y.toFixed(2)} ${tip.x.toFixed(2)},${tip.y.toFixed(2)} ` +
      `Q${ctrl2.x.toFixed(2)},${ctrl2.y.toFixed(2)} ${base2.x.toFixed(2)},${base2.y.toFixed(2)}`;
    return <Path key={`p${i}`} d={d} stroke={colors.gold} strokeWidth={1} fill="none" />;
  });

  // Small dots between the outer rings.
  const beads = Array.from({ length: 32 }).map((_, i) => {
    const p = polar(R * 0.955, (i * 360) / 32, c);
    return <Circle key={`b${i}`} cx={p.x} cy={p.y} r={size * 0.006} fill={colors.goldBright} />;
  });

  // Crescent: a bright disc with an offset bg-coloured disc cut out of it.
  const moonR = R * 0.2;
  const moonCx = c - R * 0.03;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="home-mandala"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="mandalaGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={colors.goldBright} stopOpacity={0.28} />
            <Stop offset="60%" stopColor={colors.gold} stopOpacity={0.08} />
            <Stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx={c} cy={c} r={R} fill="url(#mandalaGlow)" />
        <Circle cx={c} cy={c} r={R} stroke={colors.goldBright} strokeWidth={1.4} fill="none" />
        <Circle cx={c} cy={c} r={R * 0.91} stroke={colors.gold} strokeWidth={0.8} fill="none" />
        {beads}
        <G>{petals}</G>
        <Circle cx={c} cy={c} r={R * 0.62} stroke={colors.gold} strokeWidth={1} fill="none" />

        {/* Two interlaced squares — the eight-point star */}
        <Path
          d={squarePath(c, R * 0.6, 0)}
          stroke={colors.goldBright}
          strokeWidth={1.2}
          fill="none"
        />
        <Path
          d={squarePath(c, R * 0.6, 45)}
          stroke={colors.goldBright}
          strokeWidth={1.2}
          fill="none"
        />
        <Circle cx={c} cy={c} r={R * 0.38} stroke={colors.gold} strokeWidth={0.8} fill="none" />

        {/* Crescent and star */}
        <Circle cx={moonCx} cy={c} r={moonR} fill={colors.goldBright} />
        <Circle
          cx={moonCx + moonR * 0.42}
          cy={c - moonR * 0.12}
          r={moonR * 0.86}
          fill={colors.bg}
        />
        <Path
          d={starPath(c + R * 0.12, c - R * 0.04, R * 0.075, R * 0.03, 5)}
          fill={colors.goldBright}
        />
      </Svg>
    </View>
  );
};

export default MandalaEmblem;
