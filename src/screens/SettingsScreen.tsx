/**
 * SettingsScreen — appearance, language, location, and account settings.
 */

import React, { useCallback } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useI18n, useTranslation } from '@i18n/I18nProvider';
import { LANG_CODES, LANG_META, type LangCode } from '@i18n/types';
import { useSettingsStore } from '@stores/settingsStore';
import { useAuthStore, selectUserName, selectUserEmail } from '@stores/authStore';
import { useReadingsStore, type VerdictKind } from '@stores/readingsStore';
import { useQuotaStore, FREE_LIMIT, type PlanTier } from '@stores/quotaStore';
import type { ThemeId } from '@theme/themes';

const SettingsScreen: React.FC = () => {
  const { theme, themeId, setThemeId, availableThemes } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang, switchLanguage } = useI18n();

  const lastLocation = useSettingsStore(s => s.lastLocation);

  const userName = useAuthStore(selectUserName);
  const userEmail = useAuthStore(selectUserEmail);
  const signOut = useAuthStore(s => s.signOut);
  const isLoading = useAuthStore(s => s.isLoading);

  const readings = useReadingsStore(s => s.readings);
  const plan = useQuotaStore(s => s.plan);
  const usedThisWeek = useQuotaStore(s => s.usedThisWeek);

  const handleSignOut = useCallback(() => {
    Alert.alert(t('settings.signOutConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  }, [signOut, t]);

  const handleThemeChange = useCallback(
    (id: ThemeId) => {
      if (id !== themeId) {
        setThemeId(id);
      }
    },
    [themeId, setThemeId],
  );

  const handleLanguageChange = useCallback(
    (next: LangCode) => {
      if (next === lang) {
        return;
      }
      const restartNeeded = switchLanguage(next);
      if (!restartNeeded) {
        return;
      }

      const restartMessage =
        next === 'ur'
          ? 'زبان بدل گئی ہے۔ درست ترتیب کے لیے ایپ دوبارہ کھولیں۔'
          : next === 'hi'
            ? 'भाषा बदल गई है। सही विन्यास के लिए ऐप दोबारा खोलें।'
            : 'Language changed. Reopen the app for the correct layout.';

      Alert.alert(t('common.pleaseWait'), restartMessage, [
        { text: t('common.ok'), style: 'default' },
      ]);
    },
    [lang, switchLanguage, t],
  );

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const locationText =
    lastLocation === null
      ? t('permission.deniedBody')
      : `${lastLocation.lat.toFixed(4)}, ${lastLocation.lon.toFixed(4)}`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[typography('subheading'), { color: colors.text }]}>
          {t('settings.headerTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Section title={t('settings.appearanceSection')}>
          <Text
            style={[
              typography('label'),
              { color: colors.textMuted, marginBottom: 8, letterSpacing: 1, fontSize: 10 },
            ]}
          >
            {t('settings.themeLabel').toUpperCase()}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themeCardRow}
          >
            {availableThemes.map(th => {
              const selected = th.id === themeId;
              return (
                <Pressable
                  key={th.id}
                  onPress={() => handleThemeChange(th.id)}
                  accessibilityRole="button"
                  accessibilityLabel={th.name}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.themeCard,
                    {
                      backgroundColor: th.colors.bg,
                      borderColor: selected ? th.colors.accent : th.colors.border,
                      borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {/* Accent dot */}
                  <View style={[styles.themeCardDot, { backgroundColor: th.colors.accent }]} />
                  {/* Name */}
                  <Text
                    style={[styles.themeCardName, { color: th.colors.accent }]}
                    numberOfLines={2}
                  >
                    {th.name}
                  </Text>
                  {/* Subtitle */}
                  <Text
                    style={[styles.themeCardSub, { color: th.colors.textFaint }]}
                    numberOfLines={2}
                  >
                    {th.subtitle}
                  </Text>
                  {/* Active indicator bar */}
                  {selected && (
                    <View style={[styles.themeCardBar, { backgroundColor: th.colors.accent }]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Row label={t('settings.languageLabel')} colors={colors} typography={typography}>
            <View style={styles.langRow}>
              {LANG_CODES.map(code => {
                const meta = LANG_META[code];
                const selected = code === lang;
                return (
                  <Pressable
                    key={code}
                    onPress={() => handleLanguageChange(code)}
                    accessibilityRole="button"
                    accessibilityLabel={meta.englishName}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.langChip,
                      {
                        backgroundColor: selected ? colors.accent : 'transparent',
                        borderColor: selected ? colors.accent : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography('label'),
                        { color: selected ? colors.textOnPrimary : colors.text },
                      ]}
                    >
                      {meta.nativeName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Row>
        </Section>

        <Section title={t('settings.profileSection')}>
          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[typography('bodyEmphasis'), { color: colors.text }]} numberOfLines={1}>
              {userName}
            </Text>
            {userEmail.length > 0 && (
              <Text
                style={[typography('caption'), { color: colors.textMuted, marginTop: 2 }]}
                numberOfLines={1}
              >
                {userEmail}
              </Text>
            )}
          </View>
        </Section>

        <Section title="Subscription">
          <SubscriptionCard
            plan={plan}
            usedThisWeek={usedThisWeek}
            colors={colors}
            typography={typography}
          />
        </Section>

        <Section title="Reading Stats">
          <ReadingStatsRow readings={readings} colors={colors} typography={typography} />
        </Section>

        <Section title={t('settings.accountSection')}>
          <Pressable
            onPress={handleSignOut}
            disabled={isLoading}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.signOutBtn,
              {
                borderColor: colors.negative,
                backgroundColor: colors.surface,
                opacity: pressed || isLoading ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[typography('button'), { color: colors.negative }]}>
              {t('settings.signOut')}
            </Text>
          </Pressable>
        </Section>

        <Section title={t('permission.locationTitle')}>
          <View
            style={[
              styles.locationCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[typography('body'), { color: colors.text }]}>{locationText}</Text>
            <Pressable
              onPress={handleOpenSettings}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.actionRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceElevated,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[typography('button'), { color: colors.text }]}>
                {t('permission.openSettings')}
              </Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── SubscriptionCard ──────────────────────────────────────────────────────────

function planLabel(plan: PlanTier): string {
  switch (plan) {
    case 'starter':
      return 'Starter';
    case 'premium':
      return '✦ Premium';
    case 'consultation':
      return '✦ Consultation';
    default:
      return 'Free';
  }
}

const UNLIMITED_PLAN_SET: readonly PlanTier[] = ['starter', 'premium', 'consultation'];

const SubscriptionCard: React.FC<{
  plan: PlanTier;
  usedThisWeek: number;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}> = ({ plan, usedThisWeek, colors, typography }) => {
  const isPaid = (UNLIMITED_PLAN_SET as PlanTier[]).includes(plan);
  return (
    <View
      style={[
        styles.subCard,
        {
          backgroundColor: colors.surface,
          borderColor: isPaid ? colors.amber : colors.border,
        },
      ]}
    >
      <Text
        style={[typography('bodyEmphasis'), { color: isPaid ? colors.amber : colors.textMuted }]}
      >
        {planLabel(plan)}
      </Text>
      {isPaid ? (
        <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 2 }]}>
          Unlimited readings
        </Text>
      ) : (
        <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 2 }]}>
          {usedThisWeek}/{FREE_LIMIT} questions used this week
        </Text>
      )}
    </View>
  );
};

// ── ReadingStatsRow ───────────────────────────────────────────────────────────

function countVerdict(readings: readonly { verdict: VerdictKind }[], v: VerdictKind): number {
  return readings.filter(r => r.verdict === v).length;
}

const ReadingStatsRow: React.FC<{
  readings: readonly { verdict: VerdictKind }[];
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}> = ({ readings, colors, typography }) => (
  <View style={styles.statsRow}>
    <StatCard
      value={String(readings.length)}
      label="Total"
      color={colors.accent}
      colors={colors}
      typography={typography}
    />
    <StatCard
      value={String(countVerdict(readings, 'YES'))}
      label="YES"
      color={colors.positive}
      colors={colors}
      typography={typography}
    />
    <StatCard
      value={String(countVerdict(readings, 'NO'))}
      label="NO"
      color={colors.negative}
      colors={colors}
      typography={typography}
    />
    <StatCard
      value={String(countVerdict(readings, 'CONDITIONAL') + countVerdict(readings, 'DELAYED'))}
      label="COND"
      color={colors.caution}
      colors={colors}
      typography={typography}
    />
  </View>
);

const StatCard: React.FC<{
  value: string;
  label: string;
  color: string;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}> = ({ value, label, color, colors, typography }) => (
  <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[typography('heading'), { color, textAlign: 'center' }]}>{value}</Text>
    <Text
      style={[typography('caption'), { color: colors.textFaint, textAlign: 'center', fontSize: 9 }]}
    >
      {label}
    </Text>
  </View>
);

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => {
  const colors = useColors();
  const typography = useTypography();
  return (
    <View style={styles.section}>
      <Text
        style={[
          typography('label'),
          {
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 8,
          },
        ]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};

interface RowProps {
  label: string;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
  children: React.ReactNode;
}

const Row: React.FC<RowProps> = ({ label, colors, typography, children }) => (
  <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={{ flex: 1, marginRight: 12 }}>
      <Text style={[typography('body'), { color: colors.text }]}>{label}</Text>
    </View>
    {children}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 8,
  },
  section: {
    marginTop: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  themeCardRow: {
    gap: 10,
    paddingBottom: 4,
  },
  themeCard: {
    width: 90,
    height: 110,
    borderRadius: 10,
    padding: 10,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  themeCardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  themeCardName: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 13,
  },
  themeCardSub: {
    fontSize: 7,
    marginTop: 3,
    lineHeight: 11,
  },
  themeCardBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  profileCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signOutBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  locationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  actionRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  subCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
});

export default SettingsScreen;
