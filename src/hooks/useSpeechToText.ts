/**
 * useSpeechToText — on-device speech recognition for the Oracle Chat composer.
 * --------------------------------------------------------------------------
 * Wraps @react-native-voice/voice (device-native recognizer, Android SpeechRecognizer
 * under the hood — no audio ever leaves the device, no Cloud Function involved).
 * The transcript this hook produces is handed to the SAME askWatchOracle() path
 * a typed question uses — this hook's only job is text-in, text-out.
 *
 * Lifecycle contract:
 *   - start()  requests RECORD_AUDIO if not yet granted, then begins listening.
 *   - Live partial results stream into `partialText` while listening, so the
 *     composer can show the words landing in real time.
 *   - stop() ends listening and resolves with the FINAL transcript. The
 *     recognizer's own onSpeechResults callback fires asynchronously after
 *     stop() is called — never assume it lands before stop()'s promise does.
 *   - A `finalize` backstop timeout guards stop(): some OEM recognizers swallow
 *     the results callback after a manual stop (same class of native-hang bug
 *     withTimeout() exists for elsewhere in this app). Without it, tapping the
 *     mic to end recording could leave the composer waiting forever with
 *     nothing to send.
 *   - cancel() discards whatever was heard (used-cancelled, no transcript).
 *
 * All listeners are attached once per mount and torn down on unmount —
 * Voice's `_events` setters are singletons on the native module itself, so a
 * screen that mounts/unmounts this hook repeatedly (e.g. navigating away
 * mid-recording) must not leak a stale handler that fires into unmounted state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Voice, { type SpeechErrorEvent, type SpeechResultsEvent } from '@react-native-voice/voice';

import { withTimeout } from '@utils/withTimeout';
import { checkMicrophonePermission, requestMicrophonePermission } from '@utils/permissions';
import { createLogger } from '@utils/logger';

const log = createLogger('SpeechToText');

/** BCP-47 locale @react-native-voice/voice expects, per app language. */
const LOCALE_BY_LANG: Readonly<Record<'en' | 'ur' | 'hi', string>> = {
  en: 'en-US',
  ur: 'ur-PK',
  hi: 'hi-IN',
};

/** How long stop() waits for a final transcript before giving up. */
const FINALIZE_TIMEOUT_MS = 4000;

export type SpeechToTextError =
  | 'permission-denied'
  | 'unavailable'
  | 'no-speech'
  | 'recognizer-error';

export interface SpeechToTextState {
  /** True while the recognizer is actively listening. */
  isListening: boolean;
  /** Live, in-progress transcript — updates as the recognizer hears more. */
  partialText: string;
  /** Set when start()/stop() fails; cleared on the next start(). */
  error: SpeechToTextError | null;
  /** Requests mic permission if needed, then begins listening. */
  start: () => Promise<void>;
  /** Ends listening and resolves with the final transcript ('' if none heard). */
  stop: () => Promise<string>;
  /** Ends listening and discards whatever was heard. */
  cancel: () => Promise<void>;
}

function mapRecognizerErrorCode(code: string | undefined): SpeechToTextError {
  // Android SpeechRecognizer error codes, surfaced as strings by the native
  // module — '7' is ERROR_NO_MATCH, '6' is ERROR_SPEECH_TIMEOUT (silence).
  if (code === '7' || code === '6') {
    return 'no-speech';
  }
  if (code === '9') {
    // ERROR_INSUFFICIENT_PERMISSIONS — permission was revoked mid-session.
    return 'permission-denied';
  }
  return 'recognizer-error';
}

export function useSpeechToText(lang: 'en' | 'ur' | 'hi'): SpeechToTextState {
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<SpeechToTextError | null>(null);

  // Mutable transcript the results callback writes into — read by stop()'s
  // finalize-wait, which resolves the outer promise from the callback rather
  // than from React state (state updates aren't visible synchronously to a
  // promise executor waiting inside the same tick).
  const latestTranscriptRef = useRef('');
  const finalizeResolveRef = useRef<((text: string) => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? '';
      latestTranscriptRef.current = text;
      if (mountedRef.current) {
        setPartialText(text);
      }
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? latestTranscriptRef.current;
      latestTranscriptRef.current = text;
      if (mountedRef.current) {
        setPartialText(text);
        setIsListening(false);
      }
      finalizeResolveRef.current?.(text);
      finalizeResolveRef.current = null;
    };

    Voice.onSpeechEnd = () => {
      if (mountedRef.current) {
        setIsListening(false);
      }
      // No onSpeechResults followed (silence, or the engine ended without a
      // final hypothesis) — resolve stop() with whatever partial we have
      // rather than leaving it hanging until FINALIZE_TIMEOUT_MS.
      finalizeResolveRef.current?.(latestTranscriptRef.current);
      finalizeResolveRef.current = null;
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      const mapped = mapRecognizerErrorCode(e.error?.code);
      log.warn('recognizer error', { code: e.error?.code, message: e.error?.message });
      if (mountedRef.current) {
        setIsListening(false);
        setError(mapped);
      }
      finalizeResolveRef.current?.(latestTranscriptRef.current);
      finalizeResolveRef.current = null;
    };

    return () => {
      mountedRef.current = false;
      Voice.destroy()
        .then(() => Voice.removeAllListeners())
        .catch(() => {
          /* best-effort teardown — nothing to recover from on a torn-down screen */
        });
    };
  }, []);

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    setPartialText('');
    latestTranscriptRef.current = '';

    let permission = await checkMicrophonePermission();
    if (permission !== 'granted') {
      permission = await requestMicrophonePermission();
    }
    if (permission !== 'granted') {
      setError('permission-denied');
      return;
    }

    try {
      await Voice.start(LOCALE_BY_LANG[lang]);
      if (mountedRef.current) {
        setIsListening(true);
      }
    } catch (e) {
      log.error('Voice.start threw', { error: String(e) });
      if (mountedRef.current) {
        setError('unavailable');
      }
    }
  }, [lang]);

  const stop = useCallback(async (): Promise<string> => {
    const finalize = new Promise<string>(resolve => {
      finalizeResolveRef.current = resolve;
    });

    try {
      await Voice.stop();
    } catch (e) {
      log.error('Voice.stop threw', { error: String(e) });
      finalizeResolveRef.current = null;
      if (mountedRef.current) {
        setIsListening(false);
      }
      return latestTranscriptRef.current;
    }

    const result = await withTimeout(finalize, FINALIZE_TIMEOUT_MS);
    finalizeResolveRef.current = null;
    if (mountedRef.current) {
      setIsListening(false);
    }
    return result ?? latestTranscriptRef.current;
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    finalizeResolveRef.current = null;
    latestTranscriptRef.current = '';
    if (mountedRef.current) {
      setPartialText('');
      setIsListening(false);
    }
    try {
      await Voice.cancel();
    } catch {
      /* nothing to recover — recognizer is being torn down anyway */
    }
  }, []);

  return { isListening, partialText, error, start, stop, cancel };
}
