/**
 * VerdictSpike — RN feasibility spike, NOT a production screen.
 * -------------------------------------------------------------
 * Composes DimensionalReveal with real theme tokens. Exported but never
 * imported by any navigator — reachable only by a developer temporarily
 * wiring it into a screen by hand to inspect it, exactly like the browser
 * artifact's freeze buttons were meant to be inspected by hand.
 */
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { DimensionalReveal } from './DimensionalReveal';
import { THEMES } from '../theme/themes';

export function VerdictSpike() {
  const t = THEMES.darAlShams.colors; // reuse the real dark theme's tokens, not invented spike-only colors
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#0A0A10' }]}>
      <DimensionalReveal
        colors={{
          goldBright: t.goldBright,
          goldDim: t.goldBright + '66',
          maqbool: t.maqbool,
          muted: t.textMuted,
          faint: t.textFaint,
          voidBg: '#0A0A10',
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
