/**
 * ThemeSwitcher.tsx
 * Drop into your Settings screen or any screen for testing.
 *
 * Usage:
 *   import { ThemeSwitcher } from '@theme/ThemeSwitcher';
 *   // Inside your Settings screen JSX:
 *   <ThemeSwitcher />
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Platform,
} from 'react-native';
import { useTheme, useColors } from '@theme/ThemeProvider';
import { THEME_IDS, getTheme, type ThemeId, RADIUS, SPACING } from '@theme/themes';

// Dot preview colors per theme (the "sphere" swatch)
const THEME_DOT_COLORS: Record<ThemeId, [string, string]> = {
  darAlShams:     ['#F0C84A', '#3A2808'],
  laylAlBahr:     ['#90C8E0', '#060810'],
  narAlHadid:     ['#F09060', '#0C0806'],
  subhAlWahy:     ['#C49020', '#F5EDD8'],
  zaytunAlHikma:  ['#4A8840', '#EEF0E8'],
};

export function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme();
  const c = useColors();

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
        {THEME_IDS.map((id) => {
          const t = getTheme(id);
          const isActive = id === themeId;
          const [dotTop, dotBot] = THEME_DOT_COLORS[id];

          return (
            <TouchableOpacity
              key={id}
              onPress={() => setThemeId(id)}
              activeOpacity={0.75}
              style={[
                styles.card,
                {
                  backgroundColor: t.colors.surface,
                  borderColor: isActive ? t.colors.borderAccent : t.colors.border,
                  borderWidth: isActive ? 1.5 : 1,
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

              {/* Light / Dark badge */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: t.isDark
                      ? 'rgba(0,0,0,0.4)'
                      : 'rgba(255,255,255,0.5)',
                    borderColor: isActive ? t.colors.borderAccent : t.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: t.isDark ? t.colors.textMuted : t.colors.textMuted,
                      fontFamily: 'Cinzel-SemiBold',
                    },
                  ]}
                >
                  {t.isDark ? 'DARK' : 'LIGHT'}
                </Text>
              </View>

              {/* Active indicator dot */}
              {isActive && (
                <View style={[styles.activeDot, { backgroundColor: t.colors.gold }]} />
              )}
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
    fontSize: 9,
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
