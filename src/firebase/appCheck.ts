import { firebase } from '@react-native-firebase/app-check';

/**
 * Initializes Firebase App Check for the native application.
 *
 * This satisfies the 'enforceAppCheck' requirement in your Cloud Functions.
 * In production, this utilizes the Play Integrity provider on Android.
 */
export const initializeAppCheckService = () => {
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
      web: { provider: 'recaptchaEnterprise', siteKey: '6LebYN0sAAAAAJ8NNyk7bgEB1EA7AB-sQV3yxOsR' },
    });
  }

  appCheck.initializeAppCheck({ provider, isTokenAutoRefreshEnabled: true });
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
