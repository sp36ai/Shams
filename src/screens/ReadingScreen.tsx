/**
 * ReadingScreen — one Reading, and the conversation belonging to it.
 * --------------------------------------------------------------------------
 * The domain object here is a READING, not a chat. The screen shows what this
 * Reading is (title, moment, method, question), the verdict cast for that
 * moment, and every follow-up asked about it since.
 *
 * Two ways in, and the difference decides everything:
 *
 *   route.params.threadId       → OPEN an existing Reading.
 *                                 Load, restore, display. Nothing is recast
 *                                 and no context is re-derived: a Reading
 *                                 opened three days later shows the moment it
 *                                 was actually cast for.
 *
 *   no threadId (± initialQuestion)
 *                               → BEGIN a new Reading.
 *                                 The thread is created when the seeker
 *                                 SUBMITS, never when they merely open the
 *                                 composer — an abandoned composer must not
 *                                 leave an empty Reading in their history.
 *
 * Which call a send makes follows from that, rather than from a mode the
 * seeker has to choose:
 *
 *     first submit of a thread   → askWatchOracle  (casts a chart, spends a
 *                                  quota slot, renders the verdict cards)
 *     every send after it        → discussReading  (answers a follow-up about
 *                                  the standing reading, spends no quota,
 *                                  renders prose)
 *
 * A follow-up that turns out to be its own horary question is never answered
 * from this Reading and never mutates its context: the oracle flags it, and
 * the seeker can open it as a NEW Reading in one tap.
 *
 * No chart logic lives here. Judgment happens server-side; this screen renders
 * what came back (RkpWatchCard/RemedyProtocolCard via ChatBubble) and files it
 * into the readings archive via toReadingRecord().
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation, useI18n } from '@i18n/I18nProvider';
import { useSettingsStore } from '@stores/settingsStore';
import { useQuota } from '@hooks/useQuota';
import { useQuotaStore } from '@stores/quotaStore';
import { useSpeechToText } from '@hooks/useSpeechToText';
import { useTextToSpeech } from '@hooks/useTextToSpeech';
import {
  useReadingThreadsStore,
  threadById,
  discussionTurnsFor,
  type MessageInputKind,
  type ReadingMessage,
  type ReadingThread,
} from '@stores/readingThreadsStore';
import { useReadingsStore } from '@stores/readingsStore';
import { askWatchOracle, newRequestId, type WatchReading } from '../firebase/watchOracle';
import { discussReading } from '../firebase/oracleDiscussion';
import { toReadingRecord } from '../data/watchReadingRecord';
import { selectRemedies } from '../data/remedySelector';
import { watchVerdictToRankingContext } from '../data/watchRemedyContext';
import { buildShareText, canShare } from '../data/readingShare';
import { readingTitleFor } from '../data/readingTitle';
import { speakableTextFor } from '@components/oracle/ChatBubble';
import StarfieldBackground from '@components/StarfieldBackground';
import ChatBubble from '@components/oracle/ChatBubble';
import ChatComposer from '@components/oracle/ChatComposer';
import ReadingHeader from '@components/oracle/ReadingHeader';

/**
 * Maps a send failure to a message the seeker can act on. Firebase callable
 * errors carry the real signal in `.code` (a stable FunctionsErrorCode),
 * never in `.message` — see watchOracle.ts's own docs on why `.message`
 * alone is not a reliable branch. Exported for direct unit testing.
 */
export function errorMessageFor(err: unknown, t: ReturnType<typeof useTranslation>): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';

  if (code === 'deadline-exceeded') {
    return t('oracleChat.errorTimeout');
  }
  if (code === 'unauthenticated') {
    return t('oracleChat.errorSignIn');
  }
  if (code === 'resource-exhausted') {
    return t('oracleChat.quotaExhausted');
  }
  if (code === 'aborted') {
    // The server holds a claim on this exact submission: an earlier attempt
    // may still be about to succeed, so retrying now is the one thing that
    // could duplicate it. See functions/src/utils/idempotency.ts.
    return t('oracleChat.errorAlreadyRunning');
  }
  if (code === 'unavailable') {
    return t('oracleChat.discussionUnavailable');
  }
  if (code === 'not-found') {
    return t('oracleChat.discussionReadingGone');
  }
  return t('oracleChat.failedGeneric');
}

/** Shown before the first question of a new Reading. */
const EmptyState: React.FC = () => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Text style={[typography('title'), { color: colors.text, textAlign: 'center' }]}>
        {t('oracleChat.emptyTitle')}
      </Text>
      <Text
        style={[
          typography('body'),
          { color: colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 22 },
        ]}
      >
        {t('oracleChat.emptyBody')}
      </Text>
    </View>
  );
};

type ReadingRoute = RouteProp<RootStackParamList, 'Reading'>;

const ReadingScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ReadingRoute>();

  const seekerProfile = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.seekerProfile,
  );
  const { canAsk, consumeOne } = useQuota();
  const addReading = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.addReading,
  );

  const threads = useReadingThreadsStore(s => s.threads);
  const createThread = useReadingThreadsStore(s => s.createThread);
  const addMessage = useReadingThreadsStore(s => s.addMessage);
  const updateMessage = useReadingThreadsStore(s => s.updateMessage);
  const attachReading = useReadingThreadsStore(s => s.attachReading);
  const restateQuestion = useReadingThreadsStore(s => s.restateQuestion);
  const setThreadStatus = useReadingThreadsStore(s => s.setThreadStatus);

  const stt = useSpeechToText(lang);
  const tts = useTextToSpeech();

  /**
   * Which Reading is on screen. Seeded from the route when opening an existing
   * one, and set once the seeker's first question creates a thread. Held in
   * state rather than read from the route every render so the screen keeps
   * working after that first submit without a navigation round trip.
   */
  const [threadId, setThreadId] = useState<string | null>(route.params?.threadId ?? null);

  /*
   * Follow the route.
   *
   * `threadId` is seeded from the params and then owned by this screen, which
   * is what lets the first submit of a new Reading bind its thread without a
   * navigation round trip. The cost is that a screen INSTANCE reused for a
   * different Reading — which React Navigation does whenever a route already
   * on the stack is navigated to again — would keep rendering the old one:
   * the seeker taps a Reading in the list and is shown a different Reading's
   * verdict. Every call site now uses push(), so this should not arise; this
   * makes it structurally impossible rather than merely unlikely.
   */
  const routeThreadId = route.params?.threadId;
  useEffect(() => {
    if (routeThreadId !== undefined && routeThreadId !== threadId) {
      setThreadId(routeThreadId);
    }
  }, [routeThreadId, threadId]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const listRef = useRef<FlatList | null>(null);

  const thread = useMemo(() => threadById(threads, threadId ?? undefined), [threads, threadId]);

  /**
   * The conversation below the header.
   *
   * The question that opened the Reading is deliberately not a bubble: it is
   * the Reading's own question and the header states it. Rendering it again
   * would show the seeker their words twice and make the screen read as a
   * chat that happens to begin with a verdict.
   */
  const messages = useMemo(() => {
    if (thread === null) {
      return [];
    }
    // The LAST cast turn, not the first: a Reading whose chart failed and was
    // then re-asked in different words carries more than one, and the header
    // states the question of the one that stands now.
    const casts = thread.messages.filter(m => m.role === 'oracle' && m.variant !== 'discussion');
    const openingId = casts[casts.length - 1]?.replyToId;
    return openingId === undefined
      ? thread.messages
      : thread.messages.filter(m => m.id !== openingId);
  }, [thread]);

  /**
   * Second, non-blocking round trip: pick the devotional practice that suits
   * this reading, from the app's own tagged Islamic remedy library.
   *
   * Deliberately fired AFTER the verdict is already on screen and never
   * awaited by the ask path — the verdict is the answer, and guidance is an
   * enrichment. A slow or failed selection must not delay or fail a reading
   * that already succeeded, so this swallows its own errors: the bubble
   * simply renders without a GuidanceCard.
   */
  const runGuidanceSelection = useCallback(
    (
      targetThreadId: string,
      oracleMessageId: string,
      question: string,
      reading: WatchReading,
    ): void => {
      const ranking = watchVerdictToRankingContext(reading.verdict, seekerProfile);
      selectRemedies({
        ...ranking,
        readingId: reading.readingId,
        // Never shown to the user — context for the selector only.
        oracleSummary: speakableTextFor(reading).slice(0, 200),
        questionText: question,
        seekerProfile,
      })
        .then(result => {
          if (result.selectedRemedies.length > 0) {
            updateMessage(targetThreadId, oracleMessageId, {
              selectedRemedies: result.selectedRemedies,
            });
          }
        })
        .catch(() => {
          // Enrichment only — the verdict already stands.
        });
    },
    [seekerProfile, updateMessage],
  );

  // ── The two send paths ────────────────────────────────────────────────────

  /** Cast the chart for a thread's opening question. Spends a quota slot. */
  const runAsk = useCallback(
    async (
      targetThreadId: string,
      oracleMessageId: string,
      question: string,
      requestId: string,
    ): Promise<void> => {
      if (!canAsk || !consumeOne()) {
        updateMessage(targetThreadId, oracleMessageId, {
          status: 'failed',
          errorMessage: t('oracleChat.quotaExhausted'),
        });
        setThreadStatus(targetThreadId, 'error');
        return;
      }

      try {
        const result = await askWatchOracle({
          question,
          questionLang: lang,
          // The thread's own id, so a retry — including one after the app was
          // killed mid-call — replays that reading rather than casting and
          // charging for a second one.
          requestId,
          ...(seekerProfile !== null ? { seekerProfile } : {}),
        });
        updateMessage(targetThreadId, oracleMessageId, {
          status: 'sent',
          reading: result.reading,
        });
        // Binds the server's reading id and freezes this Reading's moment.
        attachReading(targetThreadId, result.reading);

        await addReading(
          toReadingRecord({
            id: result.reading.readingId,
            question,
            questionLang: lang,
            createdAt: result.reading.computedAt,
            reading: result.reading,
          }),
        );

        runGuidanceSelection(targetThreadId, oracleMessageId, question, result.reading);
      } catch (err) {
        // consumeOne() already charged the local quota counter before the
        // network call — give it back on failure, same reasoning as the
        // server-side refund for a reading that never landed.
        useQuotaStore.getState().refundOne();
        updateMessage(targetThreadId, oracleMessageId, {
          status: 'failed',
          errorMessage: errorMessageFor(err, t),
        });
        setThreadStatus(targetThreadId, 'error');
      }
    },
    [
      canAsk,
      consumeOne,
      lang,
      seekerProfile,
      updateMessage,
      attachReading,
      setThreadStatus,
      addReading,
      t,
      runGuidanceSelection,
    ],
  );

  /**
   * Answer a follow-up about the reading this thread already carries.
   *
   * Spends no quota — the reading was the charged unit, and understanding it
   * is part of what was bought; the server bounds the conversation instead.
   * Only the reading id and the turns since it travel: the verdict itself is
   * loaded server-side, so the oracle can only discuss a reading it gave.
   */
  const runDiscuss = useCallback(
    async (
      targetThreadId: string,
      oracleMessageId: string,
      userMessageId: string,
      message: string,
      readingId: string,
      requestId: string,
    ): Promise<void> => {
      const current = threadById(useReadingThreadsStore.getState().threads, targetThreadId);
      try {
        const result = await discussReading({
          readingId,
          message,
          lang,
          turns: current === null ? [] : discussionTurnsFor(current, userMessageId),
          // Carried on the oracle message, so a retry — including one after
          // the app was killed — replays this answer rather than spending a
          // second turn from the reading's budget.
          requestId,
        });
        updateMessage(targetThreadId, oracleMessageId, {
          status: 'sent',
          text: result.answer,
          suggestsNewQuestion: result.isNewQuestion,
        });
      } catch (err) {
        updateMessage(targetThreadId, oracleMessageId, {
          status: 'failed',
          errorMessage: errorMessageFor(err, t),
        });
      }
    },
    [lang, updateMessage, t],
  );

  // ── The ONE path every send funnels into ─────────────────────────────────

  const sendMessage = useCallback(
    (text: string, kind: MessageInputKind) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || sendingRef.current) {
        return;
      }
      sendingRef.current = true;
      setSending(true);

      const now = new Date().toISOString();
      const userId = `u_${Date.now()}`;
      const oracleId = `o_${Date.now()}`;

      // A thread exists only once a question has been submitted — this is
      // that moment for a new Reading.
      const existing = threadById(useReadingThreadsStore.getState().threads, threadId ?? undefined);
      const target =
        existing ??
        createThread({
          id: `t_${Date.now()}`,
          requestId: newRequestId(),
          question: trimmed,
          questionLang: lang,
        });
      if (existing === null) {
        setThreadId(target.id);
      }

      // The reading is what a follow-up is about; without one, this send is
      // the thread's opening cast whatever else is on screen.
      const readingId = target.readingId;
      const isFollowUp = readingId !== null;

      // A send into a Reading whose chart never landed, with different words:
      // the seeker is re-asking, not retrying. Two things have to move with
      // the question — the title, or the header would name a matter this
      // Reading is no longer about, and the requestId, because a different
      // question is a different act of asking. Reusing the old id here would
      // be the one way to get the wrong verdict: if the earlier cast actually
      // succeeded server-side and only its response was lost, the server would
      // replay THAT reading as the answer to these new words.
      const isRestatement = !isFollowUp && existing !== null && trimmed !== existing.question;
      const askRequestId = isRestatement ? newRequestId() : target.requestId;
      if (isRestatement) {
        restateQuestion(target.id, trimmed, askRequestId);
      }

      addMessage(target.id, {
        id: userId,
        role: 'user',
        text: trimmed,
        kind,
        createdAt: now,
        status: 'sent',
      });
      // A follow-up gets its own id; the thread's own id belongs to the cast.
      const followUpRequestId = isFollowUp ? newRequestId() : undefined;

      addMessage(target.id, {
        id: oracleId,
        role: 'oracle',
        text: '',
        createdAt: now,
        status: 'sending',
        replyToId: userId,
        variant: isFollowUp ? 'discussion' : 'reading',
        ...(followUpRequestId !== undefined ? { requestId: followUpRequestId } : {}),
      });
      setInputText('');

      const run =
        isFollowUp && followUpRequestId !== undefined
          ? runDiscuss(target.id, oracleId, userId, trimmed, readingId, followUpRequestId)
          : runAsk(target.id, oracleId, trimmed, askRequestId);

      run.finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
    },
    [threadId, lang, createThread, restateQuestion, addMessage, runAsk, runDiscuss],
  );

  const handleSend = useCallback(() => {
    sendMessage(inputText, 'text');
  }, [inputText, sendMessage]);

  /**
   * A question handed over from Home. Submitted once, on mount: Home owns the
   * composer that starts a Reading, this screen owns the Reading itself.
   *
   * The submission happens in an effect, which runs after the first commit —
   * so for one frame there is a question in flight and no thread yet. That
   * frame renders the provisional header below rather than the empty state:
   * arriving from Home must land on the seeker's question, never on a blank
   * "New Reading" that their words then appear in.
   */
  const initialQuestion = route.params?.initialQuestion;
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialSentRef.current || initialQuestion === undefined) {
      return;
    }
    initialSentRef.current = true;
    sendMessage(initialQuestion, 'text');
  }, [initialQuestion, sendMessage]);

  const handleRetry = useCallback(
    (userMessageId: string) => {
      if (sendingRef.current || thread === null) {
        return;
      }
      const userMsg = thread.messages.find(m => m.id === userMessageId);
      const oracleMsg = thread.messages.find(
        m => m.role === 'oracle' && m.replyToId === userMessageId,
      );
      if (userMsg === undefined || oracleMsg === undefined) {
        return;
      }
      sendingRef.current = true;
      setSending(true);
      updateMessage(thread.id, oracleMsg.id, { status: 'sending', errorMessage: undefined });

      // Retry the call this turn actually was, against the SAME thread — a
      // failed follow-up retried as a reading would silently cast a chart and
      // charge for it, and a retried cast must not open a second Reading.
      const run =
        oracleMsg.variant === 'discussion' &&
        thread.readingId !== null &&
        oracleMsg.requestId !== undefined
          ? runDiscuss(
              thread.id,
              oracleMsg.id,
              userMsg.id,
              userMsg.text,
              thread.readingId,
              oracleMsg.requestId,
            )
          : runAsk(thread.id, oracleMsg.id, userMsg.text, thread.requestId);

      run.finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
    },
    [thread, runAsk, runDiscuss, updateMessage],
  );

  /**
   * The oracle declined a follow-up because it is really its own question.
   * That question gets its own Reading, cast for its own moment — this
   * Reading's context is never reused for it.
   */
  const handleAskAsNewReading = useCallback(
    (userMessageId: string) => {
      const userMsg = thread?.messages.find(m => m.id === userMessageId);
      if (userMsg === undefined) {
        return;
      }
      navigation.push('Reading', { initialQuestion: userMsg.text });
    },
    [thread, navigation],
  );

  const handleShare = useCallback(() => {
    if (thread === null || !canShare(thread)) {
      return;
    }
    void Share.share({ message: buildShareText(thread, t('app.name')) });
  }, [thread, t]);

  // ── Voice input — mic toggles STT; the transcript funnels into sendMessage ─

  const handleMicPress = useCallback(() => {
    if (stt.isListening) {
      stt.stop().then(finalText => {
        // Nothing heard — leave whatever partial text is already in the
        // composer (mirrored by the effect below) for the seeker to edit.
        if (finalText.trim().length > 0) {
          sendMessage(finalText, 'voice');
        }
      });
      return;
    }
    void stt.start();
  }, [stt, sendMessage]);

  // Mirror the live partial transcript into the composer while listening, so
  // the seeker sees their words land in real time (still editable once
  // listening stops, before Send is pressed).
  useEffect(() => {
    if (stt.isListening) {
      setInputText(stt.partialText);
    }
  }, [stt.isListening, stt.partialText]);

  const micErrorText =
    stt.error === 'unavailable'
      ? t('oracleChat.voiceUnavailable')
      : stt.error === 'permission-denied'
        ? t('oracleChat.micPermissionDenied')
        : stt.error === 'no-speech'
          ? t('oracleChat.noSpeechDetected')
          : null;

  // ── Scroll to the newest message whenever the list grows ──────────────────
  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const renderMessage = useCallback(
    ({ item }: { item: ReadingMessage }) => (
      <ChatBubble
        message={item}
        questionLang={lang}
        onRetry={handleRetry}
        onAskAsNewQuestion={handleAskAsNewReading}
        ttsStatus={tts.status}
        ttsActiveMessageId={tts.activeMessageId}
        onToggleSpeech={tts.toggle}
      />
    ),
    [lang, handleRetry, handleAskAsNewReading, tts.status, tts.activeMessageId, tts.toggle],
  );

  const shareable = thread !== null && canShare(thread);

  /**
   * What the header shows while a handed-over question is still being filed.
   * Same shape as a real thread, built from the question alone — the moment
   * and the verdict are not known yet and are simply absent, never faked.
   */
  const provisionalThread: ReadingThread | null =
    thread === null && initialQuestion !== undefined
      ? {
          id: 'provisional',
          requestId: '',
          readingId: null,
          title: readingTitleFor(initialQuestion),
          question: initialQuestion,
          questionLang: lang,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'pending',
          context: null,
          messages: [],
        }
      : null;
  const headerThread = thread ?? provisionalThread;
  // Once a reading stands, every send in this Reading is a follow-up.
  const isDiscussMode = thread !== null && thread.readingId !== null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      <View style={[styles.header, { borderColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={[typography('label'), { color: colors.accent, fontSize: 20 }]}>‹</Text>
        </Pressable>
        <Text style={[typography('subheading'), { color: colors.goldBright }]} numberOfLines={1}>
          {headerThread?.title ?? t('reading.newReading')}
        </Text>
        {shareable ? (
          <Pressable
            onPress={handleShare}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('reading.shareReading')}
            testID="reading-share-btn"
          >
            <Text style={[typography('label'), { color: colors.accent }]}>{'↗'}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {headerThread === null ? (
          <EmptyState />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            ListHeaderComponent={<ReadingHeader thread={headerThread} />}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {micErrorText !== null && (
          <View style={[styles.micErrorBanner, { backgroundColor: colors.negative + '18' }]}>
            <Text style={[typography('caption'), { color: colors.negative }]}>{micErrorText}</Text>
          </View>
        )}

        {/*
         * A composer placeholder alone is easy to miss — it's unfocused
         * gray text at the bottom of what can be a long scrolling thread,
         * while attention is naturally on the verdict above. This label
         * sits directly over the input the moment the mode actually
         * changes, so the seeker sees "you can keep talking" without
         * having to notice the placeholder swap first.
         */}
        {isDiscussMode && (
          <Text style={[typography('caption'), styles.discussHint, { color: colors.textFaint }]}>
            {t('oracleChat.modeDiscuss')}
          </Text>
        )}

        <ChatComposer
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          sending={sending}
          isListening={stt.isListening}
          onMicPress={handleMicPress}
          micDisabled={sending}
          micAvailable={stt.isAvailable}
          // Once a reading stands, every send in this Reading is a follow-up.
          mode={isDiscussMode ? 'discuss' : 'ask'}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  micErrorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  discussHint: {
    textAlign: 'center',
    paddingTop: 6,
    paddingHorizontal: 16,
  },
});

export default ReadingScreen;
