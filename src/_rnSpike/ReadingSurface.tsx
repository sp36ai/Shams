/**
 * ReadingSurface — RN feasibility spike, NOT a production component.
 * --------------------------------------------------------------------
 * The single verdict→remedy envelope (§04 Level 2, §09, §10's density
 * ceiling: verdict + unveiling + up to 3 supporting rows + remedy).
 */
import React from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, Text } from 'react-native';

import { GlassSurface } from './GlassSurface';

interface ReadingSurfaceProps {
  goldBright: string;
  maqbool: string;
  muted: string;
  /** 0 (hidden) → 1 (fully revealed) per content stage — see DimensionalReveal */
  showVerdict: SharedValue<number>;
  showUnveil: SharedValue<number>;
  showRemedy: SharedValue<number>;
}

export function ReadingSurface({
  goldBright,
  maqbool,
  muted,
  showVerdict,
  showUnveil,
  showRemedy,
}: ReadingSurfaceProps) {
  const verdictStyle = useAnimatedStyle(() => ({
    opacity: showVerdict.value,
    transform: [{ translateY: (1 - showVerdict.value) * 6 }],
  }));
  const unveilStyle = useAnimatedStyle(() => ({
    opacity: showUnveil.value,
    transform: [{ translateY: (1 - showUnveil.value) * 6 }],
  }));
  const remedyStyle = useAnimatedStyle(() => ({
    opacity: showRemedy.value,
    transform: [{ translateY: (1 - showRemedy.value) * 6 }],
  }));

  return (
    <GlassSurface goldBright={goldBright}>
      {/* Verdict glow: textShadow* are RN STYLE properties, not component
          props (an easy first mistake — caught here by tsc, not by eye).
          More importantly: RN's textShadow* is not a real blur — it's a
          single hard-edged offset shadow copy of the glyphs, and it's
          documented to render inconsistently on Android depending on the
          font-rendering path (frequently clipped at the text's own bounding
          box, unlike CSS text-shadow's unclipped blur). Fidelity risk,
          not silently worked around with a stronger opacity to compensate. */}
      <Animated.Text
        style={[
          styles.verdict,
          {
            color: maqbool,
            textShadowColor: 'rgba(212,168,85,0.45)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          },
          verdictStyle,
        ]}
      >
        The matter is moving
      </Animated.Text>
      <Animated.View style={unveilStyle}>
        <Text style={[styles.line, { color: muted }]}>
          The eleventh lord sits well-disposed to the ascendant.
        </Text>
        <Text style={[styles.line, { color: muted }]}>Timing — 2–4 weeks</Text>
      </Animated.View>
      <Animated.View style={[styles.remedyWrap, remedyStyle]}>
        {/* v7 fix reproduced here directly: muted, not a bright/full-opacity
            color, so Remedy doesn't outrank Timing/Guidance in RN either. */}
        <Text style={[styles.line, { color: muted }]}>
          Remedy — a small act of charity before the week&apos;s end
        </Text>
      </Animated.View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  verdict: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  line: {
    fontFamily: 'Spectral-Regular',
    fontSize: 13.5,
    marginTop: 8,
  },
  remedyWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,169,97,0.25)',
  },
});
