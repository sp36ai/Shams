import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '@hooks/useIsOffline';

/**
 * Thin top-of-screen banner shown while the device is offline. Free/local
 * modules (SkyClock, History) keep working from the MMKV cache; only new
 * oracle readings require a connection, which this banner makes explicit.
 *
 * Colors are pinned to the darAlShams palette (src/theme/themes.ts) rather
 * than read from theme context so the banner renders identically regardless
 * of where it sits in the tree. pointerEvents="none" keeps it from swallowing
 * taps on the content beneath it.
 */
const OfflineBanner: React.FC = () => {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();

  if (!offline) {
    return null;
  }

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 6 }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.text}>You are offline — new readings need a connection.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A26', // surfaceElevated
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C9A961', // primary (gold)
    alignItems: 'center',
    zIndex: 1000,
  },
  text: {
    color: '#F4EFE3', // text
    fontSize: 13,
    textAlign: 'center',
  },
});

export default OfflineBanner;
