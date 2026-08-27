/**
 * ReadingHeader — what this Reading is, and the moment it was cast for.
 * --------------------------------------------------------------------------
 * Sits above the conversation and establishes the Reading as the thing on
 * screen: its title, its moment, its method, and the question it answers.
 * Without it a reopened Reading looks like a chat that happens to start with
 * a verdict.
 *
 * Every value is read off the thread's stored context — the snapshot taken
 * when the chart landed — never re-derived from the current time. That is the
 * whole point: a Reading opened three days later must still show the moment it
 * was actually cast for.
 *
 * Presentation only. No engine values are interpreted here; the bracket and
 * ascendant are shown exactly as the server named them.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import type { ReadingThread } from '@stores/readingThreadsStore';

/** "27 Aug 2026 · 1:32 PM", in the device's own locale. */
export function formatReadingMoment(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return '';
  }
  const date = at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

const ReadingHeader: React.FC<{ thread: ReadingThread }> = ({ thread }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  // The stored moment, falling back to when the thread was opened — a cast
  // that never landed still has a question and a time it was asked.
  const moment = formatReadingMoment(thread.context?.localMoment ?? thread.createdAt);

  return (
    <View style={styles.wrap}>
      <Text
        style={[typography('caption'), { color: colors.goldBright, letterSpacing: 1.6 }]}
        accessibilityRole="header"
      >
        {t('reading.sectionLabel')}
      </Text>

      <Text style={[typography('title'), { color: colors.text, marginTop: 6 }]}>
        {thread.title}
      </Text>

      <View style={styles.metaRow}>
        {moment.length > 0 && (
          <Text style={[typography('caption'), { color: colors.textMuted }]}>{moment}</Text>
        )}
        {thread.context !== null && (
          <>
            <Text style={[typography('caption'), { color: colors.textFaint }]}>·</Text>
            <Text style={[typography('caption'), { color: colors.textFaint }]}>
              {thread.context.method}
            </Text>
          </>
        )}
      </View>

      {thread.context !== null && (
        <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 2 }]}>
          {`${thread.context.lagnaSignName} · ${thread.context.lagnaRulerName}`}
        </Text>
      )}

      <View
        style={[styles.rule, { backgroundColor: colors.borderAccent }]}
        accessibilityElementsHidden
      />

      <Text style={[typography('caption'), { color: colors.textMuted, letterSpacing: 1.2 }]}>
        {t('reading.yourQuestion')}
      </Text>
      <Text style={[typography('bodyEmphasis'), { color: colors.text, marginTop: 6 }]}>
        {thread.question}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
    marginVertical: 16,
  },
});

export default ReadingHeader;
