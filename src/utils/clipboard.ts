/**
 * clipboard — copy text, with a short on-screen confirmation.
 * --------------------------------------------------------------------------
 * Uses React Native's built-in Clipboard. It is deprecated in favour of
 * @react-native-clipboard/clipboard but still ships in 0.78 and 0.79; using
 * it avoids adding a native dependency for one call. This wrapper is the only
 * place that touches it, so swapping to the community module later is a
 * one-file change.
 *
 * Android-only app: the confirmation is a ToastAndroid; elsewhere it is
 * skipped. A copy failure is swallowed — failing to copy must never break
 * the conversation screen.
 */

import { Clipboard, Platform, ToastAndroid } from 'react-native';

export function copyText(text: string, confirmation: string): void {
  try {
    Clipboard.setString(text);
  } catch {
    return;
  }
  if (Platform.OS === 'android') {
    ToastAndroid.show(confirmation, ToastAndroid.SHORT);
  }
}
