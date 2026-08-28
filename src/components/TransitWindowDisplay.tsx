/**
 * Transit Window Display Component
 * 
 * Shows Sun, Moon, and Lagna transit timing windows for Phase 4.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@theme/ThemeProvider';
import type { TransitTriggerResult } from '@astrology/rkp/shamsiLogic';

interface TransitWindowDisplayProps {
  timing: TransitTriggerResult;
  timeline: 'macro' | 'micro';
}

export const TransitWindowDisplay: React.FC<TransitWindowDisplayProps> = ({
  timing,
  timeline,
}) => {
  const { colors, typography } = useTheme();
  const styles = createStyles(colors, typography);

  const hasAnyTiming = timing.sunWindow || timing.moonWindow || timing.lagnaWindow;

  if (!hasAnyTiming) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No transit windows found in the search period.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {timeline === 'macro' ? 'Solar Transit Window' : 'Timing Windows (Sun → Moon → Lagna)'}
      </Text>

      {timing.sunWindow && (
        <View style={styles.transitWindow}>
          <Text style={styles.bodyName}>☀️ Sun Transit</Text>
          <Text style={styles.timing}>
            {new Date(timing.sunWindow.startTimeIso).toLocaleString()} to{' '}
            {new Date(timing.sunWindow.endTimeIso).toLocaleString()}
          </Text>
        </View>
      )}

      {timing.moonWindow && (
        <View style={styles.transitWindow}>
          <Text style={styles.bodyName}>🌙 Moon Transit</Text>
          <Text style={styles.timing}>
            {new Date(timing.moonWindow.startTimeIso).toLocaleString()} to{' '}
            {new Date(timing.moonWindow.endTimeIso).toLocaleString()}
          </Text>
        </View>
      )}

      {timing.lagnaWindow && (
        <View style={styles.transitWindow}>
          <Text style={styles.bodyName}>⚡ Lagna Transit</Text>
          <Text style={styles.timing}>
            {new Date(timing.lagnaWindow.startTimeIso).toLocaleString()} to{' '}
            {new Date(timing.lagnaWindow.endTimeIso).toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
};

function createStyles(colors: any, typography: any) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.info,
    },
    title: {
      ...typography.headingSmall,
      color: colors.text,
      marginBottom: 12,
    },
    transitWindow: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
    },
    bodyName: {
      ...typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    timing: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontFamily: 'monospace',
    },
    emptyContainer: {
      backgroundColor: colors.warningBg,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.warning,
    },
  });
}
