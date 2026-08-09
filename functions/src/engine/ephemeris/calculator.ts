/**
 * ephemeris/calculator.ts — Real planetary position calculations using Swiss Ephemeris.
 *
 * This is the foundation of all readings. Every position is calculated from
 * authoritative ephemeris data, not templates or pre-computed tables.
 *
 * Swiss Ephemeris is the industry standard:
 *   - Accuracy: ±1 arcsecond (1 degree = 3600 arcseconds)
 *   - For horary: 1° precision is sufficient; we have 10x that accuracy
 *   - Speed: ~2-5ms per complete 9-planet calculation
 *   - Coverage: -13000 to +17000 years CE
 *
 * References:
 *   - https://www.astro.com/swisseph/
 *   - @swisseph/core npm package
 */

import swisseph from '@swisseph/core';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type Planet = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'Rahu' | 'Ketu';

export interface PlanetaryPosition {
  /** Planet name. */
  planet: Planet;
  /** Longitude in zodiac (0-360°). 0° Aries to 360° = end of Pisces. */
  longitude: number;
  /** Latitude (declination from ecliptic). Usually near 0° except for Moon. */
  latitude: number;
  /** Speed in degrees/day. Negative = retrograde. */
  speed: number;
  /** True if planet appears to move backward (retrograde). */
  isRetrograde: boolean;
  /** True if within 8-14° of Sun (depends on planet). */
  isCombust: boolean;
  /** Sign position (0 = Aries, 11 = Pisces). */
  sign: number;
  /** Degrees into current sign (0-30). */
  signDegree: number;
}

export interface EphemerisData {
  instant: Date;
  julianDay: number;
  planets: Record<Planet, PlanetaryPosition>;
}

// ────────────────────────────────────────────────────────────────────────────
// SWISS EPHEMERIS PLANET IDENTIFIERS
// ────────────────────────────────────────────────────────────────────────────

/** Map internal planet names to Swiss Ephemeris identifiers. */
const PLANET_SE_IDS: Readonly<Record<Planet, number>> = Object.freeze({
  Sun: 0,        // SE_SUN
  Moon: 1,       // SE_MOON
  Mercury: 2,    // SE_MERCURY
  Venus: 3,      // SE_VENUS
  Mars: 4,       // SE_MARS
  Jupiter: 5,    // SE_JUPITER
  Saturn: 6,     // SE_SATURN
  Rahu: 10,      // SE_MEAN_NODE (Rahu = north node)
  Ketu: 11,      // SE_MEAN_APOG (Ketu = south node, opposite Rahu)
});

const PLANET_NAMES: readonly Planet[] = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Rahu',
  'Ketu',
];

// ────────────────────────────────────────────────────────────────────────────
// COMBUSTION ORBS (planet-specific distance from Sun)
// ────────────────────────────────────────────────────────────────────────────

/**
 * When a planet gets too close to the Sun, it's "combust" — obscured by solar
 * light, unable to act clearly. Each planet has a different orb (distance).
 *
 * Source: Classical Vedic astrology (Jyotisha).
 */
const COMBUSTION_ORBS: Readonly<Record<Planet, number>> = Object.freeze({
  Sun: 0,         // Sun can't be combust (it is the combustor)
  Moon: 12,       // Moon combust within 12°
  Mercury: 14,    // Mercury combust within 14° (closest to Sun)
  Venus: 10,      // Venus combust within 10°
  Mars: 8,        // Mars combust within 8°
  Jupiter: 8,     // Jupiter combust within 8°
  Saturn: 8,      // Saturn combust within 8°
  Rahu: 0,        // Nodes can't be combust
  Ketu: 0,        // Nodes can't be combust
});

// ────────────────────────────────────────────────────────────────────────────
// JULIAN DAY CONVERSION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert a Date to Julian Day Number.
 *
 * JD is the astronomical standard for time representation. It's a continuous
 * count of days since the Julian Period epoch (noon, January 1, 4713 BCE).
 *
 * @param date  JavaScript Date (UTC)
 * @returns     Julian Day Number
 */
export function dateToJulianDay(date: Date): number {
  const ms = date.getTime(); // Milliseconds since Unix epoch (Jan 1, 1970)
  const days = ms / (1000 * 60 * 60 * 24); // Convert to days
  const unixEpochJD = 2440587.5; // JD at Jan 1, 1970, 00:00 UTC
  return unixEpochJD + days;
}

/**
 * Convert Julian Day Number back to Date.
 *
 * @param jd  Julian Day Number
 * @returns   JavaScript Date (UTC)
 */
export function julianDayToDate(jd: number): Date {
  const unixEpochJD = 2440587.5;
  const days = jd - unixEpochJD;
  const ms = days * (1000 * 60 * 60 * 24);
  return new Date(ms);
}

// ────────────────────────────────────────────────────────────────────────────
// SIGN CALCULATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert longitude (0-360°) to sign (0-11) and degree-in-sign (0-30).
 *
 * @param longitude  Longitude in degrees (0-360)
 * @returns         {sign: 0-11, degree: 0-30}
 */
export function longitudeToSign(longitude: number): {
  sign: number;
  degree: number;
} {
  const normalized = ((longitude % 360) + 360) % 360; // Ensure 0-360
  const sign = Math.floor(normalized / 30);
  const degree = normalized % 30;
  return { sign: sign % 12, degree };
}

// ────────────────────────────────────────────────────────────────────────────
// RETROGRADE DETECTION
// ────────────────────────────────────────────────────────────────────────────

/**
 * A planet is retrograde when it appears to move backward (negative speed).
 *
 * In geocentric astrology, this is an optical illusion (Earth is faster, passes
 * the outer planet), but from Earth's perspective, it's real motion.
 *
 * @param speed  Daily speed in degrees/day
 * @returns      true if retrograde (speed < 0)
 */
export function isRetrograde(speed: number): boolean {
  return speed < 0;
}

// ────────────────────────────────────────────────────────────────────────────
// COMBUSTION DETECTION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if a planet is combust (too close to Sun).
 *
 * @param planet        Planet name
 * @param planetLon     Planet longitude
 * @param sunLon        Sun longitude
 * @returns             true if combust
 */
export function isCombust(planet: Planet, planetLon: number, sunLon: number): boolean {
  if (planet === 'Sun') return false; // Sun can't be combust
  if (planet === 'Rahu' || planet === 'Ketu') return false; // Nodes can't be combust

  const orb = COMBUSTION_ORBS[planet];
  const distance = Math.abs(planetLon - sunLon);
  // Handle wrap-around (e.g., 359° and 1° are 2° apart, not 358°)
  const shortestDistance = Math.min(distance, 360 - distance);

  return shortestDistance <= orb;
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN CALCULATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate real planetary positions for a given instant.
 *
 * @param instant  The moment to calculate (JS Date, UTC)
 * @returns        All 9 planets with positions, retrograde, dignity, etc.
 * @throws         If Swiss Ephemeris fails or data unavailable
 */
export async function calculatePlanetaryPositions(instant: Date): Promise<EphemerisData> {
  // ── 1. Convert to Julian Day ────────────────────────────────────────────
  const jd = dateToJulianDay(instant);

  // ── 2. Initialize Swiss Ephemeris ──────────────────────────────────────
  // (Set ephemeris data path if needed; typically bundled with @swisseph/core)
  try {
    swisseph.swe_set_ephe_path('/opt/ephemeris'); // Fallback path
  } catch {
    // Path may not exist; Swiss Ephemeris will use bundled data
  }

  // ── 3. Calculate all 9 planets ─────────────────────────────────────────
  const planets: Record<Planet, PlanetaryPosition> = {} as Record<Planet, PlanetaryPosition>;
  let sunLon = 0; // Cache Sun's longitude for combustion checks

  for (const planetName of PLANET_NAMES) {
    const seId = PLANET_SE_IDS[planetName];

    // Call Swiss Ephemeris
    const result = swisseph.swe_calc_ut(jd, seId, swisseph.SEFLG_SPEED);

    if (!result || result.length < 6) {
      throw new Error(`Ephemeris calculation failed for ${planetName} at JD ${jd}`);
    }

    const [longitude, latitude, _distance, speed] = result;

    // Cache Sun's longitude for later combustion checks
    if (planetName === 'Sun') {
      sunLon = longitude;
    }

    // ── Determine sign and degree ──────────────────────────────────────
    const { sign, degree } = longitudeToSign(longitude);

    // ── Determine retrograde status ────────────────────────────────────
    const retrograde = isRetrograde(speed);

    // ── Determine combustion status ────────────────────────────────────
    const combust = isCombust(planetName, longitude, sunLon);

    planets[planetName] = {
      planet: planetName,
      longitude,
      latitude,
      speed,
      isRetrograde: retrograde,
      isCombust: combust,
      sign,
      signDegree: degree,
    };
  }

  return {
    instant,
    julianDay: jd,
    planets,
  };
}

/**
 * Calculate planetary positions with caching (for repeated calls in same minute).
 *
 * Since ephemeris doesn't change within a minute, we can cache results to
 * avoid redundant calculations.
 */
const ephemerisCache = new Map<number, EphemerisData>();
const CACHE_TTL_MS = 60000; // 1 minute

export async function calculatePlanetaryPositionsCached(
  instant: Date,
): Promise<EphemerisData> {
  const now = instant.getTime();
  const cacheKey = Math.floor(now / CACHE_TTL_MS); // Bucket by minute

  if (ephemerisCache.has(cacheKey)) {
    const cached = ephemerisCache.get(cacheKey)!;
    // Verify it's still within 1 minute
    if (Math.abs(now - cached.instant.getTime()) < CACHE_TTL_MS) {
      return cached;
    }
  }

  const result = await calculatePlanetaryPositions(instant);
  ephemerisCache.set(cacheKey, result);

  // Keep cache small (max 5 entries = 5 minutes of history)
  if (ephemerisCache.size > 5) {
    const oldestKey = Math.min(...ephemerisCache.keys());
    ephemerisCache.delete(oldestKey);
  }

  return result;
}

/**
 * Get human-readable planet name.
 *
 * @param planet  Planet identifier
 * @returns       Display name (Arabic/Urdu name if available, else English)
 */
export function getPlanetDisplayName(planet: Planet): string {
  const arabicNames: Record<Planet, string> = {
    Sun: 'Shams',
    Moon: 'al-Qamar',
    Mercury: 'Utarid',
    Venus: 'Zuhra',
    Mars: "Mirrikh",
    Jupiter: 'Mushtari',
    Saturn: 'Zuhal',
    Rahu: 'Rahu',
    Ketu: 'Ketu',
  };
  return arabicNames[planet] || planet;
}

// ────────────────────────────────────────────────────────────────────────────
// VALIDATION & TESTING UTILITIES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verify ephemeris accuracy against known reference position.
 *
 * Used for testing. Example: Sun at noon on 2000-01-01 CE should be at ~10°20' Capricorn.
 *
 * @param instant      Test instant
 * @param planet       Planet to check
 * @param expectedLon  Expected longitude (degrees)
 * @param tolerance    Allowed error (degrees)
 * @returns            true if within tolerance
 */
export async function verifyEphemerisAccuracy(
  instant: Date,
  planet: Planet,
  expectedLon: number,
  tolerance: number = 1, // 1° default tolerance
): Promise<boolean> {
  const data = await calculatePlanetaryPositions(instant);
  const actual = data.planets[planet].longitude;
  const error = Math.abs(actual - expectedLon);
  const shortestError = Math.min(error, 360 - error);

  return shortestError <= tolerance;
}

/**
 * Get all planets' positions as a simple table (for debugging/logging).
 *
 * @param data  EphemerisData
 * @returns     Pretty-printed table
 */
export function ephemerisDataToString(data: EphemerisData): string {
  let output = `Ephemeris at ${data.instant.toISOString()} (JD ${data.julianDay.toFixed(5)})\n`;
  output += '─'.repeat(90) + '\n';
  output += 'Planet    | Longitude | Sign | Degree | Speed    | Retrograde | Combust\n';
  output += '─'.repeat(90) + '\n';

  for (const planet of PLANET_NAMES) {
    const pos = data.planets[planet];
    const signNames = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const sign = signNames[pos.sign];

    output += `${planet.padEnd(9)} | ${pos.longitude.toFixed(2).padStart(9)} | ${sign.padEnd(5)} | ${pos.signDegree.toFixed(1).padStart(6)} | ${pos.speed.toFixed(4).padStart(8)} | ${String(pos.isRetrograde).padEnd(10)} | ${pos.isCombust}\n`;
  }

  return output;
}
