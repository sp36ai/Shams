/**
 * PressDepth — production tactile press-compression primitive.
 * --------------------------------------------------------------------------
 * `Pressable` + Reanimated `withSpring` scale — a technique that ports
 * faithfully from the browser prototype to RN (unlike glass/blur), confirmed
 * during the RN feasibility spike on the redesign branch.
 */
import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface PressDepthProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean };
  testID?: string;
}

export function PressDepth({
  children,
  onPress,
  disabled,
  style,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  testID,
}: PressDepthProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 18, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 220 });
      }}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
