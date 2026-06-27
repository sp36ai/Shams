/**
 * CosmicClock — five-ring live ephemeris clock.
 *
 * Rings (outer → inner):
 *   1. Degree ring  — 60 tick marks + second numbers
 *   2. House band   — 12 sectors with house numbers
 *   3. Zodiac band  — 12 glyphs with element colors
 *   4. Planet track — 8 Jyotish grahas at mean longitudes
 *   5. Star core    — Star of David + 12 petals + Sun center
 *
 * Clock hands (hour / minute / second) sit above planets.
 * All planetary positions are mean-longitude approximations only — NOT
 * used for horary judgment. The Oracle engine uses the full KP engine.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';
import { dateToJD } from '@astrology/primitives/julianDay';

// ── Local ephemeris (mean longitudes only — not for judgment use) ──────────────

const JD_J2000 = 2451545.0;

function mod360(x: number): number {
  return ((x % 360) + 360) % 360;
}

// J2000.0 mean longitude elements: L = L0 + Lr × T (T in Julian centuries)
const J2K: Readonly<Record<string, { L0: number; Lr: number }>> = {
  Sun: { L0: 280.46646, Lr: 36000.76983 },
  Moon: { L0: 218.3165, Lr: 481267.8813 },
  Mercury: { L0: 252.2509, Lr: 149472.6749 },
  Venus: { L0: 181.9798, Lr: 58517.8156 },
  Mars: { L0: 355.433, Lr: 19140.2993 },
  Jupiter: { L0: 34.3515, Lr: 3034.9057 },
  Saturn: { L0: 50.0774, Lr: 1222.1138 },
};

function meanLon(name: string, T: number): number {
  const e = J2K[name];
  if (e === undefined) {
    return 0;
  }
  return mod360(e.L0 + e.Lr * T);
}

function rahuLon(T: number): number {
  return mod360(125.0445 - 1934.136 * T);
}

function lahiriAyanamsa(jd: number): number {
  const T = (jd - 2415020.0) / 36525;
  return mod360(279.6967 + 36000.769 * T - (23.452 - 0.013 * T));
}

// ── SVG layout constants ───────────────────────────────────────────────────────

// SCREEN_W, SIZE, CX, CY, S are computed inside the component via useWindowDimensions.

// Radii in design-space units (multiply by S for pixels)
const R_OUTER_BORDER = 242;
const R_OUTER_TICKS = 238;
const R_INNER_TICKS = 228;
const R_ZODIAC_OUTER = 186;
const R_ZODIAC_INNER = 152;
const R_PLANET = 126;
const R_STAR_OUTER = 72;
const R_STAR_INNER = 32;
const R_SUN = 16;

// Hand lengths / tail lengths in design-space units
const R_HAND_HOUR_FWD = 62;
const R_HAND_HOUR_BACK = 14;
const R_HAND_MIN_FWD = 90;
const R_HAND_MIN_BACK = 18;
const R_HAND_SEC_FWD = R_PLANET - 4;
const R_HAND_SEC_BACK = 22;

// ── Astronomical display data ──────────────────────────────────────────────────

interface PDef {
  name: string;
  sym: string;
  r: number;
  color: string;
  gradId: string;
  isNode?: boolean;
}

const PDEFS: readonly PDef[] = [
  { name: 'Moon', sym: '☽', r: 5.5, color: '#cbd5e1', gradId: 'gMoon' },
  { name: 'Mercury', sym: '☿', r: 4, color: '#94a3b8', gradId: 'gMerc' },
  { name: 'Venus', sym: '♀', r: 5, color: '#fef08a', gradId: 'gVen' },
  { name: 'Mars', sym: '♂', r: 4.5, color: '#f87171', gradId: 'gMars' },
  { name: 'Jupiter', sym: '♃', r: 9, color: '#fb923c', gradId: 'gJup' },
  { name: 'Saturn', sym: '♄', r: 8, color: '#fcd34d', gradId: 'gSat' },
  { name: 'Rahu', sym: '☊', r: 4.5, color: '#a78bfa', gradId: 'gRahu', isNode: true },
  { name: 'Ketu', sym: '☋', r: 4.5, color: '#fb7185', gradId: 'gKetu', isNode: true },
];

// Radial gradient stop pairs for each planet + Sun
const GRAD_STOPS: ReadonlyArray<{ id: string; s1: string; s2: string }> = [
  { id: 'gSun', s1: '#fff8d0', s2: '#92400e' },
  { id: 'gMoon', s1: '#e2e8f0', s2: '#334155' },
  { id: 'gMerc', s1: '#cbd5e1', s2: '#1e293b' },
  { id: 'gVen', s1: '#fef9c3', s2: '#854d0e' },
  { id: 'gMars', s1: '#fca5a5', s2: '#7f1d1d' },
  { id: 'gJup', s1: '#fed7aa', s2: '#431407' },
  { id: 'gSat', s1: '#fef3c7', s2: '#78350f' },
  { id: 'gRahu', s1: '#c4b5fd', s2: '#1e1b4b' },
  { id: 'gKetu', s1: '#fda4af', s2: '#4c0519' },
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
const ZODIAC_ABBR: readonly string[] = [
  'Ari',
  'Tau',
  'Gem',
  'Can',
  'Leo',
  'Vir',
  'Lib',
  'Sco',
  'Sag',
  'Cap',
  'Aqu',
  'Pis',
];
const ZODIAC_FULL: readonly string[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

// Element colors: fire=red, earth=brown, air=teal, water=blue
const ZODIAC_COLORS: readonly string[] = [
  '#ef4444',
  '#92400e',
  '#0d9488',
  '#1d4ed8', // Ari Tau Gem Can
  '#ef4444',
  '#92400e',
  '#0d9488',
  '#1d4ed8', // Leo Vir Lib Sco
  '#ef4444',
  '#92400e',
  '#0d9488',
  '#1d4ed8', // Sag Cap Aqu Pis
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function polar(
  r: number,
  deg: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
  cx: number,
  cy: number,
): string {
  const os = polar(rOuter, startDeg, cx, cy);
  const oe = polar(rOuter, endDeg, cx, cy);
  const ie = polar(rInner, endDeg, cx, cy);
  const is_ = polar(rInner, startDeg, cx, cy);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const ro = rOuter.toFixed(2);
  const ri = rInner.toFixed(2);
  return (
    `M ${os.x.toFixed(2)} ${os.y.toFixed(2)} ` +
    `A ${ro} ${ro} 0 ${large} 1 ${oe.x.toFixed(2)} ${oe.y.toFixed(2)} ` +
    `L ${ie.x.toFixed(2)} ${ie.y.toFixed(2)} ` +
    `A ${ri} ${ri} 0 ${large} 0 ${is_.x.toFixed(2)} ${is_.y.toFixed(2)} Z`
  );
}

function dms(deg: number): string {
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return `${String(d).padStart(3, '0')}° ${String(m).padStart(2, '0')}'`;
}

// ── Clock state ────────────────────────────────────────────────────────────────

interface PlanetState {
  name: string;
  lon: number;
  x: number;
  y: number;
}

interface ClockState {
  jd: number;
  ayanamsa: number;
  sunLon: number;
  moonLon: number;
  planets: PlanetState[];
  utcTime: string;
  localDate: string;
  secAngle: number;
  minAngle: number;
  hourAngle: number;
  secTipX: number;
  secTipY: number;
}

function computeState(
  date: Date,
  sidereal: boolean,
  cx: number,
  cy: number,
  s: number,
): ClockState {
  // dateToJD returns branded JDut — safe to use as number for arithmetic
  const jd = dateToJD(date) as number;
  const T = (jd - JD_J2000) / 36525;
  const ay = lahiriAyanamsa(jd);

  const raw: Record<string, number> = {
    Sun: meanLon('Sun', T),
    Moon: meanLon('Moon', T),
    Mercury: meanLon('Mercury', T),
    Venus: meanLon('Venus', T),
    Mars: meanLon('Mars', T),
    Jupiter: meanLon('Jupiter', T),
    Saturn: meanLon('Saturn', T),
    Rahu: rahuLon(T),
    Ketu: mod360(rahuLon(T) + 180),
  };

  const lons: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    lons[k] = sidereal ? mod360(v - ay) : v;
  }

  const planets: PlanetState[] = PDEFS.map(d => {
    const lon = lons[d.name] ?? 0;
    const p = polar(R_PLANET * s, lon, cx, cy);
    return { name: d.name, lon, x: p.x, y: p.y };
  });

  // Smooth sub-second clock hand angles
  const sec = date.getSeconds();
  const ms = date.getMilliseconds();
  const min = date.getMinutes();
  const hr = date.getHours();

  const secFrac = sec + ms / 1000;
  const minFrac = min + secFrac / 60;
  const hourFrac = (hr % 12) + minFrac / 60;

  const secAngle = secFrac * 6;
  const minAngle = minFrac * 6;
  const hourAngle = hourFrac * 30;

  const pad = (n: number) => String(n).padStart(2, '0');
  const tip = polar(R_HAND_SEC_FWD * s, secAngle, cx, cy);

  return {
    jd,
    ayanamsa: ay,
    sunLon: lons.Sun ?? 0,
    moonLon: lons.Moon ?? 0,
    planets,
    utcTime: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`,
    localDate: date.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    secAngle,
    minAngle,
    hourAngle,
    secTipX: tip.x,
    secTipY: tip.y,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

interface CosmicClockProps {
  running: boolean;
}

export default function CosmicClock({ running }: CosmicClockProps): React.ReactElement {
  const colors = useColors();
  const { width: SCREEN_W } = useWindowDimensions();
  const SIZE = Math.min(SCREEN_W - 24, 340);
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const S = SIZE / 500;

  const [showSaturn, setShowSaturn] = useState(true);
  const [showNodes, setShowNodes] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [sidereal, setSidereal] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  const siderealRef = useRef(false);

  useEffect(() => {
    siderealRef.current = sidereal;
  }, [sidereal]);

  // Keep a ref to the current layout so the interval always uses up-to-date values
  const layoutRef = useRef({ CX, CY, S });
  useEffect(() => {
    layoutRef.current = { CX, CY, S };
  }, [CX, CY, S]);

  const [clock, setClock] = useState<ClockState>(() => computeState(new Date(), false, CX, CY, S));

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => {
      const { CX: cx, CY: cy, S: s } = layoutRef.current;
      setClock(computeState(new Date(), siderealRef.current, cx, cy, s));
    }, 1_000);
    return () => clearInterval(id);
  }, [running]);

  // ── Static rings (computed once — no per-frame cost) ────────────────────────

  const svgDefs = useMemo(
    () => (
      <Defs>
        {GRAD_STOPS.map(({ id, s1, s2 }) => (
          <RadialGradient key={id} id={id} cx="40%" cy="35%" rx="65%" ry="65%">
            <Stop offset="0%" stopColor={s1} />
            <Stop offset="100%" stopColor={s2} />
          </RadialGradient>
        ))}
      </Defs>
    ),
    [],
  );

  const degreeRing = useMemo(() => {
    const elems: React.ReactElement[] = [
      <Circle
        key="r1ob"
        cx={CX}
        cy={CY}
        r={R_OUTER_BORDER * S}
        fill="none"
        stroke="rgba(34,211,238,0.3)"
        strokeWidth={0.6}
      />,
      <Circle
        key="r1ib"
        cx={CX}
        cy={CY}
        r={R_INNER_TICKS * S}
        fill="none"
        stroke="rgba(34,211,238,0.15)"
        strokeWidth={0.4}
      />,
    ];
    for (let i = 0; i < 60; i++) {
      const num = i + 1;
      const deg = num * 6;
      const isMajor = num % 5 === 0;
      const outerPt = polar(R_OUTER_TICKS * S, deg, CX, CY);
      const innerPt = polar((isMajor ? R_INNER_TICKS - 5 : R_INNER_TICKS - 2) * S, deg, CX, CY);
      const textPt = polar((R_INNER_TICKS - 14) * S, deg, CX, CY);

      elems.push(
        <Line
          key={`tk${i}`}
          x1={innerPt.x}
          y1={innerPt.y}
          x2={outerPt.x}
          y2={outerPt.y}
          stroke={isMajor ? '#ffffff' : 'rgba(255,255,255,0.55)'}
          strokeWidth={isMajor ? 1.2 : 0.6}
        />,
        <SvgText
          key={`tn${i}`}
          x={textPt.x}
          y={textPt.y}
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={isMajor ? 9 * S : 7 * S}
          fill={isMajor ? '#ffffff' : 'rgba(255,255,255,0.55)'}
          fontFamily="Cairo-Regular"
          fontWeight={isMajor ? 'bold' : 'normal'}
        >
          {String(num)}
        </SvgText>,
      );
    }
    return elems;
  }, [CX, CY, S]);

  const zodiacBand = useMemo(() => {
    const elems: React.ReactElement[] = [];
    for (let z = 0; z < 12; z++) {
      const start = z * 30;
      const end = start + 30;
      const mid = start + 15;
      const color = ZODIAC_COLORS[z] ?? '#ffffff';
      const glyph = ZODIAC_GLYPHS[z] ?? '?';
      const mp = polar(((R_ZODIAC_OUTER + R_ZODIAC_INNER) / 2) * S, mid, CX, CY);

      elems.push(
        <Path
          key={`zs${z}`}
          d={sectorPath(R_ZODIAC_OUTER * S, R_ZODIAC_INNER * S, start, end, CX, CY)}
          fill={`${color}18`}
          stroke={`${color}40`}
          strokeWidth={0.4}
        />,
        <SvgText
          key={`zg${z}`}
          x={mp.x}
          y={mp.y}
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={10 * S}
          fill={color}
          opacity={0.7}
        >
          {glyph}
        </SvgText>,
      );
    }
    return elems;
  }, [CX, CY, S]);

  const starGeometry = useMemo(() => {
    const elems: React.ReactElement[] = [];

    // 12 radiating lines from center to R_STAR_OUTER
    for (let i = 0; i < 12; i++) {
      const deg = i * 30;
      const outerPt = polar(R_STAR_OUTER * S, deg, CX, CY);
      elems.push(
        <Line
          key={`sl${i}`}
          x1={CX}
          y1={CY}
          x2={outerPt.x}
          y2={outerPt.y}
          stroke="rgba(34,211,238,0.15)"
          strokeWidth={0.5}
        />,
      );
    }

    // 12 slim triangle petals (alternating cyan / gold tint)
    for (let i = 0; i < 12; i++) {
      const deg = i * 30;
      const tip_ = polar(R_STAR_OUTER * S, deg, CX, CY);
      const bL = polar(R_STAR_INNER * S, deg - 5, CX, CY);
      const bR = polar(R_STAR_INNER * S, deg + 5, CX, CY);
      const petalFill = i % 2 === 0 ? 'rgba(34,211,238,0.12)' : 'rgba(251,191,36,0.10)';
      elems.push(
        <Path
          key={`sp${i}`}
          d={`M ${tip_.x.toFixed(2)} ${tip_.y.toFixed(2)} L ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} L ${bR.x.toFixed(2)} ${bR.y.toFixed(2)} Z`}
          fill={petalFill}
          stroke="none"
        />,
      );
    }

    // Triangle 1 — pointing up (vertices at 0°, 120°, 240°)
    const [t1a, t1b, t1c] = [0, 120, 240].map(d => polar(R_STAR_OUTER * S, d, CX, CY));
    elems.push(
      <Path
        key="tri1"
        d={`M ${t1a!.x.toFixed(2)} ${t1a!.y.toFixed(2)} L ${t1b!.x.toFixed(2)} ${t1b!.y.toFixed(2)} L ${t1c!.x.toFixed(2)} ${t1c!.y.toFixed(2)} Z`}
        fill="rgba(34,211,238,0.08)"
        stroke="rgba(34,211,238,0.4)"
        strokeWidth={0.8}
      />,
    );

    // Triangle 2 — pointing down (vertices at 60°, 180°, 300°)
    const [t2a, t2b, t2c] = [60, 180, 300].map(d => polar(R_STAR_OUTER * S, d, CX, CY));
    elems.push(
      <Path
        key="tri2"
        d={`M ${t2a!.x.toFixed(2)} ${t2a!.y.toFixed(2)} L ${t2b!.x.toFixed(2)} ${t2b!.y.toFixed(2)} L ${t2c!.x.toFixed(2)} ${t2c!.y.toFixed(2)} Z`}
        fill="rgba(251,191,36,0.06)"
        stroke="rgba(251,191,36,0.35)"
        strokeWidth={0.8}
      />,
    );

    // Inner circle border (gold)
    elems.push(
      <Circle
        key="star-inner-ring"
        cx={CX}
        cy={CY}
        r={R_STAR_INNER * S}
        fill="none"
        stroke="rgba(251,191,36,0.4)"
        strokeWidth={0.6}
      />,
    );

    return elems;
  }, [CX, CY, S]);

  // Planet track dashed ring — static
  const planetTrack = useMemo(
    () => (
      <Circle
        cx={CX}
        cy={CY}
        r={R_PLANET * S}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.4}
        strokeDasharray={`${3 * S} ${9 * S}`}
      />
    ),
    [CX, CY, S],
  );

  // ── Planet tap handler ───────────────────────────────────────────────────────

  const handlePlanetPress = useCallback((ps: PlanetState) => {
    const signIdx = Math.floor(ps.lon / 30) % 12;
    const signFull = ZODIAC_FULL[signIdx] ?? '';
    const deg = (ps.lon % 30).toFixed(2);
    setTip(prev => (prev === ps.name ? null : `${ps.name}  ${signFull}  ${deg}°`));
  }, []);

  // ── Dynamic planet elements ──────────────────────────────────────────────────

  const planetElems = clock.planets.map(ps => {
    const def = PDEFS.find(d => d.name === ps.name);
    if (def === undefined) {
      return null;
    }
    if ((def.name === 'Rahu' || def.name === 'Ketu') && !showNodes) {
      return null;
    }
    if (def.name === 'Saturn' && !showSaturn) {
      return null;
    }

    const { x, y, lon } = ps;
    const signIdx = Math.floor(lon / 30) % 12;
    const abbr = ZODIAC_ABBR[signIdx] ?? '';
    const spokePt = polar(R_ZODIAC_INNER * S, lon, CX, CY);
    const labelPt = polar((R_PLANET + def.r + 8) * S, lon, CX, CY);

    const onPress = () => handlePlanetPress(ps);

    return (
      <G key={def.name} onPress={onPress}>
        {/* Spoke line from zodiac inner edge to planet body */}
        <Line
          x1={spokePt.x}
          y1={spokePt.y}
          x2={x}
          y2={y}
          stroke={def.color}
          strokeWidth={0.6}
          opacity={0.4}
        />
        {/* Saturn rings */}
        {def.name === 'Saturn' && (
          <G rotation={lon} origin={`${x},${y}`}>
            <Ellipse
              cx={x}
              cy={y}
              rx={16 * S}
              ry={5 * S}
              fill="none"
              stroke="rgba(252,211,77,0.22)"
              strokeWidth={3 * S}
            />
            <Ellipse
              cx={x}
              cy={y}
              rx={19 * S}
              ry={6 * S}
              fill="none"
              stroke="rgba(252,211,77,0.38)"
              strokeWidth={1 * S}
            />
            <Ellipse
              cx={x}
              cy={y}
              rx={13 * S}
              ry={4 * S}
              fill="none"
              stroke="rgba(252,211,77,0.15)"
              strokeWidth={0.8 * S}
            />
          </G>
        )}
        {/* Outer glow aura */}
        <Circle cx={x} cy={y} r={(def.r + 4) * S} fill={def.color} opacity={0.08} />
        {/* Planet body */}
        <Circle cx={x} cy={y} r={def.r * S} fill={`url(#${def.gradId})`} />
        {/* Node symbol */}
        {def.isNode === true && (
          <SvgText
            x={x}
            y={y}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={6 * S}
            fill={def.color}
            fontWeight="bold"
          >
            {def.sym}
          </SvgText>
        )}
        {/* Label */}
        {showLabels && (
          <SvgText
            x={labelPt.x}
            y={labelPt.y}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={5.5 * S}
            fill={def.color}
            opacity={0.75}
            fontFamily="Cairo-Regular"
          >
            {`${def.sym} ${abbr}`}
          </SvgText>
        )}
      </G>
    );
  });

  // ── Clock hands ──────────────────────────────────────────────────────────────

  function handLine(fwdR: number, backR: number, angle: number, width: number): React.ReactElement {
    const tip_ = polar(fwdR * S, angle, CX, CY);
    const back = polar(-backR * S, angle, CX, CY);
    return (
      <Line
        x1={back.x}
        y1={back.y}
        x2={tip_.x}
        y2={tip_.y}
        stroke="#ffffff"
        strokeWidth={width * S}
        strokeLinecap="round"
      />
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* UTC heading */}
      <View style={styles.timeHeader}>
        <Text style={[styles.timeText, { color: colors.text }]}>{clock.utcTime}</Text>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>{clock.localDate}</Text>
      </View>

      {/* SVG clock + tooltip wrapper */}
      <View style={[styles.svgWrap, { width: SIZE, height: SIZE }]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {svgDefs}

          {/* Ring 1: Degree ring */}
          {degreeRing}

          {/* Ring 2: Zodiac band */}
          {zodiacBand}

          {/* Planet track circle */}
          {planetTrack}

          {/* Ring 4: Planets */}
          {planetElems}

          {/* Ring 5: Star geometry */}
          {starGeometry}

          {/* Clock hands — above planets */}
          {handLine(R_HAND_HOUR_FWD, R_HAND_HOUR_BACK, clock.hourAngle, 5)}
          {handLine(R_HAND_MIN_FWD, R_HAND_MIN_BACK, clock.minAngle, 3)}
          {handLine(R_HAND_SEC_FWD, R_HAND_SEC_BACK, clock.secAngle, 1.2)}

          {/* Second hand tip dot */}
          <Circle cx={clock.secTipX} cy={clock.secTipY} r={3.5 * S} fill="#ffffff" />

          {/* Center pivot */}
          <Circle cx={CX} cy={CY} r={5 * S} fill="#ffffff" />
          <Circle cx={CX} cy={CY} r={2.5 * S} fill="#030e10" />

          {/* Sun (center, always rendered last) */}
          <Circle cx={CX} cy={CY} r={26 * S} fill="#fbbf24" opacity={0.07} />
          <Circle cx={CX} cy={CY} r={R_SUN * S} fill="url(#gSun)" opacity={0.9} />
          <Circle cx={CX - 3 * S} cy={CY - 3 * S} r={5 * S} fill="#fff9e0" opacity={0.5} />
        </Svg>

        {/* Tooltip */}
        {tip !== null && (
          <View style={styles.tooltip}>
            <Text style={[styles.tooltipText, { color: colors.accent }]}>{tip}</Text>
          </View>
        )}
      </View>

      {/* Data cards */}
      <View style={styles.cards}>
        {(
          [
            { label: 'Sun Long.', value: dms(clock.sunLon) },
            { label: 'Moon Long.', value: dms(clock.moonLon) },
            { label: 'Ayanamsa', value: `${clock.ayanamsa.toFixed(3)}°` },
          ] as const
        ).map(card => (
          <View
            key={card.label}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardLabel, { color: colors.textFaint }]}>{card.label}</Text>
            <Text style={[styles.cardValue, { color: colors.accent }]}>{card.value}</Text>
          </View>
        ))}
      </View>

      {/* Toggle buttons */}
      <View style={styles.controls}>
        {(
          [
            { label: 'Sat. Rings', active: showSaturn, onPress: () => setShowSaturn(v => !v) },
            { label: 'Rahu/Ketu', active: showNodes, onPress: () => setShowNodes(v => !v) },
            { label: 'Labels', active: showLabels, onPress: () => setShowLabels(v => !v) },
            { label: 'Sidereal', active: sidereal, onPress: () => setSidereal(v => !v) },
          ] as const
        ).map(btn => (
          <TouchableOpacity
            key={btn.label}
            style={[
              styles.btn,
              {
                borderColor: btn.active ? colors.borderAccent : colors.border,
                backgroundColor: btn.active ? `${colors.accent}12` : colors.surface,
              },
            ]}
            onPress={btn.onPress}
            activeOpacity={0.75}
          >
            <Text
              style={[styles.btnText, { color: btn.active ? colors.accent : colors.textMuted }]}
            >
              {btn.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  timeHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  timeText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 26,
    letterSpacing: 3,
  },
  dateText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 2,
  },
  svgWrap: {
    marginBottom: 14,
  },
  tooltip: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(2,6,23,0.92)',
    borderWidth: 0.5,
    borderColor: 'rgba(34,211,238,0.3)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tooltipText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    maxWidth: 360,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    minWidth: 72,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  cardLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  cardValue: {
    fontFamily: 'Cairo-Regular',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
  },
  btn: {
    borderWidth: 0.5,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
