/**
 * ThemeSwitcher.tsx
 * Drop into your Settings screen or any screen for testing.
 *
 * Usage:
 *   import { ThemeSwitcher } from '@theme/ThemeSwitcher';
 *   // Inside your Settings screen JSX:
 *   <ThemeSwitcher />
 *
 * Tier gating: darAlShams is free; the five original colour variants
 * require Mureed; qutbAlAnwar/kanzAlAsrar require Khāṣṣ (see THEME_TIER in
 * themes.ts). A locked card is dimmed, shows the tier that unlocks it
 * instead of the DARK/LIGHT badge, and tapping it opens Premium rather than
 * switching — the same "propose an upgrade, don't just disable" pattern
 * used elsewhere in the app.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigation } from '@navigation/types';
import { useTheme, useColors } from '@theme/ThemeProvider';
import {
  THEME_IDS,
  THEME_TIER,
  getTheme,
  isThemeUnlocked,
  type ThemeId,
  RADIUS,
  SPACING,
} from '@theme/themes';
import { useQuotaStore, type PlanTier } from '@stores/quotaStore';

// Dot preview colors per theme (the "sphere" swatch)
const THEME_DOT_COLORS: Record<ThemeId, [string, string]> = {
  darAlShams: ['#F0C84A', '#3A2808'],
  laylAlBahr: ['#90C8E0', '#060810'],
  narAlHadid: ['#F09060', '#0C0806'],
  subhAlWahy: ['#C49020', '#F5EDD8'],
  zaytunAlHikma: ['#4A8840', '#EEF0E8'],
  sirrAlBanafsaj: ['#A78BFA', '#0B0A14'],
  qutbAlAnwar: ['#F2F4F8', '#0A0C10'],
  kanzAlAsrar: ['#F0BE8A', '#08110D'],
};

const TIER_LABEL: Record<PlanTier, string> = {
  free: 'FREE',
  mureed: 'MUREED',
  khass: 'KHĀṢṢ',
};

export function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme();
  const c = useColors();
  const plan = useQuotaStore(s => s.plan);
  const navigation = useNavigation<AppNavigation>();

  return (
    <View style={[styles.section, { borderColor: c.border }]}>
      <Text style={[styles.sectionLabel, { color: c.textMuted, fontFamily: 'Cinzel-SemiBold' }]}>
        THEME — السِّمَة
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {THEME_IDS.map(id => {
          const t = getTheme(id);
          const isActive = id === themeId;
          const unlocked = isThemeUnlocked(id, plan);
          const [dotTop, dotBot] = THEME_DOT_COLORS[id];

          return (
            <TouchableOpacity
              key={id}
              onPress={() => (unlocked ? setThemeId(id) : navigation.navigate('Premium'))}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={
                unlocked ? t.name : `${t.name} — requires ${TIER_LABEL[THEME_TIER[id]]}`
              }
              style={[
                styles.card,
                {
                  backgroundColor: t.colors.surface,
                  borderColor: isActive ? t.colors.borderAccent : t.colors.border,
                  borderWidth: isActive ? 1.5 : 1,
                  opacity: unlocked ? 1 : 0.55,
                  ...Platform.select({
                    ios: {
                      shadowColor: isActive ? t.colors.sacredGlow : '#000',
                      shadowOpacity: isActive ? 0.45 : 0.12,
                      shadowRadius: isActive ? 12 : 4,
                      shadowOffset: { width: 0, height: 0 },
                    },
                    android: { elevation: isActive ? 6 : 2 },
                  }),
                },
              ]}
            >
              {/* 3-layer sphere dot */}
              <View style={[styles.dot, { backgroundColor: dotBot }]}>
                <View
                  style={[
                    styles.dotInner,
                    {
                      backgroundColor: dotTop,
                      opacity: 0.9,
                    },
                  ]}
                />
                {/* Specular highlight */}
                <View style={styles.dotSpec} />
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.cardName,
                  {
                    color: isActive ? t.colors.gold : t.colors.textMuted,
                    fontFamily: 'Cinzel-SemiBold',
                  },
                ]}
              >
                {t.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.cardSub,
                  {
                    color: t.colors.textFaint,
                    fontFamily: 'Spectral-Italic',
                  },
                ]}
              >
                {t.subtitle}
              </Text>

              {/* Light / Dark badge, or — when locked — the tier that unlocks it */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: unlocked
                      ? t.isDark
                        ? 'rgba(0,0,0,0.4)'
                        : 'rgba(255,255,255,0.5)'
                      : `${t.colors.gold}22`,
                    borderColor: unlocked
                      ? isActive
                        ? t.colors.borderAccent
                        : t.colors.border
                      : t.colors.gold,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: unlocked ? t.colors.textMuted : t.colors.gold,
                      fontFamily: 'Cinzel-SemiBold',
                    },
                  ]}
                >
                  {unlocked ? (t.isDark ? 'DARK' : 'LIGHT') : `✦ ${TIER_LABEL[THEME_TIER[id]]}`}
                </Text>
              </View>

              {/* Active indicator dot */}
              {isActive && <View style={[styles.activeDot, { backgroundColor: t.colors.gold }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: 1,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  row: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    flexDirection: 'row',
  },
  card: {
    width: 130,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    position: 'relative',
    gap: 4,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotInner: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: 28,
    height: 24,
    borderRadius: 14,
  },
  dotSpec: {
    position: 'absolute',
    top: 7,
    left: 9,
    width: 12,
    height: 9,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  cardName: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cardSub: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 8,
    letterSpacing: 1,
  },
  activeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
