import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runSecurityChecks, INTEGRITY_FAIL_MESSAGE } from '@utils/security';
import { ensureAppCheckReady } from './firebase/appCheck';
import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider } from '@i18n/I18nProvider';
import RootNavigator from './navigation/RootNavigator';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Entry point for Shams Al-Asrar.
 * Handles critical boot-time security and environment setup:
 * 1. Device integrity/security checks (Root/Jailbreak/Tampering)
 * 2. Firebase App Check initialization for backend enforcement
 */
const App: React.FC = () => {
  const [securityPassed, setSecurityPassed] = useState(true);

  // 1. Immediate Integrity Check
  // This runs before the navigation tree mounts to prevent unauthorized access
  // or UI flickering on compromised devices.
  useEffect(() => {
    const result = runSecurityChecks();
    if (!result.passed) {
      console.error('Security Integrity Check Failed:', result.reason);
      setSecurityPassed(false);
    }
  }, []);

  // 2. Initialize Firebase App Check
  // Required to satisfy backend enforcement for Cloud Functions (e.g., askOracle).
  // MUST be awaited/caught here — initializeAppCheckService() previously fired
  // this without awaiting it at all, so a rejected native init became a
  // silent unhandled promise rejection: nothing logged, App Check left
  // uninitialized for the whole session, and every callable Cloud Function
  // (askWatchOracle, getQuota, purchases, trial activation — all of them
  // enforce App Check) failed as an 'unauthenticated' rejection with no
  // record anywhere of why. crashlytics().recordError() runs inside the
  // service itself; this catch just stops it from being a truly silent,
  // untracked promise rejection at the call site too.
  useEffect(() => {
    ensureAppCheckReady().catch(e => {
      console.error('App Check Initialization Failed:', e);
    });
  }, []);

  // Terminal Safety Gate: If integrity fails, we show a non-bypassable error view.
  if (!securityPassed) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={styles.errorContainer.backgroundColor}
        />
        <Text style={styles.errorTitle}>Integrity Error</Text>
        <Text style={styles.errorMessage}>{INTEGRITY_FAIL_MESSAGE}</Text>
      </View>
    );
  }

  return (
    // react-native-gesture-handler v2 requires the app root to be wrapped in
    // GestureHandlerRootView on Android — without it, react-native-screens
    // (which both @react-navigation/native-stack and bottom-tabs use under
    // the hood) can silently stop delivering touch events to JS entirely:
    // no crash, no error, screens keep rendering, nothing responds to taps.
    // This was missing, which is consistent with reports of the whole app
    // (tab bar included) going dead on an Android release build.
    <GestureHandlerRootView style={styles.gestureRoot}>
      <ErrorBoundary>
        <ThemeProvider>
          <SafeAreaProvider>
            <I18nProvider>
              <RootNavigator />
            </I18nProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
};

// This gate renders above ThemeProvider, so it cannot read theme context.
// Colors are pinned to the canonical darAlShams palette (src/theme/themes.ts)
// so even the integrity-failure screen reads as the obsidian / gold manuscript.
const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F', // darAlShams.bg
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    color: '#E8C77D', // goldBright
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.8,
  },
  errorMessage: {
    color: '#F4EFE3', // text
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default App;
