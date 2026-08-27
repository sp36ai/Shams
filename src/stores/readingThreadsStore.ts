import { create } from 'zustand';
import { storage, KEYS } from '@storage/mmkv';

// Thread store types
export type ThreadMessageRole = 'user' | 'oracle';
export type ThreadMessageStatus = 'sending' | 'sent' | 'failed';

export interface ThreadMessage {
  id: string;
  role: ThreadMessageRole;
  text?: string;
  createdAt: string;
  status?: ThreadMessageStatus;
  replyToId?: string;
  // reading may be attached once server returns it
  reading?: unknown;
  selectedRemedies?: unknown[];
}

export interface Thread {
  id: string;
  question: string;
  createdAt: string;
  lastActivityAt: string;
  messages: ThreadMessage[];
  readingId?: string; // stable server reading id when available
}

export interface ReadingThreadsState {
  threads: Thread[];
  addThread: (t: Thread) => void;
  getThreadById: (id: string) => Thread | undefined;
  addMessageToThread: (threadId: string, msg: ThreadMessage) => void;
  updateMessageInThread: (threadId: string, messageId: string, patch: Partial<ThreadMessage>) => void;
  attachReadingToThread: (threadId: string, readingId: string, reading: unknown) => void;
  clearAll: () => void;
}

const THREADS_CACHE_KEY = KEYS.READINGS_CACHE.replace('readings.cache.v1', 'threads.cache.v1');

function readThreadsCache(): Thread[] {
  const raw = storage.getString(THREADS_CACHE_KEY);
  if (raw === undefined) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    storage.delete(THREADS_CACHE_KEY);
    return [];
  }
}

function writeThreadsCache(threads: Thread[]): void {
  storage.set(THREADS_CACHE_KEY, JSON.stringify(threads));
}

export const useReadingThreadsStore = create<ReadingThreadsState>((set, get) => ({
  threads: readThreadsCache(),

  addThread: (t: Thread) => {
    const next = [t, ...get().threads].slice(0, 100);
    writeThreadsCache(next);
    set({ threads: next });
  },

  getThreadById: (id: string) => {
    return get().threads.find(x => x.id === id);
  },

  addMessageToThread: (threadId: string, msg: ThreadMessage) => {
    const threads = get().threads.map(t =>
      t.id === threadId ? { ...t, messages: [...t.messages, msg], lastActivityAt: msg.createdAt } : t,
    );
    writeThreadsCache(threads);
    set({ threads });
  },

  updateMessageInThread: (threadId: string, messageId: string, patch: Partial<ThreadMessage>) => {
    const threads = get().threads.map(t => {
      if (t.id !== threadId) return t;
      const messages = t.messages.map(m => (m.id === messageId ? { ...m, ...patch } : m));
      return { ...t, messages };
    });
    writeThreadsCache(threads);
    set({ threads });
  },

  attachReadingToThread: (threadId: string, readingId: string, reading: unknown) => {
    const threads = get().threads.map(t => {
      if (t.id !== threadId) return t;
      // Attach reading to the last oracle message if present
      const messages = t.messages.map(m =>
        m.role === 'oracle' && m.status === 'sending' ? { ...m, status: 'sent', reading } : m,
      );
      return { ...t, messages, readingId };
    });
    writeThreadsCache(threads);
    set({ threads });
  },

  clearAll: () => {
    storage.delete(THREADS_CACHE_KEY);
    set({ threads: [] });
  },
}));
