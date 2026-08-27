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
 *
 * Pause is implemented as stop-and-remember, NOT Tts.pause(). On Android —
 * this app's only platform — Tts.pause() never reaches the engine: the
 * library returns `Promise.resolve(false)` without calling it (index.js:103).
 * The button therefore used to relabel itself "paused" while the narration
 * kept playing to the end. Instead we record how far the engine has spoken
 * (the `tts-progress` event carries a character offset), stop, and resume by
 * speaking the remainder of the text. Where progress events are unavailable
 * — onRangeStart is API 26+, and an OEM engine may not report at all, while
 * this app's minSdk is 24 — the offset stays 0 and resume replays the
 * narration from the start. Degraded, but it plays; that is the honest
 * failure mode, and it is still strictly better than a dead button.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmitterSubscription } from 'react-native';
import Tts from 'react-native-tts';

import { createLogger } from '@utils/logger';

const log = createLogger('TextToSpeech');

type Lang = 'en' | 'ur' | 'hi';

const LOCALE_BY_LANG: Readonly<Record<Lang, string>> = {
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
  speak: (messageId: string, text: string, lang: Lang) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** speak / pause / resume, whichever this messageId's button should do. */
  toggle: (messageId: string, text: string, lang: Lang) => void;
}

/* -------------------------------------------------------------------------- */
/*  Native event plumbing                                                     */
/* -------------------------------------------------------------------------- */

type TtsEventName = 'tts-finish' | 'tts-cancel' | 'tts-error' | 'tts-progress';

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
function subscribe(type: TtsEventName, handler: (event: never) => void): EmitterSubscription {
  const add = Tts.addEventListener as unknown as (
    t: TtsEventName,
    h: (event: never) => void,
  ) => EmitterSubscription;
  return add(type, handler);
}

/**
 * How many characters into the current utterance the engine has reached.
 *
 * Android's onRangeStart sends `{utteranceId, start, end, frame}`
 * (TextToSpeechModule.java:94-100); iOS sends `{location, length}`. The
 * shipped index.d.ts declares only the iOS shape, so neither key can be
 * trusted from the typings alone — read whichever arrived, and return null
 * when the engine reported no usable position at all.
 */
export function progressOffset(event: unknown): number | null {
  if (typeof event !== 'object' || event === null) {
    return null;
  }
  const e = event as { start?: unknown; location?: unknown };
  if (typeof e.start === 'number' && Number.isFinite(e.start)) {
    return e.start;
  }
  if (typeof e.location === 'number' && Number.isFinite(e.location)) {
    return e.location;
  }
  return null;
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

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The narration in flight (or paused mid-way), tracked outside React state
 * because the native callbacks and the promise chains inside speak() both
 * need to read the CURRENT value synchronously, which a state variable
 * captured in a closure cannot give them.
 */
interface Playback {
  messageId: string;
  /** The complete narration — resume slices from this, never from a fragment. */
  text: string;
  lang: Lang;
  /** Characters consumed by earlier, already-stopped segments of this text. */
  base: number;
  /** Characters into the CURRENT segment, per the newest tts-progress event. */
  segmentOffset: number;
}

export function useTextToSpeech(): TextToSpeechState {
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [status, setStatus] = useState<SpeakingStatus>('idle');

  const playbackRef = useRef<Playback | null>(null);
  /**
   * Cancels this hook caused itself and must not react to.
   *
   * `Tts.stop()` makes the engine emit `tts-cancel`, and we call stop() on
   * every deliberate transition — pausing, stopping, and replacing one
   * message's narration with another's. Treating those as "playback ended"
   * (which this hook used to do, aliasing onCancel to onFinish) meant
   * starting a second bubble's narration reset the UI to idle a beat after
   * it began: audio playing, button showing ▶. So self-inflicted cancels are
   * swallowed here, and a cancel with no matching stop — audio focus lost to
   * a call, the engine killed underneath us — still correctly ends playback.
   *
   * Reset on every fresh utterance so a stop that produced no cancel (nothing
   * was actually playing) can't leave a swallow owed indefinitely.
   */
  const selfCancelsRef = useRef(0);

  const clearPlayback = useCallback((): void => {
    playbackRef.current = null;
    setActiveMessageId(null);
    setStatus('idle');
  }, []);

  useEffect(() => {
    const onFinish = (): void => {
      playbackRef.current = null;
      setActiveMessageId(null);
      setStatus('idle');
    };

    const onCancel = (): void => {
      if (selfCancelsRef.current > 0) {
        selfCancelsRef.current -= 1;
        return;
      }
      log.debug('tts-cancel with no matching stop — treating as interrupted');
      onFinish();
    };

    const onError = (e: { utteranceId: string | number }): void => {
      log.warn('tts-error', { utteranceId: e.utteranceId });
      onFinish();
    };

    const onProgress = (e: unknown): void => {
      const offset = progressOffset(e);
      if (offset !== null && playbackRef.current !== null) {
        playbackRef.current.segmentOffset = offset;
      }
    };

    const subscriptions = [
      subscribe('tts-finish', onFinish),
      subscribe('tts-cancel', onCancel),
      subscribe('tts-error', onError),
      subscribe('tts-progress', onProgress),
    ];

    return () => {
      subscriptions.forEach(sub => sub.remove());
      Tts.stop().catch(() => {
        /* best-effort — screen is unmounting anyway */
      });
    };
  }, []);

  /**
   * Hand `segment` to the engine for the narration already recorded in
   * playbackRef. Split out because speak() and resume() differ only in which
   * slice of the text they start from and in what they reset first.
   */
  const startUtterance = useCallback(
    (messageId: string, segment: string, lang: Lang): void => {
      ensureTtsReady()
        .then(() => {
          // A stale start from a message the user already moved away from —
          // e.g. toggle() raced a fast double-tap — must not resurrect status.
          if (playbackRef.current?.messageId !== messageId) {
            return;
          }
          return Tts.setDefaultLanguage(LOCALE_BY_LANG[lang])
            .catch(() => undefined) // engine may not have this locale installed; speak anyway
            .then(() => {
              if (playbackRef.current?.messageId === messageId) {
                Tts.speak(segment);
              }
            });
        })
        .catch((e: unknown) => {
          log.error('speak failed', { error: String(e) });
          if (playbackRef.current?.messageId === messageId) {
            clearPlayback();
          }
        });
    },
    [clearPlayback],
  );

  /** Stop the engine, marking the resulting tts-cancel as ours to ignore. */
  const stopEngine = useCallback((): void => {
    selfCancelsRef.current += 1;
    Tts.stop().catch((e: unknown) => {
      selfCancelsRef.current = Math.max(0, selfCancelsRef.current - 1);
      log.warn('Tts.stop failed', { error: String(e) });
    });
  }, []);

  const speak = useCallback(
    (messageId: string, text: string, lang: Lang): void => {
      const replacing = playbackRef.current !== null;

      playbackRef.current = { messageId, text, lang, base: 0, segmentOffset: 0 };
      setActiveMessageId(messageId);
      setStatus('speaking');

      selfCancelsRef.current = 0;
      if (replacing) {
        // Clear whatever was mid-utterance before queuing this one.
        stopEngine();
      }
      startUtterance(messageId, text, lang);
    },
    [startUtterance, stopEngine],
  );

  const pause = useCallback((): void => {
    const playback = playbackRef.current;
    if (playback === null) {
      return;
    }
    // Fold the current segment's progress into the running total, so resume
    // knows where to pick the narration back up.
    playback.base += playback.segmentOffset;
    playback.segmentOffset = 0;
    setStatus('paused');
    stopEngine();
  }, [stopEngine]);

  const resume = useCallback((): void => {
    const playback = playbackRef.current;
    if (playback === null) {
      return;
    }
    const remainder = playback.text.slice(playback.base);
    if (remainder.trim().length === 0) {
      // Paused on the last syllable — nothing left to say.
      clearPlayback();
      return;
    }
    playback.segmentOffset = 0;
    setStatus('speaking');
    selfCancelsRef.current = 0;
    startUtterance(playback.messageId, remainder, playback.lang);
  }, [clearPlayback, startUtterance]);

  const stop = useCallback((): void => {
    const wasPlaying = playbackRef.current !== null;
    clearPlayback();
    if (wasPlaying) {
      stopEngine();
    }
  }, [clearPlayback, stopEngine]);

  const toggle = useCallback(
    (messageId: string, text: string, lang: Lang): void => {
      if (playbackRef.current?.messageId !== messageId) {
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
