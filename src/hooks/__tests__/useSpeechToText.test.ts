import { act, renderHook, waitFor } from '@testing-library/react-native';
import Voice from '@react-native-voice/voice';
import { useSpeechToText } from '../useSpeechToText';
import * as permissions from '@utils/permissions';

jest.mock('@utils/permissions', () => ({
  checkMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
  requestMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
}));

const mockedVoice = Voice as unknown as {
  start: jest.Mock;
  stop: jest.Mock;
  cancel: jest.Mock;
  onSpeechPartialResults?: (e: { value?: string[] }) => void;
  onSpeechResults?: (e: { value?: string[] }) => void;
  onSpeechEnd?: () => void;
  onSpeechError?: (e: { error?: { code?: string } }) => void;
};

beforeEach(() => {
  jest.clearAllMocks();
  (permissions.checkMicrophonePermission as jest.Mock).mockResolvedValue('granted');
  (permissions.requestMicrophonePermission as jest.Mock).mockResolvedValue('granted');
});

describe('useSpeechToText', () => {
  it('starts listening once mic permission is already granted', async () => {
    const { result } = await renderHook(() => useSpeechToText('en'));

    await act(async () => {
      await result.current.start();
    });

    expect(mockedVoice.start).toHaveBeenCalledWith('en-US');
    expect(result.current.isListening).toBe(true);
  });

  it('requests permission when not yet granted, and proceeds if granted', async () => {
    (permissions.checkMicrophonePermission as jest.Mock).mockResolvedValueOnce('denied');
    const { result } = await renderHook(() => useSpeechToText('ur'));

    await act(async () => {
      await result.current.start();
    });

    expect(permissions.requestMicrophonePermission).toHaveBeenCalled();
    expect(mockedVoice.start).toHaveBeenCalledWith('ur-PK');
    expect(result.current.isListening).toBe(true);
  });

  it('sets a permission-denied error and never starts the recognizer when denied', async () => {
    (permissions.checkMicrophonePermission as jest.Mock).mockResolvedValueOnce('denied');
    (permissions.requestMicrophonePermission as jest.Mock).mockResolvedValueOnce('denied');
    const { result } = await renderHook(() => useSpeechToText('en'));

    await act(async () => {
      await result.current.start();
    });

    expect(mockedVoice.start).not.toHaveBeenCalled();
    expect(result.current.error).toBe('permission-denied');
    expect(result.current.isListening).toBe(false);
  });

  it('streams partial results while listening', async () => {
    const { result } = await renderHook(() => useSpeechToText('en'));
    await act(async () => {
      await result.current.start();
    });

    mockedVoice.onSpeechPartialResults?.({ value: ['will i'] });
    await waitFor(() => expect(result.current.partialText).toBe('will i'));

    mockedVoice.onSpeechPartialResults?.({ value: ['will i get the job'] });
    await waitFor(() => expect(result.current.partialText).toBe('will i get the job'));
  });

  it('stop() resolves with the final transcript once onSpeechResults fires', async () => {
    const { result } = await renderHook(() => useSpeechToText('en'));
    await act(async () => {
      await result.current.start();
    });

    const stopPromise = result.current.stop();
    mockedVoice.onSpeechResults?.({ value: ['will i get the job'] });

    await expect(stopPromise).resolves.toBe('will i get the job');
    await waitFor(() => expect(result.current.isListening).toBe(false));
  });

  it('stop() falls back to the last partial when onSpeechEnd fires with no results', async () => {
    const { result } = await renderHook(() => useSpeechToText('en'));
    await act(async () => {
      await result.current.start();
    });
    mockedVoice.onSpeechPartialResults?.({ value: ['partial only'] });
    await waitFor(() => expect(result.current.partialText).toBe('partial only'));

    const stopPromise = result.current.stop();
    mockedVoice.onSpeechEnd?.();

    await expect(stopPromise).resolves.toBe('partial only');
  });

  it('maps a no-match recognizer error to no-speech and stops listening', async () => {
    const { result } = await renderHook(() => useSpeechToText('en'));
    await act(async () => {
      await result.current.start();
    });

    mockedVoice.onSpeechError?.({ error: { code: '7' } });

    await waitFor(() => expect(result.current.error).toBe('no-speech'));
    expect(result.current.isListening).toBe(false);
  });

  it('cancel() discards the transcript and stops listening', async () => {
    const { result } = await renderHook(() => useSpeechToText('en'));
    await act(async () => {
      await result.current.start();
    });
    mockedVoice.onSpeechPartialResults?.({ value: ['something'] });
    await waitFor(() => expect(result.current.partialText).toBe('something'));

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockedVoice.cancel).toHaveBeenCalled();
    expect(result.current.partialText).toBe('');
    expect(result.current.isListening).toBe(false);
  });
});
