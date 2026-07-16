import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, StatusBar } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
}

/**
 * Top-level error boundary. Catches render-phase errors anywhere in the
 * component tree, reports them to Crashlytics, and shows a recoverable
 * fallback instead of a white screen.
 */
class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: null, errorStack: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message, errorStack: error.stack ?? null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    crashlytics().recordError(error, errorInfo.componentStack ?? undefined);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: null, errorStack: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor={styles.container.backgroundColor} />
          <Text style={styles.title}>The veil trembled</Text>
          <Text style={styles.message}>
            Something interrupted the reading. It has been recorded, and the oracle awaits your
            return.
          </Text>
          {/* Raw error text + stack are shown ONLY in development. In production
              they would leak internal details to the user and read as an
              off-brand technical dump at the worst possible moment. */}
          {__DEV__ && this.state.errorMessage !== null && (
            <ScrollView style={styles.detailsBox}>
              <Text selectable style={styles.detailsText}>
                {this.state.errorMessage}
                {this.state.errorStack ? `\n\n${this.state.errorStack}` : ''}
              </Text>
            </ScrollView>
          )}
          <Pressable style={styles.button} onPress={this.handleRetry} testID="error-retry-btn">
            <Text style={styles.buttonText}>Return</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// This component sits ABOVE ThemeProvider in the tree (App.tsx), so it cannot
// read theme context via hooks. Colors are pinned to the canonical darAlShams
// palette (see src/theme/themes.ts) so the crash fallback still reads as the
// obsidian / illuminated-gold manuscript rather than a generic error page.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F', // themes.ts darAlShams.bg
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    color: '#E8C77D', // goldBright
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  message: {
    color: '#F4EFE3', // text
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  detailsBox: {
    maxHeight: 220,
    width: '100%',
    backgroundColor: '#1A1A26', // surfaceElevated
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  detailsText: {
    color: '#A89F8C', // textMuted
    fontSize: 12,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#C9A961', // primary
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    color: '#1A1308', // textOnPrimary
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
});

export default ErrorBoundary;
