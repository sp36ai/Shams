/**
 * RootNavigator — top-level navigation graph.
 * --------------------------------------------------------------------------
 * State machine (in order):
 *   1. Splash (always shown, min 2.5s brand moment)
 *   2. Auth   (if user is not signed in)
 *   3. LocationPermission (first launch after auth if not yet prompted)
 *   4. Main   (bottom tabs: Oracle | SkyClock | History | Settings)
 *
 * Firebase Auth bootstrap is awaited asynchronously via onAuthStateChanged;
 * while it resolves we stay on Splash so the user never sees a flash of the
 * Auth screen before session restoration completes. The auth gate is enforced
 * on every cold start via authStore.bootstrap().
 */

import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  type Theme as NavTheme,
  DarkTheme as NavDarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '@screens/SplashScreen';
import AuthScreen from '@screens/AuthScreen';
import OnboardingScreen from '@screens/OnboardingScreen';
import LocationPermissionScreen from '@screens/LocationPermissionScreen';
import PremiumScreen from '@screens/PremiumScreen';
import SkyClockScreen from '@screens/SkyClockScreen';
import MainTabs from './MainTabs';

import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { MMKV } from 'react-native-mmkv';
import { useTheme } from '@theme/ThemeProvider';

import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const MIN_SPLASH_MS = 2500;

const storage = new MMKV();
const BYPASS_AUTH_FOR_TESTING = false;

const RootNavigator: React.FC = () => {
  const { theme } = useTheme();

  const user = useAuthStore(s => s.user);
  const isAuthLoading = useAuthStore(s => s.isLoading);
  const bootstrap = useAuthStore(s => s.bootstrap);
  const onboardingLocationPrompted = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.onboardingLocationPrompted,
  );

  const [splashElapsed, setSplashElapsed] = useState(false);
  const [authBootstrapped, setAuthBootstrapped] = useState(false);

  // Enforce minimum splash duration — brand moment must not be skipped.
  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Bootstrap Firebase Auth — resolves on first onAuthStateChanged emission.
  useEffect(() => {
    bootstrap().finally(() => setAuthBootstrapped(true));
  }, [bootstrap]);
  
  // Check if onboarding has been seen from MMKV
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  useEffect(() => {
    const seen = storage.getBoolean('shams_onboarding_seen') || false;
    setHasSeenOnboarding(seen);
    // No listener needed as onboarding is a one-time flow
  }, []);
  
  
  const navTheme: NavTheme = {
    ...NavDarkTheme,
    dark: theme.isDark,
    colors: {
      ...NavDarkTheme.colors,
      primary: theme.colors.accent,
      background: theme.colors.bg,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };

  // Keep showing splash until both the timer and auth bootstrap have resolved.
  const splashStillShowing = !BYPASS_AUTH_FOR_TESTING && (!splashElapsed || !authBootstrapped || isAuthLoading);
  const isAuthenticated = BYPASS_AUTH_FOR_TESTING || user !== null;
  const needsOnboardingFlow = !BYPASS_AUTH_FOR_TESTING && isAuthenticated && !hasSeenOnboarding;
  const needsLocationPermission = !BYPASS_AUTH_FOR_TESTING && isAuthenticated && hasSeenOnboarding && !onboardingLocationPrompted;

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        {splashStillShowing ? (
          <RootStack.Screen name="Splash" component={SplashScreen} />
        ) : !isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        ) : needsOnboardingFlow ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : needsLocationPermission ? (
          <RootStack.Screen name="LocationPermission" component={LocationPermissionScreen} />
        ) : (
          <RootStack.Screen name="Main" component={MainTabs} />
        )}

        {/* Paywall — presented as a full-screen modal over any tab */}
        <RootStack.Screen
          name="Premium"
          component={PremiumScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        {/* Sky State — timing/context panel, secondary route from Oracle header */}
        <RootStack.Screen
          name="SkyState"
          component={SkyClockScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
