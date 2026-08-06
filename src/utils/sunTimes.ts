/**
 * sunTimes — approximate sunrise/sunset for a lat/lon, "display only".
 * --------------------------------------------------------------------------
 * Standard hour-angle formula from the Sun's TROPICAL mean longitude
 * (not sidereal — equinox-based, as solar geometry requires) and a fixed
 * mean obliquity. Ignores the equation of time (±~15 min) and atmospheric
 * refraction nuance beyond the standard -0.833° horizon dip — consistent
 * with the rest of Al-Falak's "mean longitude, ±minutes" approximations.
 */

import { julianDay, tropicalLon } from './siderealPositions';

const MEAN_OBLIQUITY_DEG = 23.439;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface SunTimes {
  sunriseMs: number;
  sunsetMs: number;
}

/** Returns null for polar day/night (Sun never crosses the horizon). */
export function computeSunTimes(nowMs: number, latDeg: number, lonDeg: number): SunTimes | null {
  const sunLon = tropicalLon('Sun', nowMs);
  const decl = Math.asin(Math.sin(MEAN_OBLIQUITY_DEG * DEG2RAD) * Math.sin(sunLon * DEG2RAD));

  const latRad = latDeg * DEG2RAD;
  const cosH =
    (Math.sin(-0.833 * DEG2RAD) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));

  if (cosH < -1 || cosH > 1) {
    return null; // sun never rises or never sets at this latitude today
  }
  const hourAngleDeg = Math.acos(cosH) * RAD2DEG;

  // Local solar noon in UTC hours (ignores equation of time).
  const jd = julianDay(nowMs);
  const dayStartJd = Math.floor(jd - 0.5) + 0.5; // midnight UTC of the current day
  const solarNoonUtcHours = 12 - lonDeg / 15;
  const solarNoonMs = (dayStartJd - 2440587.5) * 86400000 + solarNoonUtcHours * 3600000;

  const halfDayMs = (hourAngleDeg / 15) * 3600000;

  return {
    sunriseMs: solarNoonMs - halfDayMs,
    sunsetMs: solarNoonMs + halfDayMs,
  };
}
