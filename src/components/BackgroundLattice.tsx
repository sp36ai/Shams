import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { useColors } from '@theme/ThemeProvider';

interface Props {
  opacity?: number;
  strokeColor?: string;
}

export function BackgroundLattice({ opacity, strokeColor }: Props) {
  const c = useColors();
  const { width, height } = useWindowDimensions();

  const stroke = strokeColor ?? c.jaliStroke;
  const alpha = opacity ?? c.jaliOpacity;
  const TILE = 90;

  const lattice = useMemo(() => {
    const cols = Math.ceil(width / TILE) + 1;
    const rows = Math.ceil(height / TILE) + 1;
    const cells: React.ReactElement[] = [];

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const tx = x * TILE;
        const ty = y * TILE;
        cells.push(
          <Path
            key={`${x}-${y}`}
            d={`M${tx + TILE / 2} ${ty} L${tx + TILE} ${ty + TILE / 2} L${tx + TILE / 2} ${ty + TILE} L${tx} ${ty + TILE / 2} Z M${tx} ${ty} L${tx + 15} ${ty + 15} M${tx + TILE - 15} ${ty + 15} L${tx + TILE} ${ty} M${tx} ${ty + TILE} L${tx + 15} ${ty + TILE - 15} M${tx + TILE - 15} ${ty + TILE - 15} L${tx + TILE} ${ty + TILE}`}
            fill="none"
            stroke={stroke}
            strokeWidth="0.5"
          />,
        );
      }
    }

    return (
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} opacity={alpha}>
        <G>{cells}</G>
      </Svg>
    );
  }, [alpha, height, stroke, width]);

  return (
    <View style={styles.container} pointerEvents="none">
      {lattice}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});
