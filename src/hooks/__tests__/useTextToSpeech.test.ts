import { renderHook, waitFor } from '@testing-library/react-native';
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

  it('toggle() on the currently-speaking message pauses it', async () => {
    const { result } = await renderHook(() => useTextToSpeech());
    result.current.speak('m1', 'text', 'en');
    await waitFor(() => expect(result.current.status).toBe('speaking'));

    result.current.toggle('m1', 'text', 'en');

    await waitFor(() => expect(result.current.status).toBe('paused'));
    expect(mockedTts.pause).toHaveBeenCalledWith(true);
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
    expect(mockedTts.resume).toHaveBeenCalled();
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
      expect(removes).toHaveLength(3);

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
