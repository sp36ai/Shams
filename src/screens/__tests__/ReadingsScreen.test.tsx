/**
 * ReadingsScreen — "Your Readings".
 *
 * buildRows() is where the list's real rules live — recency grouping, search
 * over title and question, and the archive/thread merge that stops one Reading
 * appearing twice — so it is tested directly rather than through the rendered
 * tree, which would only re-assert React's own behavior.
 */

import { buildRows } from '../ReadingsScreen';
import type { ReadingThread } from '@stores/readingThreadsStore';
import type { Reading } from '@stores/readingsStore';

const NOW = new Date('2026-08-27T13:32:00');

function thread(overrides: Partial<ReadingThread> = {}): ReadingThread {
  return {
    id: 't1',
    readingId: 'r1',
    title: 'Business opportunity',
    question: 'Should I accept this opportunity?',
    questionLang: 'en',
    createdAt: '2026-08-27T09:00:00.000Z',
    updatedAt: new Date('2026-08-27T09:00:00').toISOString(),
    status: 'complete',
    context: null,
    messages: [],
    ...overrides,
  };
}

function archived(overrides: Partial<Reading> = {}): Reading {
  return {
    id: 'r9',
    question: 'Will the journey be safe?',
    questionLang: 'en',
    category: 'general',
    verdict: 'YES',
    createdAt: new Date('2026-08-26T09:00:00').toISOString(),
    chartJson: null,
    verdictJson: null,
    ...overrides,
  };
}

describe('buildRows', () => {
  it('puts a group label above each run of Readings', () => {
    const rows = buildRows([thread()], [archived()], '', NOW);
    expect(rows.map(r => r.kind)).toEqual(['group', 'thread', 'group', 'archive']);
    expect(rows[0]).toMatchObject({ kind: 'group', groupKey: 'today' });
    expect(rows[2]).toMatchObject({ kind: 'group', groupKey: 'yesterday' });
  });

  it('never lists one Reading twice — the thread wins over its archive copy', () => {
    const rows = buildRows([thread()], [archived({ id: 'r1' })], '', NOW);
    expect(rows.filter(r => r.kind !== 'group')).toHaveLength(1);
    expect(rows.find(r => r.kind !== 'group')?.kind).toBe('thread');
  });

  it('keeps pre-thread readings visible, so nothing is lost', () => {
    const rows = buildRows([], [archived()], '', NOW);
    expect(rows.some(r => r.kind === 'archive')).toBe(true);
  });

  it('searches titles and questions across both kinds', () => {
    const rows = buildRows([thread()], [archived()], 'journey', NOW);
    const items = rows.filter(r => r.kind !== 'group');
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('archive');
  });

  it('returns no rows at all when nothing matches, so the search empty state shows', () => {
    expect(buildRows([thread()], [archived()], 'zzzz', NOW)).toEqual([]);
  });

  it('orders newest first across threads and archive together', () => {
    const rows = buildRows(
      [thread({ id: 't_old', updatedAt: new Date('2026-08-20T09:00:00').toISOString() })],
      [archived()],
      '',
      NOW,
    );
    const keys = rows.filter(r => r.kind !== 'group').map(r => r.key);
    expect(keys).toEqual(['a_r9', 't_old']);
  });
});
