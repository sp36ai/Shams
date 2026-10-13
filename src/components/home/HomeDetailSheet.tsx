/**
 * HomeDetailSheet — the bottom sheet a Home tile opens: the full text behind
 * the tile's one-line headline. Presentation only; the caller passes the
 * content. Tapping outside the sheet, the Close button or the system back
 * button closes it.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import { RADIUS, SPACING } from '@theme/themes';
import OrnamentDivider from '@components/ui/OrnamentDivider';

interface HomeDetailSheetProps {
  /** Null hides the sheet. */
  title: string | null;
  onClose: () => void;
  children?: React.ReactNode;
}

const HomeDetailSheet: React.FC<HomeDetailSheetProps> = ({ title, onClose, children }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={title !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        testID="home-detail-backdrop"
      />
      <View
        testID="home-detail-sheet"
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderAccent + '80',
            paddingBottom: SPACING.xl + insets.bottom,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.borderAccent + '80' }]} />
        <Text
          style={[typography('label'), { color: colors.goldBright, textAlign: 'center' }]}
          accessibilityRole="header"
        >
          {(title ?? '').toUpperCase()}
        </Text>
        <OrnamentDivider style={styles.divider} />
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        <Pressable
          testID="home-detail-close"
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeBtn,
            { borderColor: colors.borderAccent, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={[typography('button'), { color: colors.goldBright }]}>
            {t('common.close')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000AA',
  },
  sheet: {
    maxHeight: '75%',
    paddingHorizontal: SPACING.xl,
    paddingTop: 10,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  divider: {
    marginTop: 10,
    marginBottom: 14,
  },
  body: {
    flexGrow: 0,
  },
  closeBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
});

export default HomeDetailSheet;
