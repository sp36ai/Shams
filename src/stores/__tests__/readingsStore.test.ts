/**
 * readingsStore — local reading-history cache regression tests.
 *
 * History is 100% local (MMKV): these tests lock dedup-by-id, newest-first
 * persistence, the 100-entry cache trim, and the sign-out teardown.
 */

import { storage, KEYS } from '@storage/mmkv';
import { useReadingsStore, type Reading } from '../readingsStore';

function makeReading(id: string, createdAt: string): Reading {
  return {
    id,
    question: `Question ${id}`,
    questionLang: 'en',
    category: 'career',
    verdict: 'YES',
    createdAt,
    chartJson: {},
    verdictJson: {},
  };
}

const isoAt = (offsetMs: number): string => new Date(1700000000000 + offsetMs).toISOString();

function storedReadings(): Reading[] {
  const raw = storage.getString(KEYS.READINGS_CACHE);
  return raw ? (JSON.parse(raw) as Reading[]) : [];
}

beforeEach(() => {
  useReadingsStore.getState().clearAll();
});

describe('addReading', () => {
  it('prepends new readings and persists them to MMKV', async () => {
    await useReadingsStore.getState().addReading(makeReading('a', isoAt(0)));
    await useReadingsStore.getState().addReading(makeReading('b', isoAt(1000)));
    expect(useReadingsStore.getState().readings.map(r => r.id)).toEqual(['b', 'a']);
    expect(storedReadings().map(r => r.id)).toEqual(['b', 'a']);
  });

  it('dedups by id — re-adding replaces instead of duplicating', async () => {
    await useReadingsStore.getState().addReading(makeReading('a', isoAt(0)));
    const updated = { ...makeReading('a', isoAt(5000)), question: 'updated' };
    await useReadingsStore.getState().addReading(updated);
    const readings = useReadingsStore.getState().readings;
    expect(readings).toHaveLength(1);
    expect(readings[0]!.question).toBe('updated');
  });

  it('trims the persisted cache to 100 entries, evicting the oldest', async () => {
    for (let i = 0; i < 105; i++) {
      await useReadingsStore.getState().addReading(makeReading(`r${i}`, isoAt(i * 1000)));
    }
    const stored = storedReadings();
    expect(stored).toHaveLength(100);
    // Newest-first: r104 survives, the five oldest (r0..r4) are evicted.
    expect(stored[0]!.id).toBe('r104');
    expect(stored.some(r => r.id === 'r0')).toBe(false);
  });
});

describe('deleteReading', () => {
  it('removes the reading from state and the persisted cache', async () => {
    await useReadingsStore.getState().addReading(makeReading('a', isoAt(0)));
    await useReadingsStore.getState().addReading(makeReading('b', isoAt(1000)));
    await useReadingsStore.getState().deleteReading('a');
    expect(useReadingsStore.getState().readings.map(r => r.id)).toEqual(['b']);
    expect(storedReadings().map(r => r.id)).toEqual(['b']);
  });
});

describe('clearAll — sign-out / deletion teardown', () => {
  it('empties state and deletes the MMKV key', async () => {
    await useReadingsStore.getState().addReading(makeReading('a', isoAt(0)));
    useReadingsStore.getState().clearAll();
    expect(useReadingsStore.getState().readings).toEqual([]);
    expect(storage.getString(KEYS.READINGS_CACHE)).toBeUndefined();
  });
});
