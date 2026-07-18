/**
 * Theme WCAG contrast regression test.
 *
 * Locks every theme's palette to the accessibility floor established by the
 * theme audit: 4.5:1 (WCAG AA normal text) for the reading-text tokens on the
 * surfaces they render over, and 3:1 (AA large text / UI components) for the
 * accent/status tokens. A palette tweak that drops below the floor fails CI.
 */

import { THEMES, type ThemeId } from '@theme/themes';

function srgbChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => srgbChannel(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const THEME_IDS = Object.keys(THEMES) as ThemeId[];

// [foreground token, background token, minimum ratio]
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  // Reading text — WCAG AA normal text
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surfaceElevated', 4.5],
  ['textMuted', 'bg', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textFaint', 'bg', 4.5],
  ['textFaint', 'surface', 4.5],
  ['textFaint', 'surfaceElevated', 4.5],
  ['textOnPrimary', 'primary', 4.5],
  // Accent / status tokens — AA large text & UI components
  ['accent', 'bg', 3.0],
  ['goldBright', 'bg', 3.0],
  ['positive', 'surface', 3.0],
  ['negative', 'surface', 3.0],
  ['caution', 'surface', 3.0],
];

describe.each(THEME_IDS)('theme %s meets the WCAG contrast floor', themeId => {
  const colors = THEMES[themeId].colors as unknown as Record<string, string>;

  it.each(PAIRS.map(p => [...p] as [string, string, number]))('%s on %s ≥ %s:1', (fg, bg, min) => {
    expect(contrast(colors[fg]!, colors[bg]!)).toBeGreaterThanOrEqual(min);
  });
});
