/**
 * GlassCard — a passive (non-Pressable) surface with the same self-measuring
 * GlassPanel finish that Tilt3DCard applies to interactive cards. Use this
 * for display-only content (readouts, informational panels) where a tilt
 * response would misleadingly imply the card is tappable.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import GlassPanel from './GlassPanel';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tint for the glass finish. Usually colors.goldBright or colors.text. */
  glassTint: string;
  testID?: string;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, style, glassTint, testID }) => {
  const [size, setSize] = useState({ width: 1, height: 1 });

  const handleLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View testID={testID} style={[styles.base, style]} onLayout={handleLayout}>
      <GlassPanel width={size.width} height={size.height} tint={glassTint} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export default GlassCard;
