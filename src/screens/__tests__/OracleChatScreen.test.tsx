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

  it('runs the guidance pipeline after a successful reading and attaches the remedies', async () => {
    const selectCallable = jest.fn(() =>
      Promise.resolve({
        data: {
          selectedIds: ['dhikr_01', 'quran_01'],
          selectionReason: 'suits a delayed matter',
          descriptions: { dhikr_01: 'Steady the heart with remembrance.' },
        },
      }),
    );
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() => Promise.resolve({ data: successPayload() }));
      }
      if (name === 'selectRemedies') {
        return selectCallable;
      }
      return defaultImpl(name);
    });

    await renderScreen(<OracleChatScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() => {
      const oracleMsg = useOracleChatStore.getState().messages.find(m => m.role === 'oracle');
      expect(oracleMsg?.selectedRemedies?.length).toBeGreaterThan(0);
    });

    // The selection is driven by the watch verdict, not a coarse verdict string.
    expect(selectCallable).toHaveBeenCalled();
    const oracleMsg = useOracleChatStore.getState().messages.find(m => m.role === 'oracle');
    expect(oracleMsg?.selectedRemedies?.map(r => r.id)).toEqual(['dhikr_01', 'quran_01']);
    // Generated descriptions from the selector win over the library default.
    expect(oracleMsg?.selectedRemedies?.[0]?.description).toBe(
      'Steady the heart with remembrance.',
    );
  });

  it('still shows the verdict when the guidance selection fails', async () => {
    // The verdict is the answer; guidance is enrichment. A selector failure
    // must never downgrade a reading that already succeeded.
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() => Promise.resolve({ data: successPayload() }));
      }
      if (name === 'selectRemedies') {
        return jest.fn(() => Promise.reject(new Error('selector down')));
      }
      return defaultImpl(name);
    });

    await renderScreen(<OracleChatScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() => {
      const oracleMsg = useOracleChatStore.getState().messages.find(m => m.role === 'oracle');
      expect(oracleMsg?.status).toBe('sent');
    });
    expect(
      useOracleChatStore.getState().messages.find(m => m.role === 'oracle')?.reading?.readingId,
    ).toBe('r1');
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
  /* ---------------------------------------------------------------------- */
  /*  Follow-up discussion                                                   */
  /* ---------------------------------------------------------------------- */

  describe('discussion of a standing reading', () => {
    /** Ask once, so a reading is standing and the composer offers DISCUSS. */
    async function askOnce(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() =>
        expect(useOracleChatStore.getState().messages.find(m => m.role === 'oracle')?.status).toBe(
          'sent',
        ),
      );
    }

    it('sends a follow-up through discussReading — no chart, no quota spent', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      const discussCallable = jest.fn(() =>
        Promise.resolve({
          data: { answer: 'It is delay, not denial.', isNewQuestion: false, turnsRemaining: 11 },
        }),
      );
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return askCallable;
        }
        if (name === 'discussReading') {
          return discussCallable;
        }
        return defaultImpl(name);
      });

      await renderScreen(<OracleChatScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      const spentAfterAsk = useQuotaStore.getState().questionsToday;

      // The mode row appears only once a reading stands, and defaults to
      // DISCUSS — so this second send needs no mode change to be a follow-up.
      expect(screen.getByTestId('oracle-chat-mode-discuss')).toBeTruthy();

      await user.type(screen.getByTestId('oracle-chat-input'), 'Why is it taking so long?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));

      await waitFor(() => expect(screen.getByText('It is delay, not denial.')).toBeTruthy());

      expect(askCallable).toHaveBeenCalledTimes(1); // still just the first ask
      expect(discussCallable).toHaveBeenCalledTimes(1);
      expect(discussCallable.mock.calls[0]?.[0]).toMatchObject({
        readingId: 'r1',
        message: 'Why is it taking so long?',
      });
      // A follow-up is not a reading: nothing more was charged.
      expect(useQuotaStore.getState().questionsToday).toBe(spentAfterAsk);
    });

    it('sends the turns since the reading, so the reply follows the conversation', async () => {
      const discussCallable = jest.fn(() =>
        Promise.resolve({
          data: { answer: 'Wait for the window.', isNewQuestion: false, turnsRemaining: 10 },
        }),
      );
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return jest.fn(() => Promise.resolve({ data: successPayload() }));
        }
        if (name === 'discussReading') {
          return discussCallable;
        }
        return defaultImpl(name);
      });

      await renderScreen(<OracleChatScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'Why so long?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('Wait for the window.')).toBeTruthy());

      await user.type(screen.getByTestId('oracle-chat-input'), 'And meanwhile?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(discussCallable).toHaveBeenCalledTimes(2));

      // The reading itself is never re-sent — the server loads it.
      expect(discussCallable.mock.calls[1]?.[0]).toMatchObject({
        turns: [
          { role: 'seeker', text: 'Why so long?' },
          { role: 'oracle', text: 'Wait for the window.' },
        ],
      });
    });

    it('switching to NEW QUESTION casts a fresh chart instead of discussing', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      const discussCallable = jest.fn(() =>
        Promise.resolve({ data: { answer: 'x', isNewQuestion: false, turnsRemaining: 9 } }),
      );
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return askCallable;
        }
        if (name === 'discussReading') {
          return discussCallable;
        }
        return defaultImpl(name);
      });

      await renderScreen(<OracleChatScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.press(screen.getByTestId('oracle-chat-mode-ask'));
      await user.type(screen.getByTestId('oracle-chat-input'), 'Will my brother travel?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));

      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(2));
      expect(discussCallable).not.toHaveBeenCalled();
    });

    it('offers to re-ask a follow-up the oracle judged to be its own question', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return askCallable;
        }
        if (name === 'discussReading') {
          return jest.fn(() =>
            Promise.resolve({
              data: {
                answer: 'That is its own question, and needs its own moment.',
                isNewQuestion: true,
                turnsRemaining: 11,
              },
            }),
          );
        }
        return defaultImpl(name);
      });

      await renderScreen(<OracleChatScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'Will my brother travel?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));

      await waitFor(() => expect(screen.getByTestId('oracle-chat-ask-as-new')).toBeTruthy());

      // Nothing is cast until the seeker taps — a new chart costs a slot.
      expect(askCallable).toHaveBeenCalledTimes(1);

      await user.press(screen.getByTestId('oracle-chat-ask-as-new'));

      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(2));
      const readings = useOracleChatStore
        .getState()
        .messages.filter(m => m.role === 'oracle' && m.variant !== 'discussion');
      expect(readings).toHaveLength(2);
    });

    it('retries a failed follow-up as a follow-up, never as a new reading', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      let discussFails = true;
      const discussCallable = jest.fn(() =>
        discussFails
          ? Promise.reject(Object.assign(new Error('down'), { code: 'unavailable' }))
          : Promise.resolve({
              data: { answer: 'Delay, not denial.', isNewQuestion: false, turnsRemaining: 11 },
            }),
      );
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return askCallable;
        }
        if (name === 'discussReading') {
          return discussCallable;
        }
        return defaultImpl(name);
      });

      await renderScreen(<OracleChatScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'Why so long?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('↻ Retry')).toBeTruthy());

      discussFails = false;
      await user.press(screen.getByText('↻ Retry'));

      await waitFor(() => expect(screen.getByText('Delay, not denial.')).toBeTruthy());
      expect(askCallable).toHaveBeenCalledTimes(1);
      expect(discussCallable).toHaveBeenCalledTimes(2);
    });
  });
});
