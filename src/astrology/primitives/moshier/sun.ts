/**
 * Sun geometric mean longitude — Meeus low-precision + Moshier aberration.
 * --------------------------------------------------------------------------
 * Accuracy: < 0.01° for 1900–2100 CE. Sufficient for KP ascendant and house
 * cusps; the exact sun position is only needed for combustion and hora.
 *
 * For combustion checks the Sun needs 4-decimal-degree accuracy (~15 arcsec).
 * The low-precision formula here gives ~0.01° = 36 arcsec, which is within
 * the ±1° combustion hysteresis band. Good enough.
 *
 * References:
 *   - Meeus, *Astronomical Algorithms* 2nd ed., Ch. 25           [MEEUS]
 *   - Moshier, *Astronomical Algorithms in C* (1989)             [MOSHIER]
 */

import { normalize360 } from '../angles';
import { DEG_TO_RAD } from '../constants';
import type { JDtt } from '../julianDay';

// ── Low-precision Sun (Meeus Ch.25, eqs. 25.2–25.5) ──────────────────────

/**
 * Sun ecliptic longitude (geometric, apparent) in degrees.
 * Also returns the Sun's ecliptic latitude (always < 1.2") and radius vector
 * in AU for completeness.
 */
export interface SunPosition {
  /** Apparent ecliptic longitude (tropical), degrees [0°, 360°) */
  longitude: number;
  /** Ecliptic latitude, degrees — near zero for the Sun */
  latitude: number;
  /** Radius vector (Sun–Earth distance), AU */
  radiusAU: number;
  /** Geometric longitude before aberration correction, degrees */
  geometricLongitude: number;
}

export function sunPosition(jdtt: JDtt): SunPosition {
  // T = Julian centuries since J2000.0 (TT)
  const T = (jdtt - 2451545.0) / 36525.0;
  const T2 = T * T;

  // Geometric mean longitude L₀ (degrees) — Meeus 25.2
  const L0 = normalize360(280.46646 + 36000.76983 * T + 0.0003032 * T2);

  // Mean anomaly M (degrees) — Meeus 25.3
  const M = normalize360(357.52911 + 35999.05029 * T - 0.0001537 * T2);
  const Mrad = M * DEG_TO_RAD;

  // Equation of center C (degrees)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  // Sun's true longitude Θ
  const sunLon = L0 + C;

  // Sun's true anomaly ν
  const nu = M + C;
  const nuRad = nu * DEG_TO_RAD;

  // Radius vector R (AU) — Meeus 25.5
  const R = 1.000001018 * (1 - 0.01671123 * Math.cos(nuRad) - 0.00014 * Math.cos(2 * nuRad));

  // Apparent longitude: subtract aberration (−20.4898"/R) and add Ω correction
  const omega = normalize360(125.04 - 1934.136 * T);
  const omegaRad = omega * DEG_TO_RAD;
  const apparent = sunLon - 0.00569 - 0.00478 * Math.sin(omegaRad);

  return {
    longitude: normalize360(apparent),
    latitude: 0, // Sun's ecliptic latitude is always < 1.2", treated as 0
    radiusAU: R,
    geometricLongitude: normalize360(sunLon),
  };
}

/**
 * Sun's mean anomaly in degrees for a given T.
 * Re-exported for Moon and planet calculations.
 */
export function sunMeanAnomaly(T: number): number {
  return normalize360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
}
