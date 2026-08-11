/**
 * DepthPressable — a button surface with a visible "resting height": a solid
 * lower plate offset behind the pressable face. On press the face travels
 * down into the plate and the drop shadow collapses, then springs back on
 * release — the classic tactile "keycap" 3D button read, used for the app's
 * primary CTAs (Ask New Question, purchase buttons).
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface DepthPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Color of the lower plate (the "shadow ledge"). Usually a darkened accent. */
  plateColor: string;
  /** How far the face travels on press, px. Default 4. */
  liftHeight?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
}

const DepthPressable: React.FC<DepthPressableProps> = ({
  children,
  onPress,
  plateColor,
  liftHeight = 4,
  borderRadius = 18,
  style,
  disabled = false,
  testID,
  accessibilityRole,
  accessibilityLabel,
}) => {
  const pressed = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: 90 });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: 140 });
  }, [pressed]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * liftHeight }],
  }));

  return (
    <View style={[styles.wrap, { borderRadius }, style]}>
      {/* Lower plate — stays fixed, gives the resting elevation its shadow ledge. */}
      <View
        pointerEvents="none"
        style={[styles.plate, { backgroundColor: plateColor, borderRadius, top: liftHeight }]}
      />
      <Animated.View style={faceStyle}>
        <Pressable
          testID={testID}
          onPress={disabled ? undefined : onPress}
          onPressIn={disabled ? undefined : handlePressIn}
          onPressOut={disabled ? undefined : handlePressOut}
          disabled={disabled}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          style={[styles.face, { borderRadius }, disabled && styles.disabled]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  plate: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.9,
  },
  face: {
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default DepthPressable;
