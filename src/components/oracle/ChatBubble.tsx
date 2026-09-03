/**
 * ChatBubble — one turn in the Oracle Chat conversation.
 * --------------------------------------------------------------------------
 * Presentation only, same discipline as RkpWatchCard/RemedyProtocolCard: a
 * 'sent' oracle message renders those two cards from `message.reading`
 * exactly as returned, nothing recomputed here. This file's only original
 * logic is `speakableTextFor`, which concatenates already-composed prose
 * fields into one string for text-to-speech — string assembly, not judgment.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import en from '../../i18n/strings/en';
import ur from '../../i18n/strings/ur';
import hi from '../../i18n/strings/hi';
import type { ChatMessage } from '@stores/oracleChatStore';
import type { WatchReading } from '../../firebase/watchOracle';
import RkpWatchCard, { STATE_HEADLINE } from './RkpWatchCard';
import RemedyProtocolCard from './RemedyProtocolCard';
import GuidanceCard from './GuidanceCard';
import { directionalFocusFor } from '../../data/watchRemedyContext';
import type { SpeakingStatus } from '@hooks/useTextToSpeech';

/**
 * Per-language cycling captions for the 'sending' bubble. Looked up directly
 * rather than through useTranslation() because the translate function is
 * typed to leaf strings; this is the one place that needs the whole array.
 */
const READING_CHART_STEPS: Readonly<Record<'en' | 'ur' | 'hi', readonly string[]>> = {
  en: en.oracleChat.readingChartSteps,
  ur: ur.oracleChat.readingChartSteps,
  hi: hi.oracleChat.readingChartSteps,
};

/**
 * Cycles through READING_CHART_STEPS every 5s while mounted. Deliberately an
 * indeterminate loop, not a fixed one-shot sequence: askWatchOracle can take
 * up to ~45s (Anthropic narration synthesis is the real long pole), so a
 * fixed sequence would finish and leave the bubble static long before the
 * real response can arrive. Local, ephemeral component state — never touches
 * oracleChatStore, which persists every change to MMKV on disk.
 */
function useCyclingCaption(lang: 'en' | 'ur' | 'hi', active: boolean): string {
  const steps = READING_CHART_STEPS[lang];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    setIndex(0);
    const id = setInterval(() => {
      setIndex(prev => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(id);
  }, [active, steps.length]);

  return steps[index] ?? steps[0]!;
}

/**
 * The text a 'sent' oracle message's play/pause button speaks. Prefers the
 * full narration prose; falls back to the plain-language state headline
 * when synthesis didn't produce one (`oracle` absent — a degraded but
 * intact protocol still has a verdict worth reading aloud).
 */
export function speakableTextFor(reading: WatchReading): string {
  const narration = reading.oracle?.narration;
  if (narration !== null && narration !== undefined) {
    return [narration.rkp_finding, narration.interpretation, narration.recommended_approach]
      .filter(s => s.length > 0)
      .join('. ');
  }
  return STATE_HEADLINE[reading.verdict.state];
}

interface ChatBubbleProps {
  message: ChatMessage;
  questionLang: 'en' | 'ur' | 'hi';
  onRetry: (userMessageId: string) => void;
  ttsStatus: SpeakingStatus;
  ttsActiveMessageId: string | null;
  onToggleSpeech: (messageId: string, text: string, lang: 'en' | 'ur' | 'hi') => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  questionLang,
  onRetry,
  ttsStatus,
  ttsActiveMessageId,
  onToggleSpeech,
}) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const isUser = message.role === 'user';
  const cyclingCaption = useCyclingCaption(questionLang, !isUser && message.status === 'sending');

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={[styles.bubble, styles.userBubble, { backgroundColor: colors.accent }]}>
          {message.kind === 'voice' && (
            <Text style={[typography('caption'), { color: colors.textOnPrimary, opacity: 0.75 }]}>
              {'🎙 ' + t('oracleChat.voiceInputTag')}
            </Text>
          )}
          <Text style={[typography('body'), { color: colors.textOnPrimary }]}>{message.text}</Text>
        </View>
      </View>
    );
  }

  // Oracle turn — sending / failed / sent.
  if (message.status === 'sending') {
    return (
      <View style={[styles.row, styles.rowOracle]}>
        <View
          style={[
            styles.bubble,
            styles.oracleBubble,
            styles.pendingBubble,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[typography('caption'), { color: colors.textMuted, marginLeft: 8 }]}>
            {cyclingCaption}
          </Text>
        </View>
      </View>
    );
  }

  if (message.status === 'failed') {
    return (
      <View style={[styles.row, styles.rowOracle]}>
        <View
          style={[
            styles.bubble,
            styles.oracleBubble,
            { backgroundColor: colors.surface, borderColor: colors.negative + '55' },
          ]}
        >
          <Text style={[typography('body'), { color: colors.textMuted }]}>
            {message.errorMessage ?? t('oracleChat.failedGeneric')}
          </Text>
          {message.replyToId !== undefined && (
            <Pressable
              onPress={() => onRetry(message.replyToId!)}
              style={({ pressed }) => [styles.retryBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t('oracleChat.retry')}
            >
              <Text style={[typography('label'), { color: colors.accent }]}>
                {'↻ ' + t('oracleChat.retry')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // 'sent' — full reading, if present.
  const reading = message.reading;
  const isSpeaking = ttsActiveMessageId === message.id && ttsStatus === 'speaking';
  const isPaused = ttsActiveMessageId === message.id && ttsStatus === 'paused';

  return (
    <View style={[styles.row, styles.rowOracle]}>
      <View style={styles.oracleColumn}>
        {reading !== undefined && (
          <>
            <View style={styles.speechRow}>
              <Pressable
                onPress={() => onToggleSpeech(message.id, speakableTextFor(reading), questionLang)}
                style={({ pressed }) => [
                  styles.speechBtn,
                  { borderColor: colors.borderAccent, opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isSpeaking ? t('oracleChat.pauseNarration') : t('oracleChat.playNarration')
                }
              >
                <Text style={[typography('label'), { color: colors.goldBright }]}>
                  {isSpeaking ? '⏸' : '▶'}
                </Text>
              </Pressable>
              <Text style={[typography('caption'), { color: colors.textFaint, marginLeft: 6 }]}>
                {isSpeaking
                  ? t('oracleChat.speaking')
                  : isPaused
                    ? t('oracleChat.paused')
                    : t('oracleChat.listenToVerdict')}
              </Text>
            </View>
            <RkpWatchCard
              window={reading.window}
              lagnaSignName={reading.lagnaSignName}
              lagnaRulerName={reading.lagnaRulerName}
              verdict={reading.verdict}
              directionalFocus={directionalFocusFor(reading.verdict)}
              transitCoordinates={reading.transitCoordinates}
            />
            {reading.oracle !== undefined && <RemedyProtocolCard composition={reading.oracle} />}
            {message.selectedRemedies !== undefined && (
              <GuidanceCard remedies={message.selectedRemedies} />
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowOracle: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  oracleBubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 4,
  },
  pendingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  oracleColumn: {
    width: '100%',
  },
  speechRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 4,
  },
  speechBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatBubble;
