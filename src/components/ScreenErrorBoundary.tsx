/**
 * ScreenErrorBoundary — a crash in one screen must not take the app down.
 * --------------------------------------------------------------------------
 * The app has always had a single ErrorBoundary, at the root above
 * NavigationContainer. That placement means ANY render-phase throw — in one
 * screen, in one hook, in one native module that failed to link — unmounts the
 * entire navigation tree. The seeker loses the tab bar, the back button, and
 * their place in the app; "Retry" remounts everything from Splash. One screen
 * failing therefore looked exactly like the whole app failing, which is what
 * made "the Ask button gives an error" so hard to place: the fallback never
 * said which screen had thrown.
 *
 * This boundary wraps each screen individually, INSIDE the navigator. When a
 * screen throws:
 *   - the navigator survives, so the header, the back gesture and the tab bar
 *     all keep working and the seeker can leave;
 *   - the fallback names the screen and shows the real error message, so a
 *     failure in the field can be reported without a debug build;
 *   - Retry remounts that screen alone.
 *
 * The root boundary stays where it is: it still catches anything thrown by the
 * providers or the navigator itself, which no per-screen boundary can see.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';

interface Props {
  /** Route name, so the fallback and the crash report both say where. */
  screenName: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
  stack: string | null;
}

class ScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: null, stack: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message, stack: error.stack ?? null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Prefixed with the screen so Crashlytics groups by where it happened,
    // not by whichever shared hook happens to be on the stack.
    crashlytics().log(`screen-crash: ${this.props.screenName}`);
    crashlytics().recordError(error, info.componentStack ?? undefined);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: null, stack: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>This screen could not open</Text>
        <Text style={styles.message}>
          Something interrupted {this.props.screenName}. It has been recorded. You can go back and
          try again.
        </Text>

        <Pressable
          onPress={this.handleRetry}
          style={styles.retryBtn}
          accessibilityRole="button"
          testID="screen-error-retry"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>

        {/* The real message, always visible: a fallback that hides what broke
            is why this failure went unexplained for so long. */}
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
          <Text style={styles.detailText} selectable>
            {this.state.message ?? 'No error message'}
          </Text>
          {this.state.stack !== null && (
            <Text style={styles.stackText} selectable>
              {this.state.stack}
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }
}

/**
 * Wrap a screen component for use in a navigator. Applied at the navigator so
 * every route is covered by construction — a screen added later cannot forget
 * to opt in, because it is the navigator that opts it in.
 */
export function withScreenErrorBoundary<P extends object>(
  Screen: React.ComponentType<P>,
  screenName: string,
): React.FC<P> {
  const Wrapped: React.FC<P> = props => (
    <ScreenErrorBoundary screenName={screenName}>
      <Screen {...props} />
    </ScreenErrorBoundary>
  );
  Wrapped.displayName = `withScreenErrorBoundary(${screenName})`;
  return Wrapped;
}

// Colors are pinned rather than read from ThemeProvider: this renders when a
// screen has already failed, and a boundary that needs context to draw itself
// can fail for the same reason its child did.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 28,
    paddingTop: 80,
  },
  title: {
    color: '#E8C77D',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  message: {
    color: '#F4EFE3',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderColor: '#E8C77D',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 24,
  },
  retryText: {
    color: '#E8C77D',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 40,
  },
  detailText: {
    color: '#F4EFE3',
    fontSize: 13,
    marginBottom: 12,
  },
  stackText: {
    color: '#8A8598',
    fontSize: 11,
    lineHeight: 16,
  },
});

export default ScreenErrorBoundary;
