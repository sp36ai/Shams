/**
 * ChatBubble — one turn in a Reading's conversation.
 * --------------------------------------------------------------------------
 * Presentation only, same discipline as RkpWatchCard/RemedyProtocolCard: a
 * 'sent' oracle message renders those two cards from `message.reading`
 * exactly as returned, nothing recomputed here. This file's only original
 * logic is `speakableTextFor`, which concatenates already-composed prose
 * fields into one string for text-to-speech — string assembly, not judgment.
 *
 * An oracle turn comes in two shapes and this file renders both: a reading
 * (the verdict cards) and a follow-up reply (prose, spoken the same way).
 * Which one it is comes from `message.variant`, never from guessing at which
 * fields happen to be populated.
 */

import React, { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PressDepth } from '@components/material/PressDepth';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import type { ReadingMessage } from '@stores/readingThreadsStore';
import type { WatchReading } from '../../firebase/watchOracle';
import RkpWatchCard, { STATE_HEADLINE, stateColorFor } from './RkpWatchCard';
import RemedyProtocolCard from './RemedyProtocolCard';
import GuidanceCard from './GuidanceCard';
import { DimensionalReveal } from '@components/material/DimensionalReveal';
import { GlassSurface } from '@components/material/GlassSurface';
import { directionalFocusFor } from '../../data/watchRemedyContext';
import type { SpeakingStatus } from '@hooks/useTextToSpeech';

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
  message: ReadingMessage;
  questionLang: 'en' | 'ur' | 'hi';
  onRetry: (userMessageId: string) => void;
  /**
   * Open a follow-up the oracle declined to answer as its OWN Reading, cast
   * for its own moment. A new chart and a quota slot — so it is always an
   * explicit tap, never something this bubble does on the seeker's behalf.
   */
  onAskAsNewQuestion: (userMessageId: string) => void;
  ttsStatus: SpeakingStatus;
  ttsActiveMessageId: string | null;
  onToggleSpeech: (messageId: string, text: string, lang: 'en' | 'ur' | 'hi') => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  questionLang,
  onRetry,
  onAskAsNewQuestion,
  ttsStatus,
  ttsActiveMessageId,
  onToggleSpeech,
}) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  /*
   * The real "just arrived this session" signal DimensionalReveal needed —
   * not guessed at, derived from the store's own MessageStatus lifecycle.
   * List rendering keys each bubble by message.id, so React reuses this same
   * component instance across the 'sending' → 'sent' transition; a message
   * hydrated from history/cache mounts directly as 'sent' and never passes
   * through this instance as 'sending' at all. Captured once, on first
   * render — a later status change on the SAME instance doesn't retrigger
   * it, so a message doesn't replay its own arrival on an unrelated re-render
   * (e.g. the TTS status changing while this reading is on screen).
   */
  const wasArrivingRef = useRef(message.status === 'sending');

  const isUser = message.role === 'user';

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
    // A real chart cast (askWatchOracle) gets the glass/3D calculation
    // treatment — the "Oracle calculation state" priority zone. A discussion
    // reply (discussReading) is prose-only and cheap, so it stays the plain
    // bubble it always was: not every pending state deserves the same weight.
    const isCasting = message.variant !== 'discussion';
    return (
      <View style={[styles.row, styles.rowOracle]}>
        <View
          style={[
            styles.bubble,
            styles.oracleBubble,
            styles.pendingBubble,
            isCasting ? styles.castingBubble : null,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              ...(isCasting ? { shadowColor: colors.sacredGlow } : null),
            },
          ]}
        >
          {isCasting && (
            <>
              <View
                pointerEvents="none"
                style={[styles.glassOverlay, { backgroundColor: colors.manuscriptFog }]}
              />
              <View
                pointerEvents="none"
                style={[styles.topHighlight, { backgroundColor: colors.text + '14' }]}
              />
            </>
          )}
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[typography('caption'), { color: colors.textMuted, marginLeft: 8 }]}>
            {message.variant === 'discussion'
              ? t('oracleChat.considering')
              : t('oracleChat.readingChart')}
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

  // 'sent' — a reading, or a follow-up reply.
  const reading = message.reading;
  const isSpeaking = ttsActiveMessageId === message.id && ttsStatus === 'speaking';
  const isPaused = ttsActiveMessageId === message.id && ttsStatus === 'paused';

  if (message.variant === 'discussion') {
    return (
      <View style={[styles.row, styles.rowOracle]}>
        <View
          style={[
            styles.bubble,
            styles.oracleBubble,
            styles.discussionBubble,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[typography('body'), { color: colors.text, lineHeight: 22 }]}>
            {message.text}
          </Text>

          {/*
            A suggestion, never a redirection. The oracle has already answered
            in this Reading; this only offers the matter its own chart. Doing
            nothing keeps the seeker exactly where they are, which is why
            "continue" is not a button — continuing is what happens if they
            ignore this and keep typing.
          */}
          {message.suggestsNewQuestion === true && message.replyToId !== undefined && (
            <View style={[styles.suggestionBlock, { borderTopColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.textMuted }]}>
                {t('oracleChat.separateQuestionNote')}
              </Text>
              <Pressable
                onPress={() => onAskAsNewQuestion(message.replyToId!)}
                style={({ pressed }) => [styles.newQuestionBtn, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={t('oracleChat.askAsNewQuestion')}
                testID="oracle-chat-ask-as-new"
              >
                <Text style={[typography('label'), { color: colors.goldBright }]}>
                  {'✦ ' + t('oracleChat.askAsNewQuestion')}
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => onToggleSpeech(message.id, message.text, questionLang)}
            style={({ pressed }) => [styles.discussionSpeechBtn, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={
              isSpeaking ? t('oracleChat.pauseNarration') : t('oracleChat.playNarration')
            }
          >
            <Text style={[typography('caption'), { color: colors.textFaint }]}>
              {isSpeaking
                ? '⏸ ' + t('oracleChat.speaking')
                : isPaused
                  ? '▶ ' + t('oracleChat.paused')
                  : '▶ ' + t('oracleChat.listenToVerdict')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.rowOracle]}>
      <View style={styles.oracleColumn}>
        {reading !== undefined && (
          <>
            <View style={styles.speechRow}>
              {/* The reading's own play/pause control — one of the flagship's
                  named tactile controls (§19), so it gets PressDepth rather
                  than a plain opacity fade. The discussion-reply and retry/
                  follow-up buttons below stay on Pressable: they sit outside
                  the verdict-reading surface itself, and converting every
                  Pressable in the file wasn't attempted just to be exhaustive. */}
              <PressDepth
                onPress={() => onToggleSpeech(message.id, speakableTextFor(reading), questionLang)}
                style={[styles.speechBtn, { borderColor: colors.borderAccent }]}
                accessibilityRole="button"
                accessibilityLabel={
                  isSpeaking ? t('oracleChat.pauseNarration') : t('oracleChat.playNarration')
                }
              >
                <Text style={[typography('label'), { color: colors.goldBright }]}>
                  {isSpeaking ? '⏸' : '▶'}
                </Text>
              </PressDepth>
              <Text style={[typography('caption'), { color: colors.textFaint, marginLeft: 6 }]}>
                {isSpeaking
                  ? t('oracleChat.speaking')
                  : isPaused
                    ? t('oracleChat.paused')
                    : t('oracleChat.listenToVerdict')}
              </Text>
            </View>
            {/*
              §09: one continuous reading surface, not three stacked glass
              cards. A single shared GlassSurface + DimensionalReveal wraps
              all three cards in `bare` mode — every field each card renders
              is unchanged; only the chrome (glass wrapper, shadow, and
              RemedyProtocolCard's competing headline size) is unified.
              Hierarchy inside: RkpWatchCard's headline is the one Verdict
              (with its reserved glow, §05); RemedyProtocolCard's own
              diagnosis-outcome headline is demoted to a supporting label;
              GuidanceCard was already the most subordinate of the three.

              DimensionalReveal now uses wasArrivingRef (derived above from
              the store's own MessageStatus, not guessed) — it animates only
              for a reading that was still 'sending' when this bubble first
              mounted, i.e. genuinely arriving this session. A reading
              reopened from history/cache mounts already 'sent' and renders
              at rest immediately, per the spec's own rule that a settled
              reading never replays its arrival.
            */}
            <DimensionalReveal animate={wasArrivingRef.current}>
              <GlassSurface
                tint={stateColorFor(reading.verdict.state, colors)}
                accessibilityRole="summary"
                style={[styles.readingSurface, { borderColor: colors.border }]}
              >
                <RkpWatchCard
                  bare
                  window={reading.window}
                  lagnaSignName={reading.lagnaSignName}
                  lagnaRulerName={reading.lagnaRulerName}
                  verdict={reading.verdict}
                  directionalFocus={directionalFocusFor(reading.verdict)}
                />
                {reading.oracle !== undefined && (
                  <>
                    <View style={[styles.sectionRule, { backgroundColor: colors.border }]} />
                    <RemedyProtocolCard bare composition={reading.oracle} />
                  </>
                )}
                {message.selectedRemedies !== undefined && (
                  <>
                    <View style={[styles.sectionRule, { backgroundColor: colors.border }]} />
                    <GuidanceCard bare remedies={message.selectedRemedies} />
                  </>
                )}
              </GlassSurface>
            </DimensionalReveal>
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
  // §09's single reading envelope — one glass surface for verdict through
  // remedy, replacing three separately-wrapped cards.
  readingSurface: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginTop: 12,
  },
  // Hairline divider between sections inside the merged envelope — the
  // visual signal that these are parts of one reading, not separate cards.
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
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
  castingBubble: {
    overflow: 'hidden', // clips the glass overlay/highlight to the rounded corners
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  discussionBubble: {
    maxWidth: '92%',
  },
  suggestionBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  newQuestionBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  discussionSpeechBtn: {
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
