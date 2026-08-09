/**
 * watchChart — RKP's clock-based house wheel ("Watch of Currents").
 * --------------------------------------------------------------------------
 * Source: user-supplied RKP elaboration (chat, superseding the earlier
 * "Kanpur reference chart" formulation — there is no external reference
 * chart at all). The mechanism, fully specified with no invented data:
 *
 *   1. The 60 minutes of the hour are divided into 12 five-minute buckets,
 *      in ascending order, each mapped to one zodiac sign starting at Aries:
 *        00-05 Aries, 05-10 Taurus, 10-15 Gemini, 15-20 Cancer, 20-25 Leo,
 *        25-30 Virgo, 30-35 Libra, 35-40 Scorpio, 40-45 Sagittarius,
 *        45-50 Capricorn, 50-55 Aquarius, 55-60 Pisces.
 *   2. Whichever sign the current minute falls into becomes the 1st house
 *      (Lagna) DIRECTLY — there is no separate reference framework to
 *      locate it against.
 *   3. Houses 2-12 follow in natural forward zodiacal order from the Lagna
 *      sign (whole-sign houses) — confirmed exactly by the worked 10:51 PM
 *      example (minute 51 -> Aquarius/1st -> Pisces/2nd -> Aries/3rd -> ...
 *      -> Capricorn/12th).
 *   4. Real transiting planets (from the same Moshier/Lahiri ephemeris used
 *      everywhere else in this engine) are placed into these clock-houses
 *      by SIGN ONLY (whole-sign placement) — see clockHouseOfPlanet().
 *
 * This is a fundamentally different house model from Placidus: there is no
 * cusp degree, only a whole sign per house. Consequently sub-lord/nakshatra
 * precision does not apply to the clock houses themselves (a whole sign has
 * no single degree to subdivide) — only to real planetary longitudes
 * (Moon's sub-lord, dasha timing, etc.), which remain fully precise because
 * they come from the real ephemeris, untouched by this house model.
 *
 * Local time note: the source material requires the querent's exact civil
 * local minute (their real wristwatch), which needs a timezone/DST offset
 * this engine's current inputs (timestamp + lat/lon only) do not carry. When
 * no explicit offset is supplied, this falls back to the same local-SOLAR-
 * time approximation already used elsewhere in this codebase for Day/Hora
 * Lord (see primitives/rulingPlanets.ts) — clearly a simplification, not a
 * fabricated table.
 */

import type { Chart, HouseIndex, Planet, SignIndex } from '../types/chart';

// ── Classical sign lords, Aries(1) .. Pisces(12) — universal, undisputed ──────
// (Already used elsewhere in this codebase, e.g. rulingPlanets.ts's inline
// SIGN_LORDS — re-exported here as shared, named data instead of duplicated
// inline arrays.)
export const SIGN_LORDS: readonly Planet[] = Object.freeze([
  'Mars', // Aries
  'Venus', // Taurus
  'Mercury', // Gemini
  'Moon', // Cancer
  'Sun', // Leo
  'Mercury', // Virgo
  'Venus', // Libra
  'Mars', // Scorpio
  'Jupiter', // Sagittarius
  'Saturn', // Capricorn
  'Saturn', // Aquarius
  'Jupiter', // Pisces
]);

export function signLordOf(sign: SignIndex): Planet {
  return SIGN_LORDS[sign - 1] as Planet;
}

// ── Watch chart ────────────────────────────────────────────────────────────

export interface WatchChart {
  /** The local minute-of-hour actually used, [0, 59]. */
  readonly localMinute: number;
  /** Which of the 12 five-minute buckets that minute falls in, [0, 11]. */
  readonly bucketIndex: number;
  /** The sign occupying house 1 (Lagna). */
  readonly lagnaSign: SignIndex;
  /** houseSigns[h-1] = the sign occupying house h, for h = 1..12. */
  readonly houseSigns: readonly SignIndex[];
}

/**
 * Local minute-of-hour for the watch reading.
 *
 * @param momentUtc               The question moment.
 * @param lonDeg                  Geographic longitude (fallback path only).
 * @param timezoneOffsetMinutes   Civil timezone+DST offset from UTC, in
 *                                 minutes, if known (e.g. IST = +330). When
 *                                 supplied this is the faithful reading of
 *                                 the querent's actual wristwatch. Omit to
 *                                 fall back to local-solar-time approximation
 *                                 (see module docstring).
 */
export function localMinuteOfHour(
  momentUtc: Date,
  lonDeg: number,
  timezoneOffsetMinutes?: number,
): number {
  if (timezoneOffsetMinutes !== undefined) {
    const localMs = momentUtc.getTime() + timezoneOffsetMinutes * 60_000;
    return new Date(localMs).getUTCMinutes();
  }
  // Fallback: local solar time, same convention as calculateDayLord/
  // calculateHoraLord in rulingPlanets.ts.
  const jdUtc = momentUtc.getTime() / 86400000 + 2440587.5;
  const jdLst = jdUtc + lonDeg / 360;
  const dayFraction = (jdLst + 0.5) % 1;
  const totalMinutes = dayFraction * 24 * 60;
  return Math.floor(totalMinutes) % 60;
}

/** Build the 12-house whole-sign wheel from a local minute-of-hour. */
export function computeWatchChart(localMinute: number): WatchChart {
  const bucketIndex = Math.max(0, Math.min(11, Math.floor(localMinute / 5)));
  const lagnaSign = (bucketIndex + 1) as SignIndex;
  const houseSigns: SignIndex[] = Array.from(
    { length: 12 },
    (_, i) => (((lagnaSign - 1 + i) % 12) + 1) as SignIndex,
  );
  return {
    localMinute,
    bucketIndex,
    lagnaSign,
    houseSigns: Object.freeze(houseSigns),
  };
}

/** Which clock-house (1-12) a given sign occupies on this wheel. */
export function clockHouseOfSign(sign: SignIndex, watch: WatchChart): HouseIndex {
  const idx = watch.houseSigns.indexOf(sign);
  return ((idx === -1 ? 0 : idx) + 1) as HouseIndex;
}

/** Which clock-house a planet occupies, by its real transiting sign (whole-sign). */
export function clockHouseOfPlanet(planet: Planet, chart: Chart, watch: WatchChart): HouseIndex {
  return clockHouseOfSign(chart.planets[planet].sign, watch);
}

// ── Vastu direction mapping ────────────────────────────────────────────────
//
// Source: user-supplied RKP elaboration — "the entire 360-degree compass
// layout of your physical living space is mapped directly onto the 12
// numbers of a standard clock face... each house corresponds to a precise
// direction." Two tables were supplied in the same message:
//
//   (A) a 12-row table, worked for one specific Aquarius-Lagna chart, using
//       8-point directions (adds NE/SE for 2 of its 12 rows)
//   (B) a standalone 4-cardinal table, keyed by SIGN (not house), following
//       the classical element/direction correspondence:
//         East = fire signs (Aries, Leo, Sagittarius)
//         South = earth signs (Taurus, Virgo, Capricorn)
//         West = air signs (Gemini, Libra, Aquarius)
//         North = water signs (Cancer, Scorpio, Pisces)
//
// (A) and (B) agree on 10 of 12 entries when (A)'s houses are converted to
// signs on that same worked chart; they disagree only on Pisces (North vs
// North-East) and Taurus (South vs South-East). (B) is used here as the
// canonical rule: it is sign-based (so it doesn't depend on which house a
// sign currently occupies), internally consistent with the classical
// element scheme, and matches the majority of (A)'s own worked entries.
// See docs/RKP_WATCH_ENGINE.md for the full note. Revisit if the 8-point
// version turns out to be the intended one.
export type VastuDirection = 'North' | 'South' | 'East' | 'West';

export const SIGN_DIRECTIONS: readonly VastuDirection[] = Object.freeze([
  'East', // Aries (fire)
  'South', // Taurus (earth)
  'West', // Gemini (air)
  'North', // Cancer (water)
  'East', // Leo (fire)
  'South', // Virgo (earth)
  'West', // Libra (air)
  'North', // Scorpio (water)
  'East', // Sagittarius (fire)
  'South', // Capricorn (earth)
  'West', // Aquarius (air)
  'North', // Pisces (water)
]);

// ── Sign gender / polarity ─────────────────────────────────────────────────
//
// Source: RKP material, "Even vs. Odd Sign Gender Profiles" —
//   Odd signs (Aries, Gemini, Leo, Libra, Sagittarius, Aquarius): masculine
//     energy. Aggressive, logical, direct, or male individuals dominating
//     the situation.
//   Even signs (Taurus, Cancer, Virgo, Scorpio, Capricorn, Pisces): feminine
//     energy. Intuitive, defensive, risk-averse, administrative, or female
//     individuals controlling the outcome.
//
// Used to profile two actors: the querent (from the Lagna sign) and whoever
// controls the bottleneck (from the target house's sign). This is a
// structured fact only — the source material's own wording ("male
// individuals", "female individuals") is a claim about a real person the
// presentation layer must handle with care; see docs/RKP_WATCH_ENGINE.md.

export type SignPolarity = 'masculine' | 'feminine';

/** Odd signs (1,3,5,…) are masculine; even signs (2,4,6,…) are feminine. */
export function polarityOfSign(sign: SignIndex): SignPolarity {
  return sign % 2 === 1 ? 'masculine' : 'feminine';
}

export function directionOfSign(sign: SignIndex): VastuDirection {
  return SIGN_DIRECTIONS[sign - 1] as VastuDirection;
}

/** The physical direction currently associated with a clock-house. */
export function directionOfHouse(house: HouseIndex, watch: WatchChart): VastuDirection {
  return directionOfSign(watch.houseSigns[house - 1] as SignIndex);
}

/** All 12 houses' directions on this wheel, house 1..12 in order. */
export function houseDirections(watch: WatchChart): readonly VastuDirection[] {
  return watch.houseSigns.map(directionOfSign);
}
