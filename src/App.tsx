import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runSecurityChecks, INTEGRITY_FAIL_MESSAGE } from '@utils/security';
import { initializeAppCheckService } from './firebase/appCheck';
import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider, applyLayoutDirection, readPersistedLang } from '@i18n/I18nProvider';
import RootNavigator from './navigation/RootNavigator';
import ErrorBoundary from './components/ErrorBoundary';

// Re-sync native layout direction to the persisted language BEFORE the first
// render. I18nManager.forceRTL persists natively, but this makes the persisted
// language authoritative on every cold start and self-heals any RTL/lang
// divergence — otherwise a stored Urdu user could get Urdu text in an LTR
// layout. Idempotent: applyLayoutDirection only forces when the direction
// actually differs. Runs at module load, the earliest JS point before render.
applyLayoutDirection(readPersistedLang());

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
  useEffect(() => {
    try {
      initializeAppCheckService();
    } catch (e) {
      console.error('App Check Initialization Failed:', e);
    }
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
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <I18nProvider>
            <RootNavigator />
          </I18nProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

// This gate renders above ThemeProvider, so it cannot read theme context.
// Colors are pinned to the canonical darAlShams palette (src/theme/themes.ts)
// so even the integrity-failure screen reads as the obsidian / gold manuscript.
const styles = StyleSheet.create({
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
