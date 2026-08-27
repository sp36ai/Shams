/**
 * readingThreadsStore — the Reading as a parent entity.
 *
 * The properties under test are the domain rules, not the plumbing: a Reading
 * is created on submit, its context is written once and never rewritten,
 * follow-ups belong to it, and the pre-thread transcript migrates into threads
 * rather than being dropped.
 */

import {
  useReadingThreadsStore,
  threadById,
  searchThreads,
  groupByRecency,
  discussionTurnsFor,
  contextFrom,
  migrateLegacyTranscript,
  type ReadingMessage,
  type ReadingThread,
} from '../readingThreadsStore';
import type { WatchReading } from '../../firebase/watchOracle';
import { storage, KEYS } from '@storage/mmkv';

function reading(readingId = 'r1', localMoment = '2026-08-08T11:13:00+05:30'): WatchReading {
  return {
    readingId,
    computedAt: '2026-08-08T05:43:00.000Z',
    localMoment,
    window: { startMinute: 43, endMinute: 48, minute: 43 },
    lagnaSignName: 'Burj Jauza',
    lagnaRulerName: 'Utarid',
    // Only the fields above are read by the store; the verdict is opaque here.
    verdict: {} as WatchReading['verdict'],
  };
}

function message(overrides: Partial<ReadingMessage> = {}): ReadingMessage {
  return {
    id: 'm1',
    role: 'user',
    text: 'Will the sale complete?',
    createdAt: '2026-08-08T05:43:00.000Z',
    status: 'sent',
    ...overrides,
  };
}

function openThread(question = 'Should I accept this business opportunity?'): ReadingThread {
  return useReadingThreadsStore.getState().createThread({
    id: 't1',
    question,
    questionLang: 'en',
  });
}

beforeEach(() => {
  useReadingThreadsStore.getState().clearAll();
  storage.delete(KEYS.ORACLE_CHAT_HISTORY);
});

describe('creating a Reading', () => {
  it('titles it from the question, so no Reading is ever called "New Reading"', () => {
    expect(openThread().title).toBe('Accept business opportunity');
  });

  it('starts with no reading id and no context - nothing has been cast yet', () => {
    const thread = openThread();
    expect(thread.readingId).toBeNull();
    expect(thread.context).toBeNull();
    expect(thread.status).toBe('pending');
  });

  it('persists to MMKV so the Reading survives a restart', () => {
    openThread();
    const raw = storage.getString(KEYS.READING_THREADS);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toHaveLength(1);
  });
});

describe('attaching the cast chart', () => {
  it('binds the server reading id and freezes the moment', () => {
    openThread();
    useReadingThreadsStore.getState().attachReading('t1', reading());

    const thread = threadById(useReadingThreadsStore.getState().threads, 't1');
    expect(thread?.readingId).toBe('r1');
    expect(thread?.status).toBe('complete');
    expect(thread?.context).toEqual(contextFrom(reading()));
  });

  it('never rewrites a context once written - a Reading keeps its own moment', () => {
    openThread();
    useReadingThreadsStore
      .getState()
      .attachReading('t1', reading('r1', '2026-08-08T11:13:00+05:30'));
    // A second cast against the same thread must not move the moment.
    useReadingThreadsStore
      .getState()
      .attachReading('t1', reading('r2', '2026-08-11T09:02:00+05:30'));

    const thread = threadById(useReadingThreadsStore.getState().threads, 't1');
    expect(thread?.context?.localMoment).toBe('2026-08-08T11:13:00+05:30');
  });
});

describe('messages belong to their Reading', () => {
  it('keeps two Readings apart', () => {
    const store = useReadingThreadsStore.getState();
    store.createThread({ id: 't1', question: 'Will the sale complete?', questionLang: 'en' });
    store.createThread({ id: 't2', question: 'Should I travel?', questionLang: 'en' });

    store.addMessage('t1', message({ id: 'a', text: 'Why so long?' }));
    store.addMessage('t2', message({ id: 'b', text: 'When?' }));

    const threads = useReadingThreadsStore.getState().threads;
    expect(threadById(threads, 't1')?.messages.map(m => m.id)).toEqual(['a']);
    expect(threadById(threads, 't2')?.messages.map(m => m.id)).toEqual(['b']);
  });

  it('updates a message in place, so a pending turn can resolve or fail', () => {
    openThread();
    useReadingThreadsStore.getState().addMessage('t1', message({ id: 'o1', status: 'sending' }));
    useReadingThreadsStore.getState().updateMessage('t1', 'o1', { status: 'sent', text: 'Delay.' });

    const msg = threadById(useReadingThreadsStore.getState().threads, 't1')?.messages[0];
    expect(msg?.status).toBe('sent');
    expect(msg?.text).toBe('Delay.');
  });
});

describe('discussionTurnsFor', () => {
  const thread: ReadingThread = {
    id: 't1',
    readingId: 'r1',
    title: 'Business opportunity',
    question: 'Should I accept?',
    questionLang: 'en',
    createdAt: '2026-08-08T05:43:00.000Z',
    updatedAt: '2026-08-08T05:50:00.000Z',
    status: 'complete',
    context: contextFrom(reading()),
    messages: [
      message({ id: 'u0', text: 'Should I accept?' }),
      message({ id: 'o0', role: 'oracle', text: '', variant: 'reading', reading: reading() }),
      message({ id: 'u1', text: 'Why so long?' }),
      message({ id: 'o1', role: 'oracle', text: 'The agent is slow.', variant: 'discussion' }),
      message({ id: 'u2', text: 'And meanwhile?' }),
    ],
  };

  it('sends what happened AFTER the reading - the server already holds the rest', () => {
    expect(discussionTurnsFor(thread, 'u2')).toEqual([
      { role: 'seeker', text: 'Why so long?' },
      { role: 'oracle', text: 'The agent is slow.' },
    ]);
  });

  it('excludes the message being answered, which travels separately', () => {
    expect(discussionTurnsFor(thread, 'u2').some(turn => turn.text === 'And meanwhile?')).toBe(
      false,
    );
  });

  it('skips turns that never resolved', () => {
    const pending: ReadingThread = {
      ...thread,
      messages: [...thread.messages, message({ id: 'o2', role: 'oracle', status: 'sending' })],
    };
    expect(discussionTurnsFor(pending).every(turn => turn.text.length > 0)).toBe(true);
  });
});

describe('searchThreads', () => {
  const threads: ReadingThread[] = [
    {
      id: 't1',
      readingId: 'r1',
      title: 'Career transition',
      question: 'Should I leave my current job?',
      questionLang: 'en',
      createdAt: '2026-08-08T05:43:00.000Z',
      updatedAt: '2026-08-08T05:43:00.000Z',
      status: 'complete',
      context: null,
      messages: [message({ id: 'm', role: 'oracle', text: 'Wait for the window.' })],
    },
    {
      id: 't2',
      readingId: 'r2',
      title: 'Property decision',
      question: 'Should I buy this shop?',
      questionLang: 'en',
      createdAt: '2026-08-07T05:43:00.000Z',
      updatedAt: '2026-08-07T05:43:00.000Z',
      status: 'complete',
      context: null,
      messages: [],
    },
  ];

  it('matches on title', () => {
    expect(searchThreads(threads, 'career').map(t => t.id)).toEqual(['t1']);
  });

  it('matches on the question the chart was cast for', () => {
    expect(searchThreads(threads, 'shop').map(t => t.id)).toEqual(['t2']);
  });

  it('matches inside the conversation, not just its opening', () => {
    expect(searchThreads(threads, 'window').map(t => t.id)).toEqual(['t1']);
  });

  it('returns everything, in order, for an empty term', () => {
    expect(searchThreads(threads, '  ').map(t => t.id)).toEqual(['t1', 't2']);
  });
});

describe('groupByRecency', () => {
  const now = new Date('2026-08-27T13:32:00');

  it('groups against the device own day boundaries', () => {
    const groups = groupByRecency(
      [
        { updatedAt: new Date('2026-08-27T00:30:00').toISOString() }, // today, after midnight
        { updatedAt: new Date('2026-08-26T22:00:00').toISOString() },
        { updatedAt: new Date('2026-08-24T10:00:00').toISOString() },
        { updatedAt: new Date('2026-08-05T10:00:00').toISOString() },
        { updatedAt: new Date('2025-01-05T10:00:00').toISOString() },
      ],
      now,
    );
    expect(groups.map(g => g.key)).toEqual([
      'today',
      'yesterday',
      'previous7',
      'previous30',
      'older',
    ]);
  });

  it('omits empty groups rather than rendering bare labels', () => {
    const groups = groupByRecency(
      [{ updatedAt: new Date('2026-08-27T09:00:00').toISOString() }],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('today');
  });
});

describe('migration from the pre-thread transcript', () => {
  it('splits the flat transcript into the threads that were always implicit', () => {
    const legacy: ReadingMessage[] = [
      message({ id: 'u0', text: 'Will the sale complete?' }),
      message({ id: 'o0', role: 'oracle', text: '', variant: 'reading', reading: reading('r1') }),
      message({ id: 'u1', text: 'Why so long?' }),
      message({ id: 'o1', role: 'oracle', text: 'The agent is slow.', variant: 'discussion' }),
      message({ id: 'u2', text: 'Should I travel?' }),
      message({ id: 'o2', role: 'oracle', text: '', variant: 'reading', reading: reading('r2') }),
    ];
    storage.set(KEYS.ORACLE_CHAT_HISTORY, JSON.stringify(legacy));
    storage.delete(KEYS.READING_THREADS);

    // The path a cold start takes when it finds no threads cache.
    const migrated = migrateLegacyTranscript();

    expect(migrated.map(t => t.readingId)).toEqual(['r2', 'r1']);
    const first = migrated.find(t => t.readingId === 'r1');
    expect(first?.question).toBe('Will the sale complete?');
    expect(first?.messages.map(m => m.id)).toEqual(['u0', 'o0', 'u1', 'o1']);
    // The question that opened the SECOND reading moved to that thread.
    expect(migrated.find(t => t.readingId === 'r2')?.messages.map(m => m.id)).toEqual(['u2', 'o2']);
    // Read once: the legacy key is gone afterwards.
    expect(storage.getString(KEYS.ORACLE_CHAT_HISTORY)).toBeUndefined();
  });
});
