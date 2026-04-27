/**
 * Permissions utility — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Single entry point for ALL Android runtime permission requests. Centralized
 * because:
 *
 *   - Android 6.0+ (API 23) requires runtime grant for dangerous permissions
 *     even though they're declared in AndroidManifest.xml.
 *   - Android 12+ (API 31) splits LOCATION into FINE / COARSE — the user
 *     can grant only COARSE even when we asked for FINE.
 *   - Android 14+ (API 34, our targetSdk) shows a separate "limited" picker
 *     for partial-access grants — UI must handle it gracefully.
 *
 * Returns a discriminated union so call sites pattern-match cleanly:
 *
 *     const r = await requestLocationPermission();
 *     switch (r.status) {
 *       case 'granted-fine':   // proceed with full accuracy
 *       case 'granted-coarse': // proceed with reduced accuracy
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
  | 'granted-fine' // ACCESS_FINE_LOCATION granted (sub-meter accuracy)
  | 'granted-coarse' // Only ACCESS_COARSE_LOCATION (~1km accuracy — too coarse for KP horary, but better than nothing)
  | 'denied' // User dismissed the dialog this session
  | 'never-ask' // User checked "Don't ask again" — only Settings can re-enable
  | 'unavailable'; // Non-Android platform OR hardware lacks GPS

export interface LocationPermissionResult {
  status: LocationPermissionStatus;
  /** True if user can be re-prompted in-app; false means we must redirect to Settings */
  canRequestAgain: boolean;
}

// ── Implementation ─────────────────────────────────────────────────────────

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!;
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
    const fine = await PermissionsAndroid.check(FINE);
    if (fine) {
      return { status: 'granted-fine', canRequestAgain: false };
    }

    const coarse = await PermissionsAndroid.check(COARSE);
    if (coarse) {
      return { status: 'granted-coarse', canRequestAgain: true };
    }

    // Neither granted — we don't know yet whether user previously hit "never".
    // PermissionsAndroid.check() can't distinguish denied vs never-ask without
    // attempting the request. Caller should treat this as "needs prompt".
    return { status: 'denied', canRequestAgain: true };
  } catch (e) {
    log.error('checkLocationPermission threw', { error: String(e) });
    return { status: 'unavailable', canRequestAgain: false };
  }
}

/**
 * Request location permission, showing the system dialog. Always asks for
 * FINE; the system may grant only COARSE if the user picks the "Approximate"
 * option in the Android 12+ picker.
 */
export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  if (Platform.OS !== 'android') {
    return { status: 'unavailable', canRequestAgain: false };
  }

  try {
    // Request both — Android handles bundling and shows the unified picker
    // on API 31+. On older APIs each is requested in sequence with two dialogs.
    const results = await PermissionsAndroid.requestMultiple([FINE, COARSE]);

    const fineResult = results[FINE];
    const coarseResult = results[COARSE];

    log.debug('requestLocationPermission result', { fine: fineResult, coarse: coarseResult });

    if (fineResult === RESULT_GRANTED) {
      return { status: 'granted-fine', canRequestAgain: false };
    }
    if (coarseResult === RESULT_GRANTED) {
      return { status: 'granted-coarse', canRequestAgain: true };
    }

    // Neither granted — figure out whether we can re-prompt.
    if (fineResult === RESULT_NEVER_ASK || coarseResult === RESULT_NEVER_ASK) {
      return { status: 'never-ask', canRequestAgain: false };
    }
    if (fineResult === RESULT_DENIED || coarseResult === RESULT_DENIED) {
      return { status: 'denied', canRequestAgain: true };
    }

    // Defensive fallback — unexpected result string
    log.warn('requestLocationPermission unexpected result', {
      fine: fineResult,
      coarse: coarseResult,
    });
    return { status: 'denied', canRequestAgain: true };
  } catch (e) {
    log.error('requestLocationPermission threw', { error: String(e) });
    return { status: 'unavailable', canRequestAgain: false };
  }
}

/**
 * Convenience: returns true if the current state is sufficient for the
 * engine to proceed (i.e. either FINE or COARSE granted). The engine
 * accepts COARSE because horary cusps are stable to within ~0.25° at
 * coarse-location accuracy, well within the noise floor of question-time
 * uncertainty.
 */
export function isLocationUsable(status: LocationPermissionStatus): boolean {
  return status === 'granted-fine' || status === 'granted-coarse';
}
