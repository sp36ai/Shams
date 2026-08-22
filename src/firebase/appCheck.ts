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
 * Result of a getAppCheckToken() call. Discriminated on `ok` so callers can
 * tell "no token, no error" apart from "token fetch threw: <reason>" instead
 * of both collapsing into a bare `undefined` — see the note below.
 */
export type AppCheckTokenResult = { ok: true; token: string } | { ok: false; error: string };

/**
 * Manually retrieves the current App Check token.
 * Useful for debugging or forcing a refresh if a request fails.
 *
 * This used to swallow any rejection from getToken() into a bare
 * `console.error` + `undefined` return — invisible in a production build
 * (no Crashlytics record, no console access on a shipped APK), and
 * indistinguishable from "App Check hasn't produced a token yet" to any
 * caller. That is exactly what was collapsing real Play Integrity/
 * attestation rejections into the generic "empty/undefined" reading in the
 * askWatchOracle diagnostic probe (OracleChatScreen.tsx), even after
 * initializeAppCheckService() was fixed to stop swallowing its own init
 * rejection (see appCheck.ts init above) — that fix only covers the
 * initializeAppCheck() call, not this separate getToken() call. Mirror the
 * same pattern here: record the real error to Crashlytics and hand callers
 * the actual reason instead of throwing it away.
 */
export const getAppCheckToken = async (forceRefresh = false): Promise<AppCheckTokenResult> => {
  try {
    const result = await firebase.appCheck().getToken(forceRefresh);
    return { ok: true, token: result.token };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    crashlytics().log('[App Check] getToken() rejected — see recorded error for the reason');
    crashlytics().recordError(err);
    return { ok: false, error: err.message };
  }
};
