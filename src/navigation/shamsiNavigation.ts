/**
 * Navigation Integration for Shamsi Logic
 * 
 * Adds AskShamsiScreen and ShamsiResultsScreen to RootNavigator.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// Existing screens
import SplashScreen from '@screens/SplashScreen';
import SignInScreen from '@screens/SignInScreen';
import OracleChatScreen from '@screens/OracleChatScreen';
import SettingsScreen from '@screens/SettingsScreen';
import HistoryScreen from '@screens/HistoryScreen';

// New Shamsi screens
import { AskShamsiScreen } from '@screens/AskShamsiScreen';
import { ShamsiResultsScreen } from '@screens/ShamsiResultsScreen';

const Stack = createNativeStackNavigator();
const OracleStack = createNativeStackNavigator();

export type RootStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  AppTabs: undefined;
  AskShamsi: undefined;
  ShamsiResults: { result: any };
};

export type OracleStackParamList = {
  OracleChat: undefined;
  AskShamsi: undefined;
  ShamsiResults: { result: any };
  History: undefined;
};

/**
 * Oracle stack (tab navigator content)
 * Routes between watch-oracle (existing) and Shamsi oracle (new).
 */
function OracleStackNavigator() {
  return (
    <OracleStack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <OracleStack.Screen
        name="OracleChat"
        component={OracleChatScreen}
        options={{ title: 'Oracle' }}
      />
      <OracleStack.Screen
        name="AskShamsi"
        component={AskShamsiScreen}
        options={{ title: 'Shamsi Oracle', headerBackTitle: 'Back' }}
      />
      <OracleStack.Screen
        name="ShamsiResults"
        component={ShamsiResultsScreen}
        options={{ title: 'Reading' }}
      />
      <OracleStack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Reading History' }}
      />
    </OracleStack.Navigator>
  );
}

/**
 * Root navigator
 */
export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Group>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          {/* Tab navigator wrapping OracleStack + other tabs */}
          {/* <Stack.Screen name="AppTabs" component={AppTabNavigator} /> */}
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
