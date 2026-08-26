/**
 * GuidanceCard — the Islamic-practice guidance chosen for one reading.
 * --------------------------------------------------------------------------
 * Renders what the selectRemedies Cloud Function picked from the client's own
 * candidate ranking (data/remedyLibrary.ts → rankCandidates → remedySelector).
 *
 * Deliberately a SEPARATE card from RemedyProtocolCard, because the two answer
 * different questions and come from different libraries:
 *
 *   RemedyProtocolCard  what the chart prescribes — the RKP diagnosis's own
 *                       interventions, composed server-side and arriving inside
 *                       WatchOracleComposition.protocol.
 *   GuidanceCard        which devotional practice suits this seeker now —
 *                       LLM-selected from the app's tagged Islamic remedy
 *                       library, keyed to the verdict's themes and severity.
 *
 * They share no remedy ids and are not alternatives to each other; showing
 * both is the intent, which is why this renders below the protocol rather
 * than in place of it.
 *
 * Presentation only — the ranking and the selection both happen before this
 * component sees anything.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import type { RenderedRemedy } from '../../data/remedyRenderer';

/** Unicode geometry rather than emoji, matching the rest of the surface. */
const CATEGORY_ICON: Readonly<Record<string, string>> = Object.freeze({
  salawat: '☽',
  dua: '✦',
  istikhara: '◈',
  sadaqa: '◇',
  charity: '◇',
  fasting: '◌',
  quran: '✧',
  dhikr: '📿',
  night_prayer: '★',
  silence: '◎',
  tawbah: '↩',
  gratitude: '✶',
});

/**
 * Shown when the selector returned no generated description — the remedy is
 * still real, so say what it is FOR rather than rendering an empty line.
 */
const EFFECT_LABEL: Readonly<Record<string, string>> = Object.freeze({
  spiritual_clearing: 'A practice of spiritual purification',
  calming: 'A practice of inner stillness',
  emotional_release: 'A practice of releasing what is held',
  surrender: 'A practice of returning to Allah',
  trust_building: 'A practice of deepening trust',
  reconciliation: 'A practice of mending what is broken',
  activation: 'A practice of renewed movement',
  grounding: 'A practice of returning to centre',
  humility: 'A practice of softening the self',
  clarity: 'A practice of clearing the inner eye',
  opening: 'A practice of opening closed doors',
  comfort: 'A practice of receiving divine comfort',
  patience: 'A practice of sacred waiting',
  gratitude: 'A practice of anchoring in blessing',
});

export interface GuidanceCardProps {
  remedies: readonly RenderedRemedy[];
}

const GuidanceCard: React.FC<GuidanceCardProps> = ({ remedies }) => {
  const colors = useColors();
  const typography = useTypography();

  if (remedies.length === 0) {
    return null;
  }

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
    >
      <Text style={[typography('label'), styles.heading, { color: colors.goldBright }]}>
        {'GUIDANCE FOR THIS MOMENT'}
      </Text>

      {remedies.map(remedy => (
        <View
          key={remedy.id}
          style={[
            styles.remedy,
            { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
          ]}
        >
          <Text
            style={[
              typography('label'),
              styles.categoryLine,
              { color: colors.goldBright, opacity: 0.6 },
            ]}
          >
            {(CATEGORY_ICON[remedy.category] ?? '◈') +
              '  ' +
              remedy.category.toUpperCase().replace(/_/g, ' ')}
          </Text>

          <Text style={[typography('body'), styles.title, { color: colors.text }]}>
            {remedy.title}
          </Text>

          <Text style={[typography('caption'), styles.description, { color: colors.textMuted }]}>
            {remedy.description ??
              EFFECT_LABEL[remedy.effectDimension] ??
              'A practice of sacred intention'}
          </Text>

          <View style={[styles.effectPill, { borderColor: colors.borderAccent }]}>
            <Text
              style={[
                typography('label'),
                styles.effectText,
                { color: colors.goldBright, opacity: 0.5 },
              ]}
            >
              {remedy.effectDimension.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 12,
  },
  heading: {
    textAlign: 'center',
    letterSpacing: 1.4,
    fontSize: 10,
    marginBottom: 12,
  },
  remedy: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  categoryLine: {
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  effectPill: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  effectText: {
    fontSize: 9,
    letterSpacing: 0.8,
  },
});

export default GuidanceCard;
