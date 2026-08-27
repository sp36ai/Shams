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
 *
 * An oracle turn is one of two kinds, distinguished by `variant`:
 *   - 'reading'    — a chart was cast for this question; the bubble is the
 *                    verdict cards, and a quota slot was spent.
 *   - 'discussion' — a follow-up about a reading already given; the bubble is
 *                    prose in `text`, and `groundedReadingId` names the
 *                    reading it is grounded in. No chart, no quota.
 * The transcript holds both, in order, because that is the conversation the
 * seeker actually had.
 */

import { create } from 'zustand';

import type { WatchReading } from '../firebase/watchOracle';
import type { RenderedRemedy } from '../data/remedyRenderer';
import { storage, KEYS } from '@storage/mmkv';

export type ChatRole = 'user' | 'oracle';
export type ChatMessageStatus = 'sending' | 'sent' | 'failed';
/** How the user captured this question — only meaningful on role 'user'. */
export type ChatInputKind = 'text' | 'voice';
/** What an oracle turn is — see this file's header. */
export type ChatOracleVariant = 'reading' | 'discussion';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** The question text (user) or empty for an oracle message — the reading
   *  card is the oracle message's real content, this is not restated prose. */
  text: string;
  kind?: ChatInputKind;
  createdAt: string;
  status: ChatMessageStatus;
  /**
   * On an oracle message: whether this turn is a reading or a follow-up.
   * Absent on messages written before discussion existed, which are readings —
   * every reader must treat undefined as 'reading'.
   */
  variant?: ChatOracleVariant;
  /** Present once a 'sent' oracle message of variant 'reading' resolves. */
  reading?: WatchReading;
  /**
   * On a 'discussion' oracle message: the reading this reply is grounded in.
   * Retry needs it, and so does every following follow-up in the same thread.
   */
  groundedReadingId?: string;
  /**
   * On a 'discussion' oracle message: the oracle judged the seeker's message
   * to be its own horary question and declined to answer it from the standing
   * reading. The bubble offers to ask it as a new question, which casts a
   * fresh chart and costs a quota slot.
   */
  suggestsNewQuestion?: boolean;
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

/* -------------------------------------------------------------------------- */
/*  Transcript queries — pure, exported for testing                           */
/* -------------------------------------------------------------------------- */

/**
 * The reading a follow-up would be about: the most recent oracle turn that
 * actually produced one. Null when the seeker has not had a reading yet in
 * this transcript, which is what makes the composer's first send an ask.
 *
 * A failed or still-sending reading does not count — there is nothing to
 * discuss until a verdict exists.
 */
export function latestReadingId(messages: readonly ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m !== undefined && m.role === 'oracle' && m.status === 'sent' && m.reading !== undefined) {
      return m.reading.readingId;
    }
  }
  return null;
}

/**
 * The conversation that has happened SINCE a reading was given — what the
 * server needs to answer the next follow-up in context.
 *
 * The reading itself is deliberately not included: the server loads it from
 * Firestore and puts it in the brief, so repeating it here would only give a
 * client-supplied copy of facts the server already holds. Pending and failed
 * turns are skipped too — a question that never got an answer is not part of
 * the thread the oracle is replying to.
 *
 * `beforeMessageId` is the message being answered right now. It is already in
 * the transcript by the time the call is built (its bubble goes up before the
 * network round trip, and is still there on a retry), and it travels as the
 * request's own `message` — so everything from it onward is excluded here to
 * keep the oracle from being handed the same words twice.
 */
export function discussionTurnsFor(
  messages: readonly ChatMessage[],
  readingId: string,
  beforeMessageId?: string,
): Array<{ role: 'seeker' | 'oracle'; text: string }> {
  const start = messages.findIndex(m => m.role === 'oracle' && m.reading?.readingId === readingId);
  if (start === -1) {
    return [];
  }

  const cutoff =
    beforeMessageId === undefined ? -1 : messages.findIndex(m => m.id === beforeMessageId);
  const end = cutoff === -1 ? messages.length : cutoff;

  const turns: Array<{ role: 'seeker' | 'oracle'; text: string }> = [];
  for (const m of messages.slice(start + 1, end)) {
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
