import { firebase } from '@react-native-firebase/app-check';
import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Initializes Firebase App Check for the native application.
 *
 * This satisfies the 'enforceAppCheck' requirement in your Cloud Functions.
 * In production, this utilizes the Play Integrity provider on Android.
 *
 * Returns the Promise from initializeAppCheck() — callers MUST await/handle
 * it. It used to be fired without awaiting or catching: if the native
 * Play Integrity setup rejected internally, that became a silent unhandled
 * promise rejection with nothing logged anywhere, App Check left permanently
 * uninitialized for the rest of the session, and every later getToken() call
 * resolved with an EMPTY token instead of throwing — indistinguishable, from
 * the callable SDK's rejection alone, from a real auth failure. That gap is
 * exactly what routed a broken App Check init into "please sign in" on the
 * Ask screen for a user who was, in fact, signed in.
 */
export const initializeAppCheckService = async (): Promise<void> => {
  const appCheck = firebase.appCheck();

  appCheck.setTokenAutoRefreshEnabled(true);

  const provider = appCheck.newReactNativeFirebaseAppCheckProvider();

  if (__DEV__) {
    provider.configure({
      android: { provider: 'debug' },
      apple: { provider: 'debug' },
      web: { provider: 'debug', siteKey: 'none' },
    });
  } else {
    provider.configure({
      android: { provider: 'playIntegrity' },
      apple: { provider: 'appAttestWithDeviceCheckFallback' },
      web: { provider: 'reCaptchaEnterprise', siteKey: '6LebYN0sAAAAAJ8NNyk7bgEB1EA7AB-sQV3yxOsR' },
    });
  }

  try {
    await appCheck.initializeAppCheck({ provider, isTokenAutoRefreshEnabled: true });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    crashlytics().log(
      '[App Check] initializeAppCheck() rejected — App Check will not attach tokens this session',
    );
    crashlytics().recordError(err);
    throw err;
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
