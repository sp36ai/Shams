import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runSecurityChecks, INTEGRITY_FAIL_MESSAGE } from '@utils/security';
import { initializeAppCheckService } from './firebase/appCheck';
import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider } from '@i18n/I18nProvider';
import RootNavigator from './navigation/RootNavigator';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#030E10" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            Please close and reopen the app. If the issue persists, contact support.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [securityPassed, setSecurityPassed] = useState(true);

  useEffect(() => {
    const result = runSecurityChecks();
    if (!result.passed) {
      console.error('Security Integrity Check Failed:', result.reason);
      setSecurityPassed(false);
    }
  }, []);

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

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#030E10',
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
    fontSize: 12,
    textAlign: 'left',
    lineHeight: 18,
  },
});

export default App;
