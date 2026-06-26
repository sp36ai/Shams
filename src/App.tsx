import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runSecurityChecks, INTEGRITY_FAIL_MESSAGE } from '@utils/security';
import { initializeAppCheckService } from './firebase/appCheck';
import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider } from '@i18n/I18nProvider';
import RootNavigator from './navigation/RootNavigator';

// Inline diagnostic boundary — shows full crash stack on screen.
// Remove before production release.
class DiagnosticErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#030E10" />
          <Text style={styles.errorTitle}>Crash Report</Text>
          <ScrollView>
            <Text style={styles.errorMessage}>
              {this.state.error.message}{'\n\n'}{this.state.error.stack}
            </Text>
          </ScrollView>
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
    <DiagnosticErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <I18nProvider>
            <RootNavigator />
          </I18nProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </DiagnosticErrorBoundary>
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
