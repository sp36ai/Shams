/**
 * ChatComposer — the Oracle Chat input bar.
 * --------------------------------------------------------------------------
 * Text input, mic button (animated while recording), and the ASK/SEND
 * action. Owns none of the STT/quota/network logic — every callback here is
 * a pass-through to whatever ReadingScreen decides to do, so this file
 * stays pure presentation, easy to reuse or restyle without touching the
 * conversation logic.
 *
 * `mode` is derived by the Reading screen, never chosen here: before a chart
 * has been cast the next send is the Reading's question, and after it every
 * send is a follow-up about that Reading. The composer only reflects which,
 * in its placeholder and its action label.
 */

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import TabIcon from '@components/TabIcon';
import { Glyph, useReadingText } from './readingDesign';

export type ComposerMode = 'ask' | 'discuss';

interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** Disables Send + the text input — a reply is in flight. */
  sending: boolean;
  /** True while the mic is actively listening. */
  isListening: boolean;
  onMicPress: () => void;
  micDisabled?: boolean;
  /**
   * False when this build/device has no recognizer. The mic is then not
   * rendered at all: a button that cannot work is worse than no button.
   */
  micAvailable?: boolean;
  /** Whether the next send opens this Reading or follows up on it. */
  mode?: ComposerMode;
  /**
   * A short line above the input, drawn on the bar's own surface so it reads
   * as part of the composer rather than floating over the thread's edge.
   */
  hint?: string;
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChangeText,
  onSend,
  sending,
  isListening,
  onMicPress,
  micDisabled = false,
  micAvailable = true,
  mode = 'ask',
  hint,
}) => {
  const colors = useColors();
  const typography = useTypography();
  const text = useReadingText();
  const t = useTranslation();

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isListening) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, pulse]);

  const canSend = value.trim().length > 0 && !sending;
  const isDiscuss = mode === 'discuss';
  const sendLabel = isDiscuss ? t('oracleChat.reply') : t('oracleChat.send');

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.wrap}>
        <TextInput
          style={[
            typography('body'),
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.surfaceElevated,
              borderColor: isListening ? colors.accent : colors.border,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={
            isListening
              ? t('oracleChat.listening')
              : isDiscuss
                ? t('oracleChat.placeholderDiscuss')
                : t('oracleChat.placeholder')
          }
          placeholderTextColor={colors.textFaint}
          editable={!sending}
          multiline
          maxLength={500}
          testID="oracle-chat-input"
        />

        {/* No recognizer in this build or on this device: the mic is not
          rendered at all rather than offered and then failing. */}
        {micAvailable && (
          <View style={styles.micWrap}>
            {isListening && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pulseRing,
                  {
                    borderColor: colors.accent,
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                    transform: [
                      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
                    ],
                  },
                ]}
              />
            )}
            <Pressable
              onPress={onMicPress}
              disabled={micDisabled}
              style={({ pressed }) => [
                styles.roundBtn,
                {
                  backgroundColor: isListening ? colors.accent : 'transparent',
                  borderColor: colors.accent,
                  opacity: micDisabled ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isListening ? t('oracleChat.stopRecording') : t('oracleChat.startRecording')
              }
              testID="oracle-chat-mic-btn"
            >
              <TabIcon
                name="mic"
                size={20}
                color={isListening ? colors.textOnPrimary : colors.goldBright}
              />
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={({ pressed }) => [
            isDiscuss ? styles.roundBtn : styles.askBtn,
            {
              backgroundColor: canSend ? colors.accent : 'transparent',
              borderColor: canSend ? colors.accent : colors.border,
              opacity: pressed && canSend ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={sendLabel}
          testID="oracle-chat-send-btn"
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : isDiscuss ? (
            <Glyph
              name="arrowUp"
              size={20}
              color={canSend ? colors.textOnPrimary : colors.textFaint}
            />
          ) : (
            <Text
              style={[text.button, { color: canSend ? colors.textOnPrimary : colors.textFaint }]}
            >
              {sendLabel}
            </Text>
          )}
        </Pressable>
      </View>
      {hint !== undefined && (
        <Text style={[text.meta, styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  hint: {
    paddingTop: 8,
    paddingHorizontal: 6,
    paddingBottom: 2,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  micWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  pulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtn: {
    minWidth: 64,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 120,
  },
});

export default ChatComposer;
