import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import appCheck from '@react-native-firebase/app-check';

import { ThemeProvider, readPersistedThemeId } from '@theme/ThemeProvider';
import { I18nProvider, readPersistedLang, applyLayoutDirection } from '@i18n/I18nProvider';
import RootNavigator from '@navigation/RootNavigator';
import { runSecurityChecks, INTEGRITY_FAIL_MESSAGE } from '@utils/security';

// Initialise App Check before any Firebase service is used.
// Debug token is only injected in __DEV__ builds; production uses Play Integrity.
// Register the debug token in Firebase Console → App Check → Manage debug tokens.
const _rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
_rnfbProvider.configure({
  android: {
    provider: __DEV__ ? 'debug' : 'playIntegrity',
    debugToken: '0D11B4D0-FAD0-4C92-B580-6315423E181F',
  },
  apple: {
    provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
  },
  web: { provider: 'reCaptchaV3', siteKey: 'unused' },
});
appCheck().initializeAppCheck({ provider: _rnfbProvider, isTokenAutoRefreshEnabled: true });

// Apply RTL layout direction synchronously before React tree mounts.
const _initialLang = readPersistedLang();
applyLayoutDirection(_initialLang);
const _initialThemeId = readPersistedThemeId();

const styles = StyleSheet.create({
  root: { flex: 1 },
  failRoot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  failText: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default function App(): React.ReactElement {
  const [securityPassed, setSecurityPassed] = useState<boolean | null>(null);

  useEffect(() => {
    const result = runSecurityChecks();
    setSecurityPassed(result.passed);
  }, []);

  // While checks run (synchronous, but deferred to after first paint), show nothing.
  if (securityPassed === null) {
    return (
      <View style={styles.failRoot}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      </View>
    );
  }

  // Hard-fail: blank screen with generic message. Never name the check.
  if (!securityPassed) {
    return (
      <View style={styles.failRoot}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Text style={styles.failText}>{INTEGRITY_FAIL_MESSAGE}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider initialThemeId={_initialThemeId}>
        <I18nProvider initialLang={_initialLang}>
          <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
          <RootNavigator />
        </I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
