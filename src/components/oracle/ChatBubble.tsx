/**
 * ChatBubble — one turn in a Reading's conversation.
 * --------------------------------------------------------------------------
 * Presentation only, same discipline as RkpWatchCard/RemedyProtocolCard: a
 * 'sent' oracle message renders those two cards from `message.reading`
 * exactly as returned, nothing recomputed here. `speakableTextFor` (PHASE
 * 5H-R) used to be this file's one piece of original logic — it assembled
 * the text-to-speech string itself by joining prose fields — but now simply
 * relays the server-computed, server-validated `oracle.speakableText`; see
 * its own doc comment for why that moved server-side.
 *
 * An oracle turn comes in two shapes and this file renders both: a reading
 * (the verdict cards) and a follow-up reply (prose, spoken the same way).
 * Which one it is comes from `message.variant`, never from guessing at which
 * fields happen to be populated.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import type { ReadingMessage } from '@stores/readingThreadsStore';
import type { WatchReading } from '../../firebase/watchOracle';
import RkpWatchCard, { STATE_HEADLINE } from './RkpWatchCard';
import RemedyProtocolCard from './RemedyProtocolCard';
import SuggestedQuestionsRow from './SuggestedQuestionsRow';
import VerdictSeal from './VerdictSeal';
import { directionalFocusFor } from '../../data/watchRemedyContext';
import type { SpeakingStatus } from '@hooks/useTextToSpeech';

/**
 * The text a 'sent' oracle message's play/pause button speaks.
 *
 * PHASE 5H-R: reads `oracle.speakableText` directly rather than joining
 * `narration`'s own fields itself, as this function used to. That join was
 * exactly Finding 5H-1
 * (`docs/audit/PHASE_5H_RECONNAISSANCE.md`): the per-field deterministic
 * validator never saw the three-field concatenation this function produced,
 * so a claim split across a field boundary could reach TTS unvalidated even
 * though every individual field passed. The server now performs the
 * identical join and validates the result before this composition ever
 * reaches the client — see responseComposer.ts's own comment on
 * `speakableText`. Falls back to the plain-language state headline both
 * when synthesis produced no narration at all (`oracle` absent) AND when
 * `speakableText` itself is absent (a reading composed before this field
 * existed) — reconstructing the join here for a legacy reading would
 * reopen the exact gap this field closes, so it is never attempted.
 */
export function speakableTextFor(reading: WatchReading): string {
  const speakableText = reading.oracle?.speakableText;
  if (speakableText !== null && speakableText !== undefined) {
    return speakableText;
  }
  return STATE_HEADLINE[reading.verdict.state];
}

/** "1:02 PM" — the bubble timestamp, in the device's own locale. */
export function bubbleTime(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface ChatBubbleProps {
  message: ReadingMessage;
  questionLang: 'en' | 'ur' | 'hi';
  /**
   * The language the Reading was cast in — what its verdict text is written
   * in, so what its narration must be spoken in, whatever language the app is
   * showing now. Defaults to questionLang.
   */
  readingLang?: 'en' | 'ur' | 'hi';
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
  /** Fills the seeker's message box with the tapped suggestion. Never sends. */
  onSelectSuggestedQuestion: (question: string) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  questionLang,
  readingLang,
  onRetry,
  onAskAsNewQuestion,
  ttsStatus,
  ttsActiveMessageId,
  onToggleSpeech,
  onSelectSuggestedQuestion,
}) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

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
          <Text
            style={[
              typography('caption'),
              styles.time,
              { color: colors.textOnPrimary, opacity: 0.7 },
            ]}
          >
            {bubbleTime(message.createdAt)}
          </Text>
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
          <Text style={[typography('caption'), styles.time, { color: colors.textFaint }]}>
            {bubbleTime(message.createdAt)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.rowOracle]}>
      <View
        style={[
          styles.bubble,
          styles.oracleBubble,
          styles.readingBubble,
          { backgroundColor: colors.chatShamsBg, borderColor: colors.borderAccent + '55' },
        ]}
      >
        <View style={styles.senderRow}>
          <Text style={[typography('label'), { color: colors.goldBright }]}>
            {'☉ ' + t('app.name')}
          </Text>
          {reading !== undefined && (
            <Pressable
              onPress={() =>
                onToggleSpeech(message.id, speakableTextFor(reading), readingLang ?? questionLang)
              }
              style={({ pressed }) => [
                styles.speechPill,
                { borderColor: colors.borderAccent, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isSpeaking ? t('oracleChat.pauseNarration') : t('oracleChat.playNarration')
              }
            >
              <Text style={[typography('caption'), { color: colors.goldBright }]}>
                {isSpeaking
                  ? '⏸ ' + t('oracleChat.speaking')
                  : isPaused
                    ? '▶ ' + t('oracleChat.paused')
                    : '▶ ' + t('oracleChat.listenToVerdict')}
              </Text>
            </Pressable>
          )}
        </View>
        {reading !== undefined && (
          <>
            <VerdictSeal verdict={reading.verdict} diagnosis={reading.oracle?.diagnosis} />
            <RkpWatchCard
              showVerdict={false}
              window={reading.window}
              lagnaSignName={reading.lagnaSignName}
              lagnaRulerName={reading.lagnaRulerName}
              verdict={reading.verdict}
              directionalFocus={directionalFocusFor(reading.verdict)}
            />
            {reading.oracle !== undefined && (
              <RemedyProtocolCard composition={reading.oracle} showFinding={false} />
            )}
            {/* PHASE 2B/2B-F: this used to also render a GuidanceCard, fed by
                a second, LLM-driven remedy path — disconnected in 2B,
                its now-unreachable component deleted in 2B-F. See
                docs/audit/PHASE_2B_ENGINE_MIGRATION.md.
                RemedyProtocolCard above is the reading's sole remedy
                presentation. */}
          </>
        )}
        <Text style={[typography('caption'), styles.time, { color: colors.textFaint }]}>
          {bubbleTime(message.createdAt)}
        </Text>
      </View>
      {/* Suggestions sit under the bubble, like quick replies — they are
          offers to the seeker, not part of the Oracle's answer. */}
      {reading?.oracle?.suggestedQuestions !== undefined && (
        <View style={styles.quickReplies}>
          <SuggestedQuestionsRow
            questions={reading.oracle.suggestedQuestions}
            onSelect={onSelectSuggestedQuestion}
          />
        </View>
      )}
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
  readingBubble: {
    // The verdict cards need the width; the bubble still leaves a gutter on
    // the right so it reads as the Oracle's side of the thread.
    maxWidth: '94%',
    width: '94%',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 6,
  },
  speechPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  time: {
    alignSelf: 'flex-end',
    fontSize: 11,
    marginTop: 4,
  },
  quickReplies: {
    width: '94%',
  },
});

export default ChatBubble;
