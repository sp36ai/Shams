/**
 * HomeHero — the Home screen's one panel, filling the space between the
 * header and the tab bar edge to edge: a row of three metric capsules, the
 * gold mandala — which is also the Ask Shams button — and whatever the caller
 * puts below it (Home's tile grid and tier line).
 *
 * The capsules always read left to right in the order given, whatever the
 * app's layout direction: they are a timeline (sunrise, hora, sunset), and
 * the owner wants that order on screen in every language.
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
 * Colours, capsule and tile shapes and the emblem artwork follow the theme's
 * Home style (useHomeStyle).
 */

import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { SPACING } from '@theme/themes';
import MandalaEmblem from './MandalaEmblem';
import AstroMetricCapsule, { type MetricGlyph } from './AstroMetricCapsule';
import { useHomeStyle } from './homeStyle';

export interface HeroMetric {
  /** Stable id, also used for the testID. */
  key: string;
  label: string;
  glyph: MetricGlyph;
  /** The value to show; null renders an em dash (data not available yet). */
  value: string | null;
}

interface HomeHeroProps {
  metrics: HeroMetric[];
  /** Pressing the mandala asks Shams (after its lift animation). */
  onAsk: () => void;
  /** Screen-reader label for the mandala button. */
  askLabel: string;
  /** Shown below the mandala, inside the panel. */
  children?: React.ReactNode;
}

const PANEL_PADDING = 12;
const MANDALA_MAX = 320;
const MANDALA_MIN = 110;

const HomeHero: React.FC<HomeHeroProps> = ({ metrics, onAsk, askLabel, children }) => {
  const { palette: P } = useHomeStyle();
  const { width } = useWindowDimensions();
  // The emblem never exceeds the panel's inner width…
  const inner = width - SPACING.xl * 2;
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
    <View style={[styles.panel, { backgroundColor: P.midnight }]} testID="home-hero">
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

      <View style={styles.mandalaSlot} onLayout={onSlotLayout} testID="home-mandala-slot">
        {mandalaSize !== null && (
          <>
            {/* Ambient illumination behind the emblem */}
            <View pointerEvents="none" style={styles.ambient}>
              <Svg width={mandalaSize * 1.5} height={mandalaSize * 1.5}>
                <Defs>
                  <RadialGradient id="heroAmbient" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={P.deepTeal} stopOpacity={0.7} />
                    <Stop offset="100%" stopColor={P.midnight} stopOpacity={0} />
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
            <MandalaEmblem
              size={mandalaSize}
              testID="home-hero-action-ask"
              onPress={onAsk}
              accessibilityLabel={askLabel}
            />
          </>
        )}
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: PANEL_PADDING,
    paddingBottom: PANEL_PADDING,
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
    // Above the tiles, so the lift animation swells over them.
    zIndex: 2,
    elevation: 2,
  },
  ambient: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 12,
  },
});

export default HomeHero;
