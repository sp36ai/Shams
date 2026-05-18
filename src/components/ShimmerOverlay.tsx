/**
 * ShimmerOverlay — animated glint sweep across a parent container.
 *
 * Place inside any `overflow: 'hidden'` container as a sibling of the content.
 * The sweep fires once every `periodMs` milliseconds.
 *
 * Usage:
 *   <View style={{ overflow: 'hidden', borderRadius: 12 }}>
 *     <YourContent />
 *     <ShimmerOverlay width={cardWidth} periodMs={3500} />
 *   </View>
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface ShimmerOverlayProps {
  /** Width of the parent container — needed to calculate the sweep end point. */
  width: number;
  /** Colour of the glint stripe. Defaults to near-white at low opacity. */
  color?: string;
  /** Width of the sweeping stripe in px. Default 90. */
  stripeWidth?: number;
  /** Milliseconds between successive sweeps. Default 3500. */
  periodMs?: number;
  /** Sweep animation duration in ms. Default 900. */
  sweepMs?: number;
  /** Set true to skip rendering (e.g. on older devices). */
  disabled?: boolean;
}

const ShimmerOverlay: React.FC<ShimmerOverlayProps> = ({
  width,
  color = 'rgba(255, 255, 255, 0.10)',
  stripeWidth = 90,
  periodMs = 3500,
  sweepMs = 900,
  disabled = false,
}) => {
  const translateX = useRef(new Animated.Value(-stripeWidth)).current;

  useEffect(() => {
    if (disabled || width <= 0) {
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(periodMs),
        Animated.timing(translateX, {
          toValue: width + stripeWidth,
          duration: sweepMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -stripeWidth,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [width, periodMs, sweepMs, disabled, stripeWidth, translateX]);

  if (disabled || width <= 0) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.stripe,
          {
            width: stripeWidth,
            backgroundColor: color,
            borderRadius: stripeWidth / 2,
            shadowColor: '#FFFFFF',
            shadowOpacity: 0.14,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
            opacity: 0.92,
            transform: [{ translateX }, { skewX: '-18deg' }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.stripe,
          {
            width: stripeWidth * 0.6,
            backgroundColor: color,
            borderRadius: stripeWidth / 2,
            opacity: 0.18,
            transform: [{ translateX }, { skewX: '-18deg' }, { translateY: 12 }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  stripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});

export default ShimmerOverlay;
