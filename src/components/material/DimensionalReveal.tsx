/**
 * DimensionalReveal — production verdict-arrival transition.
 * --------------------------------------------------------------------------
 * Wraps the reading result the moment it settles into the conversation:
 * scale + opacity animate the settle, matching the browser prototype's own
 * `cubic-bezier(.16,1,.3,1)` signature curve as closely as Reanimated's
 * Easing API allows. No `translateZ` — confirmed absent from this RN
 * version's transform type during the feasibility spike; depth here is
 * expressed through scale + opacity only, exactly as that spike's own
 * `DimensionalReveal.tsx` already established.
 *
 * Plays once, on mount, per reading — a reading that's already settled
 * (returning to a thread from history, for instance) renders at rest
 * immediately, never replaying the arrival for content that already exists.
 *
 * Also fires the app's one reserved verdict haptic (§08) — independent of
 * the reduced-motion branch below: a seeker who has disabled animation still
 * feels the verdict arrive, since haptics and visual motion are separate
 * channels or capacity, not the same accessibility concern.
 */
import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AccessibilityInfo } from 'react-native';

import { fireVerdictHaptic } from '@utils/haptics';

export interface DimensionalRevealProps {
  children: React.ReactNode;
  /** False for content that already existed before this render (e.g. a
   * cached thread reopened from history) — it must appear settled, not
   * replay its own arrival every time the screen mounts. */
  animate?: boolean;
}

export function DimensionalReveal({ children, animate = true }: DimensionalRevealProps) {
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      return;
    }
    fireVerdictHaptic();
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduced => {
        if (cancelled) {
          return;
        }
        progress.value = withTiming(1, {
          duration: reduced ? 120 : 420,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
      })
      .catch(() => {
        progress.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.16, 1, 0.3, 1) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- progress is a stable shared value
  }, [animate]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.96 + progress.value * 0.04 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
