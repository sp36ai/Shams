/**
 * CastingAstrolabe — the full-screen "Casting the Sacred Chart" loading veil.
 * --------------------------------------------------------------------------
 * Shown while the Oracle is computing a horary judgment (`sending === true`
 * in OracleChatScreen). Per the design system's Oracle Loading Screen spec
 * ("Do NOT use spinner... Rotating astrolabe, Orbiting planetary glyphs,
 * Breathing seal... This screen determines perceived intelligence") this
 * replaces a bare spinner with a layered instrument illustration:
 *
 *   - Outer tick ring   — engraved brass limb, rotates slowly clockwise
 *   - Zodiac glyph ring — rotates counter-clockwise (the "rete")
 *   - Orbit ring        — glossy gold planet spheres, rotates fastest
 *   - Alidade           — thin sighting rule, rotates almost imperceptibly
 *   - Center hub        — breathing gold seal, the instrument's pivot
 *
 * All motion runs on the native driver (opacity/transform only) — no JS
 * thread cost while the network request is in flight.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import StarfieldBackground from '@components/StarfieldBackground';

function polar(r: number, deg: number, cx: number, cy: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const PLANET_ANGLES: readonly [angle: number, size: number, opacity: number][] = [
  [18, 7, 1],
  [95, 5, 0.85],
  [162, 6, 0.92],
  [230, 4.5, 0.75],
  [285, 6.5, 0.95],
  [332, 4, 0.7],
];

const ZODIAC_GLYPHS: readonly string[] = [
  '♈',
  '♉',
  '♊',
  '♋',
  '♌',
  '♍',
  '♎',
  '♏',
  '♐',
  '♑',
  '♒',
  '♓',
];

interface CastingAstrolabeProps {
  /** Loading caption, e.g. "Calculating celestial positions and divine judgement". */
  caption?: string;
}

const CastingAstrolabe: React.FC<CastingAstrolabeProps> = ({ caption }) => {
  const colors = useColors();
  const typography = useTypography();
  const { width: W } = useWindowDimensions();

  const SIZE = Math.min(W * 0.72, 296);
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  const R_OUTER = SIZE * 0.485;
  const R_OUTER_TICK_IN = SIZE * 0.44;
  const R_MID = SIZE * 0.365;
  const R_MID_GLYPH = SIZE * 0.345;
  const R_ORBIT = SIZE * 0.235;
  const R_HUB = SIZE * 0.105;

  // ── Motion values (all native-driver friendly) ──────────────────────────
  const veilAnim = useRef(new Animated.Value(0)).current;
  const outerRotate = useRef(new Animated.Value(0)).current;
  const midRotate = useRef(new Animated.Value(0)).current;
  const orbitRotate = useRef(new Animated.Value(0)).current;
  const alidadeRotate = useRef(new Animated.Value(0)).current;
  const hubBreath = useRef(new Animated.Value(0)).current;
  const haloBreath = useRef(new Animated.Value(0.35)).current;
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];

    const spin = (
      value: Animated.Value,
      durationMs: number,
      reverse = false,
    ): Animated.CompositeAnimation => {
      value.setValue(reverse ? 1 : 0);
      return Animated.loop(
        Animated.timing(value, {
          toValue: reverse ? 0 : 1,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
    };

    const breathe = (
      value: Animated.Value,
      lo: number,
      hi: number,
      halfPeriodMs: number,
    ): Animated.CompositeAnimation =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: hi,
            duration: halfPeriodMs,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: lo,
            duration: halfPeriodMs,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

    const dotPulse = (value: Animated.Value, delayMs: number): Animated.CompositeAnimation =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.25,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(840 - delayMs),
        ]),
      );

    loops.push(
      spin(outerRotate, 52000),
      spin(midRotate, 36000, true),
      spin(orbitRotate, 19000),
      spin(alidadeRotate, 70000),
      breathe(hubBreath, 0.93, 1.08, 900),
      breathe(haloBreath, 0.32, 0.62, 1300),
      dotPulse(dot1, 0),
      dotPulse(dot2, 200),
      dotPulse(dot3, 400),
    );

    Animated.timing(veilAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outerSpin = outerRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const midSpin = midRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbitSpin = orbitRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const alidadeSpin = alidadeRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: colors.bg, opacity: veilAnim }]}
      pointerEvents="none"
    >
      <StarfieldBackground />

      <View style={styles.content}>
        <Text
          style={[
            typography('heading'),
            { color: colors.goldBright, textAlign: 'center', letterSpacing: 2.2 },
          ]}
        >
          CASTING THE SACRED CHART
        </Text>
        <Text
          style={[
            typography('bodyItalic'),
            { color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 8 },
          ]}
        >
          The heavens are speaking…
        </Text>

        {/* ── Astrolabe ─────────────────────────────────────────────────── */}
        <View style={[styles.astrolabeBox, { width: SIZE, height: SIZE }]}>
          {/* Ambient halo — breathing */}
          <Animated.View
            style={[
              styles.halo,
              {
                width: SIZE * 1.32,
                height: SIZE * 1.32,
                borderRadius: (SIZE * 1.32) / 2,
                backgroundColor: colors.goldBright,
                opacity: haloBreath,
              },
            ]}
          />

          {/* Base disk — engraved brass field */}
          <Svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <RadialGradient id="baseDisk" cx="42%" cy="38%" rx="70%" ry="70%">
                <Stop offset="0%" stopColor={colors.surfaceElevated} stopOpacity={0.92} />
                <Stop offset="100%" stopColor={colors.bg} stopOpacity={0.96} />
              </RadialGradient>
              <RadialGradient id="hubGrad" cx="38%" cy="32%" rx="70%" ry="70%">
                <Stop offset="0%" stopColor={colors.goldBright} />
                <Stop offset="55%" stopColor={colors.gold} />
                <Stop offset="100%" stopColor={colors.brass} />
              </RadialGradient>
              <RadialGradient id="hubGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={colors.goldBright} stopOpacity={0.55} />
                <Stop offset="100%" stopColor={colors.goldBright} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="planetA" cx="35%" cy="30%" rx="70%" ry="70%">
                <Stop offset="0%" stopColor="#fff6d9" />
                <Stop offset="45%" stopColor={colors.goldBright} />
                <Stop offset="100%" stopColor={colors.brass} />
              </RadialGradient>
            </Defs>
            <Circle cx={CX} cy={CY} r={R_OUTER} fill="url(#baseDisk)" />
          </Svg>

          {/* Outer engraved ring — slow clockwise */}
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: outerSpin }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle
                cx={CX}
                cy={CY}
                r={R_OUTER}
                fill="none"
                stroke={colors.borderAccent}
                strokeWidth={1.4}
                opacity={0.75}
              />
              <Circle
                cx={CX}
                cy={CY}
                r={R_OUTER_TICK_IN}
                fill="none"
                stroke={colors.borderAccent}
                strokeWidth={0.6}
                opacity={0.35}
              />
              {Array.from({ length: 48 }).map((_, i) => {
                const deg = i * 7.5;
                const major = i % 4 === 0;
                const cardinal = i % 12 === 0;
                const o = polar(R_OUTER, deg, CX, CY);
                const inner = polar(
                  cardinal ? R_OUTER_TICK_IN - 6 : major ? R_OUTER_TICK_IN : R_OUTER_TICK_IN + 5,
                  deg,
                  CX,
                  CY,
                );
                return (
                  <Line
                    key={`otk${i}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={o.x}
                    y2={o.y}
                    stroke={colors.goldBright}
                    strokeWidth={cardinal ? 1.6 : major ? 1 : 0.5}
                    opacity={cardinal ? 0.85 : major ? 0.55 : 0.3}
                  />
                );
              })}
            </Svg>
          </Animated.View>

          {/* Zodiac glyph ring — the "rete", counter-rotates */}
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: midSpin }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle
                cx={CX}
                cy={CY}
                r={R_MID}
                fill="none"
                stroke={colors.borderAccent}
                strokeWidth={0.7}
                opacity={0.4}
              />
              {ZODIAC_GLYPHS.map((glyph, i) => {
                const deg = i * 30 + 15;
                const p = polar(R_MID_GLYPH, deg, CX, CY);
                return (
                  <SvgText
                    key={`z${i}`}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    alignmentBaseline="central"
                    fontSize={SIZE * 0.034}
                    fill={colors.goldBright}
                    opacity={0.55}
                  >
                    {glyph}
                  </SvgText>
                );
              })}
            </Svg>
          </Animated.View>

          {/* Orbit ring — glossy planet spheres, fastest rotation */}
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: orbitSpin }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle
                cx={CX}
                cy={CY}
                r={R_ORBIT}
                fill="none"
                stroke={colors.goldBright}
                strokeWidth={0.6}
                strokeDasharray={`${SIZE * 0.006} ${SIZE * 0.018}`}
                opacity={0.4}
              />
              {PLANET_ANGLES.map(([deg, size, opacity], i) => {
                const p = polar(R_ORBIT, deg, CX, CY);
                return (
                  <React.Fragment key={`pl${i}`}>
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={size + 4}
                      fill={colors.goldBright}
                      opacity={0.12}
                    />
                    <Circle cx={p.x} cy={p.y} r={size} fill="url(#planetA)" opacity={opacity} />
                  </React.Fragment>
                );
              })}
            </Svg>
          </Animated.View>

          {/* Alidade — thin sighting rule, almost imperceptible drift */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ rotate: alidadeSpin }] }]}
          >
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Line
                x1={CX}
                y1={CY - R_OUTER}
                x2={CX}
                y2={CY + R_OUTER}
                stroke={colors.goldBright}
                strokeWidth={0.8}
                opacity={0.22}
              />
            </Svg>
          </Animated.View>

          {/* Center hub — breathing seal, the instrument's pivot */}
          <Animated.View style={[styles.hubWrap, { transform: [{ scale: hubBreath }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle cx={CX} cy={CY} r={R_HUB * 2.1} fill="url(#hubGlow)" />
              <Circle cx={CX} cy={CY} r={R_HUB} fill="url(#hubGrad)" />
              <Circle
                cx={CX}
                cy={CY}
                r={R_HUB}
                fill="none"
                stroke={colors.goldBright}
                strokeWidth={1}
                opacity={0.8}
              />
              <SvgText
                x={CX}
                y={CY}
                textAnchor="middle"
                alignmentBaseline="central"
                fontSize={R_HUB * 1.05}
                fill={colors.bg}
                opacity={0.85}
              >
                {'✦'}
              </SvgText>
            </Svg>
          </Animated.View>
        </View>

        {/* Caption + loading dots */}
        <Text
          style={[
            typography('caption'),
            { color: colors.textMuted, textAlign: 'center', marginTop: 10 },
          ]}
        >
          {caption ?? 'Calculating celestial positions and divine judgement'}
        </Text>
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View
              key={`dot${i}`}
              style={[styles.dot, { backgroundColor: colors.goldBright, opacity: d }]}
            />
          ))}
        </View>

        {/* Quran 16:12 — the celestial witness, kept as a quiet secondary line */}
        <Text
          style={[
            typography('caption'),
            {
              color: colors.textFaint,
              textAlign: 'center',
              fontStyle: 'italic',
              fontSize: 11,
              lineHeight: 18,
              marginTop: 22,
            },
          ]}
        >
          {'وَسَخَّرَ لَكُمُ ٱلَّيۡلَ وَٱلنَّهَارَ وَٱلشَّمۡسَ وَٱلۡقَمَرَ'}
        </Text>
        <Text
          style={[
            typography('caption'),
            { color: colors.textFaint, textAlign: 'center', fontSize: 10, letterSpacing: 0.4 },
          ]}
        >
          {'He subjected for you the night, the day, the sun, the moon — Quran 16:12'}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  astrolabeBox: {
    marginTop: 18,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  hubWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default CastingAstrolabe;
