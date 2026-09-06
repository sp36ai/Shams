/**
 * DimensionalReveal — RN feasibility spike, NOT a production component.
 * ------------------------------------------------------------------------
 * The far/mid/surface plane composition (§12, §22) and the six freeze states:
 * idle, thinking, depth, verdict, unveil, remedy — matching the browser
 * prototype's own state names exactly, so the mapping report can compare
 * like-for-like.
 *
 * THE CENTRAL PLATFORM FINDING THIS FILE SURFACED (confirmed by `tsc`, not
 * guessed):
 * The browser prototype's depth illusion is built on CSS `translateZ` inside
 * a `transform-style: preserve-3d` parent. This project's installed RN
 * (0.78.3)'s own style types — `node_modules/react-native/Libraries/
 * StyleSheet/StyleSheetTypes.d.ts` — DO NOT define a `translateZ` transform
 * at all. Only `perspective`, `rotateX/Y/Z`, and the `scale`/`translateX`/
 * `translateY` family exist. Attempting `translateZ` in this codebase is a
 * compile error, not a runtime risk — confirmed directly, not inferred.
 *
 * There is also no RN equivalent of CSS's `transform-style: preserve-3d`
 * establishing one shared 3D space across sibling views — each RN View's
 * transform is evaluated independently regardless.
 *
 * The practical consequence, and what this file actually does instead:
 * depth is simulated the only way this platform allows — through `scale`,
 * 2D `translateY`, and `opacity` differences between the three planes,
 * exactly the "2.5D, not true 3D" register V5/V6/V7 already settled on for
 * unrelated (visual) reasons. This finding doesn't contradict that decision;
 * it independently confirms it from the platform side — true Z-axis
 * translation was never available to this stack in the first place.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { ReadingSurface } from './ReadingSurface';

export type FreezeStage = 'idle' | 'thinking' | 'depth' | 'verdict' | 'unveil' | 'remedy';

const STAGES: FreezeStage[] = ['idle', 'thinking', 'depth', 'verdict', 'unveil', 'remedy'];
const ORDER = (s: FreezeStage) => STAGES.indexOf(s);

interface Colors {
  goldBright: string;
  goldDim: string;
  maqbool: string;
  muted: string;
  faint: string;
  voidBg: string;
}

export function DimensionalReveal({ colors }: { colors: Colors }) {
  const [stage, setStage] = useState<FreezeStage>('idle');

  const farOpacity = useSharedValue(0.28);
  const farScale = useSharedValue(1.05);
  const midOpacity = useSharedValue(0);
  const midScale = useSharedValue(1);
  const surfaceOpacity = useSharedValue(0);
  const surfaceScale = useSharedValue(0.92);
  const showVerdict = useSharedValue(0);
  const showUnveil = useSharedValue(0);
  const showRemedy = useSharedValue(0);

  const applyStage = useCallback(
    (target: FreezeStage) => {
      setStage(target);
      const at = (s: FreezeStage) => ORDER(target) >= ORDER(s);
      const cfg = { duration: 260, easing: Easing.out(Easing.cubic) };

      farOpacity.value = withTiming(at('depth') ? 0.4 : at('verdict') ? 0.16 : 0.28, cfg);
      farScale.value = withTiming(at('depth') ? 1.3 : 1.05, cfg);
      midOpacity.value = withTiming(at('thinking') && !at('verdict') ? 1 : 0, cfg);
      midScale.value = withTiming(at('depth') && !at('verdict') ? 0.74 : 1, cfg);
      surfaceOpacity.value = withTiming(at('verdict') ? 1 : 0, cfg);
      surfaceScale.value = withTiming(at('verdict') ? 1 : 0.92, cfg);
      showVerdict.value = withTiming(at('verdict') ? 1 : 0, cfg);
      showUnveil.value = withTiming(at('unveil') ? 1 : 0, cfg);
      showRemedy.value = withTiming(at('remedy') ? 1 : 0, cfg);
    },
    [
      farOpacity,
      farScale,
      midOpacity,
      midScale,
      surfaceOpacity,
      surfaceScale,
      showVerdict,
      showUnveil,
      showRemedy,
    ],
  );

  // See file header: `translateZ` does not exist in this RN version's
  // transform type. Depth is approximated with `scale` alone (a receding
  // plane scales down and dims; an emerging one scales up and brightens) —
  // the actual, compile-checked RN substitute for the browser's translateZ.
  const farStyle = useAnimatedStyle(() => ({
    opacity: farOpacity.value,
    transform: [{ scale: farScale.value }],
  }));
  const midStyle = useAnimatedStyle(() => ({
    opacity: midOpacity.value,
    transform: [{ scale: midScale.value }],
  }));
  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: surfaceOpacity.value,
    transform: [{ scale: surfaceScale.value }],
  }));

  return (
    <View style={[styles.stage, { backgroundColor: colors.voidBg }]}>
      <View style={styles.stageTrack}>
        {STAGES.map(s => (
          <Text
            key={s}
            onPress={() => applyStage(s)}
            style={[
              styles.stageBtn,
              { color: s === stage ? colors.voidBg : colors.faint },
              s === stage && { backgroundColor: colors.goldBright },
            ]}
          >
            {s.toUpperCase()}
          </Text>
        ))}
      </View>

      <Text style={[styles.question, { color: colors.muted }]}>
        &quot;When will my business improve?&quot;
      </Text>

      <View style={styles.planeHost}>
        <Animated.View style={[styles.plane, farStyle]}>
          <View style={[styles.glowPatch, { backgroundColor: colors.goldBright + '30' }]} />
        </Animated.View>

        <Animated.View style={[styles.plane, midStyle]}>
          <View style={[styles.orbitRing, { borderColor: colors.goldDim }]} />
          <View style={[styles.sun, { backgroundColor: colors.goldBright }]} />
        </Animated.View>

        <Animated.View style={[styles.plane, surfaceStyle]}>
          <ReadingSurface
            goldBright={colors.goldBright}
            maqbool={colors.maqbool}
            muted={colors.muted}
            showVerdict={showVerdict}
            showUnveil={showUnveil}
            showRemedy={showRemedy}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { padding: 16, borderRadius: 14, minHeight: 380 },
  stageTrack: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  stageBtn: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    overflow: 'hidden',
  },
  question: { textAlign: 'center', fontSize: 12.5, marginBottom: 16 },
  planeHost: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plane: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: '100%' },
  glowPatch: { width: 180, height: 140, borderRadius: 90 },
  orbitRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, position: 'absolute' },
  sun: { width: 22, height: 22, borderRadius: 11 },
});
