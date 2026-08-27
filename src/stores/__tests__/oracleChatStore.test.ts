import {
  useOracleChatStore,
  latestReadingId,
  discussionTurnsFor,
  type ChatMessage,
} from '../oracleChatStore';
import { storage, KEYS } from '@storage/mmkv';

function msg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    role: 'user',
    text: 'Will I get the job?',
    createdAt: '2026-08-08T05:43:00.000Z',
    status: 'sent',
    ...overrides,
  };
}

beforeEach(() => {
  useOracleChatStore.getState().clearAll();
});

describe('oracleChatStore', () => {
  it('starts empty', () => {
    expect(useOracleChatStore.getState().messages).toEqual([]);
  });

  it('appends messages in order', () => {
    useOracleChatStore.getState().addMessage(msg({ id: 'a' }));
    useOracleChatStore.getState().addMessage(msg({ id: 'b' }));
    expect(useOracleChatStore.getState().messages.map(m => m.id)).toEqual(['a', 'b']);
  });

  it('updates a message in place without disturbing others', () => {
    useOracleChatStore.getState().addMessage(msg({ id: 'a', status: 'sending' }));
    useOracleChatStore.getState().addMessage(msg({ id: 'b' }));
    useOracleChatStore.getState().updateMessage('a', { status: 'sent' });

    const messages = useOracleChatStore.getState().messages;
    expect(messages.find(m => m.id === 'a')?.status).toBe('sent');
    expect(messages.find(m => m.id === 'b')?.status).toBe('sent');
    expect(messages).toHaveLength(2);
  });

  it('removes a message by id', () => {
    useOracleChatStore.getState().addMessage(msg({ id: 'a' }));
    useOracleChatStore.getState().addMessage(msg({ id: 'b' }));
    useOracleChatStore.getState().removeMessage('a');
    expect(useOracleChatStore.getState().messages.map(m => m.id)).toEqual(['b']);
  });

  it('clearAll empties the transcript', () => {
    useOracleChatStore.getState().addMessage(msg());
    useOracleChatStore.getState().clearAll();
    expect(useOracleChatStore.getState().messages).toEqual([]);
  });

  it('writes every mutation to the ORACLE_CHAT_HISTORY MMKV key', () => {
    useOracleChatStore.getState().addMessage(msg({ id: 'persisted' }));
    const raw = storage.getString(KEYS.ORACLE_CHAT_HISTORY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!) as ChatMessage[];
    expect(parsed.some(m => m.id === 'persisted')).toBe(true);
  });

  it('clearAll deletes the MMKV key entirely, not just the in-memory list', () => {
    useOracleChatStore.getState().addMessage(msg());
    useOracleChatStore.getState().clearAll();
    expect(storage.getString(KEYS.ORACLE_CHAT_HISTORY)).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  Transcript queries — what a follow-up is grounded in                      */
/* -------------------------------------------------------------------------- */

function readingMsg(id: string, readingId: string): ChatMessage {
  return {
    id,
    role: 'oracle',
    text: '',
    createdAt: '2026-08-08T05:43:00.000Z',
    status: 'sent',
    variant: 'reading',
    // Only the id is read by these helpers; the rest of WatchReading is
    // irrelevant here and deliberately not faked.
    reading: { readingId } as ChatMessage['reading'],
  };
}

function discussionMsg(
  id: string,
  text: string,
  status: ChatMessage['status'] = 'sent',
): ChatMessage {
  return {
    id,
    role: 'oracle',
    text,
    createdAt: '2026-08-08T05:44:00.000Z',
    status,
    variant: 'discussion',
  };
}

describe('latestReadingId', () => {
  it('is null before any reading — the first send can only be an ask', () => {
    expect(latestReadingId([msg({ id: 'u1' })])).toBeNull();
  });

  it('returns the most recent reading, not the first', () => {
    expect(
      latestReadingId([readingMsg('o1', 'r1'), msg({ id: 'u2' }), readingMsg('o2', 'r2')]),
    ).toBe('r2');
  });

  it('ignores a reading that never landed — there is nothing to discuss yet', () => {
    const pending: ChatMessage = { ...readingMsg('o2', 'r2'), status: 'sending' };
    expect(latestReadingId([readingMsg('o1', 'r1'), pending])).toBe('r1');
  });
});

describe('discussionTurnsFor', () => {
  it('returns only what happened after the reading, and never the reading itself', () => {
    const turns = discussionTurnsFor(
      [
        msg({ id: 'u0', text: 'Will the sale complete?' }),
        readingMsg('o0', 'r1'),
        msg({ id: 'u1', text: 'Why so long?' }),
        discussionMsg('o1', 'Because the agent is slow.'),
      ],
      'r1',
    );
    expect(turns).toEqual([
      { role: 'seeker', text: 'Why so long?' },
      { role: 'oracle', text: 'Because the agent is slow.' },
    ]);
  });

  it('skips turns that never resolved', () => {
    const turns = discussionTurnsFor(
      [
        readingMsg('o0', 'r1'),
        msg({ id: 'u1', text: 'Why so long?' }),
        discussionMsg('o1', '', 'sending'),
      ],
      'r1',
    );
    expect(turns).toEqual([{ role: 'seeker', text: 'Why so long?' }]);
  });

  it('excludes the message being answered, which travels separately', () => {
    const turns = discussionTurnsFor(
      [
        readingMsg('o0', 'r1'),
        msg({ id: 'u1', text: 'Why so long?' }),
        discussionMsg('o1', 'Because the agent is slow.'),
        msg({ id: 'u2', text: 'And meanwhile?' }),
      ],
      'r1',
      'u2',
    );
    expect(turns.map(turn => turn.text)).toEqual(['Why so long?', 'Because the agent is slow.']);
  });

  it('is empty for a reading that is not in this transcript', () => {
    expect(discussionTurnsFor([readingMsg('o0', 'r1')], 'r9')).toEqual([]);
  });
});
