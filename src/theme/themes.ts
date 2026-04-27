/**
 * Shams al-Asrār — Theme tokens
 * --------------------------------------------------------------------------
 * 5 live-switchable themes per master prompt. Token shape is locked here;
 * every screen / component MUST consume tokens through useTheme(), never
 * import a theme object directly.
 *
 * Color sources:
 *   - Teal (default)   : derived from existing HTML prototype anchors
 *                        (#030E10 base, #14D4C4 accent, #0FA89A primary)
 *   - Midnight Gold    : Sky Clock palette (#B8952A against deep midnight)
 *   - Royal Violet     : premium tier visual variant
 *   - Crimson Dusk     : warm/sunset variant
 *   - Arctic Silver    : light-leaning monochrome variant (still dark-base
 *                        because spiritual product reads better on dark;
 *                        no true light mode in v1 — confirmed by prompt)
 *
 * Mirror anchors live in android/app/src/main/res/values/colors.xml so the
 * native splash matches the JS theme on first paint.
 */

export type ThemeId = 'teal' | 'midnightGold' | 'royalViolet' | 'crimsonDusk' | 'arcticSilver';

export interface ThemeColors {
  /** Deepest background — full-screen base */
  bg: string;
  /** Elevated surface (cards, sheets) */
  surface: string;
  /** Highest elevation (modals, popovers) */
  surfaceElevated: string;
  /** Hairline dividers */
  border: string;
  /** Border with brand emphasis (focus, selected) */
  borderAccent: string;

  /** Primary brand action color (CTAs, primary buttons) */
  primary: string;
  /** Brighter accent — glows, highlights, link text */
  accent: string;
  /** Warm secondary — user chat bubble accent, premium badges */
  amber: string;
  /** Verdict YES (positive resolution) */
  positive: string;
  /** Verdict NO (negative resolution) */
  negative: string;
  /** Verdict CONDITIONAL / DELAYED / UNCLEAR */
  caution: string;

  /** Primary text on dark backgrounds */
  text: string;
  /** Secondary / muted text */
  textMuted: string;
  /** Tertiary / disabled / placeholder */
  textFaint: string;
  /** Text used on top of primary-colored surfaces (buttons) */
  textOnPrimary: string;

  /** Shams chat bubble bg (left) */
  chatShamsBg: string;
  /** Shams chat bubble border-glow */
  chatShamsBorder: string;
  /** User chat bubble bg (right) */
  chatUserBg: string;
  /** User chat bubble border-glow */
  chatUserBorder: string;

  /** Starfield star color (cool aqua tones for teal; warm for gold) */
  starfield: string;
  /** Nebula tint anchors (3 colors blended) */
  nebula1: string;
  nebula2: string;
  nebula3: string;

  /** Status bar tint (used by RN StatusBar) */
  statusBar: string;
  /** Status bar style — light (white icons) or dark (black icons) */
  statusBarStyle: 'light-content' | 'dark-content';
}

export interface Theme {
  id: ThemeId;
  /** Localized display label is resolved via i18n; this is the i18n key */
  labelKey: string;
  /** Whether RN should compute light or dark contrast defaults */
  isDark: boolean;
  colors: ThemeColors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme: Teal (default)
// ─────────────────────────────────────────────────────────────────────────────
const teal: Theme = {
  id: 'teal',
  labelKey: 'theme.teal',
  isDark: true,
  colors: {
    bg: '#030E10',
    surface: '#0A1A1D',
    surfaceElevated: '#11272B',
    border: '#1C3A3F',
    borderAccent: '#14D4C4',

    primary: '#0FA89A',
    accent: '#14D4C4',
    amber: '#E8B547',
    positive: '#22C77B',
    negative: '#E5484D',
    caution: '#F5A524',

    text: '#E6FBF8',
    textMuted: '#8FB5B0',
    textFaint: '#4D7370',
    textOnPrimary: '#03171A',

    chatShamsBg: 'rgba(15, 168, 154, 0.10)',
    chatShamsBorder: '#14D4C4',
    chatUserBg: 'rgba(232, 181, 71, 0.10)',
    chatUserBorder: '#E8B547',

    starfield: '#A0F2EA',
    nebula1: 'rgba(20, 212, 196, 0.18)',
    nebula2: 'rgba(15, 168, 154, 0.14)',
    nebula3: 'rgba(232, 181, 71, 0.08)',

    statusBar: '#030E10',
    statusBarStyle: 'light-content',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme: Midnight Gold (Sky Clock palette)
// ─────────────────────────────────────────────────────────────────────────────
const midnightGold: Theme = {
  id: 'midnightGold',
  labelKey: 'theme.midnightGold',
  isDark: true,
  colors: {
    bg: '#0A0814',
    surface: '#15112B',
    surfaceElevated: '#1F1A3A',
    border: '#2E2654',
    borderAccent: '#B8952A',

    primary: '#B8952A',
    accent: '#E8C667',
    amber: '#E8C667',
    positive: '#7BC97B',
    negative: '#D14747',
    caution: '#F0A830',

    text: '#F4ECD8',
    textMuted: '#A89F86',
    textFaint: '#5C5544',
    textOnPrimary: '#1A1308',

    chatShamsBg: 'rgba(184, 149, 42, 0.10)',
    chatShamsBorder: '#E8C667',
    chatUserBg: 'rgba(232, 198, 103, 0.10)',
    chatUserBorder: '#E8C667',

    starfield: '#F4ECD8',
    nebula1: 'rgba(184, 149, 42, 0.18)',
    nebula2: 'rgba(232, 198, 103, 0.10)',
    nebula3: 'rgba(120, 90, 200, 0.10)',

    statusBar: '#0A0814',
    statusBarStyle: 'light-content',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme: Royal Violet
// ─────────────────────────────────────────────────────────────────────────────
const royalViolet: Theme = {
  id: 'royalViolet',
  labelKey: 'theme.royalViolet',
  isDark: true,
  colors: {
    bg: '#0E0820',
    surface: '#1A1238',
    surfaceElevated: '#251A4F',
    border: '#3A2A6B',
    borderAccent: '#9D7AFF',

    primary: '#7C5CFF',
    accent: '#9D7AFF',
    amber: '#F2C84A',
    positive: '#5DD39E',
    negative: '#FF6B6B',
    caution: '#FFB144',

    text: '#EDE6FF',
    textMuted: '#A095C7',
    textFaint: '#5C5380',
    textOnPrimary: '#0A0518',

    chatShamsBg: 'rgba(124, 92, 255, 0.10)',
    chatShamsBorder: '#9D7AFF',
    chatUserBg: 'rgba(242, 200, 74, 0.10)',
    chatUserBorder: '#F2C84A',

    starfield: '#D4C8FF',
    nebula1: 'rgba(124, 92, 255, 0.18)',
    nebula2: 'rgba(157, 122, 255, 0.12)',
    nebula3: 'rgba(242, 200, 74, 0.08)',

    statusBar: '#0E0820',
    statusBarStyle: 'light-content',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme: Crimson Dusk
// ─────────────────────────────────────────────────────────────────────────────
const crimsonDusk: Theme = {
  id: 'crimsonDusk',
  labelKey: 'theme.crimsonDusk',
  isDark: true,
  colors: {
    bg: '#160A0E',
    surface: '#26111A',
    surfaceElevated: '#3A1A26',
    border: '#5A2638',
    borderAccent: '#E5566A',

    primary: '#C73E5C',
    accent: '#E5566A',
    amber: '#F2A341',
    positive: '#6BCF8F',
    negative: '#FF5A5A',
    caution: '#F2A341',

    text: '#FFE6EC',
    textMuted: '#C49AA7',
    textFaint: '#7A5562',
    textOnPrimary: '#1A0307',

    chatShamsBg: 'rgba(199, 62, 92, 0.10)',
    chatShamsBorder: '#E5566A',
    chatUserBg: 'rgba(242, 163, 65, 0.10)',
    chatUserBorder: '#F2A341',

    starfield: '#FFD8E0',
    nebula1: 'rgba(199, 62, 92, 0.18)',
    nebula2: 'rgba(229, 86, 106, 0.12)',
    nebula3: 'rgba(242, 163, 65, 0.10)',

    statusBar: '#160A0E',
    statusBarStyle: 'light-content',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme: Arctic Silver
// ─────────────────────────────────────────────────────────────────────────────
const arcticSilver: Theme = {
  id: 'arcticSilver',
  labelKey: 'theme.arcticSilver',
  isDark: true,
  colors: {
    bg: '#0C1014',
    surface: '#161B21',
    surfaceElevated: '#222A33',
    border: '#36404C',
    borderAccent: '#B8C4D1',

    primary: '#7C8FA3',
    accent: '#B8C4D1',
    amber: '#E0CFA4',
    positive: '#8FCFA8',
    negative: '#D67878',
    caution: '#E0B878',

    text: '#ECF1F7',
    textMuted: '#9CA8B6',
    textFaint: '#5A6470',
    textOnPrimary: '#0A0E12',

    chatShamsBg: 'rgba(184, 196, 209, 0.08)',
    chatShamsBorder: '#B8C4D1',
    chatUserBg: 'rgba(224, 207, 164, 0.10)',
    chatUserBorder: '#E0CFA4',

    starfield: '#ECF1F7',
    nebula1: 'rgba(184, 196, 209, 0.14)',
    nebula2: 'rgba(124, 143, 163, 0.12)',
    nebula3: 'rgba(224, 207, 164, 0.08)',

    statusBar: '#0C1014',
    statusBarStyle: 'light-content',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────
export const THEMES: Readonly<Record<ThemeId, Theme>> = Object.freeze({
  teal,
  midnightGold,
  royalViolet,
  crimsonDusk,
  arcticSilver,
});

export const THEME_IDS: readonly ThemeId[] = [
  'teal',
  'midnightGold',
  'royalViolet',
  'crimsonDusk',
  'arcticSilver',
];

export const DEFAULT_THEME_ID: ThemeId = 'teal';

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Spacing / radius / shadow / motion — shared across themes
// (kept on the Theme contract via composition, not duplicated per theme)
// ─────────────────────────────────────────────────────────────────────────────
export const SPACING = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
});

export const RADIUS = Object.freeze({
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
});

export const ELEVATION = Object.freeze({
  /** Resting card */
  rest: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  /** Floating elements (FABs, modals) */
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  /** Glow used on accent borders (Shams bubble) */
  glow: {
    shadowColor: '#14D4C4',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});

export const MOTION = Object.freeze({
  /** Microinteractions (button press) */
  fast: 120,
  /** Standard transitions (theme swap, modal) */
  base: 220,
  /** Hero / screen-level transitions */
  slow: 380,
  /** Splash mandala spin */
  splash: 2500,
});
