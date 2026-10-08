/**
 * VerdictSeal — the one statement of a Reading's verdict.
 * --------------------------------------------------------------------------
 * RkpWatchCard and RemedyProtocolCard each used to open with their own
 * headline — "The way is closed" over "The chart does not carry this" — so a
 * seeker read the same answer twice, in two vocabularies, a screen apart. This
 * states it once, above both cards, and the cards are rendered without their
 * own headlines beneath it.
 *
 * Presentation only. The headline is the engine's watch state
 * (STATE_HEADLINE), the state the diagnosis is itself derived from; the
 * posture is the diagnosis's own; timing and confidence are the verdict's.
 * Nothing is recomputed or reconciled here.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import type { WatchOracleComposition } from '../../types/watchOracle';
import type { DisplayWatchVerdict } from '@astrology/rkp/watchJudgment';
import { STATE_HEADLINE, STATE_TONE, timingLabel } from './RkpWatchCard';
import { POSTURE_LABEL } from './RemedyProtocolCard';

/**
 * The line under the headline: what to do, when, and how sure. Each part is
 * left out when the reading does not carry it, never filled with a guess.
 */
export function verdictSubline(
  verdict: DisplayWatchVerdict,
  diagnosis?: WatchOracleComposition['diagnosis'] | null,
): string {
  const parts: string[] = [];
  const posture =
    diagnosis !== undefined && diagnosis !== null
      ? (POSTURE_LABEL[diagnosis.timingPosture] ?? null)
      : null;
  if (posture !== null) {
    parts.push(posture);
  }
  if (verdict.timing !== null && verdict.timing !== undefined) {
    parts.push(timingLabel(verdict));
  }
  if (typeof verdict.confidence === 'string') {
    parts.push(`${verdict.confidence.replace('_', ' ').toLowerCase()} confidence`);
  }
  return parts.join('  ·  ');
}

interface VerdictSealProps {
  verdict: DisplayWatchVerdict;
  diagnosis?: WatchOracleComposition['diagnosis'] | null;
}

const VerdictSeal: React.FC<VerdictSealProps> = ({ verdict, diagnosis }) => {
  const colors = useColors();
  const typography = useTypography();

  const tone = {
    maqbool: colors.maqbool,
    caution: colors.caution,
    mardood: colors.mardood,
    muted: colors.textMuted,
  };
  const stateColor = tone[STATE_TONE[verdict.state]] ?? colors.textMuted;
  const headline = STATE_HEADLINE[verdict.state] ?? 'This reading could not be described';
  const subline = verdictSubline(verdict, diagnosis);

  return (
    <View
      style={[styles.seal, { borderColor: stateColor + '66', backgroundColor: stateColor + '10' }]}
      accessibilityRole="header"
      testID="verdict-seal"
    >
      <Text style={[typography('caption'), styles.eyebrow, { color: stateColor }]}>
        {'✧ THE VERDICT ✧'}
      </Text>
      <Text style={[typography('heading'), styles.centred, { color: stateColor }]}>{headline}</Text>
      {subline.length > 0 && (
        <Text style={[typography('caption'), styles.centred, { color: colors.textMuted }]}>
          {subline}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  seal: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  eyebrow: {
    letterSpacing: 1.6,
    opacity: 0.8,
  },
  centred: {
    textAlign: 'center',
  },
});

export default VerdictSeal;
