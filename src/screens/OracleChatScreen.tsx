/**
 * OracleChatScreen — the oracle question/verdict conversation.
 * --------------------------------------------------------------------------
 * Reached from the home dashboard's "Ask New Question" CTA. Holds everything
 * specific to a single sitting with the oracle: the chat-style message list,
 * the composer (text + voice), and the verdict bubbles. The home dashboard
 * (OracleScreen) stays a lightweight status surface and never renders a
 * conversation itself.
 *
 * Architecture — deliberately thin:
 *
 *     TEXT ─┐                                     ┌─ TEXT (bubble)
 *           ├─► question string ─► askWatchOracle ─┤
 *   VOICE ──┘   (same call, either path)           └─ AUDIO (TTS playback)
 *
 * Voice input is transcribed to text by useSpeechToText and handed to the
 * exact same sendMessage() path a typed question uses — this screen never
 * branches on how a question arrived once it has the text. No chart/KP
 * logic lives here: judgment happens entirely server-side in askWatchOracle,
 * and rendering the result is delegated to RkpWatchCard/RemedyProtocolCard
 * (via ChatBubble) and to the toReadingRecord() mapper for History.
 *
 * TWO KINDS OF SEND
 *   A sitting with the oracle is a conversation, not a vending machine: the
 *   seeker asks, receives a reading, and then wants to talk about it. So a
 *   send is one of two things, chosen explicitly in the composer's mode row:
 *
 *     ASK      → askWatchOracle   — casts a chart for this moment, spends a
 *                                   quota slot, renders the verdict cards.
 *     DISCUSS  → discussReading   — answers a follow-up about the reading
 *                                   already standing, spends no quota,
 *                                   renders prose. Bounded server-side.
 *
 *   The mode row appears only once a reading exists, and defaults to DISCUSS
 *   from that point — the common next message after a verdict is "why?", not
 *   an unrelated new question. The seeker can always switch back, and the
 *   oracle itself flags a follow-up that is really a new question, which the
 *   bubble turns into an explicit "ask as a new question" tap.
 *
 *   Both paths still funnel through one sendMessage(): the pair of bubbles,
 *   the re-entrancy guard, and the failure/retry handling are identical, and
 *   only the network call and what the oracle bubble carries differ.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
  useOracleChatStore,
  selectIsEmpty,
  latestReadingId,
  discussionTurnsFor,
  type ChatInputKind,
} from '@stores/oracleChatStore';
import { useReadingsStore } from '@stores/readingsStore';
import { askWatchOracle, type WatchReading } from '../firebase/watchOracle';
import { discussReading } from '../firebase/oracleDiscussion';
import { toReadingRecord } from '../data/watchReadingRecord';
import { selectRemedies } from '../data/remedySelector';
import { watchVerdictToRankingContext } from '../data/watchRemedyContext';
import { speakableTextFor } from '@components/oracle/ChatBubble';
import StarfieldBackground from '@components/StarfieldBackground';
import ChatBubble from '@components/oracle/ChatBubble';
import ChatComposer, { type ComposerMode } from '@components/oracle/ChatComposer';

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
  if (code === 'unavailable') {
    return t('oracleChat.discussionUnavailable');
  }
  if (code === 'not-found') {
    return t('oracleChat.discussionReadingGone');
  }
  return t('oracleChat.failedGeneric');
}

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

const OracleChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const seekerProfile = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.seekerProfile,
  );
  const { canAsk, consumeOne } = useQuota();
  const addReading = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.addReading,
  );

  const messages = useOracleChatStore(s => s.messages);
  const addMessage = useOracleChatStore(s => s.addMessage);
  const updateMessage = useOracleChatStore(s => s.updateMessage);
  const isEmpty = useOracleChatStore(selectIsEmpty);

  const stt = useSpeechToText(lang);
  const tts = useTextToSpeech();

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const listRef = useRef<FlatList | null>(null);

  /**
   * The reading a follow-up would be about — the most recent one in this
   * transcript. Null until the seeker has had a reading at all, which is what
   * keeps the very first send an ask no matter what the mode says.
   */
  const standingReadingId = latestReadingId(messages);

  const [mode, setMode] = useState<ComposerMode>('ask');

  // A verdict has just landed: the next message is far more likely to be
  // "why?" than an unrelated new question, so the composer moves to DISCUSS
  // on its own. Keyed on the reading id rather than on message count, so it
  // fires once per reading and never overrides a seeker who has since chosen
  // ASK for their next message.
  useEffect(() => {
    if (standingReadingId !== null) {
      setMode('discuss');
    }
  }, [standingReadingId]);

  /**
   * Second, non-blocking round trip: pick the devotional practice that suits
   * this reading, from the app's own tagged Islamic remedy library.
   *
   * Deliberately fired AFTER the verdict is already on screen and never
   * awaited by the ask path — the verdict is the answer, and guidance is an
   * enrichment. A slow or failed selection must not delay or fail a reading
   * that already succeeded, so this swallows its own errors: the bubble
   * simply renders without a GuidanceCard.
   *
   * `watchVerdictToRankingContext` is the purpose-built Watch Oracle bridge —
   * it derives classification, severity, themes and spiritual state from the
   * real DisplayWatchVerdict rather than from a coarse verdict string.
   */
  const runGuidanceSelection = useCallback(
    (oracleMessageId: string, question: string, reading: WatchReading): void => {
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
            updateMessage(oracleMessageId, { selectedRemedies: result.selectedRemedies });
          }
        })
        .catch(() => {
          // Enrichment only — the verdict already stands.
        });
    },
    [seekerProfile, updateMessage],
  );

  // ── The two send paths ────────────────────────────────────────────────────

  /**
   * Answer a follow-up about a reading that already stands.
   *
   * Spends no quota — the reading was the charged unit, and understanding it
   * is part of what was bought (the server bounds the conversation instead;
   * see discussReading.ts). So there is no consumeOne()/refundOne() pair here,
   * and 'resource-exhausted' from this call means the reading's own follow-up
   * budget is spent, not that the seeker is out of questions.
   *
   * Only the reading ID and the transcript since it travel: the verdict itself
   * is loaded server-side, so the oracle can only ever discuss a reading it
   * actually gave.
   */
  const runDiscuss = useCallback(
    async (
      oracleMessageId: string,
      userMessageId: string,
      message: string,
      readingId: string,
    ): Promise<void> => {
      try {
        const result = await discussReading({
          readingId,
          message,
          lang,
          turns: discussionTurnsFor(
            useOracleChatStore.getState().messages,
            readingId,
            userMessageId,
          ),
        });
        updateMessage(oracleMessageId, {
          status: 'sent',
          text: result.answer,
          suggestsNewQuestion: result.isNewQuestion,
        });
      } catch (err) {
        updateMessage(oracleMessageId, { status: 'failed', errorMessage: errorMessageFor(err, t) });
      }
    },
    [lang, updateMessage, t],
  );

  const runAsk = useCallback(
    async (oracleMessageId: string, question: string): Promise<void> => {
      if (!canAsk || !consumeOne()) {
        updateMessage(oracleMessageId, {
          status: 'failed',
          errorMessage: t('oracleChat.quotaExhausted'),
        });
        return;
      }

      try {
        const result = await askWatchOracle({
          question,
          questionLang: lang,
          ...(seekerProfile !== null ? { seekerProfile } : {}),
        });
        updateMessage(oracleMessageId, { status: 'sent', reading: result.reading });

        await addReading(
          toReadingRecord({
            id: result.reading.readingId,
            question,
            questionLang: lang,
            createdAt: result.reading.computedAt,
            reading: result.reading,
          }),
        );

        runGuidanceSelection(oracleMessageId, question, result.reading);
      } catch (err) {
        // consumeOne() already charged the local quota counter before the
        // network call — give it back on failure, same reasoning as the
        // server-side refund for a reading that never landed.
        useQuotaStore.getState().refundOne();
        updateMessage(oracleMessageId, { status: 'failed', errorMessage: errorMessageFor(err, t) });
      }
    },
    [canAsk, consumeOne, lang, seekerProfile, updateMessage, addReading, t, runGuidanceSelection],
  );

  /**
   * The ONE path every send funnels into — typed, spoken, or re-sent from a
   * bubble. Adds the seeker's bubble and the oracle placeholder, then hands
   * off to whichever of the two calls this send is.
   *
   * `forceMode` exists for "ask this as a new question", which must cast a
   * chart regardless of what the composer's mode row currently says.
   */
  const sendMessage = useCallback(
    (text: string, kind: ChatInputKind, forceMode?: ComposerMode) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || sendingRef.current) {
        return;
      }

      // With no reading standing there is nothing to discuss, so a send is an
      // ask whatever the mode says — this is what makes the first message of
      // a sitting always a reading.
      const readingId = latestReadingId(useOracleChatStore.getState().messages);
      const effectiveMode: ComposerMode = readingId === null ? 'ask' : (forceMode ?? mode);

      sendingRef.current = true;
      setSending(true);

      const now = new Date().toISOString();
      const userId = `u_${Date.now()}`;
      const oracleId = `o_${Date.now()}`;

      addMessage({ id: userId, role: 'user', text: trimmed, kind, createdAt: now, status: 'sent' });
      addMessage({
        id: oracleId,
        role: 'oracle',
        text: '',
        createdAt: now,
        status: 'sending',
        replyToId: userId,
        variant: effectiveMode === 'discuss' ? 'discussion' : 'reading',
        ...(effectiveMode === 'discuss' && readingId !== null
          ? { groundedReadingId: readingId }
          : {}),
      });
      setInputText('');

      const run =
        effectiveMode === 'discuss' && readingId !== null
          ? runDiscuss(oracleId, userId, trimmed, readingId)
          : runAsk(oracleId, trimmed);

      run.finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
    },
    [addMessage, runAsk, runDiscuss, mode],
  );

  const handleSend = useCallback(() => {
    sendMessage(inputText, 'text');
  }, [inputText, sendMessage]);

  const handleRetry = useCallback(
    (userMessageId: string) => {
      if (sendingRef.current) {
        return;
      }
      const userMsg = messages.find(m => m.id === userMessageId);
      const oracleMsg = messages.find(m => m.role === 'oracle' && m.replyToId === userMessageId);
      if (userMsg === undefined || oracleMsg === undefined) {
        return;
      }
      sendingRef.current = true;
      setSending(true);
      updateMessage(oracleMsg.id, { status: 'sending', errorMessage: undefined });

      // Retry the call this turn actually was. A failed follow-up retried as
      // a reading would silently cast a chart and charge for it.
      const run =
        oracleMsg.variant === 'discussion' && oracleMsg.groundedReadingId !== undefined
          ? runDiscuss(oracleMsg.id, userMsg.id, userMsg.text, oracleMsg.groundedReadingId)
          : runAsk(oracleMsg.id, userMsg.text);

      run.finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
    },
    [messages, runAsk, runDiscuss, updateMessage],
  );

  /**
   * The oracle declined a follow-up because it is really its own horary
   * question. Re-send those exact words through the ask path — a fresh pair
   * of bubbles, a fresh chart, and a quota slot, all of which is why this is
   * a tap and never automatic.
   */
  const handleAskAsNewQuestion = useCallback(
    (userMessageId: string) => {
      const userMsg = messages.find(m => m.id === userMessageId);
      if (userMsg === undefined) {
        return;
      }
      setMode('ask');
      sendMessage(userMsg.text, userMsg.kind ?? 'text', 'ask');
    },
    [messages, sendMessage],
  );

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
    stt.error === 'permission-denied'
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
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[typography('label'), { color: colors.accent, fontSize: 20 }]}>‹</Text>
        </Pressable>
        <Text style={[typography('subheading'), { color: colors.goldBright }]}>
          {t('oracleChat.headerTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isEmpty ? (
          <EmptyState />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item }) => (
              <ChatBubble
                message={item}
                questionLang={lang}
                onRetry={handleRetry}
                onAskAsNewQuestion={handleAskAsNewQuestion}
                ttsStatus={tts.status}
                ttsActiveMessageId={tts.activeMessageId}
                onToggleSpeech={tts.toggle}
              />
            )}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {micErrorText !== null && (
          <View style={[styles.micErrorBanner, { backgroundColor: colors.negative + '18' }]}>
            <Text style={[typography('caption'), { color: colors.negative }]}>{micErrorText}</Text>
          </View>
        )}

        <ChatComposer
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          sending={sending}
          isListening={stt.isListening}
          onMicPress={handleMicPress}
          micDisabled={sending}
          mode={mode}
          onModeChange={setMode}
          showModeToggle={standingReadingId !== null}
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
  backBtn: {
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
});

export default OracleChatScreen;
