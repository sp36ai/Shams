/**
 * StarfieldBackground — animated twinkling stars for dark-theme screens.
 * Renders ~55 small circular views with staggered Animated opacity loops,
 * all driven by the native driver so the JS thread stays clear.
 * Drop inside any screen as a sibling (pointerEvents="none").
 */

import React, { useEffect, useMemo } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface StarSpec {
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  delay: number;
  duration: number;
}

const STAR_COUNT = 55;

function makeStars(): StarSpec[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * SCREEN_W * 0.96 + SCREEN_W * 0.02,
    y: Math.random() * SCREEN_H * 0.96 + SCREEN_H * 0.02,
    size: Math.random() * 2.0 + 0.5,
    opacity: new Animated.Value(Math.random() * 0.3 + 0.05),
    delay: Math.floor(Math.random() * 2800),
    duration: Math.floor(Math.random() * 2000 + 1600),
  }));
}

interface StarfieldBackgroundProps {
  starColor?: string;
}

const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  starColor = 'rgba(160, 242, 234, 1)',
}) => {
  const stars = useMemo<StarSpec[]>(makeStars, []);

  useEffect(() => {
    const anims = stars.map(s =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(s.opacity, {
            toValue: 0.82,
            duration: s.duration,
            delay: s.delay,
            useNativeDriver: true,
          }),
          Animated.timing(s.opacity, {
            toValue: 0.04,
            duration: s.duration,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [stars]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              backgroundColor: starColor,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  star: { position: 'absolute' },
});

export default StarfieldBackground;
