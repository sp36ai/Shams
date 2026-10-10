/**
 * OracleScreen — home dashboard ("The Observatory Hall").
 * --------------------------------------------------------------------------
 * The first screen the seeker lands on after onboarding (Oracle is the
 * initial tab in MainTabs). Passive status surface apart from the ask
 * composer. Hierarchy follows DĀR AL-SHAMS design system §Home Screen:
 * hora status → celestial state → ask entry → moon mansion → user tier.
 * The one thing it is not passive about is the ask composer: a question
 * typed here opens a Reading (ReadingScreen), which owns the verdict and the
 * conversation about it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  I18nManager,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import CornerBrackets from '@components/home/CornerBrackets';
import HomeAskComposer from '@components/home/HomeAskComposer';
import { buildDailySkyMessage } from '@utils/dailySkyMessage';
import { favoredChipForPlanet } from '../data/favoredQuestion';
import { PLANET_DHIKR } from '../data/dailyDhikr';
import { todaysIslamicNote } from '../data/islamicDayOfWeek';
import { getManzilaDisplay } from '@astrology/manazil';

const SEAL_IMAGE = require('@assets/images/sky-clock-disk.png');

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

  // One eyebrow style for every section on Home, so the cards read as one set.
  const sectionLabel = (label: string, extra?: object): React.JSX.Element => (
    <Text style={[typography('label'), { color: colors.goldBright }, extra]}>
      {label.toUpperCase()}
    </Text>
  );
  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.borderAccent + '44' },
  ];
  // Chevrons point "forward" — mirrored in RTL so Urdu reads them correctly.
  const chevron = (color: string): React.JSX.Element => (
    <View style={I18nManager.isRTL ? styles.flipX : undefined}>
      <TabIcon name="chevronRight" color={color} size={16} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground starColor={colors.starfield} />

      {/* Header — today's date over the wordmark; location and Settings */}
      <View
        style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <View style={styles.headerBrand}>
          <Text style={[typography('caption'), { color: colors.textMuted }]} numberOfLines={1}>
            {todayLabel}
          </Text>
          <Text
            style={[typography('heading'), { color: colors.goldBright, marginTop: 2 }]}
            numberOfLines={1}
          >
            {t('app.name')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.locationChip, { borderColor: colors.borderAccent + '66' }]}>
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
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('settings.headerTitle')}
          >
            <TabIcon name="settings" color={colors.textMuted} size={18} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* Void-of-course Moon warning — classical horary caution */}
        {skyExtras.voidOfCourse.isVoid && (
          <View
            style={[
              styles.vocBanner,
              { backgroundColor: colors.surface, borderColor: colors.borderAccent },
            ]}
          >
            <Text
              style={[
                typography('caption'),
                { color: colors.goldBright, textAlign: 'center', lineHeight: 18 },
              ]}
            >
              {'☾ '}
              {t('oracle.voidOfCourseBanner', {
                time: formatClockTime(skyExtras.voidOfCourse.signExitMs),
              })}
            </Text>
          </View>
        )}

        {/* Current Hora — compact readout, seal as a small badge (not the hero).
            Premium glass+3D treatment lives ONLY here and on the Ask composer
            below — the two zones the design spec calls out as the Oracle
            hero. No blur library is installed, so "glass" is approximated
            with a translucent gold wash (colors.horaGradient[0] — an
            existing, previously-unused token named for exactly this card),
            a soft top highlight, and a warm glow shadow, rather than a
            new native dependency. */}
        <Pressable
          onPress={() => navigation.navigate('AlFalak')}
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderAccent + '55',
              shadowColor: colors.sacredGlow,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('oracle.openAlFalakA11y')}
        >
          <View
            pointerEvents="none"
            style={[styles.heroGlassOverlay, { backgroundColor: colors.horaGradient[0] }]}
          />
          <View
            pointerEvents="none"
            style={[styles.heroTopHighlight, { backgroundColor: colors.text + '1A' }]}
          />
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextCol}>
              {sectionLabel(t('oracle.currentHoraLabel'), { color: colors.textMuted })}
              <Text style={[typography('heading'), { color: colors.goldBright, marginTop: 6 }]}>
                {t('oracle.horaName', { planet: horaLord })}
              </Text>
              <Text style={[typography('caption'), { color: colors.accent, marginTop: 4 }]}>
                {horaCountdown} {t('oracle.remainingLabel')}
              </Text>
            </View>
            <View style={styles.heroSealBadge}>
              <HoraBadge glyph={PLANET_GLYPHS[horaLord]} size={84} />
            </View>
          </View>
          <View style={[styles.heroFooterRow, { borderTopColor: colors.border }]}>
            <Text style={[typography('caption'), { color: colors.textMuted }]}>
              {PLANET_GLYPHS[dayLord]} {dayLord}
            </Text>
            <View style={styles.inlineRow}>
              <Text style={[typography('label'), { color: colors.goldBright }]}>
                {t('nav.alFalakTab')}
              </Text>
              {chevron(colors.goldBright)}
            </View>
          </View>
        </Pressable>

        {/* Today's Sky — daily personalized readout, based on saved profile */}
        <View style={cardStyle}>
          {sectionLabel(t('oracle.dailySkyTitle'))}
          <Text style={[typography('body'), { color: colors.text, marginTop: 10, lineHeight: 24 }]}>
            {dailySky.greeting} {t('oracle.dayIsUnder')}{' '}
            <Text style={[emphasis, { color: colors.accent }]}>{dailySky.dayLord}</Text> (
            {dailySky.dayTheme}).
          </Text>
          <Text
            style={[typography('body'), { color: colors.textMuted, marginTop: 4, lineHeight: 24 }]}
          >
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

        {/* Ask Shams — the primary action: a question becomes a Reading */}
        <HomeAskComposer
          // push, not navigate — see ReadingsScreen for why: a Reading is
          // always its own screen, never a params update to one already open.
          onSubmit={(question, kind) =>
            navigation.push('Reading', { initialQuestion: question, initialQuestionKind: kind })
          }
          onOpenBlank={() => navigation.push('Reading', {})}
        />

        {/* Reading History */}
        <Pressable
          onPress={() => navigation.navigate('Readings')}
          style={({ pressed }) => [
            styles.actionBtnSecondary,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('oracle.readingHistoryCta')}
        >
          <View
            style={[
              styles.actionIconWrap,
              { borderColor: colors.borderAccent + '55', backgroundColor: colors.surfaceElevated },
            ]}
          >
            <TabIcon name="history" color={colors.goldBright} size={20} />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={[typography('button'), { color: colors.text, fontSize: 15 }]}>
              {t('oracle.readingHistoryCta')}
            </Text>
            <Text style={[typography('caption'), { color: colors.textMuted, marginTop: 2 }]}>
              {t('oracle.viewPastReadingsSubtitle')}
            </Text>
          </View>
          {chevron(colors.textMuted)}
        </Pressable>

        {/* Moon Manzil — the current lunar mansion (Manazil al-Qamar) */}
        <View style={[cardStyle, styles.manzilCard]}>
          <CornerBrackets />
          {sectionLabel(t('oracle.moonManzilTitle'))}
          <View style={styles.manzilRow}>
            <ManzilEmblem size={80} />
            <View style={styles.manzilTextCol}>
              <Text
                style={{
                  fontFamily: 'Amiri-Regular',
                  fontSize: 22,
                  color: colors.goldBright,
                }}
              >
                {manzil.arabic}
              </Text>
              <Text style={[typography('subheading'), { color: colors.text, marginTop: 2 }]}>
                {manzil.name}
              </Text>
              <Text
                style={[
                  typography('bodyItalic'),
                  { color: colors.textMuted, marginTop: 4, lineHeight: 22 },
                ]}
              >
                {manzil.descriptor}
              </Text>
            </View>
          </View>
          {skyExtras.sunTimes !== null && (
            <View style={[styles.manzilFooter, { borderTopColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.textMuted }]}>
                {skyExtras.moonPhaseFull}
              </Text>
              <Text style={[typography('caption'), { color: colors.textMuted }]}>
                {t('oracle.sunriseLabel')} {formatClockTime(skyExtras.sunTimes.sunriseMs)}
                {'  ·  '}
                {t('oracle.sunsetLabel')} {formatClockTime(skyExtras.sunTimes.sunsetMs)}
              </Text>
            </View>
          )}
        </View>

        {/* Quota + Tier pills */}
        <View style={styles.pillRow}>
          <View
            style={[
              styles.infoPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {sectionLabel(t('oracle.todaysQuotaLabel'), { color: colors.textMuted })}
            <Text style={[typography('subheading'), { color: colors.goldBright, marginTop: 4 }]}>
              {questionsLeft === Infinity
                ? '∞'
                : `${questionsLeft} / ${trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT}`}
            </Text>
          </View>
          <View
            style={[
              styles.infoPill,
              styles.tierPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.tierTextCol}>
              {sectionLabel(t('oracle.yourTierLabel'), { color: colors.textMuted })}
              <Text style={[typography('subheading'), { color: colors.goldBright, marginTop: 4 }]}>
                {tierLabel}
              </Text>
            </View>
            <Image source={SEAL_IMAGE} style={styles.tierSealImage} resizeMode="contain" />
          </View>
        </View>

        {/* Today's guidance — Favored Now, Daily Dhikr and Today's Blessing as
            one card with three ruled sections, rather than three more cards. */}
        <View style={cardStyle}>
          {/* Favored Now — which chip category the current hora lord favors */}
          {sectionLabel(t('oracle.favoredNowTitle'))}
          <Text style={[typography('body'), { color: colors.text, marginTop: 8, lineHeight: 24 }]}>
            {t('oracle.favoredNowBody')}{' '}
            <Text style={[emphasis, { color: colors.accent }]}>{favoredChip}</Text>
          </Text>

          {/* Daily Dhikr — a Name of Allah tied to today's day lord */}
          {dhikr !== undefined && (
            <View style={[styles.guidanceSection, { borderTopColor: colors.border }]}>
              {sectionLabel(t('oracle.dailyDhikrTitle'))}
              <Text
                style={{
                  fontFamily: 'Amiri-Regular',
                  fontSize: 24,
                  color: colors.goldBright,
                  textAlign: 'center',
                  marginTop: 10,
                  marginBottom: 2,
                }}
              >
                {dhikr.arabic}
              </Text>
              <Text
                style={[
                  typography('body'),
                  { color: colors.text, textAlign: 'center', lineHeight: 24 },
                ]}
              >
                {t('oracle.dailyDhikrRecite')} {dhikr.name} ({dhikr.meaning[lang]})
              </Text>
              <Text
                style={[
                  typography('bodyItalic'),
                  {
                    color: colors.textMuted,
                    textAlign: 'center',
                    marginTop: 4,
                    lineHeight: 22,
                  },
                ]}
              >
                {dhikr.intention[lang]}
              </Text>
            </View>
          )}

          {/* Today's Blessing — Islamic day-of-week note */}
          <View style={[styles.guidanceSection, { borderTopColor: colors.border }]}>
            {sectionLabel(t('oracle.blessingTitle'))}
            <Text
              style={[typography('body'), { color: colors.text, marginTop: 8, lineHeight: 24 }]}
            >
              <Text style={[emphasis, { color: colors.accent }]}>{islamicNote.name[lang]}</Text>
              {' — '}
              {islamicNote.note[lang]}
            </Text>
          </View>
        </View>

        {/* Brand signature */}
        <Text
          style={[
            typography('caption'),
            { color: colors.textFaint, textAlign: 'center', marginTop: 4, fontSize: 12 },
          ]}
        >
          {t('app.poweredBy')}
        </Text>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 170,
    backgroundColor: '#FFFFFF08',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollBody: {
    paddingBottom: SPACING.xl,
  },
  vocBanner: {
    marginHorizontal: SPACING.xl,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroCard: {
    marginHorizontal: SPACING.xl,
    marginTop: 16,
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', // clips the glass overlay/highlight to the rounded corners
    // Warmer, deeper glow than the previous flat black shadow — shadowColor
    // is set per-theme (colors.sacredGlow) in the JSX above.
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  // Translucent gold wash standing in for backdrop blur (see comment at the
  // call site) — absolutely filled behind the card's real content.
  heroGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  // A 1px lighter line along the top edge — the "soft inner highlight" a
  // glass panel catches from above. Cheap enough to keep even without blur.
  heroTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextCol: {
    flex: 1,
  },
  heroSealBadge: {
    marginLeft: 12,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  flipX: {
    transform: [{ scaleX: -1 }],
  },
  pillRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: SPACING.xl,
    marginBottom: 14,
  },
  infoPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  tierTextCol: {
    alignItems: 'flex-start',
  },
  tierSealImage: {
    width: 32,
    height: 32,
    marginLeft: 8,
    opacity: 0.9,
  },
  card: {
    marginHorizontal: SPACING.xl,
    marginBottom: 14,
    padding: 18,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  manzilCard: {
    position: 'relative',
  },
  manzilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  manzilTextCol: {
    flex: 1,
  },
  manzilFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  guidanceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.xl,
    marginTop: 14,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    marginLeft: 12,
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
