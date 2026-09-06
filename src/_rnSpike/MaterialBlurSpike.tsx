/**
 * MaterialBlurSpike — RN feasibility spike, NOT a production component.
 * ------------------------------------------------------------------------
 * Answers exactly one question: does `@react-native-community/blur` (v4.4.1,
 * installed into this isolated spike only) materially improve on the
 * existing tint-only fallback, enough to justify becoming part of the
 * production material system? Three deterministic, freeze-inspectable
 * states: FALLBACK, BLUR, STRESS.
 *
 * REAL, VERIFIED FACTS THIS FILE IS BUILT ON (not assumed):
 * - `node_modules/@react-native-community/blur/android/build.gradle` gates
 *   its Java sources on `rootProject.hasProperty("newArchEnabled")` —
 *   this project's `android/gradle.properties` has `newArchEnabled=false`,
 *   so the library's `src/oldarch/BlurViewManager.java` path applies. The
 *   library explicitly ships and supports this project's exact
 *   architecture setting; this is not an assumption.
 * - Android's `BlurViewManagerImpl.createViewInstance` (same package)
 *   wires the blur to the Activity's `decorView` — it blurs whatever is
 *   rendered behind it in the actual window, via the `eightbitlab/blurview`
 *   library's real-time sampling, not a static one-shot snapshot. This is
 *   a genuine integration nuance: it is a "blur what's behind this view in
 *   the window" primitive, not an isolated per-component effect the way
 *   CSS `backdrop-filter` is scoped to its own stacking context. Noted in
 *   the report, not silently smoothed over.
 * - iOS's podspec targets iOS 10.0+ and branches on new-arch the same way —
 *   no iOS-specific integration blocker identified from static reading.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';

type SpikeStage = 'fallback' | 'blur' | 'stress';
const STAGES: SpikeStage[] = ['fallback', 'blur', 'stress'];

const GOLD_BRIGHT = '#E8C77D';
const MAQBOOL = '#D4A855';
const MUTED = '#9A907C';
const FAINT = '#6E6558';
const VOID_BG = '#0A0A10';

/** The stress background: enough visual detail behind the surface to judge
 * whether real diffusion/refraction changes anything, vs. a flat void where
 * any glass technique would look identical. */
function StressBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[styles.stressBlob, { top: 20, left: 10, backgroundColor: GOLD_BRIGHT + '55' }]}
      />
      <View
        style={[
          styles.stressBlob,
          { top: 90, right: 0, backgroundColor: MAQBOOL + '55', width: 90, height: 90 },
        ]}
      />
      <View style={[styles.stressStripe, { top: 60 }]} />
      <View style={[styles.stressStripe, { top: 140 }]} />
      <View style={[styles.stressStripe, { top: 200 }]} />
    </View>
  );
}

function CardContent() {
  return (
    <>
      <Text style={styles.verdict}>The matter is moving</Text>
      <Text style={styles.line}>The eleventh lord sits well-disposed to the ascendant.</Text>
    </>
  );
}

/** A — existing production fallback: current tint + border/highlight + shadow. */
function FallbackSurface() {
  return (
    <View style={styles.surfaceBase}>
      <View style={styles.topHighlight} />
      <CardContent />
    </View>
  );
}

/** B — native blur candidate, same geometry/background/border/shadow tokens as A. */
function BlurSurface() {
  return (
    <View style={styles.surfaceBase}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="dark"
        blurAmount={14}
        reducedTransparencyFallbackColor={VOID_BG}
      />
      <View style={styles.topHighlight} />
      <View style={styles.blurTintOverlay} pointerEvents="none" />
      <CardContent />
    </View>
  );
}

export function MaterialBlurSpike() {
  const [stage, setStage] = useState<SpikeStage>('fallback');

  return (
    <View style={styles.root}>
      <View style={styles.trackRow}>
        {STAGES.map(s => (
          <Text
            key={s}
            onPress={() => setStage(s)}
            style={[
              styles.trackBtn,
              { color: s === stage ? VOID_BG : FAINT },
              s === stage && { backgroundColor: GOLD_BRIGHT },
            ]}
          >
            {s.toUpperCase()}
          </Text>
        ))}
      </View>

      <View style={styles.stageHost}>
        {stage === 'stress' && <StressBackground />}
        {stage === 'blur' || stage === 'stress' ? <BlurSurface /> : <FallbackSurface />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, borderRadius: 14, backgroundColor: VOID_BG, minHeight: 320 },
  trackRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  trackBtn: {
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    overflow: 'hidden',
  },
  stageHost: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 240 },
  // Identical geometry/background/border/shadow tokens across A and B, per
  // the acceptance criteria — only the blur layer itself differs.
  surfaceBase: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    padding: 20,
    backgroundColor: 'rgba(244,239,227,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.16)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 14,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  // The BlurView on its own has no tint — layering the same faint warm tint
  // on top keeps A/B comparable rather than comparing "tinted card" against
  // "untinted blur," which would bias the comparison toward B by default.
  blurTintOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(244,239,227,0.03)' },
  stressBlob: { position: 'absolute', width: 120, height: 90, borderRadius: 60 },
  stressStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: GOLD_BRIGHT + '40',
  },
  verdict: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 21,
    fontWeight: '700',
    color: MAQBOOL,
    letterSpacing: 0.5,
  },
  line: { fontFamily: 'Spectral-Regular', fontSize: 13.5, color: MUTED, marginTop: 8 },
});
