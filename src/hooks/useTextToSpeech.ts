/**
 * useTextToSpeech — on-device speech playback for oracle response bubbles.
 * --------------------------------------------------------------------------
 * Wraps react-native-tts (the platform's own TTS engine — no audio leaves the
 * device, no Cloud Function involved). Tracks which single message is
 * currently speaking, matching a chat UI where only one bubble can be
 * playing/paused at a time.
 *
 * Play/pause contract:
 *   - speak(messageId, text) starts a NEW utterance; if a different message
 *     was mid-utterance, its playback is stopped (not paused) first — pausing
 *     one utterance to start an unrelated one would leave two competing
 *     positions to resume from, which is not a state this UI ever offers.
 *   - toggle(messageId, text) is the single control ChatBubble's play/pause
 *     button needs: speak if idle, pause if this message is speaking, resume
 *     if this message is paused.
 *   - Android's pause()/resume() operate on the current utterance queue, not
 *     a specific id — safe here because at most one utterance is ever queued.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmitterSubscription } from 'react-native';
import Tts from 'react-native-tts';

import { createLogger } from '@utils/logger';

const log = createLogger('TextToSpeech');

const LOCALE_BY_LANG: Readonly<Record<'en' | 'ur' | 'hi', string>> = {
  en: 'en-US',
  ur: 'ur-PK',
  hi: 'hi-IN',
};

export type SpeakingStatus = 'idle' | 'speaking' | 'paused';

export interface TextToSpeechState {
  /** Which message id is currently speaking/paused; null when idle. */
  activeMessageId: string | null;
  status: SpeakingStatus;
  /** Start speaking `text` for `messageId`, replacing any current utterance. */
  speak: (messageId: string, text: string, lang: 'en' | 'ur' | 'hi') => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** speak / pause / resume, whichever this messageId's button should do. */
  toggle: (messageId: string, text: string, lang: 'en' | 'ur' | 'hi') => void;
}

/**
 * Subscribe to a TTS event, returning the handle that unsubscribes it.
 *
 * Deliberately NOT `Tts.removeEventListener`, which the library still ships:
 * it delegates to NativeEventEmitter#removeListener (index.js:122), a method
 * React Native deleted in 0.72 — RN 0.78's NativeEventEmitter only exposes
 * `removeAllListeners` and per-subscription `remove()`. Calling it throws
 * "this.removeListener is not a function", and because that call sat in this
 * hook's unmount cleanup, leaving Oracle Chat threw during teardown and the
 * app's ErrorBoundary rendered its fallback instead of the home dashboard.
 *
 * `addEventListener` does return the EmitterSubscription (index.js:118-120)
 * even though the shipped typings declare `void`, hence the cast: the handle
 * is real, only the .d.ts is wrong.
 */
type TtsEventName = 'tts-finish' | 'tts-cancel' | 'tts-error';

function subscribe(type: TtsEventName, handler: (event: never) => void): EmitterSubscription {
  const add = Tts.addEventListener as unknown as (
    t: TtsEventName,
    h: (event: never) => void,
  ) => EmitterSubscription;
  return add(type, handler);
}

let ttsInitPromise: Promise<void> | null = null;

/** getInitStatus() resolves once per process; safe to call from every mount. */
function ensureTtsReady(): Promise<void> {
  if (ttsInitPromise === null) {
    ttsInitPromise = Tts.getInitStatus()
      .then(() => undefined)
      .catch((e: unknown) => {
        log.warn('Tts.getInitStatus failed', { error: String(e) });
        // Don't cache a rejected init as permanent — a transient engine
        // hiccup shouldn't block every future speak() this session.
        ttsInitPromise = null;
      });
  }
  return ttsInitPromise;
}

export function useTextToSpeech(): TextToSpeechState {
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [status, setStatus] = useState<SpeakingStatus>('idle');
  const activeMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const onFinish = (): void => {
      activeMessageIdRef.current = null;
      setActiveMessageId(null);
      setStatus('idle');
    };
    const onCancel = onFinish;
    const onError = (e: { utteranceId: string | number }): void => {
      log.warn('tts-error', { utteranceId: e.utteranceId });
      onFinish();
    };

    const subscriptions = [
      subscribe('tts-finish', onFinish),
      subscribe('tts-cancel', onCancel),
      subscribe('tts-error', onError),
    ];

    return () => {
      subscriptions.forEach(sub => sub.remove());
      Tts.stop().catch(() => {
        /* best-effort — screen is unmounting anyway */
      });
    };
  }, []);

  const speak = useCallback((messageId: string, text: string, lang: 'en' | 'ur' | 'hi'): void => {
    activeMessageIdRef.current = messageId;
    setActiveMessageId(messageId);
    setStatus('speaking');

    ensureTtsReady()
      .then(() => {
        // A stale speak() from a message the user already moved away from —
        // e.g. toggle() raced a fast double-tap — must not resurrect status.
        if (activeMessageIdRef.current !== messageId) {
          return;
        }
        return Tts.setDefaultLanguage(LOCALE_BY_LANG[lang])
          .catch(() => undefined) // engine may not have this locale installed; speak anyway
          .then(() => Tts.stop()) // clear any prior utterance before queuing a new one
          .then(() => {
            if (activeMessageIdRef.current === messageId) {
              Tts.speak(text);
            }
          });
      })
      .catch((e: unknown) => {
        log.error('speak failed', { error: String(e) });
        if (activeMessageIdRef.current === messageId) {
          activeMessageIdRef.current = null;
          setActiveMessageId(null);
          setStatus('idle');
        }
      });
  }, []);

  const pause = useCallback((): void => {
    if (activeMessageIdRef.current === null) {
      return;
    }
    Tts.pause(true).catch((e: unknown) => log.warn('pause failed', { error: String(e) }));
    setStatus('paused');
  }, []);

  const resume = useCallback((): void => {
    if (activeMessageIdRef.current === null) {
      return;
    }
    Tts.resume().catch((e: unknown) => log.warn('resume failed', { error: String(e) }));
    setStatus('speaking');
  }, []);

  const stop = useCallback((): void => {
    activeMessageIdRef.current = null;
    setActiveMessageId(null);
    setStatus('idle');
    Tts.stop().catch(() => undefined);
  }, []);

  const toggle = useCallback(
    (messageId: string, text: string, lang: 'en' | 'ur' | 'hi'): void => {
      if (activeMessageIdRef.current !== messageId) {
        speak(messageId, text, lang);
        return;
      }
      if (status === 'speaking') {
        pause();
      } else {
        resume();
      }
    },
    [speak, pause, resume, status],
  );

  return { activeMessageId, status, speak, pause, resume, stop, toggle };
}
