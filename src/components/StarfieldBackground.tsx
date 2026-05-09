/**
 * StarfieldBackground — deep-space backdrop for all dark screens.
 *
 * Three star tiers   : tiny (0.5–1 px), medium (1–2.2 px), bright (2.5–4 px)
 * Four nebula clouds : large rgba circles at very low opacity, theme-coloured
 * Two shooting stars : diagonal streaks that fire on independent slow timers
 *
 * All animations use useNativeDriver so the JS thread stays clear.
 * Drop as a `pointerEvents="none"` sibling at the top of any screen.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ── Star spec ─────────────────────────────────────────────────────────────────

interface StarSpec {
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  delay: number;
  duration: number;
  peakOpacity: number;
}

type StarTier = 'tiny' | 'medium' | 'bright';

const TIER_CONFIG: Record<
  StarTier,
  { count: number; minSize: number; maxSize: number; minPeak: number; maxPeak: number }
> = {
  tiny: { count: 50, minSize: 0.5, maxSize: 1.0, minPeak: 0.25, maxPeak: 0.55 },
  medium: { count: 50, minSize: 1.0, maxSize: 2.2, minPeak: 0.5, maxPeak: 0.8 },
  bright: { count: 20, minSize: 2.5, maxSize: 4.0, minPeak: 0.7, maxPeak: 1.0 },
};

function makeStars(): StarSpec[] {
  const specs: StarSpec[] = [];
  (Object.entries(TIER_CONFIG) as [StarTier, (typeof TIER_CONFIG)[StarTier]][]).forEach(
    ([, cfg]) => {
      for (let i = 0; i < cfg.count; i++) {
        const peakOpacity = Math.random() * (cfg.maxPeak - cfg.minPeak) + cfg.minPeak;
        specs.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: Math.random() * (cfg.maxSize - cfg.minSize) + cfg.minSize,
          opacity: new Animated.Value(Math.random() * 0.15),
          delay: Math.floor(Math.random() * 3500),
          duration: Math.floor(Math.random() * 2200 + 1400),
          peakOpacity,
        });
      }
    },
  );
  return specs;
}

// ── Nebula cloud spec ──────────────────────────────────────────────────────────

interface NebulaSpec {
  x: number;
  y: number;
  size: number;
  color: string; // full rgba string
}

// ── Shooting star spec ────────────────────────────────────────────────────────

interface ShootingSpec {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: Animated.Value;
  triggerMs: number; // first fire delay
  cycleSec: number; // repeat interval (seconds)
}

function makeShooting(): ShootingSpec[] {
  return [
    {
      startX: W * 0.05,
      startY: H * 0.1,
      endX: W * 0.55,
      endY: H * 0.42,
      progress: new Animated.Value(0),
      triggerMs: 4000,
      cycleSec: 11,
    },
    {
      startX: W * 0.7,
      startY: H * 0.05,
      endX: W * 0.15,
      endY: H * 0.35,
      progress: new Animated.Value(0),
      triggerMs: 8500,
      cycleSec: 14,
    },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

interface StarfieldBackgroundProps {
  starColor?: string;
  /** Three nebula colours — pass theme nebula tokens. */
  nebula1?: string;
  nebula2?: string;
  nebula3?: string;
}

const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starColor = 'rgba(160, 242, 234, 1)',
  nebula1 = 'rgba(20, 212, 196, 0.05)',
  nebula2 = 'rgba(15, 168, 154, 0.04)',
  nebula3 = 'rgba(232, 181, 71, 0.03)',
}) => {
  const stars = useMemo<StarSpec[]>(makeStars, []);
  const shooting = useMemo<ShootingSpec[]>(makeShooting, []);

  // Nebula clouds — fixed positions, no animation needed
  const nebulae = useMemo<NebulaSpec[]>(
    () => [
      { x: W * 0.15, y: H * 0.08, size: 220, color: nebula1 },
      { x: W * 0.55, y: H * 0.25, size: 180, color: nebula2 },
      { x: W * -0.05, y: H * 0.55, size: 240, color: nebula3 },
      { x: W * 0.6, y: H * 0.72, size: 200, color: nebula1 },
    ],
    [nebula1, nebula2, nebula3],
  );

  // Star twinkle loops
  useEffect(() => {
    const anims = stars.map(s =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.timing(s.opacity, {
            toValue: s.peakOpacity,
            duration: s.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(s.opacity, {
            toValue: 0.03,
            duration: s.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [stars]);

  // Shooting star animations
  const shootingRef = useRef<Animated.CompositeAnimation[]>([]);
  useEffect(() => {
    const composites: Animated.CompositeAnimation[] = shooting.map(s => {
      const oneCycle = Animated.sequence([
        Animated.delay(s.triggerMs),
        Animated.timing(s.progress, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(200),
        Animated.timing(s.progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(s.cycleSec * 1000 - s.triggerMs - 800),
      ]);
      return Animated.loop(oneCycle);
    });

    shootingRef.current = composites;
    composites.forEach(c => c.start());
    return () => composites.forEach(c => c.stop());
  }, [shooting]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Nebula clouds */}
      {nebulae.map((n, i) => (
        <View
          key={`neb-${i}`}
          style={{
            position: 'absolute',
            left: n.x,
            top: n.y,
            width: n.size,
            height: n.size,
            borderRadius: n.size / 2,
            backgroundColor: n.color,
          }}
        />
      ))}

      {/* Stars */}
      {stars.map((s, i) => (
        <Animated.View
          key={`star-${i}`}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: starColor,
            opacity: s.opacity,
          }}
        />
      ))}

      {/* Shooting stars */}
      {shooting.map((s, i) => {
        const dx = s.endX - s.startX;
        const dy = s.endY - s.startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        const translateX = s.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, dx],
        });
        const translateY = s.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, dy],
        });
        const opacity = s.progress.interpolate({
          inputRange: [0, 0.15, 0.7, 1],
          outputRange: [0, 0.9, 0.7, 0],
        });
        const scaleX = s.progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 1, 0.3],
        });

        return (
          <Animated.View
            key={`shoot-${i}`}
            style={{
              position: 'absolute',
              left: s.startX,
              top: s.startY,
              width: length * 0.5,
              height: 1.5,
              borderRadius: 1,
              backgroundColor: starColor,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate: `${angle}deg` }, { scaleX }],
              transformOrigin: '0% 50%',
            }}
          />
        );
      })}
    </View>
  );
};

export default StarfieldBackground;
