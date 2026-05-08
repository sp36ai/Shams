/**
 * SkyClockScreen — Sky State timing panel.
 *
 * Layout:
 *   1. Header with back button
 *   2. TimingBar — hora, day, moon sign, nakshatra, LST, moon phase
 *      Refreshes every 60 s; timer runs only while screen is focused.
 *   3. CollapsibleCosmicClock — collapsed by default.
 *      CosmicClock's setInterval runs only when focused AND expanded.
 *   4. PlanetTable — Planet | Sign | Nakshatra, no DMS.
 *      Disclaimer: approximate display only, not used for horary judgment.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useSettingsStore } from '@stores/settingsStore';
import {
  dayLordAtMoment,
  horaLordAtMoment,
} from '@astrology/primitives/rulingPlanets';
import StarfieldBackground from '@components/StarfieldBackground';
import CosmicClock from '@components/home/CosmicClock';
import type { RootStackParamList } from '@navigation/types';

// ── Sign / nakshatra helpers ──────────────────────────────────────────────────

const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const NAKSHATRAS: readonly string[] = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

function mod360(x: number): number { return ((x % 360) + 360) % 360; }

const LAHIRI_AYANAMSA_2025 = 24.12;

// Mean longitude elements (J2000.0) — display only, ±1–5° error.
const J2K: Readonly<Record<string, { L0: number; Lr: number }>> = {
  Sun:     { L0: 280.46646, Lr: 36000.76983 },
  Moon:    { L0: 218.3165,  Lr: 481267.8813 },
  Mercury: { L0: 252.2509,  Lr: 149472.6749 },
  Venus:   { L0: 181.9798,  Lr: 58517.8156  },
  Mars:    { L0: 355.4330,  Lr: 19140.2993  },
  Jupiter: { L0: 34.3515,   Lr: 3034.9057   },
  Saturn:  { L0: 50.0774,   Lr: 1222.1138   },
};

const PLANET_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu'] as const;
type PlanetName = (typeof PLANET_NAMES)[number];

function displayLonSidereal(name: PlanetName, nowMs: number): number {
  const jd = nowMs / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const tropical =
    name === 'Rahu'
      ? mod360(125.0445 - 1934.136 * T)
      : mod360((J2K[name]?.L0 ?? 0) + (J2K[name]?.Lr ?? 0) * T);
  return mod360(tropical - LAHIRI_AYANAMSA_2025);
}

function nakshatraName(lon: number): string {
  return NAKSHATRAS[Math.floor((lon / 360) * 27)] ?? '—';
}

// ── Moon phase ────────────────────────────────────────────────────────────────

const PHASE_ICONS = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'] as const;
const PHASE_NAMES = [
  'New Moon','Waxing Crescent','First Quarter','Waxing Gibbous',
  'Full Moon','Waning Gibbous','Last Quarter','Waning Crescent',
] as const;

function moonPhase(nowMs: number): string {
  const jd = nowMs / 86400000 + 2440587.5;
  const k = ((jd - 2451550.1) / 29.53058867) % 1;
  const p = k < 0 ? k + 1 : k;
  const i = Math.round(p * 8) % 8;
  return `${PHASE_ICONS[i] ?? '🌑'} ${PHASE_NAMES[i] ?? 'New Moon'}`;
}

// ── Local Sidereal Time ───────────────────────────────────────────────────────

function localSiderealTime(nowMs: number, lonDeg: number): string {
  const jd = nowMs / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  const lmst = mod360(gmst + lonDeg);
  const lstH = lmst / 15;
  const h = Math.floor(lstH);
  const m = Math.floor((lstH - h) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

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
    horaLord:      horaLordAtMoment(now, lonDeg),
    dayLord:       dayLordAtMoment(now, lonDeg),
    moonSign:      SIGN_NAMES[signIdx] ?? '—',
    moonNakshatra: nakshatraName(moonLon),
    moonPhaseFull: moonPhase(now),
    lst:           localSiderealTime(now, lonDeg),
    timeLabel:     new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

// ── Screen ────────────────────────────────────────────────────────────────────

const SkyClockScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const lastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.lastLocation,
  );
  const lonDeg = lastLocation?.lon ?? 74.3587;

  const [timing, setTiming] = useState<TimingState>(() => computeTiming(lonDeg));
  const [focused, setFocused] = useState(false);
  const [clockExpanded, setClockExpanded] = useState(false);

  // Refresh timing every 60 s, only while screen is focused.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setTiming(computeTiming(lonDeg));
      const id = setInterval(() => setTiming(computeTiming(lonDeg)), 60_000);
      return () => {
        setFocused(false);
        clearInterval(id);
      };
    }, [lonDeg]),
  );

  // Planet table rows — stable, no per-render Date.now() drift between rows.
  const planetRows = useMemo(() => {
    const now = Date.now();
    return PLANET_NAMES.map(name => {
      const lon = displayLonSidereal(name, now);
      const sign = SIGN_NAMES[Math.floor(lon / 30)] ?? '—';
      const nk = nakshatraName(lon);
      return { name, sign, nk };
    });
  }, [focused]); // recompute on focus change (once per screen visit)

  const clockRunning = focused && clockExpanded;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground starColor={colors.starfield} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[typography('label'), { color: colors.accent, fontSize: 20 }]}>‹</Text>
        </Pressable>
        <Text style={[typography('subheading'), { color: colors.text }]}>Sky State</Text>
        <Text style={[typography('caption'), { color: colors.textMuted }]}>{timing.timeLabel}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TimingBar */}
        <View style={[styles.timingBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TimingPill label="Hora" value={timing.horaLord} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill label="Day" value={timing.dayLord} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill label="Moon" value={timing.moonSign} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill label="Nakshatra" value={timing.moonNakshatra} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill label="LST" value={timing.lst} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TimingPill label="Phase" value={timing.moonPhaseFull} colors={colors} typography={typography} />
        </View>

        {/* CollapsibleCosmicClock */}
        <View style={[styles.clockSection, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => setClockExpanded(v => !v)}
            style={[styles.clockToggle, { borderBottomColor: clockExpanded ? colors.border : 'transparent' }]}
            accessibilityRole="button"
          >
            <Text style={[typography('label'), { color: colors.text }]}>
              Celestial Clock
            </Text>
            <Text style={[typography('caption'), { color: colors.textMuted }]}>
              {clockExpanded ? '▲ Collapse' : '▼ Expand'}
            </Text>
          </Pressable>
          {clockExpanded && <CosmicClock running={clockRunning} />}
        </View>

        {/* Planet table */}
        <View style={[styles.planetTable, { borderColor: colors.border }]}>
          <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
            {(['PLANET', 'SIGN', 'NAKSHATRA'] as const).map(h => (
              <Text key={h} style={[typography('label'), styles.col, { color: colors.textFaint, fontSize: 8 }]}>
                {h}
              </Text>
            ))}
          </View>
          {planetRows.map(({ name, sign, nk }) => (
            <View key={name} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
              <Text style={[typography('caption'), styles.col, { color: colors.text }]}>{name}</Text>
              <Text style={[typography('caption'), styles.col, { color: colors.accent }]}>{sign}</Text>
              <Text style={[typography('caption'), styles.col, { color: colors.textMuted }]}>{nk}</Text>
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <Text style={[typography('caption'), styles.disclaimer, { color: colors.textFaint }]}>
          Sidereal positions are mean-longitude approximations (±1–5°) for display only.
          Horary judgment uses the full KP engine on the server.
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
    <Text style={[typography('caption'), { color: colors.textMuted, fontSize: 8 }]}>{label.toUpperCase()}</Text>
    <Text style={[typography('label'), { color: colors.accent, marginTop: 2, fontSize: 11 }]}>{value}</Text>
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
  },
  backBtn: {
    paddingRight: 8,
    paddingVertical: 4,
  },
  timingBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  pill: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  clockSection: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  clockToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  planetTable: {
    marginHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  col: {
    flex: 1,
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
