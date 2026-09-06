/**
 * RKP watch grid — the 5-minute moving house frame.
 * --------------------------------------------------------------------------
 * This is the defining mechanism of the Digital Watch Oracle (see README).
 * The querent's WATCH FACE selects the house frame: the hour is divided into
 * twelve 5-minute brackets, and the bracket containing the moment of asking
 * fixes the 1st Ghar. The remaining eleven signs follow in zodiacal order.
 *
 * WHAT THIS IS, PRECISELY
 *   This is a moment-selected house frame, not a horizon-computed Ascendant.
 *   It is the same class of technique as KP's 1-249 number method, where the
 *   querent's chosen number — not the local horizon — fixes the Ascendant.
 *   The selector here is the watch minute rather than a spoken number.
 *
 *   It is therefore NOT interchangeable with `primitives/houseCusps.ts`, which
 *   computes the true Ascendant from RAMC, obliquity and geographic latitude.
 *   Both live in this repo and answer different questions:
 *
 *     Watch frame  → this module. Frame from the watch minute.
 *     Sky frame    → primitives/houseCusps.ts / chartBuilder.ts. Frame from
 *                    the horizon, still used to place real planets.
 *
 *   Do not describe this module's output as "the Ascendant on the horizon",
 *   and do not substitute one frame for the other. (The Astronomical/KP
 *   Oracle that once surfaced the sky frame to users has been removed; the
 *   distinction still matters because both frames remain in the engine.)
 *
 *   The PLANETS placed into this frame are real: true sidereal positions from
 *   the Meeus/VSOP87 ephemeris, with genuine retrograde and combustion state.
 *   Only the frame is watch-derived.
 *
 * WHY LOCAL TIME
 *   The mechanism is the querent's watch face, so the minute must be their
 *   LOCAL wall-clock minute. This is not pedantry: offsets such as +05:30 and
 *   +05:45 shift the minute field, so a UTC minute would select a different
 *   bracket than the watch the querent is actually looking at. We therefore
 *   read the literal minute written in the offset-bearing ISO string rather
 *   than going through Date, whose getMinutes() reports the RUNTIME's zone —
 *   the server's, not the querent's.
 */

import type { SignIndex } from '@astrology/types/chart';
import { SIGN_META, type Direction, type HouseNumber } from './nomenclature';

/** Number of minutes each bracket spans. Twelve brackets fill the hour. */
export const BRACKET_MINUTES = 5;

/** Bracket ordinal within the hour, 0 (:00–:05) .. 11 (:55–:60). */
export type BracketIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface WatchWindow {
  /** Which 5-minute bracket of the hour the question fell in. */
  readonly bracket: BracketIndex;
  /** Local wall-clock minute used for selection, [0, 59]. */
  readonly minute: number;
  /** Inclusive start minute of the bracket. */
  readonly startMinute: number;
  /** Exclusive end minute of the bracket. */
  readonly endMinute: number;
  /** The sign occupying the 1st Ghar for this window. */
  readonly lagnaSign: SignIndex;
}

/* -------------------------------------------------------------------------- */
/*  Local-minute extraction                                                   */
/* -------------------------------------------------------------------------- */

/**
 * ISO 8601 with a time component. We capture the literal HH and MM fields.
 * Accepts `Z`, `+HH:MM`, `-HH:MM`, or no offset at all.
 */
const ISO_TIME_RE = /T(\d{2}):(\d{2})/;

/**
 * Read the querent's local wall-clock minute from an ISO 8601 timestamp.
 *
 * The literal minute field IS the local minute, because an offset-bearing ISO
 * string is written in local time (`2026-08-08T11:13:00+05:30` is 11:13 on the
 * querent's watch). Deliberately avoids `new Date(iso).getMinutes()`, which
 * would return the minute in the RUNTIME's timezone — on a server in UTC that
 * turns 11:13+05:30 into minute 43 and selects the wrong bracket.
 *
 * @throws if the string carries no parseable time component.
 */
export function localMinuteFromIso(iso8601: string): number {
  const match = ISO_TIME_RE.exec(iso8601);
  if (match === null) {
    throw new RangeError(
      `[rkp] Cannot read a local minute from "${iso8601}" — expected ISO 8601 with a time part.`,
    );
  }
  const minute = Number(match[2]);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`[rkp] Minute out of range in "${iso8601}".`);
  }
  return minute;
}

/* -------------------------------------------------------------------------- */
/*  Grid                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Map a local wall-clock minute to its bracket.
 * Brackets are half-open: [00,05) → 0, [05,10) → 1, … [55,60) → 11.
 */
export function bracketFromMinute(minute: number): BracketIndex {
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`[rkp] Minute must be in [0, 59], received ${minute}.`);
  }
  return Math.floor(minute / BRACKET_MINUTES) as BracketIndex;
}

/**
 * The sign occupying the 1st Ghar for a given minute.
 * Bracket 0 → Burj Hamal (1), bracket 11 → Burj Hoot (12).
 */
export function lagnaFromMinute(minute: number): SignIndex {
  return (bracketFromMinute(minute) + 1) as SignIndex;
}

/** Full window description for a moment — what the UI shows as "your window". */
export function watchWindowFromIso(iso8601: string): WatchWindow {
  const minute = localMinuteFromIso(iso8601);
  const bracket = bracketFromMinute(minute);
  return {
    bracket,
    minute,
    startMinute: bracket * BRACKET_MINUTES,
    endMinute: (bracket + 1) * BRACKET_MINUTES,
    lagnaSign: (bracket + 1) as SignIndex,
  };
}

/**
 * Rotate the twelve signs through the twelve Ghars from a given Lagna sign.
 * Returned array is 0-indexed by house-1: `[0]` is the 1st Ghar.
 */
export function rotateHouses(lagnaSign: SignIndex): readonly SignIndex[] {
  const out: SignIndex[] = [];
  for (let house = 0; house < 12; house += 1) {
    out.push((((lagnaSign - 1 + house) % 12) + 1) as SignIndex);
  }
  return Object.freeze(out);
}

/** The sign occupying a given Ghar, for a given Lagna. */
export function signOfHouse(lagnaSign: SignIndex, house: HouseNumber): SignIndex {
  return (((lagnaSign - 1 + house - 1) % 12) + 1) as SignIndex;
}

/** Which Ghar a given sign occupies, for a given Lagna. Inverse of signOfHouse. */
export function houseOfSign(lagnaSign: SignIndex, sign: SignIndex): HouseNumber {
  return (((sign - lagnaSign + 12) % 12) + 1) as HouseNumber;
}

/** Compass direction of a Ghar — the bridge from chart to physical space. */
export function directionOfHouse(lagnaSign: SignIndex, house: HouseNumber): Direction {
  return SIGN_META[signOfHouse(lagnaSign, house)].direction;
}
