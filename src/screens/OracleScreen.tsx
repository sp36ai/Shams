/**
 * OracleScreen — home dashboard ("The Observatory Hall").
 * --------------------------------------------------------------------------
 * The first screen the seeker lands on after onboarding (Oracle is the
 * initial tab in MainTabs). A passive status surface that fits on one screen:
 * the hero panel holds the mandala, the live sky capsules, the three primary
 * actions (Ask Shams, Al-Falak, Readings), a grid of one-line tiles (Current
 * Hora, Today's Sky, Moon Manzil, Favored Now, Daily Dhikr, Today's Blessing)
 * and the tier/quota line. Each tile opens its full text in a detail sheet.
 * Asking happens in a Reading (ReadingScreen), which owns the composer, the
 * verdict and the conversation about it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AppState, I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { acquireLocation } from '@utils/acquireLocation';
import crashlytics from '@react-native-firebase/crashlytics';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigation } from '@navigation/types';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { RADIUS, SPACING } from '@theme/themes';
import { useTranslation, useI18n } from '@i18n/I18nProvider';
import { useSettingsStore } from '@stores/settingsStore';
import { useQuotaStore, FREE_DAILY_LIMIT, TRIAL_DAILY_LIMIT } from '@stores/quotaStore';
import { useQuota } from '@hooks/useQuota';
import { useTimingStrip } from '@hooks/useTimingStrip';
import { useSkyExtras } from '@hooks/useSkyExtras';
import { useHoraCountdown } from '@hooks/useHoraCountdown';
import { storage, KEYS } from '@storage/mmkv';
import { displayLonSidereal, PLANET_GLYPHS } from '@utils/siderealPositions';
import StarfieldBackground from '@components/StarfieldBackground';
import TabIcon from '@components/TabIcon';
import HoraBadge from '@components/home/HoraBadge';
import ManzilEmblem from '@components/home/ManzilEmblem';
import HomeHero from '@components/home/HomeHero';
import HomeInfoTile from '@components/home/HomeInfoTile';
import HomeDetailSheet from '@components/home/HomeDetailSheet';
import { CELESTIAL } from '@components/home/celestialPalette';
import OrnamentDivider from '@components/ui/OrnamentDivider';
import { buildDailySkyMessage } from '@utils/dailySkyMessage';
import { favoredChipForPlanet } from '../data/favoredQuestion';
import { PLANET_DHIKR } from '../data/dailyDhikr';
import { todaysIslamicNote } from '../data/islamicDayOfWeek';
import { getManzilaDisplay } from '@astrology/manazil';

// Fallback coordinates when no fix is stored yet (mirrors the pairing used
// by SkyClockScreen's lon-only fallback — location is mandatory in practice,
// this only covers the brief window before the first GPS fix lands).
const FALLBACK_LAT = 31.634;
const FALLBACK_LON = 74.3587;

// Locale for the header date, per app language (not the device locale).
const DATE_LOCALE = { en: 'en-GB', ur: 'ur-PK', hi: 'hi-IN' } as const;

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ── OracleScreen (home dashboard) ───────────────────────────────────────────

const OracleScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  // One typed handle for both destinations: sibling tabs (AlFalak/History)
  // and root-level pushes (Settings/Premium/Reading). See AppNavigation.
  const navigation = useNavigation<AppNavigation>();

  const lastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.lastLocation,
  );
  const seekerProfile = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.seekerProfile,
  );
  const seekerName = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.seekerName,
  );

  const { questionsLeft } = useQuota();
  const plan = useQuotaStore(s => s.plan);
  const trialActive = useQuotaStore(s => s.trialActive);

  const latDeg = lastLocation?.lat ?? FALLBACK_LAT;
  const lonDeg = lastLocation?.lon ?? FALLBACK_LON;
  const { horaLord, dayLord } = useTimingStrip(lonDeg);
  const horaCountdown = useHoraCountdown(lonDeg);
  const skyExtras = useSkyExtras(latDeg, lonDeg);

  // ── Trial day banners — Day 6 passive strip, Day 7 once-per-day soft prompt ─
  const [trialBannerKind, setTrialBannerKind] = useState<'day6' | 'day7' | null>(null);

  const evaluateTrialBanner = useCallback(() => {
    const { plan: currentPlan, checkTrial } = useQuotaStore.getState();
    if (currentPlan !== 'free') {
      return;
    }
    const { active, daysRemaining } = checkTrial();
    if (!active) {
      return;
    }
    if (daysRemaining === 2) {
      setTrialBannerKind('day6');
    } else if (daysRemaining === 1) {
      const today = new Date().toDateString();
      const shown = storage.getString(KEYS.DAY7_PROMPT_DATE);
      if (shown !== today) {
        storage.set(KEYS.DAY7_PROMPT_DATE, today);
        setTrialBannerKind('day7');
      }
    }
  }, []);

  useEffect(() => {
    try {
      evaluateTrialBanner();
      const sub = AppState.addEventListener('change', nextState => {
        if (nextState === 'active') {
          evaluateTrialBanner();
        }
      });
      return () => sub.remove();
    } catch (err) {
      // Trial banners are non-essential chrome — degrade to "no banner" rather
      // than crashing the home surface. Report so the gap is still visible.
      crashlytics().recordError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    }
  }, [evaluateTrialBanner]);

  // Auto-fetch GPS on mount when permission was granted but no fix is stored.
  // Covers: fresh installs, DEV builds that bypass LocationPermissionScreen,
  // and users whose GPS fix failed during onboarding. Resolved early here so
  // it's ready before the seeker taps into the chat.
  useEffect(() => {
    try {
      const s = useSettingsStore.getState();
      if (s.lastLocation !== null) {
        return;
      }
      if (!s.onboardingPermissionGranted && !__DEV__) {
        return;
      }
      acquireLocation()
        .then(coords => {
          if (coords === null) {
            return; // seeker will see the location chip as "required"
          }
          useSettingsStore.getState().setLastLocation({
            lat: coords.lat,
            lon: coords.lon,
            label: null,
            capturedAt: Date.now(),
          });
        })
        .catch(err => {
          crashlytics().recordError(err instanceof Error ? err : new Error(String(err)));
        });
    } catch (err) {
      crashlytics().recordError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []); // run once on mount only

  // Coordinates read as a deliberate readout ("31.63°N 74.36°E") rather than
  // a raw pair; no reverse geocoder is installed, so there is no place name.
  const locationLabel =
    lastLocation === null
      ? t('errors.locationRequired')
      : `${Math.abs(lastLocation.lat).toFixed(2)}°${lastLocation.lat >= 0 ? 'N' : 'S'} ${Math.abs(
          lastLocation.lon,
        ).toFixed(2)}°${lastLocation.lon >= 0 ? 'E' : 'W'}`;

  const todayLabel = new Date().toLocaleDateString(DATE_LOCALE[lang], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const dailySky = buildDailySkyMessage({
    dayLord,
    horaLord,
    seekerProfile,
    seekerName,
    lang,
  });

  const favoredChip = favoredChipForPlanet(horaLord, lang);
  // Inline emphasis names the bundled semibold face rather than setting
  // fontWeight: Android cannot bold a single-weight custom family and falls
  // back to the system font, so the bold words rendered in Roboto.
  const emphasis = { fontFamily: typography('label').fontFamily };
  const dhikr = PLANET_DHIKR[dayLord];
  const islamicNote = todaysIslamicNote(new Date());

  const manzil = getManzilaDisplay(displayLonSidereal('Moon', Date.now()));

  const tierLabel =
    plan === 'mureed'
      ? t('premium.tierStarter')
      : plan === 'khass'
        ? t('premium.tierPremium')
        : t('oracle.tierWanderer');

  // Chevrons point "forward" — mirrored in RTL so Urdu reads them correctly.
  const chevron = (color: string): React.JSX.Element => (
    <View style={I18nManager.isRTL ? styles.flipX : undefined}>
      <TabIcon name="chevronRight" color={color} size={16} />
    </View>
  );

  const quotaLabel =
    questionsLeft === Infinity
      ? '∞'
      : `${questionsLeft} / ${trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT}`;

  // Home tiles: one headline each; the full text opens in the detail sheet.
  type TileKey = 'hora' | 'sky' | 'manzil' | 'favored' | 'dhikr' | 'blessing';
  const [openTile, setOpenTile] = useState<TileKey | null>(null);
  const tiles: { key: TileKey; label: string; headline: string }[] = [
    {
      key: 'hora',
      label: t('oracle.currentHoraLabel'),
      headline: t('oracle.horaName', { planet: horaLord }),
    },
    {
      key: 'sky',
      label: t('oracle.dailySkyTitle'),
      headline: `${PLANET_GLYPHS[dayLord]} ${dailySky.dayLord}`,
    },
    { key: 'manzil', label: t('oracle.moonManzilTitle'), headline: manzil.name },
    { key: 'favored', label: t('oracle.favoredNowTitle'), headline: favoredChip },
    ...(dhikr !== undefined
      ? [{ key: 'dhikr' as const, label: t('oracle.dailyDhikrTitle'), headline: dhikr.name }]
      : []),
    { key: 'blessing', label: t('oracle.blessingTitle'), headline: islamicNote.name[lang] },
  ];
  const openTileLabel = tiles.find(tile => tile.key === openTile)?.label ?? null;

  const bodyText = [typography('body'), { color: colors.text, lineHeight: 24 }];
  const renderTileDetail = (key: TileKey | null): React.JSX.Element | null => {
    switch (key) {
      case 'hora':
        return (
          <View>
            <View style={styles.detailRow}>
              <View style={styles.detailTextCol}>
                <Text style={[typography('heading'), { color: colors.goldBright }]}>
                  {t('oracle.horaName', { planet: horaLord })}
                </Text>
                <Text style={[typography('caption'), { color: colors.accent, marginTop: 4 }]}>
                  {horaCountdown} {t('oracle.remainingLabel')}
                </Text>
                <Text style={[typography('caption'), { color: colors.textMuted, marginTop: 4 }]}>
                  {PLANET_GLYPHS[dayLord]} {dayLord}
                </Text>
              </View>
              <HoraBadge glyph={PLANET_GLYPHS[horaLord]} size={72} />
            </View>
            <Pressable
              testID="home-detail-open-alfalak"
              onPress={() => {
                setOpenTile(null);
                navigation.navigate('AlFalak');
              }}
              style={[styles.detailLink, { borderTopColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('oracle.openAlFalakA11y')}
            >
              <Text style={[typography('label'), { color: colors.goldBright }]}>
                {t('nav.alFalakTab')}
              </Text>
              {chevron(colors.goldBright)}
            </Pressable>
          </View>
        );
      case 'sky':
        return (
          <View>
            <Text style={bodyText}>
              {dailySky.greeting} {t('oracle.dayIsUnder')}{' '}
              <Text style={[emphasis, { color: colors.accent }]}>{dailySky.dayLord}</Text> (
              {dailySky.dayTheme}).
            </Text>
            <Text style={[...bodyText, { color: colors.textMuted, marginTop: 4 }]}>
              {t('oracle.hourCarries')}{' '}
              <Text style={[emphasis, { color: colors.accent }]}>{dailySky.horaLord}</Text> (
              {dailySky.horaTheme}).
            </Text>
            {dailySky.guidance !== null && (
              <Text
                style={[
                  typography('bodyItalic'),
                  { color: colors.goldBright, marginTop: 10, lineHeight: 22, opacity: 0.9 },
                ]}
              >
                {dailySky.guidance}
              </Text>
            )}
          </View>
        );
      case 'manzil':
        return (
          <View>
            <View style={styles.detailRow}>
              <ManzilEmblem size={72} />
              <View style={styles.detailTextCol}>
                <Text style={[styles.arabic, { color: colors.goldBright }]}>{manzil.arabic}</Text>
                <Text style={[typography('subheading'), { color: colors.text, marginTop: 2 }]}>
                  {manzil.name}
                </Text>
              </View>
            </View>
            <Text
              style={[
                typography('bodyItalic'),
                { color: colors.textMuted, marginTop: 10, lineHeight: 22 },
              ]}
            >
              {manzil.descriptor}
            </Text>
            {skyExtras.sunTimes !== null && (
              <Text style={[typography('caption'), { color: colors.textMuted, marginTop: 10 }]}>
                {skyExtras.moonPhaseFull}
              </Text>
            )}
          </View>
        );
      case 'favored':
        return (
          <Text style={bodyText}>
            {t('oracle.favoredNowBody')}{' '}
            <Text style={[emphasis, { color: colors.accent }]}>{favoredChip}</Text>
          </Text>
        );
      case 'dhikr':
        return dhikr === undefined ? null : (
          <View>
            <Text style={[styles.arabic, styles.arabicCentered, { color: colors.goldBright }]}>
              {dhikr.arabic}
            </Text>
            <Text style={[...bodyText, { textAlign: 'center' }]}>
              {t('oracle.dailyDhikrRecite')} {dhikr.name} ({dhikr.meaning[lang]})
            </Text>
            <Text
              style={[
                typography('bodyItalic'),
                { color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 22 },
              ]}
            >
              {dhikr.intention[lang]}
            </Text>
          </View>
        );
      case 'blessing':
        return (
          <Text style={bodyText}>
            <Text style={[emphasis, { color: colors.accent }]}>{islamicNote.name[lang]}</Text>
            {' — '}
            {islamicNote.note[lang]}
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground starColor={colors.starfield} />

      {/* Header — today's date over the wordmark; location and Settings */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={[typography('caption'), { color: colors.textMuted }]} numberOfLines={1}>
            {todayLabel}
          </Text>
          <Text
            style={[
              typography('heading'),
              styles.wordmark,
              { color: colors.goldBright, textShadowColor: colors.gold + '66' },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t('app.name')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.locationChip,
              { borderColor: colors.borderAccent + '80', backgroundColor: colors.surfaceElevated },
            ]}
          >
            <TabIcon
              name="pin"
              color={lastLocation === null ? colors.negative : colors.goldBright}
              size={13}
            />
            <Text
              style={[
                typography('caption'),
                {
                  color: lastLocation === null ? colors.negative : colors.textMuted,
                  fontSize: 12,
                },
              ]}
              numberOfLines={1}
            >
              {locationLabel}
            </Text>
          </View>
          <Pressable
            testID="settings-gear-btn"
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [
              styles.settingsBtn,
              {
                borderColor: colors.borderAccent,
                backgroundColor: colors.surfaceElevated,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('settings.headerTitle')}
          >
            <TabIcon name="settings" color={colors.goldBright} size={18} />
          </Pressable>
        </View>
      </View>
      <OrnamentDivider style={styles.headerDivider} />

      <ScrollView
        style={[styles.scroll, { backgroundColor: CELESTIAL.midnight }]}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* Void-of-course Moon warning — classical horary caution */}
        {skyExtras.voidOfCourse.isVoid && (
          <View style={styles.vocBanner}>
            <Text style={[typography('caption'), styles.vocText]}>
              {'☾ '}
              {t('oracle.voidOfCourseBanner', {
                time: formatClockTime(skyExtras.voidOfCourse.signExitMs),
              })}
            </Text>
          </View>
        )}

        {/* Hero — mandala, live sky capsules and the three primary actions.
            Every value is one this screen already shows further down (hora
            countdown, sunrise, sunset); every action is an existing route. */}
        <HomeHero
          metrics={[
            {
              key: 'sunrise',
              label: t('oracle.sunriseLabel'),
              glyph: 'sunrise',
              value:
                skyExtras.sunTimes === null ? null : formatClockTime(skyExtras.sunTimes.sunriseMs),
            },
            {
              key: 'hora',
              label: t('oracle.currentHoraLabel'),
              glyph: 'hora',
              value: horaCountdown,
            },
            {
              key: 'sunset',
              label: t('oracle.sunsetLabel'),
              glyph: 'sunset',
              value:
                skyExtras.sunTimes === null ? null : formatClockTime(skyExtras.sunTimes.sunsetMs),
            },
          ]}
          actions={[
            {
              key: 'ask',
              label: t('oracle.askShamsCta'),
              icon: 'oracle',
              onPress: () => navigation.push('Reading', {}),
            },
            {
              key: 'alfalak',
              label: t('nav.alFalakTab'),
              icon: 'skyclock',
              onPress: () => navigation.navigate('AlFalak'),
            },
            {
              key: 'readings',
              label: t('nav.readingsTab'),
              icon: 'history',
              onPress: () => navigation.navigate('Readings'),
            },
          ]}
        >
          {/* Everything else on Home as one-line tiles; each opens its full
              text in the detail sheet below, so Home fits on one screen. */}
          <View style={styles.tileGrid}>
            {tiles.map(tile => (
              <HomeInfoTile
                key={tile.key}
                testID={`home-tile-${tile.key}`}
                label={tile.label}
                headline={tile.headline}
                onPress={() => setOpenTile(tile.key)}
              />
            ))}
          </View>

          {/* Tier and today's quota */}
          <View style={styles.tierLine} testID="home-tier-line">
            <Text style={[typography('label'), styles.tierLabel]}>
              {t('oracle.yourTierLabel').toUpperCase()}
            </Text>
            <Text style={[typography('caption'), styles.tierValue]}>{tierLabel}</Text>
            <Text style={[typography('caption'), styles.tierDot]}>·</Text>
            <Text style={[typography('label'), styles.tierLabel]}>
              {t('oracle.todaysQuotaLabel').toUpperCase()}
            </Text>
            <Text style={[typography('caption'), styles.tierValue]}>{quotaLabel}</Text>
          </View>
        </HomeHero>

        {/* Brand signature */}
        <Text style={[typography('caption'), styles.signature]}>{t('app.poweredBy')}</Text>
      </ScrollView>

      {/* Trial day banners — thin gold strip, max 44px, above tab bar */}
      {trialBannerKind === 'day6' && (
        <View
          style={[
            styles.trialBanner,
            { backgroundColor: colors.surface, borderTopColor: colors.borderAccent },
          ]}
        >
          <Text
            style={[typography('caption'), styles.trialBannerText, { color: colors.goldBright }]}
          >
            {t('oracle.trialEndsSoon')}
          </Text>
        </View>
      )}

      {trialBannerKind === 'day7' && (
        <Pressable
          onPress={() => navigation.navigate('Premium')}
          style={[
            styles.trialBanner,
            { backgroundColor: colors.surface, borderTopColor: colors.borderAccent },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('oracle.choosePathA11y')}
        >
          <View style={styles.inlineRow}>
            <Text
              style={[typography('caption'), styles.trialBannerText, { color: colors.goldBright }]}
            >
              {t('oracle.trialEndsTonight')}
            </Text>
            {chevron(colors.goldBright)}
          </View>
        </Pressable>
      )}

      <HomeDetailSheet title={openTileLabel} onClose={() => setOpenTile(null)}>
        {renderTileDetail(openTile)}
      </HomeDetailSheet>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  headerDivider: {
    marginHorizontal: SPACING.xl,
  },
  wordmark: {
    marginTop: 2,
    letterSpacing: 0.6,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  headerBrand: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
    maxWidth: 150,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  scroll: { flex: 1 },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 12,
  },
  tierLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  tierLabel: {
    color: CELESTIAL.antiqueGold,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  tierValue: {
    color: CELESTIAL.champagne,
    fontSize: 13,
  },
  tierDot: {
    color: CELESTIAL.bronze,
    fontSize: 13,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  arabic: {
    fontFamily: 'Amiri-Regular',
    fontSize: 24,
  },
  arabicCentered: {
    textAlign: 'center',
    marginBottom: 4,
  },
  scrollBody: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  vocBanner: {
    marginHorizontal: SPACING.xl,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CELESTIAL.antiqueGold + '80',
    backgroundColor: CELESTIAL.deepTeal,
  },
  vocText: {
    color: CELESTIAL.champagne,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
  signature: {
    color: CELESTIAL.antiqueGold,
    textAlign: 'center',
    fontSize: 11,
    paddingBottom: 2,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  flipX: {
    transform: [{ scaleX: -1 }],
  },
  trialBanner: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trialBannerText: {
    opacity: 0.8,
    textAlign: 'center',
    letterSpacing: 0.6,
    fontSize: 12,
  },
});

export default OracleScreen;
