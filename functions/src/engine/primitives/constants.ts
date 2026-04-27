/**
 * Astronomical constants — Shams al-Asrār Phase 2 primitives
 * --------------------------------------------------------------------------
 * Every value in this file is immutable, named, and traceable to a published
 * source. No magic numbers elsewhere in the primitive layer.
 *
 * References:
 *   - Meeus, *Astronomical Algorithms*, 2nd ed. (1998)   [MEEUS]
 *   - IAU 2006 Precession / IAU 2000A Nutation           [IAU2006]
 *   - Swiss Ephemeris v2.10 source                       [SE210]
 *   - IERS Conventions (2010), Chapter 5                 [IERS2010]
 *   - Krishnamurti, *Krishnamurti Padhdhati*             [KP]
 */

// ────────────────────────────────────────────────────────────────────────────
// Angle conversions
// ────────────────────────────────────────────────────────────────────────────

/** π ÷ 180 — multiply to convert degrees → radians */
export const DEG_TO_RAD = Math.PI / 180;

/** 180 ÷ π — multiply to convert radians → degrees */
export const RAD_TO_DEG = 180 / Math.PI;

/** 1 arcsecond in degrees = 1/3600 */
export const ARCSEC_TO_DEG = 1 / 3600;

/** 1 arcminute in degrees = 1/60 */
export const ARCMIN_TO_DEG = 1 / 60;

/** 1 degree in arcseconds */
export const DEG_TO_ARCSEC = 3600;

/** 2π — full circle in radians */
export const TWO_PI = 2 * Math.PI;

/** 360 — full circle in degrees */
export const FULL_CIRCLE_DEG = 360;

// ────────────────────────────────────────────────────────────────────────────
// Time constants
// ────────────────────────────────────────────────────────────────────────────

/** Seconds per day = 86400 */
export const SECONDS_PER_DAY = 86400;

/** Julian Day Number at Unix epoch (1970-01-01 00:00:00 UTC) — MEEUS 7.1 */
export const JD_UNIX_EPOCH = 2440587.5;

/** Julian Day of J2000.0 = 2000-01-01 12:00:00 TT — IAU2006 */
export const JD_J2000 = 2451545.0;

/** Days in a Julian century (used as time unit T in Meeus formulae) */
export const JULIAN_CENTURY_DAYS = 36525.0;

/** Days in a Julian millennium */
export const JULIAN_MILLENNIUM_DAYS = 365250.0;

/** MJD offset — Modified Julian Day = JD - MJD_OFFSET */
export const MJD_OFFSET = 2400000.5;

// ────────────────────────────────────────────────────────────────────────────
// Earth orientation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mean obliquity of the ecliptic at J2000.0 in degrees.
 * IAU 2006 value: 23°26'21.406"
 * Source: IAU2006 / IERS2010 §5.6.2
 */
export const OBLIQUITY_J2000_DEG = 23.4392911;

/**
 * Sidereal day / solar day ratio.
 * One solar day = 1.00273790935 sidereal days (mean tropical year basis).
 * Used for GMST calculation.
 */
export const SIDEREAL_DAY_RATIO = 1.00273790935;

/** Earth's equatorial radius in km (WGS84) */
export const EARTH_RADIUS_KM = 6378.137;

// ────────────────────────────────────────────────────────────────────────────
// Zodiac
// ────────────────────────────────────────────────────────────────────────────

/** 30° — span of one zodiac sign */
export const SIGN_SPAN_DEG = 30;

/** 12 — total number of zodiac signs */
export const SIGN_COUNT = 12;

/** 27 — total number of nakshatras */
export const NAKSHATRA_COUNT = 27;

/**
 * Span of one nakshatra in degrees = 360/27 = 13°20'00"
 * Exact: 13 + 20/60 = 13.333333... (repeating)
 */
export const NAKSHATRA_SPAN_DEG = FULL_CIRCLE_DEG / NAKSHATRA_COUNT;

/**
 * Span of one pada (quarter of a nakshatra) in degrees = NAKSHATRA_SPAN_DEG/4
 * = 3°20'00"
 */
export const PADA_SPAN_DEG = NAKSHATRA_SPAN_DEG / 4;

// ────────────────────────────────────────────────────────────────────────────
// KP Vimshottari
// ────────────────────────────────────────────────────────────────────────────

/** Total length of one Vimshottari Mahadasha cycle in years */
export const VIMSHOTTARI_TOTAL_YEARS = 120;

/**
 * Days per year used in Vimshottari dasha length conversions.
 * Classical KP: solar year = 365.25 days (NOT 365 or 365.2422 — per Krishnamurti)
 * Source: KP
 */
export const VIMSHOTTARI_DAYS_PER_YEAR = 365.25;

// ────────────────────────────────────────────────────────────────────────────
// Planet catalogue — indices used throughout primitives
// ────────────────────────────────────────────────────────────────────────────

/**
 * Planet indices. Order is classical (Sun, Moon, then visible planets outward,
 * then lunar nodes, then modern planets). Matches ordering used in the RKP
 * rules module and judgment algorithm.
 */
export const enum PlanetIndex {
  Sun = 0,
  Moon = 1,
  Mars = 2,
  Mercury = 3,
  Jupiter = 4,
  Venus = 5,
  Saturn = 6,
  Rahu = 7, // North lunar node (mean)
  Ketu = 8, // South lunar node (mean) — always Rahu + 180°
  Uranus = 9,
  Neptune = 10,
  Pluto = 11,
}

/** Classical seven grahas used in all KP calculations */
export const CLASSICAL_GRAHAS: readonly PlanetIndex[] = Object.freeze([
  PlanetIndex.Sun,
  PlanetIndex.Moon,
  PlanetIndex.Mars,
  PlanetIndex.Mercury,
  PlanetIndex.Jupiter,
  PlanetIndex.Venus,
  PlanetIndex.Saturn,
]);

/** KP uses 9 grahas (7 classical + Rahu + Ketu). Outer planets optional. */
export const KP_NAVA_GRAHAS: readonly PlanetIndex[] = Object.freeze([
  ...CLASSICAL_GRAHAS,
  PlanetIndex.Rahu,
  PlanetIndex.Ketu,
]);

/** All 12 indices available to the engine (includes outers for display) */
export const ALL_PLANETS: readonly PlanetIndex[] = Object.freeze([
  PlanetIndex.Sun,
  PlanetIndex.Moon,
  PlanetIndex.Mars,
  PlanetIndex.Mercury,
  PlanetIndex.Jupiter,
  PlanetIndex.Venus,
  PlanetIndex.Saturn,
  PlanetIndex.Rahu,
  PlanetIndex.Ketu,
  PlanetIndex.Uranus,
  PlanetIndex.Neptune,
  PlanetIndex.Pluto,
]);

/**
 * Human-readable names — ENGLISH ONLY. Localized names come from i18n layer.
 * Indexing matches PlanetIndex enum.
 */
export const PLANET_NAMES_EN: Readonly<Record<PlanetIndex, string>> = Object.freeze({
  [PlanetIndex.Sun]: 'Sun',
  [PlanetIndex.Moon]: 'Moon',
  [PlanetIndex.Mars]: 'Mars',
  [PlanetIndex.Mercury]: 'Mercury',
  [PlanetIndex.Jupiter]: 'Jupiter',
  [PlanetIndex.Venus]: 'Venus',
  [PlanetIndex.Saturn]: 'Saturn',
  [PlanetIndex.Rahu]: 'Rahu',
  [PlanetIndex.Ketu]: 'Ketu',
  [PlanetIndex.Uranus]: 'Uranus',
  [PlanetIndex.Neptune]: 'Neptune',
  [PlanetIndex.Pluto]: 'Pluto',
});

// ────────────────────────────────────────────────────────────────────────────
// Combustion thresholds (classical KP — Sun-proximity in degrees)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Planet considered combust when its ecliptic-longitude distance from the Sun
 * is LESS than the value below. Source: classical Jataka Parijata, adopted by
 * Krishnamurti without modification.
 */
export const COMBUSTION_THRESHOLD_DEG: Readonly<Partial<Record<PlanetIndex, number>>> =
  Object.freeze({
    [PlanetIndex.Moon]: 12,
    [PlanetIndex.Mars]: 17,
    [PlanetIndex.Mercury]: 14, // 12 if retrograde — handled in combustion.ts
    [PlanetIndex.Jupiter]: 11,
    [PlanetIndex.Venus]: 10, // 8 if retrograde — handled in combustion.ts
    [PlanetIndex.Saturn]: 15,
  });

// ────────────────────────────────────────────────────────────────────────────
// Latitude threshold for Placidus → Porphyry fallback
// ────────────────────────────────────────────────────────────────────────────

/**
 * When |geographic latitude| exceeds this value, Placidus cusps become
 * mathematically unstable (semi-arc can approach 0 or π). Engine auto-switches
 * to Porphyry at that point.
 * Value chosen: 66.5° — just inside the polar circle.
 */
export const PLACIDUS_LATITUDE_LIMIT_DEG = 66.5;

// ────────────────────────────────────────────────────────────────────────────
// Tolerance values (for tests and comparisons)
// ────────────────────────────────────────────────────────────────────────────

/** Tolerance for "exact" equality of angles in degrees, ~0.1 arcsec */
export const ANGLE_EPSILON_DEG = 1e-5;

/** Tolerance for Julian Day equality — 10 microseconds */
export const JD_EPSILON = 1e-10;
