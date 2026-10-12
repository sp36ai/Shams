/**
 * MandalaEmblem — the gold Islamic-geometric mandala at the top of Home.
 *
 * Layers, outside in:
 *   1. gilded outer rings with a bead ring and eight four-point stars
 *   2. a lace border of 32 scallops
 *   3. 16 double-lined pointed petals
 *   4. an interlaced eight-point star: two squares ({8/2}) woven with an
 *      {8/3} star polygon, with small floral dots at the crossings
 *   5. eight small inner petals between the star's arms
 *   6. a tick ring framing the CrescentMedallion at the centre
 *
 * "Gilded" lines are three stacked strokes — a wide bronze shadow, the gold
 * line, and a fine champagne highlight — so the gold reads as metal rather
 * than a flat yellow. Everything is vector, so it stays crisp at any density.
 * Colours are the hero's fixed Midnight Celestial palette.
 *
 * Purely decorative — it carries no data, so it is hidden from screen readers.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { CELESTIAL } from './celestialPalette';
import CrescentMedallion, { fourPointStarPath } from './CrescentMedallion';

type Pt = { x: number; y: number };

function polar(r: number, deg: number, c: number): Pt {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) };
}

const f = (n: number): string => n.toFixed(2);
const pt = (p: Pt): string => `${f(p.x)},${f(p.y)}`;

/** A closed SVG path through the given points. */
function closedPath(pts: Pt[]): string {
  return `M${pts.map(pt).join(' L')} Z`;
}

/** Regular star polygon {n/k} inscribed in radius r: vertex i joins i+k. */
function starPolygonPath(c: number, r: number, n: number, k: number, rotDeg = 0): string {
  const vertex = (i: number): Pt => polar(r, rotDeg + ((i % n) * 360) / n, c);
  // {8/2} is two separate squares, so trace each cycle as its own subpath.
  const cycles = gcd(n, k);
  const per = n / cycles;
  let d = '';
  for (let s = 0; s < cycles; s++) {
    const cyc = Array.from({ length: per }).map((_, j) => vertex(s + j * k));
    d += closedPath(cyc) + ' ';
  }
  return d.trim();
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Pointed petal from base radius r0 to tip radius r1, spanning halfDeg. */
function petalPath(c: number, deg: number, r0: number, r1: number, halfDeg: number): string {
  const b1 = polar(r0, deg - halfDeg, c);
  const b2 = polar(r0, deg + halfDeg, c);
  const tip = polar(r1, deg, c);
  const k1 = polar(r0 + (r1 - r0) * 0.78, deg - halfDeg * 0.92, c);
  const k2 = polar(r0 + (r1 - r0) * 0.78, deg + halfDeg * 0.92, c);
  return `M${pt(b1)} Q${pt(k1)} ${pt(tip)} Q${pt(k2)} ${pt(b2)}`;
}

/** One outward scallop between two angles on radius r, bulging to rOut. */
function scallopPath(c: number, a0: number, a1: number, r: number, rOut: number): string {
  const p0 = polar(r, a0, c);
  const p1 = polar(r, a1, c);
  const k = polar(rOut, (a0 + a1) / 2, c);
  return `M${pt(p0)} Q${pt(k)} ${pt(p1)}`;
}

interface GildedProps {
  d?: string;
  circle?: { cx: number; cy: number; r: number };
  /** Width of the main gold line; the shadow and highlight scale from it. */
  w: number;
}

/** Bronze shadow, gold line, champagne highlight — stacked for a metal look. */
const Gilded: React.FC<GildedProps> = ({ d, circle, w }) => {
  const layers = [
    { stroke: CELESTIAL.bronze, width: w * 2.2, opacity: 0.9 },
    { stroke: CELESTIAL.antiqueGold, width: w, opacity: 1 },
    { stroke: CELESTIAL.champagne, width: w * 0.35, opacity: 0.85 },
  ];
  return (
    <>
      {layers.map((l, i) =>
        circle !== undefined ? (
          <Circle
            key={i}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            stroke={l.stroke}
            strokeWidth={l.width}
            strokeOpacity={l.opacity}
            fill="none"
          />
        ) : (
          <Path
            key={i}
            d={d}
            stroke={l.stroke}
            strokeWidth={l.width}
            strokeOpacity={l.opacity}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        ),
      )}
    </>
  );
};

interface MandalaEmblemProps {
  size?: number;
}

const MandalaEmblem: React.FC<MandalaEmblemProps> = ({ size = 260 }) => {
  const c = size / 2;
  const R = size * 0.48;
  // Line weights scale with the emblem so small phones don't get heavy lines.
  const w = Math.max(0.6, size / 260);

  // Restrained motion: a gentle entrance and a slow glow behind the crescent,
  // both skipped when the user has asked the system to reduce motion.
  const appear = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.6)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => {
        if (!cancelled) {
          setReduceMotion(v);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      appear.setValue(1);
      glow.setValue(0.8);
      return undefined;
    }
    Animated.timing(appear, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.6,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [appear, glow, reduceMotion]);

  // 1. Bead ring with eight four-point stars at the compass and diagonals.
  const beadR = R * 0.955;
  const beads = Array.from({ length: 64 }).flatMap((_, i) => {
    const deg = (i * 360) / 64;
    if (i % 8 === 0) {
      return [];
    }
    const p = polar(beadR, deg, c);
    return [
      <Circle
        key={`b${i}`}
        cx={p.x}
        cy={p.y}
        r={size * (i % 2 === 0 ? 0.0065 : 0.0042)}
        fill={i % 2 === 0 ? CELESTIAL.champagne : CELESTIAL.antiqueGold}
      />,
    ];
  });
  const compassStars = Array.from({ length: 8 }).map((_, i) => {
    const p = polar(beadR, i * 45, c);
    return (
      <Path
        key={`cs${i}`}
        d={fourPointStarPath(p.x, p.y, size * 0.022)}
        fill={CELESTIAL.champagne}
      />
    );
  });

  // 2. Lace border: 32 scallops riding on the 0.86R ring.
  const scallops = Array.from({ length: 32 })
    .map((_, i) => scallopPath(c, i * 11.25, (i + 1) * 11.25, R * 0.86, R * 0.925))
    .join(' ');

  // 3. Sixteen double-lined petals.
  const petalsOuter = Array.from({ length: 16 })
    .map((_, i) => petalPath(c, i * 22.5, R * 0.6, R * 0.86, 11.25))
    .join(' ');
  const petalsInner = Array.from({ length: 16 })
    .map((_, i) => petalPath(c, i * 22.5, R * 0.6, R * 0.79, 6.5))
    .join(' ');
  const petalDots = Array.from({ length: 16 }).map((_, i) => {
    const p = polar(R * 0.66, i * 22.5, c);
    return <Circle key={`pd${i}`} cx={p.x} cy={p.y} r={size * 0.006} fill={CELESTIAL.champagne} />;
  });

  // 4. Interlaced eight-point star.
  const squares = starPolygonPath(c, R * 0.6, 8, 2);
  const star83 = starPolygonPath(c, R * 0.6, 8, 3, 22.5);
  const crossDots = Array.from({ length: 8 }).map((_, i) => {
    const p = polar(R * 0.6, i * 45 + 22.5, c);
    return (
      <Circle key={`cd${i}`} cx={p.x} cy={p.y} r={size * 0.009} fill={CELESTIAL.antiqueGold} />
    );
  });

  // 5. Eight small inner petals, pointing between the star's arms.
  const medallionR = R * 0.3;
  const innerPetals = Array.from({ length: 8 })
    .map((_, i) => petalPath(c, i * 45 + 22.5, medallionR * 1.24, R * 0.5, 9))
    .join(' ');

  // 6. Tick ring around the medallion.
  const ticks = Array.from({ length: 48 })
    .map((_, i) => {
      const a = polar(medallionR * 1.08, i * 7.5, c);
      const b = polar(medallionR * (i % 4 === 0 ? 1.22 : 1.15), i * 7.5, c);
      return `M${pt(a)} L${pt(b)}`;
    })
    .join(' ');

  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="home-mandala"
      style={{ width: size, height: size }}
    >
      {/* Slow ambient glow behind the whole emblem */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glow }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="mandalaAura" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={CELESTIAL.champagne} stopOpacity={0.3} />
              <Stop offset="55%" stopColor={CELESTIAL.antiqueGold} stopOpacity={0.08} />
              <Stop offset="100%" stopColor={CELESTIAL.antiqueGold} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={size / 2} fill="url(#mandalaAura)" />
        </Svg>
      </Animated.View>

      <Animated.View style={{ opacity: appear, transform: [{ scale }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="mandalaField" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={CELESTIAL.deepTeal} stopOpacity={0.95} />
              <Stop offset="100%" stopColor={CELESTIAL.midnight} stopOpacity={0.9} />
            </RadialGradient>
          </Defs>

          <Circle cx={c} cy={c} r={R} fill="url(#mandalaField)" />

          {/* 1. Outer rings, beads and compass stars */}
          <Gilded circle={{ cx: c, cy: c, r: R }} w={1.4 * w} />
          <Gilded circle={{ cx: c, cy: c, r: R * 0.91 }} w={0.8 * w} />
          {beads}
          {compassStars}

          {/* 2. Lace border */}
          <Gilded d={scallops} w={0.8 * w} />
          <Gilded circle={{ cx: c, cy: c, r: R * 0.86 }} w={0.7 * w} />

          {/* 3. Petals */}
          <Gilded d={petalsOuter} w={1 * w} />
          <Path
            d={petalsInner}
            stroke={CELESTIAL.antiqueGold}
            strokeWidth={0.6 * w}
            strokeOpacity={0.75}
            fill="none"
          />
          {petalDots}
          <Gilded circle={{ cx: c, cy: c, r: R * 0.6 }} w={0.9 * w} />

          {/* 4. Interlaced eight-point star */}
          <Gilded d={squares} w={1.1 * w} />
          <Path
            d={star83}
            stroke={CELESTIAL.antiqueGold}
            strokeWidth={0.7 * w}
            strokeOpacity={0.85}
            fill="none"
          />
          {crossDots}

          {/* 5. Inner petals */}
          <Gilded d={innerPetals} w={0.7 * w} />

          {/* 6. Tick ring and the central medallion */}
          <Path d={ticks} stroke={CELESTIAL.antiqueGold} strokeWidth={0.6 * w} fill="none" />
          <CrescentMedallion cx={c} cy={c} r={medallionR} />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default MandalaEmblem;
