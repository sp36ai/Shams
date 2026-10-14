/**
 * AstroMetricCapsule — one column of the Home hero's metric row: a small gold
 * glyph and label over a rounded deep-teal capsule holding the value.
 *
 * Presentation only: the value comes from the screen's existing sky hooks.
 * A null value shows an em dash ("not available yet"), never a placeholder
 * number. Colours and shape come from the theme's Home style: a rounded
 * pill, a round medallion or an arch-top tablet.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTypography } from '@theme/useTypography';
import { RADIUS, type HomePalette, type HomeStyle } from '@theme/themes';
import { useHomeStyle } from './homeStyle';

export type MetricGlyph = 'hora' | 'sunrise' | 'sunset';

const GLYPH = 14;

/** Small line glyphs: an hourglass, and a sun on the horizon with an arrow. */
const Glyph: React.FC<{ kind: MetricGlyph; color: string }> = ({ kind, color }) => {
  const stroke = { stroke: color, strokeWidth: 1.2, fill: 'none' } as const;
  if (kind === 'hora') {
    return (
      <Svg width={GLYPH} height={GLYPH} viewBox="0 0 14 14">
        <Path
          d="M3,1.5 H11 M3,12.5 H11 M4,1.5 C4,5 7,6 7,7 C7,8 4,9 4,12.5 M10,1.5 C10,5 7,6 7,7 C7,8 10,9 10,12.5"
          {...stroke}
        />
      </Svg>
    );
  }
  const up = kind === 'sunrise';
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 14 14">
      <Path d="M1,10.5 H13" {...stroke} />
      <Path d="M3.5,10.5 A3.5,3.5 0 0 1 10.5,10.5" {...stroke} />
      <Path
        d={up ? 'M7,5 V1.5 M5.5,3 L7,1.5 L8.5,3' : 'M7,1.5 V5 M5.5,3.5 L7,5 L8.5,3.5'}
        {...stroke}
      />
    </Svg>
  );
};

interface AstroMetricCapsuleProps {
  label: string;
  value: string | null;
  glyph: MetricGlyph;
  testID?: string;
}

const AstroMetricCapsule: React.FC<AstroMetricCapsuleProps> = ({ label, value, glyph, testID }) => {
  const typography = useTypography();
  const { palette: P, capsule } = useHomeStyle();
  const styles = useMemo(() => makeStyles(P, capsule), [P, capsule]);
  const shown = value ?? '—';
  return (
    <View style={styles.col} testID={testID} accessible accessibilityLabel={`${label}: ${shown}`}>
      <View style={styles.labelRow}>
        <Glyph kind={glyph} color={P.antiqueGold} />
        <Text style={[typography('caption'), styles.label, { color: P.ivory }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.capsule}>
        <View pointerEvents="none" style={styles.capsuleHighlight} />
        <View pointerEvents="none" style={styles.capsuleShade} />
        <Text
          style={[typography('subheading'), styles.value, { color: P.champagne }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {shown}
        </Text>
      </View>
    </View>
  );
};

/** Shape of the value holder for each capsule style. */
const SHAPES: Record<HomeStyle['capsule'], object> = {
  pill: { alignSelf: 'stretch', borderRadius: RADIUS.pill, paddingVertical: 9 },
  // A round coin: as wide as it is tall.
  medallion: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
  },
  // A mihrab-like tablet: round arch on top, nearly square at the foot.
  tablet: {
    alignSelf: 'stretch',
    paddingTop: 12,
    paddingBottom: 8,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
};

const makeStyles = (P: HomePalette, capsuleStyle: HomeStyle['capsule']) =>
  StyleSheet.create({
    col: {
      flex: 1,
      alignItems: 'center',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 6,
      maxWidth: '100%',
    },
    label: {
      fontSize: 11.5,
      opacity: 0.85,
      flexShrink: 1,
    },
    capsule: {
      alignItems: 'center',
      paddingHorizontal: 8,
      ...SHAPES[capsuleStyle],
      borderWidth: 1.2,
      borderColor: P.antiqueGold + 'B3',
      backgroundColor: P.deepTeal,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    // A soft lighter top half and a darker lower edge give the capsule depth.
    capsuleHighlight: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      backgroundColor: P.ivory + '12',
    },
    capsuleShade: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '35%',
      backgroundColor: '#00000040',
    },
    value: {
      fontSize: 16,
      fontVariant: ['tabular-nums'],
    },
  });

export default AstroMetricCapsule;
