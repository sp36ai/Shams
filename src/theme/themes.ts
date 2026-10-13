/**
 * Shams al-Asrār — DĀR AL-SHAMS Master Theme System
 * "The House of the Hidden Sun"
 * --------------------------------------------------------------------------
 * Nine canonical themes. Single theme per session, MMKV-persisted.
 *
 * VISUAL PHILOSOPHY:
 * - Midnight navy / antique embossed gold (midnightCelestial — free default
 *   for new installs; matches the Home hero's Midnight Celestial palette)
 * - Obsidian manuscript black / illuminated gold (darAlShams — free)
 * - Midnight lapis lazuli / sapphire (laylAlBahr — Mureed)
 * - Iron-black / crimson (narAlHadid — Mureed)
 * - Dawn parchment / antique gold (subhAlWahy — light, Mureed)
 * - Sage garden / olive ink (zaytunAlHikma — light, Mureed)
 * - Violet secret / indigo dusk (sirrAlBanafsaj — Mureed)
 * - Platinum axis-of-lights (qutbAlAnwar — Khāṣṣ)
 * - Emerald treasure / rose gold (kanzAlAsrar — Khāṣṣ)
 *
 * NOTE — the Watch Oracle's verdict colour comes from the semantic tokens
 * below (maqbool / caution / mardood), which every theme defines. The old
 * fixed CONFIRMED/DENIED palette belonged to the retired Astronomical (KP)
 * verdict card and was removed with it.
 *
 * TIER GATING — every theme requires a minimum PlanTier (see THEME_TIER
 * below). midnightCelestial (the default) and darAlShams are free; the other five original
 * colour variants require Mureed; the two newest (qutbAlAnwar, kanzAlAsrar)
 * require Khāṣṣ. Gating is enforced in two places: ThemeSwitcher.tsx (which
 * themes are selectable) and ThemeProvider.tsx (falls back to
 * DEFAULT_THEME_ID if a persisted or currently-active theme exceeds the
 * user's current plan — e.g. a lapsed subscription).
 */

import type { PlanTier } from '@stores/quotaStore';

export type ThemeId =
  | 'midnightCelestial'
  | 'darAlShams'
  | 'laylAlBahr'
  | 'narAlHadid'
  | 'subhAlWahy'
  | 'zaytunAlHikma'
  | 'sirrAlBanafsaj'
  | 'qutbAlAnwar'
  | 'kanzAlAsrar'
  | 'qamarAlFidda'
  | 'zumurrudAlMalakut';

export interface ThemeColors {
  /** Deepest background */
  bg: string;
  /** Elevated surface (cards) */
  surface: string;
  /** Highest elevation (modals, sealed verdicts) */
  surfaceElevated: string;
  /** Geometric separators */
  border: string;
  /** Accent border (focus states, sacred seals) */
  borderAccent: string;

  /** Primary sacred accent */
  gold: string;
  /** Active glow state */
  goldBright: string;
  /** Aged / subdued metal */
  brass: string;

  /** MAQBOOL (favorable) state color */
  maqbool: string;
  /** MAQBOOL atmosphere glow */
  maqboolGlow: string;
  /** MARDOOD (denied) state color */
  mardood: string;
  /** MARDOOD atmosphere glow */
  mardoodGlow: string;
  /** Conditional / caution verdict */
  caution: string;

  /** Primary text */
  text: string;
  /** Secondary text */
  textMuted: string;
  /** Tertiary / faint inscription */
  textFaint: string;
  /** Text on accent-colored surfaces */
  textOnGold: string;

  /** Celestial dust / starfield particles */
  celestialDust: string;
  /** Vellum texture overlay */
  vellumOverlay: string;
  /** Manuscript fog */
  manuscriptFog: string;

  /** Breathing pulse on medallions */
  sacredGlow: string;
  /** Moon mansion markers */
  lunarReflection: string;
  /** Ambient warm glow */
  candlelight: string;

  /** Primary interactive accent (= gold) */
  accent: string;
  /** Warm orbital glow (= goldBright) */
  amber: string;
  /** CTA button fill */
  primary: string;
  /** Text on primary surfaces */
  textOnPrimary: string;

  /** Favorable verdict alias (= maqbool) */
  positive: string;
  /** Denied verdict alias (= mardood) */
  negative: string;

  /** Starfield particle color */
  starfield: string;
  /** Nebula atmospheric colors */
  nebula1: string;
  nebula2: string;
  nebula3: string;

  /** Oracle chat bubbles */
  chatUserBg: string;
  chatUserBorder: string;
  chatShamsBg: string;
  chatShamsBorder: string;

  /** Status bar */
  statusBar: string;
  statusBarStyle: 'light-content' | 'dark-content';

  // ── New atmospheric / pattern tokens ───────────────────────────────────────
  /** Top color of the full-screen atmospheric radial gradient */
  atmTop: string;
  /** Bottom color of the full-screen atmospheric radial gradient */
  atmBot: string;
  /** Jali (Islamic lattice) SVG stroke color */
  jaliStroke: string;
  /** Jali pattern overall opacity (0–1) */
  jaliOpacity: number;
  /**
   * CTA seal gradient — two-stop array [start, end].
   * Use with react-native-linear-gradient when available,
   * or index [0] as a flat backgroundColor fallback.
   */
  sealGradient: [string, string];
  /**
   * Hora card background gradient — two-stop array [start, end].
   */
  horaGradient: [string, string];

  /**
   * Primary-action button gradient — two-stop array [start, end], applied
   * 135deg. Optional: only themes with a gradient CTA (currently
   * sirrAlBanafsaj) populate this; other themes render `primary` as a flat
   * fill same as before.
   */
  primaryGradient?: [string, string];
  /**
   * Flat (non-gradient) icon/logo accent color, for themes whose accent is
   * defined as a gradient elsewhere. Optional — falls back to `accent` when
   * absent.
   */
  iconAccent?: string;
}

/**
 * Home's own look under a theme: the palette of the full-screen panel and the
 * shapes of its widgets. The two premium themes change the shapes as well as
 * the colours; every other theme keeps the original shapes and takes its
 * palette from its colours (see getHomeStyle).
 */
export interface HomePalette {
  /** Panel background (and the status bar on Home). */
  midnight: string;
  /** Raised widgets: tiles, chips, menu, Genie button. */
  deepTeal: string;
  /** Rims, labels and quiet accents. */
  antiqueGold: string;
  /** Bright accent: wordmark, values, icons. */
  champagne: string;
  /** Subdued metal: separators, the Genie's seeker bubbles. */
  bronze: string;
  /** Body text on the panel. */
  ivory: string;
  /** Warm glow behind the emblem. */
  amber: string;
}

export interface HomeStyle {
  palette: HomePalette;
  /** Info tiles: rounded cards, mihrab arches (round top) or cut facets. */
  tileShape: 'rounded' | 'arch' | 'facet';
  /** Info tiles: a 3 × 2 grid of centred tiles, or a 2-column list. */
  tileLayout: 'grid' | 'list';
  /** Sunrise / hora / sunset: pills, round medallions or arch-top tablets. */
  capsule: 'pill' | 'medallion' | 'tablet';
  /** The emblem artwork (see scripts/generate-home-mandala.py). */
  emblem: 'gold' | 'silver' | 'emerald';
}

export interface Theme {
  id: ThemeId;
  labelKey: string;
  name: string;
  subtitle: string;
  isDark: boolean;
  colors: ThemeColors;
  /** Home overrides; anything left out comes from getHomeStyle's defaults. */
  home?: Partial<HomeStyle>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. MIDNIGHT CELESTIAL — Midnight Navy · Antique Gold  (dark, default)
// ─────────────────────────────────────────────────────────────────────────────
// Built from the Home hero's Midnight Celestial palette (its `home.palette` below)
// so the whole app matches the hero by default. Text colours checked against
// bg #061722: text 15.5:1, textMuted 8.1:1, textFaint 6.2:1, and textFaint
// stays above 4.5:1 on surfaceElevated too (5.1:1) (WCAG AA).
const midnightCelestial: Theme = {
  id: 'midnightCelestial',
  labelKey: 'theme.midnightCelestial',
  name: 'Midnight Celestial',
  subtitle: 'Midnight Navy · Antique Gold',
  isDark: true,
  // The Home hero's original palette, exactly.
  home: {
    palette: {
      midnight: '#061722',
      deepTeal: '#0B2735',
      antiqueGold: '#C5A36A',
      champagne: '#F2D9A0',
      bronze: '#80603D',
      ivory: '#F6EBDD',
      amber: '#D89A4A',
    },
  },
  colors: {
    bg: '#061722',
    surface: '#0A1F2C',
    surfaceElevated: '#0F2A3B',
    border: '#1D3547',
    borderAccent: '#C5A36A',

    gold: '#C5A36A',
    goldBright: '#F2D9A0',
    brass: '#80603D',

    maqbool: '#D9B26A',
    maqboolGlow: 'rgba(217, 178, 106, 0.25)',
    mardood: '#6B7F92',
    mardoodGlow: 'rgba(107, 127, 146, 0.15)',
    caution: '#D9B26A',

    text: '#F6EBDD',
    textMuted: '#B8AC94',
    textFaint: '#9C9787',
    textOnGold: '#1A1308',

    celestialDust: '#F2D9A0',
    vellumOverlay: 'rgba(246, 235, 221, 0.03)',
    manuscriptFog: 'rgba(197, 163, 106, 0.08)',
    sacredGlow: '#C5A36A',
    lunarReflection: '#8FA8BE',
    candlelight: '#F2D9A0',

    accent: '#C5A36A',
    amber: '#F2D9A0',
    primary: '#C5A36A',
    textOnPrimary: '#1A1308',
    positive: '#D9B26A',
    negative: '#6B7F92',

    starfield: '#F2D9A0',
    nebula1: 'rgba(197, 163, 106, 0.08)',
    nebula2: 'rgba(30, 70, 95, 0.10)',
    nebula3: 'rgba(242, 217, 160, 0.03)',

    chatUserBg: '#0F2A3B',
    chatUserBorder: '#1D3547',
    chatShamsBg: 'rgba(197, 163, 106, 0.07)',
    chatShamsBorder: '#C5A36A',

    statusBar: '#061722',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(30, 70, 95, 0.22)',
    atmBot: 'rgba(6, 23, 34, 0.0)',
    jaliStroke: '#C5A36A',
    jaliOpacity: 0.05,
    sealGradient: ['#C5A36A', '#F2D9A0'],
    horaGradient: ['rgba(197, 163, 106, 0.12)', 'rgba(197, 163, 106, 0.04)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. DĀR AL-SHAMS — Obsidian · Illuminated Gold  (dark)
// ─────────────────────────────────────────────────────────────────────────────
const darAlShams: Theme = {
  id: 'darAlShams',
  labelKey: 'theme.darAlShams',
  name: 'Dār al-Shams',
  subtitle: 'Obsidian · Illuminated Gold',
  isDark: true,
  colors: {
    bg: '#0A0A0F',
    surface: '#12121A',
    surfaceElevated: '#1A1A26',
    border: '#2A2A38',
    borderAccent: '#C9A961',

    gold: '#C9A961',
    goldBright: '#E8C77D',
    brass: '#9A8350',

    maqbool: '#D4A855',
    maqboolGlow: 'rgba(212, 168, 85, 0.25)',
    mardood: '#6B7C8C',
    mardoodGlow: 'rgba(107, 124, 140, 0.15)',
    caution: '#D4A855',

    text: '#F4EFE3',
    textMuted: '#A89F8C',
    // Raised from #5A5548 (2.66:1) to meet WCAG AA (4.6:1 on bg). Used as
    // TextInput placeholder + faint captions app-wide.
    textFaint: '#7E7A70',
    textOnGold: '#1A1308',

    celestialDust: '#E8C77D',
    vellumOverlay: 'rgba(244, 239, 227, 0.03)',
    manuscriptFog: 'rgba(201, 169, 97, 0.08)',
    sacredGlow: '#C9A961',
    lunarReflection: '#8FA3B8',
    candlelight: '#E8C77D',

    accent: '#C9A961',
    amber: '#E8C77D',
    primary: '#C9A961',
    textOnPrimary: '#1A1308',
    positive: '#D4A855',
    negative: '#6B7C8C',

    starfield: '#E8C77D',
    nebula1: 'rgba(201, 169, 97, 0.08)',
    nebula2: 'rgba(201, 169, 97, 0.05)',
    nebula3: 'rgba(232, 199, 125, 0.03)',

    chatUserBg: '#1A1A26',
    chatUserBorder: '#2A2A38',
    chatShamsBg: 'rgba(201, 169, 97, 0.07)',
    chatShamsBorder: '#C9A961',

    statusBar: '#0A0A0F',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(201, 169, 97, 0.06)',
    atmBot: 'rgba(10, 10, 15, 0.0)',
    jaliStroke: '#C9A961',
    jaliOpacity: 0.055,
    sealGradient: ['#C9A961', '#E8C77D'],
    horaGradient: ['rgba(201, 169, 97, 0.12)', 'rgba(201, 169, 97, 0.04)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. LAYL AL-BAḤR — Midnight Lapis · Sapphire  (dark)
// ─────────────────────────────────────────────────────────────────────────────
const laylAlBahr: Theme = {
  id: 'laylAlBahr',
  labelKey: 'theme.laylAlBahr',
  name: 'Layl al-Baḥr',
  subtitle: 'Midnight · Lapis Lazuli',
  isDark: true,
  colors: {
    bg: '#060810',
    surface: '#0E1020',
    surfaceElevated: '#141828',
    border: '#1E2440',
    borderAccent: '#4A6FA8',

    gold: '#6AAAC8',
    goldBright: '#6B8FCC',
    brass: '#3A5080',

    maqbool: '#4A8A6A',
    maqboolGlow: 'rgba(74, 138, 106, 0.25)',
    mardood: '#8A4A68',
    mardoodGlow: 'rgba(138, 74, 104, 0.15)',
    caution: '#8A7A4A',

    text: '#E0E8F8',
    textMuted: '#8A9AB8',
    // Raised from #3A4460 (2.07:1) to meet WCAG AA (4.6:1 on bg).
    textFaint: '#737A8E',
    textOnGold: '#E0E8F8',

    celestialDust: '#6B8FCC',
    vellumOverlay: 'rgba(224, 232, 248, 0.02)',
    manuscriptFog: 'rgba(74, 111, 168, 0.08)',
    sacredGlow: '#4A6FA8',
    lunarReflection: '#C0CCE8',
    candlelight: '#6B8FCC',

    accent: '#4A6FA8',
    amber: '#6B8FCC',
    primary: '#4A6FA8',
    textOnPrimary: '#E0E8F8',
    positive: '#4A8A6A',
    negative: '#8A4A68',

    starfield: '#6B8FCC',
    nebula1: 'rgba(74, 111, 168, 0.08)',
    nebula2: 'rgba(74, 111, 168, 0.05)',
    nebula3: 'rgba(107, 143, 204, 0.03)',

    chatUserBg: '#141828',
    chatUserBorder: '#1E2440',
    chatShamsBg: 'rgba(74, 111, 168, 0.07)',
    chatShamsBorder: '#4A6FA8',

    statusBar: '#060810',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(74, 111, 168, 0.07)',
    atmBot: 'rgba(6, 8, 16, 0.0)',
    jaliStroke: '#4A6FA8',
    jaliOpacity: 0.055,
    sealGradient: ['#4A6FA8', '#6B8FCC'],
    horaGradient: ['rgba(74, 111, 168, 0.12)', 'rgba(74, 111, 168, 0.04)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. NĀR AL-ḤADĪD — Iron-Black · Crimson  (dark)
// ─────────────────────────────────────────────────────────────────────────────
const narAlHadid: Theme = {
  id: 'narAlHadid',
  labelKey: 'theme.narAlHadid',
  name: 'Nār al-Ḥadīd',
  subtitle: 'Iron Black · Crimson',
  isDark: true,
  colors: {
    bg: '#0F0A08',
    surface: '#1A100C',
    surfaceElevated: '#221410',
    border: '#382018',
    borderAccent: '#A03028',

    gold: '#A03028',
    goldBright: '#CC4038',
    brass: '#6A4030',

    maqbool: '#8A7040',
    maqboolGlow: 'rgba(138, 112, 64, 0.25)',
    mardood: '#C04838',
    mardoodGlow: 'rgba(192, 72, 56, 0.15)',
    caution: '#B07830',

    text: '#F8F0EE',
    textMuted: '#A08880',
    // Raised from #504030 (1.98:1) to meet WCAG AA (4.6:1 on bg).
    textFaint: '#84796E',
    textOnGold: '#F8F0EE',

    celestialDust: '#CC4038',
    vellumOverlay: 'rgba(248, 240, 238, 0.02)',
    manuscriptFog: 'rgba(160, 48, 40, 0.08)',
    sacredGlow: '#A03028',
    lunarReflection: '#C0A8A0',
    candlelight: '#CC4038',

    accent: '#A03028',
    amber: '#CC4038',
    primary: '#A03028',
    textOnPrimary: '#F8F0EE',
    positive: '#8A7040',
    negative: '#C04838',

    starfield: '#CC4038',
    nebula1: 'rgba(160, 48, 40, 0.08)',
    nebula2: 'rgba(160, 48, 40, 0.05)',
    nebula3: 'rgba(204, 64, 56, 0.03)',

    chatUserBg: '#221410',
    chatUserBorder: '#382018',
    chatShamsBg: 'rgba(160, 48, 40, 0.07)',
    chatShamsBorder: '#A03028',

    statusBar: '#0F0A08',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(160, 48, 40, 0.07)',
    atmBot: 'rgba(15, 10, 8, 0.0)',
    jaliStroke: '#A03028',
    jaliOpacity: 0.055,
    sealGradient: ['#A03028', '#CC4038'],
    horaGradient: ['rgba(160, 48, 40, 0.12)', 'rgba(160, 48, 40, 0.04)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. ṢUBḤ AL-WAḤY — Dawn Parchment · Antique Gold  (light)
// ─────────────────────────────────────────────────────────────────────────────
const subhAlWahy: Theme = {
  id: 'subhAlWahy',
  labelKey: 'theme.subhAlWahy',
  name: 'Ṣubḥ al-Waḥy',
  subtitle: 'Dawn · Antique Parchment',
  isDark: false,
  colors: {
    bg: '#FAF6EF',
    surface: '#F4EDE0',
    surfaceElevated: '#EDE4D3',
    border: '#D4C4A0',
    borderAccent: '#B8943C',

    gold: '#B8943C',
    goldBright: '#D4AA4E',
    brass: '#8B6F3C',

    maqbool: '#7A9A50',
    maqboolGlow: 'rgba(122, 154, 80, 0.20)',
    mardood: '#8C4A3C',
    mardoodGlow: 'rgba(140, 74, 60, 0.15)',
    caution: '#B8943C',

    text: '#2A1F0E',
    textMuted: '#6B5A3C',
    // Darkened from #9A8A6A (3.14:1) to meet WCAG AA (4.6:1 on light bg).
    textFaint: '#7B6E55',
    textOnGold: '#FAF6EF',

    celestialDust: '#D4AA4E',
    vellumOverlay: 'rgba(42, 31, 14, 0.03)',
    manuscriptFog: 'rgba(184, 148, 60, 0.06)',
    sacredGlow: '#B8943C',
    lunarReflection: '#8090A0',
    candlelight: '#D4AA4E',

    accent: '#B8943C',
    amber: '#D4AA4E',
    primary: '#B8943C',
    textOnPrimary: '#FAF6EF',
    positive: '#7A9A50',
    negative: '#8C4A3C',

    starfield: '#D4AA4E',
    nebula1: 'rgba(184, 148, 60, 0.06)',
    nebula2: 'rgba(184, 148, 60, 0.04)',
    nebula3: 'rgba(212, 170, 78, 0.02)',

    chatUserBg: '#EDE4D3',
    chatUserBorder: '#D4C4A0',
    chatShamsBg: 'rgba(184, 148, 60, 0.06)',
    chatShamsBorder: '#B8943C',

    statusBar: '#FAF6EF',
    statusBarStyle: 'dark-content',

    atmTop: 'rgba(184, 148, 60, 0.05)',
    atmBot: 'rgba(250, 246, 239, 0.0)',
    jaliStroke: '#B8943C',
    jaliOpacity: 0.07,
    sealGradient: ['#B8943C', '#D4AA4E'],
    horaGradient: ['rgba(184, 148, 60, 0.10)', 'rgba(184, 148, 60, 0.03)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. ZAYTŪN AL-ḤIKMA — Sage Garden · Olive Ink  (light)
// ─────────────────────────────────────────────────────────────────────────────
const zaytunAlHikma: Theme = {
  id: 'zaytunAlHikma',
  labelKey: 'theme.zaytunAlHikma',
  name: 'Zaytūn al-Ḥikma',
  subtitle: 'Sage Garden · Olive',
  isDark: false,
  colors: {
    bg: '#F4F7F0',
    surface: '#EBF1E5',
    surfaceElevated: '#E0EAD6',
    border: '#BFCFB0',
    borderAccent: '#5A7A45',

    gold: '#5A7A45',
    goldBright: '#7EA05C',
    brass: '#4A6038',

    maqbool: '#5A7A45',
    maqboolGlow: 'rgba(90, 122, 69, 0.20)',
    mardood: '#7A4A38',
    mardoodGlow: 'rgba(122, 74, 56, 0.15)',
    caution: '#A07840',

    text: '#1A2A14',
    textMuted: '#4A6038',
    // Darkened from #7A9068 (3.23:1) to meet WCAG AA (4.6:1 on light bg).
    textFaint: '#637554',
    textOnGold: '#F4F7F0',

    celestialDust: '#7EA05C',
    vellumOverlay: 'rgba(26, 42, 20, 0.03)',
    manuscriptFog: 'rgba(90, 122, 69, 0.05)',
    sacredGlow: '#5A7A45',
    lunarReflection: '#7A90A0',
    candlelight: '#7EA05C',

    accent: '#5A7A45',
    amber: '#7EA05C',
    primary: '#5A7A45',
    textOnPrimary: '#F4F7F0',
    positive: '#5A7A45',
    negative: '#7A4A38',

    starfield: '#7EA05C',
    nebula1: 'rgba(90, 122, 69, 0.06)',
    nebula2: 'rgba(90, 122, 69, 0.04)',
    nebula3: 'rgba(126, 160, 92, 0.02)',

    chatUserBg: '#E0EAD6',
    chatUserBorder: '#BFCFB0',
    chatShamsBg: 'rgba(90, 122, 69, 0.06)',
    chatShamsBorder: '#5A7A45',

    statusBar: '#F4F7F0',
    statusBarStyle: 'dark-content',

    atmTop: 'rgba(90, 122, 69, 0.05)',
    atmBot: 'rgba(244, 247, 240, 0.0)',
    jaliStroke: '#5A7A45',
    jaliOpacity: 0.07,
    sealGradient: ['#5A7A45', '#7EA05C'],
    horaGradient: ['rgba(90, 122, 69, 0.10)', 'rgba(90, 122, 69, 0.03)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. SIRR AL-BANAFSAJ — Violet Secret · Indigo Dusk  (dark)
// ─────────────────────────────────────────────────────────────────────────────
// Color-only theme — typography (Cinzel / Cormorant Garamond / Amiri) is
// untouched, same as every other theme here.
const sirrAlBanafsaj: Theme = {
  id: 'sirrAlBanafsaj',
  labelKey: 'theme.sirrAlBanafsaj',
  name: 'Sirr al-Banafsaj',
  subtitle: 'Violet Secret · Indigo Dusk',
  isDark: true,
  colors: {
    bg: '#0B0A14',
    surface: '#141225',
    surfaceElevated: '#1C1938',
    border: '#3D3A55',
    borderAccent: '#7C3AED',

    gold: '#A78BFA',
    goldBright: '#C4B5FD',
    brass: '#5B5478',

    maqbool: '#4ADE80',
    maqboolGlow: 'rgba(74, 222, 128, 0.22)',
    mardood: '#6B6478',
    mardoodGlow: 'rgba(107, 100, 120, 0.18)',
    caution: '#818CF8',

    text: '#F4F4F8',
    textMuted: '#9490A8',
    textFaint: '#7D7892',
    textOnGold: '#1E1B2E',

    celestialDust: '#C4B5FD',
    vellumOverlay: 'rgba(244, 244, 248, 0.03)',
    manuscriptFog: 'rgba(124, 58, 237, 0.08)',
    sacredGlow: '#7C3AED',
    lunarReflection: '#A9B4E0',
    candlelight: '#60A5FA',

    accent: '#A78BFA',
    amber: '#C4B5FD',
    primary: '#7C3AED',
    textOnPrimary: '#F4F4F8',
    positive: '#4ADE80',
    negative: '#6B6478',

    starfield: '#C4B5FD',
    nebula1: 'rgba(124, 58, 237, 0.08)',
    nebula2: 'rgba(124, 58, 237, 0.05)',
    nebula3: 'rgba(196, 181, 253, 0.03)',

    chatUserBg: '#1C1938',
    chatUserBorder: '#3D3A55',
    chatShamsBg: 'rgba(124, 58, 237, 0.07)',
    chatShamsBorder: '#7C3AED',

    statusBar: '#0B0A14',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(124, 58, 237, 0.07)',
    atmBot: 'rgba(11, 10, 20, 0.0)',
    jaliStroke: '#7C3AED',
    jaliOpacity: 0.055,
    sealGradient: ['#7C3AED', '#3B82F6'],
    horaGradient: ['rgba(124, 58, 237, 0.12)', 'rgba(124, 58, 237, 0.04)'],

    // Buttons only — primary CTAs (e.g. "Seal & Ask the Oracle" / "Ask New
    // Question") render this gradient where a gradient renderer is
    // available; `primary` above is the flat 135deg-start fallback used
    // everywhere else in the app today (no gradient dependency installed).
    primaryGradient: ['#7C3AED', '#3B82F6'],
    // Flat, non-gradient icon/logo accent (same value as `gold`/`accent`,
    // named separately per the design brief).
    iconAccent: '#A78BFA',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. QUTB AL-ANWAR — Platinum · Axis of Lights (dark) — Khāṣṣ exclusive
// ─────────────────────────────────────────────────────────────────────────────
const qutbAlAnwar: Theme = {
  id: 'qutbAlAnwar',
  labelKey: 'theme.qutbAlAnwar',
  name: 'Quṭb al-Anwār',
  subtitle: 'Platinum · Axis of Lights',
  isDark: true,
  colors: {
    bg: '#07080B',
    surface: '#0F1116',
    surfaceElevated: '#171A20',
    border: '#262A32',
    borderAccent: '#D6DAE2',

    gold: '#D6DAE2',
    goldBright: '#F2F4F8',
    brass: '#9CA3AF',

    maqbool: '#7FE0C4',
    maqboolGlow: 'rgba(127, 224, 196, 0.25)',
    mardood: '#C0526B',
    mardoodGlow: 'rgba(192, 82, 107, 0.15)',
    caution: '#E8B34A',

    text: '#F0F2F6',
    textMuted: '#9AA0AC',
    // Same WCAG-AA reasoning as darAlShams's textFaint: mid-gray against a
    // near-black bg comfortably clears 4.5:1.
    textFaint: '#7D828E',
    textOnGold: '#0C0D10',

    celestialDust: '#D6DAE2',
    vellumOverlay: 'rgba(240, 242, 246, 0.03)',
    manuscriptFog: 'rgba(214, 218, 226, 0.08)',
    sacredGlow: '#D6DAE2',
    lunarReflection: '#8FA8C2',
    candlelight: '#F2F4F8',

    accent: '#D6DAE2',
    amber: '#F2F4F8',
    primary: '#D6DAE2',
    textOnPrimary: '#0C0D10',
    positive: '#7FE0C4',
    negative: '#C0526B',

    starfield: '#D6DAE2',
    nebula1: 'rgba(214, 218, 226, 0.08)',
    nebula2: 'rgba(214, 218, 226, 0.05)',
    nebula3: 'rgba(242, 244, 248, 0.03)',

    chatUserBg: '#171A20',
    chatUserBorder: '#262A32',
    chatShamsBg: 'rgba(214, 218, 226, 0.07)',
    chatShamsBorder: '#D6DAE2',

    statusBar: '#07080B',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(214, 218, 226, 0.06)',
    atmBot: 'rgba(7, 8, 11, 0.0)',
    jaliStroke: '#D6DAE2',
    jaliOpacity: 0.055,
    sealGradient: ['#D6DAE2', '#F2F4F8'],
    horaGradient: ['rgba(214, 218, 226, 0.12)', 'rgba(214, 218, 226, 0.04)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. KANZ AL-ASRĀR — Emerald · Treasure of Secrets (dark) — Khāṣṣ exclusive
// ─────────────────────────────────────────────────────────────────────────────
const kanzAlAsrar: Theme = {
  id: 'kanzAlAsrar',
  labelKey: 'theme.kanzAlAsrar',
  name: 'Kanz al-Asrār',
  subtitle: 'Emerald · Treasure of Secrets',
  isDark: true,
  colors: {
    bg: '#070B09',
    surface: '#0E1512',
    surfaceElevated: '#16201B',
    border: '#22302A',
    borderAccent: '#D9A066',

    gold: '#D9A066',
    goldBright: '#F0BE8A',
    brass: '#A67A4C',

    maqbool: '#4FAE7A',
    maqboolGlow: 'rgba(79, 174, 122, 0.25)',
    mardood: '#B2483E',
    mardoodGlow: 'rgba(178, 72, 62, 0.15)',
    caution: '#C98A3E',

    text: '#F2EAE0',
    textMuted: '#A69B8C',
    textFaint: '#7E7466',
    textOnGold: '#1A1108',

    celestialDust: '#D9A066',
    vellumOverlay: 'rgba(242, 234, 224, 0.03)',
    manuscriptFog: 'rgba(217, 160, 102, 0.08)',
    sacredGlow: '#D9A066',
    lunarReflection: '#7FA88F',
    candlelight: '#F0BE8A',

    accent: '#D9A066',
    amber: '#F0BE8A',
    primary: '#D9A066',
    textOnPrimary: '#1A1108',
    positive: '#4FAE7A',
    negative: '#B2483E',

    starfield: '#D9A066',
    nebula1: 'rgba(217, 160, 102, 0.08)',
    nebula2: 'rgba(217, 160, 102, 0.05)',
    nebula3: 'rgba(240, 190, 138, 0.03)',

    chatUserBg: '#16201B',
    chatUserBorder: '#22302A',
    chatShamsBg: 'rgba(217, 160, 102, 0.07)',
    chatShamsBorder: '#D9A066',

    statusBar: '#070B09',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(217, 160, 102, 0.06)',
    atmBot: 'rgba(7, 11, 9, 0.0)',
    jaliStroke: '#D9A066',
    jaliOpacity: 0.055,
    sealGradient: ['#D9A066', '#F0BE8A'],
    horaGradient: ['rgba(217, 160, 102, 0.12)', 'rgba(217, 160, 102, 0.04)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM · QAMAR AL-FIḌḌA — Moonlit Silver · Indigo Night  (dark, Mureed)
// ─────────────────────────────────────────────────────────────────────────────
// Silver instead of gold, and different shapes on Home: cut-facet tiles in a
// two-column list, round medallion capsules and the silver emblem.
// Contrast on bg #0B0F1A: text 17.0:1, muted 9.1:1, faint 6.7:1 (5.6:1 on
// surfaceElevated).
const qamarAlFidda: Theme = {
  id: 'qamarAlFidda',
  labelKey: 'theme.qamarAlFidda',
  name: 'Qamar al-Fiḍḍa',
  subtitle: 'Moonlit Silver · Indigo Night',
  isDark: true,
  home: {
    palette: {
      midnight: '#0B0F1A',
      deepTeal: '#18203A',
      antiqueGold: '#C9D3E3',
      champagne: '#F1F5FB',
      bronze: '#4B5873',
      ivory: '#EEF2F8',
      amber: '#9FB4D6',
    },
    tileShape: 'facet',
    tileLayout: 'list',
    capsule: 'medallion',
    emblem: 'silver',
  },
  colors: {
    bg: '#0B0F1A',
    surface: '#121828',
    surfaceElevated: '#1A2236',
    border: '#2A3550',
    borderAccent: '#C9D3E3',

    gold: '#C9D3E3',
    goldBright: '#F1F5FB',
    brass: '#7D8AA3',

    maqbool: '#BFD4F2',
    maqboolGlow: 'rgba(191, 212, 242, 0.22)',
    mardood: '#8A8FA3',
    mardoodGlow: 'rgba(138, 143, 163, 0.15)',
    caution: '#D9C9A0',

    text: '#EEF2F8',
    textMuted: '#A9B4C7',
    textFaint: '#8E9AB0',
    textOnGold: '#0B0F1A',

    celestialDust: '#F1F5FB',
    vellumOverlay: 'rgba(238, 242, 248, 0.03)',
    manuscriptFog: 'rgba(201, 211, 227, 0.07)',
    sacredGlow: '#C9D3E3',
    lunarReflection: '#9FB4D6',
    candlelight: '#F1F5FB',

    accent: '#C9D3E3',
    amber: '#F1F5FB',
    primary: '#C9D3E3',
    textOnPrimary: '#0B0F1A',
    positive: '#BFD4F2',
    negative: '#8A8FA3',

    starfield: '#F1F5FB',
    nebula1: 'rgba(159, 180, 214, 0.08)',
    nebula2: 'rgba(40, 52, 90, 0.12)',
    nebula3: 'rgba(241, 245, 251, 0.03)',

    chatUserBg: '#1A2236',
    chatUserBorder: '#2A3550',
    chatShamsBg: 'rgba(201, 211, 227, 0.07)',
    chatShamsBorder: '#C9D3E3',

    statusBar: '#0B0F1A',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(40, 52, 90, 0.24)',
    atmBot: 'rgba(11, 15, 26, 0.0)',
    jaliStroke: '#C9D3E3',
    jaliOpacity: 0.05,
    sealGradient: ['#C9D3E3', '#F1F5FB'],
    horaGradient: ['rgba(201, 211, 227, 0.12)', 'rgba(201, 211, 227, 0.04)'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM · ZUMURRUD AL-MALAKŪT — Emerald · Royal Gold  (dark, Khāṣṣ)
// ─────────────────────────────────────────────────────────────────────────────
// Emerald and gold, with mihrab-arch tiles, arch-top tablet capsules and the
// emerald emblem on Home.
// Contrast on bg #04140F: text 16.2:1, muted 9.1:1, faint 6.9:1 (5.5:1 on
// surfaceElevated).
const zumurrudAlMalakut: Theme = {
  id: 'zumurrudAlMalakut',
  labelKey: 'theme.zumurrudAlMalakut',
  name: 'Zumurrud al-Malakūt',
  subtitle: 'Emerald · Royal Gold',
  isDark: true,
  home: {
    palette: {
      midnight: '#04140F',
      deepTeal: '#0E3326',
      antiqueGold: '#D4AF5A',
      champagne: '#F3DC9A',
      bronze: '#7A5A26',
      ivory: '#F2EEDF',
      amber: '#5FBF92',
    },
    tileShape: 'arch',
    tileLayout: 'grid',
    capsule: 'tablet',
    emblem: 'emerald',
  },
  colors: {
    bg: '#04140F',
    surface: '#08201A',
    surfaceElevated: '#0D2C23',
    border: '#1C4537',
    borderAccent: '#D4AF5A',

    gold: '#D4AF5A',
    goldBright: '#F3DC9A',
    brass: '#8A6A30',

    maqbool: '#E2C072',
    maqboolGlow: 'rgba(226, 192, 114, 0.25)',
    mardood: '#7E9A8E',
    mardoodGlow: 'rgba(126, 154, 142, 0.15)',
    caution: '#E2C072',

    text: '#F2EEDF',
    textMuted: '#B8B59C',
    textFaint: '#97A08A',
    textOnGold: '#04140F',

    celestialDust: '#F3DC9A',
    vellumOverlay: 'rgba(242, 238, 223, 0.03)',
    manuscriptFog: 'rgba(212, 175, 90, 0.08)',
    sacredGlow: '#D4AF5A',
    lunarReflection: '#5FBF92',
    candlelight: '#F3DC9A',

    accent: '#D4AF5A',
    amber: '#F3DC9A',
    primary: '#D4AF5A',
    textOnPrimary: '#04140F',
    positive: '#E2C072',
    negative: '#7E9A8E',

    starfield: '#F3DC9A',
    nebula1: 'rgba(212, 175, 90, 0.08)',
    nebula2: 'rgba(20, 90, 67, 0.12)',
    nebula3: 'rgba(243, 220, 154, 0.03)',

    chatUserBg: '#0D2C23',
    chatUserBorder: '#1C4537',
    chatShamsBg: 'rgba(212, 175, 90, 0.07)',
    chatShamsBorder: '#D4AF5A',

    statusBar: '#04140F',
    statusBarStyle: 'light-content',

    atmTop: 'rgba(20, 90, 67, 0.24)',
    atmBot: 'rgba(4, 20, 15, 0.0)',
    jaliStroke: '#D4AF5A',
    jaliOpacity: 0.05,
    sealGradient: ['#D4AF5A', '#F3DC9A'],
    horaGradient: ['rgba(212, 175, 90, 0.12)', 'rgba(212, 175, 90, 0.04)'],
  },
};

export const THEMES: Readonly<Record<ThemeId, Theme>> = Object.freeze({
  midnightCelestial,
  darAlShams,
  laylAlBahr,
  narAlHadid,
  subhAlWahy,
  zaytunAlHikma,
  sirrAlBanafsaj,
  qutbAlAnwar,
  kanzAlAsrar,
  qamarAlFidda,
  zumurrudAlMalakut,
});

export const THEME_IDS: readonly ThemeId[] = [
  'midnightCelestial',
  'darAlShams',
  'laylAlBahr',
  'narAlHadid',
  'subhAlWahy',
  'zaytunAlHikma',
  'sirrAlBanafsaj',
  'qutbAlAnwar',
  'kanzAlAsrar',
  'qamarAlFidda',
  'zumurrudAlMalakut',
];

/**
 * The themes offered in the theme picker (owner decision): three colour
 * themes and the two premium themes. Every other theme still exists and still works — a user already
 * on one keeps it, and the picker shows it while it is active so they can see
 * what they are on — but it is no longer offered.
 */
export const VISIBLE_THEME_IDS: readonly ThemeId[] = [
  'midnightCelestial',
  'darAlShams',
  'laylAlBahr',
  'qamarAlFidda',
  'zumurrudAlMalakut',
];

/** The picker's list: the visible themes, plus the active one if it is hidden. */
export function pickerThemeIds(activeId: ThemeId): readonly ThemeId[] {
  return VISIBLE_THEME_IDS.includes(activeId)
    ? VISIBLE_THEME_IDS
    : [...VISIBLE_THEME_IDS, activeId];
}

// New installs start in Midnight Celestial. Existing users keep whatever theme
// is already persisted (ThemeProvider writes the active id on first launch).
export const DEFAULT_THEME_ID: ThemeId = 'midnightCelestial';

/**
 * The minimum plan tier that unlocks each theme. midnightCelestial (the
 * default) and darAlShams are free; the original five colour variants require Mureed;
 * qutbAlAnwar and kanzAlAsrar require Khāṣṣ; of the two premium themes,
 * Qamar al-Fiḍḍa requires Mureed and Zumurrud al-Malakūt requires Khāṣṣ.
 *
 * Kept here (not in quotaStore) because it's a property of the theme, not
 * of the plan — quotaStore has no reason to know which themes exist.
 */
export const THEME_TIER: Readonly<Record<ThemeId, PlanTier>> = Object.freeze({
  midnightCelestial: 'free',
  darAlShams: 'free',
  laylAlBahr: 'mureed',
  narAlHadid: 'mureed',
  subhAlWahy: 'mureed',
  zaytunAlHikma: 'mureed',
  sirrAlBanafsaj: 'mureed',
  qutbAlAnwar: 'khass',
  kanzAlAsrar: 'khass',
  qamarAlFidda: 'mureed',
  zumurrudAlMalakut: 'khass',
});

const TIER_RANK: Readonly<Record<PlanTier, number>> = Object.freeze({
  free: 0,
  mureed: 1,
  khass: 2,
});

/** Does `userTier` unlock a theme that requires `requiredTier`? */
export function tierMeetsRequirement(userTier: PlanTier, requiredTier: PlanTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/**
 * TEMPORARY — internal testing only. When true, every theme is selectable
 * regardless of plan, so testers can see all 11 (including the Khāṣṣ
 * exclusives) without needing a live subscription on the test account.
 *
 * THEME_TIER and tierMeetsRequirement() are untouched and fully tested
 * (see themeTiers.test.ts) — flip this back to `false` to re-enable real
 * gating once testing concludes. That one-line flip is the entire revert;
 * nothing else needs to change.
 */
const TESTING_MODE_ALL_THEMES_UNLOCKED = true;

/** Is this theme selectable by a user on `userTier`? */
export function isThemeUnlocked(id: ThemeId, userTier: PlanTier): boolean {
  if (TESTING_MODE_ALL_THEMES_UNLOCKED) {
    return true;
  }
  return tierMeetsRequirement(userTier, THEME_TIER[id]);
}

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

/**
 * Home's look under a theme. Themes without an explicit palette take one from
 * their colours (bg, surfaceElevated, gold, goldBright, brass, text, amber),
 * and the original shapes and gold emblem.
 */
export function getHomeStyle(theme: Theme): HomeStyle {
  const c = theme.colors;
  return {
    palette: theme.home?.palette ?? {
      midnight: c.bg,
      deepTeal: c.surfaceElevated,
      antiqueGold: c.gold,
      champagne: c.goldBright,
      bronze: c.brass,
      ivory: c.text,
      amber: c.amber,
    },
    tileShape: theme.home?.tileShape ?? 'rounded',
    tileLayout: theme.home?.tileLayout ?? 'grid',
    capsule: theme.home?.capsule ?? 'pill',
    emblem: theme.home?.emblem ?? 'gold',
  };
}

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared design tokens — spacing / radius / shadow / motion
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
  rest: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  glow: {
    shadowColor: '#C9A961',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});

export const MOTION = Object.freeze({
  fast: 180,
  base: 320,
  slow: 480,
  splash: 3200,
  breathe: 8000,
});
