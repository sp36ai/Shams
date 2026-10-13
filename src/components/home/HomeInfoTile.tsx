/**
 * HomeInfoTile — one small gold-rimmed tile in the Home hero's grid: a short
 * eyebrow label over a one- or two-line headline. Pressing it opens the full
 * text (OracleScreen owns the detail sheet and every value shown here).
 *
 * Uses the fixed Midnight Celestial palette, like the rest of the hero.
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTypography } from '@theme/useTypography';
import { CELESTIAL } from './celestialPalette';

interface HomeInfoTileProps {
  testID?: string;
  label: string;
  headline: string;
  onPress: () => void;
}

const HomeInfoTile: React.FC<HomeInfoTileProps> = ({ testID, label, headline, onPress }) => {
  const typography = useTypography();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${headline}`}
    >
      <Text
        style={[typography('label'), styles.label]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={[typography('caption'), styles.headline]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {headline}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 54,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CELESTIAL.antiqueGold + '80',
    backgroundColor: CELESTIAL.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  label: {
    color: CELESTIAL.antiqueGold,
    fontSize: 9,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  headline: {
    color: CELESTIAL.ivory,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default HomeInfoTile;
