/**
 * haptics — the app's one reserved custom haptic pattern.
 * --------------------------------------------------------------------------
 * Per the visual specification's §08: the entire app has exactly one
 * custom-designed haptic pattern, reserved for verdict arrival. Every other
 * touchpoint (voice start/stop, send, error) uses the platform's own stock
 * feedback constant, never a second bespoke pattern — this file exists to
 * make that impossible to violate accidentally, by only exporting the one
 * named function the spec allows.
 *
 * A static `import { trigger } from 'react-native-haptic-feedback'` was
 * tried first and broke two test suites (ChatBubble.test.ts,
 * ReadingScreen.test.tsx) with a real, caught regression: this library's
 * native module is TurboModule-registered, and `TurboModuleRegistry
 * .getEnforcing()` throws SYNCHRONOUSLY at import time when the module isn't
 * linked (Jest's environment, or a device where autolinking hasn't run) —
 * unlike `react-native-tts`, which uses the older bridge and returns
 * `undefined` instead of throwing, which is why `useTextToSpeech.ts`'s
 * static-import safety check works for that library and would not have
 * worked here. A `require()` deferred inside `ensureHaptics()`, wrapped in
 * try/catch, is what actually catches it — a static `import` at the top of
 * this file cannot be, no matter how the check below it is written.
 */
import { createLogger } from './logger';

const log = createLogger('Haptics');

type TriggerFn = (
  type: string,
  options?: { enableVibrateFallback?: boolean; ignoreAndroidSystemSettings?: boolean },
) => void;

let triggerFn: TriggerFn | null | undefined; // undefined = not yet resolved, null = unavailable

function ensureHaptics(): TriggerFn | null {
  if (triggerFn !== undefined) {
    return triggerFn;
  }
  try {
    // Deliberately deferred (not a static import) — see file header.
    const mod = require('react-native-haptic-feedback');
    const resolved = (mod?.trigger ?? mod?.default?.trigger) as TriggerFn | undefined;
    triggerFn = typeof resolved === 'function' ? resolved : null;
  } catch (e) {
    log.warn('react-native-haptic-feedback unavailable — haptics disabled', { error: String(e) });
    triggerFn = null;
  }
  return triggerFn;
}

function safeTrigger(type: 'impactLight' | 'impactMedium'): void {
  const fn = ensureHaptics();
  if (fn === null) {
    return;
  }
  try {
    fn(type, { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
  } catch (e) {
    log.warn('haptic trigger failed', { type, error: String(e) });
  }
}

/**
 * The verdict-arrival two-stage pattern (§08, §12): light impact as the
 * reading surface settles, medium impact ~230ms later as the verdict text
 * completes its own reveal — a short enough gap to read as one gesture, long
 * enough to feel like two distinct beats rather than a single buzz.
 *
 * Fire this and only this for the verdict. No other call site in the app
 * should introduce a second custom pattern — use the platform's stock
 * feedback (a plain `trigger('impactLight')` at the point of interaction)
 * for everything else instead.
 */
export function fireVerdictHaptic(): void {
  safeTrigger('impactLight');
  setTimeout(() => safeTrigger('impactMedium'), 230);
}
