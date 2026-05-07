/**
 * SkyClockScreen — the living horary disk.
 *
 * New in this version:
 *   - 5-pill info bar: Ascendant · Moon · Moon Phase · Hora · LST
 *   - "Save Wallpaper" button with screenshot guidance
 *   - StarfieldBackground for depth
 *
 * Animation spec: 1 full clockwise rotation every 60 s (1 RPM).
 * Pauses gracefully when screen is unfocused to save battery.
 */

import React, { useEffect, useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@navigation/types';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import { useSettingsStore } from '@stores/settingsStore';
import {
  dayLordAtMoment,
  horaLordAtMoment,
  minuteLordAtMoment,
} from '@astrology/primitives/rulingPlanets';
import StarfieldBackground from '@components/StarfieldBackground';
import CosmicClock from '@components/home/CosmicClock';
import { useReadingsStore, type Reading, type VerdictKind } from '@stores/readingsStore';
import { useAuthStore, selectUserName } from '@stores/authStore';

// ── Asset ─────────────────────────────────────────────────────────────────────

const DISK_IMAGE = require('../../assets/images/sky-clock-disk.png') as number;

// ── Sign names ────────────────────────────────────────────────────────────────

const SIGN_NAMES = [
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
] as const;

function signName(idx: number): string {
  return SIGN_NAMES[(idx - 1 + 12) % 12] ?? '—';
}

// ── Moon phase ────────────────────────────────────────────────────────────────

const PHASE_ICONS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'] as const;
const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

function moonPhaseInfo(nowMs: number): { icon: string; name: string } {
  const jd = nowMs / 86400000 + 2440587.5;
  const k = ((jd - 2451550.1) / 29.53058867) % 1;
  const p = k < 0 ? k + 1 : k;
  const i = Math.round(p * 8) % 8;
  return { icon: PHASE_ICONS[i] ?? '🌑', name: PHASE_NAMES[i] ?? 'New Moon' };
}

// ── Local Sidereal Time ───────────────────────────────────────────────────────

function localSiderealTime(nowMs: number, lonDeg: number): string {
  const JD_J2000 = 2451545.0;
  const jd = nowMs / 86400000 + 2440587.5;
  const T = (jd - JD_J2000) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - JD_J2000) + 0.000387933 * T * T;
  const lmst = (((gmst + lonDeg) % 360) + 360) % 360;
  const lstH = lmst / 15;
  const h = Math.floor(lstH);
  const m = Math.floor((lstH - h) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

// ── Ascendant sign (approximate, from LMST) ───────────────────────────────────
// Uses a simplified equal-house approximation (LMST → tropical ASC → sidereal sign).
// Full Placidus ASC requires lat — this is for display only.

const LAHIRI_AYANAMSA_2025 = 24.12; // approximate degrees

function ascendantSignApprox(nowMs: number, lonDeg: number, latDeg: number): string {
  const JD_J2000 = 2451545.0;
  const jd = nowMs / 86400000 + 2440587.5;
  const T = (jd - JD_J2000) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - JD_J2000) + 0.000387933 * T * T;
  const ramc = (((gmst + lonDeg) % 360) + 360) % 360;

  // Simple obliquity
  const eps = 23.4393 - 0.013 * T;
  const ramcR = ramc * (Math.PI / 180);
  const epsR = eps * (Math.PI / 180);
  const latR = latDeg * (Math.PI / 180);

  // Compute tropical ASC angle
  const t2 =
    -Math.cos(ramcR) / (Math.sin(epsR) * Math.tan(latR) + Math.cos(epsR) * Math.sin(ramcR));
  let asc = Math.atan(t2) * (180 / Math.PI);
  if (Math.cos(ramcR) > 0) {
    asc += 180;
  }
  asc = ((asc % 360) + 360) % 360;

  // Convert to sidereal
  const sidAsc = (((asc - LAHIRI_AYANAMSA_2025) % 360) + 360) % 360;
  const signIdx = Math.floor(sidAsc / 30) + 1; // 1-12
  return signName(signIdx);
}

// ── Moon sign (approximate, from mean longitude) ──────────────────────────────

function moonSignApprox(nowMs: number): string {
  const JD_J2000 = 2451545.0;
  const jd = nowMs / 86400000 + 2440587.5;
  const T = (jd - JD_J2000) / 36525;
  // Approximate mean Moon longitude (tropical)
  const moonLon = (((218.3165 + 481267.8813 * T) % 360) + 360) % 360;
  const sidLon = (((moonLon - LAHIRI_AYANAMSA_2025) % 360) + 360) % 360;
  return signName(Math.floor(sidLon / 30) + 1);
}

// ── Display-only ephemeris (not for horary judgment) ─────────────────────────
// Mean longitude elements copied from CosmicClock — display only.

const PLANET_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu'] as const;
type PlanetName = (typeof PLANET_NAMES)[number];

const J2K_DISPLAY: Readonly<Record<string, { L0: number; Lr: number }>> = {
  Sun:     { L0: 280.46646, Lr: 36000.76983 },
  Moon:    { L0: 218.3165,  Lr: 481267.8813 },
  Mercury: { L0: 252.2509,  Lr: 149472.6749 },
  Venus:   { L0: 181.9798,  Lr: 58517.8156  },
  Mars:    { L0: 355.4330,  Lr: 19140.2993  },
  Jupiter: { L0: 34.3515,   Lr: 3034.9057   },
  Saturn:  { L0: 50.0774,   Lr: 1222.1138   },
};

const NAKSHATRAS: readonly string[] = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

function mod360d(x: number): number { return ((x % 360) + 360) % 360; }

// Returns sidereal longitude (Lahiri) for display purposes only.
function displayLongitude(name: PlanetName, nowMs: number): number {
  const JD_J2000_D = 2451545.0;
  const jd = nowMs / 86400000 + 2440587.5;
  const T = (jd - JD_J2000_D) / 36525;
  const tropical =
    name === 'Rahu'
      ? mod360d(125.0445 - 1934.136 * T)
      : mod360d((J2K_DISPLAY[name]?.L0 ?? 0) + (J2K_DISPLAY[name]?.Lr ?? 0) * T);
  return mod360d(tropical - LAHIRI_AYANAMSA_2025);
}

function nakshatra(lon: number): string {
  const idx = Math.floor((lon / 360) * 27);
  return NAKSHATRAS[idx] ?? '—';
}

function formatDMS(lon: number): string {
  const inSign = lon % 30;
  const deg = Math.floor(inSign);
  const min = Math.floor((inSign - deg) * 60);
  return `${deg}° ${String(min).padStart(2, '0')}′`;
}

// ── Greeting ──────────────────────────────────────────────────────────────────

function greetingText(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Sabah al-Noor ✦';
  if (h >= 12 && h < 17) return 'Good Afternoon ✦';
  if (h >= 17 && h < 21) return 'Good Evening ✦';
  return 'Good Night ✦';
}

// ── Verdict color helper ──────────────────────────────────────────────────────

function verdictColor(v: VerdictKind, colors: ReturnType<typeof useColors>): string {
  switch (v) {
    case 'YES': return colors.positive;
    case 'NO': return colors.negative;
    case 'CONDITIONAL':
    case 'DELAYED': return colors.caution;
    default: return colors.textMuted;
  }
}

// ── Live chart data ───────────────────────────────────────────────────────────

interface LiveData {
  horaLord: string;
  dayLord: string;
  minuteLord: string;
  ascSign: string;
  moonSign: string;
  moonPhase: { icon: string; name: string };
  lst: string;
  timeLabel: string;
}

function computeLiveData(lonDeg: number, latDeg: number): LiveData {
  const now = Date.now();
  return {
    horaLord: horaLordAtMoment(now, lonDeg),
    dayLord: dayLordAtMoment(now, lonDeg),
    minuteLord: minuteLordAtMoment(now, lonDeg),
    ascSign: ascendantSignApprox(now, lonDeg, latDeg),
    moonSign: moonSignApprox(now),
    moonPhase: moonPhaseInfo(now),
    lst: localSiderealTime(now, lonDeg),
    timeLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROTATION_DURATION_MS = 60_000; // 1 RPM

// ── Screen ────────────────────────────────────────────────────────────────────

const SkyClockScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { width } = useWindowDimensions();

  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const userName = useAuthStore(selectUserName);
  const readings = useReadingsStore(s => s.readings);
  const lastReading: Reading | null = readings[0] ?? null;

  const lastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.lastLocation,
  );
  const lonDeg = lastLocation?.lon ?? 74.3587; // Lahore fallback
  const latDeg = lastLocation?.lat ?? 31.5204;

  // ── Rotation ──────────────────────────────────────────────────────────────
  const rotation = useSharedValue(0);

  const startRotation = useCallback(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: ROTATION_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useFocusEffect(
    useCallback(() => {
      startRotation();
      return () => cancelAnimation(rotation);
    }, [rotation, startRotation]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // ── Live data (updates every 10 s) ───────────────────────────────────────
  const [data, setData] = useState<LiveData>(() => computeLiveData(lonDeg, latDeg));

  useEffect(() => {
    setData(computeLiveData(lonDeg, latDeg));
    const id = setInterval(() => setData(computeLiveData(lonDeg, latDeg)), 10_000);
    return () => clearInterval(id);
  }, [lonDeg, latDeg]);

  // ── Disk sizing ───────────────────────────────────────────────────────────
  const diskSize = Math.min(width * 0.82, 380);

  // ── Wallpaper ─────────────────────────────────────────────────────────────
  const handleSaveWallpaper = useCallback(() => {
    Alert.alert(
      t('skyClock.saveWallpaper'),
      'Take a screenshot to save your Sky Clock as a wallpaper.\n\n' +
        'On Android: Volume Down + Power button.\n' +
        'On iOS: Side button + Volume Up.',
      [{ text: t('common.ok') }],
    );
  }, [t]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground starColor={colors.starfield} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting banner */}
        <View style={styles.greetingBlock}>
          <Text style={[typography('label'), { color: colors.amber, letterSpacing: 2 }]}>
            {greetingText()}
          </Text>
          <Text style={[typography('bodyItalic'), { color: colors.textMuted, fontSize: 12 }]}>
            {userName}
          </Text>
        </View>

        {/* Live ephemeris clock */}
        <CosmicClock />

        {/* Quick-action row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsContent}
          style={styles.quickActionsRow}
        >
          {(
            [
              { label: '⌚ Ask Watch', tab: 'Oracle' },
              { label: '🔭 Ask Stars', tab: 'Oracle' },
              { label: '🌐 Sky Clock', tab: 'SkyClock' },
              { label: '📜 History', tab: 'History' },
            ] as const
          ).map(item => (
            <Pressable
              key={item.label}
              onPress={() => navigation.navigate(item.tab)}
              style={({ pressed }) => [
                styles.quickPill,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={[typography('label'), { color: colors.text, fontSize: 10 }]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Last reading preview */}
        {lastReading !== null && (
          <Pressable
            onPress={() => navigation.navigate('History')}
            style={({ pressed }) => [
              styles.lastReadingCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View reading history"
          >
            <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9, marginBottom: 4 }]}>
              LAST READING
            </Text>
            <Text
              style={[typography('body'), { color: colors.text }]}
              numberOfLines={2}
            >
              {lastReading.question.length > 0 ? lastReading.question : lastReading.category}
            </Text>
            <View style={styles.lastReadingFooter}>
              <View
                style={[
                  styles.verdictBadgeSmall,
                  { borderColor: verdictColor(lastReading.verdict, colors) },
                ]}
              >
                <Text
                  style={[
                    typography('label'),
                    { color: verdictColor(lastReading.verdict, colors), fontSize: 9 },
                  ]}
                >
                  {lastReading.verdict}
                </Text>
              </View>
              <Text style={[typography('caption'), { color: colors.accent, fontSize: 10 }]}>
                View all →
              </Text>
            </View>
          </Pressable>
        )}

        {/* Planet position table */}
        <View style={[styles.planetTable, { borderColor: colors.border }]}>
          <View style={[styles.planetTableHeader, { borderBottomColor: colors.border }]}>
            {(['PLANET', 'SIGN', 'POSITION', 'NAKSHATRA'] as const).map(h => (
              <Text
                key={h}
                style={[typography('label'), styles.planetCol, { color: colors.textFaint, fontSize: 8 }]}
              >
                {h}
              </Text>
            ))}
          </View>
          {PLANET_NAMES.map(name => {
            const lon = displayLongitude(name, Date.now());
            const signIdx = Math.floor(lon / 30);
            const sign = SIGN_NAMES[signIdx] ?? '—';
            const nk = nakshatra(lon);
            const pos = formatDMS(lon);
            return (
              <View
                key={name}
                style={[styles.planetRow, { borderBottomColor: colors.border }]}
              >
                <Text style={[typography('caption'), styles.planetCol, { color: colors.text }]}>
                  {name}
                </Text>
                <Text style={[typography('caption'), styles.planetCol, { color: colors.accent }]}>
                  {sign}
                </Text>
                <Text style={[typography('caption'), styles.planetCol, { color: colors.textMuted }]}>
                  {pos}
                </Text>
                <Text style={[typography('caption'), styles.planetCol, { color: colors.textMuted, fontSize: 10 }]}>
                  {nk}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Mode indicator */}
        <View style={styles.modeIndicatorRow}>
          <View style={[styles.modeIndicatorPill, { borderColor: colors.border }]}>
            <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9 }]}>
              Tropical Positions (display only)
            </Text>
          </View>
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[typography('subheading'), { color: colors.text }]}>
            {t('skyClock.headerTitle')}
          </Text>
          <Text style={[typography('caption'), { color: colors.textMuted }]}>{data.timeLabel}</Text>
        </View>

        {/* Disk stage */}
        <View style={[styles.stage, { height: diskSize * 1.2 }]}>
          {/* Ambient glow */}
          <View
            style={[
              styles.glow,
              {
                width: diskSize * 1.12,
                height: diskSize * 1.12,
                borderRadius: (diskSize * 1.12) / 2,
                backgroundColor: colors.amber,
              },
            ]}
            pointerEvents="none"
          />
          {/* Rotating disk */}
          <Animated.View style={[animatedStyle, { width: diskSize, height: diskSize }]}>
            <Image
              source={DISK_IMAGE}
              style={{ width: diskSize, height: diskSize, borderRadius: diskSize / 2 }}
              resizeMode="cover"
            />
          </Animated.View>
        </View>

        {/* 5-pill info bar */}
        <View
          style={[styles.infoBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
        >
          <InfoPill
            label={t('skyClock.ascendantLabel')}
            value={data.ascSign}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoPill
            label={t('skyClock.moonPhaseLabel')}
            value={`${data.moonPhase.icon} ${data.moonSign}`}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoPill
            label={t('skyClock.horaLabel')}
            value={data.horaLord}
            colors={colors}
            typography={typography}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoPill label="Day" value={data.dayLord} colors={colors} typography={typography} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoPill label="LST" value={data.lst} colors={colors} typography={typography} />
        </View>

        {/* Wallpaper button */}
        <View style={[styles.wallpaperRow, { borderTopColor: colors.border }]}>
          <Text
            onPress={handleSaveWallpaper}
            style={[
              typography('caption'),
              {
                color: colors.amber,
                letterSpacing: 1,
                textTransform: 'uppercase',
                paddingVertical: 8,
              },
            ]}
            accessibilityRole="button"
          >
            ◈ {t('skyClock.saveWallpaper')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── InfoPill ──────────────────────────────────────────────────────────────────

interface InfoPillProps {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}

const InfoPill: React.FC<InfoPillProps> = ({ label, value, colors, typography }) => (
  <View style={styles.infoPill}>
    <Text style={[typography('caption'), { color: colors.textMuted, fontSize: 9 }]}>{label}</Text>
    <Text style={[typography('label'), { color: colors.accent, marginTop: 2 }]}>{value}</Text>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    opacity: 0.12,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoPill: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
  },
  wallpaperRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
  },
  greetingBlock: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    gap: 2,
  },
  quickActionsRow: {
    marginTop: 8,
  },
  quickActionsContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  lastReadingCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },
  lastReadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  verdictBadgeSmall: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  planetTable: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  planetTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  planetRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  planetCol: {
    flex: 1,
  },
  modeIndicatorRow: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  modeIndicatorPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});

export default SkyClockScreen;
