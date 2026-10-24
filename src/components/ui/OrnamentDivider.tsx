/**
 * OrnamentDivider — a thin gold rule that fades out at both ends, with a small
 * jewelled diamond at its centre. Separates the header from content and, in
 * later phases, sections within screens. Decorative; hidden from screen
 * readers. Colours come from the active theme.
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';

interface OrnamentDividerProps {
  style?: StyleProp<ViewStyle>;
}

const OrnamentDivider: React.FC<OrnamentDividerProps> = ({ style }) => {
  const colors = useColors();
  const rule = (id: string, fadeFrom: 'left' | 'right'): React.JSX.Element => (
    <View style={styles.ruleWrap}>
      <Svg width="100%" height={2}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.gold} stopOpacity={fadeFrom === 'left' ? 0 : 0.9} />
            <Stop offset="1" stopColor={colors.gold} stopOpacity={fadeFrom === 'left' ? 0.9 : 0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0.5} width="100%" height={1} fill={`url(#${id})`} />
      </Svg>
    </View>
  );

  return (
    <View
      style={[styles.row, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="ornament-divider"
    >
      {rule('dividerLeft', 'left')}
      <View
        style={[
          styles.diamond,
          {
            backgroundColor: colors.goldBright,
            borderColor: colors.gold,
            shadowColor: colors.goldBright,
          },
        ]}
      />
      {rule('dividerRight', 'right')}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleWrap: {
    flex: 1,
    height: 2,
    justifyContent: 'center',
  },
  diamond: {
    width: 7,
    height: 7,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
});

export default OrnamentDivider;
