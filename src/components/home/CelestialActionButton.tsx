/**
 * CelestialActionButton — a round deep-teal button with a thin antique-gold
 * rim, a faint inner ring and a label below. Used for the Home hero's actions.
 *
 * Presentation only: the action itself is an existing route passed in by the
 * screen. Colours are the hero's fixed Midnight Celestial palette.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    borderWidth: 1,
    borderColor: CELESTIAL.antiqueGold,
    backgroundColor: CELESTIAL.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CELESTIAL.antiqueGold,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  innerRing: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: SIZE / 2 - 3,
    borderWidth: 1,
    borderColor: CELESTIAL.champagne + '2E',
  },
  label: {
    marginTop: 7,
    opacity: 0.9,
  },
});

export default CelestialActionButton;
