import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runSecurityChecks, INTEGRITY_FAIL_MESSAGE } from '@utils/security';
import { initializeAppCheckService } from './firebase/appCheck';
import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider } from '@i18n/I18nProvider';
import RootNavigator from './navigation/RootNavigator';

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
        <StatusBar barStyle="light-content" backgroundColor="#030E10" />
        <Text style={styles.errorTitle}>Integrity Error</Text>
        <Text style={styles.errorMessage}>{INTEGRITY_FAIL_MESSAGE}</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <I18nProvider>
          <RootNavigator />
        </I18nProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#030E10', // Matches theme.colors.bg
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    color: '#FF4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default App;
