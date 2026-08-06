/**
 * siderealPositions — shared mean-longitude sidereal astronomy helpers.
 * --------------------------------------------------------------------------
 * Extracted from SkyClockScreen so the home dashboard's Moon Watch / VoC /
 * sunrise-sunset cards use the exact same math as Al-Falak instead of a
 * second, potentially drifting implementation.
 *
 * These are MEAN-longitude approximations (±1–5°), display only — the real
 * KP horary judgment always runs the full Moshier ephemeris server-side.
 */

export const SIGN_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

export const NAKSHATRAS: readonly string[] = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishtha',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
];

export function mod360(x: number): number {
  return ((x % 360) + 360) % 360;
}

export const LAHIRI_AYANAMSA_2025 = 24.12;

// Mean longitude elements (J2000.0) — display only, ±1–5° error.
export const J2K: Readonly<Record<string, { L0: number; Lr: number }>> = {
  Sun: { L0: 280.46646, Lr: 36000.76983 },
  Moon: { L0: 218.3165, Lr: 481267.8813 },
  Mercury: { L0: 252.2509, Lr: 149472.6749 },
  Venus: { L0: 181.9798, Lr: 58517.8156 },
  Mars: { L0: 355.433, Lr: 19140.2993 },
  Jupiter: { L0: 34.3515, Lr: 3034.9057 },
  Saturn: { L0: 50.0774, Lr: 1222.1138 },
};

// Spec order for the 9 Jyotish grahas
export const TABLE_PLANET_ORDER = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
] as const;
export type PlanetName = (typeof TABLE_PLANET_ORDER)[number];

export function julianDay(nowMs: number): number {
  return nowMs / 86400000 + 2440587.5;
}

/** Tropical (equinox-based) mean longitude — needed for sunrise/sunset, NOT sidereal. */
export function tropicalLon(name: PlanetName, nowMs: number): number {
  const jd = julianDay(nowMs);
  const T = (jd - 2451545.0) / 36525;
  if (name === 'Ketu') {
    return mod360(mod360(125.0445 - 1934.136 * T) + 180);
  }
  if (name === 'Rahu') {
    return mod360(125.0445 - 1934.136 * T);
  }
  return mod360((J2K[name]?.L0 ?? 0) + (J2K[name]?.Lr ?? 0) * T);
}

export function displayLonSidereal(name: PlanetName, nowMs: number): number {
  return mod360(tropicalLon(name, nowMs) - LAHIRI_AYANAMSA_2025);
}

export function nakshatraName(lon: number): string {
  return NAKSHATRAS[Math.floor((lon / 360) * 27)] ?? '—';
}

export function signName(lon: number): string {
  return SIGN_NAMES[Math.floor(lon / 30)] ?? '—';
}

// ── Moon phase ────────────────────────────────────────────────────────────────

export const PHASE_ICONS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'] as const;
export const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

export function moonPhase(nowMs: number): string {
  const jd = julianDay(nowMs);
  const k = ((jd - 2451550.1) / 29.53058867) % 1;
  const p = k < 0 ? k + 1 : k;
  const i = Math.round(p * 8) % 8;
  return `${PHASE_ICONS[i] ?? '🌑'} ${PHASE_NAMES[i] ?? 'New Moon'}`;
}

// ── Local Sidereal Time ───────────────────────────────────────────────────────

export function localSiderealTime(nowMs: number, lonDeg: number): string {
  const jd = julianDay(nowMs);
  const T = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  const lmst = mod360(gmst + lonDeg);
  const lstH = lmst / 15;
  const h = Math.floor(lstH);
  const m = Math.floor((lstH - h) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

// Mean daily motion (°/day) from J2K Lr constants (°/century ÷ 36525).
// Rahu/Ketu have negative Lr → retrograde mean motion.
export const PLANET_DAILY_SPEED: Record<PlanetName, number> = {
  Sun: 36000.76983 / 36525,
  Moon: 481267.8813 / 36525,
  Mars: 19140.2993 / 36525,
  Mercury: 149472.6749 / 36525,
  Jupiter: 3034.9057 / 36525,
  Venus: 58517.8156 / 36525,
  Saturn: 1222.1138 / 36525,
  Rahu: -1934.136 / 36525,
  Ketu: -1934.136 / 36525,
};
