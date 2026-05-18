/**
 * Shams al-Asrār — DĀR AL-SHAMS Master Theme System
 * "The House of the Hidden Sun"
 * --------------------------------------------------------------------------
 * A living manuscript chamber. Sacred observatory aesthetic.
 * 
 * VISUAL PHILOSOPHY:
 * - Obsidian manuscript black (not true black)
 * - Illuminated gold (Quranic manuscript edging, brass astrolabe)
 * - Vellum grain texture energy
 * - Candlelight/lantern glow lighting
 * - Ceremonial silence, weight, gravity, ritual
 * 
 * The app is physically interpreted as:
 * - An illuminated Islamic manuscript
 * - An astronomical observatory  
 * - A sacred oracle engine
 * 
 * NOT: modern-minimal startup, neon cyberpunk, fantasy game UI, generic astrology app
 * 
 * Single canonical theme. No theme switching in v1.
 */

export type ThemeId = 'darAlShams';

export interface ThemeColors {
  /** Obsidian manuscript black — deepest background */
  bg: string;
  /** Elevated manuscript surface (cards, parchment strips) */
  surface: string;
  /** Highest elevation (modals, sealed verdicts) */
  surfaceElevated: string;
  /** Manuscript ruling lines, geometric separators */
  border: string;
  /** Illuminated gold border (sacred seals, focus states) */
  borderAccent: string;

  /** Illuminated gold — primary sacred accent */
  gold: string;
  /** Brighter gold glow — active hora, divine names */
  goldBright: string;
  /** Aged brass — astrolabe metal, subdued gold */
  brass: string;
  
  /** MAQBOOL state — warm amber acceptance */
  maqbool: string;
  /** MAQBOOL atmosphere — soft golden diffusion */
  maqboolGlow: string;
  /** MARDOOD state — cool restrained moonlight */
  mardood: string;
  /** MARDOOD atmosphere — blue-black shadow */
  mardoodGlow: string;
  
  /** Caution / conditional verdict */
  caution: string;

  /** Primary text — manuscript ink on vellum */
  text: string;
  /** Secondary text — aged ink, muted */
  textMuted: string;
  /** Tertiary text — faint inscription */
  textFaint: string;
  /** Text on gold surfaces */
  textOnGold: string;

  /** Celestial dust — starfield particles */
  celestialDust: string;
  /** Vellum texture overlay */
  vellumOverlay: string;
  /** Manuscript fog — atmospheric haze */
  manuscriptFog: string;
  
  /** Sacred glow color (breathing pulse on medallions) */
  sacredGlow: string;
  /** Lunar reflection — moon mansion markers */
  lunarReflection: string;
  /** Candlelight warm — ambient lighting */
  candlelight: string;

  /** Primary interactive accent — semantic alias for gold */
  accent: string;
  /** Warm highlight / orbital glow — semantic alias for goldBright */
  amber: string;

  /** Primary CTA button fill — semantic alias for gold */
  primary: string;
  /** Text on primary-colored surfaces — semantic alias for textOnGold */
  textOnPrimary: string;

  /** Positive / favorable verdict state — semantic alias for maqbool */
  positive: string;
  /** Negative / denied verdict state — semantic alias for mardood */
  negative: string;

  /** Starfield particle color — semantic alias for celestialDust */
  starfield: string;
  /** Nebula cloud colors — atmospheric foggy blobs behind the starfield */
  nebula1: string;
  nebula2: string;
  nebula3: string;

  /** Oracle chat bubble colors */
  chatUserBg: string;
  chatUserBorder: string;
  chatShamsBg: string;
  chatShamsBorder: string;

  /** Status bar */
  statusBar: string;
  statusBarStyle: 'light-content' | 'dark-content';
}

export interface Theme {
  id: ThemeId;
  /** Localized display label is resolved via i18n; this is the i18n key */
  labelKey: string;
  /** Short display name shown in the in-app theme picker card */
  name: string;
  /** Two-word palette subtitle shown under the name card */
  subtitle: string;
  /** Whether RN should compute light or dark contrast defaults */
  isDark: boolean;
  colors: ThemeColors;
}

// ─────────────────────────────────────────────────────────────────────────────
// DĀR AL-SHAMS — The House of the Hidden Sun
// ─────────────────────────────────────────────────────────────────────────────
const darAlShams: Theme = {
  id: 'darAlShams',
  labelKey: 'theme.darAlShams',
  name: 'Dār al-Shams',
  subtitle: 'Obsidian · Illuminated Gold',
  isDark: true,
  colors: {
    // OBSIDIAN MANUSCRIPT BLACK
    // Not true black — charcoal-black, soot-black, deep blue-black, aged ink-black
    bg: '#0A0A0F',              // Deep blue-black void
    surface: '#12121A',          // Elevated manuscript page
    surfaceElevated: '#1A1A26',  // Sealed verdict container
    border: '#2A2A38',           // Manuscript ruling lines
    borderAccent: '#C9A961',     // Illuminated gold edging

    // ILLUMINATED GOLD
    // Quranic manuscript edging, brass astrolabe reflections, aged coin metal
    gold: '#C9A961',             // Primary sacred gold
    goldBright: '#E8C77D',       // Active glow state
    brass: '#9A8350',            // Subdued aged brass
    
    // VERDICT STATES
    // MAQBOOL: warm gold atmosphere, soft amber diffusion, light descending
    maqbool: '#D4A855',          // Warm acceptance gold
    maqboolGlow: 'rgba(212, 168, 85, 0.25)',  // Soft golden atmosphere
    
    // MARDOOD: cool restrained darkness, muted bronze, moonlight blue-black
    mardood: '#6B7C8C',          // Cool moonlight blue-gray
    mardoodGlow: 'rgba(107, 124, 140, 0.15)', // Blue-black shadow
    
    caution: '#D4A855',          // Conditional verdict (same as maqbool)

    // MANUSCRIPT INK
    text: '#F4EFE3',             // Cream manuscript ink
    textMuted: '#A89F8C',        // Aged ink, faded
    textFaint: '#5A5548',        // Barely visible inscription
    textOnGold: '#1A1308',       // Dark text on gold surfaces

    // ATMOSPHERIC ELEMENTS
    celestialDust: '#E8C77D',    // Golden starfield particles
    vellumOverlay: 'rgba(244, 239, 227, 0.03)', // Subtle vellum grain
    manuscriptFog: 'rgba(201, 169, 97, 0.08)',  // Low-opacity celestial fog
    
    sacredGlow: '#C9A961',       // Breathing pulse on medallions (6-10s cycle)
    lunarReflection: '#8FA3B8',  // Moon mansion markers
    candlelight: '#E8C77D',      // Warm ambient glow

    // SEMANTIC ALIASES — keep in sync with palette values above
    accent: '#C9A961',            // Primary interactive color (= gold)
    amber: '#E8C77D',             // Warm orbital glow (= goldBright)
    primary: '#C9A961',           // CTA button fill (= gold)
    textOnPrimary: '#1A1308',     // Text on gold buttons (= textOnGold)
    positive: '#D4A855',          // Favorable verdict (= maqbool)
    negative: '#6B7C8C',          // Denied verdict / form errors (= mardood)

    // STARFIELD ATMOSPHERE
    starfield: '#E8C77D',                       // Golden star particles (= goldBright)
    nebula1: 'rgba(201, 169, 97, 0.08)',        // Primary gold nebula cloud
    nebula2: 'rgba(201, 169, 97, 0.05)',        // Secondary dimmer nebula
    nebula3: 'rgba(232, 199, 125, 0.03)',       // Amber wash nebula

    // ORACLE CHAT BUBBLES
    chatUserBg: '#1A1A26',                      // User bubble — surfaceElevated
    chatUserBorder: '#2A2A38',                  // User bubble border — border
    chatShamsBg: 'rgba(201, 169, 97, 0.07)',    // Shams bubble — faint gold wash
    chatShamsBorder: '#C9A961',                 // Shams bubble border — gold accent

    statusBar: '#0A0A0F',
    statusBarStyle: 'light-content',
  },
};



// ─────────────────────────────────────────────────────────────────────────────
// Registry — Single canonical theme
// ─────────────────────────────────────────────────────────────────────────────
export const THEMES: Readonly<Record<ThemeId, Theme>> = Object.freeze({
  darAlShams,
});

export const THEME_IDS: readonly ThemeId[] = ['darAlShams'];

export const DEFAULT_THEME_ID: ThemeId = 'darAlShams';

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
  /** Glow used on accent borders (gold seal, active cards) */
  glow: {
    shadowColor: '#C9A961',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
});

export const MOTION = Object.freeze({
  /** Microinteractions — seal press, subtle resonance */
  fast: 180,
  /** Standard transitions — fade, drift, breathing */
  base: 320,
  /** Hero transitions — orbital motion, celestial rotation */
  slow: 480,
  /** Splash ritual awakening — gold dust emergence */
  splash: 3200,
  /** Sacred breathing pulse — medallion glow cycle */
  breathe: 8000,
});
