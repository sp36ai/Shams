/**
 * ReadingScreen — the Reading lifecycle.
 * --------------------------------------------------------------------------
 * Exercises the rules that make a Reading a Reading rather than a chat:
 *
 *   - the first submit CREATES the Reading (nothing is created before it) and
 *     casts the chart;
 *   - every send after that is a follow-up on the SAME Reading, spending no
 *     quota;
 *   - reopening a Reading restores its stored moment and never recasts;
 *   - a follow-up the oracle judges to be its own question opens a NEW
 *     Reading rather than mutating this one's context;
 *   - a failed cast is retryable and never opens a second Reading.
 *
 * Voice-specific behavior (STT/TTS) is covered by their own hook tests —
 * @react-native-voice/voice and react-native-tts are mocked wholesale in
 * jest.setup.js, so this file only needs the mic BUTTON to render, not the
 * recognizer to do anything real.
 */
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart } from '@astrology/rkp/watchJudgment';
import { httpsCallable } from '../../firebase/functionsRegion';
import { renderScreen } from '../../test-utils/renderScreen';
import { useReadingThreadsStore, threadById } from '@stores/readingThreadsStore';
import { useReadingsStore } from '@stores/readingsStore';
import { useQuotaStore } from '@stores/quotaStore';
import ReadingScreen, { errorMessageFor } from '../ReadingScreen';

jest.mock('@utils/permissions', () => ({
  checkMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
  requestMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
}));

// Real useQuota (needed for canAsk/consumeOne gating throughout this file),
// with invalidateQuotaCache wrapped so its calls are observable without
// changing its behavior.
jest.mock('@hooks/useQuota', () => {
  const actual = jest.requireActual('@hooks/useQuota');
  return { ...actual, invalidateQuotaCache: jest.fn(actual.invalidateQuotaCache) };
});

const mockedVoice = Voice as unknown as {
  start: jest.Mock;
  stop: jest.Mock;
  onSpeechResults?: (e: { value?: string[] }) => void;
};

/**
 * Route params drive the whole open-vs-begin distinction, so each test states
 * them explicitly. @react-navigation/native is already mocked wholesale in
 * jest.setup.js (see the note there on why no real navigator is stood up);
 * these two just steer that mock per test.
 */
const mockPush = jest.fn();

function setRoute(params?: {
  threadId?: string;
  initialQuestion?: string;
  initialQuestionKind?: 'text' | 'voice';
}): void {
  (useRoute as jest.Mock).mockReturnValue({ key: 'test', name: 'Reading', params });
}

/** The single thread in the store, whatever its generated id. */
function onlyThread() {
  const threads = useReadingThreadsStore.getState().threads;
  return threads[0];
}

function oracleMessages() {
  return onlyThread()?.messages.filter(m => m.role === 'oracle') ?? [];
}

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
  setRoute(undefined);
  mockPush.mockReset();
  (useNavigation as jest.Mock).mockReturnValue({
    push: mockPush,
    navigate: jest.fn(),
    goBack: jest.fn(),
  });
  useReadingThreadsStore.getState().clearAll();
  useReadingsStore.getState().clearAll();
  useQuotaStore.setState({ plan: 'free', questionsToday: 0 });
  (httpsCallable as jest.Mock).mockReset();
  (httpsCallable as jest.Mock).mockImplementation(defaultImpl);
});

describe('ReadingScreen', () => {
  it('shows the empty state with no conversation yet', async () => {
    await renderScreen(<ReadingScreen />);
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

    await renderScreen(<ReadingScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    // The question opens the thread as the seeker's own bubble — stated once,
    // not repeated in the header above it.
    expect(screen.getAllByText('Will I get the job?')).toHaveLength(1);
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

    await renderScreen(<ReadingScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() => expect(screen.queryByText('Reading the chart…')).toBeNull());
    // RkpWatchCard's own plain-language headline for the judged state.
    const oracleMsg = oracleMessages()[0];
    expect(oracleMsg?.status).toBe('sent');
    expect(oracleMsg?.reading?.readingId).toBe('r1');

    // Also lands in Reading History.
    expect(useReadingsStore.getState().readings.some(r => r.id === 'r1')).toBe(true);
  });

  it('invalidates the cached quota display on a successful ask — the server-confirmed quotaRemaining must not be shadowed by a stale ≤60s cache', async () => {
    // The response's own quotaRemaining is the one number that can never
    // drift from the Firestore ledger claimQuotaSlot() just wrote to,
    // unlike the local optimistic consumeOne() counter (device-only, never
    // reconciled against a second device). Without invalidating here,
    // useQuota's next consult could serve a pre-ask cached figure for up
    // to QUOTA_TTL_MS.
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() => Promise.resolve({ data: successPayload() }));
      }
      return defaultImpl(name);
    });
    const { invalidateQuotaCache } = jest.requireMock('@hooks/useQuota') as {
      invalidateQuotaCache: jest.Mock;
    };
    invalidateQuotaCache.mockClear();

    await renderScreen(<ReadingScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() => expect(oracleMessages()[0]?.status).toBe('sent'));
    expect(invalidateQuotaCache).toHaveBeenCalled();
  });

  it('shows a failed bubble with retry on network failure, and recovers on retry', async () => {
    // The callable's own `.code` reaches the seeker: askWatchOracle now races
    // against withDeadline(), which rejects with the original error, so an
    // 'internal' failure reads as a generic failure rather than as a timeout.
    // (It previously used withTimeout(), which resolves `undefined` on ANY
    // rejection and so reported every failure — out of quota, signed out,
    // server error — as "took too long".)
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return jest.fn(() =>
          Promise.reject(Object.assign(new Error('boom'), { code: 'internal' })),
        );
      }
      return defaultImpl(name);
    });

    await renderScreen(<ReadingScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
    await user.press(screen.getByTestId('oracle-chat-send-btn'));

    await waitFor(() =>
      expect(
        screen.getByText('The scrolls of this moment have not opened their seal. Try again.'),
      ).toBeTruthy(),
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
      const oracleMsg = oracleMessages()[0];
      expect(oracleMsg?.status).toBe('sent');
    });
  });

  // PHASE 2B: the guidance-pipeline tests that used to live here
  // ("runs the guidance pipeline after a successful reading and attaches
  // the remedies", "still shows the verdict when the guidance selection
  // fails") tested runGuidanceSelection's call to the `selectRemedies`
  // Cloud Function — the second, LLM-driven remedy path. That call site
  // was removed from ReadingScreen.tsx this phase (see
  // docs/audit/PHASE_2B_ENGINE_MIGRATION.md); there is no longer a
  // guidance pipeline for this screen to run. Removed rather than left
  // failing.

  it('shows a quota-exhausted failed bubble without calling askWatchOracle when quota is spent', async () => {
    useQuotaStore.setState({ plan: 'free', questionsToday: 999 });
    const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return askCallable;
      }
      return defaultImpl(name);
    });

    await renderScreen(<ReadingScreen />);
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
  /*  Voice input parity                                                     */
  /* ---------------------------------------------------------------------- */

  // A transcript arriving via the mic must not be a second entrance into the
  // Oracle: it is handed to the exact same sendMessage() a typed question
  // goes through, which is what keeps askWatchOracle the sole judgment
  // authority regardless of how the question arrived (see
  // useSpeechToText.ts's own header). This test drives the recognizer mock
  // end to end — start, a final transcript, stop — rather than asserting on
  // sendMessage internals, so it would fail if voice ever grew a call path
  // that bypassed askWatchOracle.
  it('a voice transcript reaches askWatchOracle with the same shape as typed text', async () => {
    const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return askCallable;
      }
      return defaultImpl(name);
    });

    await renderScreen(<ReadingScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('oracle-chat-mic-btn'));
    await waitFor(() => expect(mockedVoice.start).toHaveBeenCalled());

    // The real recognizer's onSpeechResults fires asynchronously AFTER
    // stop() is called, never before (useSpeechToText.ts's own contract) —
    // mirrored here rather than firing it first, which would race stop()'s
    // finalize promise instead of resolving it.
    await user.press(screen.getByTestId('oracle-chat-mic-btn'));
    mockedVoice.onSpeechResults?.({ value: ['Will I get the job?'] });

    await waitFor(() => expect(askCallable).toHaveBeenCalled());
    const voiceCallArgs = askCallable.mock.calls[0][0];

    // Same call, same shape a typed send produces — kind is stored on the
    // message for display, never threaded into the askWatchOracle payload.
    expect(voiceCallArgs).toMatchObject({ question: 'Will I get the job?' });
    expect(voiceCallArgs).not.toHaveProperty('kind');
    expect(voiceCallArgs).not.toHaveProperty('inputMethod');

    // Reaches the exact same message pipeline: a user bubble tagged 'voice',
    // resolved by the same 'sent' verdict a typed ask produces.
    const thread = onlyThread();
    const userMsg = thread.messages.find(m => m.role === 'user');
    expect(userMsg?.kind).toBe('voice');
    await waitFor(() => expect(oracleMessages()[0]?.status).toBe('sent'));
    expect(oracleMessages()[0]?.reading?.readingId).toBe('r1');
  });

  // Android ends listening by itself as soon as the speaker pauses — the
  // usual way a voice question ends. Its transcript is sent like any other
  // voice question, through the same askWatchOracle path, without a tap.
  it('sends the transcript when the recognizer stops listening on its own', async () => {
    const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'askWatchOracle') {
        return askCallable;
      }
      return defaultImpl(name);
    });

    await renderScreen(<ReadingScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('oracle-chat-mic-btn'));
    await waitFor(() => expect(mockedVoice.start).toHaveBeenCalled());

    // No second tap: the recognizer ends and delivers its result by itself.
    mockedVoice.onSpeechEnd?.();
    mockedVoice.onSpeechResults?.({ value: ['Will I get the job?'] });

    await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(1));
    expect(askCallable.mock.calls[0][0]).toMatchObject({ question: 'Will I get the job?' });
    expect(onlyThread().messages.find(m => m.role === 'user')?.kind).toBe('voice');
  });

  /* ---------------------------------------------------------------------- */
  /*  Follow-up discussion                                                   */
  /* ---------------------------------------------------------------------- */

  describe('discussion of a standing reading', () => {
    /** Ask once, so a Reading stands and every later send is a follow-up. */
    async function askOnce(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(oracleMessages()[0]?.status).toBe('sent'));
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

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      const spentAfterAsk = useQuotaStore.getState().questionsToday;

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

      await renderScreen(<ReadingScreen />);
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

    it('casts a follow-up judged to be its own question as a NEW Reading, on the same screen', async () => {
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

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'Will my brother travel?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));

      await waitFor(() => expect(screen.getByTestId('oracle-chat-ask-as-new')).toBeTruthy());

      // Nothing is cast until the seeker taps — a new chart costs a slot.
      expect(askCallable).toHaveBeenCalledTimes(1);

      await user.press(screen.getByTestId('oracle-chat-ask-as-new'));

      // A new matter gets its OWN Reading, cast for its own moment — this
      // Reading's context is never reused for it, nor is this Reading recast.
      // It continues the conversation on this same screen (owner decision
      // 2026-10-11), linked to this Reading, whose id travels forward as
      // lineage for comparison in discussion.
      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(2));
      expect(askCallable.mock.calls[1]?.[0]).toMatchObject({
        question: 'Will my brother travel?',
      });
      expect(mockPush).not.toHaveBeenCalled();
      const [newer, first] = useReadingThreadsStore.getState().threads;
      expect(newer?.question).toBe('Will my brother travel?');
      expect(newer?.previousThreadId).toBe(first?.id);
      expect(newer?.relatedReadingIds).toEqual(['r1']);
      expect(newer?.requestId).not.toBe(first?.requestId);
      // Both Readings are on screen, the earlier one above.
      expect(screen.getByText('Will I get the job?')).toBeTruthy();
      expect(screen.getAllByText('Will my brother travel?').length).toBeGreaterThan(0);
    });

    it('turns the composer to a new question once the oracle closes the conversation', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      const discussCallable = jest.fn(() =>
        Promise.resolve({
          data: {
            answer: 'You hold what this reading can give.',
            isNewQuestion: false,
            turnsRemaining: 30,
            conversationComplete: true,
          },
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

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'Thank you, that helps.');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() =>
        expect(screen.getByText('You hold what this reading can give.')).toBeTruthy(),
      );
      expect(
        screen.getByText('✦ This Reading has said what it can — ask your next question'),
      ).toBeTruthy();

      // The next send is a new question: its own Reading, cast below this
      // one on the same screen, with this one as lineage.
      await user.type(screen.getByTestId('oracle-chat-input'), 'Will my visa come through?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));

      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(2));
      expect(askCallable.mock.calls[1]?.[0]).toMatchObject({
        question: 'Will my visa come through?',
      });
      expect(discussCallable).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
      const [newer, first] = useReadingThreadsStore.getState().threads;
      expect(newer?.previousThreadId).toBe(first?.id);
      expect(newer?.relatedReadingIds).toEqual(['r1']);
      // The earlier Reading's closing reply is still on screen above.
      expect(screen.getByText('You hold what this reading can give.')).toBeTruthy();
    });

    it('sends follow-ups to the newest Reading of the conversation', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      const discussCallable = jest
        .fn()
        .mockResolvedValueOnce({
          data: {
            answer: 'That is its own question, and needs its own moment.',
            isNewQuestion: true,
            turnsRemaining: 30,
          },
        })
        .mockResolvedValueOnce({
          data: { answer: 'The second reading holds.', isNewQuestion: false, turnsRemaining: 30 },
        });
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return askCallable;
        }
        if (name === 'discussReading') {
          return discussCallable;
        }
        return defaultImpl(name);
      });

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'Will my brother travel?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByTestId('oracle-chat-ask-as-new')).toBeTruthy());
      await user.press(screen.getByTestId('oracle-chat-ask-as-new'));
      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(useReadingThreadsStore.getState().threads[0]?.readingId).not.toBeNull(),
      );

      await user.type(screen.getByTestId('oracle-chat-input'), 'When?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('The second reading holds.')).toBeTruthy());

      // The follow-up belongs to the newest Reading, and carries only its turns.
      const newer = useReadingThreadsStore.getState().threads[0];
      expect(newer?.messages.some(m => m.text === 'When?')).toBe(true);
      expect(discussCallable.mock.calls[1]?.[0]).toMatchObject({
        message: 'When?',
        turns: [],
        compareReadingIds: ['r1'],
      });
    });

    it('shows an already-closed conversation as a close, not a failure to retry', async () => {
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return jest.fn(() => Promise.resolve({ data: successPayload() }));
        }
        if (name === 'discussReading') {
          return jest.fn(() =>
            Promise.reject(Object.assign(new Error('closed'), { code: 'resource-exhausted' })),
          );
        }
        return defaultImpl(name);
      });

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'One more thing?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));

      await waitFor(() =>
        expect(
          screen.getByText(
            'This Reading has said what it can. Ask your next question as a new Reading.',
          ),
        ).toBeTruthy(),
      );
      expect(oracleMessages().at(-1)?.status).toBe('sent');
      expect(
        screen.getByText('✦ This Reading has said what it can — ask your next question'),
      ).toBeTruthy();
    });

    it('retries a follow-up under its own SAME requestId, so the turn is not spent twice', async () => {
      const discussCallable = jest.fn(() =>
        Promise.reject(Object.assign(new Error('down'), { code: 'unavailable' })),
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

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await askOnce(user);

      await user.type(screen.getByTestId('oracle-chat-input'), 'Why so long?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('↻ Retry')).toBeTruthy());

      await user.press(screen.getByText('↻ Retry'));
      await waitFor(() => expect(discussCallable).toHaveBeenCalledTimes(2));

      const first = discussCallable.mock.calls[0]?.[0] as { requestId?: string };
      const second = discussCallable.mock.calls[1]?.[0] as { requestId?: string };
      expect(first.requestId).toBeDefined();
      expect(second.requestId).toBe(first.requestId);

      // It is the follow-up's own id, not the thread's — the thread's belongs
      // to the cast, and reusing it would collide with the reading's claim.
      expect(first.requestId).not.toBe(onlyThread()?.requestId);
      // And it is persisted, so the id survives the app being killed.
      const pending = oracleMessages().find(m => m.variant === 'discussion');
      expect(pending?.requestId).toBe(first.requestId);
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

      await renderScreen(<ReadingScreen />);
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
  /* ---------------------------------------------------------------------- */
  /*  Opening vs beginning a Reading                                         */
  /* ---------------------------------------------------------------------- */

  describe('the Reading lifecycle', () => {
    it('creates nothing until the seeker actually asks', async () => {
      await renderScreen(<ReadingScreen />);
      // Composer open, no question submitted: an abandoned composer must not
      // leave an empty Reading behind.
      expect(useReadingThreadsStore.getState().threads).toHaveLength(0);
    });

    it('shows the handed-over question immediately, with no blank New Reading', async () => {
      // Held open so the assertion lands while the cast is still in flight —
      // the exact frame the seeker sees on arriving from Home.
      let resolveAsk: (value: { data: unknown }) => void = () => {};
      const pending = new Promise<{ data: unknown }>(resolve => {
        resolveAsk = resolve;
      });
      (httpsCallable as jest.Mock).mockImplementation((name: string) =>
        name === 'askWatchOracle' ? jest.fn(() => pending) : defaultImpl(name),
      );
      setRoute({ initialQuestion: 'Should I accept this opportunity?' });

      await renderScreen(<ReadingScreen />);

      expect(screen.getByText('Should I accept this opportunity?')).toBeTruthy();
      expect(screen.queryByText('New Reading')).toBeNull();
      expect(screen.getAllByText('Accept opportunity').length).toBeGreaterThan(0);

      resolveAsk({ data: successPayload() });
      await waitFor(() => expect(onlyThread()?.readingId).toBe('r1'));
    });

    it('records a question spoken on Home as a voice question', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      (httpsCallable as jest.Mock).mockImplementation((name: string) =>
        name === 'askWatchOracle' ? askCallable : defaultImpl(name),
      );
      setRoute({ initialQuestion: 'Will I get the job?', initialQuestionKind: 'voice' });

      await renderScreen(<ReadingScreen />);

      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(1));
      expect(askCallable.mock.calls[0][0]).toMatchObject({ question: 'Will I get the job?' });
      expect(onlyThread()?.messages.find(m => m.role === 'user')?.kind).toBe('voice');
    });

    it('submits a question handed over from Home, once', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      (httpsCallable as jest.Mock).mockImplementation((name: string) =>
        name === 'askWatchOracle' ? askCallable : defaultImpl(name),
      );
      setRoute({ initialQuestion: 'Should I accept this business opportunity?' });

      await renderScreen(<ReadingScreen />);

      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(1));
      const thread = onlyThread();
      expect(thread?.question).toBe('Should I accept this business opportunity?');
      expect(thread?.title).toBe('Accept business opportunity');
      expect(useReadingThreadsStore.getState().threads).toHaveLength(1);
    });

    it('restores an existing Reading without recasting it', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      (httpsCallable as jest.Mock).mockImplementation((name: string) =>
        name === 'askWatchOracle' ? askCallable : defaultImpl(name),
      );

      // A Reading cast three days ago, with its own moment.
      const store = useReadingThreadsStore.getState();
      store.createThread({
        id: 't_old',
        question: 'Will the buyer complete the purchase?',
        questionLang: 'en',
      });
      store.attachReading('t_old', {
        ...successPayload(),
        localMoment: '2026-08-08T11:13:00+05:30',
      } as never);
      setRoute({ threadId: 't_old' });

      await renderScreen(<ReadingScreen />);

      // Opening a Reading loads it. It does not consult the oracle again, and
      // the moment it shows is the one it was cast for.
      expect(askCallable).not.toHaveBeenCalled();
      expect(screen.getByText('Will the buyer complete the purchase?')).toBeTruthy();
      expect(
        threadById(useReadingThreadsStore.getState().threads, 't_old')?.context?.localMoment,
      ).toBe('2026-08-08T11:13:00+05:30');
    });

    it('opens an earlier Reading of a conversation on the whole conversation, talking to the newest', async () => {
      const askCallable = jest.fn(() => Promise.resolve({ data: successPayload() }));
      const discussCallable = jest.fn(() =>
        Promise.resolve({
          data: { answer: 'About the later one.', isNewQuestion: false, turnsRemaining: 30 },
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

      const store = useReadingThreadsStore.getState();
      store.createThread({ id: 't_a', question: 'Will the shop open?', questionLang: 'en' });
      store.attachReading('t_a', { ...successPayload(), readingId: 'r_a' } as never);
      store.createThread({
        id: 't_b',
        question: 'Will the loan be approved?',
        questionLang: 'en',
        relatedReadingIds: ['r_a'],
        previousThreadId: 't_a',
      });
      store.attachReading('t_b', { ...successPayload(), readingId: 'r_b' } as never);
      setRoute({ threadId: 't_a' });

      await renderScreen(<ReadingScreen />);

      expect(askCallable).not.toHaveBeenCalled();
      expect(screen.getByText('Will the shop open?')).toBeTruthy();
      expect(screen.getByText('Will the loan be approved?')).toBeTruthy();

      const user = userEvent.setup();
      await user.type(screen.getByTestId('oracle-chat-input'), 'And the timing?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('About the later one.')).toBeTruthy());
      expect(discussCallable.mock.calls[0]?.[0]).toMatchObject({ readingId: 'r_b' });
    });

    it("speaks a Reading in the language it was cast in, not the app's current one", async () => {
      // Cast in Urdu; the app is now showing English (renderScreen's default).
      const store = useReadingThreadsStore.getState();
      store.createThread({ id: 't_ur', question: 'کیا مجھے نوکری ملے گی؟', questionLang: 'ur' });
      store.addMessage('t_ur', {
        id: 'u_ur',
        role: 'user',
        text: 'کیا مجھے نوکری ملے گی؟',
        createdAt: '2026-08-08T05:43:00.000Z',
        status: 'sent',
      });
      store.addMessage('t_ur', {
        id: 'o_ur',
        role: 'oracle',
        text: '',
        createdAt: '2026-08-08T05:43:00.000Z',
        status: 'sent',
        replyToId: 'u_ur',
        variant: 'reading',
        reading: successPayload() as never,
      });
      store.attachReading('t_ur', successPayload() as never);
      setRoute({ threadId: 't_ur' });

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await user.press(screen.getByLabelText('Play narration'));

      await waitFor(() => expect(Tts.setDefaultLanguage).toHaveBeenCalledWith('ur-PK'));
    });

    it('retries a failed cast under the SAME requestId, so the server can replay it', async () => {
      const askCallable = jest.fn(() =>
        Promise.reject(Object.assign(new Error('boom'), { code: 'internal' })),
      );
      (httpsCallable as jest.Mock).mockImplementation((name: string) =>
        name === 'askWatchOracle' ? askCallable : defaultImpl(name),
      );

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('↻ Retry')).toBeTruthy());

      await user.press(screen.getByText('↻ Retry'));
      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(2));

      // The id identifies the seeker's ACT of asking, not the call: same id on
      // the retry is what lets the server tell a retry from a second question.
      const first = askCallable.mock.calls[0]?.[0] as { requestId?: string };
      const second = askCallable.mock.calls[1]?.[0] as { requestId?: string };
      expect(first.requestId).toBeDefined();
      expect(second.requestId).toBe(first.requestId);
      // And it is persisted, so the id survives the app being killed.
      expect(onlyThread()?.requestId).toBe(first.requestId);
    });

    it('re-asking after a failed cast moves the question AND mints a new requestId', async () => {
      const askCallable = jest.fn(() =>
        Promise.reject(Object.assign(new Error('boom'), { code: 'internal' })),
      );
      (httpsCallable as jest.Mock).mockImplementation((name: string) =>
        name === 'askWatchOracle' ? askCallable : defaultImpl(name),
      );

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('↻ Retry')).toBeTruthy());

      // Different words, not the Retry button: the seeker is asking something
      // else, in a Reading that never got a chart.
      await user.type(screen.getByTestId('oracle-chat-input'), 'Should I sell the shop?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(askCallable).toHaveBeenCalledTimes(2));

      // The header must not keep naming a matter this Reading is no longer
      // about...
      expect(onlyThread()?.question).toBe('Should I sell the shop?');
      expect(onlyThread()?.title).toBe('Sell shop');

      // ...and the id must be new. Reusing it would let the server replay the
      // earlier reading — if that cast in fact succeeded and only its response
      // was lost — as the answer to these different words.
      const first = askCallable.mock.calls[0]?.[0] as { requestId?: string };
      const second = askCallable.mock.calls[1]?.[0] as { requestId?: string };
      expect(second.requestId).not.toBe(first.requestId);
      expect(onlyThread()?.requestId).toBe(second.requestId);
    });

    it('keeps a retried cast in the same Reading rather than opening a second', async () => {
      (httpsCallable as jest.Mock).mockImplementation((name: string) => {
        if (name === 'askWatchOracle') {
          return jest.fn(() =>
            Promise.reject(Object.assign(new Error('boom'), { code: 'internal' })),
          );
        }
        return defaultImpl(name);
      });

      await renderScreen(<ReadingScreen />);
      const user = userEvent.setup();
      await user.type(screen.getByTestId('oracle-chat-input'), 'Will I get the job?');
      await user.press(screen.getByTestId('oracle-chat-send-btn'));
      await waitFor(() => expect(screen.getByText('↻ Retry')).toBeTruthy());

      (httpsCallable as jest.Mock).mockImplementation((name: string) =>
        name === 'askWatchOracle'
          ? jest.fn(() => Promise.resolve({ data: successPayload() }))
          : defaultImpl(name),
      );
      await user.press(screen.getByText('↻ Retry'));

      await waitFor(() => expect(onlyThread()?.readingId).toBe('r1'));
      expect(useReadingThreadsStore.getState().threads).toHaveLength(1);
    });
  });
});

describe('errorMessageFor', () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof errorMessageFor>[1];
  const exhausted = { code: 'resource-exhausted' };

  it('reports the daily quota when a cast is refused', () => {
    expect(errorMessageFor(exhausted, t)).toBe('oracleChat.quotaExhausted');
  });

  it("reports the Reading's follow-up limit, not the daily quota, when a follow-up is refused", () => {
    expect(errorMessageFor(exhausted, t, 'discuss')).toBe('oracleChat.discussionLimitReached');
  });
});
