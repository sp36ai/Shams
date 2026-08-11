/**
 * Tilt3DCard — a Pressable surface that reacts to touch like a physical
 * beveled panel: on press-in it tilts away from the touch point on a
 * perspective transform (rotateX/rotateY) and lifts on `scale`, then springs
 * back on release. Combined with a drop shadow that grows/shrinks in sync,
 * this reads as a tangible 3D card rather than a flat rectangle with an
 * opacity change.
 *
 * Deliberately built on Pressable + Reanimated shared values (the pattern
 * already used by GlowView) rather than react-native-gesture-handler's
 * GestureDetector — this project has no <GestureHandlerRootView> mounted at
 * the app root yet, so PanGestureHandler-based tilt-while-dragging is out of
 * scope here. The press-in/press-out tilt gives the same "premium 3D" read
 * for taps, which is the vast majority of this app's interactions.
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import GlassPanel from './GlassPanel';
import SpecularSheen from './SpecularSheen';

interface Tilt3DCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Max tilt in degrees. Default 6 — subtle, premium, not gimmicky. */
  tiltDeg?: number;
  /** Disable interaction while still rendering the resting 3D pose. */
  disabled?: boolean;
  testID?: string;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
  /**
   * Tint for an internally-rendered GlassPanel finish, sized to this card's
   * own measured layout. Omit for a plain card (no glass overlay).
   */
  glassTint?: string;
  /**
   * Color for an internally-rendered SpecularSheen sweep. Omit for none —
   * reserve for the screen's one or two highest-value CTAs.
   */
  sheenColor?: string;
  /** Loop the sheen instead of a single sweep on mount. Default false. */
  sheenLoop?: boolean;
}

const SPRING_CONFIG = { damping: 16, stiffness: 220, mass: 0.6 };

const Tilt3DCard: React.FC<Tilt3DCardProps> = ({
  children,
  onPress,
  onLayout,
  style,
  tiltDeg = 6,
  disabled = false,
  testID,
  accessibilityRole,
  accessibilityLabel,
  glassTint,
  sheenColor,
  sheenLoop = false,
}) => {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const pressDepth = useSharedValue(0);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled) {
        return;
      }
      const { locationX, locationY } = e.nativeEvent;
      // Tilt direction points AWAY from the touch — pressing the top-left
      // corner lifts the bottom-right, like tipping a physical tile.
      const nx = size.width > 0 ? locationX / size.width - 0.5 : 0;
      const ny = size.height > 0 ? locationY / size.height - 0.5 : 0;
      rotateX.value = withSpring(ny * tiltDeg, SPRING_CONFIG);
      rotateY.value = withSpring(-nx * tiltDeg, SPRING_CONFIG);
      pressDepth.value = withSpring(1, SPRING_CONFIG);
    },
    [disabled, size, tiltDeg, rotateX, rotateY, pressDepth],
  );

  const handlePressOut = useCallback(() => {
    rotateX.value = withSpring(0, SPRING_CONFIG);
    rotateY.value = withSpring(0, SPRING_CONFIG);
    pressDepth.value = withSpring(0, SPRING_CONFIG);
  }, [rotateX, rotateY, pressDepth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: 1 - pressDepth.value * 0.015 },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID={testID}
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ width, height });
          onLayout?.(e);
        }}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        style={[style, disabled && styles.disabled]}
      >
        {glassTint !== undefined && (
          <GlassPanel width={size.width} height={size.height} tint={glassTint} />
        )}
        {sheenColor !== undefined && (
          <SpecularSheen
            width={size.width}
            height={size.height}
            color={sheenColor}
            loop={sheenLoop}
          />
        )}
        {children}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Deliberately no `overflow: 'hidden'` here: several callers (e.g. the
  // Oracle home hero card) rely on an unclipped drop shadow, and iOS clips
  // shadows to a view's bounds once overflow is hidden. Callers that need
  // the internal GlassPanel/SpecularSheen clipped to their border radius —
  // and have no shadow to lose — add `overflow: 'hidden'` to their own
  // `style` prop instead.
  disabled: {
    opacity: 0.5,
  },
});

export default Tilt3DCard;
