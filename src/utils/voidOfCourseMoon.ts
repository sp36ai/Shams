/**
 * voidOfCourseMoon — approximate "Moon void of course" detection.
 * --------------------------------------------------------------------------
 * Classical horary rule: once the Moon has made its last applying aspect
 * (conjunction/sextile/square/trine/opposition) to a classical planet while
 * in a sign, and before it moves into the next sign, it is "void of
 * course" — traditionally considered a poor window for asking a fresh
 * question or beginning a new venture, since "nothing will come of it."
 *
 * Uses the same mean-longitude approximation as the rest of Al-Falak
 * (±1–5°, display only). Only the seven classical bodies participate
 * (Sun..Saturn) — Rahu/Ketu are shadow points, not aspecting bodies in
 * traditional horary technique.
 */

import {
  mod360,
  displayLonSidereal,
  PLANET_DAILY_SPEED,
  type PlanetName,
} from './siderealPositions';

const CLASSICAL_PLANETS: readonly PlanetName[] = [
  'Sun',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
];

const ASPECT_ANGLES = [0, 60, 90, 120, 180] as const;

export interface VoidOfCourseResult {
  isVoid: boolean;
  /** Moment the Moon exits its current sign (ms epoch) — the VoC window ends here if isVoid. */
  signExitMs: number;
}

export function computeMoonVoidOfCourse(nowMs: number): VoidOfCourseResult {
  const moonLon = displayLonSidereal('Moon', nowMs);
  const moonSpeed = PLANET_DAILY_SPEED.Moon; // °/day, always the fastest body
  const degreesToSignExit = 30 - (moonLon % 30);
  const daysToSignExit = degreesToSignExit / moonSpeed;
  const signExitMs = nowMs + daysToSignExit * 86400000;

  for (const planet of CLASSICAL_PLANETS) {
    const planetLon = displayLonSidereal(planet, nowMs);
    const planetSpeed = PLANET_DAILY_SPEED[planet];
    // Moon is always faster than any classical planet's mean motion (even
    // retrograde apparent speeds don't approach 13°/day), so the Moon–planet
    // angular separation increases monotonically over this short window —
    // safe to search forward without worrying about direction reversal.
    const closingSpeed = moonSpeed - planetSpeed;
    const currentSeparation = mod360(moonLon - planetLon);

    for (const aspect of ASPECT_ANGLES) {
      const deltaDeg = mod360(aspect - currentSeparation);
      const daysToAspect = deltaDeg / closingSpeed;
      if (daysToAspect * 86400000 <= signExitMs - nowMs) {
        // Moon still has an applying aspect ahead before leaving the sign —
        // not void of course.
        return { isVoid: false, signExitMs };
      }
    }
  }

  return { isVoid: true, signExitMs };
}
