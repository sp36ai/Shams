/**
 * PremiumSurface — the app-wide "lit panel": a theme surface with a soft top
 * sheen, a darker lower edge, a gold hairline rim with a faint inner rim, and
 * a deep drop shadow. It is the material behind Home's cards and, in later
 * phases, every other screen's cards and panels.
 *
 * Built only from theme tokens (surface, borderAccent, text), so every theme
 * gets the same depth in its own colours.
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { RADIUS } from '@theme/themes';

interface PremiumSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius; defaults to RADIUS.xl. */
  radius?: number;
  testID?: string;
}

const PremiumSurface: React.FC<PremiumSurfaceProps> = ({
  children,
  style,
  radius = RADIUS.xl,
  testID,
}) => {
  const colors = useColors();
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: colors.surface,
          borderColor: colors.borderAccent + '80',
        },
        style,
      ]}
    >
      {/* Light falls from above: a sheen on the top half, shade at the foot. */}
      <View pointerEvents="none" style={[styles.lightLayer, { borderRadius: radius }]}>
        <View style={[styles.sheen, { backgroundColor: colors.text + '0D' }]} />
        <View style={styles.shade} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.innerRim,
          { borderRadius: Math.max(0, radius - 3), borderColor: colors.borderAccent + '26' },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  lightLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  shade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: '#00000033',
  },
  innerRim: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 1,
  },
});

export default PremiumSurface;
