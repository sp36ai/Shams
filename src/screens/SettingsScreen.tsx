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
import type { ThemeId } from '@theme/themes';

const SettingsScreen: React.FC = () => {
  const { theme, themeId, setThemeId, availableThemes } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang, switchLanguage } = useI18n();

  const lastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.lastLocation,
  );

  const userName = useAuthStore(selectUserName);
  const userEmail = useAuthStore(selectUserEmail);
  const signOut = useAuthStore(s => s.signOut);
  const isLoading = useAuthStore(s => s.isLoading);

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
          <Row label={t('settings.themeLabel')} colors={colors} typography={typography}>
            <View style={styles.swatchRow}>
              {availableThemes.map(th => {
                const selected = th.id === themeId;
                return (
                  <Pressable
                    key={th.id}
                    onPress={() => handleThemeChange(th.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t(`theme.${th.id}` as 'theme.teal')}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.swatch,
                      {
                        backgroundColor: th.colors.accent,
                        borderColor: selected ? colors.text : 'transparent',
                        borderWidth: selected ? 2.5 : 0,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    {selected && (
                      <Text style={{ color: th.colors.textOnPrimary, fontSize: 14 }}>✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Row>

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
  swatchRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default SettingsScreen;
