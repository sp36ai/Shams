/**
 * FloatingLayer — wraps children in a slow, continuous vertical bob plus a
 * hint of rotation, like an object hanging in zero-gravity rather than
 * pinned flat to the screen. Cheap ambient depth cue for hero emblems
 * (seals, badges, the Manzil compass-rose) — do not use on dense text
 * blocks or anything the eye needs to read precisely.
 */

import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface FloatingLayerProps {
  children: React.ReactNode;
  /** Vertical travel in px, peak-to-peak is 2x this. Default 5. */
  amplitude?: number;
  /** One full up-down cycle, ms. Default 3200. */
  periodMs?: number;
  /** Also add a very slight rocking rotation. Default true. */
  rock?: boolean;
}

const FloatingLayer: React.FC<FloatingLayerProps> = ({
  children,
  amplitude = 5,
  periodMs = 3200,
  rock = true,
}) => {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: periodMs / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: periodMs / 2, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [periodMs, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -amplitude + t.value * amplitude * 2 },
      { rotate: rock ? `${-1.5 + t.value * 3}deg` : '0deg' },
    ],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default FloatingLayer;
