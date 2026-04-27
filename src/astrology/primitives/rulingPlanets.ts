/**
 * RKP Ruling Planets — the 3 planets that rule the moment of judgment.
 * --------------------------------------------------------------------------
 * RKP (Ratan Kotamraju Paddhati) uses exactly THREE ruling planets:
 *
 *   1. Day Lord   — planet ruling the weekday (Sun–Sat order)
 *   2. Hora Lord  — Chaldean planetary hour, sunrise-anchored (~6 AM local)
 *   3. Minute Lord — one of 9 Vimshottari planets ruling the current 6m40s
 *                    segment within the current hora
 *
 * These are the verification filter for the verdict (Step 4 in RKP judgment).
 * Each RP placed in a favorable house adds +1; in a denial house, −1.
 *
 * Reference: docs/RKP_RULES_FROM_SARFARAZ.md §4 (Step 4) and §7 (Section 7)
 */

import type { Planet } from '../types/chart';
import { DASHA_SEQUENCE } from '../kp/rules/vimshottari';

// ── Day lordship ──────────────────────────────────────────────────────────────

/** Weekday 0=Sunday … 6=Saturday → ruling planet. */
export const DAY_LORDS: readonly Planet[] = Object.freeze([
  'Sun', // 0 Sunday
  'Moon', // 1 Monday
  'Mars', // 2 Tuesday
  'Mercury', // 3 Wednesday
  'Jupiter', // 4 Thursday
  'Venus', // 5 Friday
  'Saturn', // 6 Saturday
]);

const MS_PER_HOUR = 60 * 60 * 1000;

function localSolarDate(momentMs: number, lonDeg: number): Date {
  return new Date(momentMs + (lonDeg / 15) * MS_PER_HOUR);
}

export function dayLordAtMoment(momentMs: number, lonDeg: number): Planet {
  return DAY_LORDS[localSolarDate(momentMs, lonDeg).getUTCDay()] as Planet;
}

// ── Hora lordship ─────────────────────────────────────────────────────────────

/**
 * Chaldean hora sequence: Sun → Venus → Mercury → Moon → Saturn → Jupiter → Mars
 * This is the cyclic sequence for planetary hours (documented in RKP rules §4).
 */
const HORA_SEQUENCE: readonly Planet[] = Object.freeze([
  'Sun',
  'Venus',
  'Mercury',
  'Moon',
  'Saturn',
  'Jupiter',
  'Mars',
]);

/**
 * Which planet starts the FIRST hora of each weekday.
 * Sunday = Sun, Monday = Moon, Tuesday = Mars … (same as DAY_LORDS).
 */
const DAY_HORA_START: readonly Planet[] = DAY_LORDS;

/**
 * Returns the hora (planetary hour) lord.
 *
 * RKP anchors horas to sunrise, approximated as 6:00 AM local solar time.
 * All three ruling planets are derived from the same local-solar basis so the
 * day, hora, and minute rulers cannot drift across time frames.
 *
 * @param momentMs  Unix epoch milliseconds of the question moment
 * @param lonDeg    Geographic longitude, East positive
 */
export function horaLordAtMoment(momentMs: number, lonDeg: number): Planet {
  const local = localSolarDate(momentMs, lonDeg);
  const localH = local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;

  // Hours elapsed since ~6 AM (approximate sunrise)
  const hoursSinceSunrise = (((localH - 6) % 24) + 24) % 24;
  const horaIndex = Math.floor(hoursSinceSunrise) % 24;

  // Which weekday is it in local solar time?
  // If before 6 AM local → still the previous day's hora sequence
  const localDay = localH >= 6 ? local.getUTCDay() : (local.getUTCDay() + 6) % 7; // previous day

  const dayStartPlanet = DAY_HORA_START[localDay] as Planet;
  const startIdx = HORA_SEQUENCE.indexOf(dayStartPlanet);
  return HORA_SEQUENCE[(startIdx + horaIndex) % 7] as Planet;
}

// ── Minute lordship ───────────────────────────────────────────────────────────

/**
 * Minute lord: the hora is divided into 9 equal segments of 6m40s each.
 * Sequence = Vimshottari DASHA_SEQUENCE (Ketu → Mercury).
 *
 * Segment boundaries (minutes within the current local-solar hour):
 *   0–6:39  → Ketu
 *   6:40–13:19 → Venus
 *   13:20–19:59 → Sun
 *   20:00–26:39 → Moon
 *   26:40–33:19 → Mars
 *   33:20–39:59 → Rahu
 *   40:00–46:39 → Jupiter
 *   46:40–53:19 → Saturn
 *   53:20–59:59 → Mercury
 */
export function minuteLordAtMoment(momentMs: number, lonDeg: number): Planet {
  const local = localSolarDate(momentMs, lonDeg);
  const minuteOfHour = local.getUTCMinutes() + local.getUTCSeconds() / 60;
  const segmentIndex = Math.min(8, Math.floor(minuteOfHour / (60 / 9)));
  return DASHA_SEQUENCE[segmentIndex] as Planet;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RulingPlanetsInput {
  momentUtc: Date;
  /** Geographic longitude of the questioner (degrees, East positive). */
  lonDeg: number;
}

export interface RulingPlanetsResult {
  dayLord: Planet;
  horaLord: Planet;
  minuteLord: Planet;
  /**
   * Array of the 3 RPs in order [dayLord, horaLord, minuteLord].
   * Duplicates retained (same planet in two positions still scores twice).
   */
  set: readonly Planet[];
}

export function getRulingPlanets(input: RulingPlanetsInput): RulingPlanetsResult {
  const momentMs = input.momentUtc.getTime();
  const dayLord = dayLordAtMoment(momentMs, input.lonDeg);
  const horaLord = horaLordAtMoment(momentMs, input.lonDeg);
  const minuteLord = minuteLordAtMoment(momentMs, input.lonDeg);

  return {
    dayLord,
    horaLord,
    minuteLord,
    set: Object.freeze([dayLord, horaLord, minuteLord]),
  };
}
