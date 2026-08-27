/**
 * readingThreadsStore — the Reading, and the conversation that belongs to it.
 * --------------------------------------------------------------------------
 * The domain object in Shams is a READING, not a chat. A Reading is a question
 * put to the oracle at a particular moment, the verdict cast for that moment,
 * and every follow-up the seeker asked about it afterwards. This store is that
 * entity, and the parent/child relation is structural rather than inferred:
 *
 *     ReadingThread
 *       ├─ question        the words the chart was cast for
 *       ├─ title           the short handle it is recognised by
 *       ├─ context         the moment it was cast for — IMMUTABLE
 *       └─ messages[]      the reading, then the follow-ups
 *
 * It replaces the flat oracleChatStore transcript, which held every reading
 * and every follow-up of every sitting in one endless list. Under that shape
 * "which reading is this follow-up about?" could only be answered by scanning
 * backwards for the most recent verdict, so a Reading could never be reopened
 * and continued — the seeker got a receipt, not a conversation.
 *
 * IMMUTABILITY OF CONTEXT (the rule this file exists to enforce)
 *   `context` is written once, when the chart lands, and never rewritten.
 *   Opening a Reading three days later restores that moment; it does not
 *   re-derive the current one. A question about a different time is a new
 *   Reading, never a mutation of this one.
 *
 * PERSISTENCE
 *   MMKV, like every other store in this app. Firestore holds the server's own
 *   copy of each reading (written by askWatchOracle) but the client has never
 *   read from it, and this store does not change that — cross-device sync is a
 *   separate piece of work with its own rules and writers.
 */

import { create } from 'zustand';

import type { WatchReading } from '../firebase/watchOracle';
import type { RenderedRemedy } from '../data/remedyRenderer';
import { readingTitleFor } from '../data/readingTitle';
import { storage, KEYS } from '@storage/mmkv';

export type MessageRole = 'user' | 'oracle';
export type MessageStatus = 'sending' | 'sent' | 'failed';
/** How the seeker captured this message — only meaningful on role 'user'. */
export type MessageInputKind = 'text' | 'voice';
/**
 * What an oracle turn is.
 *   'reading'    — the chart cast for this thread's question; the verdict cards.
 *   'discussion' — a follow-up about that reading; prose.
 */
export type OracleMessageVariant = 'reading' | 'discussion';

export interface ReadingMessage {
  id: string;
  role: MessageRole;
  /** The seeker's words, or an oracle follow-up reply. Empty on a reading turn —
   *  the verdict cards are that turn's content, not restated prose. */
  text: string;
  kind?: MessageInputKind;
  createdAt: string;
  status: MessageStatus;
  variant?: OracleMessageVariant;
  /** Present once a 'sent' oracle message of variant 'reading' resolves. */
  reading?: WatchReading;
  /**
   * Islamic-practice guidance for this reading, chosen by the selectRemedies
   * Cloud Function from the client's own candidate ranking. Arrives after the
   * verdict (a second, non-blocking round trip), so a 'sent' reading message
   * legitimately renders without it.
   */
  selectedRemedies?: RenderedRemedy[];
  /** On a 'discussion' message: the oracle judged this follow-up to be its own
   *  horary question and declined to answer it from the standing reading. */
  suggestsNewQuestion?: boolean;
  /** Present on a 'failed' message — shown next to the retry control. */
  errorMessage?: string;
  /** On an oracle message: the user message id this is answering. */
  replyToId?: string;
}

/**
 * The moment a Reading was cast for.
 *
 * Deliberately not the spec's generic {latitude, longitude, timestamp}: the
 * watch frame replaces the house cusps and planetary positions are
 * location-invariant, so a watch reading HAS no location, and the instant is
 * the server's own — never the client's. What identifies the moment is the
 * querent's local wall-clock minute and the bracket it fell in.
 */
export interface ReadingContext {
  /** The querent's local moment, as used to select the bracket. */
  readonly localMoment: string;
  /** Server instant the chart was cast, UTC. */
  readonly computedAt: string;
  readonly window: {
    readonly startMinute: number;
    readonly endMinute: number;
    readonly minute: number;
  };
  readonly lagnaSignName: string;
  readonly lagnaRulerName: string;
  readonly method: 'RKP';
}

export type ThreadStatus = 'pending' | 'complete' | 'error';

export interface ReadingThread {
  /** Local, stable from the moment the seeker submits their question. */
  id: string;
  /**
   * Identifies the seeker's ACT of asking, to the server.
   *
   * Persisted with the thread, not held in memory, because that is the case it
   * exists for: if the app dies between the server casting the chart and the
   * response arriving, the retry after restart must carry the SAME id so the
   * server replays that reading instead of casting and charging for another.
   * Written once with the thread and never regenerated — a new question means
   * a new thread, which brings its own id.
   */
  requestId: string;
  /** The server's reading id, once the chart has landed. Null until then —
   *  and null forever on a thread whose first cast failed. */
  readingId: string | null;
  title: string;
  /** The question the chart was cast for. Never overwritten by a follow-up. */
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  createdAt: string;
  updatedAt: string;
  status: ThreadStatus;
  /** Written once, when the chart lands. See this file's header. */
  context: ReadingContext | null;
  messages: ReadingMessage[];
}

/** A Reading as the list needs it — no messages, so rows stay cheap. */
export interface ReadingThreadSummary {
  id: string;
  readingId: string | null;
  title: string;
  question: string;
  createdAt: string;
  updatedAt: string;
  status: ThreadStatus;
  messageCount: number;
}

/** Threads kept on the device. Older ones fall off the end. */
const THREAD_LIMIT = 100;
/** Messages kept per thread — a reading plus a long conversation about it. */
const MESSAGE_LIMIT = 80;

/* -------------------------------------------------------------------------- */
/*  MMKV cache I/O                                                            */
/* -------------------------------------------------------------------------- */

function isThread(value: unknown): value is ReadingThread {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.question === 'string' &&
    typeof o.createdAt === 'string' &&
    Array.isArray(o.messages)
  );
}

function readCache(): ReadingThread[] {
  const raw = storage.getString(KEYS.READING_THREADS);
  if (raw === undefined) {
    // No threads cache: either a fresh install or a seeker upgrading from the
    // flat transcript. migrateLegacyTranscript() handles both and always
    // leaves the cache written, so this branch is taken exactly once.
    return migrateLegacyTranscript();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isThread) : [];
  } catch {
    // Corrupt cache. Dropping it loses conversations, which is bad, but
    // returning garbage to every screen is worse — and the migration is not
    // re-run, because its source has long since been deleted.
    storage.delete(KEYS.READING_THREADS);
    return [];
  }
}

function writeCache(threads: ReadingThread[]): void {
  const trimmed = threads.slice(0, THREAD_LIMIT).map(thread =>
    thread.messages.length > MESSAGE_LIMIT
      ? // Keep the head: the reading itself is the first pair and must never
        // be evicted, or the thread loses the very thing it is about.
        {
          ...thread,
          messages: [
            ...thread.messages.slice(0, 2),
            ...thread.messages.slice(-(MESSAGE_LIMIT - 2)),
          ],
        }
      : thread,
  );
  storage.set(KEYS.READING_THREADS, JSON.stringify(trimmed));
}

/**
 * One-shot migration of the pre-thread flat transcript. Exported for testing;
 * production code reaches it only through readCache() on a cold start.
 *
 * The old store held every reading and follow-up of every sitting in one list.
 * Splitting it at each reading turn recovers the threads that were always
 * implicitly there, so an existing seeker opens the new Readings list and
 * finds their history rather than an empty state.
 *
 * IDEMPOTENT, and by construction rather than by luck:
 *   - the legacy key is deleted before anything is inferred, so a second run
 *     — a crash mid-migration, a re-entrant call, a later cold start — finds
 *     no source and returns what the threads cache already holds;
 *   - the threads cache is ALWAYS written, even when the transcript yielded
 *     nothing, so "migration has run" is a fact on disk rather than an
 *     inference from an absent key;
 *   - thread ids are derived from the server's reading id, so re-running over
 *     the same input could only ever produce the same threads.
 *
 * Inference limits, stated plainly because they are inference: a verdict claims
 * the most recent unanswered seeker message as the question it answers. That is
 * how the old screen actually wrote the transcript, so it is right for every
 * transcript this app produced. Messages that precede the first verdict have no
 * reading to belong to and are dropped rather than guessed at; a verdict with
 * no seeker message before it becomes a Reading with an empty question, which
 * still opens and still shows its own verdict.
 */
export function migrateLegacyTranscript(): ReadingThread[] {
  const raw = storage.getString(KEYS.ORACLE_CHAT_HISTORY);
  if (raw === undefined) {
    // Nothing to migrate — a fresh install, or a migration that already ran.
    // Either way the threads cache is now authoritative and must exist.
    const existing = storage.getString(KEYS.READING_THREADS);
    if (existing === undefined) {
      writeCache([]);
    }
    return [];
  }
  // Deleted BEFORE any inference: a crash midway must not leave a transcript
  // that a later run would migrate a second time.
  storage.delete(KEYS.ORACLE_CHAT_HISTORY);

  let legacy: ReadingMessage[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      writeCache([]);
      return [];
    }
    legacy = parsed.filter((m): m is ReadingMessage => {
      if (typeof m !== 'object' || m === null) {
        return false;
      }
      const o = m as Record<string, unknown>;
      return (
        typeof o.id === 'string' &&
        (o.role === 'user' || o.role === 'oracle') &&
        typeof o.text === 'string' &&
        typeof o.createdAt === 'string'
      );
    });
  } catch {
    // Corrupt legacy data. The key is already gone, so record that migration
    // has happened and move on with an empty archive.
    writeCache([]);
    return [];
  }

  const threads: ReadingThread[] = [];
  // The most recent seeker message that nothing has answered yet. A verdict
  // claims it as the question the chart was cast for, wherever it currently
  // sits — including before the very first verdict, when no thread exists to
  // hold it and it would otherwise be dropped.
  let unanswered: ReadingMessage | undefined;

  for (const message of legacy) {
    const open = threads[threads.length - 1];
    const isReadingTurn =
      message.role === 'oracle' &&
      message.variant !== 'discussion' &&
      message.reading !== undefined;

    const reading = message.reading;
    // A verdict with no usable reading id cannot be opened again, so it must
    // not start a thread — and must not consume the question either. Checked
    // BEFORE anything is claimed or moved, so a damaged entry costs nothing
    // but itself.
    const opensThread =
      isReadingTurn &&
      reading !== undefined &&
      typeof reading.readingId === 'string' &&
      reading.readingId.length > 0;

    if (opensThread && reading !== undefined) {
      const question = unanswered;
      unanswered = undefined;
      // The question opens the NEW thread rather than closing the previous
      // one, so it moves across if it was already filed there.
      if (open !== undefined && question !== undefined) {
        const at = open.messages.indexOf(question);
        if (at !== -1) {
          open.messages.splice(at, 1);
        }
      }
      const questionText = question?.text ?? '';
      threads.push({
        id: `t_${reading.readingId}`,
        // A migrated Reading has already been cast and can never be re-asked,
        // so this id is inert; it exists only to satisfy the shape.
        requestId: `migrated_${reading.readingId}`,
        readingId: reading.readingId,
        title: readingTitleFor(questionText),
        question: questionText,
        questionLang: 'en',
        createdAt: question?.createdAt ?? message.createdAt,
        updatedAt: message.createdAt,
        status: 'complete',
        context: contextFrom(reading),
        messages: question !== undefined ? [question, message] : [message],
      });
      continue;
    }

    if (message.role === 'user') {
      unanswered = message;
    } else if (!isReadingTurn) {
      // A genuine reply answers the question before it. A damaged verdict —
      // reading turn, unusable id — deliberately does NOT: it costs only
      // itself, and the question stays available to the next real verdict.
      unanswered = undefined;
    }

    // Anything before the first verdict has no reading to belong to; a seeker
    // message there is still held as `unanswered` for the verdict that follows.
    if (open === undefined) {
      continue;
    }
    open.messages.push(message);
    open.updatedAt = message.createdAt;
  }

  const ordered = threads.reverse();
  // Written unconditionally — see the idempotency note above.
  writeCache(ordered);
  return ordered;
}

/**
 * The immutable moment snapshot, read straight off the server's response.
 *
 * Frozen, not merely typed readonly: `readonly` is erased at runtime and this
 * object outlives every screen that touches it. A future follow-up that needs
 * a different temporal frame must carry that on the follow-up, never by
 * reaching into the Reading it belongs to.
 */
export function contextFrom(reading: WatchReading): ReadingContext {
  return Object.freeze({
    localMoment: reading.localMoment,
    computedAt: reading.computedAt,
    lagnaSignName: reading.lagnaSignName,
    lagnaRulerName: reading.lagnaRulerName,
    method: 'RKP',
    window: Object.freeze({ ...reading.window }),
  });
}

/* -------------------------------------------------------------------------- */
/*  Store                                                                     */
/* -------------------------------------------------------------------------- */

export interface ReadingThreadsState {
  /** Newest activity first — the order Your Readings renders. */
  threads: ReadingThread[];

  /**
   * Open a Reading. Called when the seeker SUBMITS a question, never when
   * they merely open the composer: an abandoned composer must not leave an
   * empty Reading in their history.
   */
  createThread: (input: {
    id: string;
    requestId: string;
    question: string;
    questionLang: 'en' | 'ur' | 'hi';
  }) => ReadingThread;

  addMessage: (threadId: string, message: ReadingMessage) => void;
  updateMessage: (threadId: string, messageId: string, patch: Partial<ReadingMessage>) => void;

  /** The chart landed: bind the server's reading id and snapshot the moment. */
  attachReading: (threadId: string, reading: WatchReading) => void;
  setThreadStatus: (threadId: string, status: ThreadStatus) => void;

  deleteThread: (threadId: string) => void;
  clearAll: () => void;
}

function touch(thread: ReadingThread, at: string): ReadingThread {
  return { ...thread, updatedAt: at };
}

export const useReadingThreadsStore = create<ReadingThreadsState>((set, get) => ({
  threads: readCache(),

  createThread: ({ id, requestId, question, questionLang }): ReadingThread => {
    const now = new Date().toISOString();
    const thread: ReadingThread = {
      id,
      requestId,
      readingId: null,
      title: readingTitleFor(question),
      question,
      questionLang,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      context: null,
      messages: [],
    };
    const next = [thread, ...get().threads];
    writeCache(next);
    set({ threads: next });
    return thread;
  },

  addMessage: (threadId, message): void => {
    const next = get().threads.map(thread =>
      thread.id === threadId
        ? touch({ ...thread, messages: [...thread.messages, message] }, message.createdAt)
        : thread,
    );
    writeCache(next);
    set({ threads: next });
  },

  updateMessage: (threadId, messageId, patch): void => {
    const next = get().threads.map(thread =>
      thread.id === threadId
        ? {
            ...thread,
            messages: thread.messages.map(m => (m.id === messageId ? { ...m, ...patch } : m)),
          }
        : thread,
    );
    writeCache(next);
    set({ threads: next });
  },

  attachReading: (threadId, reading): void => {
    const next = get().threads.map(thread => {
      if (thread.id !== threadId) {
        return thread;
      }
      // A Reading is bound to its moment exactly once. Once the chart has
      // landed, NOTHING that happens later in this thread — a follow-up, a
      // retry that raced a replay, a future feature asking about a different
      // date — may move the reading it is about or the moment it was cast
      // for. The guard lives here, at the only writer, rather than in each
      // caller: a rule enforced at one point cannot be forgotten at another.
      if (thread.context !== null) {
        return thread;
      }
      return {
        ...thread,
        readingId: reading.readingId,
        status: 'complete' as ThreadStatus,
        context: contextFrom(reading),
        updatedAt: new Date().toISOString(),
      };
    });
    writeCache(next);
    set({ threads: next });
  },

  setThreadStatus: (threadId, status): void => {
    const next = get().threads.map(thread =>
      thread.id === threadId ? { ...thread, status } : thread,
    );
    writeCache(next);
    set({ threads: next });
  },

  deleteThread: (threadId): void => {
    const next = get().threads.filter(thread => thread.id !== threadId);
    writeCache(next);
    set({ threads: next });
  },

  clearAll: (): void => {
    storage.delete(KEYS.READING_THREADS);
    set({ threads: [] });
  },
}));

/* -------------------------------------------------------------------------- */
/*  Selectors and queries — pure, exported for testing                        */
/* -------------------------------------------------------------------------- */

export const selectHasThreads = (s: ReadingThreadsState): boolean => s.threads.length > 0;

export function threadById(
  threads: readonly ReadingThread[],
  threadId: string | undefined,
): ReadingThread | null {
  if (threadId === undefined) {
    return null;
  }
  return threads.find(thread => thread.id === threadId) ?? null;
}

export function summarize(thread: ReadingThread): ReadingThreadSummary {
  return {
    id: thread.id,
    readingId: thread.readingId,
    title: thread.title,
    question: thread.question,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    status: thread.status,
    messageCount: thread.messages.length,
  };
}

/**
 * Readings matching a search term, over title AND question text — the two
 * things a seeker actually remembers. Case- and diacritic-insensitive as far
 * as the platform's own lowercasing goes; no ranking beyond keeping the
 * store's newest-first order, so results never reshuffle as the user types.
 */
export function searchThreads(threads: readonly ReadingThread[], term: string): ReadingThread[] {
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) {
    return [...threads];
  }
  return threads.filter(
    thread =>
      thread.title.toLowerCase().includes(needle) ||
      thread.question.toLowerCase().includes(needle) ||
      thread.messages.some(m => m.text.toLowerCase().includes(needle)),
  );
}

export type ThreadGroupKey = 'today' | 'yesterday' | 'previous7' | 'previous30' | 'older';

export interface RecencyGroup<T> {
  key: ThreadGroupKey;
  items: T[];
}

/**
 * Group Readings the way the seeker experienced them — today, yesterday, then
 * widening windows. Computed against the DEVICE's local day boundaries, not
 * UTC: a reading cast at 1am is "today" to the person who cast it.
 *
 * Labels are not generated here — the caller translates the key, so grouping
 * stays language-agnostic.
 *
 * Generic over anything carrying an `updatedAt`, so the Readings list can group
 * threads and pre-thread archive entries in one pass rather than rendering two
 * separately-ordered lists.
 */
export function groupByRecency<T extends { updatedAt: string }>(
  items: readonly T[],
  now: Date = new Date(),
): Array<RecencyGroup<T>> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 24 * 60 * 60 * 1000;

  const buckets: Record<ThreadGroupKey, T[]> = {
    today: [],
    yesterday: [],
    previous7: [],
    previous30: [],
    older: [],
  };

  for (const item of items) {
    const at = new Date(item.updatedAt).getTime();
    if (Number.isNaN(at)) {
      buckets.older.push(item);
    } else if (at >= startOfToday) {
      buckets.today.push(item);
    } else if (at >= startOfToday - DAY) {
      buckets.yesterday.push(item);
    } else if (at >= startOfToday - 7 * DAY) {
      buckets.previous7.push(item);
    } else if (at >= startOfToday - 30 * DAY) {
      buckets.previous30.push(item);
    } else {
      buckets.older.push(item);
    }
  }

  return (Object.keys(buckets) as ThreadGroupKey[])
    .map(key => ({ key, items: buckets[key] }))
    .filter(group => group.items.length > 0);
}

/**
 * The conversation that has happened SINCE the reading — what the server needs
 * to answer the next follow-up in context.
 *
 * Neither the reading nor the question it was cast for is included: the server
 * loads both from Firestore and puts them in the model's brief, so a
 * client-side copy would add nothing but a chance to disagree with it. Turns
 * therefore start AFTER the reading. Pending and failed turns are skipped, and
 * everything from `beforeMessageId` onward is excluded because that message
 * travels as the request's own `message`.
 */
export function discussionTurnsFor(
  thread: ReadingThread,
  beforeMessageId?: string,
): Array<{ role: 'seeker' | 'oracle'; text: string }> {
  const cutoff =
    beforeMessageId === undefined
      ? thread.messages.length
      : thread.messages.findIndex(m => m.id === beforeMessageId);
  const upTo = cutoff === -1 ? thread.messages.length : cutoff;

  const readingAt = thread.messages.findIndex(
    m => m.role === 'oracle' && m.variant !== 'discussion' && m.reading !== undefined,
  );
  const from = readingAt === -1 ? 0 : readingAt + 1;

  const turns: Array<{ role: 'seeker' | 'oracle'; text: string }> = [];
  for (const m of thread.messages.slice(from, upTo)) {
    if (m.status !== 'sent' || m.text.trim().length === 0) {
      continue;
    }
    if (m.role === 'user') {
      turns.push({ role: 'seeker', text: m.text });
    } else if (m.variant === 'discussion') {
      turns.push({ role: 'oracle', text: m.text });
    }
  }
  return turns;
}
