/**
 * SkyClockScreen — Sky State timing panel.
 *
 * Layout:
 *   1. Header with back button
 *   2. TimingBar — hora, day, moon sign, nakshatra, LST, moon phase
 *      Refreshes every 60 s; timer runs only while screen is focused.
 *   3. CollapsibleCosmicClock — collapsed by default.
 *      CosmicClock's setInterval runs only when focused AND expanded.
 *   4. PlanetTable — Planet | Sign | Degree | Status
 *      Each row also carries a dignity note (Exalted/OwnSign/FriendlySign/
 *      EnemySign/Debilitated) beneath it when the placement is notable —
 *      motion status (Direct/Retrograde/Combust) and dignity are independent
 *      axes, so e.g. Venus can read "Direct" AND "Debilitated in Virgo".
 *      Disclaimer: approximate display only, not used for horary judgment.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useSettingsStore } from '@stores/settingsStore';
import { dayLordAtMoment, horaLordAtMoment } from '@astrology/primitives/rulingPlanets';
import { buildChart } from '@astrology/primitives/chartBuilder';
import { dignityOf, type Dignity } from '@astrology/rkp/rules';
import StarfieldBackground from '@components/StarfieldBackground';
import CosmicClock from '@components/home/CosmicClock';
import type { RootStackParamList } from '@navigation/types';
import {
  SIGN_NAMES,
  displayLonSidereal,
  nakshatraName,
  moonPhase,
  localSiderealTime,
  PLANET_GLYPHS,
  TABLE_PLANET_ORDER,
  type PlanetName,
} from '@utils/siderealPositions';

// ── Timing state ──────────────────────────────────────────────────────────────

interface TimingState {
  horaLord: string;
  dayLord: string;
  moonSign: string;
  moonNakshatra: string;
  moonPhaseFull: string;
  lst: string;
  timeLabel: string;
}

function computeTiming(lonDeg: number): TimingState {
  const now = Date.now();
  const moonLon = displayLonSidereal('Moon', now);
  const signIdx = Math.floor(moonLon / 30);
  return {
    horaLord: horaLordAtMoment(now, lonDeg),
    dayLord: dayLordAtMoment(now, lonDeg),
    moonSign: SIGN_NAMES[signIdx] ?? '—',
    moonNakshatra: nakshatraName(moonLon),
    moonPhaseFull: moonPhase(now),
    lst: localSiderealTime(now, lonDeg),
    timeLabel: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

// ── Planet table ──────────────────────────────────────────────────────────────

// Manuscript-toned status colors — no harsh red/orange in the sacred observatory
const STATUS_RETROGRADE = '#8C7A9A'; // muted violet — retrograde motion restrained
const STATUS_COMBUST = '#B8952A'; // aged brass — combustion, closeness to the Sun

// Dignity colors — a second, independent axis from motion/combustion above.
// A planet can be Direct *and* Debilitated (Venus in Virgo) or Retrograde
// *and* Exalted at once; these badges never replace the STATUS word, they
// sit alongside it.
const DIGNITY_EXALTED = '#D4AF37'; // bright gold — full strength
const DIGNITY_OWN_SIGN = '#6FA787'; // sage green — at home
const DIGNITY_FRIENDLY = '#7FA3B0'; // soft teal — welcomed by the sign's lord
const DIGNITY_ENEMY = '#B8735A'; // muted terracotta — hosted by a foe
const DIGNITY_DEBILITATED = '#A85C5C'; // muted rust — weakened

const DIGNITY_ICON: Readonly<Record<Dignity, string>> = {
  Exalted: '↑',
  OwnSign: '⌂',
  FriendlySign: '◇',
  NeutralSign: '',
  EnemySign: '⚔',
  Debilitated: '↓',
};

const DIGNITY_LABEL: Readonly<Record<Dignity, string>> = {
  Exalted: 'Exalted',
  OwnSign: 'Own Sign',
  FriendlySign: 'Friendly Sign',
  NeutralSign: '',
  EnemySign: 'Enemy Sign',
  Debilitated: 'Debilitated',
};

function dignityColor(dignity: Dignity): string {
  switch (dignity) {
    case 'Exalted':
      return DIGNITY_EXALTED;
    case 'OwnSign':
      return DIGNITY_OWN_SIGN;
    case 'FriendlySign':
      return DIGNITY_FRIENDLY;
    case 'EnemySign':
      return DIGNITY_ENEMY;
    case 'Debilitated':
      return DIGNITY_DEBILITATED;
    case 'NeutralSign':
      return '';
  }
}

interface PlanetRow {
  name: PlanetName;
  glyph: string;
  sign: string;
  degreeStr: string;
  status: 'Retrograde' | 'Combust' | 'Direct';
  dignity: Dignity;
}

// Uses the same Moshier-ephemeris chart engine that powers real horary
// judgment (buildChart), rather than a linear mean-longitude approximation.
// A mean-longitude model is a straight line in time — its derivative is a
// constant, so it can *never* show real retrograde motion (Mercury, Venus,
// Mars, Jupiter, Saturn each retrograde for real weeks-to-months stretches
// every year). buildChart's isRetrograde/isCombust come from a true ±12h
// finite-difference speed check against the actual ephemeris position, with
// per-planet combustion orbs — the same numbers the oracle's verdict uses.
function computePlanetRows(nowMs: number, latDeg: number, lonDeg: number): PlanetRow[] {
  const chart = buildChart(new Date(nowMs).toISOString(), latDeg, lonDeg);
  return TABLE_PLANET_ORDER.map(name => {
    const p = chart.planets[name];
    const sign = SIGN_NAMES[p.sign - 1] ?? '—';
    const deg = Math.floor(p.degreeInSign);
    const arcMin = Math.floor((p.degreeInSign - deg) * 60);
    const degreeStr = `${deg}°${String(arcMin).padStart(2, '0')}'`;

    let status: PlanetRow['status'];
    if (p.isRetrograde) {
      status = 'Retrograde';
    } else if (p.isCombust) {
      status = 'Combust';
    } else {
      status = 'Direct';
    }

    const dignity = dignityOf(name, p.sign);

    return { name, glyph: PLANET_GLYPHS[name], sign, degreeStr, status, dignity };
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

const SkyClockScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Al-Falak is now a persistent tab — canGoBack() is false when reached by
  // tapping the tab directly, so the back arrow falls back to the Home tab.
  const tabNavigation = useNavigation<{ navigate: (screen: string) => void }>();

  const lastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.lastLocation,
  );
  const lonDeg = lastLocation?.lon ?? 74.3587;
  const latDeg = lastLocation?.lat ?? 31.634;

  const [timing, setTiming] = useState<TimingState>(() => computeTiming(lonDeg));
  const [focused, setFocused] = useState(false);
  const [clockExpanded, setClockExpanded] = useState(true);
  const [planetRows, setPlanetRows] = useState<PlanetRow[]>(() =>
    computePlanetRows(Date.now(), latDeg, lonDeg),
  );

  // Refresh timing + planet rows every second — a "sky clock" should always
  // read as live, not as a snapshot that goes stale for up to a minute.
  // buildChart() is cheap (single-digit ms), so a 1 Hz refresh here is no
  // heavier than the CosmicClock's own per-second tick below. Only runs
  // while this screen is actually focused.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setTiming(computeTiming(lonDeg));
      setPlanetRows(computePlanetRows(Date.now(), latDeg, lonDeg));
      const id = setInterval(() => {
        setTiming(computeTiming(lonDeg));
        setPlanetRows(computePlanetRows(Date.now(), latDeg, lonDeg));
      }, 1_000);
      return () => {
        setFocused(false);
        clearInterval(id);
      };
    }, [lonDeg, latDeg]),
  );

  const clockRunning = focused && clockExpanded;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground starColor={colors.starfield} />

      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Pressable
          onPress={() =>
            navigation.canGoBack() ? navigation.goBack() : tabNavigation.navigate('Home')
          }
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[typography('label'), { color: colors.accent, fontSize: 20 }]}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.6 }]}>
            AL-FALAK
          </Text>
          <Text style={[typography('subheading'), { color: colors.text, marginTop: 2 }]}>
            {timing.timeLabel}
          </Text>
        </View>
        <Text
          style={[
            typography('caption'),
            { color: colors.textMuted, textAlign: 'right', fontStyle: 'italic' },
          ]}
        >
          Live Sky Clock
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TimingBar */}
        <View
          style={[
            styles.timingBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TimingPill
            label="Hora"
            value={timing.horaLord}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill label="Day" value={timing.dayLord} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill
            label="Moon"
            value={timing.moonSign}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill
            label="Nakshatra"
            value={timing.moonNakshatra}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill label="LST" value={timing.lst} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill
            label="Phase"
            value={timing.moonPhaseFull}
            colors={colors}
            typography={typography}
          />
        </View>

        {/* CollapsibleCosmicClock */}
        <View style={[styles.clockSection, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => setClockExpanded(v => !v)}
            style={[
              styles.clockToggle,
              { borderBottomColor: clockExpanded ? colors.border : 'transparent' },
            ]}
            accessibilityRole="button"
          >
            <Text style={[typography('label'), { color: colors.goldBright, letterSpacing: 1 }]}>
              CELESTIAL CLOCK
            </Text>
            <Text style={[typography('caption'), { color: colors.textMuted, fontStyle: 'italic' }]}>
              {clockExpanded ? 'Collapse ▲' : 'Expand ▼'}
            </Text>
          </Pressable>
          {clockExpanded && <CosmicClock running={clockRunning} />}
        </View>

        {/* Planet table */}
        <View style={styles.planetSection}>
          <Text
            style={[
              typography('label'),
              styles.sectionLabel,
              { color: colors.goldBright, letterSpacing: 1.2 },
            ]}
          >
            CURRENT SKY · SIDEREAL (LAHIRI)
          </Text>
          <View
            style={[
              styles.planetTable,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {/* Header row */}
            <View
              style={[
                styles.tableHeader,
                { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border },
              ]}
            >
              {(['PLANET', 'SIGN', 'DEGREE', 'STATUS'] as const).map(h => (
                <Text
                  key={h}
                  style={[
                    typography('label'),
                    h === 'PLANET' ? styles.colPlanet : styles.colData,
                    { color: colors.textFaint, fontSize: 8 },
                  ]}
                >
                  {h}
                </Text>
              ))}
            </View>
            {/* Data rows */}
            {planetRows.map(({ name, glyph, sign, degreeStr, status, dignity }, i) => {
              const hasDignityNote = dignity !== 'NeutralSign';
              const rowBg = i % 2 === 1 ? colors.surfaceElevated : 'transparent';
              return (
                <View key={name} style={{ backgroundColor: rowBg }}>
                  <View
                    style={[
                      styles.tableRow,
                      {
                        borderBottomColor: hasDignityNote ? 'transparent' : colors.border,
                      },
                    ]}
                  >
                    <Text style={[typography('caption'), styles.colPlanet, { color: colors.text }]}>
                      {glyph} {name}
                    </Text>
                    <Text style={[typography('caption'), styles.colData, { color: colors.accent }]}>
                      {sign}
                    </Text>
                    <Text
                      style={[typography('caption'), styles.colData, { color: colors.textMuted }]}
                    >
                      {degreeStr}
                    </Text>
                    <Text
                      style={[
                        typography('caption'),
                        styles.colData,
                        {
                          color:
                            status === 'Retrograde'
                              ? STATUS_RETROGRADE
                              : status === 'Combust'
                                ? STATUS_COMBUST
                                : colors.textMuted,
                        },
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                  {/* Dignity note — a second, independent axis from motion/combustion
                      above: exaltation, own sign, friendly/enemy sign, or debilitation.
                      A planet can be Direct and Debilitated at once (Venus in Virgo),
                      so this never replaces the STATUS word, it sits below it. Silent
                      for NeutralSign — most placements are unremarkable, and calling
                      that out on every row would bury the ones that matter. */}
                  {hasDignityNote && (
                    <View style={[styles.dignityRow, { borderBottomColor: colors.border }]}>
                      <Text
                        style={[
                          typography('caption'),
                          styles.dignityText,
                          { color: dignityColor(dignity) },
                        ]}
                      >
                        {DIGNITY_ICON[dignity]} {DIGNITY_LABEL[dignity]} in {sign}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Dignity legend — decodes the icons on rows carrying a dignity note. */}
          <View style={styles.legend}>
            <Text style={[typography('caption'), styles.legendItem, { color: DIGNITY_EXALTED }]}>
              ↑ Exalted
            </Text>
            <Text style={[typography('caption'), styles.legendItem, { color: DIGNITY_OWN_SIGN }]}>
              ⌂ Own Sign
            </Text>
            <Text style={[typography('caption'), styles.legendItem, { color: DIGNITY_FRIENDLY }]}>
              ◇ Friendly
            </Text>
            <Text style={[typography('caption'), styles.legendItem, { color: DIGNITY_ENEMY }]}>
              ⚔ Enemy
            </Text>
            <Text
              style={[typography('caption'), styles.legendItem, { color: DIGNITY_DEBILITATED }]}
            >
              ↓ Debilitated
            </Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={[typography('caption'), styles.disclaimer, { color: colors.textFaint }]}>
          Sidereal positions are mean-longitude approximations (±1–5°) for display only. Horary
          judgment uses the full KP engine on the server.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── TimingPill ────────────────────────────────────────────────────────────────

interface TimingPillProps {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}

const TimingPill: React.FC<TimingPillProps> = ({ label, value, colors, typography }) => (
  <View style={styles.pill}>
    <Text style={[typography('caption'), { color: colors.textMuted, fontSize: 8 }]}>
      {label.toUpperCase()}
    </Text>
    <Text style={[typography('label'), { color: colors.accent, marginTop: 2, fontSize: 11 }]}>
      {value}
    </Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  backBtn: {
    paddingRight: 8,
    paddingVertical: 4,
  },
  timingBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  pill: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF06',
    marginHorizontal: 4,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  clockSection: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  clockToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  planetSection: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    marginBottom: 6,
    marginLeft: 2,
    fontSize: 11,
  },
  planetTable: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colPlanet: {
    flex: 2,
  },
  colData: {
    flex: 1.5,
  },
  dignityRow: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dignityText: {
    fontSize: 9,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginLeft: 2,
  },
  legendItem: {
    fontSize: 9,
    marginRight: 12,
    marginBottom: 4,
  },
  disclaimer: {
    marginHorizontal: 16,
    marginTop: 10,
    lineHeight: 16,
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default SkyClockScreen;
