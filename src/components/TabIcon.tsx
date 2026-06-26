/**
 * TabIcon — minimal stroke-only SVG icons for the bottom-tab bar.
 * --------------------------------------------------------------------------
 * Why SVG:
 *   - Stroke color follows theme.colors.accent live without re-mounting fonts.
 *   - Zero font cold-start cost on Hermes.
 *   - 3 icons total — no need to ship an icon font package for that.
 *
 * Visual language:
 *   - 24×24 viewport, 1.6 stroke width, round caps/joins for a "drawn"
 *     mystical feel that matches Cinzel/Cormorant typography.
 *   - When `focused`, stroke goes to accent + width bumps to 2.0; when not,
 *     stroke is mutedText. Reanimated micro-animation on the bump is added
 *     in MainTabs to avoid frame drops on tab swap.
 *
 * Adding new icons:
 *   1. Add a new key to `IconName`.
 *   2. Add the path strings to PATHS below.
 *   3. Reference by name in MainTabs screenOptions.
 */

import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export type IconName = 'oracle' | 'skyclock' | 'history' | 'settings';

export interface TabIconProps {
  name: IconName;
  color: string;
  size?: number;
  focused?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Icon path data — SVG d-attribute strings, designed at 24×24 viewport.     */
/* -------------------------------------------------------------------------- */

interface IconShape {
  paths: string[];
  /** Optional circles — { cx, cy, r } per circle, drawn after paths. */
  circles?: Array<{ cx: number; cy: number; r: number; fill?: string }>;
}

const PATHS: Record<IconName, IconShape> = {
  // Oracle: stylized eye / sun-disc with rays — "the seeing"
  oracle: {
    paths: [
      'M2 12 C 5 7, 9 5, 12 5 C 15 5, 19 7, 22 12 C 19 17, 15 19, 12 19 C 9 19, 5 17, 2 12 Z',
    ],
    circles: [{ cx: 12, cy: 12, r: 3 }],
  },

  // Sky Clock: concentric circles with tick marks — astrological disk
  skyclock: {
    paths: [
      // Outer ring
      'M12 3 A9 9 0 1 1 11.999 3',
      // Inner ring
      'M12 7 A5 5 0 1 1 11.999 7',
      // Cardinal tick marks (N/S/E/W)
      'M12 3 L12 5',
      'M12 19 L12 21',
      'M3 12 L5 12',
      'M19 12 L21 12',
      // Center dot arm (hora hand)
      'M12 12 L15 9',
    ],
    circles: [{ cx: 12, cy: 12, r: 1.5, fill: 'currentColor' }],
  },

  // History: scroll / page with lines
  history: {
    paths: [
      'M5 4 L 5 20 L 19 20 L 19 8 L 15 4 Z',
      'M15 4 L 15 8 L 19 8',
      'M8 12 L 16 12',
      'M8 15 L 16 15',
      'M8 18 L 13 18',
    ],
  },

  // Settings: gear (simplified — 6 teeth)
  settings: {
    paths: [
      'M12 8 L 12 4',
      'M12 20 L 12 16',
      'M4 12 L 8 12',
      'M16 12 L 20 12',
      'M6.3 6.3 L 9.2 9.2',
      'M14.8 14.8 L 17.7 17.7',
      'M6.3 17.7 L 9.2 14.8',
      'M14.8 9.2 L 17.7 6.3',
    ],
    circles: [{ cx: 12, cy: 12, r: 4 }],
  },
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const TabIcon: React.FC<TabIconProps> = ({ name, color, size = 24, focused = false }) => {
  const shape = PATHS[name];
  const strokeWidth = focused ? 2.0 : 1.6;
  const haloFill = focused && /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(color) ? `${color}22` : 'none';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {focused && <Circle cx={12} cy={12} r={10} fill={haloFill} />}
      {shape.paths.map((d, i) => (
        <Path
          key={`p${i}`}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={focused ? 1 : 0.78}
        />
      ))}
      {shape.circles?.map((c, i) => (
        <Circle
          key={`c${i}`}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill={c.fill ?? (focused ? haloFill : 'none')}
          fillOpacity={focused && c.fill === undefined ? 0.16 : 1}
        />
      ))}
    </Svg>
  );
};

export default React.memo(TabIcon);
