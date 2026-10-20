/**
 * localTime — deriving a querent's local wall-clock moment on a UTC server.
 *
 * Cloud Functions run in UTC. The Digital Watch Oracle selects its house frame
 * from the minute showing on the QUERENT'S watch, so the server cannot read
 * that from its own clock: at 11:13 in Srinagar the server's UTC minute is 43,
 * which lands in a different 5-minute bracket and yields a different reading.
 *
 * Kept in utils rather than inside the callable so it is a pure function with
 * no Firebase or engine imports, and can be tested on its own.
 */

/**
 * Render an instant as an offset-bearing ISO 8601 string in the querent's zone.
 *
 * The watch engine reads the literal minute field out of the returned string,
 * so the string is written in local time, not UTC.
 *
 * @param instant           The authoritative moment. Server-generated.
 * @param utcOffsetMinutes  The querent's offset from UTC, in minutes
 *                          (+05:30 → 330). Validated upstream to the real range
 *                          of civil offsets in quarter-hour steps.
 */
export function localIsoFromOffset(instant: Date, utcOffsetMinutes: number): string {
  const shifted = new Date(instant.getTime() + utcOffsetMinutes * 60_000);

  // Math.abs in the padder lets the same helper serve the sign-carrying offset
  // fields, where the sign is written separately.
  const pad = (n: number, width = 2): string => String(Math.abs(n)).padStart(width, '0');

  const date = `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
  const time = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(
    shifted.getUTCSeconds(),
  )}`;

  const sign = utcOffsetMinutes < 0 ? '-' : '+';
  const offset = `${sign}${pad(Math.trunc(utcOffsetMinutes / 60))}:${pad(utcOffsetMinutes % 60)}`;

  return `${date}T${time}${offset}`;
}

/**
 * How far the phone's clock may differ from the server's before it is ignored.
 * Owner decision OD-002 (S1): two minutes.
 */
export const CLIENT_CLOCK_TOLERANCE_MS = 2 * 60_000;

/**
 * The instant whose local minute selects the watch bracket.
 *
 * The owner's rule is that the minute that counts is the one on the querent's
 * watch when they tapped Send, so a slow network cannot move a 07:29 question
 * into the 07:30 block. The phone's reading of that moment is only trusted when
 * it is close to the server's own clock (within CLIENT_CLOCK_TOLERANCE_MS,
 * inclusive); a missing, non-finite or distant value falls back to the server's
 * receive time, so a wrong device clock — or a caller choosing a minute to
 * re-roll a reading — can shift the bracket by at most two minutes.
 *
 * Only the BRACKET moment comes from here. The reading's recorded
 * `computedAt` stays the server's own instant.
 */
export function chooseAskedInstant(
  serverNow: Date,
  clientSentAtMs: number | undefined,
  toleranceMs: number = CLIENT_CLOCK_TOLERANCE_MS,
): Date {
  if (clientSentAtMs === undefined || !Number.isFinite(clientSentAtMs)) {
    return serverNow;
  }
  return Math.abs(clientSentAtMs - serverNow.getTime()) <= toleranceMs
    ? new Date(clientSentAtMs)
    : serverNow;
}
