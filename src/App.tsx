import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, readPersistedThemeId } from '@theme/ThemeProvider';
import { I18nProvider, readPersistedLang, applyLayoutDirection } from '@i18n/I18nProvider';
import RootNavigator from '@navigation/RootNavigator';
import { runSecurityChecks, INTEGRITY_FAIL_MESSAGE } from '@utils/security';
import { initializeAppCheck } from './firebase/appCheck';

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
    void initializeAppCheck().catch((e: unknown) => {
      console.warn('[AppCheck] init error (non-fatal during bootstrap):', e);
    });
  }, []);

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
