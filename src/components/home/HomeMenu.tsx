/**
 * HomeMenu — the ≡ menu at the top of Home and the small panel it opens:
 * Al-Falak, Readings and Settings. Presentation only; the caller owns
 * navigation. Tapping outside the panel, or the system back button, closes it.
 *
 * Uses the fixed Midnight Celestial palette, like the rest of Home's panel.
 * The panel opens from the menu's corner: top-left in left-to-right
 * languages, top-right in Urdu (it is anchored to the "start" edge).
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTypography } from '@theme/useTypography';
import { SPACING } from '@theme/themes';
import TabIcon, { type IconName } from '@components/TabIcon';
import { CELESTIAL } from './celestialPalette';

export interface HomeMenuItem {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

/** The three-line menu button. */
export const HomeMenuButton: React.FC<{
  onPress: () => void;
  accessibilityLabel: string;
}> = ({ onPress, accessibilityLabel }) => (
  <Pressable
    testID="home-menu-btn"
    onPress={onPress}
    hitSlop={8}
    style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.7 : 1 }]}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
    <View style={styles.menuLine} />
  </Pressable>
);

interface HomeMenuProps {
  visible: boolean;
  items: HomeMenuItem[];
  onClose: () => void;
}

const HomeMenu: React.FC<HomeMenuProps> = ({ visible, items, onClose }) => {
  const typography = useTypography();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="home-menu-backdrop" />
      <View
        testID="home-menu"
        accessibilityRole="menu"
        style={[styles.panel, { top: insets.top + 56 }]}
      >
        {items.map((item, i) => (
          <Pressable
            key={item.key}
            testID={`home-menu-${item.key}`}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            style={({ pressed }) => [
              styles.item,
              i > 0 && styles.itemDivider,
              pressed && styles.itemPressed,
            ]}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
          >
            <TabIcon name={item.icon} color={CELESTIAL.champagne} size={20} />
            <Text style={[typography('button'), styles.itemLabel]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: CELESTIAL.antiqueGold,
    backgroundColor: CELESTIAL.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  menuLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: CELESTIAL.champagne,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000066',
  },
  panel: {
    position: 'absolute',
    start: SPACING.xl,
    minWidth: 200,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CELESTIAL.antiqueGold + '99',
    backgroundColor: CELESTIAL.deepTeal,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  itemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CELESTIAL.antiqueGold + '55',
  },
  itemPressed: {
    backgroundColor: CELESTIAL.midnight,
  },
  itemLabel: {
    color: CELESTIAL.ivory,
    fontSize: 15,
  },
});

export default HomeMenu;
