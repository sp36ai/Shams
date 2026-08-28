/**
 * Shamsi Results Screen
 * 
 * Displays the complete verdict, grades, operative planets, and timing windows.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useTheme } from '@theme/ThemeProvider';
import { ShamsiVerdictCard } from '@components/ShamsiVerdictCard';
import { TransitWindowDisplay } from '@components/TransitWindowDisplay';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AskShamsiOracleResult } from '@firebase/askShamsiOracle';

type RootStackParamList = {
  ShamsiResults: { result: AskShamsiOracleResult };
};

type Props = NativeStackScreenProps<RootStackParamList, 'ShamsiResults'>;

export const ShamsiResultsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors, typography } = useTheme();
  const styles = createStyles(colors, typography);
  const { result } = route.params;

  const [showDetails, setShowDetails] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Shamsi Oracle Verdict:\n\n${result.narration}\n\nRemedies: ${result.remedy?.description || 'None'}`,
        title: 'Shamsi Oracle Reading',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Reading</Text>
        <Text style={styles.timestamp}>{new Date(result.computedAt).toLocaleString()}</Text>
      </View>

      {/* Question */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Question</Text>
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>"{result.question}"</Text>
        </View>
      </View>

      {/* Verdict (Placeholder - replace with actual ShamsiVerdict component) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>The Verdict</Text>
        <View style={styles.verdictBox}>
          <Text
            style={[
              styles.verdictText,
              result.verdict.promise === 'PROMISED'
                ? styles.verdictPromised
                : result.verdict.promise === 'DENIED'
                  ? styles.verdictDenied
                  : styles.verdictUnclear,
            ]}
          >
            {result.verdict.promise.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Narration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Oracle's Words</Text>
        <View style={styles.narrationBox}>
          <Text style={styles.narrationText}>{result.narration}</Text>
        </View>
      </View>

      {/* Remedy */}
      {result.remedy && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remedy</Text>
          <View style={styles.remedyBox}>
            <Text style={styles.remedyTitle}>{result.remedy.type}</Text>
            <Text style={styles.remedyDescription}>{result.remedy.description}</Text>
            {result.remedy.duration && (
              <Text style={styles.remedyDuration}>Duration: {result.remedy.duration}</Text>
            )}
          </View>
        </View>
      )}

      {/* Timing (Phase 4) */}
      {result.timing && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timing Windows</Text>
          {result.timing.sun && (
            <View style={styles.timingWindow}>
              <Text style={styles.timingLabel}>☀️ Sun Transit</Text>
              <Text style={styles.timingValue}>
                {new Date(result.timing.sun.startTime).toLocaleString()} to{' '}
                {new Date(result.timing.sun.endTime).toLocaleString()}
              </Text>
            </View>
          )}
          {result.timing.moon && (
            <View style={styles.timingWindow}>
              <Text style={styles.timingLabel}>🌙 Moon Transit</Text>
              <Text style={styles.timingValue}>
                {new Date(result.timing.moon.startTime).toLocaleString()} to{' '}
                {new Date(result.timing.moon.endTime).toLocaleString()}
              </Text>
            </View>
          )}
          {result.timing.lagna && (
            <View style={styles.timingWindow}>
              <Text style={styles.timingLabel}>⚡ Lagna Transit</Text>
              <Text style={styles.timingValue}>
                {new Date(result.timing.lagna.startTime).toLocaleString()} to{' '}
                {new Date(result.timing.lagna.endTime).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Operative Planets */}
      {result.verdict.operative.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operative Planets</Text>
          {result.verdict.operative.map((op, idx) => (
            <View key={idx} style={styles.operativeRow}>
              <Text style={styles.operativeText}>{op}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quota */}
      {result.quotaRemaining !== null && (
        <View style={styles.section}>
          <Text style={styles.quotaText}>Questions remaining today: {result.quotaRemaining}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.buttonShare]} onPress={handleShare}>
          <Text style={styles.buttonText}>📤 Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonBack]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonTextSecondary}>Ask Another</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

function createStyles(colors: any, typography: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    header: {
      marginBottom: 24,
    },
    headerTitle: {
      ...typography.headingLarge,
      color: colors.text,
      marginBottom: 4,
    },
    timestamp: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      ...typography.labelMedium,
      color: colors.text,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    questionBox: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
    },
    questionText: {
      ...typography.bodySmall,
      color: colors.text,
      fontStyle: 'italic',
    },
    verdictBox: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    verdictText: {
      ...typography.headingMedium,
      fontWeight: '700',
      letterSpacing: 1,
    },
    verdictPromised: {
      color: '#4caf50',
    },
    verdictDenied: {
      color: '#f44336',
    },
    verdictUnclear: {
      color: '#ff9800',
    },
    narrationBox: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.info,
    },
    narrationText: {
      ...typography.bodySmall,
      color: colors.text,
      lineHeight: 20,
    },
    remedyBox: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
    },
    remedyTitle: {
      ...typography.labelMedium,
      color: colors.text,
      marginBottom: 4,
      textTransform: 'capitalize',
    },
    remedyDescription: {
      ...typography.bodySmall,
      color: colors.text,
      marginBottom: 6,
    },
    remedyDuration: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    timingWindow: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
    },
    timingLabel: {
      ...typography.labelSmall,
      color: colors.text,
      marginBottom: 4,
      fontWeight: '600',
    },
    timingValue: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontFamily: 'monospace',
    },
    operativeRow: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 6,
    },
    operativeText: {
      ...typography.bodySmall,
      color: colors.text,
    },
    quotaText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonShare: {
      backgroundColor: colors.accent,
    },
    buttonBack: {
      backgroundColor: colors.accentLight,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    buttonText: {
      ...typography.labelMedium,
      color: '#fff',
      fontWeight: '600',
    },
    buttonTextSecondary: {
      ...typography.labelMedium,
      color: colors.accent,
      fontWeight: '600',
    },
  });
}
