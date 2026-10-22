/**
 * Permissions utility — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Single entry point for ALL Android runtime permission requests. Centralized
 * because:
 *
 *   - Android 6.0+ (API 23) requires runtime grant for dangerous permissions
 *     even though they're declared in AndroidManifest.xml.
 *   - Location is approximate only: the app declares and requests just
 *     ACCESS_COARSE_LOCATION (owner decision 2026-10-22). It drives only the
 *     on-device sky display, never a reading, and approximate accuracy is
 *     enough for it (src/utils/__tests__/approximateLocation.test.ts).
 *
 * Returns a discriminated union so call sites pattern-match cleanly:
 *
 *     const r = await requestLocationPermission();
 *     switch (r.status) {
 *       case 'granted':        // approximate location available
 *       case 'denied':         // user said no — show rationale + Settings link
 *       case 'never-ask':      // permanently denied — only Settings can re-enable
 *       case 'unavailable':    // device has no GPS hardware
 *     }
 *
 * This module uses `PermissionsAndroid` directly. Reasons:
 *   - It pulls in iOS-specific native modules that bloat the Android APK.
 *   - It auto-links and breaks RN 0.74 autolink config in non-trivial ways.
 *   - Stock `PermissionsAndroid` covers everything we need for Android-only.
 *
 * If iOS support is added later (not in scope), we revisit this decision.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { createLogger } from '@utils/logger';

const log = createLogger('Permissions');

// ── Public types ───────────────────────────────────────────────────────────

export type LocationPermissionStatus =
  | 'granted' // ACCESS_COARSE_LOCATION granted (approximate, ~3 km²)
  | 'denied' // User dismissed the dialog this session
  | 'never-ask' // User checked "Don't ask again" — only Settings can re-enable
  | 'unavailable'; // Non-Android platform OR hardware lacks GPS

export interface LocationPermissionResult {
  status: LocationPermissionStatus;
  /** True if user can be re-prompted in-app; false means we must redirect to Settings */
  canRequestAgain: boolean;
}

// ── Implementation ─────────────────────────────────────────────────────────

const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION!;

const RESULT_GRANTED = PermissionsAndroid.RESULTS.GRANTED;
const RESULT_DENIED = PermissionsAndroid.RESULTS.DENIED;
const RESULT_NEVER_ASK = PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

/**
 * Check current location permission state WITHOUT prompting the user.
 * Use this on screen mount to decide whether to skip straight to the next
 * step or show the rationale.
 */
export async function checkLocationPermission(): Promise<LocationPermissionResult> {
  if (Platform.OS !== 'android') {
    return { status: 'unavailable', canRequestAgain: false };
  }

  try {
    const coarse = await PermissionsAndroid.check(COARSE);
    if (coarse) {
      return { status: 'granted', canRequestAgain: false };
    }

    // Not granted — we don't know yet whether user previously hit "never".
    // PermissionsAndroid.check() can't distinguish denied vs never-ask without
    // attempting the request. Caller should treat this as "needs prompt".
    return { status: 'denied', canRequestAgain: true };
  } catch (e) {
    log.error('checkLocationPermission threw', { error: String(e) });
    return { status: 'unavailable', canRequestAgain: false };
  }
}

/**
 * Request approximate location, showing the system dialog. Only
 * ACCESS_COARSE_LOCATION is requested, so Android never offers "Precise".
 */
export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  if (Platform.OS !== 'android') {
    return { status: 'unavailable', canRequestAgain: false };
  }

  try {
    const result = await PermissionsAndroid.request(COARSE);

    log.debug('requestLocationPermission result', { coarse: result });

    if (result === RESULT_GRANTED) {
      return { status: 'granted', canRequestAgain: false };
    }
    if (result === RESULT_NEVER_ASK) {
      return { status: 'never-ask', canRequestAgain: false };
    }
    if (result === RESULT_DENIED) {
      return { status: 'denied', canRequestAgain: true };
    }

    // Defensive fallback — unexpected result string
    log.warn('requestLocationPermission unexpected result', { coarse: result });
    return { status: 'denied', canRequestAgain: true };
  } catch (e) {
    log.error('requestLocationPermission threw', { error: String(e) });
    return { status: 'unavailable', canRequestAgain: false };
  }
}

/**
 * Convenience: true if a location can be read for the sky display.
 */
export function isLocationUsable(status: LocationPermissionStatus): boolean {
  return status === 'granted';
}

// ── Microphone (Oracle Chat voice input) ────────────────────────────────────

export type MicrophonePermissionStatus = 'granted' | 'denied' | 'never-ask' | 'unavailable';

const RECORD_AUDIO = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!;

/** Check current mic permission WITHOUT prompting — safe to call on mount. */
export async function checkMicrophonePermission(): Promise<MicrophonePermissionStatus> {
  if (Platform.OS !== 'android') {
    return 'unavailable';
  }
  try {
    const granted = await PermissionsAndroid.check(RECORD_AUDIO);
    return granted ? 'granted' : 'denied';
  } catch (e) {
    log.error('checkMicrophonePermission threw', { error: String(e) });
    return 'unavailable';
  }
}

/** Request mic permission, showing the system dialog if not already decided. */
export async function requestMicrophonePermission(): Promise<MicrophonePermissionStatus> {
  if (Platform.OS !== 'android') {
    return 'unavailable';
  }
  try {
    const result = await PermissionsAndroid.request(RECORD_AUDIO);
    if (result === RESULT_GRANTED) {
      return 'granted';
    }
    if (result === RESULT_NEVER_ASK) {
      return 'never-ask';
    }
    return 'denied';
  } catch (e) {
    log.error('requestMicrophonePermission threw', { error: String(e) });
    return 'unavailable';
  }
}
