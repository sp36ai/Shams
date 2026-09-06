/**
 * Button — the app's one shared action control.
 * --------------------------------------------------------------------------
 * Mirrors the Figma `Button` component set (Components page, Oracle UI file):
 * Style=Primary|Secondary|Ghost × Size=Large|Medium × State=Default|Pressed|
 * Disabled|Loading. The Pressed/Disabled/Loading states in Figma are visual
 * references for that spec — here they're driven live from Pressable's own
 * `pressed` render-prop and the `disabled`/`loading` props, not separate
 * variants to pick between.
 *
 * Fill is bound to `colors.primary` / `colors.textOnPrimary`, not
 * `colors.gold` — the two diverge in Layl al-Baḥr and Sirr al-Banafsaj, and
 * every existing screen (Auth, Onboarding, Premium, LocationPermission) binds
 * its CTA to `primary`. Matching that is a correctness requirement, not a
 * style choice: a gold-bound button would show the wrong color in exactly
 * those two themes.
 *
 * This replaces the divergent inline CTA styles those four screens carried
 * — different radii (20 / 16 / RADIUS.xl), different shadows, one fixed
 * height vs. two padding-based. See docs/FIGMA_DESIGN_PARITY.md.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { RADIUS, SPACING, ELEVATION } from '@theme/themes';

export type ButtonStyle = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'large' | 'medium';

export interface ButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  style?: ButtonStyle;
  size?: ButtonSize;
  disabled?: boolean;
  /** Swaps the label for a spinner and forces the disabled interaction state. */
  loading?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Overrides the fill (style="primary") or label (style="secondary"/"ghost")
   * color for a fixed brand accent that isn't a theme token — e.g. Premium's
   * Khāṣṣ-tier gold, which stays constant across all six themes by design.
   * Leave unset for the normal per-theme `colors.primary` behaviour.
   */
  tint?: string;
}

const SIZE_SPEC: Record<ButtonSize, { height: number; radius: number; paddingX: number }> = {
  large: { height: 56, radius: RADIUS.xl, paddingX: SPACING.xxl },
  medium: { height: 48, radius: RADIUS.lg, paddingX: SPACING.xl },
};

const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  style = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  testID,
  accessibilityLabel,
  containerStyle,
  tint,
}) => {
  const colors = useColors();
  const typography = useTypography();
  const spec = SIZE_SPEC[size];
  const isInteractive = !disabled && !loading;
  const primaryFill = tint ?? colors.primary;

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (!isInteractive) {
        return;
      }
      onPress(event);
    },
    [isInteractive, onPress],
  );

  const labelColor =
    style === 'primary'
      ? colors.textOnPrimary
      : style === 'secondary'
        ? (tint ?? colors.primary)
        : colors.textMuted;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isInteractive}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: spec.height,
          borderRadius: spec.radius,
          paddingHorizontal: spec.paddingX,
        },
        style === 'primary' && {
          backgroundColor: primaryFill,
          ...ELEVATION.glow,
          shadowColor: primaryFill,
        },
        style === 'secondary' && {
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderAccent,
        },
        style === 'ghost' && {
          backgroundColor: 'transparent',
        },
        disabled && styles.disabled,
        pressed && isInteractive && styles.pressed,
        containerStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <View style={styles.content}>
          <Text style={[typography('button'), { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.975 }],
  },
  disabled: {
    opacity: 0.4,
  },
});

export default Button;
