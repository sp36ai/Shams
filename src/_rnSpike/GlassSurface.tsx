/**
 * GlassSurface — RN feasibility spike, NOT a production component.
 * ----------------------------------------------------------------
 * Reproduces §01's Level-2 material stack (fill / inner highlight / bevel /
 * contact+glow shadow) using ONLY what's actually installed today:
 * StyleSheet, LinearGradient-less gradients (View + border tricks), and RN's
 * native shadow/elevation. No `@react-native-community/blur` is installed —
 * see the mapping report for what that costs, honestly, rather than faking
 * a blur with a semi-transparent tint and calling it equivalent.
 */
import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

interface GlassSurfaceProps {
  children: React.ReactNode;
  /** Matches the browser prototype's warm-gold bevel/rim tint, not a literal color prop. */
  goldBright: string;
  style?: ViewStyle;
}

/**
 * Known, real constraint (not a guess): RN has no `backdrop-filter`
 * equivalent without a native blur library. `react-native-community/blur`
 * is NOT a dependency of this app (confirmed via package.json). Without it,
 * this surface can only fake translucency with a semi-opaque tint over
 * whatever sits behind it — it cannot actually diffuse the content behind it
 * the way the V7 browser prototype's `backdrop-filter: blur(22px)` does.
 * This is the single largest fidelity gap this spike exists to surface.
 */
export function GlassSurface({ children, goldBright, style }: GlassSurfaceProps) {
  return (
    <View style={[styles.surface, style]}>
      {/* Inner highlight — top edge only, per §01 Layer 4. A 1px absolutely
          positioned View is the RN equivalent of the CSS inset box-shadow
          highlight; it reproduces faithfully, unlike the blur. */}
      <View style={styles.topHighlight} />
      <View style={[styles.rimTint, { borderColor: goldBright + '18' }]} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: 'rgba(244,239,227,0.06)', // approximates the browser's glass fill — no real blur behind it
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.16)',
    overflow: 'hidden',
    // Contact + glow shadow pair (§01 Layer 5). iOS reads shadow* directly;
    // Android collapses this to a single `elevation` value and ignores
    // shadowColor/shadowOffset/shadowRadius on native Views below API 28 in
    // most OEM renderers — a real, documented platform split, not a guess.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 22 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
      },
      android: {
        elevation: 14, // Android has no equivalent of a *separate* gold glow shadow layered on top of a contact shadow
      },
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  rimTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
  },
  content: {
    position: 'relative',
  },
});
