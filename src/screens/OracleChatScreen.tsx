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
 * Scope note (v1): every send is a fresh askWatchOracle call — there is no
 * follow-up intent classification or conversational quick-reply chips here.
 * That is a deliberate simplification, not an oversight; the previous
 * screen's much larger follow-up/paywall machinery is not carried over.
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
import { useOracleChatStore, selectIsEmpty, type ChatInputKind } from '@stores/oracleChatStore';
import { useReadingsStore } from '@stores/readingsStore';
import { askWatchOracle, type WatchReading } from '../firebase/watchOracle';
import { toReadingRecord } from '../data/watchReadingRecord';
import { selectRemedies } from '../data/remedySelector';
import { watchVerdictToRankingContext } from '../data/watchRemedyContext';
import { speakableTextFor } from '@components/oracle/ChatBubble';
import StarfieldBackground from '@components/StarfieldBackground';
import ChatBubble from '@components/oracle/ChatBubble';
import ChatComposer from '@components/oracle/ChatComposer';

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

  // ── Core ask logic — the ONE path both text and voice funnel into ─────────

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

  const sendMessage = useCallback(
    (text: string, kind: ChatInputKind) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || sendingRef.current) {
        return;
      }
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
      });
      setInputText('');

      runAsk(oracleId, trimmed).finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
    },
    [addMessage, runAsk],
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
      runAsk(oracleMsg.id, userMsg.text).finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
    },
    [messages, runAsk, updateMessage],
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
