import { useOracleChatStore, type ChatMessage } from '../oracleChatStore';
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
