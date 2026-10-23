/**
 * HomeInfoTile — one tile in the Home panel: a short eyebrow label over a
 * one- or two-line headline. Pressing it opens the full text (OracleScreen
 * owns the detail sheet and every value shown here).
 *
 * Colours, shape and alignment come from the theme's Home style:
 *   rounded  soft cards (the default)
 *   arch     mihrab arches — round top, nearly square foot
 *   facet    cut corners with a fine inner rim
 * In the 'grid' layout tiles are centred, three to a row; in the 'list'
 * layout they are start-aligned, two to a row.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTypography } from '@theme/useTypography';
import type { HomePalette, HomeStyle } from '@theme/themes';
import { useHomeStyle } from './homeStyle';

interface HomeInfoTileProps {
  testID?: string;
  label: string;
  headline: string;
  onPress: () => void;
}

const HomeInfoTile: React.FC<HomeInfoTileProps> = ({ testID, label, headline, onPress }) => {
  const typography = useTypography();
  const { palette: P, tileShape, tileLayout } = useHomeStyle();
  const styles = useMemo(() => makeStyles(P, tileShape, tileLayout), [P, tileShape, tileLayout]);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${headline}`}
    >
      {tileShape === 'facet' && <View pointerEvents="none" style={styles.innerRim} />}
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

const SHAPES: Record<HomeStyle['tileShape'], object> = {
  rounded: { borderRadius: 12 },
  arch: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    paddingTop: 10,
  },
  facet: { borderRadius: 3 },
};

const makeStyles = (
  P: HomePalette,
  shape: HomeStyle['tileShape'],
  layout: HomeStyle['tileLayout'],
) => {
  const centred = layout === 'grid';
  return StyleSheet.create({
    tile: {
      flexBasis: centred ? '31%' : '47%',
      flexGrow: 1,
      minHeight: 54,
      paddingHorizontal: centred ? 8 : 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: P.antiqueGold + '80',
      backgroundColor: P.deepTeal,
      alignItems: centred ? 'center' : 'flex-start',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
      ...SHAPES[shape],
    },
    innerRim: {
      ...StyleSheet.absoluteFillObject,
      margin: 3,
      borderRadius: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: P.antiqueGold + '59',
    },
    label: {
      color: P.antiqueGold,
      fontSize: 9,
      letterSpacing: 0.6,
      textAlign: centred ? 'center' : 'auto',
    },
    headline: {
      color: P.ivory,
      fontSize: 13,
      lineHeight: 17,
      marginTop: 4,
      textAlign: centred ? 'center' : 'auto',
    },
  });
};

export default HomeInfoTile;
