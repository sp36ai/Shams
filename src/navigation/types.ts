/**
 * Navigation type contracts.
 * --------------------------------------------------------------------------
 * Strict typing per react-navigation/native-stack docs. Every screen MUST
 * type its props as NativeStackScreenProps<AuthStackParamList | MainTabParamList | ...>
 * so route.params and navigation.navigate() autocomplete and reject typos.
 *
 * Two navigators:
 *   - RootStack  : top-level switch between Splash → Permission → Main.
 *                  Implemented as a native-stack with conditional screens.
 *   - MainTabs   : bottom-tabs for the local RKP shell: Home | Ask | Al-Falak | History.
 *                  Settings lives on RootStack, reached via the Home header's
 *                  gear icon rather than a tab (matches the Dār al-Shams
 *                  reference IA).
 *
 * Deep linking is NOT enabled in Phase 1 (no public URL scheme registered yet).
 * When we wire it in Phase 4 for payment-return URLs and password-reset
 * deep links, we'll add a `linking` config to RootNavigator and update
 * these param types with optional URL params.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

/* -------------------------------------------------------------------------- */
/*  Root stack                                                                */
/* -------------------------------------------------------------------------- */

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  LocationPermission: undefined;
  Main: undefined;
  Premium: undefined;
  /** Settings — reached via the gear icon in the Home dashboard header. */
  Settings: undefined;
};

export type RootStackScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>;

/* -------------------------------------------------------------------------- */
/*  Main bottom tabs                                                          */
/* -------------------------------------------------------------------------- */

export type MainTabParamList = {
  /** Home dashboard — formerly the "Oracle" tab; content unchanged, renamed to match the reference IA. */
  Home: undefined;
  /** Oracle chat — the question/verdict conversation, now a persistent tab. */
  Ask: undefined;
  /** Al-Falak — Sky State timing/context panel, now a persistent tab. */
  AlFalak: undefined;
  History: undefined;
};

/**
 * Composite props — when a tab screen needs to navigate back to a root-level
 * screen (e.g. Oracle pushing a paywall modal that lives at root), use this.
 */
export type MainTabScreenProps<RouteName extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, RouteName>,
  RootStackScreenProps<keyof RootStackParamList>
>;

/* -------------------------------------------------------------------------- */
/*  Augment react-navigation's RootParamList for autocompletion in useNav     */
/* -------------------------------------------------------------------------- */

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
