/**
 * ReadingsScreen — "Your Readings", the archive of past Readings.
 * --------------------------------------------------------------------------
 * A Reading is a conversation, not a receipt, so a row here OPENS it: tapping
 * one pushes ReadingScreen with that thread, where the verdict is restored as
 * it was cast and a follow-up can still be asked. This is the difference from
 * the previous History screen, which showed a dead-end detail modal — the
 * seeker could re-read a verdict but never continue it.
 *
 * Two kinds of row, because nothing is thrown away:
 *   - THREAD — a Reading with its conversation. Opens the Reading.
 *   - ARCHIVE — a reading recorded before threads existed, which has no
 *     conversation to open. Still readable, in the detail modal this screen
 *     has always had.
 *
 * Ordering is recency-grouped against the DEVICE's local day boundaries
 * (Today / Yesterday / Previous 7 days / …), computed in the store; this file
 * only translates the group keys. The verdict filter chips and sort toggle
 * were removed in favour of search: a seeker looks for a Reading by what they
 * asked, not by which way it was answered.
 *
 * Long-press → confirm delete.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigation } from '@navigation/types';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation, useI18n } from '@i18n/I18nProvider';
import { useReadingsStore, type Reading, type VerdictKind } from '@stores/readingsStore';
import {
  useReadingThreadsStore,
  groupByRecency,
  searchThreads,
  type ReadingThread,
  type ThreadGroupKey,
} from '@stores/readingThreadsStore';
import { readingTitleFor } from '../data/readingTitle';
import { formatReadingMoment } from '@components/oracle/ReadingHeader';
import StarfieldBackground from '@components/StarfieldBackground';
import RkpWatchCard from '@components/oracle/RkpWatchCard';
import RemedyProtocolCard from '@components/oracle/RemedyProtocolCard';

/* -------------------------------------------------------------------------- */
/*  Verdict types from the persisted verdictJson                              */
/* -------------------------------------------------------------------------- */

interface ReasoningStep {
  ruleId: string;
  description: string;
  weight: number;
}

interface VerdictJson {
  verdict: VerdictKind;
  confidence: number;
  narration?: Partial<Record<'en' | 'ur' | 'hi', string>>;
  reasoning?: ReasoningStep[];
  timing?: {
    window: string;
    range: { min: number; max: number };
  };
  remedy?: {
    planet: string;
    action: string;
    avoid: string;
    mantra?: string;
  };
  moonSubLord?: {
    planet: string;
    occupiedHouse: number;
    favHits: number[];
    denHits: number[];
  };
  rulingPlanets?: {
    dayLord: string;
    horaLord: string;
    minuteLord: string;
    agreementScore: number;
  };
}

function extractVerdict(reading: Reading): VerdictJson {
  return (reading.verdictJson as VerdictJson) ?? { verdict: reading.verdict, confidence: 0 };
}

/* -------------------------------------------------------------------------- */
/*  List rows                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One entry in the list. A THREAD row opens its Reading; an ARCHIVE row is a
 * reading recorded before threads existed and can only be re-read.
 */
type ReadingsRow =
  | { kind: 'group'; key: string; groupKey: ThreadGroupKey }
  | { kind: 'thread'; key: string; thread: ReadingThread; updatedAt: string }
  | { kind: 'archive'; key: string; reading: Reading; updatedAt: string };

const GROUP_LABEL_KEY: Readonly<
  Record<
    ThreadGroupKey,
    | 'history.groupToday'
    | 'history.groupYesterday'
    | 'history.groupPrevious7'
    | 'history.groupPrevious30'
    | 'history.groupOlder'
  >
> = Object.freeze({
  today: 'history.groupToday',
  yesterday: 'history.groupYesterday',
  previous7: 'history.groupPrevious7',
  previous30: 'history.groupPrevious30',
  older: 'history.groupOlder',
});

/**
 * Fold threads and pre-thread archive entries into one recency-grouped list.
 *
 * An archive entry whose reading already belongs to a thread is dropped: the
 * thread is the same Reading with its conversation attached, and showing both
 * would list one Reading twice.
 */
export function buildRows(
  threads: readonly ReadingThread[],
  archive: readonly Reading[],
  search: string,
  now: Date = new Date(),
): ReadingsRow[] {
  const threadReadingIds = new Set(
    threads.map(thread => thread.readingId).filter((id): id is string => id !== null),
  );

  const needle = search.trim().toLowerCase();
  const matchedThreads = searchThreads(threads, search);
  const matchedArchive = archive.filter(
    reading =>
      !threadReadingIds.has(reading.id) &&
      (needle.length === 0 || reading.question.toLowerCase().includes(needle)),
  );

  const items: Array<
    | { kind: 'thread'; thread: ReadingThread; updatedAt: string }
    | { kind: 'archive'; reading: Reading; updatedAt: string }
  > = [
    ...matchedThreads.map(thread => ({
      kind: 'thread' as const,
      thread,
      updatedAt: thread.updatedAt,
    })),
    ...matchedArchive.map(reading => ({
      kind: 'archive' as const,
      reading,
      updatedAt: reading.createdAt,
    })),
  ].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const rows: ReadingsRow[] = [];
  for (const group of groupByRecency(items, now)) {
    rows.push({ kind: 'group', key: `g_${group.key}`, groupKey: group.key });
    for (const item of group.items) {
      rows.push(
        item.kind === 'thread'
          ? { kind: 'thread', key: item.thread.id, thread: item.thread, updatedAt: item.updatedAt }
          : {
              kind: 'archive',
              key: `a_${item.reading.id}`,
              reading: item.reading,
              updatedAt: item.updatedAt,
            },
      );
    }
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

const ReadingsScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const navigation = useNavigation<AppNavigation>();

  const threads = useReadingThreadsStore(s => s.threads);
  const deleteThread = useReadingThreadsStore(s => s.deleteThread);
  const archive = useReadingsStore((s: ReturnType<typeof useReadingsStore.getState>) => s.readings);
  const deleteReading = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.deleteReading,
  );

  const [search, setSearch] = useState('');
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);

  // Recomputed only when the data or the search term actually changes —
  // grouping walks every Reading, and this list is a scroll surface.
  const rows = useMemo(() => buildRows(threads, archive, search), [threads, archive, search]);

  const hasAnyReading = threads.length > 0 || archive.length > 0;
  const isSearching = search.trim().length > 0;

  const handleNewReading = useCallback(() => {
    // push, not navigate: navigate() would reuse a Reading already on the
    // stack and merely merge params into it, which is not what "open this
    // one" means. push always gives the Reading its own screen.
    navigation.push('Reading', {});
  }, [navigation]);

  const handleDeleteThread = useCallback(
    (thread: ReadingThread) => {
      Alert.alert(t('history.deleteAction'), t('history.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('history.deleteAction'),
          style: 'destructive',
          onPress: () => {
            deleteThread(thread.id);
            // The archive entry is the same Reading; leaving it behind would
            // resurrect the row the seeker just deleted.
            if (thread.readingId !== null) {
              void deleteReading(thread.readingId);
            }
          },
        },
      ]);
    },
    [t, deleteThread, deleteReading],
  );

  const handleDeleteArchive = useCallback(
    (reading: Reading) => {
      Alert.alert(t('history.deleteAction'), t('history.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('history.deleteAction'),
          style: 'destructive',
          onPress: () => {
            void deleteReading(reading.id);
          },
        },
      ]);
    },
    [t, deleteReading],
  );

  const renderRow = useCallback(
    ({ item }: { item: ReadingsRow }) => {
      if (item.kind === 'group') {
        return (
          <Text
            style={[
              typography('caption'),
              styles.groupLabel,
              { color: colors.textFaint, borderBottomColor: colors.border },
            ]}
          >
            {t(GROUP_LABEL_KEY[item.groupKey])}
          </Text>
        );
      }
      if (item.kind === 'thread') {
        return (
          <ThreadRow
            thread={item.thread}
            onPress={() => navigation.push('Reading', { threadId: item.thread.id })}
            onLongPress={() => handleDeleteThread(item.thread)}
          />
        );
      }
      return (
        <ArchiveRow
          reading={item.reading}
          onPress={() => setSelectedReading(item.reading)}
          onLongPress={() => handleDeleteArchive(item.reading)}
        />
      );
    },
    [colors, typography, t, navigation, handleDeleteThread, handleDeleteArchive],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      <View
        style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text
          style={[
            typography('caption'),
            { color: colors.goldBright, letterSpacing: 1.6, marginBottom: 4 },
          ]}
        >
          ARCHIVE
        </Text>
        <Text style={[typography('subheading'), { color: colors.text }]}>
          {t('history.headerTitle')}
        </Text>
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.borderAccent,
            marginTop: 10,
            opacity: 0.5,
          }}
        />
      </View>

      <View style={styles.controlsBlock}>
        <TextInput
          style={[
            typography('body'),
            styles.searchInput,
            {
              color: colors.text,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          value={search}
          onChangeText={setSearch}
          placeholder={t('history.searchPlaceholder')}
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          testID="readings-search-input"
        />
        <Pressable
          onPress={handleNewReading}
          style={({ pressed }: { pressed: boolean }) => [
            styles.newBtn,
            { borderColor: colors.borderAccent, opacity: pressed ? 0.75 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('history.newReading')}
          testID="readings-new-btn"
        >
          <Text style={[typography('label'), { color: colors.goldBright }]}>
            {'✦ ' + t('history.newReading')}
          </Text>
        </Pressable>
      </View>

      {!hasAnyReading ? (
        <EmptyState onAsk={handleNewReading} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={row => row.key}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.subEmpty}>
              <Text style={[typography('body'), { color: colors.textMuted, textAlign: 'center' }]}>
                {isSearching ? t('history.noResults') : t('history.emptyBody')}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Detail modal — pre-thread archive entries only ── */}
      {selectedReading !== null && (
        <ReadingDetailModal
          reading={selectedReading}
          onClose={() => setSelectedReading(null)}
          onDelete={() => {
            handleDeleteArchive(selectedReading);
            setSelectedReading(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/*  Rows                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A Reading with its conversation. Title first — it is what the seeker
 * recognises the Reading by — question second, moment last.
 */
const ThreadRow: React.FC<{
  thread: ReadingThread;
  onPress: () => void;
  onLongPress: () => void;
}> = React.memo(({ thread, onPress, onLongPress }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const moment = formatReadingMoment(thread.context?.localMoment ?? thread.createdAt);
  const statusNote =
    thread.status === 'pending'
      ? t('history.pendingReading')
      : thread.status === 'error'
        ? t('history.failedReading')
        : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }: { pressed: boolean }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          borderLeftWidth: 3,
          borderLeftColor: thread.status === 'error' ? colors.negative : colors.borderAccent,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={thread.title}
    >
      <View style={styles.rowMain}>
        <Text style={[typography('bodyEmphasis'), { color: colors.text }]} numberOfLines={1}>
          {thread.title}
        </Text>
        <Text
          style={[typography('caption'), { color: colors.textMuted, marginTop: 3 }]}
          numberOfLines={1}
        >
          {thread.question}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>{moment}</Text>
          {statusNote !== null && (
            <>
              <Text style={[typography('caption'), { color: colors.textFaint }]}>·</Text>
              <Text style={[typography('caption'), { color: colors.textFaint }]}>{statusNote}</Text>
            </>
          )}
        </View>
      </View>
      <Text style={[typography('label'), { color: colors.goldBright, opacity: 0.8 }]}>›</Text>
    </Pressable>
  );
});
ThreadRow.displayName = 'ThreadRow';

/** A reading recorded before threads existed — re-readable, not continuable. */
const ArchiveRow: React.FC<{
  reading: Reading;
  onPress: () => void;
  onLongPress: () => void;
}> = React.memo(({ reading, onPress, onLongPress }) => {
  const colors = useColors();
  const typography = useTypography();

  const vColor = verdictColorFor(reading.verdict, colors);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }: { pressed: boolean }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          borderLeftWidth: 3,
          borderLeftColor: vColor,
        },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.rowMain}>
        <Text style={[typography('bodyEmphasis'), { color: colors.text }]} numberOfLines={1}>
          {readingTitleFor(reading.question)}
        </Text>
        <Text
          style={[typography('caption'), { color: colors.textMuted, marginTop: 3 }]}
          numberOfLines={1}
        >
          {reading.question}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>
            {formatReadingMoment(reading.createdAt)}
          </Text>
        </View>
      </View>
      <View style={[styles.verdictPill, { borderColor: vColor, backgroundColor: vColor + '14' }]}>
        <Text style={[typography('label'), { color: vColor, fontSize: 9, letterSpacing: 0.8 }]}>
          {verdictBadgeFor(reading.verdict)}
        </Text>
      </View>
    </Pressable>
  );
});
ArchiveRow.displayName = 'ArchiveRow';

/* -------------------------------------------------------------------------- */
/*  Reading detail modal                                                      */
/* -------------------------------------------------------------------------- */

const ReadingDetailModal: React.FC<{
  reading: Reading;
  onClose: () => void;
  onDelete: () => void;
}> = ({ reading, onClose, onDelete }) => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();

  const v = extractVerdict(reading);
  const vColor = verdictColorFor(reading.verdict, colors);
  const vLabel = verdictLabelFor(reading.verdict, t);
  const badgeLabel = verdictBadgeFor(reading.verdict);
  const narration = v.narration?.[lang] ?? v.narration?.en ?? '';
  const confidence = v.confidence ?? 0;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.modalRoot, { backgroundColor: theme.colors.bg }]}
        edges={['top', 'bottom']}
      >
        {/* Modal header */}
        <View style={[styles.modalHeader, { borderColor: colors.border }]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={[typography('label'), { color: colors.accent }]}>{t('common.close')}</Text>
          </Pressable>
          <Text style={[typography('label'), { color: colors.textMuted }]}>
            {new Date(reading.createdAt).toLocaleDateString()}
          </Text>
          <Pressable onPress={onDelete} hitSlop={12} accessibilityRole="button">
            <Text style={[typography('label'), { color: colors.negative }]}>
              {t('history.deleteAction')}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
          {/* Question */}
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 6 }]}>
              {(reading.category ?? '').toUpperCase()}
            </Text>
            <Text style={[typography('bodyEmphasis'), { color: colors.text }]}>
              {reading.question}
            </Text>
          </View>

          {/* Verdict + confidence */}
          <View style={[styles.section, styles.verdictSection, { borderColor: colors.border }]}>
            <View
              style={[styles.verdictBadge, { borderColor: vColor, backgroundColor: vColor + '14' }]}
            >
              <Text style={[typography('heading'), { color: vColor, letterSpacing: 1.2 }]}>
                {badgeLabel}
              </Text>
              <Text style={[typography('caption'), { color: vColor, opacity: 0.7, marginTop: 2 }]}>
                {vLabel}
              </Text>
            </View>
            <View style={styles.confidenceBlock}>
              <View style={styles.confRow}>
                <Text style={[typography('caption'), { color: colors.textMuted }]}>
                  {t('oracle.confidenceLabel')}
                </Text>
                <Text style={[typography('label'), { color: colors.accent }]}>{confidence}%</Text>
              </View>
              <View style={[styles.confBar, { backgroundColor: colors.border }]}>
                <View
                  style={[styles.confFill, { width: `${confidence}%`, backgroundColor: vColor }]}
                />
              </View>
            </View>
          </View>

          {/* Narration */}
          {narration.length > 0 && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}>
                Verdict
              </Text>
              <Text style={[typography('body'), { color: colors.text, lineHeight: 24 }]}>
                {narration}
              </Text>
            </View>
          )}

          {/* RKP Watch detail — the current engine. Reuses the same two cards
              the chat renders, so a reading reads identically whether it is
              opened fresh or months later from History. The KP blocks below
              stay for readings taken before the engine changed; they are
              already absent on watch readings, which carry no moonSubLord. */}
          {reading.watch_oracle !== undefined && (
            <>
              <RkpWatchCard
                window={reading.watch_oracle.window}
                lagnaSignName={reading.watch_oracle.lagnaSignName}
                lagnaRulerName={reading.watch_oracle.lagnaRulerName}
                verdict={reading.watch_oracle.verdict}
              />
              <RemedyProtocolCard composition={reading.watch_oracle.composition} />
            </>
          )}

          {/* Moon Sub-Lord + RPs */}
          {v.moonSubLord !== undefined && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 10 }]}>
                Significators
              </Text>
              <InfoRow
                label="Moon Sub-Lord"
                value={`${v.moonSubLord.planet} — House ${v.moonSubLord.occupiedHouse}`}
                colors={colors}
                typography={typography}
              />
              {v.rulingPlanets !== undefined && (
                <>
                  <InfoRow
                    label="Day Lord"
                    value={v.rulingPlanets.dayLord}
                    colors={colors}
                    typography={typography}
                  />
                  <InfoRow
                    label="Hora Lord"
                    value={v.rulingPlanets.horaLord}
                    colors={colors}
                    typography={typography}
                  />
                  <InfoRow
                    label="Minute Lord"
                    value={v.rulingPlanets.minuteLord}
                    colors={colors}
                    typography={typography}
                  />
                  <InfoRow
                    label="RP Score"
                    value={
                      v.rulingPlanets.agreementScore >= 0
                        ? `+${v.rulingPlanets.agreementScore}`
                        : String(v.rulingPlanets.agreementScore)
                    }
                    colors={colors}
                    typography={typography}
                    valueColor={
                      v.rulingPlanets.agreementScore > 0
                        ? colors.positive
                        : v.rulingPlanets.agreementScore < 0
                          ? colors.negative
                          : colors.textMuted
                    }
                  />
                </>
              )}
            </View>
          )}

          {/* Timing */}
          {v.timing !== undefined && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}>
                {t('oracle.timingLabel')}
              </Text>
              <Text style={[typography('body'), { color: colors.text }]}>
                {v.timing.range.min === v.timing.range.max
                  ? `${v.timing.range.max} ${v.timing.window}`
                  : `${v.timing.range.min}–${v.timing.range.max} ${v.timing.window}`}
              </Text>
            </View>
          )}

          {/* Reasoning trace */}
          {v.reasoning !== undefined && v.reasoning.length > 0 && (
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 10 }]}>
                {t('oracle.reasoningLabel')}
              </Text>
              {v.reasoning.map((step, i) => (
                <ReasoningRow
                  key={step.ruleId + i}
                  step={step}
                  colors={colors}
                  typography={typography}
                />
              ))}
            </View>
          )}

          {/* Remedy */}
          {v.remedy !== undefined && (
            <View
              style={[
                styles.section,
                styles.remedySection,
                { borderColor: colors.borderAccent, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[typography('caption'), { color: colors.accent, marginBottom: 8 }]}>
                {t('oracle.remedyLabel')} — {v.remedy.planet}
              </Text>
              <Text style={[typography('body'), { color: colors.text, marginBottom: 6 }]}>
                {v.remedy.action}
              </Text>
              {v.remedy.mantra !== undefined && (
                <Text
                  style={[typography('caption'), { color: colors.textMuted, fontStyle: 'italic' }]}
                >
                  {v.remedy.mantra}
                </Text>
              )}
              <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 6 }]}>
                Avoid: {v.remedy.avoid}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

const InfoRow: React.FC<{
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
  valueColor?: string;
}> = ({ label, value, colors, typography, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={[typography('caption'), { color: colors.textMuted, flex: 1 }]}>{label}</Text>
    <Text style={[typography('label'), { color: valueColor ?? colors.text }]}>{value}</Text>
  </View>
);

const ReasoningRow: React.FC<{
  step: ReasoningStep;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}> = ({ step, colors, typography }) => {
  const weightColor =
    step.weight > 0 ? colors.positive : step.weight < 0 ? colors.negative : colors.textMuted;

  return (
    <View style={[styles.reasoningRow, { borderColor: colors.border }]}>
      {step.weight !== 0 && (
        <View style={[styles.weightTag, { borderColor: weightColor }]}>
          <Text style={[typography('caption'), { color: weightColor }]}>
            {step.weight > 0 ? `+${step.weight}` : step.weight}
          </Text>
        </View>
      )}
      <Text style={[typography('caption'), { color: colors.textMuted, flex: 1 }]} numberOfLines={3}>
        {step.description}
      </Text>
    </View>
  );
};

const EmptyState: React.FC<{ onAsk: () => void }> = ({ onAsk }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <Text style={[typography('title'), { color: colors.text, textAlign: 'center' }]}>
        {t('history.emptyTitle')}
      </Text>
      <Text
        style={[typography('body'), { color: colors.textMuted, textAlign: 'center', marginTop: 8 }]}
      >
        {t('history.emptyBody')}
      </Text>
      <Pressable
        onPress={onAsk}
        style={({ pressed }: { pressed: boolean }) => [
          styles.emptyCta,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
      >
        <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
          {t('oracle.headerTitle')}
        </Text>
      </Pressable>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function verdictColorFor(v: VerdictKind, colors: ReturnType<typeof useColors>): string {
  switch (v) {
    case 'YES':
      return colors.positive;
    case 'NO':
      return colors.negative;
    case 'CONDITIONAL':
    case 'DELAYED':
      return colors.caution;
    default:
      return colors.textMuted;
  }
}

function verdictLabelFor(v: VerdictKind, t: ReturnType<typeof useTranslation>): string {
  switch (v) {
    case 'YES':
      return t('oracle.verdictYes');
    case 'NO':
      return t('oracle.verdictNo');
    case 'CONDITIONAL':
      return t('oracle.verdictConditional');
    case 'DELAYED':
      return t('oracle.verdictDelayed');
    case 'UNCLEAR':
      return t('oracle.verdictUnclear');
    default:
      return '…';
  }
}

// Manuscript verdict badge — uses Arabic/sacred terms per the design brief
function verdictBadgeFor(v: VerdictKind): string {
  switch (v) {
    case 'YES':
      return 'MAQBOOL';
    case 'NO':
      return 'MARDOOD';
    case 'CONDITIONAL':
      return 'MASHROOT';
    case 'DELAYED':
      return "TA'KHEER";
    case 'DENIED':
      return 'MARDOOD';
    default:
      return 'GHAYR WAZEH';
  }
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  controlsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  chipsRow: { gap: 8, paddingRight: 8 },
  searchInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupLabel: {
    letterSpacing: 1.4,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  rowMain: { flex: 1, gap: 8 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdictPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyCta: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  subEmpty: { paddingVertical: 32, paddingHorizontal: 24 },

  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  section: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 16,
    marginBottom: 0,
  },
  verdictSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  verdictBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  confidenceBlock: { flex: 1, gap: 6 },
  confRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confFill: {
    height: 6,
    borderRadius: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  reasoningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weightTag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  remedySection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    borderBottomWidth: 1,
  },
});

export default ReadingsScreen;
