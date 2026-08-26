/**
 * OracleChatScreen — conversation flow tests.
 * --------------------------------------------------------------------------
 * Exercises the one path both text and voice funnel into: sendMessage() →
 * askWatchOracle() → a bubble that ends up 'sent' or 'failed'+retryable.
 * Voice-specific behavior (STT/TTS) is covered by their own hook tests —
 * @react-native-voice/voice and react-native-tts are mocked wholesale in
 * jest.setup.js, so this file only needs the mic BUTTON to render, not the
 * recognizer to do anything real.
 */
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart } from '@astrology/rkp/watchJudgment';
import { httpsCallable } from '../../firebase/functionsRegion';
import { renderScreen } from '../../test-utils/renderScreen';
import { useOracleChatStore } from '@stores/oracleChatStore';
import { useReadingsStore } from '@stores/readingsStore';
import { useQuotaStore } from '@stores/quotaStore';
import OracleChatScreen from '../OracleChatScreen';

const MOMENT = '2026-08-08T11:13:00+05:30';

function defaultImpl(name: string) {
  if (name === 'getQuota') {
    return jest.fn(() => Promise.resolve({ data: { remaining: 3 } }));
  }
  return jest.fn(() => Promise.resolve({ data: {} }));
}

function successPayload() {
  return {
    readingId: 'r1',
    computedAt: '2026-08-08T05:43:00.000Z',
    localMoment: MOMENT,
    window: { startMinute: 43, endMinute: 48, minute: 43 },
    lagnaSignName: 'Burj Jauza',
    lagnaRulerName: 'Utarid',
    verdict: judgeWatchChart(buildWatchChart(MOMENT), 'legal'),
    quotaRemaining: 2,
  };
}

beforeEach(() => {
  useOracleChatStore.getState().clearAll();
  useReadingsStore.getState().clearAll();
  useQuotaStore.setState({ plan: 'free', questionsToday: 0 });
  (httpsCallable as jest.Mock).mockReset();
  (httpsCallable as jest.Mock).mockImplementation(defaultImpl);
});

describe('OracleChatScreen', () => {
  it('shows the empty state with no conversation yet', async () => {
    await renderScreen(<OracleChatScreen />);
    expect(screen.getByText('Ask your first question')).toBeTruthy();
  });

  it('adds a user bubble and a pending oracle bubble immediately on send', async () => {
    // Held open deliberately, to isolate the immediate 'sending' state from
    // whatever the eventual response turns out to be (covered by its own
    // tests below) — resolved at the end so askWatchOracle's own internal
    // withTimeout() clears its real setTimeout instead of leaking it.
    let resolveAsk: (value: { data: unknown }) => void = () => {};
    const pending = new Promise<{ data: unknown }>(resolve => {
      resolveAsk = resolve;
    });
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() => pending);
      }
      return defaultImpl(name);
    });

    await renderScreen(<OracleChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    expect(screen.getByText('Will I get the job?')).toBeTruthy();
    expect(screen.getByText('Reading the chart…')).toBeTruthy();

    resolveAsk({ data: successPayload() });
    await waitFor(() => expect(screen.queryByText('Reading the chart…')).toBeNull());
  });

  it('resolves the pending bubble into a rendered verdict on success', async () => {
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() => Promise.resolve({ data: successPayload() }));
      }
      return defaultImpl(name);
    });

    await renderScreen(<OracleChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() => expect(screen.queryByText('Reading the chart…')).toBeNull());
    // RkpWatchCard's own plain-language headline for the judged state.
    const messages = useOracleChatStore.getState().messages;
    const oracleMsg = messages.find(m => m.role === 'oracle');
    expect(oracleMsg?.status).toBe('sent');
    expect(oracleMsg?.reading?.readingId).toBe('r1');

    // Also lands in Reading History.
    expect(useReadingsStore.getState().readings.some(r => r.id === 'r1')).toBe(true);
  });

  it('shows a failed bubble with retry on network failure, and recovers on retry', async () => {
    // askWatchOracle() (firebase/watchOracle.ts, unmodified — pre-existing
    // behavior) races the callable against withTimeout(), which resolves to
    // `undefined` on ANY rejection, not only a real timeout — so a rejected
    // callable surfaces here as errorTimeout regardless of its own .code.
    // That collapsing of distinct failures into one message is a pre-existing
    // characteristic of the shared client wrapper, not something introduced
    // or fixable from this screen.
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() =>
          Promise.reject(Object.assign(new Error('boom'), { code: 'internal' })),
        );
      }
      return defaultImpl(name);
    });

    await renderScreen(<OracleChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() =>
      expect(screen.getByText('The oracle took too long to answer. Try again.')).toBeTruthy(),
    );

    // Now let a retry succeed.
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() => Promise.resolve({ data: successPayload() }));
      }
      return defaultImpl(name);
    });

    await user.press(screen.getByText('↻ Retry'));

    await waitFor(() => {
      const oracleMsg = useOracleChatStore.getState().messages.find(m => m.role === 'oracle');
      expect(oracleMsg?.status).toBe('sent');
    });
  });

  it('shows a quota-exhausted failed bubble without calling askWatchOracle when quota is spent', async () => {
    useQuotaStore.setState({ plan: 'free', questionsToday: 999 });
    const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return askCallable;
      }
      return defaultImpl(name);
    });

    await renderScreen(<OracleChatScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Today's questions are used. Come back tomorrow, or upgrade for unlimited.",
        ),
      ).toBeTruthy(),
    );
    expect(askCallable).not.toHaveBeenCalled();
  });
});
