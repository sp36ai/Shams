/**
 * rulingPlanets — Planetary day and hour lords for KP/RKP.
 * --------------------------------------------------------------------------
 * Implements the sunrise-to-sunrise rule for Day Lords and the
 * Chaldean order for Hora Lords.
 */

import type { Planet } from '../types/chart';

const DAY_LORDS: Planet[] = [
  'Sun', // 0: Sunday
  'Moon', // 1: Monday
  'Mars', // 2: Tuesday
  'Mercury', // 3: Wednesday
  'Jupiter', // 4: Thursday
  'Venus', // 5: Friday
  'Saturn', // 6: Saturday
];

const HORA_SEQUENCE: Planet[] = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];

/**
 * Calculates the Day Lord (Vara Lord) respecting the sunrise-to-sunrise rule.
 * RKP Rule: Sunrise is approximated at 6:00 AM local solar time.
 *
 * @param jdUtc Julian Day in UTC
 * @param lon Longitude in decimal degrees (East positive)
 */
export function calculateDayLord(jdUtc: number, lon: number): Planet {
  /**
   * 1. Calculate Local Solar Time (LST)
   * Longitude offset: 15 degrees = 1 hour.
   */
  const lstOffsetDays = lon / 360;
  const jdLst = jdUtc + lstOffsetDays;

  /**
   * 2. Determine the standard weekday from JD.
   * JD 2451545.0 (Jan 1, 2000 12:00 UTC) was a Saturday (6).
   * The formula floor(jd + 1.5) % 7 yields 0 for Sunday, 1 for Monday, etc.
   */
  const weekdayAtMoment = Math.floor(jdLst + 1.5) % 7;

  /**
   * 3. Calculate hours since local solar midnight.
   * In Julian Days, .5 is midnight. Adding .5 and taking the fraction
   * gives the time elapsed since the start of the calendar day (midnight).
   */
  const dayFraction = (jdLst + 0.5) % 1;
  const lstHours = dayFraction * 24;

  /**
   * 4. Apply Sunrise Gatekeeper (6:00 AM Local Solar Time).
   * If the current time is before 6 AM, it is still the previous planetary day.
   */
  let varaIndex = weekdayAtMoment;
  if (lstHours < 6) {
    // Move back to previous day
    varaIndex = (weekdayAtMoment + 6) % 7;
  }

  return DAY_LORDS[varaIndex] as Planet;
}

/** Wrapper for UI consumption using millisecond timestamps. */
export function dayLordAtMoment(momentMs: number, lonDeg: number): Planet {
  return calculateDayLord(momentMs / 86400000 + 2440587.5, lonDeg);
}

/** Wrapper for UI consumption using millisecond timestamps. */
export function horaLordAtMoment(momentMs: number, lonDeg: number): Planet {
  return calculateHoraLord(momentMs / 86400000 + 2440587.5, lonDeg);
}

/**
 * Milliseconds remaining until the current hora hands off to the next lord.
 * Each hora is exactly one local-solar clock hour (same simplified RKP rule
 * as calculateHoraLord) — used to drive the home dashboard's countdown.
 */
export function msUntilNextHora(momentMs: number, lonDeg: number): number {
  const jdUtc = momentMs / 86400000 + 2440587.5;
  const lstOffsetDays = lonDeg / 360;
  const jdLst = jdUtc + lstOffsetDays;
  const dayFraction = (jdLst + 0.5) % 1;
  const lstHours = dayFraction * 24;

  let hoursSinceSunrise = lstHours - 6;
  if (hoursSinceSunrise < 0) {
    hoursSinceSunrise += 24;
  }

  const fractionalHour = hoursSinceSunrise - Math.floor(hoursSinceSunrise);
  const hoursRemaining = 1 - fractionalHour;
  return hoursRemaining * 3600_000;
}

/**
 * Calculates the Hora Lord based on the Chaldean order.
 * Each hora is 1 local solar hour. Sunrise is at 6:00 AM.
 *
 * @param jdUtc Julian Day in UTC
 * @param lon Longitude in decimal degrees (East positive)
 */
export function calculateHoraLord(jdUtc: number, lon: number): Planet {
  // 1. Calculate Local Solar Time (LST) hours since midnight
  const lstOffsetDays = lon / 360;
  const jdLst = jdUtc + lstOffsetDays;
  const dayFraction = (jdLst + 0.5) % 1;
  const lstHours = dayFraction * 24;

  // 2. Determine hours since sunrise of the current planetary day
  // Sunrise is at 6:00 AM.
  let hoursSinceSunrise = lstHours - 6;
  if (hoursSinceSunrise < 0) {
    hoursSinceSunrise += 24;
  }

  // The hora number is the floor of hours since sunrise (0-23)
  const horaNumber = Math.floor(hoursSinceSunrise);

  // 3. Get the Day Lord (already respects sunrise)
  const dayLord = calculateDayLord(jdUtc, lon);

  // 4. Find starting index in Chaldean sequence and calculate current Hora Lord
  const startIdx = HORA_SEQUENCE.indexOf(dayLord);
  return HORA_SEQUENCE[(startIdx + horaNumber) % 7] as Planet;
}

export function getSignLordByLongitude(longitude: number): Planet {
  const SIGN_LORDS: Planet[] = [
    'Mars',
    'Venus',
    'Mercury',
    'Moon',
    'Sun',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Saturn',
    'Jupiter',
  ];
  return SIGN_LORDS[Math.floor((((longitude % 360) + 360) % 360) / 30)] as Planet;
}

function getNakshatraLord(longitude: number): Planet {
  const NAK_LORDS: Planet[] = [
    'Ketu',
    'Venus',
    'Sun',
    'Moon',
    'Mars',
    'Rahu',
    'Jupiter',
    'Saturn',
    'Mercury',
    'Ketu',
    'Venus',
    'Sun',
    'Moon',
    'Mars',
    'Rahu',
    'Jupiter',
    'Saturn',
    'Mercury',
    'Ketu',
    'Venus',
    'Sun',
    'Moon',
    'Mars',
    'Rahu',
    'Jupiter',
    'Saturn',
    'Mercury',
  ];
  return NAK_LORDS[Math.floor((((longitude % 360) + 360) % 360) / (40 / 3))] as Planet;
}

export interface RulingPlanetsInput {
  momentUtc: Date;
  lonDeg: number;
  ascendantLon: number;
  moonLon: number;
}

export function getRulingPlanets(input: RulingPlanetsInput): {
  set: [Planet, Planet, Planet, Planet, Planet, Planet];
} {
  // Use the Unix-to-JD constant for epoch conversion
  const jdUtc = input.momentUtc.getTime() / 86400000 + 2440587.5;
  const dayLord = calculateDayLord(jdUtc, input.lonDeg);
  const horaLord = calculateHoraLord(jdUtc, input.lonDeg);
  const ascSignLord = getSignLordByLongitude(input.ascendantLon);
  const ascStarLord = getNakshatraLord(input.ascendantLon);
  const moonSignLord = getSignLordByLongitude(input.moonLon);
  const moonStarLord = getNakshatraLord(input.moonLon);

  return {
    // RKP Sarfaraz Variant: Day, Hora, and Degree Lords are primary
    set: [dayLord, horaLord, ascSignLord, ascStarLord, moonSignLord, moonStarLord],
  };
}

/**
 * `Chart.rulingPlanets` is always the 6-tuple
 * `[dayLord, horaLord, ascSignLord, ascStarLord, moonSignLord, moonStarLord]`.
 */
export const HORA_LORD_INDEX = 1;

/**
 * The 5 Classical KP Witnesses — the 6-tuple minus Hora Lord.
 *
 * docs/RKP_RULES_FROM_SARFARAZ.md §"Ruling planets": "5 Classical KP
 * Witnesses plus 1 Confirmatory RKP Lord" — Hora Lord IS that confirmatory
 * RKP-specific addition, not one of classical KP's 5 canonical witnesses
 * (see docs/RKP_KP_FORENSIC_AUDIT.md §A). RKP's judgment engine uses all 6;
 * the classical KP engine uses only these 5.
 */
export function classicalWitnesses(rulingPlanets: readonly Planet[]): Planet[] {
  return rulingPlanets.filter((_, i) => i !== HORA_LORD_INDEX);
}
