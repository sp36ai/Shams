import { firebase } from '@react-native-firebase/app-check';

/**
 * Initializes Firebase App Check for the native application.
 * 
 * This satisfies the 'enforceAppCheck' requirement in your Cloud Functions.
 * In production, this utilizes the Play Integrity provider on Android.
 */
export const initializeAppCheckService = () => {
  const appCheck = firebase.appCheck();

  // Enable automatic token refreshing. This is critical to ensure that
  // Cloud Function calls always have a valid attestation token available.
  appCheck.setTokenAutoRefreshEnabled(true);

  if (__DEV__) {
    // Support for local testing via debug token (Issue #10)
    // The token is typically retrieved from the Firebase Console or Logcat.
    // @ts-ignore - window.FIREBASE_APPCHECK_DEBUG_TOKEN is used by the underlying SDK
    if (global.FIREBASE_APPCHECK_DEBUG_TOKEN) {
      console.log('[App Check] Using provided debug token for development.');
    }
    // In development mode, the SDK looks for a debug token.
    // Register the debug token found in the Android Logcat/logs in the 
    // Firebase Console (App Check > Manage Debug Tokens).
    console.log('[App Check] Service initialized in DEBUG mode.');
  } else {
    console.log('[App Check] Service initialized in PRODUCTION mode (Play Integrity).');
  }
};

/**
 * Manually retrieves the current App Check token.
 * Useful for debugging or forcing a refresh if a request fails.
 */
export const getAppCheckToken = async (forceRefresh = false): Promise<string | undefined> => {
  try {
    const result = await firebase.appCheck().getToken(forceRefresh);
    return result.token;
  } catch (error) {
    console.error('[App Check] Failed to get token:', error);
    return undefined;
  }
};