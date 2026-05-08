import appCheck from '@react-native-firebase/app-check';

/**
 * Initializes Firebase App Check for Android.
 * In Development: Uses the Debug Provider.
 * In Production: Uses Play Integrity.
 */
export async function initializeAppCheck() {
  const provider = appCheck().newReactNativeFirebaseAppCheckProvider();

  provider.configure({
    android: {
      // Use Play Integrity for production, Debug for emulators
      provider: __DEV__ ? 'debug' : 'playIntegrity',
    },
  });

  await appCheck().initializeAppCheck({
    provider,
    isTokenAutoRefreshEnabled: true,
  });

  if (__DEV__) {
    console.warn(
      '[Shams][AppCheck] Debugging enabled. Ensure your debug token is registered in the Firebase Console.',
    );
  }
}
