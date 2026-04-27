/**
 * Chart types — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Strict, immutable interfaces describing the OUTPUT of the ephemeris layer
 * and the INPUT of the KP judgment layer. This file is the contract between
 * Phase 2 (Swiss Ephemeris integration) and Phase 3 (KP judgment).
 *
 * Design rules followed:
 *   - All angular values in DECIMAL DEGREES (not d/m/s strings). Conversion
 *     to display strings happens in narration.ts only.
 *   - Longitudes are SIDEREAL (Lahiri-corrected), not tropical. The ephemeris
 *     layer subtracts ayanamsa once at the boundary; KP layer never sees
 *     tropical values.
 *   - All values are NUMBERS, never strings, except enum identifiers.
 *   - `readonly` everywhere — charts are immutable artifacts. A Prashna chart
 *     is a snapshot; mutation has no semantic meaning.
 *   - No `Date` objects in interfaces (only ISO strings). Prevents accidental
 *     timezone-shift bugs and makes JSON persistence trivial.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

/**
 * The 9 grahas of Vedic astrology, in canonical RKP order.
 *
 * Note: Rahu and Ketu are the lunar nodes (mathematical points, not bodies).
 * They are always retrograde in mean-node calculation; in true-node mode
 * they oscillate between direct and retrograde. RKP rules use MEAN nodes.
 */
export type Planet =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu';

export const PLANETS: readonly Planet[] = [
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

/**
 * Sign indices: 1 = Aries, 12 = Pisces. Using 1-based to match the Vedic
 * convention used throughout the rules tables — switching to 0-based here
 * would force every rule lookup to do `index - 1` arithmetic.
 */
export type SignIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** House indices: 1 = Lagna (Ascendant), 12 = 12th house. 1-based. */
export type HouseIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Nakshatra indices: 1 = Ashwini, 27 = Revati. 1-based. */
export type NakshatraIndex =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27;

/** Pada (quarter) of a nakshatra: 1–4. */
export type Pada = 1 | 2 | 3 | 4;

/** House system supported by Phase 2. KP prefers Placidus, with Porphyry fallback at extreme latitude. */
export type HouseSystem = 'placidus' | 'porphyry';

/** Ayanamsa system. KP/RKP uses Lahiri (a.k.a. Chitrapaksha). */
export type Ayanamsa = 'lahiri';

// ── Geographic location ────────────────────────────────────────────────────

export interface GeoLocation {
  /** Latitude in decimal degrees, north positive. Range [-90, 90]. */
  readonly latitude: number;
  /** Longitude in decimal degrees, east positive. Range [-180, 180]. */
  readonly longitude: number;
  /** Elevation in meters above MSL. Optional — defaults to 0 for cusps. */
  readonly elevation?: number;
  /**
   * Human-readable label ("Mumbai, India"). Display-only; never used in
   * computation. Engine never reverse-geocodes.
   */
  readonly label?: string;
  /**
   * IANA timezone identifier ("Asia/Kolkata"). Used only for display
   * formatting; computation always operates in UTC.
   */
  readonly timezone?: string;
}

// ── Per-planet position ────────────────────────────────────────────────────

export interface PlanetPosition {
  readonly planet: Planet;

  /** Sidereal longitude in decimal degrees, [0, 360). Lahiri-corrected. */
  readonly siderealLongitude: number;

  /** Sidereal latitude (ecliptic) in decimal degrees. Range typically [-7, 7]. */
  readonly siderealLatitude: number;

  /**
   * Daily motion in longitude, in degrees/day.
   * Negative => retrograde. Used for retrograde detection without ambiguity.
   */
  readonly dailySpeed: number;

  /** True if dailySpeed < 0 (retrograde). Pre-computed for convenience. */
  readonly isRetrograde: boolean;

  /**
   * True if planet is within Sun's combust orb (planet-specific, classical):
   *   Mercury: 14°, Venus: 10°, Mars: 17°, Jupiter: 11°, Saturn: 15°,
   *   Moon: 12°. Sun never combust. Rahu/Ketu never marked combust in RKP.
   */
  readonly isCombust: boolean;

  /** Sign occupied (1=Aries..12=Pisces). Derived from siderealLongitude. */
  readonly sign: SignIndex;

  /** Degrees within the sign, [0, 30). */
  readonly degreeInSign: number;

  /** Nakshatra occupied (1=Ashwini..27=Revati). */
  readonly nakshatra: NakshatraIndex;

  /** Pada (quarter) within nakshatra, 1–4. */
  readonly pada: Pada;

  /** Lord of the nakshatra (Vimshottari assignment). */
  readonly nakshatraLord: Planet;

  /**
   * Sub-lord — the planet ruling the proportional sub-division of the
   * nakshatra at this exact longitude. This is the decisive quantity for the
   * Moon in the current 5-step RKP horary engine.
   */
  readonly subLord: Planet;

  /** Sub-sub-lord — used for confirmation/refinement. */
  readonly subSubLord: Planet;
}

// ── House cusps ────────────────────────────────────────────────────────────

export interface HouseCusp {
  readonly house: HouseIndex;

  /** Sidereal longitude of the cusp in decimal degrees, [0, 360). */
  readonly siderealLongitude: number;

  /** Sign of the cusp. */
  readonly sign: SignIndex;

  /** Degrees within sign, [0, 30). */
  readonly degreeInSign: number;

  /** Nakshatra and its lord at the cusp longitude. */
  readonly nakshatra: NakshatraIndex;
  readonly nakshatraLord: Planet;

  /** Cusp sub-lord at this house boundary. Retained for context and traceability. */
  readonly subLord: Planet;

  /** Sub-sub-lord at the cusp. */
  readonly subSubLord: Planet;
}

// ── The chart itself ───────────────────────────────────────────────────────

/**
 * A complete Prashna (horary) chart. Produced by the Phase 2 ephemeris
 * pipeline; consumed by Phase 3 KP judgment.
 *
 * IMMUTABLE. The same (timestamp, location, ayanamsa, houseSystem) tuple
 * MUST always produce a structurally identical chart — this is the trust
 * anchor of the deterministic engine.
 */
export interface Chart {
  /** ISO 8601 UTC timestamp of the question moment. */
  readonly momentUtc: string;

  /** Julian Day (UT) of the chart moment. Provided for traceability. */
  readonly julianDayUt: number;

  /** Geographic location of the questioner. */
  readonly location: GeoLocation;

  /** Ayanamsa system used (always 'lahiri' for RKP). */
  readonly ayanamsa: Ayanamsa;

  /** Ayanamsa value at this moment, in decimal degrees. */
  readonly ayanamsaValue: number;

  /** House system actually used for this chart. */
  readonly houseSystem: HouseSystem;

  /** All 9 grahas, indexed by Planet enum (Map-shape via record). */
  readonly planets: Readonly<Record<Planet, PlanetPosition>>;

  /** All 12 houses (1-based: cusps[0] is house 1 / Lagna). */
  readonly cusps: readonly [
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
    HouseCusp,
  ];

  /** Ascendant (= cusps[0]) — duplicated here for convenience. */
  readonly ascendant: HouseCusp;

  /** Midheaven (10th cusp) — duplicated for convenience. */
  readonly midheaven: HouseCusp;

  /**
   * Ruling Planets at the chart moment, in fixed order:
   * day-lord, hora-lord, minute-lord.
   *
   * All three are computed from the same local-solar moment derived from the
   * question longitude, so weekday, hora, and minute remain time-consistent.
   */
  readonly rulingPlanets: readonly Planet[];

  /** Hora (planetary hour) ruler at chart moment, sunrise-anchored Chaldean. */
  readonly horaLord: Planet;

  /**
   * Engine version that produced this chart. Bumped whenever the ephemeris
   * layer changes in any way that could shift longitudes by > 1 arcsecond.
   * History records pin this so old readings remain reproducible.
   */
  readonly engineVersion: string;
}
