/**
 * chatTime — timestamps and day separators for a Reading's conversation.
 * --------------------------------------------------------------------------
 * Presentation only. Every value here is derived from a message's own stored
 * `createdAt`; nothing about the reading or its moment is touched. Times and
 * dates are shown in the device's local timezone, formatted for the UI
 * language.
 *
 * A malformed `createdAt` (a legacy or corrupted record) yields no label
 * rather than "Invalid Date": the bubble simply shows no time.
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

/** The time shown in a bubble's corner, e.g. "4:07 PM". Null if unparseable. */
export function bubbleTimeLabel(iso: string, lang: Lang): string | null {
  const d = parse(iso);
  if (d === null) {
    return null;
  }
  return d.toLocaleTimeString(LOCALE_BY_LANG[lang], { hour: 'numeric', minute: '2-digit' });
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

export type ChatRow<M> =
  | { type: 'separator'; key: string; iso: string }
  | { type: 'message'; key: string; message: M };

/**
 * Interleave day separators into a conversation, WhatsApp-style: one before
 * the first message and one wherever the local day changes. Messages keep
 * their order; a message with an unparseable timestamp never starts a new
 * day, so it stays with the messages around it.
 */
export function withDaySeparators<M extends { id: string; createdAt: string }>(
  messages: readonly M[],
): ChatRow<M>[] {
  const rows: ChatRow<M>[] = [];
  let currentDay: string | null = null;
  for (const message of messages) {
    const day = localDayKey(message.createdAt);
    if (day !== null && day !== currentDay) {
      rows.push({ type: 'separator', key: `day_${day}`, iso: message.createdAt });
      currentDay = day;
    }
    rows.push({ type: 'message', key: message.id, message });
  }
  return rows;
}
