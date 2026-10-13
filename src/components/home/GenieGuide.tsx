/**
 * GenieGuide — the 🧞 button at the bottom-right of Home and the help chat
 * it opens: a free, offline how-to guide.
 *
 * Strictly a guide to using the app. The seeker can only tap one of the
 * pre-written questions in guideFaq.ts; there is no text box, no network
 * call and no access to readings, charts or verdicts, so the Genie can never
 * drift into judgment (which belongs to the RKP engine via the Oracle).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTypography } from '@theme/useTypography';
import { RADIUS, SPACING } from '@theme/themes';
import { useTranslation } from '@i18n/I18nProvider';
import {
  GUIDE_ENTRIES,
  GUIDE_GREETING,
  GUIDE_SCOPE_NOTE,
  type GuideEntry,
} from '../../data/guideFaq';
import { CELESTIAL } from './celestialPalette';

interface Bubble {
  key: string;
  from: 'genie' | 'seeker';
  text: string;
}

const GREETING: Bubble[] = [
  { key: 'greet', from: 'genie', text: GUIDE_GREETING },
  { key: 'scope', from: 'genie', text: GUIDE_SCOPE_NOTE },
];

export const GenieButton: React.FC<{ onPress: () => void; accessibilityLabel: string }> = ({
  onPress,
  accessibilityLabel,
}) => (
  <Pressable
    testID="genie-btn"
    onPress={onPress}
    style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.8 : 1 }]}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    hitSlop={6}
  >
    <Text style={styles.fabGlyph}>🧞</Text>
  </Pressable>
);

interface GenieGuideProps {
  visible: boolean;
  onClose: () => void;
}

const GenieGuide: React.FC<GenieGuideProps> = ({ visible, onClose }) => {
  const typography = useTypography();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const [bubbles, setBubbles] = useState<Bubble[]>(GREETING);
  const scrollRef = useRef<ScrollView>(null);

  // Each opening starts a fresh conversation.
  useEffect(() => {
    if (visible) {
      setBubbles(GREETING);
    }
  }, [visible]);

  const ask = (entry: GuideEntry): void => {
    setBubbles(prev => [
      ...prev,
      { key: `${entry.id}-q-${prev.length}`, from: 'seeker', text: entry.question },
      { key: `${entry.id}-a-${prev.length}`, from: 'genie', text: entry.answer },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="genie-backdrop" />
      <View
        testID="genie-guide"
        style={[styles.sheet, { paddingBottom: SPACING.lg + insets.bottom }]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.titleGlyph}>🧞</Text>
          <Text style={[typography('subheading'), styles.title]} accessibilityRole="header">
            Genie · Guide
          </Text>
          <Pressable
            testID="genie-close"
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[typography('button'), styles.close]}>{t('common.close')}</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatBody}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {bubbles.map(b => (
            <View
              key={b.key}
              style={[styles.bubble, b.from === 'genie' ? styles.genieBubble : styles.seekerBubble]}
            >
              <Text style={[typography('body'), styles.bubbleText]}>{b.text}</Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.options}
          contentContainerStyle={styles.optionsBody}
        >
          {GUIDE_ENTRIES.map(entry => (
            <Pressable
              key={entry.id}
              testID={`genie-option-${entry.id}`}
              onPress={() => ask(entry)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              accessibilityRole="button"
            >
              <Text style={[typography('caption'), styles.chipText]}>{entry.question}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: CELESTIAL.antiqueGold,
    backgroundColor: CELESTIAL.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  fabGlyph: {
    fontSize: 24,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000AA',
  },
  sheet: {
    height: '72%',
    paddingTop: 12,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: CELESTIAL.antiqueGold + '99',
    backgroundColor: CELESTIAL.midnight,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CELESTIAL.antiqueGold + '55',
  },
  titleGlyph: {
    fontSize: 22,
  },
  title: {
    flex: 1,
    color: CELESTIAL.champagne,
  },
  close: {
    color: CELESTIAL.antiqueGold,
  },
  chat: {
    flex: 1,
  },
  chatBody: {
    padding: SPACING.lg,
    gap: 10,
  },
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  genieBubble: {
    alignSelf: 'flex-start',
    backgroundColor: CELESTIAL.deepTeal,
    borderWidth: 1,
    borderColor: CELESTIAL.antiqueGold + '55',
    borderTopLeftRadius: 4,
  },
  seekerBubble: {
    alignSelf: 'flex-end',
    backgroundColor: CELESTIAL.bronze,
    borderTopRightRadius: 4,
  },
  bubbleText: {
    color: CELESTIAL.ivory,
    lineHeight: 22,
  },
  options: {
    flexGrow: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CELESTIAL.antiqueGold + '55',
  },
  optionsBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: CELESTIAL.antiqueGold,
    backgroundColor: CELESTIAL.deepTeal,
  },
  chipPressed: {
    backgroundColor: CELESTIAL.bronze,
  },
  chipText: {
    color: CELESTIAL.champagne,
  },
});

export default GenieGuide;
