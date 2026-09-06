/**
 * PressDepth — RN feasibility spike, NOT a production component.
 * ------------------------------------------------------------------
 * §19's tactile press-compression response. This one reproduces faithfully:
 * RN's Pressable + Reanimated shared values are a native fit for "scale down
 * slightly on press-in, spring back on release" — no browser-only technique
 * being approximated here, unlike GlassSurface's blur gap.
 */
import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PressDepthProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function PressDepth({ children, onPress, style }: PressDepthProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
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
