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

/**
 * Whether the recognizer native module is actually present in this build.
 *
 * Every call below went straight at `Voice` — including the listener
 * assignments in the mount effect. If the native module is missing or failed
 * to link (an autolinking miss, a stripped release build, a device with no
 * recognizer service), that assignment throws during render of the screen that
 * uses this hook. There is no boundary inside the screen, so the throw took
 * out the whole navigator: pressing Ask showed an error instead of the
 * composer, and nothing said why.
 *
 * Voice is an ENHANCEMENT — the oracle answers typed questions perfectly well
 * without it — so an absent recognizer must degrade to "no mic", never to a
 * dead screen. Evaluated once, defensively, because reading a property off a
 * broken native module can itself throw.
 */
const VOICE_AVAILABLE: boolean = (() => {
  try {
    return typeof Voice?.start === 'function';
  } catch {
    return false;
  }
})();

export type SpeechToTextError =
  | 'permission-denied'
  | 'unavailable'
  | 'no-speech'
  | 'recognizer-error';

export interface SpeechToTextState {
  /**
   * False when this build or device has no usable recognizer. The composer
   * hides its mic rather than offering a button that cannot work.
   */
  isAvailable: boolean;
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

/**
 * @param onFinalTranscript Called with the final transcript when the
 *   recognizer ends listening ON ITS OWN — Android does this as soon as the
 *   speaker pauses, which is how most voice questions end. Not called after
 *   stop() or cancel(): stop() already hands its caller the transcript.
 */
export function useSpeechToText(
  lang: 'en' | 'ur' | 'hi',
  onFinalTranscript?: (text: string) => void,
): SpeechToTextState {
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
  // True once stop()/cancel() has been called for the current session. A
  // results callback arriving after that — even one so late that stop()'s
  // own finalize wait has already timed out and returned — belongs to the
  // caller of stop(), never to onFinalTranscript, or the same words would be
  // delivered twice.
  const stopRequestedRef = useRef(false);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  // Points the recognizer's events at THIS hook instance. Called on mount and
  // again by every start(): the native module is a singleton, and more than
  // one screen can hold this hook at once (Home stays mounted under a
  // Reading). @react-native-voice/voice binds its native listeners to the
  // handlers present at the first start() and only rebinds after destroy(),
  // so without re-claiming here, a session started on one screen would
  // deliver its transcript to whichever screen happened to start first.
  const attachListenersRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    mountedRef.current = true;

    if (!VOICE_AVAILABLE) {
      return () => {
        mountedRef.current = false;
      };
    }

    attachListenersRef.current = (): void => {
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
        if (finalizeResolveRef.current !== null) {
          finalizeResolveRef.current(text);
          finalizeResolveRef.current = null;
        } else if (!stopRequestedRef.current && mountedRef.current) {
          // The recognizer ended by itself. Without this, the final words
          // reached neither the composer (it mirrors partials only while
          // listening) nor a send — the seeker had to notice and press Send.
          stopRequestedRef.current = true;
          onFinalTranscriptRef.current?.(text);
        }
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
    };

    try {
      attachListenersRef.current();
    } catch (err) {
      // A recognizer that rejects its own listener setup is a recognizer this
      // session cannot use. Logged, not thrown: the composer still types.
      log.warn('recognizer listener setup failed — voice input disabled', {
        error: String(err),
      });
    }

    return () => {
      mountedRef.current = false;
      try {
        Voice.destroy()
          .then(() => Voice.removeAllListeners())
          .catch(() => {
            /* best-effort teardown — nothing to recover from on a torn-down screen */
          });
      } catch {
        /* same: teardown of a module that never worked cannot fail the unmount */
      }
    };
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (!VOICE_AVAILABLE) {
      setError('unavailable');
      return;
    }
    setError(null);
    setPartialText('');
    latestTranscriptRef.current = '';
    stopRequestedRef.current = false;

    let permission = await checkMicrophonePermission();
    if (permission !== 'granted') {
      permission = await requestMicrophonePermission();
    }
    if (permission !== 'granted') {
      setError('permission-denied');
      return;
    }

    try {
      // Release whatever native listeners an earlier session (possibly
      // another screen's) left bound, then claim the events for this one —
      // see attachListenersRef. destroy() is a no-op when nothing is bound.
      await Voice.destroy().catch((e: unknown) => {
        log.warn('Voice.destroy before start failed', { error: String(e) });
      });
      attachListenersRef.current();
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
    stopRequestedRef.current = true;
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
    stopRequestedRef.current = true;
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

  return { isAvailable: VOICE_AVAILABLE, isListening, partialText, error, start, stop, cancel };
}
