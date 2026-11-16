/**
 * ReadingHeader — the moment a Reading was cast for.
 * --------------------------------------------------------------------------
 * Sits at the top of the Reading's chat thread as a small centred chip, the
 * way a messaging thread dates its conversation: the moment, the method, and
 * the ascendant the chart was cast with. The title lives in the screen
 * header and the question is the seeker's own opening bubble.
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
import type { ReadingThread } from '@stores/readingThreadsStore';
import { Diamond, useReadingText } from './readingDesign';

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
  const text = useReadingText();

  // The stored moment, falling back to when the thread was opened — a cast
  // that never landed still has a question and a time it was asked.
  const moment = formatReadingMoment(thread.context?.localMoment ?? thread.createdAt);
  const firstLine = [moment, thread.context?.method].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );

  // The cast line of the design: a quiet caps line between two hairlines,
  // the way a messaging thread dates its conversation. The title is already
  // in the screen header and the question is the seeker's own opening bubble.
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={styles.row}>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Diamond color={colors.brass} size={5} filled={false} />
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      </View>
      {firstLine.length > 0 && (
        <Text style={[text.meta, styles.centred, { color: colors.textMuted }]}>
          {firstLine.join('  ·  ')}
        </Text>
      )}
      {thread.context !== null && (
        <Text style={[text.meta, styles.centred, { color: colors.goldBright }]}>
          {`${thread.context.lagnaSignName} · ${thread.context.lagnaRulerName}`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    marginBottom: 2,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  centred: {
    textAlign: 'center',
  },
});

export default ReadingHeader;
