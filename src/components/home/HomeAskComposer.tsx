/**
 * HomeAskComposer — the one action Home exists for.
 * --------------------------------------------------------------------------
 * "I have a question → I ask Shams → I receive a Reading" has to be legible
 * within seconds of the app opening, so the primary surface is a composer the
 * seeker can type into directly, not a button that leads to one.
 *
 * It owns its own text so a keystroke never re-renders the dashboard around
 * it (sky state, hora countdown and the manzil emblem all live on Home and
 * are expensive to redraw). Submitting hands the question up; no Reading is
 * created here, and nothing is persisted until the seeker actually asks.
 *
 * Voice: the mic fills the same field and hands the transcript up through
 * the same onSubmit, so a spoken question opens a Reading exactly as a typed
 * one does and reaches askWatchOracle by the same single path. The
 * transcript is sent when the recognizer stops on its own (the seeker
 * paused) or when the mic is tapped again.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SPACING } from '@theme/themes';
import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useI18n, useTranslation } from '@i18n/I18nProvider';
import { useSpeechToText } from '@hooks/useSpeechToText';
import TabIcon from '@components/TabIcon';

interface HomeAskComposerProps {
  /** Called with the trimmed question. Never called with an empty string. */
  onSubmit: (question: string, kind: 'text' | 'voice') => void;
  /** Opens an empty Reading — the same destination, without a question yet. */
  onOpenBlank: () => void;
}

const HomeAskComposer: React.FC<HomeAskComposerProps> = ({ onSubmit, onOpenBlank }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const { lang } = useI18n();

  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  const submit = useCallback(
    (question: string, kind: 'text' | 'voice') => {
      const trimmed = question.trim();
      if (trimmed.length === 0) {
        return;
      }
      // Cleared immediately: the question now belongs to the Reading it opened,
      // and coming back to Home should not offer to ask it a second time.
      setText('');
      onSubmit(trimmed, kind);
    },
    [onSubmit],
  );

  const handleSubmit = useCallback(() => submit(text, 'text'), [submit, text]);

  // The recognizer ended by itself: send what it heard. Routed through a ref
  // because the hook is created before `submit` is in scope for it.
  const voiceTranscriptRef = useRef<(heard: string) => void>(() => undefined);
  const stt = useSpeechToText(lang, heard => voiceTranscriptRef.current(heard));
  useEffect(() => {
    voiceTranscriptRef.current = (heard: string): void => submit(heard, 'voice');
  }, [submit]);

  // Live words land in the field while listening.
  useEffect(() => {
    if (stt.isListening) {
      setText(stt.partialText);
    }
  }, [stt.isListening, stt.partialText]);

  const handleMicPress = useCallback(() => {
    if (stt.isListening) {
      void stt.stop().then(heard => submit(heard, 'voice'));
      return;
    }
    void stt.start();
  }, [stt, submit]);

  const micErrorText =
    stt.error === 'unavailable'
      ? t('oracleChat.voiceUnavailable')
      : stt.error === 'permission-denied'
        ? t('oracleChat.micPermissionDenied')
        : stt.error === 'no-speech'
          ? t('oracleChat.noSpeechDetected')
          : null;

  return (
    <View style={styles.wrap}>
      <Text style={[typography('subheading'), { color: colors.text, marginBottom: 10 }]}>
        {t('oracle.askPrompt')}
      </Text>

      {/*
        Glass+3D treatment — one of the two zones (with the Hora hero card)
        the design spec marks as premium. No blur library is installed, so
        this approximates glass with a translucent fog overlay
        (colors.manuscriptFog), a soft top highlight, and a warm glow shadow
        (colors.sacredGlow) rather than pulling in a new native dependency.
      */}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderAccent + '55',
            shadowColor: colors.sacredGlow,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.fieldGlassOverlay, { backgroundColor: colors.manuscriptFog }]}
        />
        <View
          pointerEvents="none"
          style={[styles.fieldTopHighlight, { backgroundColor: colors.text + '1A' }]}
        />
        <TextInput
          style={[typography('body'), styles.input, { color: colors.text }]}
          value={text}
          onChangeText={setText}
          placeholder={stt.isListening ? t('oracleChat.listening') : t('oracle.askPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSubmit}
          testID="home-ask-input"
        />
        {/* No recognizer in this build or on this device: no mic at all. */}
        {stt.isAvailable && (
          <Pressable
            onPress={handleMicPress}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: stt.isListening ? colors.negative : colors.surfaceElevated,
                borderColor: stt.isListening ? colors.negative : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              stt.isListening ? t('oracleChat.stopRecording') : t('oracleChat.startRecording')
            }
            testID="home-ask-mic-btn"
          >
            <TabIcon
              name="mic"
              size={18}
              color={stt.isListening ? colors.textOnPrimary : colors.textMuted}
            />
          </Pressable>
        )}
        <Pressable
          onPress={canSend ? handleSubmit : onOpenBlank}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: canSend ? colors.accent : colors.surfaceElevated,
              borderColor: canSend ? colors.accent : colors.border,
              opacity: pressed ? 0.8 : 1,
              // Depth behind the CTA only once it's actually actionable —
              // an idle send button stays flat.
              ...(canSend
                ? {
                    shadowColor: colors.sacredGlow,
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 4,
                  }
                : null),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('oracle.askNewQuestionCta')}
          testID="ask-shams-btn"
        >
          <TabIcon
            name="arrowUp"
            size={18}
            color={canSend ? colors.textOnPrimary : colors.goldBright}
          />
        </Pressable>
      </View>

      {micErrorText !== null && (
        <Text style={[typography('caption'), { color: colors.negative, marginTop: 6 }]}>
          {micErrorText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    // Same gutter as every Home card — without it the prompt and field ran
    // flush to the screen edges.
    marginHorizontal: SPACING.xl,
    marginTop: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
    overflow: 'hidden', // clips the glass overlay/highlight to the rounded corners
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  fieldGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  fieldTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    maxHeight: 110,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});

export default HomeAskComposer;
