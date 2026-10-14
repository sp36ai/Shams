/**
 * useHomeStyle — Home's palette and widget shapes for the active theme
 * (see HomeStyle / getHomeStyle in themes.ts). Every Home component reads its
 * colours from here, so the theme picker restyles Home; Midnight Celestial
 * keeps the original hero palette exactly.
 */

import { useMemo } from 'react';

import { useTheme } from '@theme/ThemeProvider';
import { getHomeStyle, type HomeStyle } from '@theme/themes';

export function useHomeStyle(): HomeStyle {
  const { theme } = useTheme();
  return useMemo(() => getHomeStyle(theme), [theme]);
}
