/**
 * OracleScreen — home dashboard.
 * --------------------------------------------------------------------------
 * The first screen the seeker lands on after onboarding (Oracle is the
 * initial tab in MainTabs). Passive status surface only — no chat, no
 * composer. Shows the live sky readout, quota, location, and today's
 * personalized sky message, then hands off to OracleChatScreen (via the
 * "Ask Shams" button) for the actual question/verdict conversation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { storage, KEYS } from '@storage/mmkv';
import StarfieldBackground from '@components/StarfieldBackground';
import { buildDailySkyMessage } from '@utils/dailySkyMessage';

// ── OracleScreen (home dashboard) ───────────────────────────────────────────

const OracleScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
  const trialActive = useQuotaStore(s => s.trialActive);

  const lonDegForTiming = lastLocation?.lon ?? 74.3587;
  const { horaLord, dayLord } = useTimingStrip(lonDegForTiming);

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
        <View style={styles.headerRight}>
          {questionsLeft !== Infinity && (
            <View
              style={[
                styles.quotaBadge,
                { borderColor: questionsLeft === 0 ? colors.negative : colors.borderAccent },
              ]}
            >
              <Text
                style={[
                  typography('caption'),
                  {
                    color: questionsLeft === 0 ? colors.negative : colors.textMuted,
                  },
                ]}
              >
                {questionsLeft}/{trialActive ? TRIAL_DAILY_LIMIT : FREE_DAILY_LIMIT}
              </Text>
            </View>
          )}
          <View style={[styles.locationChip, { borderColor: colors.borderAccent }]}>
            <Text style={[typography('caption'), { color: colors.textMuted }]} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.scrollBody}>
        {/* Dashboard row */}
        <View
          style={[
            styles.dashboardRow,
            { borderColor: colors.borderAccent + '44', backgroundColor: colors.surface },
          ]}
        >
          <View style={[styles.statCard, { borderColor: colors.borderAccent }]}>
            <Text style={[typography('caption'), { color: colors.textMuted }]}>HORA</Text>
            <Text style={[typography('label'), { color: colors.goldBright, marginTop: 4 }]}>
              {horaLord}
            </Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.borderAccent }]}>
            <Text style={[typography('caption'), { color: colors.textMuted }]}>DAY LORD</Text>
            <Text style={[typography('label'), { color: colors.goldBright, marginTop: 4 }]}>
              {dayLord}
            </Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.borderAccent }]}>
            <Text style={[typography('caption'), { color: colors.textMuted }]}>QUESTIONS</Text>
            <Text style={[typography('label'), { color: colors.goldBright, marginTop: 4 }]}>
              {questionsLeft === Infinity ? '∞' : questionsLeft}
            </Text>
          </View>
        </View>

        {/* Timing strip — hora + day lord; taps into Sky State */}
        <Pressable
          onPress={() => navigation.navigate('SkyState')}
          style={[
            styles.timingStrip,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open Sky State timing panel"
        >
          <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9 }]}>
            HORA
          </Text>
          <Text
            style={[typography('label'), { color: colors.accent, marginLeft: 4, marginRight: 16 }]}
          >
            {horaLord}
          </Text>
          <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9 }]}>DAY</Text>
          <Text style={[typography('label'), { color: colors.accent, marginLeft: 4 }]}>
            {dayLord}
          </Text>
          <Text
            style={[
              typography('caption'),
              { color: colors.goldBright, marginLeft: 'auto', fontSize: 10, letterSpacing: 0.8 },
            ]}
          >
            Al-Falak ›
          </Text>
        </Pressable>

        {/* Today's Sky — daily personalized readout, based on saved profile */}
        <View
          style={[
            styles.dailySkyCard,
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

        {/* Ask Shams — opens the oracle chat conversation */}
        <Pressable
          testID="ask-shams-btn"
          onPress={() => navigation.navigate('OracleChat')}
          style={({ pressed }) => [
            styles.askShamsBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('oracle.askShamsCta')}
        >
          <Text style={[typography('button'), { color: colors.textOnPrimary, fontSize: 16 }]}>
            {'✦ '}
            {t('oracle.askShamsCta')}
          </Text>
        </Pressable>
      </View>

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quotaBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF0F',
  },
  locationChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: '55%',
    backgroundColor: '#FFFFFF08',
  },
  scrollBody: {
    flex: 1,
    paddingBottom: 8,
  },
  dashboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    // minWidth: 0 lets the three flex:1 cards shrink to share the row on
    // narrow/zoomed screens instead of overflowing the right edge (a fixed
    // minWidth here would force 3×88dp + gaps past a reduced-dp width).
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  timingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  dailySkyCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  askShamsBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
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
