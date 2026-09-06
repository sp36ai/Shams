/**
 * RootNavigator — top-level navigation graph.
 * --------------------------------------------------------------------------
 * State machine (in order):
 *   1. Splash (always shown, min 2.5s brand moment)
 *   2. Auth   (if user is not signed in)
 *   3. LocationPermission (first launch after auth if not yet prompted)
 *   4. Main   (bottom tabs: Home | Al-Falak | Readings) — and, in the SAME
 *              group, the three screens pushed over it: Reading, Settings
 *              and Premium.
 *
 * WHY THE PUSHED SCREENS SIT INSIDE THE AUTHENTICATED GROUP
 *   They used to be registered unconditionally, as siblings of whichever
 *   gate screen was showing. That looked harmless and was not: signing out
 *   from Settings flips `isAuthenticated`, which swaps Main for Auth — but
 *   Settings itself stayed registered and stayed on top of the stack, so the
 *   seeker signed out and went on looking at their own settings page, over an
 *   Auth screen they could not see. Same for Reading and Premium. Registering
 *   them in the group means losing auth unmounts them, and the seeker lands
 *   where they should: on Auth.
 *
 * EVERY SCREEN IS INDIVIDUALLY BOUNDED
 *   withScreenErrorBoundary() wraps each route here rather than in the screen
 *   files, so a screen added later is covered by construction. Without it, one
 *   screen throwing during render unmounted the whole NavigationContainer via
 *   the root boundary: no tab bar, no back button, no way out but a restart.
 *
 * WHY THE PUSHED SCREENS SIT INSIDE THE AUTHENTICATED GROUP
 *   They used to be registered unconditionally, as siblings of whichever gate
 *   screen was showing. That looked harmless and was not: signing out from
 *   Settings flips `isAuthenticated`, which swaps Main for Auth — but Settings
 *   itself stayed registered and stayed on top of the stack, so the seeker
 *   signed out and went on looking at their own settings page, over an Auth
 *   screen they could not see. Same for Oracle Chat and Premium. Registering
 *   them in the group means losing auth unmounts them, and the seeker lands
 *   where they should: on Auth.
 *
 * EVERY SCREEN IS INDIVIDUALLY BOUNDED
 *   withScreenErrorBoundary() wraps each route here rather than in the screen
 *   files, so a screen added later is covered by construction. Without it, one
 *   screen throwing during render unmounted the whole NavigationContainer via
 *   the root boundary: no tab bar, no back button, no way out but a restart —
 *   which made one broken screen indistinguishable from a broken app.
 *
 * Firebase Auth bootstrap is awaited asynchronously via onAuthStateChanged;
 * while it resolves we stay on Splash so the user never sees a flash of the
 * Auth screen before session restoration completes. The auth gate is enforced
 * on every cold start via authStore.bootstrap().
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  NavigationContainer,
  type Theme as NavTheme,
  DefaultTheme as NavDefaultTheme,
  DarkTheme as NavDarkTheme,
} from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '@screens/SplashScreen';
import AuthScreen from '@screens/AuthScreen';
import OnboardingScreen from '@screens/OnboardingScreen';
import LocationPermissionScreen from '@screens/LocationPermissionScreen';
import PremiumScreen from '@screens/PremiumScreen';
import SettingsScreen from '@screens/SettingsScreen';
import ReadingScreen from '@screens/ReadingScreen';
import MainTabs from './MainTabs';
import { withScreenErrorBoundary } from '@components/ScreenErrorBoundary';

import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useTheme } from '@theme/ThemeProvider';

import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const MIN_SPLASH_MS = 2500;

/*
 * Bounded once, at module scope. Wrapping inline in the render would build a
 * new component type on every render, which React treats as a different
 * component: every screen would unmount and remount, losing its state, on any
 * navigator re-render (a theme change, an auth tick).
 */
const SplashRoute = withScreenErrorBoundary(SplashScreen, 'Splash');
const AuthRoute = withScreenErrorBoundary(AuthScreen, 'Auth');
const LocationPermissionRoute = withScreenErrorBoundary(
  LocationPermissionScreen,
  'LocationPermission',
);
const OnboardingRoute = withScreenErrorBoundary(OnboardingScreen, 'Onboarding');
const MainRoute = withScreenErrorBoundary(MainTabs, 'Main');
const PremiumRoute = withScreenErrorBoundary(PremiumScreen, 'Premium');
const SettingsRoute = withScreenErrorBoundary(SettingsScreen, 'Settings');
const ReadingRoute = withScreenErrorBoundary(ReadingScreen, 'Reading');

const RootNavigator: React.FC = () => {
  const { theme } = useTheme();

  const user = useAuthStore(s => s.user);
  const isAuthLoading = useAuthStore(s => s.isLoading);
  const bootstrap = useAuthStore(s => s.bootstrap);
  const hasSeenOnboarding = useSettingsStore(s => s.hasSeenOnboarding);
  const onboardingLocationPrompted = useSettingsStore(s => s.onboardingLocationPrompted);

  const [splashElapsed, setSplashElapsed] = useState(false);
  const [authBootstrapped, setAuthBootstrapped] = useState(false);

  // Enforce minimum splash duration — brand moment must not be skipped
  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Bootstrap Firebase Auth — resolves on first onAuthStateChanged emission
  useEffect(() => {
    bootstrap().finally(() => setAuthBootstrapped(true));
  }, [bootstrap]);

  // Memoize theme to prevent unnecessary re-renders of the NavigationContainer
  const navTheme = useMemo<NavTheme>(() => {
    const baseTheme = theme.isDark ? NavDarkTheme : NavDefaultTheme;
    return {
      ...baseTheme,
      dark: theme.isDark,
      colors: {
        ...baseTheme.colors,
        primary: theme.colors.accent,
        background: theme.colors.bg,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.accent,
      },
    };
  }, [theme]);

  // Keep showing splash until the timer elapses and the initial session
  // restore resolves. Deliberately excludes `isAuthLoading` after that point —
  // it also flips true for every subsequent signIn/signUp/signInWithGoogle
  // button press, and gating Splash on it swapped AuthScreen for Splash (a
  // full unmount) on every attempt, silently destroying the error message
  // that attempt was trying to show. AuthScreen has its own local spinner
  // for in-flight auth calls, so this full-screen swap was never needed
  // outside the initial cold-start bootstrap.
  const splashStillShowing = !splashElapsed || !authBootstrapped;

  const isAuthenticated = user !== null && !isAuthLoading;
  // Location permission is MANDATORY for all builds
  const needsLocationPermission = isAuthenticated && !onboardingLocationPrompted;
  const needsOnboardingFlow = isAuthenticated && onboardingLocationPrompted && !hasSeenOnboarding;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle={theme.colors.statusBarStyle} backgroundColor={theme.colors.bg} />
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          // Off by default because the gate screens (Splash/Auth/Onboarding/
          // LocationPermission) must not be swipe-dismissable — there is
          // nothing behind them to go back to. The pushed screens below turn
          // it back on individually, so back-swipe works where it means
          // something.
          gestureEnabled: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        {splashStillShowing ? (
          <RootStack.Screen name="Splash" component={SplashRoute} />
        ) : !isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthRoute} />
        ) : needsLocationPermission ? (
          <RootStack.Screen name="LocationPermission" component={LocationPermissionRoute} />
        ) : needsOnboardingFlow ? (
          <RootStack.Screen name="Onboarding" component={OnboardingRoute} />
        ) : (
          /* Signed in, past every gate: the tabs, plus everything pushed over
             them. Grouped so that losing auth unmounts all of it at once. */
          <RootStack.Group>
            <RootStack.Screen name="Main" component={MainRoute} />

            {/* Paywall — presented as a full-screen modal over any tab */}
            <RootStack.Screen
              name="Premium"
              component={PremiumRoute}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                gestureEnabled: true,
              }}
            />
            {/* Settings — reached via the gear icon in the Home dashboard header */}
            <RootStack.Screen
              name="Settings"
              component={SettingsRoute}
              options={{ animation: 'slide_from_right', gestureEnabled: true }}
            />
            {/* One Reading — opened from Your Readings, or begun from Home */}
            <RootStack.Screen
              name="Reading"
              component={ReadingRoute}
              options={{ animation: 'slide_from_right', gestureEnabled: true }}
            />
          </RootStack.Group>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
