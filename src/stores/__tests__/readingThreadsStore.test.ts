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
    requestId: 'req_t1',
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

  it('never rewrites a bound Reading - not its moment, not which reading it is', () => {
    openThread();
    useReadingThreadsStore
      .getState()
      .attachReading('t1', reading('r1', '2026-08-08T11:13:00+05:30'));
    // Anything arriving later — a racing retry, a future temporal feature —
    // must leave both the moment and the reading it names untouched.
    useReadingThreadsStore
      .getState()
      .attachReading('t1', reading('r2', '2026-08-11T09:02:00+05:30'));

    const thread = threadById(useReadingThreadsStore.getState().threads, 't1');
    expect(thread?.context?.localMoment).toBe('2026-08-08T11:13:00+05:30');
    expect(thread?.readingId).toBe('r1');
  });

  it('freezes the context at runtime, where readonly types no longer exist', () => {
    openThread();
    useReadingThreadsStore.getState().attachReading('t1', reading());
    const context = threadById(useReadingThreadsStore.getState().threads, 't1')?.context;

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context?.window)).toBe(true);
  });

  it('carries a requestId that survives persistence, so a retry can replay', () => {
    const thread = openThread();
    expect(thread.requestId).toBe('req_t1');
    const persisted = JSON.parse(storage.getString(KEYS.READING_THREADS) as string) as Array<{
      requestId?: string;
    }>;
    expect(persisted[0]?.requestId).toBe('req_t1');
  });
});

describe('restateQuestion', () => {
  it('moves the question, its title and its requestId together', () => {
    openThread('Should I accept this business opportunity?');
    useReadingThreadsStore.getState().restateQuestion('t1', 'Should I sell the shop?', 'req_new');

    const thread = threadById(useReadingThreadsStore.getState().threads, 't1');
    expect(thread?.question).toBe('Should I sell the shop?');
    expect(thread?.title).toBe('Sell shop');
    // A different question is a different act of asking: reusing the old id
    // could make the server replay the earlier reading as its answer.
    expect(thread?.requestId).toBe('req_new');
    expect(thread?.status).toBe('pending');
  });

  it('refuses once a chart has landed - then a different question is a different Reading', () => {
    openThread('Should I accept this business opportunity?');
    useReadingThreadsStore.getState().attachReading('t1', reading());
    useReadingThreadsStore.getState().restateQuestion('t1', 'Should I sell the shop?', 'req_new');

    const thread = threadById(useReadingThreadsStore.getState().threads, 't1');
    expect(thread?.question).toBe('Should I accept this business opportunity?');
    expect(thread?.requestId).toBe('req_t1');
  });
});

describe('eviction', () => {
  it('drops the least recently active Reading, not the earliest created', () => {
    const store = useReadingThreadsStore.getState();
    store.createThread({ id: 'old', requestId: 'r_old', question: 'Old one?', questionLang: 'en' });
    store.createThread({ id: 'new', requestId: 'r_new', question: 'New one?', questionLang: 'en' });

    // The older Reading is revived with a follow-up. Adding a message leaves a
    // thread where it sits in the array, so recency has to be read from
    // updatedAt or eviction would drop the conversation in active use.
    useReadingThreadsStore
      .getState()
      .addMessage('old', message({ id: 'f1', createdAt: '2030-01-01T00:00:00.000Z' }));

    const persisted = JSON.parse(storage.getString(KEYS.READING_THREADS) as string) as Array<{
      id: string;
    }>;
    expect(persisted[0]?.id).toBe('old');
  });
});

describe('messages belong to their Reading', () => {
  it('keeps two Readings apart', () => {
    const store = useReadingThreadsStore.getState();
    store.createThread({
      id: 't1',
      requestId: 'req_t1',
      question: 'Will the sale complete?',
      questionLang: 'en',
    });
    store.createThread({
      id: 't2',
      requestId: 'req_t2',
      question: 'Should I travel?',
      questionLang: 'en',
    });

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
    requestId: 'req_t1',
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
      requestId: 'req_t1',
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
      requestId: 'req_t2',
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
  function legacy(messages: ReadingMessage[]): void {
    storage.set(KEYS.ORACLE_CHAT_HISTORY, JSON.stringify(messages));
    storage.delete(KEYS.READING_THREADS);
  }

  const verdict = (id: string, readingId: string) =>
    message({ id, role: 'oracle', text: '', variant: 'reading', reading: reading(readingId) });

  it('splits the flat transcript into the threads that were always implicit', () => {
    legacy([
      message({ id: 'u0', text: 'Will the sale complete?' }),
      verdict('o0', 'r1'),
      message({ id: 'u1', text: 'Why so long?' }),
      message({ id: 'o1', role: 'oracle', text: 'The agent is slow.', variant: 'discussion' }),
      message({ id: 'u2', text: 'Should I travel?' }),
      verdict('o2', 'r2'),
    ]);

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

  it('is idempotent - running it twice leaves exactly what running it once did', () => {
    legacy([
      message({ id: 'u0', text: 'Will the sale complete?' }),
      verdict('o0', 'r1'),
      message({ id: 'u1', text: 'Why so long?' }),
      message({ id: 'o1', role: 'oracle', text: 'The agent is slow.', variant: 'discussion' }),
    ]);

    const once = migrateLegacyTranscript();
    const afterOnce = storage.getString(KEYS.READING_THREADS);

    // A second run — a re-entrant call, a crash-and-restart — finds no source
    // and must neither duplicate the threads nor erase them.
    const twice = migrateLegacyTranscript();

    expect(twice).toEqual([]);
    expect(storage.getString(KEYS.READING_THREADS)).toBe(afterOnce);
    expect(JSON.parse(afterOnce as string)).toHaveLength(once.length);
  });

  it('records that it ran even when there was nothing to migrate', () => {
    storage.delete(KEYS.ORACLE_CHAT_HISTORY);
    storage.delete(KEYS.READING_THREADS);

    expect(migrateLegacyTranscript()).toEqual([]);
    // "Migration has run" is a fact on disk, not an inference from an absent
    // key — otherwise every cold start would re-enter this path.
    expect(storage.getString(KEYS.READING_THREADS)).toBe('[]');
  });

  it('migrates a single Reading with no follow-ups', () => {
    legacy([message({ id: 'u0', text: 'Will the sale complete?' }), verdict('o0', 'r1')]);

    const migrated = migrateLegacyTranscript();
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.messages.map(m => m.id)).toEqual(['u0', 'o0']);
    expect(migrated[0]?.status).toBe('complete');
  });

  it('keeps consecutive Readings apart, even with no messages between them', () => {
    legacy([
      message({ id: 'u0', text: 'Will the sale complete?' }),
      verdict('o0', 'r1'),
      message({ id: 'u1', text: 'Should I travel?' }),
      verdict('o1', 'r2'),
      message({ id: 'u2', text: 'And the house?' }),
      verdict('o2', 'r3'),
    ]);

    const migrated = migrateLegacyTranscript();
    expect(migrated.map(t => t.readingId)).toEqual(['r3', 'r2', 'r1']);
    expect(migrated.every(t => t.messages.length === 2)).toBe(true);
    expect(migrated.map(t => t.question)).toEqual([
      'And the house?',
      'Should I travel?',
      'Will the sale complete?',
    ]);
  });

  it('drops orphan messages that precede any verdict rather than guessing', () => {
    legacy([
      message({ id: 'o_orphan', role: 'oracle', text: 'A stray reply.', variant: 'discussion' }),
      message({ id: 'u0', text: 'Will the sale complete?' }),
      verdict('o0', 'r1'),
    ]);

    const migrated = migrateLegacyTranscript();
    expect(migrated).toHaveLength(1);
    // The orphan belonged to no Reading; the question immediately before the
    // verdict still opens one.
    expect(migrated[0]?.messages.map(m => m.id)).toEqual(['u0', 'o0']);
  });

  it('keeps a Reading whose question was never persisted, rather than dropping it', () => {
    legacy([verdict('o0', 'r1')]);

    const migrated = migrateLegacyTranscript();
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.question).toBe('');
    expect(migrated[0]?.readingId).toBe('r1');
  });

  it('leaves a half-written conversation openable', () => {
    // The app died with a follow-up still in flight.
    legacy([
      message({ id: 'u0', text: 'Will the sale complete?' }),
      verdict('o0', 'r1'),
      message({ id: 'u1', text: 'Why so long?' }),
      message({ id: 'o1', role: 'oracle', text: '', variant: 'discussion', status: 'sending' }),
    ]);

    const migrated = migrateLegacyTranscript();
    expect(migrated[0]?.messages.map(m => m.id)).toEqual(['u0', 'o0', 'u1', 'o1']);
    expect(migrated[0]?.status).toBe('complete');
  });

  it('does not start a thread from a verdict with no usable reading id', () => {
    const damaged = message({
      id: 'o_bad',
      role: 'oracle',
      text: '',
      variant: 'reading',
      reading: { ...reading('r1'), readingId: '' },
    });
    legacy([message({ id: 'u0', text: 'Will the sale complete?' }), damaged, verdict('o1', 'r2')]);

    const migrated = migrateLegacyTranscript();
    // The damaged entry cost only itself: the question still opened the real
    // Reading that followed.
    expect(migrated.map(t => t.readingId)).toEqual(['r2']);
    expect(migrated[0]?.question).toBe('Will the sale complete?');
  });

  it('survives corrupt legacy data without leaving the migration armed', () => {
    storage.set(KEYS.ORACLE_CHAT_HISTORY, '{not json');
    storage.delete(KEYS.READING_THREADS);

    expect(migrateLegacyTranscript()).toEqual([]);
    expect(storage.getString(KEYS.ORACLE_CHAT_HISTORY)).toBeUndefined();
    expect(storage.getString(KEYS.READING_THREADS)).toBe('[]');
  });

  it('ignores legacy entries of the wrong shape', () => {
    storage.set(
      KEYS.ORACLE_CHAT_HISTORY,
      JSON.stringify([null, 42, { role: 'user' }, message({ id: 'u0' }), verdict('o0', 'r1')]),
    );
    storage.delete(KEYS.READING_THREADS);

    const migrated = migrateLegacyTranscript();
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.messages.map(m => m.id)).toEqual(['u0', 'o0']);
  });
});
