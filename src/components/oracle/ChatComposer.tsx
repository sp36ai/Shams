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
  TextInput,
  View,
} from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';

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
  /** Whether the next send opens this Reading or follows up on it. */
  mode?: ComposerMode;
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChangeText,
  onSend,
  sending,
  isListening,
  onMicPress,
  micDisabled = false,
  mode = 'ask',
}) => {
  const colors = useColors();
  const typography = useTypography();
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

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.micWrap}>
        {isListening && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                borderColor: colors.negative,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
                ],
              },
            ]}
          />
        )}
        <Pressable
          onPress={onMicPress}
          disabled={micDisabled}
          style={({ pressed }) => [
            styles.micBtn,
            {
              backgroundColor: isListening ? colors.negative : colors.surfaceElevated,
              borderColor: isListening ? colors.negative : colors.border,
              opacity: micDisabled ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isListening ? t('oracleChat.stopRecording') : t('oracleChat.startRecording')
          }
          testID="oracle-chat-mic-btn"
        >
          <Animated.Text
            style={{ fontSize: 18, color: isListening ? colors.textOnPrimary : colors.textMuted }}
          >
            {'🎙'}
          </Animated.Text>
        </Pressable>
      </View>

      <TextInput
        style={[
          typography('body'),
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={
          isListening
            ? t('oracleChat.listening')
            : mode === 'discuss'
              ? t('oracleChat.placeholderDiscuss')
              : t('oracleChat.placeholder')
        }
        placeholderTextColor={colors.textFaint}
        editable={!sending}
        multiline
        maxLength={500}
        testID="oracle-chat-input"
      />

      <Pressable
        onPress={onSend}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.sendBtn,
          {
            backgroundColor: canSend ? colors.accent : colors.surfaceElevated,
            opacity: pressed && canSend ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={mode === 'discuss' ? t('oracleChat.reply') : t('oracleChat.send')}
        testID="oracle-chat-send-btn"
      >
        {sending ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Animated.Text
            style={[
              typography('label'),
              { color: canSend ? colors.textOnPrimary : colors.textFaint },
            ]}
          >
            {mode === 'discuss' ? t('oracleChat.reply') : t('oracleChat.send')}
          </Animated.Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  micWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    minWidth: 56,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});

export default ChatComposer;
