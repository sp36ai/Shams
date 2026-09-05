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
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';

interface HomeAskComposerProps {
  /** Called with the trimmed question. Never called with an empty string. */
  onSubmit: (question: string) => void;
  /** Opens an empty Reading — the same destination, without a question yet. */
  onOpenBlank: () => void;
}

const HomeAskComposer: React.FC<HomeAskComposerProps> = ({ onSubmit, onOpenBlank }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    // Cleared immediately: the question now belongs to the Reading it opened,
    // and coming back to Home should not offer to ask it a second time.
    setText('');
    onSubmit(trimmed);
  }, [text, onSubmit]);

  return (
    <View style={styles.wrap}>
      <Text style={[typography('body'), { color: colors.textMuted, marginBottom: 10 }]}>
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
          placeholder={t('oracle.askPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSubmit}
          testID="home-ask-input"
        />
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
          <Text
            style={[
              typography('label'),
              { color: canSend ? colors.textOnPrimary : colors.goldBright, fontSize: 16 },
            ]}
          >
            {'↑'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
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
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});

export default HomeAskComposer;
