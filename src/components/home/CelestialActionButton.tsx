/**
 * CelestialActionButton — a round deep-teal button with a thin antique-gold
 * rim, a faint inner ring and a label below. Used for the Home hero's actions.
 *
 * Presentation only: the action itself is an existing route passed in by the
 * screen. Colours are the hero's fixed Midnight Celestial palette.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTypography } from '@theme/useTypography';
import TabIcon, { type IconName } from '@components/TabIcon';
import { CELESTIAL } from './celestialPalette';

interface CelestialActionButtonProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  testID?: string;
}

const SIZE = 58;

const CelestialActionButton: React.FC<CelestialActionButtonProps> = ({
  label,
  icon,
  onPress,
  testID,
}) => {
  const typography = useTypography();
  return (
    <View style={styles.col}>
      <Pressable
        testID={testID}
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.btn,
          { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        {/* Lit dome: lighter teal at the top-centre, falling to midnight at the rim */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient id="btnDome" cx="50%" cy="35%" rx="65%" ry="65%">
                <Stop offset="0%" stopColor="#1C4459" stopOpacity={1} />
                <Stop offset="60%" stopColor={CELESTIAL.deepTeal} stopOpacity={1} />
                <Stop offset="100%" stopColor={CELESTIAL.midnight} stopOpacity={1} />
              </RadialGradient>
            </Defs>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill="url(#btnDome)" />
          </Svg>
        </View>
        <View pointerEvents="none" style={styles.innerRing} />
        <TabIcon name={icon} color={CELESTIAL.champagne} size={22} />
      </Pressable>
      <Text
        style={[typography('caption'), styles.label, { color: CELESTIAL.ivory }]}
        numberOfLines={1}
        importantForAccessibility="no"
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  col: {
    flex: 1,
    alignItems: 'center',
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: CELESTIAL.antiqueGold,
    backgroundColor: CELESTIAL.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  innerRing: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: SIZE / 2 - 3,
    borderWidth: 1,
    borderColor: CELESTIAL.champagne + '40',
  },
  label: {
    marginTop: 7,
    opacity: 0.9,
  },
});

export default CelestialActionButton;
