/**
 * HomeHero — the top of the Home screen: the gold mandala, a row of three
 * metric capsules and a row of three round action buttons.
 *
 * Presentation only. Every value and every action comes in through props from
 * OracleScreen, which already owns the live sky hooks and navigation — this
 * component computes nothing and decides nothing.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { RADIUS, SPACING } from '@theme/themes';
import TabIcon, { type IconName } from '@components/TabIcon';
import MandalaEmblem from './MandalaEmblem';

export interface HeroMetric {
  /** Stable id, also used for the testID. */
  key: string;
  label: string;
  /** The value to show; null renders an em dash (data not available yet). */
  value: string | null;
}

export interface HeroAction {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

interface HomeHeroProps {
  metrics: HeroMetric[];
  actions: HeroAction[];
}

const MANDALA_SIZE = 196;

const HomeHero: React.FC<HomeHeroProps> = ({ metrics, actions }) => {
  const colors = useColors();
  const typography = useTypography();

  return (
    <View style={styles.root} testID="home-hero">
      <View style={styles.mandalaWrap}>
        <MandalaEmblem size={MANDALA_SIZE} />
      </View>

      <View style={styles.metricRow}>
        {metrics.map(m => (
          <View
            key={m.key}
            testID={`home-hero-metric-${m.key}`}
            accessible
            accessibilityLabel={`${m.label}: ${m.value ?? '—'}`}
            style={[
              styles.capsule,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.borderAccent + '55' },
            ]}
          >
            <Text
              style={[typography('caption'), styles.capsuleLabel, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {m.label}
            </Text>
            <Text
              style={[typography('subheading'), styles.capsuleValue, { color: colors.goldBright }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {m.value ?? '—'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actionRow}>
        {actions.map(a => (
          <View key={a.key} style={styles.actionCol}>
            <Pressable
              testID={`home-hero-action-${a.key}`}
              onPress={a.onPress}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderAccent + '88',
                  shadowColor: colors.sacredGlow,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <TabIcon name={a.icon} color={colors.goldBright} size={22} />
            </Pressable>
            <Text
              style={[typography('caption'), styles.actionLabel, { color: colors.text }]}
              numberOfLines={1}
              importantForAccessibility="no"
            >
              {a.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginHorizontal: SPACING.xl,
    marginTop: 12,
    alignItems: 'center',
  },
  mandalaWrap: {
    marginBottom: 14,
  },
  metricRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
  },
  capsule: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  capsuleLabel: {
    fontSize: 11,
  },
  capsuleValue: {
    marginTop: 2,
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    marginTop: 18,
  },
  actionCol: {
    flex: 1,
    alignItems: 'center',
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionLabel: {
    marginTop: 6,
  },
});

export default HomeHero;
