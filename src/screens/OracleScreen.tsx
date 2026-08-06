/**
 * OracleScreen — home dashboard ("The Observatory Hall").
 * --------------------------------------------------------------------------
 * The first screen the seeker lands on after onboarding (Oracle is the
 * initial tab in MainTabs). Passive status surface only — no chat, no
 * composer. Hierarchy follows DĀR AL-SHAMS design system §Home Screen:
 * hora status → celestial state → ask entry → moon mansion → user tier.
 * Hands off to OracleChatScreen (via "Ask New Question") for the actual
 * question/verdict conversation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { acquireLocation } from '@utils/acquireLocation';
import crashlytics from '@react-native-firebase/crashlytics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // History lives on the sibling tab navigator, not the root stack — same
  // loose-typing precedent as HistoryScreen's own navigation prop.
  const tabNavigation = useNavigation<{ navigate: (screen: string) => void }>();

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

  const locationLabel =
    lastLocation === null
      ? t('errors.locationRequired')
      : `${lastLocation.lat.toFixed(2)}, ${lastLocation.lon.toFixed(2)}`;

  const dailySky = buildDailySkyMessage({
    dayLord,
    horaLord,
    seekerProfile,
    seekerName,
    lang,
  });

  const favoredChip = favoredChipForPlanet(horaLord, lang);
  const dhikr = PLANET_DHIKR[dayLord];
  const islamicNote = todaysIslamicNote(new Date());

  const manzil = getManzilaDisplay(displayLonSidereal('Moon', Date.now()));

  const tierLabel =
    plan === 'mureed'
      ? t('premium.tierStarter')
      : plan === 'khass'
        ? t('premium.tierPremium')
        : t('oracle.tierWanderer');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground starColor={colors.starfield} />

      {/* Header */}
      <View
        style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <View>
          <Text style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.5 }]}>
            ORACLE
          </Text>
          <Text style={[typography('subheading'), { color: colors.text, marginTop: 2 }]}>
            SHAMS AL-ASRĀR
          </Text>
        </View>
        <View style={[styles.locationChip, { borderColor: colors.borderAccent }]}>
          <Text style={[typography('caption'), { color: colors.textMuted }]} numberOfLines={1}>
            {locationLabel}
          </Text>
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
                { color: colors.goldBright, textAlign: 'center', lineHeight: 16 },
              ]}
            >
              {'☾ '}
              {t('oracle.voidOfCourseBanner', {
                time: formatClockTime(skyExtras.voidOfCourse.signExitMs),
              })}
            </Text>
          </View>
        )}

        {/* Current Hora — the sacred seal, breathing at the heart of the screen */}
        <Pressable
          onPress={() => navigation.navigate('SkyState')}
          style={[
            styles.heroCard,
            { backgroundColor: colors.surface, borderColor: colors.borderAccent + '55' },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open Al-Falak — Sky State timing panel"
        >
          <Image source={SEAL_IMAGE} style={styles.sealImage} resizeMode="contain" />
          <Text
            style={[
              typography('caption'),
              { color: colors.textMuted, letterSpacing: 1.6, marginTop: 12 },
            ]}
          >
            {t('oracle.currentHoraLabel').toUpperCase()}
          </Text>
          <Text
            style={[
              typography('title'),
              { color: colors.goldBright, marginTop: 4, letterSpacing: 0.6 },
            ]}
          >
            {PLANET_GLYPHS[horaLord]} {horaLord} Hora
          </Text>
          <Text style={[typography('label'), { color: colors.accent, marginTop: 6 }]}>
            {horaCountdown} {t('oracle.remainingLabel')}
          </Text>
          <Text
            style={[
              typography('caption'),
              { color: colors.goldBright, marginTop: 10, fontSize: 10, letterSpacing: 0.8 },
            ]}
          >
            {PLANET_GLYPHS[dayLord]} {dayLord} · Al-Falak ›
          </Text>
        </Pressable>

        {/* Quota + Tier pills */}
        <View style={styles.pillRow}>
          <View
            style={[
              styles.infoPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 10 }]}>
              {t('oracle.todaysQuotaLabel').toUpperCase()}
            </Text>
            <Text style={[typography('label'), { color: colors.goldBright, marginTop: 4 }]}>
              {questionsLeft === Infinity
                ? '∞'
                : `${questionsLeft} / ${trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT}`}
            </Text>
          </View>
          <View
            style={[
              styles.infoPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 10 }]}>
              {t('oracle.yourTierLabel').toUpperCase()}
            </Text>
            <Text style={[typography('label'), { color: colors.goldBright, marginTop: 4 }]}>
              {tierLabel.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Moon Manzil — the current lunar mansion (Manazil al-Qamar) */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderAccent + '44' },
          ]}
        >
          <Text style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.2 }]}>
            {t('oracle.moonManzilTitle').toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: 'Amiri-Regular',
              fontSize: 20,
              color: colors.goldBright,
              marginTop: 8,
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
              { color: colors.textMuted, marginTop: 6, lineHeight: 20 },
            ]}
          >
            {manzil.descriptor}
          </Text>
          {skyExtras.sunTimes !== null && (
            <Text
              style={[
                typography('caption'),
                { color: colors.textFaint, marginTop: 10, lineHeight: 18 },
              ]}
            >
              {skyExtras.moonPhaseFull}
              {'   ·   '}
              {t('oracle.sunriseLabel')} {formatClockTime(skyExtras.sunTimes.sunriseMs)}
              {'   ·   '}
              {t('oracle.sunsetLabel')} {formatClockTime(skyExtras.sunTimes.sunsetMs)}
            </Text>
          )}
        </View>

        {/* Ask New Question — opens the oracle chat conversation */}
        <Pressable
          testID="ask-shams-btn"
          onPress={() => navigation.navigate('OracleChat')}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('oracle.askNewQuestionCta')}
        >
          <View>
            <Text style={[typography('button'), { color: colors.textOnPrimary, fontSize: 16 }]}>
              {'✦ '}
              {t('oracle.askNewQuestionCta')}
            </Text>
            <Text
              style={[
                typography('caption'),
                { color: colors.textOnPrimary, opacity: 0.75, marginTop: 2 },
              ]}
            >
              {t('oracle.consultOracleSubtitle')}
            </Text>
          </View>
          <Text style={[typography('label'), { color: colors.textOnPrimary, opacity: 0.85 }]}>
            ›
          </Text>
        </Pressable>

        {/* Reading History */}
        <Pressable
          onPress={() => tabNavigation.navigate('History')}
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
          <View>
            <Text style={[typography('button'), { color: colors.text, fontSize: 15 }]}>
              {'📜 '}
              {t('oracle.readingHistoryCta')}
            </Text>
            <Text style={[typography('caption'), { color: colors.textMuted, marginTop: 2 }]}>
              {t('oracle.viewPastReadingsSubtitle')}
            </Text>
          </View>
          <Text style={[typography('label'), { color: colors.textMuted }]}>›</Text>
        </Pressable>

        {/* Today's Sky — daily personalized readout, based on saved profile */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderAccent + '44' },
          ]}
        >
          <Text style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.2 }]}>
            {t('oracle.dailySkyTitle').toUpperCase()}
          </Text>
          <Text style={[typography('body'), { color: colors.text, marginTop: 8, lineHeight: 22 }]}>
            {dailySky.greeting} {lang === 'ur' ? 'کے تحت' : lang === 'hi' ? 'में' : 'is under'}{' '}
            <Text style={{ fontWeight: '700', color: colors.accent }}>{dailySky.dayLord}</Text> (
            {dailySky.dayTheme}).
          </Text>
          <Text
            style={[typography('body'), { color: colors.textMuted, marginTop: 4, lineHeight: 22 }]}
          >
            {lang === 'ur' ? 'اس گھڑی پر' : lang === 'hi' ? 'इस समय' : 'This hour carries'}{' '}
            <Text style={{ fontWeight: '700', color: colors.accent }}>{dailySky.horaLord}</Text> (
            {dailySky.horaTheme}).
          </Text>
          {dailySky.guidance !== null && (
            <Text
              style={[
                typography('bodyItalic'),
                { color: colors.goldBright, marginTop: 10, lineHeight: 20, opacity: 0.9 },
              ]}
            >
              {dailySky.guidance}
            </Text>
          )}
        </View>

        {/* Favored Now — which chip category the current hora lord favors */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderAccent + '44' },
          ]}
        >
          <Text style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.2 }]}>
            {t('oracle.favoredNowTitle').toUpperCase()}
          </Text>
          <Text style={[typography('body'), { color: colors.text, marginTop: 8, lineHeight: 22 }]}>
            {t('oracle.favoredNowBody')}{' '}
            <Text style={{ fontWeight: '700', color: colors.accent }}>{favoredChip}</Text>
          </Text>
        </View>

        {/* Daily Dhikr — a Name of Allah tied to today's day lord */}
        {dhikr !== undefined && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.borderAccent + '44' },
            ]}
          >
            <Text style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.2 }]}>
              {t('oracle.dailyDhikrTitle').toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: 'Amiri-Regular',
                fontSize: 20,
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
                { color: colors.text, textAlign: 'center', lineHeight: 22 },
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
                  lineHeight: 20,
                },
              ]}
            >
              {dhikr.intention[lang]}
            </Text>
          </View>
        )}

        {/* Today's Blessing — Islamic day-of-week note */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderAccent + '44' },
          ]}
        >
          <Text style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.2 }]}>
            {t('oracle.blessingTitle').toUpperCase()}
          </Text>
          <Text style={[typography('body'), { color: colors.text, marginTop: 8, lineHeight: 22 }]}>
            <Text style={{ fontWeight: '700', color: colors.accent }}>
              {islamicNote.name[lang]}
            </Text>
            {' — '}
            {islamicNote.note[lang]}
          </Text>
        </View>
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
            style={[
              typography('caption'),
              {
                color: colors.goldBright,
                opacity: 0.6,
                textAlign: 'center',
                letterSpacing: 0.6,
                fontSize: 12,
              },
            ]}
          >
            {'Your open doors close in 2 days.'}
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
          accessibilityLabel="Choose your path — navigate to subscription"
        >
          <Text
            style={[
              typography('caption'),
              {
                color: colors.goldBright,
                opacity: 0.6,
                textAlign: 'center',
                letterSpacing: 0.6,
                fontSize: 12,
              },
            ]}
          >
            {'Your open doors close tonight — Choose Your Path ›'}
          </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  locationChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: '55%',
    backgroundColor: '#FFFFFF08',
  },
  scroll: { flex: 1 },
  scrollBody: {
    paddingBottom: 24,
  },
  vocBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroCard: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  sealImage: {
    width: 84,
    height: 84,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  infoPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trialBanner: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default OracleScreen;
