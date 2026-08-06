/**
 * CornerBrackets — four small illuminated-manuscript corner accents,
 * absolutely positioned over a card's corners. Purely decorative; drop as a
 * sibling of a card's content inside a `position: 'relative'` card.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';

const SIZE = 14;
const THICKNESS = StyleSheet.hairlineWidth * 2;
const INSET = 8;

const CornerBrackets: React.FC = () => {
  const colors = useColors();
  const color = colors.borderAccent;

  return (
    <>
      <View
        pointerEvents="none"
        style={[styles.corner, styles.topLeft, { borderColor: color, top: INSET, left: INSET }]}
      />
      <View
        pointerEvents="none"
        style={[styles.corner, styles.topRight, { borderColor: color, top: INSET, right: INSET }]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.corner,
          styles.bottomLeft,
          { borderColor: color, bottom: INSET, left: INSET },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.corner,
          styles.bottomRight,
          { borderColor: color, bottom: INSET, right: INSET },
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    opacity: 0.55,
  },
  topLeft: {
    borderLeftWidth: THICKNESS,
    borderTopWidth: THICKNESS,
  },
  topRight: {
    borderRightWidth: THICKNESS,
    borderTopWidth: THICKNESS,
  },
  bottomLeft: {
    borderLeftWidth: THICKNESS,
    borderBottomWidth: THICKNESS,
  },
  bottomRight: {
    borderRightWidth: THICKNESS,
    borderBottomWidth: THICKNESS,
  },
});

export default CornerBrackets;
