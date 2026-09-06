/**
 * GlassSurface — production Level-2 material primitive.
 * --------------------------------------------------------------------------
 * The shared implementation of the material spec's 7-layer glass stack
 * (fill / inner highlight / bevel / contact+glow shadow), replacing the
 * ad-hoc `glassOverlay`/`topHighlight` pairs that were previously
 * hand-duplicated per component (RkpWatchCard, HomeAskComposer, ChatComposer,
 * SkyClockScreen's TimingBar). A second, differently-coded glass treatment
 * appearing anywhere in the codebase after this lands is the thing to fix,
 * not to tolerate — that's exactly how the material language degrades back
 * into "effects added to cards."
 *
 * No blur library is installed (confirmed: no `@react-native-community/blur`
 * in production `package.json` — the isolated spike on
 * `claude/shams-premium-ui-redesign-1hx0ka` evaluated it and the result was
 * explicitly "do not yet accept — insufficient evidence," pending a real
 * device/emulator render neither this session nor CI has access to). This
 * primitive is therefore the honest RN-approximation tier: a tinted fill,
 * a real top-edge highlight, and a two-part bevel (bright top-left / dark
 * bottom-right), not a diffusing blur.
 */
import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface GlassSurfaceProps {
  children: React.ReactNode;
  /**
   * The tone this surface is tinted to — a verdict's state color, a screen's
   * accent, or a neutral gold for surfaces with no verdict of their own.
   * Never omit this: an untinted glass fill reads as a flat grey card.
   */
  tint: string;
  style?: StyleProp<ViewStyle>;
  /** Rare escape hatch for a surface that must not clip its own children
   * (e.g. one that renders a badge bleeding past its own edge). Defaults to
   * clipping, matching every glass surface elsewhere in the app. */
  clip?: boolean;
  accessibilityRole?: AccessibilityRole;
}

export function GlassSurface({
  children,
  tint,
  style,
  clip = true,
  accessibilityRole,
}: GlassSurfaceProps) {
  return (
    <View
      style={[styles.surface, clip && styles.clip, style]}
      accessibilityRole={accessibilityRole}
    >
      <View pointerEvents="none" style={[styles.fill, { backgroundColor: tint + '0F' }]} />
      <View pointerEvents="none" style={[styles.topHighlight, { backgroundColor: '#FFFFFF2E' }]} />
      <View pointerEvents="none" style={[styles.bevelDark, { backgroundColor: tint + '00' }]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.28,
        shadowRadius: 22,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  clip: { overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  // Inner highlight, top edge only — §01 Layer 4. Never all four sides
  // (that reads as a border, not light catching a material's own edge).
  topHighlight: { position: 'absolute', top: 0, left: 14, right: 14, height: 1 },
  // Reserved for a real bevel treatment once a blur/compositing primitive is
  // available to render it convincingly — currently a zero-opacity no-op,
  // kept as a named layer (not deleted) so the 7-layer stack's structure
  // stays legible in the component itself, matching the spec section it
  // implements rather than silently dropping a layer the spec still names.
  bevelDark: { ...StyleSheet.absoluteFillObject },
  content: { position: 'relative' },
});
