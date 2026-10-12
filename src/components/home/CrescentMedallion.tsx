/**
 * CrescentMedallion — the centre of the Home mandala: a deep blue disc with a
 * warm amber glow, a luminous ivory-gold crescent and a small four-point star.
 *
 * An SVG fragment (a <G>), drawn inside MandalaEmblem's <Svg> at the given
 * centre and radius. Colours are the hero's fixed Midnight Celestial palette.
 */

import React from 'react';
import { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { CELESTIAL } from './celestialPalette';

const f = (n: number): string => n.toFixed(2);

/**
 * A crescent opening to the upper right, as one filled path: the outer disc's
 * long arc, then back along a smaller offset disc. One shape rather than a
 * disc with a background-coloured disc painted over it, so nothing covers the
 * glow behind it.
 */
export function crescentPath(cx: number, cy: number, r: number): string {
  const ix = cx + r * 0.42;
  const iy = cy - r * 0.12;
  const ir = r * 0.86;
  const dx = ix - cx;
  const dy = iy - cy;
  const d = Math.hypot(dx, dy);
  const a = (r * r - ir * ir + d * d) / (2 * d);
  const h = Math.sqrt(r * r - a * a);
  const mx = cx + (a * dx) / d;
  const my = cy + (a * dy) / d;
  const p1 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const p2 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  return (
    `M${f(p1.x)},${f(p1.y)} A${f(r)},${f(r)} 0 1 0 ${f(p2.x)},${f(p2.y)} ` +
    `A${f(ir)},${f(ir)} 0 1 1 ${f(p1.x)},${f(p1.y)} Z`
  );
}

/** A four-point star (concave diamond) centred on cx, cy. */
export function fourPointStarPath(cx: number, cy: number, r: number): string {
  const w = r * 0.28;
  return (
    `M${f(cx)},${f(cy - r)} Q${f(cx + w)},${f(cy - w)} ${f(cx + r)},${f(cy)} ` +
    `Q${f(cx + w)},${f(cy + w)} ${f(cx)},${f(cy + r)} ` +
    `Q${f(cx - w)},${f(cy + w)} ${f(cx - r)},${f(cy)} ` +
    `Q${f(cx - w)},${f(cy - w)} ${f(cx)},${f(cy - r)} Z`
  );
}

interface CrescentMedallionProps {
  cx: number;
  cy: number;
  /** Radius of the medallion disc. */
  r: number;
}

const CrescentMedallion: React.FC<CrescentMedallionProps> = ({ cx, cy, r }) => {
  const moonR = r * 0.5;
  const moonCx = cx - r * 0.08;
  const moonCy = cy + r * 0.02;
  return (
    <G>
      <Defs>
        <RadialGradient id="medallionSky" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={CELESTIAL.amber} stopOpacity={0.4} />
          <Stop offset="45%" stopColor={CELESTIAL.deepTeal} stopOpacity={1} />
          <Stop offset="100%" stopColor={CELESTIAL.midnight} stopOpacity={1} />
        </RadialGradient>
        <RadialGradient id="moonHalo" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={CELESTIAL.champagne} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={CELESTIAL.champagne} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Sky disc with its gilded rim: bronze under-stroke, gold, champagne line */}
      <Circle cx={cx} cy={cy} r={r} fill="url(#medallionSky)" />
      <Circle cx={cx} cy={cy} r={r} stroke={CELESTIAL.bronze} strokeWidth={3} fill="none" />
      <Circle cx={cx} cy={cy} r={r} stroke={CELESTIAL.antiqueGold} strokeWidth={1.4} fill="none" />
      <Circle
        cx={cx}
        cy={cy}
        r={r - 1.6}
        stroke={CELESTIAL.champagne}
        strokeWidth={0.5}
        strokeOpacity={0.7}
        fill="none"
      />

      {/* Crescent with a soft halo, then a thin champagne edge for depth */}
      <Circle cx={moonCx} cy={moonCy} r={moonR * 1.55} fill="url(#moonHalo)" />
      <Path d={crescentPath(moonCx, moonCy, moonR)} fill={CELESTIAL.ivory} />
      <Path
        d={crescentPath(moonCx, moonCy, moonR)}
        fill="none"
        stroke={CELESTIAL.champagne}
        strokeWidth={0.8}
      />

      <Path
        d={fourPointStarPath(cx + r * 0.36, cy - r * 0.2, r * 0.16)}
        fill={CELESTIAL.champagne}
      />
    </G>
  );
};

export default CrescentMedallion;
