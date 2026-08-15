/**
 * PremiumSurface — the "3D plaque" primitive for the premium UI pass.
 * --------------------------------------------------------------------------
 * Every card / row / CTA on the redesigned screens is built on this instead
 * of a bare `View`/`Pressable`. It layers four things that read as physical
 * depth rather than a flat tinted rectangle:
 *
 *   1. Ambient drop shadow  — soft, wide, low-opacity (the plaque floating
 *      above the manuscript page).
 *   2. Bevel edge           — a hairline lighter top border + darker bottom
 *      border, simulating light hitting a raised, engraved edge.
 *   3. Glass sheen           — a radial highlight anchored near the top
 *      (via GlowWash, the same SVG-radial-gradient trick GlowWash already
 *      uses to dodge the react-native-svg LinearGradient/Rect TS issue),
 *      plus a symmetric dark "depth well" near the bottom — together they
 *      read as a gently domed, glossy surface, matching HoraBadge's dome.
 *   4. Press response         — on `onPress`, a Reanimated spring scale-down
 *      (the plaque physically depresses) instead of a flat opacity fade.
 *
 * Purely a visual/interaction wrapper — it never owns navigation, data, or
 * business logic. Callers keep their own testID/accessibilityLabel/onPress,
 * this component just gives it a body.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useColors } from '@theme/ThemeProvider';
import CornerBrackets from '@components/home/CornerBrackets';
import GlowWash from '@components/home/GlowWash';
import { GlowView } from '@components/GlowView';

export type PremiumSurfaceVariant = 'plaque' | 'hero' | 'ghost';

export interface PremiumSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius — keep in sync with any inner `overflow:hidden` content. Default 18. */
  radius?: number;
  /** Visual weight. 'hero' adds an outer accent halo; 'ghost' drops shadow/sheen for quiet rows. */
  variant?: PremiumSurfaceVariant;
  /** Border/glow accent. Defaults to theme.colors.borderAccent. */
  accentColor?: string;
  /** Surface fill. Defaults to theme.colors.surface. */
  backgroundColor?: string;
  /** Draw the illuminated-manuscript corner brackets over the content. */
  brackets?: boolean;
  /** Draw the glass sheen + depth-well domed treatment. Default true. */
  depth?: boolean;
  /** Slow breathing pulse on the accent halo — reserve for the single most important CTA. */
  pulsing?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
  onLayout?: (e: { nativeEvent: { layout: { width: number; height: number } } }) => void;
}

const PressScale = 0.975;

export const PremiumSurface: React.FC<PremiumSurfaceProps> = ({
  children,
  style,
  radius = 18,
  variant = 'plaque',
  accentColor,
  backgroundColor,
  brackets = false,
  depth = true,
  pulsing = false,
  onPress,
  disabled = false,
  testID,
  accessibilityRole,
  accessibilityLabel,
  onLayout,
}) => {
  const colors = useColors();
  const accent = accentColor ?? colors.borderAccent;
  const fill = backgroundColor ?? colors.surface;
  const isGhost = variant === 'ghost';

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Sheen/depth-well SVGs need real pixel dimensions (GlowWash sizes its own
  // <Svg> canvas from width/height, it doesn't stretch to fill a parent) —
  // same measure-then-render pattern OracleScreen already uses for its
  // "Ask New Question" button wash.
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(PressScale, { damping: 18, stiffness: 260 });
  }, [scale]);
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
  }, [scale]);

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      setSize({ width, height });
      onLayout?.(e);
    },
    [onLayout],
  );

  const body = (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: fill,
          borderColor: accent + (isGhost ? '33' : '55'),
        },
        !isGhost && {
          shadowColor: '#000',
          shadowOpacity: variant === 'hero' ? 0.32 : 0.18,
          shadowRadius: variant === 'hero' ? 22 : 14,
          shadowOffset: { width: 0, height: variant === 'hero' ? 10 : 6 },
          elevation: variant === 'hero' ? 7 : 4,
        },
        onPress !== undefined && animatedStyle,
        style,
      ]}
    >
      {/* Bevel highlight — a lighter hairline along the top edge only, so the
          plaque reads as catching light from above (an engraved/raised edge). */}
      {depth && !isGhost && (
        <View
          pointerEvents="none"
          style={[styles.bevelTop, { borderTopColor: '#FFFFFF1C', borderRadius: radius }]}
        />
      )}

      {/* Glass sheen dome — soft highlight near the top, soft dark well near the
          bottom. Together they curve the flat rectangle into a gentle dome. */}
      {depth && !isGhost && size !== null && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GlowWash
            width={size.width}
            height={size.height}
            color="#FFFFFF"
            anchorX={0.5}
            anchorY={0.02}
            opacity={0.05}
          />
          <GlowWash
            width={size.width}
            height={size.height}
            color="#000000"
            anchorX={0.5}
            anchorY={0.98}
            opacity={0.16}
          />
        </View>
      )}

      {brackets && <CornerBrackets />}

      {children}
    </Animated.View>
  );

  const wrapped =
    onPress !== undefined ? (
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
        disabled={disabled}
        testID={testID}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        android_ripple={null}
        style={disabled ? styles.disabled : undefined}
      >
        {body}
      </Pressable>
    ) : (
      <View testID={testID}>{body}</View>
    );

  if (variant === 'hero') {
    return (
      <GlowView glowColor={accent} glowRadius={20} borderRadius={radius} pulsing={pulsing}>
        {wrapped}
      </GlowView>
    );
  }

  return wrapped;
};

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  bevelTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    borderTopWidth: 1,
  },
  disabled: {
    opacity: 0.55,
  },
});

export default PremiumSurface;
