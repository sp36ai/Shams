/**
 * chatTime — day separators for a Reading's conversation.
 * --------------------------------------------------------------------------
 * Presentation only. Every value here is derived from a message's own stored
 * `createdAt`; nothing about the reading or its moment is touched. Days are
 * the device's local calendar days; dates are formatted for the UI language.
 *
 * A malformed `createdAt` (a legacy or corrupted record) yields no label
 * rather than "Invalid Date", and never starts a new day.
 */

type Lang = 'en' | 'ur' | 'hi';

const LOCALE_BY_LANG: Readonly<Record<Lang, string>> = {
  en: 'en-US',
  ur: 'ur-PK',
  hi: 'hi-IN',
};

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar day, e.g. "2026-09-23". Null for an unparseable timestamp. */
export function localDayKey(iso: string): string | null {
  const d = parse(iso);
  if (d === null) {
    return null;
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type DayLabel = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'date'; text: string };

/**
 * What a day separator says. "Today"/"Yesterday" are returned as kinds so
 * the caller renders them through i18n; any other day is a formatted date,
 * with the year only when it differs from `now`'s.
 */
export function dayLabelFor(iso: string, now: Date, lang: Lang): DayLabel | null {
  const d = parse(iso);
  if (d === null) {
    return null;
  }
  const key = localDayKey(iso);
  if (key === localDayKey(now.toISOString())) {
    return { kind: 'today' };
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === localDayKey(yesterday.toISOString())) {
    return { kind: 'yesterday' };
  }
  return {
    kind: 'date',
    text: d.toLocaleDateString(LOCALE_BY_LANG[lang], {
      day: 'numeric',
      month: 'short',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
    }),
  };
}

/** A day chip row, as interleaved by withDaySeparators. */
export interface DaySeparatorRow {
  kind: 'day';
  key: string;
  iso: string;
}

/**
 * Interleave day separators into a conversation's rows, WhatsApp-style: one
 * before the first row and one wherever the local day changes. `isoOf` says
 * when a row happened. Rows keep their order; a row with no time, or an
 * unparseable one, never starts a new day, so it stays with the rows around it.
 */
export function withDaySeparators<T extends { key: string }>(
  rows: readonly T[],
  isoOf: (row: T) => string | undefined,
): (T | DaySeparatorRow)[] {
  const out: (T | DaySeparatorRow)[] = [];
  let currentDay: string | null = null;
  for (const row of rows) {
    const iso = isoOf(row);
    const day = iso === undefined ? null : localDayKey(iso);
    if (iso !== undefined && day !== null && day !== currentDay) {
      out.push({ kind: 'day', key: `day_${day}`, iso });
      currentDay = day;
    }
    out.push(row);
  }
  return out;
}
