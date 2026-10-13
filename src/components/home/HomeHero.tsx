/**
 * HomeHero — the Home screen's one panel: the gold mandala on a midnight
 * panel, a row of three metric capsules, a row of three round actions, and
 * whatever the caller puts below them (Home's tile grid and tier line).
 *
 * Home is meant to fit on one screen without scrolling, so the panel fills
 * the height it is given and the mandala takes whatever height is left once
 * everything else is laid out (never larger than MANDALA_MAX or the panel
 * width, never smaller than MANDALA_MIN; below that the screen scrolls).
 *
 * Presentation only. Every value and every action comes in through props from
 * OracleScreen, which already owns the live sky hooks and navigation — this
 * component computes nothing and decides nothing.
 *
 * The hero always uses the fixed Midnight Celestial palette (see
 * celestialPalette.ts), in every theme; the rest of Home keeps the user's
 * chosen theme.
 */

import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
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
  /** Shown below the action row, inside the panel. */
  children?: React.ReactNode;
}

const PANEL_PADDING = 14;
const MANDALA_MAX = 320;
const MANDALA_MIN = 110;

const HomeHero: React.FC<HomeHeroProps> = ({ metrics, actions, children }) => {
  const { width } = useWindowDimensions();
  // The emblem never exceeds the panel's inner width…
  const inner = width - SPACING.xl * 2 - PANEL_PADDING * 2;
  const widthLimit = Math.min(MANDALA_MAX, Math.round(inner * 0.92));
  // …nor the height left for it, measured from its flexible slot.
  const [slotHeight, setSlotHeight] = useState<number | null>(null);
  const onSlotLayout = (e: LayoutChangeEvent): void => {
    const h = Math.round(e.nativeEvent.layout.height);
    setSlotHeight(prev => (prev === h ? prev : h));
  };
  const mandalaSize =
    slotHeight === null ? null : Math.max(MANDALA_MIN, Math.min(widthLimit, slotHeight));

  return (
    <View style={styles.panel} testID="home-hero">
      <View style={styles.mandalaSlot} onLayout={onSlotLayout}>
        {mandalaSize !== null && (
          <>
            {/* Ambient illumination behind the emblem */}
            <View pointerEvents="none" style={styles.ambient}>
              <Svg width={mandalaSize * 1.5} height={mandalaSize * 1.5}>
                <Defs>
                  <RadialGradient id="heroAmbient" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={CELESTIAL.deepTeal} stopOpacity={0.7} />
                    <Stop offset="100%" stopColor={CELESTIAL.midnight} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle
                  cx={mandalaSize * 0.75}
                  cy={mandalaSize * 0.75}
                  r={mandalaSize * 0.75}
                  fill="url(#heroAmbient)"
                />
              </Svg>
            </View>
            <MandalaEmblem size={mandalaSize} />
          </>
        )}
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

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flexGrow: 1,
    marginHorizontal: SPACING.xl,
    marginTop: 10,
    paddingHorizontal: PANEL_PADDING,
    paddingTop: PANEL_PADDING,
    paddingBottom: PANEL_PADDING,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CELESTIAL.bronze,
    backgroundColor: CELESTIAL.midnight,
    overflow: 'hidden',
    alignItems: 'center',
  },
  mandalaSlot: {
    flex: 1,
    minHeight: MANDALA_MIN,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ambient: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 12,
  },
});

export default HomeHero;
