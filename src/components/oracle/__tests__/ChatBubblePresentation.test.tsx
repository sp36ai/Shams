/**
 * ChatBubble — conversation presentation: timestamps, long-press copy, and
 * narration progress. Presentation only; nothing here touches a reading.
 */
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/renderScreen';
import ChatBubble from '../ChatBubble';
import type { ReadingMessage } from '@stores/readingThreadsStore';

const CREATED = new Date(2026, 8, 23, 16, 7).toISOString();

function userMessage(overrides: Partial<ReadingMessage> = {}): ReadingMessage {
  return {
    id: 'u1',
    role: 'user',
    text: 'Will the job offer come?',
    kind: 'text',
    createdAt: CREATED,
    status: 'sent',
    ...overrides,
  };
}

function replyMessage(overrides: Partial<ReadingMessage> = {}): ReadingMessage {
  return {
    id: 'o1',
    role: 'oracle',
    text: 'The delay is in the tenth, not in you.',
    createdAt: CREATED,
    status: 'sent',
    variant: 'discussion',
    replyToId: 'u1',
    ...overrides,
  };
}

function renderBubble(
  message: ReadingMessage,
  extra: Partial<React.ComponentProps<typeof ChatBubble>> = {},
) {
  return renderScreen(
    <ChatBubble
      message={message}
      questionLang="en"
      onRetry={jest.fn()}
      onAskAsNewQuestion={jest.fn()}
      ttsStatus="idle"
      ttsActiveMessageId={null}
      onToggleSpeech={jest.fn()}
      onSelectSuggestedQuestion={jest.fn()}
      {...extra}
    />,
  );
}

describe('ChatBubble timestamps', () => {
  it('shows the time on the seeker bubble', async () => {
    await renderBubble(userMessage());
    expect(screen.getByTestId('chat-bubble-time')).toHaveTextContent(/4:07/);
  });

  it('shows the time on a follow-up reply and on a failed turn', async () => {
    await renderBubble(replyMessage());
    expect(screen.getByTestId('chat-bubble-time')).toHaveTextContent(/4:07/);

    await renderBubble(replyMessage({ status: 'failed', errorMessage: 'Network' }));
    expect(screen.getByTestId('chat-bubble-time')).toHaveTextContent(/4:07/);
  });

  it('shows no time rather than "Invalid Date" for a malformed record', async () => {
    await renderBubble(userMessage({ createdAt: 'corrupted' }));
    expect(screen.queryByTestId('chat-bubble-time')).toBeNull();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it('shows no time on a pending turn', async () => {
    await renderBubble(replyMessage({ status: 'sending', text: '' }));
    expect(screen.queryByTestId('chat-bubble-time')).toBeNull();
  });
});

describe('ChatBubble long-press copy', () => {
  it('copies the seeker text on long press', async () => {
    const onCopyText = jest.fn();
    await renderBubble(userMessage(), { onCopyText });
    fireEvent(screen.getByTestId('chat-bubble-user'), 'longPress');
    expect(onCopyText).toHaveBeenCalledWith('Will the job offer come?');
  });

  it('copies a follow-up reply on long press', async () => {
    const onCopyText = jest.fn();
    await renderBubble(replyMessage(), { onCopyText });
    fireEvent(screen.getByTestId('chat-bubble-discussion'), 'longPress');
    expect(onCopyText).toHaveBeenCalledWith('The delay is in the tenth, not in you.');
  });

  it('is inert when no copy handler is given', async () => {
    await renderBubble(userMessage());
    expect(() => fireEvent(screen.getByTestId('chat-bubble-user'), 'longPress')).not.toThrow();
  });
});

describe('ChatBubble narration progress', () => {
  it('shows progress only on the message being narrated', async () => {
    await renderBubble(replyMessage(), {
      ttsStatus: 'speaking',
      ttsActiveMessageId: 'o1',
      ttsProgress: 0.35,
    });
    expect(screen.getByTestId('narration-progress').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 35,
    });
  });

  it('shows no progress on any other message', async () => {
    await renderBubble(replyMessage(), {
      ttsStatus: 'speaking',
      ttsActiveMessageId: 'someone-else',
      ttsProgress: 0.35,
    });
    expect(screen.queryByTestId('narration-progress')).toBeNull();
  });

  it('shows no progress while idle', async () => {
    await renderBubble(replyMessage(), { ttsProgress: null });
    expect(screen.queryByTestId('narration-progress')).toBeNull();
  });
});
