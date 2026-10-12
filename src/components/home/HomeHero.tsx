/**
 * HomeHero — the top of the Home screen: the gold mandala on a midnight
 * panel, a row of three metric capsules and a row of three round actions.
 *
 * Presentation only. Every value and every action comes in through props from
 * OracleScreen, which already owns the live sky hooks and navigation — this
 * component computes nothing and decides nothing.
 *
 * The hero always uses the fixed Midnight Celestial palette (see
 * celestialPalette.ts), in every theme; the rest of Home keeps the user's
 * chosen theme.
 */

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { RADIUS, SPACING } from '@theme/themes';
import type { IconName } from '@components/TabIcon';
import MandalaEmblem from './MandalaEmblem';
import AstroMetricCapsule, { type MetricGlyph } from './AstroMetricCapsule';
import CelestialActionButton from './CelestialActionButton';
import { CELESTIAL } from './celestialPalette';

export interface HeroMetric {
  /** Stable id, also used for the testID. */
  key: string;
  label: string;
  glyph: MetricGlyph;
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

const PANEL_PADDING = 16;
const MANDALA_MAX = 300;

const HomeHero: React.FC<HomeHeroProps> = ({ metrics, actions }) => {
  const { width } = useWindowDimensions();
  // Scale the emblem with the screen, leaving the panel's gutters clear.
  const inner = width - SPACING.xl * 2 - PANEL_PADDING * 2;
  const mandalaSize = Math.max(160, Math.min(MANDALA_MAX, Math.round(inner * 0.86)));
  const panelWidth = width - SPACING.xl * 2;

  return (
    <View style={styles.panel} testID="home-hero">
      {/* Ambient illumination behind the emblem */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={panelWidth} height={mandalaSize + 80}>
          <Defs>
            <RadialGradient id="heroAmbient" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={CELESTIAL.deepTeal} stopOpacity={1} />
              <Stop offset="100%" stopColor={CELESTIAL.midnight} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={panelWidth / 2}
            cy={PANEL_PADDING + mandalaSize / 2}
            r={mandalaSize * 0.75}
            fill="url(#heroAmbient)"
          />
        </Svg>
      </View>

      <View style={styles.mandalaWrap}>
        <MandalaEmblem size={mandalaSize} />
      </View>

      <View style={styles.metricRow}>
        {metrics.map(m => (
          <AstroMetricCapsule
            key={m.key}
            testID={`home-hero-metric-${m.key}`}
            label={m.label}
            value={m.value}
            glyph={m.glyph}
          />
        ))}
      </View>

      <View style={styles.actionRow}>
        {actions.map(a => (
          <CelestialActionButton
            key={a.key}
            testID={`home-hero-action-${a.key}`}
            label={a.label}
            icon={a.icon}
            onPress={a.onPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: SPACING.xl,
    marginTop: 12,
    paddingHorizontal: PANEL_PADDING,
    paddingTop: PANEL_PADDING,
    paddingBottom: 18,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CELESTIAL.bronze,
    backgroundColor: CELESTIAL.midnight,
    overflow: 'hidden',
    alignItems: 'center',
  },
  mandalaWrap: {
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 18,
  },
});

export default HomeHero;
