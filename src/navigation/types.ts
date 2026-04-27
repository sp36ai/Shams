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
 *   - MainTabs   : bottom-tabs for the local RKP shell: Ask | History | Settings.
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
  LocationPermission: undefined;
  /** Container for the bottom-tab navigator. */
  Main: undefined;
  /** Full-screen paywall modal — navigable from any tab via navigation.navigate('Premium'). */
  Premium: undefined;
};

export type RootStackScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>;

/* -------------------------------------------------------------------------- */
/*  Main bottom tabs                                                          */
/* -------------------------------------------------------------------------- */

export type MainTabParamList = {
  Oracle: undefined;
  SkyClock: undefined;
  History: undefined;
  Settings: undefined;
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
