import { describe, expect, it } from 'vitest';

import { computeTimingWindowDates, timingWindowSpokenSentence } from '../timingWindow';

const IST = 330;

describe('computeTimingWindowDates', () => {
  it('Rafiq–Nusrat: 42–63 days from 20 October 2026, 13:57 IST is 1–22 December 2026', () => {
    // 13:57 IST on 20 October 2026 is 08:27 UTC.
    const dates = computeTimingWindowDates(
      { minDays: 42, maxDays: 63 },
      new Date('2026-10-20T08:27:00Z'),
      IST,
    );
    expect(dates).toEqual({
      minDays: 42,
      maxDays: 63,
      startDate: '2026-12-01',
      endDate: '2026-12-22',
      label: '1–22 December 2026',
    });
  });

  it('counts from the seeker’s local date, not the server’s UTC date', () => {
    // 20:00 UTC on 20 October is already 01:30 on 21 October in IST.
    const late = computeTimingWindowDates(
      { minDays: 42, maxDays: 63 },
      new Date('2026-10-20T20:00:00Z'),
      IST,
    );
    expect(late?.startDate).toBe('2026-12-02');
    expect(late?.endDate).toBe('2026-12-23');

    // And a negative offset can put the local date a day behind UTC.
    const west = computeTimingWindowDates(
      { minDays: 1, maxDays: 1 },
      new Date('2026-10-21T02:00:00Z'),
      -300,
    );
    expect(west?.startDate).toBe('2026-10-21');
  });

  it('labels a window that crosses a month boundary', () => {
    const dates = computeTimingWindowDates(
      { minDays: 30, maxDays: 60 },
      new Date('2026-10-20T08:27:00Z'),
      IST,
    );
    expect(dates?.label).toBe('19 November – 19 December 2026');
  });

  it('labels a window that crosses a year boundary', () => {
    const dates = computeTimingWindowDates(
      { minDays: 60, maxDays: 90 },
      new Date('2026-10-20T08:27:00Z'),
      IST,
    );
    expect(dates?.startDate).toBe('2026-12-19');
    expect(dates?.endDate).toBe('2027-01-18');
    expect(dates?.label).toBe('19 December 2026 – 18 January 2027');
  });

  it('labels a single-day window as one date', () => {
    const dates = computeTimingWindowDates(
      { minDays: 7, maxDays: 7 },
      new Date('2026-10-20T08:27:00Z'),
      IST,
    );
    expect(dates?.label).toBe('27 October 2026');
  });

  it('returns null when the engine gave no window', () => {
    expect(computeTimingWindowDates(null, new Date('2026-10-20T08:27:00Z'), IST)).toBeNull();
  });

  it('returns null rather than guessing when no timezone was supplied', () => {
    expect(
      computeTimingWindowDates(
        { minDays: 42, maxDays: 63 },
        new Date('2026-10-20T08:27:00Z'),
        undefined,
      ),
    ).toBeNull();
  });
});

describe('timingWindowSpokenSentence', () => {
  const at = new Date('2026-10-20T08:27:00Z');

  it('speaks a same-month range', () => {
    const dates = computeTimingWindowDates({ minDays: 42, maxDays: 63 }, at, IST)!;
    expect(timingWindowSpokenSentence(dates)).toBe(
      'By the calendar, that window runs 1 to 22 December 2026.',
    );
  });

  it('speaks a cross-month range without stray spacing', () => {
    const dates = computeTimingWindowDates({ minDays: 30, maxDays: 60 }, at, IST)!;
    expect(timingWindowSpokenSentence(dates)).toBe(
      'By the calendar, that window runs 19 November to 19 December 2026.',
    );
  });

  it('speaks a single day', () => {
    const dates = computeTimingWindowDates({ minDays: 7, maxDays: 7 }, at, IST)!;
    expect(timingWindowSpokenSentence(dates)).toBe(
      'By the calendar, that falls on 27 October 2026.',
    );
  });
});
