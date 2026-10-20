/**
 * timingWindow.ts — the engine's day window, written as calendar dates.
 * --------------------------------------------------------------------------
 * Pipeline position: ReadingContract.diagnosis.timing → [this file] →
 * WatchOracleComposition.timingWindow (card + spoken text).
 *
 * Presentation arithmetic only. The window itself (minDays..maxDays) is the
 * engine's; this file adds nothing to it, never widens or rounds it, and
 * returns null whenever the engine gave no window. "Day N" is the querent's
 * local calendar date N days after the local date the question was asked —
 * a reading asked 20 October 2026 with a 42–63 day window runs from
 * 1 December to 22 December 2026.
 *
 * Deliberately not model-written: the synthesis prompt forbids calendar
 * dates and narrationValidator.ts rejects them as TIMING_FABRICATION. Dates
 * are attached after validation, exactly like ORACLE_BRAND_SEAL and remedy
 * text, so the model can never produce a wrong one.
 *
 * Pure: no Firebase or engine imports, testable on its own.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DAY_MS = 86_400_000;

export interface TimingWindowDates {
  readonly minDays: number;
  readonly maxDays: number;
  /** Local calendar date of the window's first day, YYYY-MM-DD. */
  readonly startDate: string;
  /** Local calendar date of the window's last day, YYYY-MM-DD. */
  readonly endDate: string;
  /** For display: "1–22 December 2026", "28 November – 19 December 2026". */
  readonly label: string;
}

/** A local calendar date, held as UTC fields so no host timezone leaks in. */
function localDateAfter(instant: Date, utcOffsetMinutes: number, days: number): Date {
  const local = new Date(instant.getTime() + utcOffsetMinutes * 60_000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight + days * DAY_MS);
}

function isoDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function rangeLabel(start: Date, end: Date): string {
  const day = (d: Date): number => d.getUTCDate();
  const month = (d: Date): string => MONTHS[d.getUTCMonth()]!;
  const year = (d: Date): number => d.getUTCFullYear();

  if (isoDate(start) === isoDate(end)) {
    return `${day(start)} ${month(start)} ${year(start)}`;
  }
  if (year(start) !== year(end)) {
    return `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${day(start)} ${month(start)} – ${day(end)} ${month(end)} ${year(end)}`;
  }
  return `${day(start)}–${day(end)} ${month(end)} ${year(end)}`;
}

/**
 * Calendar dates for the engine's window, or null when there is no window
 * or no querent timezone to anchor it to (an absent offset is never guessed:
 * a UTC date can be a day off for the seeker).
 */
export function computeTimingWindowDates(
  timing: { readonly minDays: number; readonly maxDays: number } | null,
  computedAt: Date,
  utcOffsetMinutes: number | undefined,
): TimingWindowDates | null {
  if (timing === null || utcOffsetMinutes === undefined) {
    return null;
  }
  const start = localDateAfter(computedAt, utcOffsetMinutes, timing.minDays);
  const end = localDateAfter(computedAt, utcOffsetMinutes, timing.maxDays);
  return Object.freeze({
    minDays: timing.minDays,
    maxDays: timing.maxDays,
    startDate: isoDate(start),
    endDate: isoDate(end),
    label: rangeLabel(start, end),
  });
}

/**
 * The one sentence the app speaks for the dates, appended after the
 * validated narration. Fixed wording: it states the window and nothing else.
 */
export function timingWindowSpokenSentence(dates: TimingWindowDates): string {
  return dates.startDate === dates.endDate
    ? `By the calendar, that falls on ${dates.label}.`
    : `By the calendar, that window runs ${dates.label.replace(/\s*–\s*/, ' to ')}.`;
}
