/**
 * oracleChatStore — local Oracle Chat conversation transcript.
 * --------------------------------------------------------------------------
 * Separate from readingsStore: that store is the structured "Reading
 * History" list (one entry per completed reading, browsed by verdict/date).
 * This store is the raw chat transcript — every bubble, including pending
 * and failed turns — so the conversation looks the same on reopen as it did
 * when the seeker left it.
 *
 * One user turn maps to exactly one oracle turn, linked by `replyToId`:
 * sending a question immediately adds both a 'sent' user message and a
 * 'sending' oracle placeholder; the placeholder is then updated in place to
 * 'sent' (with the reading attached) or 'failed' (with an error), never
 * replaced — so retry can find it by id and flip it back to 'sending'.
 */

import { create } from 'zustand';

import type { WatchReading } from '../firebase/watchOracle';
import type { RenderedRemedy } from '../data/remedyRenderer';
import { storage, KEYS } from '@storage/mmkv';

export type ChatRole = 'user' | 'oracle';
export type ChatMessageStatus = 'sending' | 'sent' | 'failed';
/** How the user captured this question — only meaningful on role 'user'. */
export type ChatInputKind = 'text' | 'voice';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** The question text (user) or empty for an oracle message — the reading
   *  card is the oracle message's real content, this is not restated prose. */
  text: string;
  kind?: ChatInputKind;
  createdAt: string;
  status: ChatMessageStatus;
  /** Present once a 'sent' oracle message resolves. */
  reading?: WatchReading;
  /**
   * Islamic-practice guidance for this reading, chosen by the selectRemedies
   * Cloud Function from the client's own candidate ranking.
   *
   * Distinct from the server's `reading.oracle.protocol` steps, which are the
   * RKP diagnosis's own interventions: that answers "what does the chart
   * prescribe", this answers "which practice suits this seeker now". Arrives
   * after the verdict (the selection is a second, non-blocking round trip),
   * so a 'sent' message legitimately renders without it.
   */
  selectedRemedies?: RenderedRemedy[];
  /** Present on a 'failed' oracle message — shown next to the retry control. */
  errorMessage?: string;
  /** On an oracle message: the user message id this is answering. */
  replyToId?: string;
}

const HISTORY_LIMIT = 200;

export interface OracleChatState {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  clearAll: () => void;
}

/* -------------------------------------------------------------------------- */
/*  MMKV cache I/O                                                            */
/* -------------------------------------------------------------------------- */

function readCache(): ChatMessage[] {
  const raw = storage.getString(KEYS.ORACLE_CHAT_HISTORY);
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((m): m is ChatMessage => {
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
    storage.delete(KEYS.ORACLE_CHAT_HISTORY);
    return [];
  }
}

function writeCache(messages: ChatMessage[]): void {
  const trimmed = messages.slice(-HISTORY_LIMIT);
  storage.set(KEYS.ORACLE_CHAT_HISTORY, JSON.stringify(trimmed));
}

/* -------------------------------------------------------------------------- */
/*  Store factory                                                             */
/* -------------------------------------------------------------------------- */

export const useOracleChatStore = create<OracleChatState>((set, get) => ({
  messages: readCache(),

  addMessage: (message: ChatMessage): void => {
    const next = [...get().messages, message];
    writeCache(next);
    set({ messages: next });
  },

  updateMessage: (id: string, patch: Partial<ChatMessage>): void => {
    const next = get().messages.map(m => (m.id === id ? { ...m, ...patch } : m));
    writeCache(next);
    set({ messages: next });
  },

  removeMessage: (id: string): void => {
    const next = get().messages.filter(m => m.id !== id);
    writeCache(next);
    set({ messages: next });
  },

  clearAll: (): void => {
    storage.delete(KEYS.ORACLE_CHAT_HISTORY);
    set({ messages: [] });
  },
}));

export const selectIsEmpty = (s: OracleChatState): boolean => s.messages.length === 0;
