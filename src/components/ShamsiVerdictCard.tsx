/**
 * Shamsi Verdict Card Component
 * 
 * Displays the verdict, significator grades, and operative planets
 * in a structured, visually distinct format.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@theme/ThemeProvider';
import type { ShamsiVerdict } from '@astrology/rkp/shamsiLogic';

interface ShamsiVerdictCardProps {
  verdict: ShamsiVerdict;
}

export const ShamsiVerdictCard: React.FC<ShamsiVerdictCardProps> = ({ verdict }) => {
  const { colors, typography } = useTheme();
  const styles = createStyles(colors, typography);

  const operativePlanets = verdict.timeWindow.operative;
  const promiseVerdict = verdict.promise.verdict;

  return (
    <View style={styles.container}>
      {/* Promise Verdict Header */}
      <View
        style={[
          styles.verdictBox,
          promiseVerdict === 'PROMISED'
            ? styles.verdictPromised
            : promiseVerdict === 'DENIED'
              ? styles.verdictDenied
              : styles.verdictUnclear,
        ]}
      >
        <Text style={styles.verdictTitle}>{promiseVerdict}</Text>
        <Text style={styles.verdictSubtitle}>
          Cuspal Sub-Lord: {verdict.promise.cuspalSubLord}
        </Text>
        <Text style={styles.verdictSubtitle}>Star Lord: {verdict.promise.starLordOfCSL}</Text>
      </View>

      {/* Significator Grades */}
      <View style={styles.gradesSection}>
        <Text style={styles.sectionTitle}>Significator Grades</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.entries(verdict.significators).map(([planet, grade]) => {
            if (grade === null) return null;
            return (
              <View
                key={planet}
                style={[
                  styles.gradeChip,
                  grade === 'A'
                    ? styles.gradeA
                    : grade === 'B'
                      ? styles.gradeB
                      : grade === 'C'
                        ? styles.gradeC
                        : styles.gradeD,
                ]}
              >
                <Text style={styles.gradeChipText}>
                  {planet} [{grade}]
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Operative Planets (Phase 3) */}
      {operativePlanets.length > 0 && (
        <View style={styles.operativeSection}>
          <Text style={styles.sectionTitle}>Operative Planets</Text>
          {operativePlanets.map((op, idx) => (
            <View key={idx} style={styles.operativePlanetRow}>
              <Text style={styles.operativePlanetName}>{op.planet}</Text>
              <Text style={styles.operativePlanetMeta}>
                {op.dbaRole} • Grade {op.grade || 'N/A'}
              </Text>
            </View>
          ))}
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
      borderLeftColor: colors.accent,
    },
    verdictBox: {
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    verdictPromised: {
      backgroundColor: '#e8f5e9',
      borderLeftColor: '#4caf50',
    },
    verdictDenied: {
      backgroundColor: '#ffebee',
      borderLeftColor: '#f44336',
    },
    verdictUnclear: {
      backgroundColor: '#fff3e0',
      borderLeftColor: '#ff9800',
    },
    verdictTitle: {
      ...typography.headingSmall,
      color: colors.text,
      marginBottom: 4,
    },
    verdictSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 4,
    },
    gradesSection: {
      marginBottom: 16,
    },
    sectionTitle: {
      ...typography.labelMedium,
      color: colors.text,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    gradeChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
      marginBottom: 8,
    },
    gradeA: { backgroundColor: '#c8e6c9' },
    gradeB: { backgroundColor: '#fff9c4' },
    gradeC: { backgroundColor: '#ffe0b2' },
    gradeD: { backgroundColor: '#ffccbc' },
    gradeChipText: {
      ...typography.labelSmall,
      color: '#333',
      fontWeight: '600',
    },
    operativeSection: {
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: 12,
    },
    operativePlanetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.dividerLight,
    },
    operativePlanetName: {
      ...typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
    },
    operativePlanetMeta: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
  });
}
