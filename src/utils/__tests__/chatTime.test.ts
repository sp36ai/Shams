import { dayLabelFor, localDayKey, withDaySeparators } from '../chatTime';

/** A local-time instant, so every assertion holds in any test-machine timezone. */
function local(y: number, mo: number, d: number, h = 12, mi = 0): string {
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

describe('localDayKey', () => {
  it('keys a timestamp by its local calendar day', () => {
    expect(localDayKey(local(2026, 9, 23, 0, 5))).toBe('2026-09-23');
    expect(localDayKey(local(2026, 9, 23, 23, 55))).toBe('2026-09-23');
  });

  it('returns null for an unparseable timestamp', () => {
    expect(localDayKey('not a date')).toBeNull();
    expect(localDayKey('')).toBeNull();
  });
});

describe('dayLabelFor', () => {
  const now = new Date(2026, 8, 23, 15, 0);

  it('says today for the same local day', () => {
    expect(dayLabelFor(local(2026, 9, 23, 0, 1), now, 'en')).toEqual({ kind: 'today' });
  });

  it('says yesterday for the previous local day, including across a month boundary', () => {
    expect(dayLabelFor(local(2026, 9, 22, 23, 59), now, 'en')).toEqual({ kind: 'yesterday' });
    const firstOfMonth = new Date(2026, 9, 1, 9, 0);
    expect(dayLabelFor(local(2026, 9, 30, 20, 0), firstOfMonth, 'en')).toEqual({
      kind: 'yesterday',
    });
  });

  it('gives a date without the year for an older day this year', () => {
    const label = dayLabelFor(local(2026, 9, 1), now, 'en');
    expect(label?.kind).toBe('date');
    expect(label?.kind === 'date' ? label.text : '').not.toMatch(/2026/);
  });

  it('includes the year for a day in another year', () => {
    const label = dayLabelFor(local(2025, 12, 31), now, 'en');
    expect(label?.kind === 'date' ? label.text : '').toMatch(/2025/);
  });

  it('returns null for an unparseable timestamp', () => {
    expect(dayLabelFor('nope', now, 'en')).toBeNull();
  });
});

describe('withDaySeparators', () => {
  const row = (key: string, at?: string) => ({ key, at });
  const sep = (rows: { key: string; at?: string }[]) => withDaySeparators(rows, r => r.at);
  const keys = (out: ReturnType<typeof sep>) =>
    out.map(r => ('kind' in r && r.kind === 'day' ? `|${r.key}` : r.key));

  it('is empty for an empty conversation', () => {
    expect(sep([])).toEqual([]);
  });

  it('puts one separator before the first row and one at each day change', () => {
    const out = sep([
      row('a', local(2026, 9, 21, 10)),
      row('b', local(2026, 9, 21, 11)),
      row('c', local(2026, 9, 23, 9)),
    ]);
    expect(keys(out)).toEqual(['|day_2026-09-21', 'a', 'b', '|day_2026-09-23', 'c']);
  });

  it('keeps order and never lets a missing or unparseable time start a new day', () => {
    const out = sep([
      row('a', local(2026, 9, 23, 10)),
      row('broken', 'not a date'),
      row('untimed'),
      row('b', local(2026, 9, 23, 11)),
    ]);
    expect(keys(out)).toEqual(['|day_2026-09-23', 'a', 'broken', 'untimed', 'b']);
  });

  it('gives every row a unique key', () => {
    const out = sep([
      row('a', local(2026, 9, 21)),
      row('b', local(2026, 9, 22)),
      row('c', local(2026, 9, 23)),
    ]);
    const all = out.map(r => r.key);
    expect(new Set(all).size).toBe(all.length);
  });
});
