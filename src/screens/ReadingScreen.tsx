import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation, useI18n } from '@i18n/I18nProvider';
import StarfieldBackground from '@components/StarfieldBackground';
import ChatBubble from '@components/oracle/ChatBubble';
import ChatComposer from '@components/oracle/ChatComposer';

import { useReadingThreadsStore, migrateReadingsToThreadsForUser } from '@stores/readingThreadsStore';
import { askWatchOracle } from '../firebase/watchOracle';
import { discussReading } from '../firebase/discussReading';
import type { RootStackParamList } from '@navigation/types';
import type { Thread, ThreadMessage } from '@stores/readingThreadsStore';

type ReadingRouteProp = RouteProp<RootStackParamList, 'Reading'>;

const ReadingScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const navigation = useNavigation();
  const route = useRoute<ReadingRouteProp>();

  const { threadId: paramThreadId, initialQuestion } = route.params ?? {};
  const addThread = useReadingThreadsStore(s => s.addThread);
  const getThreadById = useReadingThreadsStore(s => s.getThreadById);
  const addMessageToThread = useReadingThreadsStore(s => s.addMessageToThread);
  const attachReadingToThread = useReadingThreadsStore(s => s.attachReadingToThread);

  const [localThreadId, setLocalThreadId] = useState<string | null>(paramThreadId ?? null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  // Follow-ups availability state (controlled by discussReading response)
  const [followupsAvailable, setFollowupsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // If initialQuestion present and no threadId, create a thread and ask
    if (initialQuestion && !paramThreadId) {
      const id = `t_${Date.now()}`;
      const now = new Date().toISOString();
      const thread: Thread = {
        id,
        question: initialQuestion,
        createdAt: now,
        lastActivityAt: now,
        messages: [],
      };
      addThread(thread);
      setLocalThreadId(id);
      // Ask first question via askWatchOracle (first-question path)
      void (async () => {
        try {
          setSending(true);
          sendingRef.current = true;
          const result = await askWatchOracle({ question: initialQuestion, questionLang: lang });
          // Attach reading to thread
          attachReadingToThread(id, result.reading.readingId, result.reading);
          // Add messages: user + oracle
          const userMsg: ThreadMessage = {
            id: `u_${Date.now()}`,
            role: 'user',
            text: initialQuestion,
            createdAt: result.reading.computedAt,
          };
          const oracleMsg: ThreadMessage = {
            id: `o_${Date.now()}`,
            role: 'oracle',
            createdAt: result.reading.computedAt,
            status: 'sent',
            reading: result.reading,
          };
          addMessageToThread(id, userMsg);
          addMessageToThread(id, oracleMsg);
        } catch (err) {
          Alert.alert(t('oracleChat.failedGeneric'));
        } finally {
          setSending(false);
          sendingRef.current = false;
        }
      })();
    }
  }, [initialQuestion, paramThreadId, addThread, attachReadingToThread, addMessageToThread, lang, t]);

  // Migration: ensure threads exist for this user when screen mounts.
  useEffect(() => {
    // Conservative: migrate for current user if available in settingsStore/authStore.
    // We do a best-effort here; if migration is needed it will run async.
    import('@stores/authStore').then(mod => {
      const uid = mod.useAuthStore.getState().userId;
      if (uid) void migrateReadingsToThreadsForUser(uid).catch(() => {});
    });
  }, []);

  const thread = localThreadId ? getThreadById(localThreadId) : null;

  const listRef = useRef<FlatList | null>(null);

  useEffect(() => {
    if (thread && thread.messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [thread?.messages.length]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current || localThreadId === null) return;
      // Follow-up path: must call discussReading client boundary. Do NOT call askWatchOracle.
      sendingRef.current = true;
      setSending(true);

      const userMsg: ThreadMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      addMessageToThread(localThreadId, userMsg);

      try {
        const res = await discussReading({ threadId: localThreadId, question: trimmed });
        if (res.available === false) {
          setFollowupsAvailable(false);
          Alert.alert(t('reading.followupsUnavailable'));
        } else {
          // If available, res should include a reply message — attach it.
          const oracleMsg: ThreadMessage = {
            id: `o_${Date.now()}`,
            role: 'oracle',
            createdAt: new Date().toISOString(),
            status: 'sent',
            reading: res.reading ?? undefined,
          };
          addMessageToThread(localThreadId, oracleMsg);
          setFollowupsAvailable(true);
        }
      } catch (err) {
        // Network/other errors: inform user but do not fake answers or consume quota
        Alert.alert(t('oracleChat.failedGeneric'));
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [addMessageToThread, localThreadId, t],
  );

  if (!thread) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
        <StarfieldBackground starColor={colors.starfield} />
        <View style={styles.emptyWrap}>
          <Text style={[typography('title'), { color: colors.text }]}>{t('reading.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground starColor={colors.starfield} />
      <View style={[styles.header, { borderColor: colors.border }]}> 
        <Text style={[typography('subheading'), { color: colors.goldBright }]}>{thread.question}</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={listRef}
          data={thread.messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item as any}
              questionLang={lang}
              onRetry={() => {}}
              ttsStatus={'stopped' as any}
              ttsActiveMessageId={null}
              onToggleSpeech={() => {}}
            />
          )}
          contentContainerStyle={styles.listContent}
        />

        {followupsAvailable === false && (
          <View style={[styles.unavailableBanner, { backgroundColor: colors.surface }] }>
            <Text style={[typography('caption'), { color: colors.textMuted }]}>{t('reading.followupsUnavailable')}</Text>
          </View>
        )}

        <ChatComposer onSend={handleSend} value={''} onChangeText={() => {}} sending={sending} isListening={false} onMicPress={() => {}} micDisabled={sending} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  listContent: { paddingVertical: 12, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unavailableBanner: { padding: 12, alignItems: 'center' },
});

export default ReadingScreen;
