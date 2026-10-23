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
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {hint !== undefined && (
        <Text style={[typography('caption'), styles.hint, { color: colors.textFaint }]}>
          {hint}
        </Text>
      )}
      <View style={styles.wrap}>
        {/* No recognizer in this build or on this device: the mic is not
          rendered at all rather than offered and then failing. */}
        {micAvailable && (
          <View style={styles.micWrap}>
            {isListening && (
              <>
                {/*
                Second, static ring behind the existing animated pulse — a
                restrained stand-in for the concentric "celestial" rings the
                design spec calls for around voice input, sized to this
                inline composer rather than a full-screen takeover (the real
                voice flow has no separate listening screen: it's this mic
                button, live in the composer bar).
              */}
                <View
                  pointerEvents="none"
                  style={[styles.glassRing, { borderColor: colors.negative + '40' }]}
                />
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
              </>
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
                  // Depth behind the mic only while it's actually doing
                  // something — an idle mic stays flat, same rule as the
                  // Home composer's send button.
                  ...(isListening
                    ? {
                        shadowColor: colors.negative,
                        shadowOpacity: 0.55,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 5,
                      }
                    : null),
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
                size={18}
                color={isListening ? colors.textOnPrimary : colors.textMuted}
              />
            </Pressable>
          </View>
        )}

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
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    textAlign: 'center',
    paddingTop: 6,
    paddingHorizontal: 16,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  micWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
  },
  glassRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
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
