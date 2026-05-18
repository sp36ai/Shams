// DISPLAY ONLY — reads from OracleResponse exclusively.
// No astrology functions called. No sub-lord computed. No cusp computed.
// No imports from engine/, astrology/, or julianDay.
// Source of truth: frozen OracleResponse passed as props.

import React, { useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

// ── Constants ──────────────────────────────────────────────────────────────────

const R_OUTER = 148;
const R_SIGN_INNER = 128;
const R_PLANET = 108;
const R_HOUSE = 72;
const R_INNER = 36;

const VB_W = 330;
const VB_H = 370;
const VB_X = -165;
const VB_Y = -185;

const PLANET_ORDER = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
] as const;

const PLANET_ABBR: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mars: '♂',
  Mercury: '☿',
  Jupiter: '♃',
  Venus: '♀',
  Saturn: '♄',
  Rahu: 'Ra',
  Ketu: 'Ke',
};

const SIGN_SYMBOLS: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

const SIGN_ORDER = [
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

const ELEMENT_COLOR: Record<string, string> = {
  Aries: '#CC4400',
  Leo: '#CC4400',
  Sagittarius: '#CC4400',
  Taurus: '#2d7a2d',
  Virgo: '#2d7a2d',
  Capricorn: '#2d7a2d',
  Gemini: '#1a6b9a',
  Libra: '#1a6b9a',
  Aquarius: '#1a6b9a',
  Cancer: '#6b3fa0',
  Scorpio: '#6b3fa0',
  Pisces: '#6b3fa0',
};

const ROLE_LABEL: Record<string, string> = {
  dayLord: 'Day',
  horaLord: 'Hora',
  ascSignLord: 'Asc♈',
  ascStarLord: 'Asc★',
  moonSignLord: 'Moon♈',
  moonStarLord: 'Moon★',
};

// ── Geometry helpers ───────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function relToXY(relDeg: number, r: number): [number, number] {
  const rad = toRad(relDeg - 90);
  return [Math.cos(rad) * r, Math.sin(rad) * r];
}

function eclToRel(lon: number, ascDeg: number): number {
  return (((lon - ascDeg) % 360) + 360) % 360;
}

function sectorPath(startRel: number, spanDeg: number, innerR: number, outerR: number): string {
  const endRel = startRel + spanDeg;
  const [x1, y1] = relToXY(startRel, outerR);
  const [x2, y2] = relToXY(endRel, outerR);
  const [x3, y3] = relToXY(endRel, innerR);
  const [x4, y4] = relToXY(startRel, innerR);
  const large = spanDeg > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return (
    `M ${f(x1)} ${f(y1)} ` +
    `A ${outerR} ${outerR} 0 ${large} 1 ${f(x2)} ${f(y2)} ` +
    `L ${f(x3)} ${f(y3)} ` +
    `A ${innerR} ${innerR} 0 ${large} 0 ${f(x4)} ${f(y4)} Z`
  );
}

function normDiff(lon1: number, lon2: number): number {
  const d = Math.abs(lon2 - lon1) % 360;
  return d > 180 ? 360 - d : d;
}

type AspectKind = 'trine' | 'square' | 'sextile' | 'opposition';

function aspectKind(diff: number): AspectKind | null {
  if (diff >= 117 && diff <= 123) {
    return 'trine';
  }
  if (diff >= 87 && diff <= 93) {
    return 'square';
  }
  if (diff >= 57 && diff <= 63) {
    return 'sextile';
  }
  if (diff >= 177 && diff <= 183) {
    return 'opposition';
  }
  return null;
}

const ASPECT_STYLE: Record<AspectKind, { stroke: string; sw: number; op: number; dash?: string }> =
  {
    trine: { stroke: '#B8860B', sw: 0.6, op: 0.35 },
    square: { stroke: '#8B0000', sw: 0.5, op: 0.3 },
    sextile: { stroke: '#1a3a6b', sw: 0.5, op: 0.3 },
    opposition: { stroke: '#4a0030', sw: 0.5, op: 0.25, dash: '3 2' },
  };

// ── Props ──────────────────────────────────────────────────────────────────────

interface HoraryChartWheelProps {
  planetDegrees: Record<string, number>;
  cuspDegrees: Record<number, number>;
  cuspSigns: Record<number, string>;
  planetChain?: Record<string, { manzilLord: string; subLord: string; subSubLord: string }>;
  significators?: { favorable: string[]; denial: string[]; neutral: string[] };
  confirmedSignificators?: string[];
  deniedSignificators?: string[];
  rulingPlanets?: Array<{ planet: string; role: string; matching: boolean }>;
  moonSubLord?: string;
}

// ── Planet style helper ────────────────────────────────────────────────────────

interface PlanetStyle {
  fill: string;
  stroke: string;
  textColor: string;
  r: number;
  glow: boolean;
}

function getPlanetStyle(
  planet: string,
  moonSubLord: string | undefined,
  confirmedSignificators: string[] | undefined,
  deniedSignificators: string[] | undefined,
  significators: { favorable: string[]; denial: string[]; neutral: string[] } | undefined,
): PlanetStyle {
  if (planet === moonSubLord) {
    return { fill: '#100a1e', stroke: '#9370DB', textColor: '#C8A0FF', r: 8, glow: false };
  }
  if (confirmedSignificators?.includes(planet)) {
    return { fill: '#0d2a1a', stroke: '#FFD700', textColor: '#FFD700', r: 6, glow: true };
  }
  if (deniedSignificators?.includes(planet)) {
    return { fill: '#1a0a0a', stroke: '#8B0000', textColor: '#CC3333', r: 6, glow: false };
  }
  if (significators?.neutral.includes(planet)) {
    return { fill: '#0a1020', stroke: '#2a4a7a', textColor: '#6a9fd8', r: 6, glow: false };
  }
  return { fill: '#080e1a', stroke: '#1a3a6b', textColor: '#4a7aaa', r: 6, glow: false };
}

// ── Collision-resolved planet positions ────────────────────────────────────────

interface PlacedPlanet {
  planet: string;
  x: number;
  y: number;
  relAngle: number;
}

function placePlanets(planetDegrees: Record<string, number>, ascDeg: number): PlacedPlanet[] {
  const items = PLANET_ORDER.filter(p => planetDegrees[p] !== undefined)
    .map(p => ({ planet: p, relAngle: eclToRel(planetDegrees[p]!, ascDeg) }))
    .sort((a, b) => a.relAngle - b.relAngle);

  const THRESH = 12;
  const OFFSET = 14;

  return items.map((item, i) => {
    let r = R_PLANET;
    if (i > 0) {
      const prev = items[i - 1]!;
      if (item.relAngle - prev.relAngle < THRESH) {
        r = R_PLANET + OFFSET;
      }
    }
    const [x, y] = relToXY(item.relAngle, r);
    return { planet: item.planet, x, y, relAngle: item.relAngle };
  });
}

// ── Chart SVG ─────────────────────────────────────────────────────────────────

const ChartSvg: React.FC<HoraryChartWheelProps> = props => {
  const {
    planetDegrees,
    cuspDegrees,
    cuspSigns,
    significators,
    confirmedSignificators,
    deniedSignificators,
    moonSubLord,
  } = props;

  const ascDeg = cuspDegrees[1] ?? 0;
  const ascSignName = cuspSigns[1] ?? 'Aries';
  const ascDegInSign = Math.floor(((ascDeg % 30) + 30) % 30);

  const W = Dimensions.get('window').width - 24;
  const H = Math.round(W * (VB_H / VB_W));

  // ── Sign band sectors ────────────────────────────────────────────────────
  const signSectors = SIGN_ORDER.map((signName, n) => {
    const eclStart = n * 30;
    const startRel = eclToRel(eclStart, ascDeg);
    const midRel = startRel + 15;
    const color = ELEMENT_COLOR[signName] ?? '#1a3a6b';
    const [lx, ly] = relToXY(midRel, (R_SIGN_INNER + R_OUTER) / 2);
    const symbol = SIGN_SYMBOLS[signName] ?? '?';
    return (
      <G key={signName}>
        <Path
          d={sectorPath(startRel, 30, R_SIGN_INNER, R_OUTER)}
          fill={color}
          fillOpacity={0.12}
          stroke={color}
          strokeWidth={0.3}
          strokeOpacity={0.5}
        />
        <SvgText
          x={lx}
          y={ly}
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={11}
          fill={color}
          fillOpacity={0.85}
        >
          {symbol}
        </SvgText>
      </G>
    );
  });

  // ── Cusp lines ───────────────────────────────────────────────────────────
  const cuspLines = Array.from({ length: 12 }, (_, i) => {
    const h = i + 1;
    const lon = cuspDegrees[h] ?? 0;
    const rel = eclToRel(lon, ascDeg);
    const [x1, y1] = relToXY(rel, R_INNER);
    const [x2, y2] = relToXY(rel, R_SIGN_INNER);
    const isAsc = h === 1;
    return (
      <Line
        key={`cusp-${h}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isAsc ? '#FFD700' : '#1a3a6b'}
        strokeWidth={isAsc ? 0 : 0.4}
        opacity={isAsc ? 0 : 0.6}
      />
    );
  });

  // ── House numbers ────────────────────────────────────────────────────────
  const houseNumbers = Array.from({ length: 12 }, (_, i) => {
    const h = i + 1;
    const c1 = eclToRel(cuspDegrees[h] ?? 0, ascDeg);
    const nextH = h < 12 ? h + 1 : 1;
    const c2Raw = eclToRel(cuspDegrees[nextH] ?? 0, ascDeg);
    const c2 = c2Raw > c1 ? c2Raw : c2Raw + 360;
    const mid = c1 + (c2 - c1) / 2;
    const [x, y] = relToXY(mid, R_HOUSE);
    return (
      <SvgText
        key={`hn-${h}`}
        x={x}
        y={y}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={9}
        fill="#B8860B"
        fillOpacity={0.7}
      >
        {h}
      </SvgText>
    );
  });

  // ── Aspect lines ─────────────────────────────────────────────────────────
  const aspectLines: React.ReactElement[] = [];
  for (let i = 0; i < PLANET_ORDER.length; i++) {
    for (let j = i + 1; j < PLANET_ORDER.length; j++) {
      const p1 = PLANET_ORDER[i] as string | undefined;
      const p2 = PLANET_ORDER[j] as string | undefined;
      if (p1 === undefined || p2 === undefined) {
        continue;
      }
      const lon1 = planetDegrees[p1];
      const lon2 = planetDegrees[p2];
      if (lon1 === undefined || lon2 === undefined) {
        continue;
      }
      const kind = aspectKind(normDiff(lon1, lon2));
      if (kind === null) {
        continue;
      }
      const s = ASPECT_STYLE[kind];
      const [x1, y1] = relToXY(eclToRel(lon1, ascDeg), R_INNER);
      const [x2, y2] = relToXY(eclToRel(lon2, ascDeg), R_INNER);
      aspectLines.push(
        <Line
          key={`asp-${p1}-${p2}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={s.stroke}
          strokeWidth={s.sw}
          opacity={s.op}
          strokeDasharray={s.dash}
        />,
      );
    }
  }

  // ── Planet glyphs ────────────────────────────────────────────────────────
  const placed = placePlanets(planetDegrees, ascDeg);
  const planetGlyphs = placed.map(({ planet, x, y }) => {
    const style = getPlanetStyle(
      planet,
      moonSubLord,
      confirmedSignificators,
      deniedSignificators,
      significators,
    );
    const abbr = PLANET_ABBR[planet] ?? planet.slice(0, 2);
    return (
      <G key={`pg-${planet}`}>
        {style.glow && (
          <Circle cx={x} cy={y} r={style.r + 3} fill={style.stroke} fillOpacity={0.15} />
        )}
        <Circle
          cx={x}
          cy={y}
          r={style.r}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={planet === moonSubLord ? 1.5 : 1}
        />
        <SvgText
          x={x}
          y={y}
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={planet === moonSubLord ? 7 : 6}
          fill={style.textColor}
        >
          {abbr}
        </SvgText>
      </G>
    );
  });

  return (
    <Svg viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`} width={W} height={H}>
      <Defs>
        <RadialGradient id="bgGrad" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor="#0d1528" />
          <Stop offset="60%" stopColor="#0a0f1e" />
          <Stop offset="100%" stopColor="#060a14" />
        </RadialGradient>
      </Defs>

      {/* Background */}
      <Circle r={R_OUTER} fill="url(#bgGrad)" />

      {/* Sign band sectors */}
      {signSectors}

      {/* Sign band border rings */}
      <Circle r={R_OUTER} fill="none" stroke="#1a3a6b" strokeWidth={0.5} opacity={0.6} />
      <Circle r={R_SIGN_INNER} fill="none" stroke="#1a3a6b" strokeWidth={0.5} opacity={0.6} />

      {/* Cusp lines */}
      {cuspLines}

      {/* Aspect lines (through center disc) */}
      {aspectLines}

      {/* Planet track reference ring */}
      <Circle r={R_PLANET} fill="none" stroke="#1a3a6b" strokeWidth={0.3} opacity={0.4} />

      {/* House numbers */}
      {houseNumbers}

      {/* Inner disc */}
      <Circle r={R_INNER} fill="#0a0f1e" stroke="#B8860B" strokeWidth={1} />

      {/* Center text */}
      <SvgText
        x={0}
        y={-6}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={13}
        fill="#B8860B"
      >
        شمس
      </SvgText>
      <SvgText
        x={0}
        y={8}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={7}
        fill="#1a3a6b"
      >
        al-Asrār
      </SvgText>

      {/* Planet glyphs */}
      {planetGlyphs}

      {/* Outer rings (drawn last, on top of sectors) */}
      <Circle r={R_OUTER} fill="none" stroke="#B8860B" strokeWidth={1.2} opacity={0.8} />
      <Circle r={R_SIGN_INNER} fill="none" stroke="#B8860B" strokeWidth={0.4} opacity={0.5} />

      {/* Ascendant line — full diameter, vertical */}
      <Line
        x1={0}
        y1={-R_SIGN_INNER}
        x2={0}
        y2={R_SIGN_INNER}
        stroke="#FFD700"
        strokeWidth={1.4}
        opacity={0.9}
      />

      {/* Ascendant label (top of wheel) */}
      <SvgText
        x={0}
        y={-(R_OUTER + 16)}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={10}
        fontWeight="500"
        fill="#FFD700"
      >
        {`Asc · ${ascDegInSign}° ${ascSignName}`}
      </SvgText>

      {/* Display-only label (bottom) */}
      <SvgText
        x={0}
        y={R_OUTER + 20}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={8}
        fill="#1a3a6b"
        fillOpacity={0.7}
      >
        Sidereal · Lahiri · Placidus · display only
      </SvgText>
    </Svg>
  );
};

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TAB_LABELS = ['Sub-lords', 'Witnesses', 'Significators'] as const;
type TabIndex = 0 | 1 | 2;

interface TabBarProps {
  active: TabIndex;
  onPress: (t: TabIndex) => void;
}

const TabBar: React.FC<TabBarProps> = ({ active, onPress }) => (
  <View style={tabStyles.bar}>
    {TAB_LABELS.map((label, i) => {
      const isActive = i === active;
      return (
        <Pressable
          key={label}
          style={[tabStyles.tab, isActive && tabStyles.tabActive]}
          onPress={() => onPress(i as TabIndex)}
          accessibilityRole="tab"
          accessibilityState={{ selected: isActive }}
        >
          <Text style={[tabStyles.tabText, isActive && tabStyles.tabTextActive]}>{label}</Text>
        </Pressable>
      );
    })}
  </View>
);

// ── Tab 1: Sub-lord chain ─────────────────────────────────────────────────────

const SubLordTab: React.FC<{
  planetChain?: Record<string, { manzilLord: string; subLord: string; subSubLord: string }>;
  moonSubLord?: string;
}> = ({ planetChain, moonSubLord }) => (
  <ScrollView style={tabStyles.panel} showsVerticalScrollIndicator={false}>
    <View style={tabStyles.tableHeader}>
      {['Planet', 'Manzil Lord', 'Sub Lord', 'Sub-Sub'].map(h => (
        <Text key={h} style={[tabStyles.colHead, { flex: h === 'Planet' ? 1.2 : 1 }]}>
          {h}
        </Text>
      ))}
    </View>
    {PLANET_ORDER.map(p => {
      const chain = planetChain?.[p];
      const isMsl = p === moonSubLord;
      return (
        <View key={p} style={[tabStyles.tableRow, isMsl && tabStyles.mslRow]}>
          <Text style={[tabStyles.cell, { flex: 1.2, color: isMsl ? '#C8A0FF' : '#6a9fd8' }]}>
            {PLANET_ABBR[p] ?? p} {p}
          </Text>
          <Text style={[tabStyles.cell, { flex: 1, color: '#4a7aaa' }]}>
            {chain?.manzilLord ?? '—'}
          </Text>
          <Text style={[tabStyles.cell, { flex: 1, color: isMsl ? '#C8A0FF' : '#4a7aaa' }]}>
            {chain?.subLord ?? '—'}
          </Text>
          <Text style={[tabStyles.cell, { flex: 1, color: '#4a7aaa' }]}>
            {chain?.subSubLord ?? '—'}
          </Text>
        </View>
      );
    })}
    <View style={tabStyles.spacer} />
  </ScrollView>
);

// ── Tab 2: Witnesses (ruling planets) ─────────────────────────────────────────

const WitnessesTab: React.FC<{
  rulingPlanets?: Array<{ planet: string; role: string; matching: boolean }>;
  confirmedSignificators?: string[];
  deniedSignificators?: string[];
}> = ({ rulingPlanets, confirmedSignificators, deniedSignificators }) => {
  if (!rulingPlanets || rulingPlanets.length === 0) {
    return (
      <View style={tabStyles.panel}>
        <Text style={tabStyles.empty}>No ruling planet data</Text>
      </View>
    );
  }
  return (
    <ScrollView style={tabStyles.panel} showsVerticalScrollIndicator={false}>
      {rulingPlanets.map(rp => {
        const isConfirmed = confirmedSignificators?.includes(rp.planet) ?? false;
        const isDenied = deniedSignificators?.includes(rp.planet) ?? false;
        const chipStyle = isConfirmed
          ? { bg: '#0d2010', text: '#FFD700', border: '#B8860B', label: 'Confirmed ✓' }
          : isDenied
            ? { bg: '#1a0808', text: '#CC3333', border: '#8B0000', label: 'Opposing ✗' }
            : { bg: '#0a1020', text: '#4a7aaa', border: '#1a3a6b', label: 'Neutral' };
        return (
          <View key={rp.role} style={tabStyles.witnessRow}>
            <Text style={tabStyles.witnessPlanet}>{rp.planet}</Text>
            <Text style={tabStyles.witnessRole}>{ROLE_LABEL[rp.role] ?? rp.role}</Text>
            <View
              style={[
                tabStyles.chip,
                { backgroundColor: chipStyle.bg, borderColor: chipStyle.border },
              ]}
            >
              <Text style={[tabStyles.chipText, { color: chipStyle.text }]}>{chipStyle.label}</Text>
            </View>
          </View>
        );
      })}
      <View style={tabStyles.spacer} />
    </ScrollView>
  );
};

// ── Tab 3: Significators ──────────────────────────────────────────────────────

const SigRow: React.FC<{
  label: string;
  planets: string[];
  chipColor: string;
  borderColor: string;
  textColor: string;
}> = ({ label, planets, chipColor, borderColor, textColor }) => (
  <View style={tabStyles.sigRow}>
    <Text style={tabStyles.sigLabel}>{label}</Text>
    <View style={tabStyles.sigChips}>
      {planets.length === 0 ? (
        <Text style={tabStyles.empty}>—</Text>
      ) : (
        planets.map(p => (
          <View key={p} style={[tabStyles.chip, { backgroundColor: chipColor, borderColor }]}>
            <Text style={[tabStyles.chipText, { color: textColor }]}>{p}</Text>
          </View>
        ))
      )}
    </View>
  </View>
);

const SignificatorsTab: React.FC<{
  significators?: { favorable: string[]; denial: string[]; neutral: string[] };
  confirmedSignificators?: string[];
  deniedSignificators?: string[];
}> = ({ significators, confirmedSignificators, deniedSignificators }) => (
  <ScrollView style={tabStyles.panel} showsVerticalScrollIndicator={false}>
    <SigRow
      label="Favorable"
      planets={significators?.favorable ?? []}
      chipColor="#0a1e10"
      borderColor="#2d7a2d"
      textColor="#5aaa6a"
    />
    <SigRow
      label="Denial"
      planets={significators?.denial ?? []}
      chipColor="#1a0808"
      borderColor="#8B0000"
      textColor="#CC3333"
    />
    <SigRow
      label="Neutral"
      planets={significators?.neutral ?? []}
      chipColor="#0a1020"
      borderColor="#1a3a6b"
      textColor="#4a7aaa"
    />
    <View style={tabStyles.divider} />
    <SigRow
      label="Confirmed ✓"
      planets={confirmedSignificators ?? []}
      chipColor="#0d2010"
      borderColor="#B8860B"
      textColor="#FFD700"
    />
    <SigRow
      label="Opposing ✗"
      planets={deniedSignificators ?? []}
      chipColor="#1a0808"
      borderColor="#8B0000"
      textColor="#CC3333"
    />
    <View style={tabStyles.spacer} />
  </ScrollView>
);

// ── HoraryChartWheel ──────────────────────────────────────────────────────────

const HoraryChartWheel: React.FC<HoraryChartWheelProps> = props => {
  const [activeTab, setActiveTab] = useState<TabIndex>(0);

  return (
    <View style={styles.container}>
      <ChartSvg {...props} />
      <TabBar active={activeTab} onPress={setActiveTab} />
      {activeTab === 0 && (
        <SubLordTab planetChain={props.planetChain} moonSubLord={props.moonSubLord} />
      )}
      {activeTab === 1 && (
        <WitnessesTab
          rulingPlanets={props.rulingPlanets}
          confirmedSignificators={props.confirmedSignificators}
          deniedSignificators={props.deniedSignificators}
        />
      )}
      {activeTab === 2 && (
        <SignificatorsTab
          significators={props.significators}
          confirmedSignificators={props.confirmedSignificators}
          deniedSignificators={props.deniedSignificators}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#060a14',
    alignItems: 'center',
  },
});

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#0a0f1e',
    borderTopWidth: 1,
    borderTopColor: '#1a3a6b',
    width: '100%',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#B8860B',
  },
  tabText: {
    fontSize: 12,
    color: '#4a7aaa',
  },
  tabTextActive: {
    color: '#FFD700',
  },
  panel: {
    width: '100%',
    maxHeight: 220,
    backgroundColor: '#060a14',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a3a6b',
  },
  colHead: {
    fontSize: 10,
    color: '#1a3a6b',
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#0d1528',
  },
  mslRow: {
    backgroundColor: '#1a0f2e',
    borderLeftWidth: 2,
    borderLeftColor: '#9370DB',
  },
  cell: {
    fontSize: 11,
  },
  witnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#0d1528',
    gap: 8,
  },
  witnessPlanet: {
    fontSize: 12,
    color: '#6a9fd8',
    width: 72,
  },
  witnessRole: {
    fontSize: 11,
    color: '#1a3a6b',
    flex: 1,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 10,
  },
  sigRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#0d1528',
    gap: 8,
  },
  sigLabel: {
    fontSize: 11,
    color: '#1a3a6b',
    width: 74,
    paddingTop: 2,
  },
  sigChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a3a6b',
    marginVertical: 4,
    marginHorizontal: 12,
    opacity: 0.4,
  },
  empty: {
    fontSize: 11,
    color: '#1a3a6b',
    paddingTop: 2,
  },
  spacer: {
    height: 12,
  },
});

export default HoraryChartWheel;
