import { act, renderHook, waitFor } from '@testing-library/react-native';
import Tts from 'react-native-tts';
import { useTextToSpeech } from '../useTextToSpeech';

const mockedTts = Tts as unknown as {
  getInitStatus: jest.Mock;
  setDefaultLanguage: jest.Mock;
  speak: jest.Mock;
  stop: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
};

function ttsListener(type: string): ((e: unknown) => void) | undefined {
  return mockedTts.addEventListener.mock.calls.find(([t]) => t === type)?.[1] as
    | ((e: unknown) => void)
    | undefined;
}

/**
 * Fire a native TTS event and flush whatever state it produced.
 *
 * The flush is the whole point. `waitFor(() => expect(status).toBe(x))`
 * resolves on its FIRST poll, which can run before the callback's setState
 * has been committed — so any assertion that a native event left state
 * UNCHANGED passes vacuously without this. Two regression tests below were
 * written that way and survived re-introducing the very bug they describe;
 * `await act(async () => ...)` is what makes them bite.
 */
async function emitTts(type: string, event: Record<string, unknown>): Promise<void> {
  await act(async () => {
    ttsListener(type)?.(event);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedTts.getInitStatus.mockResolvedValue('success');
  mockedTts.setDefaultLanguage.mockResolvedValue('success');
  mockedTts.stop.mockResolvedValue(true);
  mockedTts.pause.mockResolvedValue(true);
  mockedTts.resume.mockResolvedValue(true);
});

// NOTE: hook methods below are called directly (not wrapped in act()) and
// observed via waitFor(). A synchronous act(() => hook.method()) does not
// reliably flush the resulting state update against this project's pinned
// react/test-renderer combination — see useSpeechToText.test.ts for the same
// pattern and reasoning.

describe('useTextToSpeech', () => {
  it('speak() marks the message active and speaking, and calls Tts.speak with its text', async () => {
    const { result } = await renderHook(() => useTextToSpeech());

    result.current.speak('m1', 'the verdict is favourable', 'en');

    await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith('the verdict is favourable'));
    expect(result.current.activeMessageId).toBe('m1');
    expect(result.current.status).toBe('speaking');
  });

  it('toggle() on the currently-speaking message pauses it, stopping the engine', async () => {
    const { result } = await renderHook(() => useTextToSpeech());
    result.current.speak('m1', 'text', 'en');
    await waitFor(() => expect(result.current.status).toBe('speaking'));
    mockedTts.stop.mockClear();

    result.current.toggle('m1', 'text', 'en');

    await waitFor(() => expect(result.current.status).toBe('paused'));
    // Tts.pause() is a no-op on Android (index.js:103) — the narration is only
    // actually silenced by stopping. Asserting on pause() is what let the dead
    // button pass CI before.
    expect(mockedTts.stop).toHaveBeenCalled();
    expect(mockedTts.pause).not.toHaveBeenCalled();
    expect(result.current.activeMessageId).toBe('m1');
  });

  it('toggle() on the currently-paused message resumes it', async () => {
    const { result } = await renderHook(() => useTextToSpeech());
    result.current.speak('m1', 'text', 'en');
    await waitFor(() => expect(result.current.status).toBe('speaking'));
    result.current.pause();
    await waitFor(() => expect(result.current.status).toBe('paused'));

    result.current.toggle('m1', 'text', 'en');

    await waitFor(() => expect(result.current.status).toBe('speaking'));
    expect(mockedTts.resume).not.toHaveBeenCalled();
  });

  it('toggle() on a different message starts a new utterance instead of resuming', async () => {
    const { result } = await renderHook(() => useTextToSpeech());
    result.current.speak('m1', 'first', 'en');
    await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith('first'));

    result.current.toggle('m2', 'second', 'en');

    await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith('second'));
    expect(result.current.activeMessageId).toBe('m2');
    expect(result.current.status).toBe('speaking');
  });

  it('the tts-finish listener resets state to idle', async () => {
    const { result } = await renderHook(() => useTextToSpeech());
    result.current.speak('m1', 'text', 'en');
    await waitFor(() => expect(result.current.status).toBe('speaking'));

    const onFinish = ttsListener('tts-finish');
    expect(onFinish).toBeDefined();
    onFinish?.({ utteranceId: '1' });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.activeMessageId).toBeNull();
  });

  it('stop() resets state and calls Tts.stop', async () => {
    const { result } = await renderHook(() => useTextToSpeech());
    result.current.speak('m1', 'text', 'en');
    await waitFor(() => expect(result.current.status).toBe('speaking'));

    result.current.stop();

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.activeMessageId).toBeNull();
    expect(mockedTts.stop).toHaveBeenCalled();
  });

  // Every deliberate Tts.stop() makes the engine emit tts-cancel. The hook
  // used to alias its cancel handler to its finish handler, so its own stops
  // reported "playback ended" and reset the UI to idle underneath live audio.
  describe('self-inflicted tts-cancel', () => {
    it('switching bubbles keeps the new narration marked speaking', async () => {
      const { result } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', 'first', 'en');
      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith('first'));

      result.current.speak('m2', 'second', 'en');
      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith('second'));

      // The cancel the m1 stop provoked lands only now, after m2 started.
      await emitTts('tts-cancel', { utteranceId: 'm1' });

      expect(result.current.status).toBe('speaking');
      expect(result.current.activeMessageId).toBe('m2');
    });

    it('a paused narration stays paused when its own stop echoes back', async () => {
      const { result } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', 'text', 'en');
      await waitFor(() => expect(result.current.status).toBe('speaking'));

      result.current.pause();
      await waitFor(() => expect(result.current.status).toBe('paused'));
      await emitTts('tts-cancel', { utteranceId: 'm1' });

      expect(result.current.status).toBe('paused');
      expect(result.current.activeMessageId).toBe('m1');
    });

    it('an unprovoked cancel — audio focus lost — still ends playback', async () => {
      const { result } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', 'text', 'en');
      await waitFor(() => expect(result.current.status).toBe('speaking'));

      await emitTts('tts-cancel', { utteranceId: 'm1' });

      expect(result.current.status).toBe('idle');
      expect(result.current.activeMessageId).toBeNull();
    });
  });

  // Resume picks up from the character offset the engine last reported, so a
  // long verdict does not restart from "The chart shows..." on every pause.
  describe('resume position', () => {
    const NARRATION = 'The window is open. Move deliberately. Do not force the matter.';

    it('resumes from the last reported progress offset', async () => {
      const { result } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', NARRATION, 'en');
      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION));

      // Android's onRangeStart payload — `start`, not the `location` the
      // shipped typings claim (TextToSpeechModule.java:94-100).
      await emitTts('tts-progress', { utteranceId: 'm1', start: 21, end: 25, frame: 0 });

      result.current.pause();
      await waitFor(() => expect(result.current.status).toBe('paused'));
      mockedTts.speak.mockClear();

      result.current.resume();

      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION.slice(21)));
    });

    it('accumulates offsets across repeated pause/resume cycles', async () => {
      const { result } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', NARRATION, 'en');
      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION));

      await emitTts('tts-progress', { utteranceId: 'm1', start: 21 });
      result.current.pause();
      await waitFor(() => expect(result.current.status).toBe('paused'));
      result.current.resume();
      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION.slice(21)));

      // Progress on the SECOND segment is relative to that segment's start,
      // so it must be added to the 21 already spoken, not replace it.
      await emitTts('tts-progress', { utteranceId: 'm1', start: 18 });
      result.current.pause();
      await waitFor(() => expect(result.current.status).toBe('paused'));
      mockedTts.speak.mockClear();

      result.current.resume();

      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION.slice(39)));
    });

    it('replays from the start when the engine reports no progress at all', async () => {
      // API 24-25, or an OEM engine without onRangeStart — degraded, not dead.
      const { result } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', NARRATION, 'en');
      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION));

      result.current.pause();
      await waitFor(() => expect(result.current.status).toBe('paused'));
      mockedTts.speak.mockClear();

      result.current.resume();

      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION));
    });

    it('goes idle rather than speaking an empty string at the very end', async () => {
      const { result } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', NARRATION, 'en');
      await waitFor(() => expect(mockedTts.speak).toHaveBeenCalledWith(NARRATION));

      await emitTts('tts-progress', { utteranceId: 'm1', start: NARRATION.length });
      result.current.pause();
      await waitFor(() => expect(result.current.status).toBe('paused'));
      mockedTts.speak.mockClear();

      result.current.resume();

      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(mockedTts.speak).not.toHaveBeenCalled();
    });
  });

  // Unmount is the back button: leaving Oracle Chat tears this hook down. The
  // teardown used to call Tts.removeEventListener, which throws under RN 0.78
  // (see jest.setup.js), and a throwing unmount surfaced as the app's
  // ErrorBoundary screen instead of a return to Home.
  describe('teardown (the back-button path)', () => {
    it('unmounts without throwing', async () => {
      const { unmount } = await renderHook(() => useTextToSpeech());
      // unmount() is async in RNTL v14 — an un-awaited call resolves nothing
      // and would pass even while the cleanup throws.
      await expect(unmount()).resolves.toBeUndefined();
    });

    it('releases every listener via its subscription, never removeEventListener', async () => {
      const { unmount } = await renderHook(() => useTextToSpeech());

      const removes = mockedTts.addEventListener.mock.results.map(
        r => (r.value as { remove: jest.Mock }).remove,
      );
      expect(removes).toHaveLength(4);

      await unmount();

      removes.forEach(remove => expect(remove).toHaveBeenCalled());
      expect(mockedTts.removeEventListener).not.toHaveBeenCalled();
    });

    it('stops any in-flight utterance so audio does not outlive the screen', async () => {
      const { result, unmount } = await renderHook(() => useTextToSpeech());
      result.current.speak('m1', 'text', 'en');
      await waitFor(() => expect(result.current.status).toBe('speaking'));

      mockedTts.stop.mockClear();
      await unmount();

      expect(mockedTts.stop).toHaveBeenCalled();
    });
  });
});
