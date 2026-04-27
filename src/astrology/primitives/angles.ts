/**
 * Angle utilities — Shams al-Asrār Phase 2 primitives
 * --------------------------------------------------------------------------
 * Pure functions. No I/O, no clock, no random. Every function in this file
 * is deterministic: same input → identical output, byte-for-byte.
 *
 * Units convention across the codebase:
 *   - Ecliptic/equatorial longitudes are in DEGREES unless a function name
 *     explicitly says `Rad`.
 *   - Internally, trig computations convert to radians at call boundary.
 *   - All angle outputs are normalized to [0, 360) by default.
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch. 1 & 7       [MEEUS]
 */

import {
  DEG_TO_RAD,
  RAD_TO_DEG,
  FULL_CIRCLE_DEG,
  TWO_PI,
  ARCMIN_TO_DEG,
  ARCSEC_TO_DEG,
  ANGLE_EPSILON_DEG,
} from './constants';

// ────────────────────────────────────────────────────────────────────────────
// Conversions
// ────────────────────────────────────────────────────────────────────────────

/** Degrees → radians */
export function degToRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

/** Radians → degrees */
export function radToDeg(rad: number): number {
  return rad * RAD_TO_DEG;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalization
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalize an angle to [0°, 360°).
 * Handles arbitrarily large negative and positive inputs.
 *
 * normalize360(370)  === 10
 * normalize360(-10)  === 350
 * normalize360(720)  === 0
 * normalize360(-730) === 350
 */
export function normalize360(deg: number): number {
  if (!Number.isFinite(deg)) {
    throw new RangeError(`normalize360: non-finite input ${deg}`);
  }
  let result = deg % FULL_CIRCLE_DEG;
  if (result < 0) {
    result += FULL_CIRCLE_DEG;
  }
  // Guard: if deg was extremely close to a multiple of 360 from below,
  // float modulo may return exactly 360.0 due to rounding; snap to 0.
  if (result >= FULL_CIRCLE_DEG) {
    result = 0;
  }
  return result;
}

/**
 * Normalize an angle to [-180°, +180°).
 *
 * normalize180(190)  === -170
 * normalize180(-190) === 170
 */
export function normalize180(deg: number): number {
  const wrapped = normalize360(deg);
  return wrapped >= 180 ? wrapped - FULL_CIRCLE_DEG : wrapped;
}

/**
 * Normalize an angle in radians to [0, 2π).
 */
export function normalize2Pi(rad: number): number {
  if (!Number.isFinite(rad)) {
    throw new RangeError(`normalize2Pi: non-finite input ${rad}`);
  }
  let result = rad % TWO_PI;
  if (result < 0) {
    result += TWO_PI;
  }
  if (result >= TWO_PI) {
    result = 0;
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Angular distance and comparison
// ────────────────────────────────────────────────────────────────────────────

/**
 * Shortest angular distance between two longitudes, in degrees.
 * Result is always in [0°, 180°].
 *
 * angularDistance(10, 350) === 20
 * angularDistance(0, 180)  === 180
 * angularDistance(0, 181)  === 179
 */
export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalize180(a - b));
  return diff;
}

/**
 * Signed separation from `from` to `to`, in [-180°, +180°].
 * Positive = counter-clockwise (increasing longitude).
 */
export function signedSeparation(from: number, to: number): number {
  return normalize180(to - from);
}

/**
 * Angular difference in arcseconds (absolute value).
 * Useful for test tolerances and comparing planetary positions.
 */
export function arcsecDiff(a: number, b: number): number {
  return angularDistance(a, b) / ARCSEC_TO_DEG;
}

/**
 * Are two angles equal within a tolerance (default ~0.1 arcsec)?
 * Handles wrap correctly: anglesApproxEqual(0.00001, 359.99999) is true.
 */
export function anglesApproxEqual(
  a: number,
  b: number,
  toleranceDeg: number = ANGLE_EPSILON_DEG,
): boolean {
  return angularDistance(a, b) <= toleranceDeg;
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting: DMS / HMS
// ────────────────────────────────────────────────────────────────────────────

export interface DMS {
  /** Sign: -1, 0, or +1 */
  sign: -1 | 0 | 1;
  degrees: number;
  minutes: number;
  /** Seconds with fractional part */
  seconds: number;
}

/**
 * Decimal degrees → DMS components.
 * Preserves sign. Always returns non-negative minutes and seconds.
 *
 * toDMS(13.5)       → { sign:  1, degrees: 13, minutes: 30, seconds: 0 }
 * toDMS(-13.5)      → { sign: -1, degrees: 13, minutes: 30, seconds: 0 }
 * toDMS(0)          → { sign:  0, degrees:  0, minutes:  0, seconds: 0 }
 * toDMS(13.333333)  → { sign:  1, degrees: 13, minutes: 19, seconds: 59.9988 }
 */
export function toDMS(deg: number): DMS {
  if (!Number.isFinite(deg)) {
    throw new RangeError(`toDMS: non-finite input ${deg}`);
  }
  const sign: -1 | 0 | 1 = deg > 0 ? 1 : deg < 0 ? -1 : 0;
  const abs = Math.abs(deg);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return { sign, degrees, minutes, seconds };
}

/**
 * DMS components → decimal degrees.
 * Minutes and seconds MUST be non-negative; sign is taken from the `sign` field.
 */
export function fromDMS(dms: DMS): number {
  if (dms.minutes < 0 || dms.seconds < 0) {
    throw new RangeError('fromDMS: minutes and seconds must be non-negative');
  }
  const mag = dms.degrees + dms.minutes * ARCMIN_TO_DEG + dms.seconds * ARCSEC_TO_DEG;
  return dms.sign < 0 ? -mag : mag;
}

/**
 * Format a decimal longitude as `DD°MM'SS.S"` string.
 * Does NOT include sign character. Use with `signChar(deg)` if needed.
 *
 * formatDMS(13.5)    → "13°30'00.0\""
 * formatDMS(13.333)  → "13°19'58.8\""
 */
export function formatDMS(deg: number, secondsFractionDigits: number = 1): string {
  const { degrees, minutes, seconds } = toDMS(deg);
  const secStr = seconds
    .toFixed(secondsFractionDigits)
    .padStart(secondsFractionDigits > 0 ? secondsFractionDigits + 3 : 2, '0');
  return `${degrees}°${minutes.toString().padStart(2, '0')}'${secStr}"`;
}

/**
 * Decimal hours → hours / minutes / seconds.
 * For sidereal time, right ascension, etc.
 */
export interface HMS {
  hours: number;
  minutes: number;
  seconds: number;
}

export function toHMS(hours: number): HMS {
  if (!Number.isFinite(hours)) {
    throw new RangeError(`toHMS: non-finite input ${hours}`);
  }
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const mFloat = (abs - h) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return { hours: h, minutes: m, seconds: s };
}

export function formatHMS(hours: number, secondsFractionDigits: number = 1): string {
  const { hours: h, minutes, seconds } = toHMS(hours);
  const secStr = seconds
    .toFixed(secondsFractionDigits)
    .padStart(secondsFractionDigits > 0 ? secondsFractionDigits + 3 : 2, '0');
  return `${h.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}m${secStr}s`;
}

// ────────────────────────────────────────────────────────────────────────────
// Conversions: longitude ↔ hour-angle ↔ right-ascension
// ────────────────────────────────────────────────────────────────────────────

/** Degrees ↔ hours conversion. 15° = 1h (Earth rotates 15°/hr) */
export const DEG_PER_HOUR = 15;

export function degToHours(deg: number): number {
  return deg / DEG_PER_HOUR;
}

export function hoursToDeg(hours: number): number {
  return hours * DEG_PER_HOUR;
}

// ────────────────────────────────────────────────────────────────────────────
// Sign / nakshatra quick helpers. The positional math stays here; higher-level
// rule tables live in the dedicated RKP rule modules.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Zero-indexed sign number (0..11) from a tropical or sidereal longitude.
 * Does NOT identify the sign by name.
 *
 *   signIndex(0)     → 0  (Aries start)
 *   signIndex(29.99) → 0
 *   signIndex(30)    → 1  (Taurus start)
 *   signIndex(359.9) → 11 (Pisces)
 */
export function signIndex(longitudeDeg: number): number {
  return Math.floor(normalize360(longitudeDeg) / 30);
}

/**
 * Degrees within the current sign, in [0°, 30°).
 */
export function degreesInSign(longitudeDeg: number): number {
  return normalize360(longitudeDeg) % 30;
}
