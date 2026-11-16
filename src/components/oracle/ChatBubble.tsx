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

import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import TabIcon from '@components/TabIcon';
import type { ReadingMessage } from '@stores/readingThreadsStore';
import type { WatchReading } from '../../firebase/watchOracle';
import RkpWatchCard, { STATE_HEADLINE } from './RkpWatchCard';
import RemedyProtocolCard from './RemedyProtocolCard';
import SuggestedQuestionsRow from './SuggestedQuestionsRow';
import VerdictSeal from './VerdictSeal';
import { Glyph, SealGlyph, useReadingText } from './readingDesign';
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
   * Shown on a failed turn so a screenshot can be matched to the server's
   * failure log for that request (see utils/requestRef). Not shown otherwise.
   */
  failureRef?: string;
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
  /**
   * Long-press copy of a text bubble (the seeker's words, or a follow-up
   * reply). Absent → bubbles are not copyable. Verdict cards are not copied
   * here; the Reading's own Share action covers those.
   */
  onCopyText?: (text: string) => void;
  /** Narration progress (0–1) of the ACTIVE message; null when nothing plays. */
  ttsProgress?: number | null;
}

/**
 * How long after it arrived a verdict still plays its reveal. A Reading opened
 * later shows its seal already open; one that has just landed unveils it.
 */
export const REVEAL_WINDOW_MS = 2 * 60 * 1000;

export function isFreshVerdict(createdAtIso: string, now: number = Date.now()): boolean {
  const at = Date.parse(createdAtIso);
  return !Number.isNaN(at) && now - at >= 0 && now - at < REVEAL_WINDOW_MS;
}

/** A thin bar under the play control, filled to how far narration has got. */
const NarrationProgress: React.FC<{ progress: number }> = ({ progress }) => {
  const colors = useColors();
  const percent = Math.round(progress * 100);
  return (
    <View
      style={[styles.progressTrack, { backgroundColor: colors.border }]}
      testID="narration-progress"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View
        style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.goldBright }]}
      />
    </View>
  );
};

/**
 * The casting loader (design 8b): an arc turning round a dashed ring that
 * turns the other way, about a softly pulsing orb. Loops only while this
 * message is casting; with Reduce Motion it stands still.
 */
const CastingOrb: React.FC = () => {
  const colors = useColors();
  const spin = useRef(new Animated.Value(0)).current;
  const counter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let loops: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduced => {
        if (cancelled || reduced) {
          return;
        }
        const linear = (value: Animated.Value, duration: number) =>
          Animated.loop(
            Animated.timing(value, {
              toValue: 1,
              duration,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          );
        loops = Animated.parallel([
          linear(spin, 2800),
          linear(counter, 18000),
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulse, {
                toValue: 1,
                duration: 1200,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(pulse, {
                toValue: 0,
                duration: 1200,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
          ),
        ]);
        loops.start();
      });
    return () => {
      cancelled = true;
      loops?.stop();
    };
  }, [spin, counter, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRotate = counter.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View
      style={styles.orb}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={ORB} height={ORB} viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="49" stroke={colors.border} strokeWidth={0.8} fill="none" />
          <Circle
            cx="50"
            cy="50"
            r="49"
            stroke={colors.goldBright}
            strokeWidth={1}
            fill="none"
            strokeDasharray={`${Math.PI * 49 * 0.5} ${Math.PI * 49 * 2}`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: counterRotate }] }]}>
        <Svg width={ORB} height={ORB} viewBox="0 0 100 100">
          <Circle
            cx="50"
            cy="50"
            r="42"
            stroke={colors.brass}
            strokeWidth={0.8}
            strokeDasharray="3 3"
            fill="none"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.orbCore,
          {
            backgroundColor: colors.accent,
            shadowColor: colors.sacredGlow,
            transform: [{ scale }],
          },
        ]}
      >
        <SealGlyph size={ORB_CORE * 0.5} variant="mini" color="transparent" hiColor={colors.bg} />
      </Animated.View>
    </View>
  );
};

/** "THE ORACLE · 21:15" — who is speaking, and when. */
const AuthorRow: React.FC<{
  label: string;
  time: string;
  children?: React.ReactNode;
}> = ({ label, time, children }) => {
  const colors = useColors();
  const text = useReadingText();
  return (
    <View style={styles.authorRow}>
      <SealGlyph size={22} variant="mini" color={colors.accent} />
      <Text style={[text.eyebrow, styles.authorLabel, { color: colors.accent }]} numberOfLines={1}>
        {time.length > 0 ? `${label} · ${time}` : label}
      </Text>
      {children}
    </View>
  );
};

/** The Listen / Pause pill (design AudioControl). */
const ListenPill: React.FC<{
  isSpeaking: boolean;
  isPaused: boolean;
  onPress: () => void;
  quiet?: boolean;
}> = ({ isSpeaking, isPaused, onPress, quiet = false }) => {
  const colors = useColors();
  const text = useReadingText();
  const t = useTranslation();
  const label = isSpeaking
    ? t('oracleChat.speaking')
    : isPaused
      ? t('oracleChat.paused')
      : t('oracleChat.listenToVerdict');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listenPill,
        {
          borderColor: quiet ? colors.border : colors.accent,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        isSpeaking ? t('oracleChat.pauseNarration') : t('oracleChat.playNarration')
      }
      hitSlop={6}
    >
      <View style={[styles.listenDisc, { backgroundColor: colors.accent }]}>
        <Glyph name={isSpeaking ? 'pause' : 'play'} color={colors.textOnPrimary} size={14} />
      </View>
      <Text style={[text.meta, { color: colors.goldBright }]}>{label}</Text>
    </Pressable>
  );
};

const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  questionLang,
  readingLang,
  onRetry,
  failureRef,
  onAskAsNewQuestion,
  ttsStatus,
  ttsActiveMessageId,
  onToggleSpeech,
  onSelectSuggestedQuestion,
  onCopyText,
  ttsProgress = null,
}) => {
  const colors = useColors();
  const typography = useTypography();
  const text = useReadingText();
  const t = useTranslation();

  const isUser = message.role === 'user';
  const time = bubbleTime(message.createdAt);

  if (isUser) {
    const meta = [time, message.kind === 'voice' ? t('oracleChat.voiceInputTag') : '']
      .filter(part => part.length > 0)
      .join(' · ');
    return (
      <View style={[styles.row, styles.rowUser]}>
        <Pressable
          onLongPress={onCopyText !== undefined ? () => onCopyText(message.text) : undefined}
          disabled={onCopyText === undefined}
          accessibilityHint={onCopyText !== undefined ? t('oracleChat.copyHint') : undefined}
          style={[
            styles.userBubble,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
          testID="chat-bubble-user"
        >
          <Text style={[typography('body'), { color: colors.text }]}>{message.text}</Text>
        </Pressable>
        <View style={styles.userMeta}>
          {message.kind === 'voice' && <TabIcon name="mic" size={11} color={colors.textMuted} />}
          {meta.length > 0 && <Text style={[text.meta, { color: colors.textMuted }]}>{meta}</Text>}
        </View>
      </View>
    );
  }

  // Oracle turn — sending / failed / sent.
  if (message.status === 'sending') {
    // A real chart cast (askWatchOracle) gets the casting loader; a
    // discussion reply (discussReading) is prose-only and cheap, so it stays
    // a quiet line in the Oracle's bubble.
    if (message.variant !== 'discussion') {
      return (
        <View style={[styles.row, styles.casting]} testID="chat-casting">
          <CastingOrb />
          <Text style={[text.eyebrow, styles.centred, { color: colors.accent }]}>
            {t('oracleChat.readingChart')}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.row, styles.rowOracle]}>
        <View
          style={[
            styles.oracleCard,
            styles.pendingCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[typography('caption'), { color: colors.textMuted, marginLeft: 8 }]}>
            {t('oracleChat.considering')}
          </Text>
        </View>
      </View>
    );
  }

  if (message.status === 'failed') {
    // A declined question is the Oracle speaking, not a failure: it reads as
    // the Oracle's own words, without the error treatment.
    if (message.declined === true) {
      return (
        <View style={[styles.row, styles.rowOracle]}>
          <View
            style={[
              styles.oracleCard,
              styles.proseCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <AuthorRow label={t('app.name')} time={time} />
            <Text style={[typography('body'), styles.prose, { color: colors.text }]}>
              {message.errorMessage ?? t('oracleChat.failedGeneric')}
            </Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.row}>
        <View
          style={[
            styles.errorCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          testID="chat-error-card"
        >
          <View style={[styles.eclipse, { borderColor: colors.negative }]}>
            <Glyph name="eclipse" color={colors.negative} bgColor={colors.surface} size={22} />
          </View>
          <Text style={[typography('body'), styles.centred, { color: colors.textMuted }]}>
            {message.errorMessage ?? t('oracleChat.failedGeneric')}
          </Text>
          {failureRef !== undefined && (
            <Text selectable style={[text.meta, styles.centred, { color: colors.textMuted }]}>
              {t('oracleChat.failureRef', { ref: failureRef })}
            </Text>
          )}
          {message.replyToId !== undefined && (
            <Pressable
              onPress={() => onRetry(message.replyToId!)}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('oracleChat.retry')}
            >
              <Glyph name="retry" color={colors.textOnPrimary} size={15} />
              <Text style={[text.button, { color: colors.textOnPrimary }]}>
                {t('oracleChat.retry')}
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
  const narrationProgress =
    ttsActiveMessageId === message.id && ttsProgress !== null ? ttsProgress : null;

  if (message.variant === 'discussion') {
    return (
      <View style={[styles.row, styles.rowOracle]}>
        <Pressable
          onLongPress={onCopyText !== undefined ? () => onCopyText(message.text) : undefined}
          disabled={onCopyText === undefined}
          accessibilityHint={onCopyText !== undefined ? t('oracleChat.copyHint') : undefined}
          testID="chat-bubble-discussion"
          style={[
            styles.oracleCard,
            styles.proseCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AuthorRow label={t('app.name')} time={time}>
            <ListenPill
              quiet
              isSpeaking={isSpeaking}
              isPaused={isPaused}
              onPress={() => onToggleSpeech(message.id, message.text, questionLang)}
            />
          </AuthorRow>
          {narrationProgress !== null && <NarrationProgress progress={narrationProgress} />}
          <Text style={[typography('body'), styles.prose, { color: colors.text }]}>
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
            <View
              style={[styles.newQuestionCard, { borderColor: colors.accent }]}
              testID="new-question-card"
            >
              <Text style={[typography('caption'), { color: colors.textMuted }]}>
                {t('oracleChat.separateQuestionNote')}
              </Text>
              <Pressable
                onPress={() => onAskAsNewQuestion(message.replyToId!)}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  styles.primaryBtnStart,
                  { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('oracleChat.askAsNewQuestion')}
                testID="oracle-chat-ask-as-new"
              >
                <Text style={[text.button, { color: colors.textOnPrimary }]}>
                  {t('oracleChat.askAsNewQuestion')}
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.rowOracle]}>
      <View
        style={[
          styles.oracleCard,
          styles.readingCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="chat-oracle-reading"
      >
        <View style={styles.readingAuthor}>
          <AuthorRow label={t('app.name')} time={time}>
            {reading !== undefined && (
              <ListenPill
                isSpeaking={isSpeaking}
                isPaused={isPaused}
                onPress={() =>
                  onToggleSpeech(message.id, speakableTextFor(reading), readingLang ?? questionLang)
                }
              />
            )}
          </AuthorRow>
          {narrationProgress !== null && <NarrationProgress progress={narrationProgress} />}
        </View>
        {reading !== undefined && (
          <>
            <VerdictSeal
              verdict={reading.verdict}
              diagnosis={reading.oracle?.diagnosis}
              reveal={isFreshVerdict(message.createdAt)}
            />
            {reading.oracle !== undefined && (
              <RemedyProtocolCard composition={reading.oracle} showFinding={false} flush />
            )}
            <RkpWatchCard
              flush
              showVerdict={false}
              window={reading.window}
              lagnaSignName={reading.lagnaSignName}
              lagnaRulerName={reading.lagnaRulerName}
              verdict={reading.verdict}
              directionalFocus={directionalFocusFor(reading.verdict)}
            />
            {/* PHASE 2B/2B-F: this used to also render a GuidanceCard, fed by
                a second, LLM-driven remedy path — disconnected in 2B,
                its now-unreachable component deleted in 2B-F. See
                docs/audit/PHASE_2B_ENGINE_MIGRATION.md.
                RemedyProtocolCard above is the reading's sole remedy
                presentation. */}
          </>
        )}
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

const ORB = 120;
const ORB_CORE = 62;

const styles = StyleSheet.create({
  row: {
    marginVertical: 7,
    paddingHorizontal: 12,
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowOracle: {
    alignItems: 'flex-start',
  },
  centred: {
    textAlign: 'center',
  },
  // User bubble — 20/20/6/20, the tail corner toward the seeker's side.
  userBubble: {
    maxWidth: '82%',
    borderWidth: StyleSheet.hairlineWidth,
    borderTopStartRadius: 20,
    borderTopEndRadius: 20,
    borderBottomEndRadius: 6,
    borderBottomStartRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  // Oracle card — 6/22/22/22, the tail corner toward the Oracle's side.
  oracleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopStartRadius: 6,
    borderTopEndRadius: 22,
    borderBottomEndRadius: 22,
    borderBottomStartRadius: 22,
    overflow: 'hidden',
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  proseCard: {
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  prose: {
    marginTop: 10,
  },
  readingCard: {
    width: '100%',
  },
  readingAuthor: {
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorLabel: {
    flex: 1,
  },
  listenPill: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingStart: 5,
    paddingEnd: 12,
  },
  listenDisc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casting: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
  },
  orb: {
    width: ORB,
    height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCore: {
    width: ORB_CORE,
    height: ORB_CORE,
    borderRadius: ORB_CORE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 10,
  },
  eclipse: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 26,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnStart: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  newQuestionCard: {
    marginTop: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 14,
  },
  quickReplies: {
    width: '100%',
    marginTop: 4,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    marginTop: 8,
    marginBottom: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
  },
});

export default ChatBubble;
