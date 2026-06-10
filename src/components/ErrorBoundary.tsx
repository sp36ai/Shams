import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary. Catches render-phase errors anywhere in the
 * component tree, reports them to Crashlytics, and shows a recoverable
 * fallback instead of a white screen.
 */
class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    crashlytics().recordError(error, errorInfo.componentStack ?? undefined);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#030E10" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            An unexpected error occurred. The issue has been reported automatically.
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry} testID="error-retry-btn">
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030E10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    color: '#FF4444',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1F3A3D',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
