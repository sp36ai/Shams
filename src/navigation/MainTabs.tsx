/**
 * MainTabs — bottom tab navigator for the local RKP shell.
 * --------------------------------------------------------------------------
 * Tabs (in order): Oracle | History | Settings.
 * Oracle is the initial route — it is the primary question surface.
 *
 * Visual contract:
 *   - Tab bar background: theme.colors.surface, top hairline border.
 *   - Active tint: theme.colors.accent.
 *   - Inactive tint: theme.colors.mutedText.
 *   - Labels: theme typography 'caption' variant, lang-aware via useTypography.
 *   - Icons: TabIcon component (custom SVG, color follows tint).
 *   - Bar height: 60 + safe-area inset bottom.
 *   - No header at the tab level — each screen renders its own header for
 *     consistent control over typography, status bar, and large-title behavior.
 *
 * RTL behavior:
 *   When lang=ur, react-native flips the tab order automatically because
 *   I18nManager.isRTL is true (set by I18nProvider before mount). No special
 *   handling needed here.
 *
 * Reanimated:
 *   The TabIcon's `focused` prop drives stroke width animation in the icon
 *   itself; we don't need a separate Animated layer at the bar level.
 */

import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { Pressable } from 'react-native';

import OracleScreen from '@screens/OracleScreen';
import HistoryScreen from '@screens/HistoryScreen';
import SettingsScreen from '@screens/SettingsScreen';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';

import TabIcon, { type IconName } from '@components/TabIcon';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// `useTranslation()` returns the callable t function directly (not { t }).
// Re-exporting the type alias here keeps the screenOptions block readable.
type TKey = Parameters<ReturnType<typeof useTranslation>>[0];

/* -------------------------------------------------------------------------- */
/*  Custom tab button — strips the default ripple for a quieter spiritual feel*/
/* -------------------------------------------------------------------------- */

const TabButton: React.FC<BottomTabBarButtonProps> = props => {
  const { children, onPress, accessibilityState, accessibilityLabel, testID } = props;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      android_ripple={null}
      style={({ pressed }) => [styles.tabButton, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
};

/* -------------------------------------------------------------------------- */
/*  Navigator                                                                 */
/* -------------------------------------------------------------------------- */

const MainTabs: React.FC = () => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  // Memoize labels so screenOptions doesn't rebuild on every render.
  const labels = useMemo<Record<keyof MainTabParamList, string>>(
    () => ({
      Oracle: t('oracle.headerTitle' as TKey),
      History: t('history.headerTitle' as TKey),
      Settings: t('settings.headerTitle' as TKey),
    }),
    [t],
  );

  const iconNames: Record<keyof MainTabParamList, IconName> = {
    Oracle: 'oracle',
    History: 'history',
    Settings: 'settings',
  };

  return (
    <Tab.Navigator
      initialRouteName="Oracle"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarButton: TabButton,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.select({ ios: 84, android: 64 }),
          paddingTop: 6,
          paddingBottom: Platform.select({ ios: 24, android: 8 }),
          elevation: 0,
        },
        tabBarLabelStyle: {
          ...typography('caption'),
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }) => (
          <View style={styles.iconWrap}>
            <TabIcon
              name={iconNames[route.name as keyof MainTabParamList]}
              color={color}
              size={24}
              focused={focused}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Oracle" component={OracleScreen} options={{ tabBarLabel: labels.Oracle }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: labels.History }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: labels.Settings }} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MainTabs;
