/**
 * HistoryScreen — past readings list with full detail modal.
 * --------------------------------------------------------------------------
 * List: MMKV-backed, filter chips (All/Yes/No/Conditional), sort toggle.
 * Tap any row → full-screen modal with:
 *   - Verdict badge + confidence bar
 *   - Full narration in the device language
 *   - Step-by-step reasoning trace
 *   - Timing window
 *   - Remedy guidance (if present)
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation, useI18n } from '@i18n/I18nProvider';
import {
  useReadingsStore,
  selectFilteredReadings,
  selectIsEmpty,
  type Reading,
  type ReadingFilter,
  type VerdictKind,
} from '@stores/readingsStore';

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
/*  Filter chips                                                              */
/* -------------------------------------------------------------------------- */

interface FilterChipDef {
  value: ReadingFilter;
  i18nKey:
    | 'history.filterAll'
    | 'history.filterYes'
    | 'history.filterNo'
    | 'history.filterConditional';
}

const FILTER_CHIPS: readonly FilterChipDef[] = [
  { value: 'all', i18nKey: 'history.filterAll' },
  { value: 'YES', i18nKey: 'history.filterYes' },
  { value: 'NO', i18nKey: 'history.filterNo' },
  { value: 'CONDITIONAL', i18nKey: 'history.filterConditional' },
] as const;

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

const HistoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();

  const filter = useReadingsStore((s: ReturnType<typeof useReadingsStore.getState>) => s.filter);
  const sort = useReadingsStore((s: ReturnType<typeof useReadingsStore.getState>) => s.sort);
  const setFilter = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.setFilter,
  );
  const setSort = useReadingsStore((s: ReturnType<typeof useReadingsStore.getState>) => s.setSort);
  const deleteReading = useReadingsStore(
    (s: ReturnType<typeof useReadingsStore.getState>) => s.deleteReading,
  );
  const items = useReadingsStore(selectFilteredReadings);
  const isEmpty = useReadingsStore(selectIsEmpty);

  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);

  const handleSortToggle = useCallback(() => {
    setSort(sort === 'newest' ? 'oldest' : 'newest');
  }, [sort, setSort]);

  const handleDelete = useCallback(
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

  const handleAskFirst = useCallback(() => {
    navigation.navigate('Oracle');
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: Reading }) => (
      <ReadingRow
        reading={item}
        onPress={() => setSelectedReading(item)}
        onLongPress={() => handleDelete(item)}
      />
    ),
    [handleDelete],
  );

  const keyExtractor = useCallback((item: Reading) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <View style={styles.controlsBlock}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTER_CHIPS.map(chip => {
            const active = filter === chip.value;
            return (
              <Pressable
                key={chip.value}
                onPress={() => setFilter(chip.value)}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.chip,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.surfaceElevated : 'transparent',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    typography('caption'),
                    { color: active ? colors.accent : colors.textMuted },
                  ]}
                >
                  {t(chip.i18nKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          onPress={handleSortToggle}
          style={({ pressed }: { pressed: boolean }) => [
            styles.sortBtn,
            { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={[typography('caption'), { color: colors.textMuted }]}>
            {sort === 'newest' ? t('history.sortNewest') : t('history.sortOldest')}
          </Text>
        </Pressable>
      </View>
    ),
    [filter, sort, colors, typography, t, setFilter, handleSortToggle],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[typography('subheading'), { color: colors.text }]}>
          {t('history.headerTitle')}
        </Text>
      </View>

      {isEmpty ? (
        <EmptyState onAsk={handleAskFirst} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.subEmpty}>
              <Text style={[typography('body'), { color: colors.textMuted, textAlign: 'center' }]}>
                {t('history.emptyBody')}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Detail modal ── */}
      {selectedReading !== null && (
        <ReadingDetailModal
          reading={selectedReading}
          onClose={() => setSelectedReading(null)}
          onDelete={() => {
            handleDelete(selectedReading);
            setSelectedReading(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/*  Reading row                                                               */
/* -------------------------------------------------------------------------- */

const ReadingRow: React.FC<{
  reading: Reading;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ reading, onPress, onLongPress }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const vColor = verdictColorFor(reading.verdict, colors);
  const vLabel = verdictLabelFor(reading.verdict, t);

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
        },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.rowMain}>
        <Text style={[typography('bodyEmphasis'), { color: colors.text }]} numberOfLines={2}>
          {reading.question}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>
            {reading.category.toUpperCase()}
          </Text>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>·</Text>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>
            {formatRelative(reading.createdAt)}
          </Text>
        </View>
      </View>
      <View style={[styles.verdictPill, { borderColor: vColor }]}>
        <Text style={[typography('button'), { color: vColor }]}>{vLabel}</Text>
      </View>
    </Pressable>
  );
};

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
              {reading.category.toUpperCase()}
            </Text>
            <Text style={[typography('bodyEmphasis'), { color: colors.text }]}>
              {reading.question}
            </Text>
          </View>

          {/* Verdict + confidence */}
          <View style={[styles.section, styles.verdictSection, { borderColor: colors.border }]}>
            <View
              style={[
                styles.verdictBadge,
                { borderColor: vColor, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[typography('title'), { color: vColor }]}>{vLabel}</Text>
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

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) {
    return '';
  }
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) {
    return 'just now';
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)}m`;
  }
  if (diffSec < 86_400) {
    return `${Math.floor(diffSec / 3600)}h`;
  }
  if (diffSec < 7 * 86_400) {
    return `${Math.floor(diffSec / 86_400)}d`;
  }
  return new Date(ts).toLocaleDateString();
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
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowMain: { flex: 1, gap: 6 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verdictPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
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

export default HistoryScreen;
