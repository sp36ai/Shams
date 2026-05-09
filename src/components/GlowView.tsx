/**
 * GlowView — wraps children with a themed luminous halo.
 *
 * On iOS: drives a colored drop-shadow via shadowColor + shadowRadius.
 * On Android: a low-opacity back-plate (elevation + tinted rgba overlay)
 * approximates the glow because Android ignores non-black shadowColor.
 *
 * Optional `pulsing` flag drives the glow opacity with a slow Reanimated
 * heartbeat — useful for the recommended PremiumScreen tier card, etc.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface GlowViewProps {
  /** The halo color. Pass a fully-opaque hex or rgba — alpha added internally. */
  glowColor: string;
  /** How far the glow extends beyond the card edges in px. Default 14. */
  glowRadius?: number;
  /** Card border-radius so the glow plate matches the card shape. Default 12. */
  borderRadius?: number;
  /** Enable slow pulsing heartbeat animation on the glow. Default false. */
  pulsing?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

export const GlowView: React.FC<GlowViewProps> = ({
  glowColor,
  glowRadius = 14,
  borderRadius = 12,
  pulsing = false,
  style,
  children,
}) => {
  const glowOpacity = useSharedValue(pulsing ? 0.4 : 1);

  useEffect(() => {
    if (!pulsing) {
      return;
    }
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulsing, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const spread = glowRadius / 2;

  return (
    <View style={[styles.container, style]}>
      {/* Glow plate — sits behind the card, extends outward */}
      <Animated.View
        pointerEvents="none"
        style={[
          glowStyle,
          {
            position: 'absolute',
            top: -spread,
            left: -spread,
            right: -spread,
            bottom: -spread,
            borderRadius: borderRadius + spread,
            backgroundColor: glowColor + '1A', // ~10% alpha fill for Android
            // iOS colored shadow
            shadowColor: glowColor,
            shadowRadius: glowRadius,
            shadowOpacity: 0.75,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
});
